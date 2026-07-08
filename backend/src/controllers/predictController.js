const { Prediction, FinancialEntry, Firm, Counterfactual, AuditLog } = require('../models');
const aiService = require('../services/aiService');
const { getRiskLabel } = require('../utils/featureEngineering');
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

// Run PD prediction
exports.predict = async (req, res, next) => {
  try {
    const { firmId, entryId, modelName = 'xgboost' } = req.body;

    // Validate firm exists
    const firm = await Firm.findById(firmId);
    if (!firm) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Firm not found'
      });
    }

    // Get financial entry
    let entry;
    if (entryId) {
      entry = await FinancialEntry.findById(entryId);
    } else {
      // Use latest entry
      entry = await FinancialEntry.findOne({ firmId }).sort({ reportingPeriod: -1 });
    }

    if (!entry) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'No financial data found for this firm'
      });
    }

    // Call AI service
    const aiResult = await aiService.predict(entry.features, modelName);

    // Get SHAP values
    let shapValues = [];
    try {
      const shapResult = await aiService.explain(entry.features, modelName, null);
      shapValues = shapResult.shapValues || [];
    } catch (shapError) {
      logger.warn('SHAP explanation failed:', shapError.message);
    }

    // Create prediction record
    const prediction = await Prediction.create({
      firmId: firm._id,
      entryId: entry._id,
      modelUsed: modelName,
      modelVersion: aiResult.modelVersion || 'v1.0',
      pd: aiResult.pd,
      riskLabel: getRiskLabel(aiResult.pd),
      shapValues,
      createdBy: req.user._id
    });

    await logAudit(req.user._id, 'predict', 'prediction', req, 'success', {
      firmId: firm._id,
      predictionId: prediction._id,
      pd: prediction.pd
    });

    res.status(201).json({
      message: 'Prediction completed',
      prediction: {
        ...prediction.toObject(),
        firm: { firmName: firm.firmName, firmCode: firm.firmCode }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get prediction history for a firm
exports.getHistory = async (req, res, next) => {
  try {
    const { firmId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const predictions = await Prediction.find({ firmId })
      .populate('entryId', 'reportingPeriod raw features')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Prediction.countDocuments({ firmId });

    res.json({
      predictions,
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

// Get latest prediction for a firm
exports.getLatest = async (req, res, next) => {
  try {
    const { firmId } = req.params;

    const prediction = await Prediction.findOne({ firmId })
      .populate('entryId', 'reportingPeriod raw features')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });

    if (!prediction) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'No predictions found for this firm'
      });
    }

    // Also get counterfactuals if they exist
    const counterfactual = await Counterfactual.findOne({ predictionId: prediction._id });

    res.json({
      prediction,
      counterfactual
    });
  } catch (error) {
    next(error);
  }
};

// Get SHAP explanation
exports.explain = async (req, res, next) => {
  try {
    const { predictionId } = req.body;

    const prediction = await Prediction.findById(predictionId)
      .populate('entryId');

    if (!prediction) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Prediction not found'
      });
    }

    // Return cached SHAP values if available
    if (prediction.shapValues && prediction.shapValues.length > 0) {
      return res.json({ shapValues: prediction.shapValues });
    }

    // Otherwise compute fresh SHAP values
    const result = await aiService.explain(
      prediction.entryId.features,
      prediction.modelUsed,
      prediction._id
    );

    // Update prediction with SHAP values
    prediction.shapValues = result.shapValues;
    await prediction.save();

    res.json({ shapValues: result.shapValues });
  } catch (error) {
    next(error);
  }
};

// Generate counterfactuals
exports.counterfactuals = async (req, res, next) => {
  try {
    const { predictionId, targetPd = 0.30, constraints } = req.body;

    const prediction = await Prediction.findById(predictionId)
      .populate('entryId');

    if (!prediction) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Prediction not found'
      });
    }

    const features = {
      ...prediction.entryId.features,
      ...prediction.entryId.raw
    };

    const result = await aiService.counterfactuals(features, targetPd, constraints);

    // Store counterfactuals
    const counterfactual = await Counterfactual.findOneAndUpdate(
      { predictionId: prediction._id },
      {
        predictionId: prediction._id,
        firmId: prediction.firmId,
        scenarios: result.scenarios
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Counterfactuals generated',
      counterfactual
    });
  } catch (error) {
    next(error);
  }
};

// Compute strategy rankings (RCES)
exports.strategies = async (req, res, next) => {
  try {
    const { predictionId } = req.body;

    const prediction = await Prediction.findById(predictionId)
      .populate('entryId');

    if (!prediction) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Prediction not found'
      });
    }

    const counterfactual = await Counterfactual.findOne({ predictionId: prediction._id });

    if (!counterfactual || !counterfactual.scenarios.length) {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'No counterfactuals found. Generate counterfactuals first.'
      });
    }

    const original = {
      ...prediction.entryId.features,
      ...prediction.entryId.raw
    };

    const result = await aiService.strategies(
      original,
      counterfactual.scenarios,
      prediction.pd
    );

    // Update counterfactual with ranked scenarios
    counterfactual.scenarios = result.ranked;
    await counterfactual.save();

    res.json({
      message: 'Strategies ranked',
      strategies: result.ranked
    });
  } catch (error) {
    next(error);
  }
};
