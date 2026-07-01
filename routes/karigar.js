const express = require('express');
const router = express.Router();
const karigarController = require('../controllers/karigarController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, adminOnly, karigarController.getEntries);
router.get('/create', protect, adminOnly, karigarController.createForm);
router.post('/create', protect, adminOnly, karigarController.createEntry);
router.get('/view/:id', protect, adminOnly, karigarController.viewEntry);
router.delete('/delete/:id', protect, adminOnly, karigarController.deleteEntry);
router.put('/approve/:id', protect, adminOnly, karigarController.approveEntry);
router.put('/pay/:id', protect, adminOnly, karigarController.markAsPaid);

// API route for fetching pending returns
router.get('/api/returns', protect, adminOnly, karigarController.getKarigarReturns);

module.exports = router;