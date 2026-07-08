const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/rbac');

// Validation helper
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      type: 'https://httpstatuses.com/400',
      title: 'Validation Error',
      status: 400,
      errors: errors.array()
    });
  }
  next();
};

// All admin routes require authentication and admin role
router.use(auth);
router.use(isAdmin);

// GET /api/admin/users - List users
router.get('/users',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['analyst', 'manager', 'admin']),
    query('isActive').optional().isBoolean()
  ],
  validate,
  adminController.listUsers
);

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('role').isIn(['analyst', 'manager', 'admin']).withMessage('Invalid role')
  ],
  validate,
  adminController.updateRole
);

// DELETE /api/admin/users/:id - Deactivate user
router.delete('/users/:id',
  [param('id').isMongoId().withMessage('Invalid user ID')],
  validate,
  adminController.deactivateUser
);

// GET /api/admin/logs - Audit logs
router.get('/logs',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('action').optional().isString(),
    query('userId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validate,
  adminController.getLogs
);

// GET /api/admin/models - List ML models
router.get('/models', adminController.listModels);

// PUT /api/admin/models/active - Set active model
router.put('/models/active',
  [body('modelName').isIn(['logistic_regression', 'random_forest', 'xgboost'])
    .withMessage('Invalid model name')],
  validate,
  adminController.setActiveModel
);

module.exports = router;
