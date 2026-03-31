const express = require('express');
const { body, param, query } = require('express-validator');
const multer = require('multer');
const router = express.Router();

const firmController = require('../controllers/firmController');
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/rbac');

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

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

// POST /api/firms - Create firm
router.post('/',
  [
    body('firmName').trim().isLength({ min: 2, max: 200 }).withMessage('Firm name must be 2-200 characters'),
    body('firmCode').trim().isLength({ min: 2, max: 20 }).matches(/^[A-Za-z0-9]+$/).withMessage('Firm code must be 2-20 alphanumeric characters'),
    body('industry').optional().trim().isLength({ max: 100 }),
    body('assignedManager').optional().isMongoId()
  ],
  validate,
  firmController.create
);

// GET /api/firms - List all firms
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim()
  ],
  validate,
  firmController.list
);

// GET /api/firms/:id - Get firm by ID
router.get('/:id',
  [param('id').isMongoId().withMessage('Invalid firm ID')],
  validate,
  firmController.getById
);

// PUT /api/firms/:id - Update firm
router.put('/:id',
  [
    param('id').isMongoId().withMessage('Invalid firm ID'),
    body('firmName').optional().trim().isLength({ min: 2, max: 200 }),
    body('industry').optional().trim().isLength({ max: 100 }),
    body('assignedManager').optional().isMongoId()
  ],
  validate,
  firmController.update
);

// DELETE /api/firms/:id - Delete firm (admin only)
router.delete('/:id',
  isAdmin,
  [param('id').isMongoId().withMessage('Invalid firm ID')],
  validate,
  firmController.delete
);

// POST /api/firms/:id/data - Submit accounting data
router.post('/:id/data',
  [
    param('id').isMongoId().withMessage('Invalid firm ID'),
    body('reportingPeriod').isISO8601().withMessage('Invalid reporting period date'),
    body('assets').isFloat({ min: 0 }).withMessage('Assets must be non-negative'),
    body('debt').isFloat({ gt: 0 }).withMessage('Debt must be greater than 0'),
    body('cash').isFloat({ min: 0 }).withMessage('Cash must be non-negative'),
    body('inventory').isFloat({ min: 0 }).withMessage('Inventory must be non-negative')
  ],
  validate,
  firmController.submitData
);

// POST /api/firms/upload - Bulk CSV upload
router.post('/upload',
  upload.single('file'),
  firmController.bulkUpload
);

// GET /api/firms/:id/entries - Get financial entries
router.get('/:id/entries',
  [
    param('id').isMongoId().withMessage('Invalid firm ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  firmController.getEntries
);

module.exports = router;
