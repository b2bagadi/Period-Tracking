const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/database');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Google OAuth - Redirect to consent screen
exports.googleRedirect = async (req, res) => {
  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://period-tracking-pi.vercel.app/api/auth/google/callback';
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    
    res.redirect(authUrl.toString());
  } catch (error) {
    console.error('Google redirect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating Google Sign-In'
    });
  }
};

// Register with email and password
exports.register = async (req, res) => {
  try {
    const { email, password, fullName, dateOfBirth } = req.body;
    
    // Check if user already exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, date_of_birth, auth_provider)
       VALUES ($1, $2, $3, $4, 'email')
       RETURNING id, email, full_name, date_of_birth, created_at`,
      [email, passwordHash, fullName, dateOfBirth]
    );
    
    const user = result.rows[0];
    
    // Create default settings for user
    await pool.query(
      `INSERT INTO user_settings (user_id, cycle_length, period_length, notifications_enabled, reminder_days_before)
       VALUES ($1, 28, 5, true, 2)`,
      [user.id]
    );
    
    const token = generateToken(user.id);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          dateOfBirth: user.date_of_birth,
          authProvider: 'email',
          createdAt: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

// Login with email and password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = result.rows[0];
    
    // Check if user registered with Google
    if (user.auth_provider === 'google' && !user.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google Sign-In. Please use Google to login.'
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const token = generateToken(user.id);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          dateOfBirth: user.date_of_birth,
          authProvider: user.auth_provider,
          profilePicture: user.profile_picture,
          createdAt: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// Google Sign-In
exports.googleSignIn = async (req, res) => {
  try {
    const { idToken, code, redirectUri, fullName, dateOfBirth } = req.body;
    
    let googleIdToken = idToken;
    
    // If authorization code is provided, exchange it for tokens
    if (code) {
      console.log('Exchanging authorization code for tokens...');
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Token exchange failed:', errorData);
        throw new Error('Failed to exchange authorization code for tokens');
      }
      
      const tokenData = await tokenResponse.json();
      googleIdToken = tokenData.id_token;
      console.log('Successfully exchanged code for ID token');
    }
    
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: googleIdToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    
    // Check if user exists
    let result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleId, email]
    );
    
    let user;
    
    if (result.rows.length > 0) {
      // User exists - update Google ID if not set
      user = result.rows[0];
      
      if (!user.google_id) {
        await pool.query(
          'UPDATE users SET google_id = $1, auth_provider = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [googleId, 'google', user.id]
        );
      }
      
      // Update profile picture if available
      if (picture && !user.profile_picture) {
        await pool.query(
          'UPDATE users SET profile_picture = $1 WHERE id = $2',
          [picture, user.id]
        );
      }
    } else {
      // Create new user
      const insertResult = await pool.query(
        `INSERT INTO users (email, full_name, google_id, auth_provider, profile_picture, date_of_birth)
         VALUES ($1, $2, $3, 'google', $4, $5)
         RETURNING id, email, full_name, date_of_birth, profile_picture, created_at`,
        [email, name || fullName, googleId, picture, dateOfBirth]
      );
      
      user = insertResult.rows[0];
      
      // Create default settings for new Google user
      await pool.query(
        `INSERT INTO user_settings (user_id, cycle_length, period_length, notifications_enabled, reminder_days_before)
         VALUES ($1, 28, 5, true, 2)`,
        [user.id]
      );
    }
    
    const token = generateToken(user.id);
    
    res.json({
      success: true,
      message: 'Google Sign-In successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          dateOfBirth: user.date_of_birth,
          authProvider: 'google',
          profilePicture: user.profile_picture || picture,
          createdAt: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Google Sign-In error:', error);
    res.status(500).json({
      success: false,
      message: 'Error with Google Sign-In',
      error: error.message
    });
  }
};

// Google OAuth Callback for mobile app
exports.googleCallback = async (req, res) => {
  try {
    const { code, error: authError } = req.query;

    if (authError) {
      console.error('Google OAuth error:', authError);
      return res.redirect(`periodtracker://auth?error=${authError}`);
    }

    if (!code) {
      console.error('No authorization code received');
      return res.redirect('periodtracker://auth?error=no_code');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code: code.toString(),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect(`periodtracker://auth?error=token_exchange_failed`);
    }

    // Get user info from Google
    const ticket = await client.verifyIdToken({
      idToken: tokenData.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists
    let result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleId, email]
    );

    let user;

    if (result.rows.length > 0) {
      // User exists - update Google ID if not set
      user = result.rows[0];
      
      if (!user.google_id) {
        await pool.query(
          'UPDATE users SET google_id = $1, auth_provider = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [googleId, 'google', user.id]
        );
      }
      
      // Update profile picture if available
      if (picture && !user.profile_picture) {
        await pool.query(
          'UPDATE users SET profile_picture = $1 WHERE id = $2',
          [picture, user.id]
        );
      }
    } else {
      // Create new user
      const insertResult = await pool.query(
        `INSERT INTO users (email, full_name, google_id, auth_provider, profile_picture, date_of_birth)
         VALUES ($1, $2, $3, 'google', $4, NULL)
         RETURNING id, email, full_name, date_of_birth, profile_picture, created_at`,
        [email, name, googleId, picture]
      );
      
      user = insertResult.rows[0];
      
      // Create default settings for new Google user
      await pool.query(
        `INSERT INTO user_settings (user_id, cycle_length, period_length, notifications_enabled, reminder_days_before)
         VALUES ($1, 28, 5, true, 2)`,
        [user.id]
      );
    }

    const token = generateToken(user.id);

    // Redirect back to app with token
    res.redirect(`periodtracker://auth?token=${token}&userId=${user.id}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name || user.full_name)}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`periodtracker://auth?error=${encodeURIComponent(error.message)}`);
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;
    
    const result = await pool.query(
      'SELECT id, email, full_name, date_of_birth, profile_picture, auth_provider, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = result.rows[0];
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          dateOfBirth: user.date_of_birth,
          profilePicture: user.profile_picture,
          authProvider: user.auth_provider,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { fullName, dateOfBirth } = req.body;
    
    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, date_of_birth = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, full_name, date_of_birth, profile_picture, auth_provider, created_at`,
      [fullName, dateOfBirth, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = result.rows[0];
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          dateOfBirth: user.date_of_birth,
          profilePicture: user.profile_picture,
          authProvider: user.auth_provider,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = result.rows[0];
    
    // Check if user has password (Google users might not)
    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for Google Sign-In accounts'
      });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

// Delete account
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;
    
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account',
      error: error.message
    });
  }
};
