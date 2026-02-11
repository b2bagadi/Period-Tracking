const pool = require('./config/database');

const initDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        full_name VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        google_id VARCHAR(255) UNIQUE,
        firebase_id VARCHAR(255) UNIQUE,
        auth_provider VARCHAR(50) DEFAULT 'email',
        profile_picture VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index on email for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);
    
    // Create index on google_id for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)
    `);
    
    // Create index on firebase_id for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_firebase_id ON users(firebase_id)
    `);
    
    // Migration: Add firebase_id column if it doesn't exist (for existing databases)
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_id VARCHAR(255) UNIQUE
      `);
      console.log('✅ firebase_id column added (or already exists)');
    } catch (error) {
      console.log('Note: firebase_id column may already exist');
    }
    
    // Migration: Make date_of_birth nullable (for Firebase users)
    try {
      await pool.query(`
        ALTER TABLE users ALTER COLUMN date_of_birth DROP NOT NULL
      `);
      console.log('✅ date_of_birth is now nullable');
    } catch (error) {
      console.log('Note: date_of_birth may already be nullable');
    }
    
    // Create periods table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS periods (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index on user_id and start_date for periods
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_periods_user_id ON periods(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_periods_start_date ON periods(start_date)
    `);
    
    // Create symptoms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS symptoms (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        flow_intensity VARCHAR(50),
        mood VARCHAR(100),
        physical_symptoms JSONB,
        sexual_activity VARCHAR(100),
        temperature DECIMAL(4,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);
    
    // Create index on user_id and date for symptoms
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_symptoms_user_id ON symptoms(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_symptoms_date ON symptoms(date)
    `);
    
    // Create user_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        cycle_length INTEGER DEFAULT 28,
        period_length INTEGER DEFAULT 5,
        notifications_enabled BOOLEAN DEFAULT true,
        reminder_days_before INTEGER DEFAULT 2,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);
    
    // Create index on user_id for settings
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)
    `);
    
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

module.exports = initDatabase;
