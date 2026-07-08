const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const predictController = require('../controllers/predictController');
const auth = require('../middleware/auth');
const { predictLimiter } = require('../middleware/rateLimiter');

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

// All routes require authentication
router.use(auth);

// POST /api/predict - Run PD prediction
router.post('/',
  predictLimiter,
  [
    body('firmId').isMongoId().withMessage('Invalid firm ID'),
    body('entryId').optional().isMongoId().withMessage('Invalid entry ID'),
    body('modelName').optional().isIn(['logistic_regression', 'random_forest', 'xgboost'])
      .withMessage('Invalid model name')
  ],
  validate,
  predictController.predict
);

// GET /api/predict/:firmId - Prediction history
router.get('/:firmId',
  [
    param('firmId').isMongoId().withMessage('Invalid firm ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  predictController.getHistory
);

// GET /api/predict/:firmId/latest - Latest prediction
router.get('/:firmId/latest',
  [param('firmId').isMongoId().withMessage('Invalid firm ID')],
  validate,
  predictController.getLatest
);

// POST /api/explain - Get SHAP values
router.post('/explain',
  [body('predictionId').isMongoId().withMessage('Invalid prediction ID')],
  validate,
  predictController.explain
);

// POST /api/counterfactuals - Generate DiCE scenarios
router.post('/counterfactuals',
  predictLimiter,
  [
    body('predictionId').isMongoId().withMessage('Invalid prediction ID'),
    body('targetPd').optional().isFloat({ min: 0, max: 1 }).withMessage('Target PD must be between 0 and 1'),
    body('constraints').optional().isObject()
  ],
  validate,
  predictController.counterfactuals
);

// POST /api/strategies - Compute RCES rankings
router.post('/strategies',
  [body('predictionId').isMongoId().withMessage('Invalid prediction ID')],
  validate,
  predictController.strategies
);

module.exports = router;
