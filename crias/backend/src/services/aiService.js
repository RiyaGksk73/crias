const axios = require('axios');
const logger = require('../utils/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT) || 30000;

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_SERVICE_TIMEOUT,
  headers: { 'Content-Type': 'application/json' }
});

// Call AI service for prediction
exports.predict = async (features, modelName = 'xgboost') => {
  try {
    const response = await aiClient.post('/ai/predict', {
      features,
      model_name: modelName
    });
    return response.data;
  } catch (error) {
    logger.error('AI predict error:', error.message);
    throw new Error(`AI service error: ${error.response?.data?.error || error.message}`);
  }
};

// Call AI service for SHAP explanation
exports.explain = async (features, modelName, predictionId) => {
  try {
    const response = await aiClient.post('/ai/explain', {
      features,
      model_name: modelName,
      prediction_id: predictionId
    });
    return response.data;
  } catch (error) {
    logger.error('AI explain error:', error.message);
    throw new Error(`AI service error: ${error.response?.data?.error || error.message}`);
  }
};

// Call AI service for counterfactual generation
exports.counterfactuals = async (features, targetPd = 0.30, constraints = {}) => {
  try {
    const defaultConstraints = {
      cash: { min: 0, max: 10000000, step: 10000 },
      debt: { min: 0, max: 50000000, step: 50000 },
      inventory: { min: 0, max: 20000000, step: 25000 }
    };
    
    const response = await aiClient.post('/ai/counterfactuals', {
      features,
      target_pd: targetPd,
      constraints: { ...defaultConstraints, ...constraints }
    });
    return response.data;
  } catch (error) {
    logger.error('AI counterfactuals error:', error.message);
    throw new Error(`AI service error: ${error.response?.data?.error || error.message}`);
  }
};

// Call AI service for strategy ranking
exports.strategies = async (original, counterfactuals, pdOld) => {
  try {
    const response = await aiClient.post('/ai/strategies', {
      original,
      counterfactuals,
      pd_old: pdOld
    });
    return response.data;
  } catch (error) {
    logger.error('AI strategies error:', error.message);
    throw new Error(`AI service error: ${error.response?.data?.error || error.message}`);
  }
};

// Health check for AI service
exports.healthCheck = async () => {
  try {
    const response = await aiClient.get('/health', { timeout: 5000 });
    return response.data;
  } catch (error) {
    logger.error('AI health check error:', error.message);
    return { status: 'unavailable', error: error.message };
  }
};
