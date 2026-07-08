const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true
  },
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancialEntry',
    required: true
  },
  modelUsed: {
    type: String,
    enum: ['logistic_regression', 'random_forest', 'xgboost'],
    required: true
  },
  modelVersion: {
    type: String,
    default: 'v1.0'
  },
  pd: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  riskLabel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  shapValues: [{
    feature: String,
    value: Number,
    direction: {
      type: String,
      enum: ['positive', 'negative']
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
predictionSchema.index({ firmId: 1, createdAt: -1 });
predictionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Prediction', predictionSchema);
