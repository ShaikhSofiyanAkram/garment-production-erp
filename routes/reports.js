const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect, adminOnly } = require('../middleware/auth');


const paymentReportController = require('../controllers/paymentReportController');


// Report routes - Use layout:false to avoid layout issues
router.get('/loss', protect, adminOnly, async (req, res) => {
    try {
        await reportController.getLossReport(req, res);
    } catch (error) {
        console.error('Loss report error:', error);
        res.status(500).send('Error loading loss report');
    }
});

router.get('/worker-payments', protect, adminOnly, async (req, res) => {
    try {
        await reportController.getWorkerPaymentReport(req, res);
    } catch (error) {
        console.error('Worker payments error:', error);
        res.status(500).send('Error loading worker payments report');
    }
});

router.get('/api/loss-chart', protect, adminOnly, reportController.getLossChartData);
router.get('/export-loss-pdf', protect, adminOnly, reportController.exportLossReportPDF);


// ==================== REPORT ROUTES ====================
router.get('/payment-summary', protect, adminOnly, paymentReportController.getPaymentSummary);
router.get('/export-payment-report', protect, adminOnly, paymentReportController.exportPaymentReport);


module.exports = router;








// const express = require('express');
// const router = express.Router();
// const { protect, adminOnly } = require('../middleware/auth');

// const paymentReportController = require('../controllers/paymentReportController');

// // ==================== REPORT ROUTES ====================
// router.get('/payment-summary', protect, adminOnly, paymentReportController.getPaymentSummary);
// router.get('/export-payment-report', protect, adminOnly, paymentReportController.exportPaymentReport);

// module.exports = router;