// src/routes/documents.js

const router = require('express').Router();
const ctrl   = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get( '/:id/download', ctrl.download);
router.delete('/:id',        ctrl.remove);

module.exports = router;
