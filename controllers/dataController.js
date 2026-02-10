const pool = require('../config/database');

// ==================== PERIODS ====================

// Get all periods for user
exports.getPeriods = async (req, res) => {
  try {
    const userId = req.userId;
    
    const result = await pool.query(
      'SELECT id, start_date as "startDate", end_date as "endDate", created_at as "createdAt" FROM periods WHERE user_id = $1 ORDER BY start_date ASC',
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        periods: result.rows
      }
    });
  } catch (error) {
    console.error('Get periods error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching periods',
      error: error.message
    });
  }
};

// Add new period
exports.addPeriod = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = req.body;
    
    const result = await pool.query(
      `INSERT INTO periods (user_id, start_date, end_date)
       VALUES ($1, $2, $3)
       RETURNING id, start_date as "startDate", end_date as "endDate", created_at as "createdAt"`,
      [userId, startDate, endDate]
    );
    
    res.status(201).json({
      success: true,
      message: 'Period added successfully',
      data: {
        period: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Add period error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding period',
      error: error.message
    });
  }
};

// Update period
exports.updatePeriod = async (req, res) => {
  try {
    const userId = req.userId;
    const { periodId } = req.params;
    const { startDate, endDate } = req.body;
    
    const result = await pool.query(
      `UPDATE periods 
       SET start_date = $1, end_date = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING id, start_date as "startDate", end_date as "endDate"`,
      [startDate, endDate, periodId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Period not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Period updated successfully',
      data: {
        period: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Update period error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating period',
      error: error.message
    });
  }
};

// Delete period
exports.deletePeriod = async (req, res) => {
  try {
    const userId = req.userId;
    const { periodId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM periods WHERE id = $1 AND user_id = $2 RETURNING id',
      [periodId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Period not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Period deleted successfully'
    });
  } catch (error) {
    console.error('Delete period error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting period',
      error: error.message
    });
  }
};

// ==================== SYMPTOMS ====================

