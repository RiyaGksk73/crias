const mongoose = require('mongoose');

const scenarioSchema = new mongoose.Schema({
  features: {
    current_ratio: Number,
    debt_ratio: Number,
    liquidity_ratio: Number,
    assets: Number,
    debt: Number,
    cash: Number,
    inventory: Number
  },
  pd_new: {
    type: Number,
    min: 0,
    max: 1
  },
  cost: {
    type: Number,
    min: 0
  },
  rces: {
    type: Number
  },
  rank: {
    type: Number,
    min: 1
  }
}, { _id: false });

const counterfactualSchema = new mongoose.Schema({
  predictionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prediction',
    required: true
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true
  },
  scenarios: [scenarioSchema]
}, {
  timestamps: true
});

// Index for prediction lookups
counterfactualSchema.index({ predictionId: 1 });

module.exports = mongoose.model('Counterfactual', counterfactualSchema);
