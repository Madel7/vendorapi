// src/routes/events.js

const router   = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/eventController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);

router.post('/',
  body('name').trim().notEmpty(),
  body('event_date').isDate().withMessage('Valid date (YYYY-MM-DD) required.'),
  validate,
  ctrl.create
);

router.patch('/:id', validate, ctrl.update);
router.delete('/:id', ctrl.remove);

// Bulk-assign vendors to an event
router.put('/:id/vendors',
  body('vendor_ids').isArray().withMessage('vendor_ids must be an array.'),
  validate,
  ctrl.assignVendors
);

module.exports = router;
