const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentManagementController');
const { protect, adminOnly } = require('../middleware/auth');

// Main page
router.get('/', protect, adminOnly, paymentController.getPaymentPage);

// Helper routes
router.get('/helper-details', protect, adminOnly, paymentController.getHelperPayment);
router.post('/helper', protect, adminOnly, paymentController.createHelperPayment);

// Karigar routes
router.get('/karigar-details', protect, adminOnly, paymentController.getKarigarPayment);
router.post('/karigar', protect, adminOnly, paymentController.createKarigarPayment);

// Pressman routes
router.get('/pressman-details', protect, adminOnly, paymentController.getPressmanPayment);
router.post('/pressman', protect, adminOnly, paymentController.createPressmanPayment);

// Advance routes
router.post('/advance', protect, adminOnly, paymentController.createAdvance);
router.get('/advances', protect, adminOnly, paymentController.getAdvances);

// Statement
router.get('/statement', protect, adminOnly, paymentController.getStatement);

module.exports = router;