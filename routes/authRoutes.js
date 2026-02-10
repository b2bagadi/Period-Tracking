const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const dataController = require('../controllers/dataController');
const authMiddleware = require('../middleware/authMiddleware');

// Validation middleware
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const googleSignInValidation = [
  body('idToken')
    .notEmpty()
    .withMessage('Google ID token is required')
];

// ==================== AUTH ROUTES ====================
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/google', googleSignInValidation, authController.googleSignIn);
router.get('/me', authMiddleware, authController.getCurrentUser);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/change-password', authMiddleware, authController.changePassword);
router.delete('/account', authMiddleware, authController.deleteAccount);

// ==================== DATA ROUTES ====================
// Sync all data
router.get('/sync', authMiddleware, dataController.syncAllData);

// Periods
router.get('/periods', authMiddleware, dataController.getPeriods);
router.post('/periods', authMiddleware, dataController.addPeriod);
router.put('/periods/:periodId', authMiddleware, dataController.updatePeriod);
router.delete('/periods/:periodId', authMiddleware, dataController.deletePeriod);

// Symptoms
router.get('/symptoms', authMiddleware, dataController.getSymptoms);
router.get('/symptoms/:date', authMiddleware, dataController.getSymptomsForDate);
router.post('/symptoms', authMiddleware, dataController.addOrUpdateSymptom);
router.delete('/symptoms/:symptomId', authMiddleware, dataController.deleteSymptom);

// Settings
router.get('/settings', authMiddleware, dataController.getSettings);
router.put('/settings', authMiddleware, dataController.updateSettings);

module.exports = router;
