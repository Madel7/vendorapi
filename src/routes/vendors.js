// src/routes/vendors.js

const router   = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/vendorController');
const docCtrl  = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload   = require('../config/upload');

const vendorRules = [
  body('name').trim().notEmpty().withMessage('Vendor name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('category').notEmpty().withMessage('Category is required.'),
  body('status').optional().isIn(['active','pending','completed','inactive'])
    .withMessage('Invalid status value.'),
];

// All routes require authentication
router.use(authenticate);

router.get('/stats', ctrl.stats);

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);

router.post('/',    vendorRules, validate, ctrl.create);
router.patch('/:id',
  body('email').optional().isEmail().normalizeEmail(),
  body('status').optional().isIn(['active','pending','completed','inactive']),
  validate,
  ctrl.update
);
router.delete('/:id', ctrl.remove);

// Documents sub-resource
router.get( '/:vendorId/documents', docCtrl.list);
router.post('/:vendorId/documents',
  upload.single('file'),
  docCtrl.upload
);

module.exports = router;
