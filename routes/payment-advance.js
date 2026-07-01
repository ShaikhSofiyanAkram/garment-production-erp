const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const paymentAdvanceController = require('../controllers/paymentAdvanceController');

// ==================== PAYMENT ADVANCE ROUTES ====================
router.get('/', protect, adminOnly, paymentAdvanceController.getPaymentAdvanceDashboard);
router.post('/create', protect, adminOnly, paymentAdvanceController.createPaymentAdvance);
router.post('/:id/adjust', protect, adminOnly, paymentAdvanceController.adjustPaymentAdvance);
router.delete('/:id/cancel', protect, adminOnly, paymentAdvanceController.cancelPaymentAdvance);

// ==================== API ROUTES ====================
router.get('/api/worker/:id', protect, paymentAdvanceController.getWorkerPaymentAdvances);
router.get('/api/summary', protect, paymentAdvanceController.getPaymentAdvanceSummary);

module.exports = router;