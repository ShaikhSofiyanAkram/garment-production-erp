const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const advanceController = require('../controllers/advanceClientController');

// Advance management routes
router.get('/', protect, adminOnly, advanceController.getAdvances);
router.post('/create', protect, adminOnly, advanceController.createAdvance);
router.get('/client/:clientId', protect, adminOnly, advanceController.getClientAdvance);
router.post('/adjust', protect, adminOnly, advanceController.adjustAdvance);
router.delete('/delete/:id', protect, adminOnly, advanceController.deleteAdvance);
router.get('/statement', protect, adminOnly, advanceController.getAdvanceStatement);

module.exports = router;