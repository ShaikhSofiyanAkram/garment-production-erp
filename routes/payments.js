// const express = require('express');
// const router = express.Router();
// const { protect, adminOnly } = require('../middleware/auth');

// const workerPaymentController = require('../controllers/workerPaymentController');
// const paymentAdvanceController = require('../controllers/paymentAdvanceController');

// // =============================================================
// // ✅ STATIC ROUTES (BEFORE /:id) - FIXED
// // =============================================================

// // Print & Collect
// router.get('/print-statement', protect, adminOnly, workerPaymentController.printStatement);
// router.get('/collect-payment', protect, adminOnly, workerPaymentController.collectPayment);

// // ✅ Advance Routes - CORRECTED
// router.get('/advances', protect, adminOnly, paymentAdvanceController.getPaymentAdvanceDashboard);
// router.post('/advances/create', protect, adminOnly, paymentAdvanceController.createPaymentAdvance);
// router.post('/advances/:id/adjust', protect, adminOnly, paymentAdvanceController.adjustPaymentAdvance);
// router.delete('/advances/:id/cancel', protect, adminOnly, paymentAdvanceController.cancelPaymentAdvance);

// // =============================================================
// // ✅ DYNAMIC ROUTES (WITH :id)
// // =============================================================

// router.get('/worker/:id', protect, adminOnly, workerPaymentController.getWorkerDetail);
// router.get('/worker/:id/statement', protect, adminOnly, workerPaymentController.getWorkerStatement);

// // =============================================================
// // ✅ DASHBOARD
// // =============================================================

// router.get('/', protect, adminOnly, workerPaymentController.getPaymentDashboard);

// // =============================================================
// // ✅ API ROUTES
// // =============================================================

// router.get('/api/workers', protect, workerPaymentController.getWorkersByType);
// router.post('/api/advance', protect, adminOnly, workerPaymentController.recordAdvance);
// router.get('/api/advances', protect, workerPaymentController.getRecentAdvances);
// router.post('/api/record-payment', protect, adminOnly, workerPaymentController.recordPayment);
// router.post('/api/bulk-payment', protect, adminOnly, workerPaymentController.bulkPayment);

// module.exports = router;


const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');

const workerPaymentController = require('../controllers/workerPaymentController');

// =============================================================
// ✅ STATIC ROUTES
// =============================================================

// Print & Collect
router.get('/print-statement', protect, adminOnly, workerPaymentController.printStatement);
router.get('/collect-payment', protect, adminOnly, workerPaymentController.collectPayment);

// ✅ Advance Routes
router.get('/advances', protect, adminOnly, workerPaymentController.getAdvancesPage);
router.post('/api/advance', protect, adminOnly, workerPaymentController.recordAdvance);
router.get('/api/advances/:workerId', protect, workerPaymentController.getWorkerAdvances);
router.post('/api/advance/:id/adjust', protect, adminOnly, workerPaymentController.adjustAdvance);
router.delete('/api/advance/:id', protect, adminOnly, workerPaymentController.deleteAdvance);

// =============================================================
// ✅ DYNAMIC ROUTES
// =============================================================

router.get('/worker/:id', protect, adminOnly, workerPaymentController.getWorkerDetail);
router.get('/worker/:id/statement', protect, adminOnly, workerPaymentController.getWorkerStatement);

// =============================================================
// ✅ DASHBOARD
// =============================================================

router.get('/', protect, adminOnly, workerPaymentController.getPaymentDashboard);

// =============================================================
// ✅ API ROUTES
// =============================================================

router.get('/api/workers', protect, workerPaymentController.getWorkersByType);
router.get('/api/advances', protect, workerPaymentController.getRecentAdvances);
router.post('/api/record-payment', protect, adminOnly, workerPaymentController.recordPayment);
router.post('/api/bulk-payment', protect, adminOnly, workerPaymentController.bulkPayment);

module.exports = router;