const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, adminOnly } = require('../middleware/auth');

// All settings routes require admin access
router.get('/', protect, adminOnly, settingsController.getSettings);
router.post('/update', protect, adminOnly, settingsController.updateSettings);
router.get('/audit-logs', protect, adminOnly, settingsController.getAuditLogs);
router.get('/export', protect, adminOnly, settingsController.exportSettings);
router.post('/import', protect, adminOnly, settingsController.importSettings);

module.exports = router;