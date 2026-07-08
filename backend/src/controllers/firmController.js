const { Firm, FinancialEntry, AuditLog } = require('../models');
const logger = require('../utils/logger');
const csv = require('csv-parser');
const { Readable } = require('stream');

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

// Create firm
exports.create = async (req, res, next) => {
  try {
    const { firmName, firmCode, industry, assignedManager } = req.body;

    const firm = await Firm.create({
      firmName,
      firmCode: firmCode.toUpperCase(),
      industry,
      createdBy: req.user._id,
      assignedManager
    });

    await logAudit(req.user._id, 'create', 'firm', req, 'success', { firmId: firm._id });

    res.status(201).json({
      message: 'Firm created successfully',
      firm
    });
  } catch (error) {
    next(error);
  }
};

// List all firms
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { firmName: { $regex: search, $options: 'i' } },
        { firmCode: { $regex: search, $options: 'i' } }
      ];
    }

    const firms = await Firm.find(query)
      .populate('createdBy', 'fullName email')
      .populate('assignedManager', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Firm.countDocuments(query);

    res.json({
      firms,
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

// Get firm by ID
exports.getById = async (req, res, next) => {
  try {
    const firm = await Firm.findById(req.params.id)
      .populate('createdBy', 'fullName email')
      .populate('assignedManager', 'fullName email');

    if (!firm) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Firm not found'
      });
    }

    // Get latest financial entry
    const latestEntry = await FinancialEntry.findOne({ firmId: firm._id })
      .sort({ reportingPeriod: -1 });

    res.json({
      firm,
      latestEntry
    });
  } catch (error) {
    next(error);
  }
};

// Update firm
exports.update = async (req, res, next) => {
  try {
    const { firmName, industry, assignedManager } = req.body;

    const firm = await Firm.findByIdAndUpdate(
      req.params.id,
      { firmName, industry, assignedManager },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'fullName email')
      .populate('assignedManager', 'fullName email');

    if (!firm) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Firm not found'
      });
    }

    await logAudit(req.user._id, 'update', 'firm', req, 'success', { firmId: firm._id });

    res.json({
      message: 'Firm updated successfully',
      firm
    });
  } catch (error) {
    next(error);
  }
};

// Delete firm (admin only)
exports.delete = async (req, res, next) => {
  try {
    const firm = await Firm.findByIdAndDelete(req.params.id);

    if (!firm) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Firm not found'
      });
    }

    // Delete associated financial entries
    await FinancialEntry.deleteMany({ firmId: firm._id });

    await logAudit(req.user._id, 'delete', 'firm', req, 'success', { firmId: firm._id, firmCode: firm.firmCode });

    res.json({
      message: 'Firm deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Submit accounting data
exports.submitData = async (req, res, next) => {
  try {
    const { reportingPeriod, assets, debt, cash, inventory } = req.body;

    const firm = await Firm.findById(req.params.id);
    if (!firm) {
      return res.status(404).json({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Firm not found'
      });
    }

    const entry = await FinancialEntry.create({
      firmId: firm._id,
      submittedBy: req.user._id,
      reportingPeriod: new Date(reportingPeriod),
      raw: { assets, debt, cash, inventory }
    });

    await logAudit(req.user._id, 'create', 'financial_entry', req, 'success', { 
      firmId: firm._id, 
      entryId: entry._id 
    });

    res.status(201).json({
      message: 'Financial data submitted successfully',
      entry
    });
  } catch (error) {
    next(error);
  }
};

// Bulk CSV upload
exports.bulkUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'No CSV file uploaded'
      });
    }

    const results = [];
    const errors = [];
    let rowIndex = 0;

    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', async (row) => {
          rowIndex++;
          try {
            const { firmCode, reportingPeriod, assets, debt, cash, inventory } = row;
            
            const firm = await Firm.findOne({ firmCode: firmCode.toUpperCase() });
            if (!firm) {
              errors.push({ row: rowIndex, error: `Firm not found: ${firmCode}` });
              return;
            }

            results.push({
              firmId: firm._id,
              submittedBy: req.user._id,
              reportingPeriod: new Date(reportingPeriod),
              raw: {
                assets: parseFloat(assets),
                debt: parseFloat(debt),
                cash: parseFloat(cash),
                inventory: parseFloat(inventory)
              }
            });
          } catch (err) {
            errors.push({ row: rowIndex, error: err.message });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Bulk insert valid entries
    let insertedCount = 0;
    if (results.length > 0) {
      const inserted = await FinancialEntry.insertMany(results, { ordered: false });
      insertedCount = inserted.length;
    }

    await logAudit(req.user._id, 'upload', 'financial_entry', req, 'success', { 
      totalRows: rowIndex,
      inserted: insertedCount,
      errors: errors.length
    });

    res.json({
      message: 'Bulk upload completed',
      summary: {
        totalRows: rowIndex,
        inserted: insertedCount,
        errors: errors.length
      },
      errors: errors.slice(0, 10) // Return first 10 errors
    });
  } catch (error) {
    next(error);
  }
};

// Get financial entries for a firm
exports.getEntries = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const entries = await FinancialEntry.find({ firmId: req.params.id })
      .populate('submittedBy', 'fullName email')
      .sort({ reportingPeriod: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await FinancialEntry.countDocuments({ firmId: req.params.id });

    res.json({
      entries,
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
