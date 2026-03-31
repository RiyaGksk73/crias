const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      type: 'https://httpstatuses.com/400',
      title: 'Validation Error',
      status: 400,
      detail: 'Invalid input data',
      errors: errors.array()
    });
  }
  next();
};

// POST /api/auth/register
router.post('/register',
  authLimiter,
  [
    body('fullName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be 2-100 characters'),
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please enter a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[a-z]/)
      .withMessage('Password must contain a lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/\d/)
      .withMessage('Password must contain a number')
  ],
  validate,
  authController.register
);

// POST /api/auth/login
router.post('/login',
  authLimiter,
  [
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please enter a valid email'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  validate,
  authController.login
);

// POST /api/auth/logout
router.post('/logout', auth, authController.logout);

// GET /api/auth/me
router.get('/me', auth, authController.getMe);

// PUT /api/auth/password
router.put('/password',
  auth,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[a-z]/)
      .withMessage('New password must contain a lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('New password must contain an uppercase letter')
      .matches(/\d/)
      .withMessage('New password must contain a number')
  ],
  validate,
  authController.changePassword
);

// POST /api/auth/google - Google OAuth Login
router.post('/google',
  authLimiter,
  [
    body('credential')
      .notEmpty()
      .withMessage('Google credential is required')
  ],
  validate,
  authController.googleLogin
);

module.exports = router;