// Get all symptoms for user
exports.getSymptoms = async (req, res) => {
  try {
    const userId = req.userId;
    
    const result = await pool.query(
      `SELECT 
        id, 
        date, 
        flow_intensity as "flowIntensity",
        mood,
        physical_symptoms as "physicalSymptoms",
        sexual_activity as "sexualActivity",
        temperature,
        notes,
        created_at as "createdAt"
       FROM symptoms 
       WHERE user_id = $1 
       ORDER BY date DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        symptoms: result.rows
      }
    });
  } catch (error) {
    console.error('Get symptoms error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching symptoms',
      error: error.message
    });
  }
};

// Get symptoms for specific date
exports.getSymptomsForDate = async (req, res) => {
  try {
    const userId = req.userId;
    const { date } = req.params;
    
    const result = await pool.query(
      `SELECT 
        id, 
        date, 
        flow_intensity as "flowIntensity",
        mood,
        physical_symptoms as "physicalSymptoms",
        sexual_activity as "sexualActivity",
        temperature,
        notes
       FROM symptoms 
       WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );
    
    res.json({
      success: true,
      data: {
        symptom: result.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Get symptoms for date error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching symptoms',
      error: error.message
    });
  }
};

// Add or update symptom
exports.addOrUpdateSymptom = async (req, res) => {
  try {
    const userId = req.userId;
    const { date, flowIntensity, mood, physicalSymptoms, sexualActivity, temperature, notes } = req.body;
    
    // Use UPSERT (INSERT ... ON CONFLICT UPDATE)
    const result = await pool.query(
      `INSERT INTO symptoms (user_id, date, flow_intensity, mood, physical_symptoms, sexual_activity, temperature, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, date) 
       DO UPDATE SET
         flow_intensity = EXCLUDED.flow_intensity,
         mood = EXCLUDED.mood,
         physical_symptoms = EXCLUDED.physical_symptoms,
         sexual_activity = EXCLUDED.sexual_activity,
         temperature = EXCLUDED.temperature,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING 
         id, 
         date, 
         flow_intensity as "flowIntensity",
         mood,
         physical_symptoms as "physicalSymptoms",
         sexual_activity as "sexualActivity",
         temperature,
         notes`,
      [userId, date, flowIntensity, mood, JSON.stringify(physicalSymptoms), sexualActivity, temperature, notes]
    );
    
    res.json({
      success: true,
      message: 'Symptom saved successfully',
      data: {
        symptom: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Add/Update symptom error:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving symptom',
      error: error.message
    });
  }
};

// Delete symptom
exports.deleteSymptom = async (req, res) => {
  try {
    const userId = req.userId;
    const { symptomId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM symptoms WHERE id = $1 AND user_id = $2 RETURNING id',
      [symptomId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Symptom not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Symptom deleted successfully'
    });
  } catch (error) {
    console.error('Delete symptom error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting symptom',
      error: error.message
    });
  }
};

// ==================== SETTINGS ====================

// Get user settings
exports.getSettings = async (req, res) => {
  try {
    const userId = req.userId;
    
    const result = await pool.query(
      `SELECT 
        cycle_length as "cycleLength",
        period_length as "periodLength",
        notifications_enabled as "notificationsEnabled",
        reminder_days_before as "reminderDaysBefore"
       FROM user_settings 
       WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      // Return default settings
      return res.json({
        success: true,
        data: {
          settings: {
            cycleLength: 28,
            periodLength: 5,
            notificationsEnabled: true,
            reminderDaysBefore: 2
          }
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        settings: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings',
      error: error.message
    });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.userId;
    const { cycleLength, periodLength, notificationsEnabled, reminderDaysBefore } = req.body;
    
    // Use UPSERT
    const result = await pool.query(
      `INSERT INTO user_settings (user_id, cycle_length, period_length, notifications_enabled, reminder_days_before)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) 
       DO UPDATE SET
         cycle_length = EXCLUDED.cycle_length,
         period_length = EXCLUDED.period_length,
         notifications_enabled = EXCLUDED.notifications_enabled,
         reminder_days_before = EXCLUDED.reminder_days_before,
         updated_at = CURRENT_TIMESTAMP
       RETURNING 
         cycle_length as "cycleLength",
         period_length as "periodLength",
         notifications_enabled as "notificationsEnabled",
         reminder_days_before as "reminderDaysBefore"`,
      [userId, cycleLength, periodLength, notificationsEnabled, reminderDaysBefore]
    );
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        settings: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings',
      error: error.message
    });
  }
};

// ==================== SYNC ALL DATA ====================

// Sync all user data (for initial load or full sync)
exports.syncAllData = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get all data in parallel
    const [periodsResult, symptomsResult, settingsResult] = await Promise.all([
      pool.query(
        'SELECT id, start_date as "startDate", end_date as "endDate" FROM periods WHERE user_id = $1 ORDER BY start_date ASC',
        [userId]
      ),
      pool.query(
        `SELECT 
          date, 
          flow_intensity as "flowIntensity",
          mood,
          physical_symptoms as "physicalSymptoms",
          sexual_activity as "sexualActivity",
          temperature,
          notes
         FROM symptoms 
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT 
          cycle_length as "cycleLength",
          period_length as "periodLength",
          notifications_enabled as "notificationsEnabled",
          reminder_days_before as "reminderDaysBefore"
         FROM user_settings 
         WHERE user_id = $1`,
        [userId]
      )
    ]);
    
    // Convert symptoms array to object keyed by date
    const symptomsObj = {};
    symptomsResult.rows.forEach(symptom => {
      symptomsObj[symptom.date] = symptom;
    });
    
    res.json({
      success: true,
      data: {
        periods: periodsResult.rows,
        symptoms: symptomsObj,
        settings: settingsResult.rows[0] || {
          cycleLength: 28,
          periodLength: 5,
          notificationsEnabled: true,
          reminderDaysBefore: 2
        }
      }
    });
  } catch (error) {
    console.error('Sync all data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing data',
      error: error.message
    });
  }
};
