/**
 * AI Service (in-process)
 * -----------------------
 * Formerly an HTTP client to a Python Flask microservice. The ML logic now runs
 * natively in Node via ./ml/engine.js, so everything deploys as a single Vercel
 * app with no external Python service. The async interface is preserved so
 * controllers remain unchanged.
 */
const engine = require('../ml/engine');
const logger = require('../utils/logger');

exports.predict = async (features, modelName = 'xgboost') => {
  try {
    return engine.predict(features, modelName);
  } catch (error) {
    logger.error('AI predict error:', error.message);
    throw new Error(`AI engine error: ${error.message}`);
  }
};

exports.explain = async (features, modelName = 'xgboost') => {
  try {
    return engine.explain(features, modelName);
  } catch (error) {
    logger.error('AI explain error:', error.message);
    throw new Error(`AI engine error: ${error.message}`);
  }
};

exports.counterfactuals = async (features, targetPd = 0.3, constraints = {}) => {
  try {
    return engine.counterfactuals(features, targetPd, constraints);
  } catch (error) {
    logger.error('AI counterfactuals error:', error.message);
    throw new Error(`AI engine error: ${error.message}`);
  }
};

exports.strategies = async (original, counterfactuals, pdOld) => {
  try {
    return engine.rankStrategies(original, counterfactuals, pdOld);
  } catch (error) {
    logger.error('AI strategies error:', error.message);
    throw new Error(`AI engine error: ${error.message}`);
  }
};

exports.healthCheck = async () => {
  return { status: 'ok', engine: 'node-native', models: engine.VALID_MODELS };
};
