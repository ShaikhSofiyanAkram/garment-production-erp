const express = require('express');
const router = express.Router();
const cuttingController = require('../controllers/cuttingController');
const { protect, adminOnly } = require('../middleware/auth');

// All routes require authentication and admin access
router.get('/', protect, adminOnly, cuttingController.getCuttingEntries);
router.get('/create', protect, adminOnly, cuttingController.createForm);
router.post('/create', protect, adminOnly, cuttingController.createCutting);
router.get('/:id', protect, adminOnly, cuttingController.getCutting);
router.delete('/delete/:id', protect, adminOnly, cuttingController.deleteCutting);

module.exports = router;