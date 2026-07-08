const mongoose = require('mongoose');
const { computeFeatures } = require('../utils/featureEngineering');

const financialEntrySchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportingPeriod: {
    type: Date,
    required: true
  },
  raw: {
    assets: {
      type: Number,
      required: true,
      min: [0, 'Assets must be non-negative']
    },
    debt: {
      type: Number,
      required: true,
      min: [0.01, 'Debt must be greater than 0']
    },
    cash: {
      type: Number,
      required: true,
      min: [0, 'Cash must be non-negative']
    },
    inventory: {
      type: Number,
      required: true,
      min: [0, 'Inventory must be non-negative']
    }
  },
  features: {
    current_ratio: Number,
    debt_ratio: Number,
    liquidity_ratio: Number
  }
}, {
  timestamps: true
});

// Compute features before saving
financialEntrySchema.pre('save', function(next) {
  if (this.isModified('raw')) {
    try {
      this.features = computeFeatures(this.raw);
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Compound index for efficient firm + period queries
financialEntrySchema.index({ firmId: 1, reportingPeriod: -1 });

module.exports = mongoose.model('FinancialEntry', financialEntrySchema);
