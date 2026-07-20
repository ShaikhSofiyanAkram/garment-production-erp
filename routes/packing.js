const express = require('express');
const router = express.Router();
const packingController = require('../controllers/packingController');
const { protect, adminOnly } = require('../middleware/auth');
const Packing = require('../models/Packing');
const Finishing = require('../models/Finishing');
const Assignment = require('../models/Assignment');

// ============ VIEW ROUTES ============
router.get('/', protect, adminOnly, packingController.getPackingEntries);
router.get('/create', protect, adminOnly, packingController.createForm);
router.post('/create', protect, adminOnly, packingController.createPacking);
router.get('/view/:id', protect, adminOnly, packingController.viewPacking);
router.delete('/delete/:id', protect, adminOnly, packingController.deletePacking);

// ==================== AUTO FROM FINISHING API ====================
router.get('/api/finishing-available', protect, adminOnly, packingController.getAutoFromFinishing);
router.delete('/api/packed-entry/:packingId/:entryIndex', protect, adminOnly, packingController.deletePackedEntry);

// ✅ GET already packed finishing records (FIXED)
router.get('/api/already-packed', protect, async (req, res) => {
    try {
        console.log('📡 Fetching already packed items...');
        
        // Get all packing entries
        const packings = await Packing.find().sort({ createdAt: -1 });
        const packedItems = [];
        const packedKeys = new Set();
        
        // Extract product+category+size from each packing
        packings.forEach(p => {
            if (p.entries && p.entries.length > 0) {
                p.entries.forEach(entry => {
                    // ✅ Only add if entry has valid data
                    if (entry.productName && entry.category && entry.size) {
                        const key = `${entry.productName}|${entry.category}|${entry.size}`;
                        if (!packedKeys.has(key)) {
                            packedKeys.add(key);
                            packedItems.push({
                                productName: entry.productName,
                                category: entry.category,
                                size: entry.size
                            });
                        }
                    }
                });
            }
        });
        
        console.log(`📦 Found ${packedItems.length} unique packed items`);
        console.log('📦 Packed keys:', Array.from(packedKeys));
        
        res.json({ success: true, packed: packedItems });
    } catch (error) {
        console.error('❌ Error fetching packed items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ API ROUTES ============
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
        
        const packings = await Packing.find(filter)
            .sort({ packingDate: -1 });
        
        res.json(packings);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ✅ API: Get finishing records for auto packing
// ✅ API: Get finishing records for auto packing (FIXED)
router.get('/api/finishing-records', protect, adminOnly, async (req, res) => {
    try {
        console.log('📡 Fetching finishing records for auto packing...');
        
        // ✅ Get all completed finishing records with passed pieces > 0
        const records = await Finishing.find({ 
            status: 'completed',
            passedPieces: { $gt: 0 }
        })
        .populate({
            path: 'assignment',
            select: 'assignmentId productName productCategory sizes'
        })
        .populate('helper', 'name')
        .sort({ finishingDate: -1 })
        .limit(100);
        
        console.log(`📦 Found ${records.length} finishing records`);
        
        // ✅ Format records for frontend
        const formatted = records.map(r => {
            // ✅ Get product name from assignment
            const productName = r.assignment?.productName || 'N/A';
            const category = r.assignment?.productCategory || 'Mens';
            
            // ✅ Get size from sizeBreakdown or assignment
            let size = 'N/A';
            if (r.sizeBreakdown && r.sizeBreakdown.length > 0) {
                size = r.sizeBreakdown[0].size || 'N/A';
            } else if (r.assignment?.sizes && r.assignment.sizes.length > 0) {
                size = r.assignment.sizes[0].size || 'N/A';
            }
            
            return {
                _id: r._id,
                finishingNumber: r.finishingNumber || 'FIN-NA',
                productName: productName,
                category: category,
                size: size,
                passedPieces: r.passedPieces || 0,
                helperName: r.helper?.name || 'N/A'
            };
        });
        
        console.log(`✅ Formatted ${formatted.length} records for frontend`);
        res.json({ success: true, records: formatted });
        
    } catch (error) {
        console.error('❌ Error fetching finishing records:', error);
        res.json({ success: false, error: error.message, records: [] });
    }
});

// routes/products.js
router.get('/api/list', protect, adminOnly, async (req, res) => {
    try {
        const products = await Product.find({ isActive: true });
        res.json(products); // ✅ Should return array
    } catch (error) {
        console.error(error);
        res.status(500).json([]); // ✅ Return empty array on error
    }
});

module.exports = router;









