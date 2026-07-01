const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { protect, adminOnly } = require('../middleware/auth');

// Make sure all these functions exist in productionController
router.get('/', protect, adminOnly, productionController.getReturns);
router.get('/return', protect, adminOnly, productionController.returnForm);
router.post('/return', protect, adminOnly, productionController.createReturn);
router.delete('/delete/:id', protect, adminOnly, productionController.deleteReturn);
router.get('/:id', protect, adminOnly, productionController.getReturn);

// API routes
router.get('/api/returns/:assignmentId', protect, adminOnly, productionController.getReturnsByAssignment);
router.get('/api/remaining/:assignmentId', protect, adminOnly, productionController.getRemainingPieces);

module.exports = router;