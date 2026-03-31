const mongoose = require('mongoose');

const firmSchema = new mongoose.Schema({
  firmName: {
    type: String,
    required: [true, 'Firm name is required'],
    trim: true,
    minlength: 2,
    maxlength: 200
  },
  firmCode: {
    type: String,
    required: [true, 'Firm code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]{2,20}$/, 'Firm code must be 2-20 alphanumeric characters']
  },
  industry: {
    type: String,
    trim: true,
    maxlength: 100
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
firmSchema.index({ firmCode: 1 });
firmSchema.index({ createdBy: 1 });
firmSchema.index({ assignedManager: 1 });

module.exports = mongoose.model('Firm', firmSchema);
