// const express = require('express');
// const router = express.Router();
// const Assignment = require('../models/Assignment');
// const { protect } = require('../middleware/auth');

// // Check karigar pending assignments
// router.get('/karigar-pending/:karigarId', protect, async (req, res) => {
//     try {
//         const pendingCount = await Assignment.countDocuments({
//             karigar: req.params.karigarId,
//             status: { $ne: 'completed' }
//         });
//         res.json({ pending: pendingCount });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });
// // Add this to existing routes/api.js
// router.get('/production-return/:id', protect, finishingController.getProductionReturnDetails);

// module.exports = router;



// const express = require('express');
// const router = express.Router();
// const { protect } = require('../middleware/auth');
// const ProductionReturn = require('../models/ProductionReturn');
// const Finishing = require('../models/Finishing');
// const Assignment = require('../models/Assignment');
// const Cutting = require('../models/Cutting');

// // Get production return details by ID
// router.get('/production-return/:id', protect, async (req, res) => {
//     try {
//         const productionReturn = await ProductionReturn.findById(req.params.id)
//             .populate('assignment', 'givenPieces assignmentId');
        
//         if (!productionReturn) {
//             return res.status(404).json({ error: 'Not found' });
//         }
        
//         res.json(productionReturn);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // Get finishing details by ID
// router.get('/finishing/:id', protect, async (req, res) => {
//     try {
//         const finishing = await Finishing.findById(req.params.id)
//             .populate('productionReturn', 'returned');
        
//         if (!finishing) {
//             return res.status(404).json({ error: 'Not found' });
//         }
        
//         res.json(finishing);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // Get assignment details
// router.get('/assignment/:id', protect, async (req, res) => {
//     try {
//         const assignment = await Assignment.findById(req.params.id)
//             .populate('karigar', 'name')
//             .populate('product', 'name rates');
        
//         res.json(assignment);   
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // Get cutting details
// router.get('/cutting/:id', protect, async (req, res) => {
//     try {
//         const cutting = await Cutting.findById(req.params.id)
//             .populate('product', 'name')
//             .populate('cuttingWorker', 'name');
        
//         res.json(cutting);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // Check karigar pending assignments
// router.get('/karigar-pending/:karigarId', protect, async (req, res) => {
//     try {
//         const pendingCount = await Assignment.countDocuments({
//             karigar: req.params.karigarId,
//             status: { $ne: 'completed' }
//         });
//         res.json({ pending: pendingCount });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// module.exports = router;





const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const Cutting = require('../models/Cutting');
const Worker = require('../models/Worker');
const User = require('../models/User');

// Get cutting worker stats
router.get('/worker/cuttings/:userId', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        const cuttings = await Cutting.find({ cuttingWorker: user.workerId }).sort({ createdAt: -1 });
        
        const today = new Date();
        today.setHours(0,0,0);
        const todayCuttings = cuttings.filter(c => new Date(c.createdAt) >= today);
        
        const worker = await Worker.findById(user.workerId);
        
        res.json({
            totalCuttings: cuttings.length,
            todayCuttings: todayCuttings.length,
            monthlySalary: worker?.monthlyRate || 0,
            cuttings: cuttings.slice(0, 20)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get karigar stats
router.get('/worker/karigar-stats/:userId', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        const assignments = await Assignment.find({ karigar: user.workerId }).sort({ assignedDate: -1 });
        const returns = await ProductionReturn.find({ karigar: user.workerId }).sort({ returnDate: -1 });
        
        const payments = await require('../models/Payment').find({ worker: user.workerId });
        const totalEarnings = payments.reduce((s, p) => s + p.amount, 0);
        
        res.json({
            totalAssignments: assignments.length,
            completedAssignments: assignments.filter(a => a.status === 'completed').length,
            pendingAssignments: assignments.filter(a => a.status === 'pending').length,
            totalEarnings,
            assignments: assignments.slice(0, 20),
            productionHistory: returns.slice(0, 20)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single assignment
router.get('/worker/assignment/:id', protect, async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        res.json(assignment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit production return
router.post('/worker/production-return', protect, async (req, res) => {
    try {
        const { assignmentId, sizes, totalReturned, totalDamage, totalMissing, remark } = req.body;
        
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        const sizeWiseData = [];
        for (const [size, data] of Object.entries(sizes)) {
            sizeWiseData.push({
                size,
                given: assignment.sizes.find(s => s.size === size)?.pieces || 0,
                returned: data.returned,
                damage: data.damage,
                missing: data.missing
            });
        }
        
        const returnCount = await ProductionReturn.countDocuments();
        const returnNumber = `PRN-${String(returnCount + 1).padStart(5, '0')}`;
        
        const productionReturn = await ProductionReturn.create({
            returnNumber,
            assignment: assignmentId,
            karigar: assignment.karigar,
            cutting: assignment.cutting,
            productName: assignment.productName,
            productCategory: assignment.productCategory,
            sizes: sizeWiseData,
            totalGiven: assignment.givenPieces,
            totalReturned,
            totalDamage,
            totalMissing,
            isPartial: totalReturned + totalDamage + totalMissing < assignment.givenPieces,
            status: totalReturned + totalDamage + totalMissing >= assignment.givenPieces ? 'completed' : 'partial',
            remark,
            createdBy: req.session.user.id
        });
        
        // Update assignment
        const existingReturns = await ProductionReturn.find({ assignment: assignmentId });
        const newTotalReturned = existingReturns.reduce((s, r) => s + (r.totalReturned || 0), 0) + totalReturned;
        const newTotalDamage = existingReturns.reduce((s, r) => s + (r.totalDamage || 0), 0) + totalDamage;
        const newTotalMissing = existingReturns.reduce((s, r) => s + (r.totalMissing || 0), 0) + totalMissing;
        
        let status = 'pending';
        if (newTotalReturned + newTotalDamage + newTotalMissing >= assignment.givenPieces) {
            status = 'completed';
        } else if (newTotalReturned + newTotalDamage + newTotalMissing > 0) {
            status = 'partial';
        }
        
        await Assignment.findByIdAndUpdate(assignmentId, {
            returnedPieces: newTotalReturned,
            damagedPieces: newTotalDamage,
            missingPieces: newTotalMissing,
            status
        });
        
        res.json({ success: true, returnNumber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;