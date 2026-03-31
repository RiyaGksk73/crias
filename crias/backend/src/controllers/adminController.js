const { User, AuditLog } = require('../models');
const logger = require('../utils/logger');

const logAudit = async (userId, action, resource, req, status = 'success', metadata = {}) => {
  try {
    await AuditLog.create({
      userId,
      action,
      resource,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      status,
      metadata
    });
  } catch (error) {
    logger.error('Audit log error:', error);
  }
};

// List all users
exports.listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update user role
exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'User not found'
      });
    }

    await logAudit(req.user._id, 'admin_action', 'user', req, 'success', {
      targetUserId: id,
      action: 'update_role',
      newRole: role
    });

    res.json({
      message: 'User role updated',
      user
    });
  } catch (error) {
    next(error);
  }
};

// Deactivate user
exports.deactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent self-deactivation
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'Cannot deactivate your own account'
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'User not found'
      });
    }

    await logAudit(req.user._id, 'admin_action', 'user', req, 'success', {
      targetUserId: id,
      action: 'deactivate'
    });

    res.json({
      message: 'User deactivated',
      user
    });
  } catch (error) {
    next(error);
  }
};

// Get audit logs
exports.getLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, userId, startDate, endDate } = req.query;

    const query = {};
    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// List ML models
exports.listModels = async (req, res, next) => {
  try {
    // In a real system, this would query the AI service or a database
    const models = [
      {
        name: 'logistic_regression',
        displayName: 'Logistic Regression',
        version: 'v1.0',
        isActive: false,
        description: 'Baseline model, fast inference'
      },
      {
        name: 'random_forest',
        displayName: 'Random Forest',
        version: 'v2.0',
        isActive: false,
        description: 'Ensemble model with n_estimators=100, max_depth=10'
      },
      {
        name: 'xgboost',
        displayName: 'XGBoost',
        version: 'v3.0',
        isActive: true,
        description: 'Default model with n_estimators=200, lr=0.05, max_depth=6'
      }
    ];

    res.json({ models });
  } catch (error) {
    next(error);
  }
};

// Set active model
exports.setActiveModel = async (req, res, next) => {
  try {
    const { modelName } = req.body;

    const validModels = ['logistic_regression', 'random_forest', 'xgboost'];
    if (!validModels.includes(modelName)) {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid model name'
      });
    }

    // In a real system, this would update a configuration in the database
    // For now, we just log the action
    await logAudit(req.user._id, 'admin_action', 'model', req, 'success', {
      action: 'set_active_model',
      modelName
    });

    res.json({
      message: `Active model set to ${modelName}`,
      activeModel: modelName
    });
  } catch (error) {
    next(error);
  }
};
