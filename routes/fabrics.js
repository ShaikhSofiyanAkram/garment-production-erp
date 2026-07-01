const express = require('express');
const router = express.Router();
const fabricController = require('../controllers/fabricController');
const fabricStockController = require('../controllers/fabricStockController'); // ADD THIS LINE
const { protect, adminOnly } = require('../middleware/auth');

// Existing fabric batch routes
router.get('/', protect, adminOnly, fabricController.getBatches);
router.get('/create', protect, adminOnly, fabricController.createForm);
router.post('/create', protect, adminOnly, fabricController.createBatch);
router.get('/view/:id', protect, adminOnly, fabricController.viewBatch);
router.delete('/delete/:id', protect, adminOnly, fabricController.deleteBatch);

// Print batch
router.get('/print/:id', protect, adminOnly, async (req, res) => {
    try {
        const FabricBatch = require('../models/FabricBatch');
        const batch = await FabricBatch.findById(req.params.id).populate('createdBy', 'username');
        if (!batch) {
            req.flash('error_msg', 'Batch not found');
            return res.redirect('/fabrics');
        }
        res.render('fabrics/print', { title: `Print: ${batch.batchNumber}`, batch, layout: false });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error printing batch');
        res.redirect('/fabrics');
    }
});

// ============ FABRIC STOCK ROUTES (NEW) ============
router.get('/stock', protect, adminOnly, fabricStockController.getStock);
router.get('/stock/add', protect, adminOnly, fabricStockController.addStockForm);
router.post('/stock/add', protect, adminOnly, fabricStockController.addStock);
router.get('/stock/view/:id', protect, adminOnly, fabricStockController.viewStock);
router.put('/stock/update/:id', protect, adminOnly, fabricStockController.updateStock);
router.delete('/stock/delete/:id', protect, adminOnly, fabricStockController.deleteStock);
router.post('/stock/consumption', protect, adminOnly, fabricStockController.addConsumption);
router.post('/stock/waste', protect, adminOnly, fabricStockController.addWaste);

// API routes
router.get('/api/summary', protect, adminOnly, fabricStockController.getStockSummary);
router.get('/api/low-stock', protect, adminOnly, fabricStockController.getLowStockAlert);

module.exports = router;

