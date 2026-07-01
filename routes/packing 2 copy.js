const express = require('express');
const router = express.Router();
const packingController = require('../controllers/packingController');
const { protect, adminOnly } = require('../middleware/auth');
const Packing = require('../models/Packing');

router.get('/', protect, adminOnly, packingController.getPackingEntries);
router.get('/create', protect, adminOnly, packingController.createForm);
router.post('/create', protect, adminOnly, packingController.createPacking);
router.get('/view/:id', protect, adminOnly, packingController.viewPacking);
router.delete('/delete/:id', protect, adminOnly, packingController.deletePacking);

// ✅ API for frontend with date filtering
router.get('/api/list', protect, adminOnly, async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        let filter = {};
        
        if (fromDate || toDate) {
            filter.packingDate = {};
            if (fromDate) {
                const start = new Date(fromDate);
                start.setHours(0, 0, 0, 0);
                filter.packingDate.$gte = start;
            }
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.packingDate.$lte = end;
            }
        }
                
        const packings = await Packing.find(filter).sort({ packingDate: -1 });
        res.json(packings);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

