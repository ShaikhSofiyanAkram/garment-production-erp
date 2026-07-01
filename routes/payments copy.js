const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Worker = require('../models/Worker');
const PaymentTransaction = require('../models/PaymentTransaction');
const Finishing = require('../models/Finishing');
const Assignment = require('../models/Assignment');
const PressmanEntry = require('../models/PressmanEntry');
const Advance = require('../models/Advance');

// Main payment page
router.get('/', protect, adminOnly, async (req, res) => {
    try {
        const helpers = await Worker.find({ workerType: 'helper', isActive: true });
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        const pressmans = await Worker.find({ workerType: 'pressman', isActive: true });
        const cuttings = await Worker.find({ workerType: 'cutting', isActive: true });
        
        res.render('payments/index', { 
            title: 'Payment Management',
            helpers,
            karigars,
            pressmans,
            cuttings
        });
    } catch (error) {
        console.error(error);
        res.render('payments/index', { 
            title: 'Payment Management',
            helpers: [],
            karigars: [],
            pressmans: [],
            cuttings: []
        });
    }
});

// ==================== HELPER ====================
router.get('/helper/:id', protect, adminOnly, async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        res.render('payments/helper-detail', { 
            title: 'Helper Payment', 
            worker,
            month: currentMonth,
            year: currentYear
        });
    } catch (error) {
        req.flash('error_msg', 'Worker not found');
        res.redirect('/payments');
    }
});

router.get('/helper-data/:id', protect, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { month, year } = req.query;
        
        const worker = await Worker.findById(id);
        
        // Get attendance from finishing entries
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const finishingEntries = await Finishing.find({
            helper: id,
            finishingDate: { $gte: startDate, $lte: endDate }
        });
        
        // Get unique dates worked
        const workedDates = [...new Set(finishingEntries.map(e => 
            new Date(e.finishingDate).toDateString()
        ))];
        
        // Calculate holidays (Fridays)
        let fridays = 0;
        let workingDays = 0;
        const totalDays = endDate.getDate();
        
        for (let i = 1; i <= totalDays; i++) {
            const date = new Date(year, month - 1, i);
            if (date.getDay() === 5) {
                fridays++;
            } else {
                workingDays++;
            }
        }
        
        const daysPresent = workedDates.length;
        const daysAbsent = workingDays - daysPresent;
        const dailyRate = worker.monthlyRate / workingDays;
        const earnedSalary = daysPresent * dailyRate;
        
        // Get advances
        const advances = await Advance.find({
            worker: id,
            status: 'pending'
        });
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        const netPayable = earnedSalary - totalAdvance;
        
        // Get payment history
        const payments = await PaymentTransaction.find({
            worker: id,
            workerType: 'helper',
            month: parseInt(month),
            year: parseInt(year)
        });
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        
        res.json({
            success: true,
            worker: worker,
            totalDays: workingDays,
            fridays: fridays,
            daysPresent: daysPresent,
            daysAbsent: daysAbsent,
            dailyRate: dailyRate.toFixed(2),
            earnedSalary: earnedSalary.toFixed(2),
            totalAdvance: totalAdvance,
            netPayable: netPayable.toFixed(2),
            totalPaid: totalPaid,
            pendingPaid: (netPayable - totalPaid).toFixed(2),
            advances: advances,
            payments: payments,
            finishingEntries: finishingEntries
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.post('/helper-pay', protect, adminOnly, async (req, res) => {
    try {
        const { workerId, month, year, amount, remark } = req.body;
        
        await PaymentTransaction.create({
            worker: workerId,
            workerType: 'helper',
            paymentType: 'monthly_salary',
            amount: parseFloat(amount),
            month: parseInt(month),
            year: parseInt(year),
            remark: remark,
            createdBy: req.session.user.id
        });
        
        req.flash('success_msg', `Helper payment of ₹${amount} recorded`);
        res.redirect('/payments');
    } catch (error) {
        req.flash('error_msg', 'Error recording payment');
        res.redirect('/payments');
    }
});

// ==================== KARIGAR ====================
router.get('/karigar/:id', protect, adminOnly, async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        res.render('payments/karigar-detail', { title: 'Karigar Payment', worker });
    } catch (error) {
        req.flash('error_msg', 'Worker not found');
        res.redirect('/payments');
    }
});

router.get('/karigar-data/:id', protect, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { weekStart, weekEnd } = req.query;
        
        const worker = await Worker.findById(id);
        
        // Get assignments completed in this week
        const assignments = await Assignment.find({
            karigar: id,
            assignedDate: { $gte: new Date(weekStart), $lte: new Date(weekEnd) },
            status: 'completed'
        }).populate('product');
        
        let totalPieces = 0;
        let totalAmount = 0;
        const workDetails = [];
        
        for (const assignment of assignments) {
            const rate = assignment.product?.rates.karigar || 0;
            const amount = assignment.givenPieces * rate;
            totalPieces += assignment.givenPieces;
            totalAmount += amount;
            
            workDetails.push({
                date: assignment.assignedDate,
                assignmentId: assignment.assignmentId,
                product: assignment.product?.name,
                pieces: assignment.givenPieces,
                rate: rate,
                amount: amount
            });
        }
        
        // Get advances
        const advances = await Advance.find({
            worker: id,
            status: 'pending'
        });
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        const netPayable = totalAmount - totalAdvance;
        
        // Get payment history
        const payments = await PaymentTransaction.find({
            worker: id,
            workerType: 'karigar',
            paymentDate: { $gte: new Date(weekStart), $lte: new Date(weekEnd) }
        });
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        
        res.json({
            success: true,
            worker: worker,
            weekStart: weekStart,
            weekEnd: weekEnd,
            totalPieces: totalPieces,
            totalAmount: totalAmount,
            totalAdvance: totalAdvance,
            netPayable: netPayable,
            totalPaid: totalPaid,
            workDetails: workDetails,
            advances: advances,
            payments: payments
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.post('/karigar-pay', protect, adminOnly, async (req, res) => {
    try {
        const { workerId, weekStart, weekEnd, amount, remark } = req.body;
        
        await PaymentTransaction.create({
            worker: workerId,
            workerType: 'karigar',
            paymentType: 'piece_wage',
            amount: parseFloat(amount),
            fromDate: new Date(weekStart),
            toDate: new Date(weekEnd),
            remark: remark,
            createdBy: req.session.user.id
        });
        
        req.flash('success_msg', `Karigar payment of ₹${amount} recorded`);
        res.redirect('/payments');
    } catch (error) {
        req.flash('error_msg', 'Error recording payment');
        res.redirect('/payments');
    }
});

// ==================== PRESSMAN ====================
router.get('/pressman/:id', protect, adminOnly, async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        res.render('payments/pressman-detail', { title: 'Pressman Payment', worker });
    } catch (error) {
        req.flash('error_msg', 'Worker not found');
        res.redirect('/payments');
    }
});

router.get('/pressman-data/:id', protect, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { weekStart, weekEnd } = req.query;
        
        const worker = await Worker.findById(id);
        
        // Get pressman entries in this week
        const entries = await PressmanEntry.find({
            pressman: id,
            date: { $gte: new Date(weekStart), $lte: new Date(weekEnd) },
            status: 'approved'
        });
        
        let totalPieces = 0;
        let totalAmount = 0;
        const workDetails = [];
        
        for (const entry of entries) {
            totalPieces += entry.totalQuantity;
            totalAmount += entry.totalAmount;
            
            workDetails.push({
                date: entry.date,
                entryNumber: entry.entryNumber,
                products: entry.entries,
                quantity: entry.totalQuantity,
                amount: entry.totalAmount
            });
        }
        
        // Get advances
        const advances = await Advance.find({
            worker: id,
            status: 'pending'
        });
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        const netPayable = totalAmount - totalAdvance;
        
        // Get payment history
        const payments = await PaymentTransaction.find({
            worker: id,
            workerType: 'pressman',
            paymentDate: { $gte: new Date(weekStart), $lte: new Date(weekEnd) }
        });
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        
        res.json({
            success: true,
            worker: worker,
            weekStart: weekStart,
            weekEnd: weekEnd,
            totalPieces: totalPieces,
            totalAmount: totalAmount,
            totalAdvance: totalAdvance,
            netPayable: netPayable,
            totalPaid: totalPaid,
            workDetails: workDetails,
            entries: entries,
            advances: advances
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.post('/pressman-pay', protect, adminOnly, async (req, res) => {
    try {
        const { workerId, weekStart, weekEnd, amount, remark } = req.body;
        
        await PaymentTransaction.create({
            worker: workerId,
            workerType: 'pressman',
            paymentType: 'piece_wage',
            amount: parseFloat(amount),
            fromDate: new Date(weekStart),
            toDate: new Date(weekEnd),
            remark: remark,
            createdBy: req.session.user.id
        });
        
        // Update pressman entries status
        await PressmanEntry.updateMany(
            {
                pressman: workerId,
                date: { $gte: new Date(weekStart), $lte: new Date(weekEnd) }
            },
            { status: 'paid' }
        );
        
        req.flash('success_msg', `Pressman payment of ₹${amount} recorded`);
        res.redirect('/payments');
    } catch (error) {
        req.flash('error_msg', 'Error recording payment');
        res.redirect('/payments');
    }
});

// ==================== ADVANCE ====================
router.post('/advance', protect, adminOnly, async (req, res) => {
    try {
        const { workerId, workerType, amount, purpose, remark } = req.body;
        
        await Advance.create({
            worker: workerId,
            workerType: workerType,
            amount: parseFloat(amount),
            purpose: purpose,
            remark: remark,
            createdBy: req.session.user.id
        });
        
        req.flash('success_msg', `Advance of ₹${amount} recorded for ${workerType}`);
        res.redirect('/payments');
    } catch (error) {
        req.flash('error_msg', 'Error recording advance');
        res.redirect('/payments');
    }
});

module.exports = router;



// const express = require('express');
// const router = express.Router();
// const { protect, adminOnly } = require('../middleware/auth');
// const Worker = require('../models/Worker');
// const PaymentTransaction = require('../models/PaymentTransaction');
// const PaymentHelper = require('../models/PaymentHelper');
// const PaymentKarigar = require('../models/PaymentKarigar');
// const PaymentPressman = require('../models/PaymentPressman');
// const Advance = require('../models/Advance');
// const Finishing = require('../models/Finishing');
// const Assignment = require('../models/Assignment');
// const PressmanEntry = require('../models/PressmanEntry');

// // Main payment page
// router.get('/', protect, adminOnly, async (req, res) => {
//     try {
//         const helpers = await Worker.find({ workerType: 'helper', isActive: true });
//         const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
//         const pressmans = await Worker.find({ workerType: 'pressman', isActive: true });
//         const cuttingWorkers = await Worker.find({ workerType: 'cutting', isActive: true });
        
//         const recentPayments = await PaymentTransaction.find()
//             .populate('worker', 'name')
//             .sort({ paymentDate: -1 })
//             .limit(10);
        
//         res.render('payment/index', { 
//             title: 'Payment Management',
//             helpers,
//             karigars,
//             pressmans,
//             cuttingWorkers,
//             recentPayments
//         });
//     } catch (error) {
//         console.error(error);
//         res.render('payment/index', { 
//             title: 'Payment Management',
//             helpers: [],
//             karigars: [],
//             pressmans: [],
//             cuttingWorkers: [],
//             recentPayments: []
//         });
//     }
// });

// // Helper Payment Details API
// router.get('/helper-details', protect, adminOnly, async (req, res) => {
//     try {
//         const { workerId, month, year } = req.query;
//         const worker = await Worker.findById(workerId);
        
//         const startDate = new Date(year, month - 1, 1);
//         const endDate = new Date(year, month, 0);
        
//         const finishingEntries = await Finishing.find({
//             helper: workerId,
//             finishingDate: { $gte: startDate, $lte: endDate }
//         });
        
//         const workedDates = [...new Set(finishingEntries.map(e => 
//             new Date(e.finishingDate).toDateString()
//         ))];
        
//         // Calculate working days (excluding Fridays)
//         const totalDays = endDate.getDate();
//         let workingDays = 0;
//         for (let i = 1; i <= totalDays; i++) {
//             const date = new Date(year, month - 1, i);
//             if (date.getDay() !== 5) { // Not Friday
//                 workingDays++;
//             }
//         }
        
//         const daysPresent = workedDates.length;
//         const daysAbsent = workingDays - daysPresent;
//         const dailyRate = worker.monthlyRate / workingDays;
//         const earnedSalary = daysPresent * dailyRate;
        
//         const advances = await Advance.find({ worker: workerId, status: 'pending' });
//         const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
//         const netPayable = earnedSalary - totalAdvance;
        
//         res.json({
//             success: true,
//             worker: worker,
//             month, year,
//             workingDays,
//             daysPresent,
//             daysAbsent,
//             dailyRate: dailyRate.toFixed(2),
//             earnedSalary: earnedSalary.toFixed(2),
//             totalAdvance,
//             netPayable: netPayable.toFixed(2),
//             advances
//         });
//     } catch (error) {
//         res.json({ success: false, error: error.message });
//     }
// });

// // Create Helper Payment
// router.post('/helper', protect, adminOnly, async (req, res) => {
//     try {
//         const { workerId, month, year, amount, remark } = req.body;
        
//         await PaymentHelper.create({
//             worker: workerId,
//             month: parseInt(month),
//             year: parseInt(year),
//             netPayable: amount,
//             status: 'paid',
//             paymentDate: new Date(),
//             remark,
//             createdBy: req.session.user.id
//         });
        
//         await PaymentTransaction.create({
//             worker: workerId,
//             workerType: 'helper',
//             amount: amount,
//             paymentType: 'monthly_salary',
//             remark: remark,
//             createdBy: req.session.user.id
//         });
        
//         await Advance.updateMany(
//             { worker: workerId, status: 'pending' },
//             { status: 'adjusted' }
//         );
        
//         req.flash('success_msg', `Payment of ₹${amount} recorded for Helper`);
//         res.redirect('/payments');
//     } catch (error) {
//         req.flash('error_msg', 'Error recording payment');
//         res.redirect('/payments');
//     }
// });

// // Karigar Payment Details API
// router.get('/karigar-details', protect, adminOnly, async (req, res) => {
//     try {
//         const { workerId, weekStart, weekEnd } = req.query;
//         const worker = await Worker.findById(workerId);
        
//         const assignments = await Assignment.find({
//             karigar: workerId,
//             assignedDate: { $gte: new Date(weekStart), $lte: new Date(weekEnd) },
//             status: 'completed'
//         }).populate('product');
        
//         let totalPieces = 0;
//         let totalAmount = 0;
//         let workDetails = [];
        
//         for (const assignment of assignments) {
//             const rate = assignment.product?.rates.karigar || 0;
//             const amount = assignment.givenPieces * rate;
//             totalPieces += assignment.givenPieces;
//             totalAmount += amount;
//             workDetails.push({
//                 assignmentId: assignment.assignmentId,
//                 product: assignment.product?.name,
//                 pieces: assignment.givenPieces,
//                 rate,
//                 amount
//             });
//         }
        
//         const advances = await Advance.find({ worker: workerId, status: 'pending' });
//         const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
//         const netPayable = totalAmount - totalAdvance;
        
//         res.json({
//             success: true,
//             worker,
//             weekStart, weekEnd,
//             totalPieces,
//             totalAmount,
//             totalAdvance,
//             netPayable,
//             workDetails,
//             advances
//         });
//     } catch (error) {
//         res.json({ success: false, error: error.message });
//     }
// });

// // Create Karigar Payment
// router.post('/karigar', protect, adminOnly, async (req, res) => {
//     try {
//         const { workerId, weekStart, weekEnd, amount, remark } = req.body;
        
//         await PaymentKarigar.create({
//             worker: workerId,
//             weekStart: new Date(weekStart),
//             weekEnd: new Date(weekEnd),
//             totalAmount: amount,
//             netPayable: amount,
//             status: 'paid',
//             paymentDate: new Date(),
//             remark,
//             createdBy: req.session.user.id
//         });
        
//         await PaymentTransaction.create({
//             worker: workerId,
//             workerType: 'karigar',
//             amount: amount,
//             paymentType: 'piece_wage',
//             fromDate: new Date(weekStart),
//             toDate: new Date(weekEnd),
//             remark,
//             createdBy: req.session.user.id
//         });
        
//         await Advance.updateMany(
//             { worker: workerId, status: 'pending' },
//             { status: 'adjusted' }
//         );
        
//         req.flash('success_msg', `Payment of ₹${amount} recorded for Karigar`);
//         res.redirect('/payments');
//     } catch (error) {
//         req.flash('error_msg', 'Error recording payment');
//         res.redirect('/payments');
//     }
// });

// // Pressman Payment Details API
// router.get('/pressman-details', protect, adminOnly, async (req, res) => {
//     try {
//         const { workerId, weekStart, weekEnd } = req.query;
//         const worker = await Worker.findById(workerId);
        
//         const entries = await PressmanEntry.find({
//             pressman: workerId,
//             date: { $gte: new Date(weekStart), $lte: new Date(weekEnd) },
//             status: 'approved'
//         });
        
//         let totalPieces = 0;
//         let totalAmount = 0;
        
//         for (const entry of entries) {
//             totalPieces += entry.totalQuantity;
//             totalAmount += entry.totalAmount;
//         }
        
//         const advances = await Advance.find({ worker: workerId, status: 'pending' });
//         const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
//         const netPayable = totalAmount - totalAdvance;
        
//         res.json({
//             success: true,
//             worker,
//             weekStart, weekEnd,
//             totalPieces,
//             totalAmount,
//             totalAdvance,
//             netPayable,
//             entries,
//             advances
//         });
//     } catch (error) {
//         res.json({ success: false, error: error.message });
//     }
// });

// // Create Pressman Payment
// router.post('/pressman', protect, adminOnly, async (req, res) => {
//     try {
//         const { workerId, weekStart, weekEnd, amount, remark } = req.body;
        
//         await PaymentPressman.create({
//             worker: workerId,
//             weekStart: new Date(weekStart),
//             weekEnd: new Date(weekEnd),
//             totalAmount: amount,
//             netPayable: amount,
//             status: 'paid',
//             paymentDate: new Date(),
//             remark,
//             createdBy: req.session.user.id
//         });
        
//         await PaymentTransaction.create({
//             worker: workerId,
//             workerType: 'pressman',
//             amount: amount,
//             paymentType: 'piece_wage',
//             fromDate: new Date(weekStart),
//             toDate: new Date(weekEnd),
//             remark,
//             createdBy: req.session.user.id
//         });
        
//         await PressmanEntry.updateMany(
//             { 
//                 pressman: workerId,
//                 date: { $gte: new Date(weekStart), $lte: new Date(weekEnd) }
//             },
//             { status: 'paid' }
//         );
        
//         await Advance.updateMany(
//             { worker: workerId, status: 'pending' },
//             { status: 'adjusted' }
//         );
        
//         req.flash('success_msg', `Payment of ₹${amount} recorded for Pressman`);
//         res.redirect('/payments');
//     } catch (error) {
//         req.flash('error_msg', 'Error recording payment');
//         res.redirect('/payments');
//     }
// });

// // Advance Payment
// router.post('/advance', protect, adminOnly, async (req, res) => {
//     try {
//         const { workerId, workerType, amount, purpose, remark } = req.body;
        
//         await Advance.create({
//             worker: workerId,
//             workerType: workerType,
//             amount: parseFloat(amount),
//             purpose: purpose || 'General advance',
//             remark,
//             createdBy: req.session.user.id
//         });
        
//         await PaymentTransaction.create({
//             worker: workerId,
//             workerType: workerType,
//             amount: parseFloat(amount),
//             paymentType: 'advance',
//             remark: `Advance - ${purpose || 'General'}`,
//             createdBy: req.session.user.id
//         });
        
//         req.flash('success_msg', `Advance of ₹${amount} recorded`);
//         res.redirect('/payments');
//     } catch (error) {
//         req.flash('error_msg', 'Error recording advance');
//         res.redirect('/payments');
//     }
// });

// // Get pending advances API
// router.get('/advances', protect, adminOnly, async (req, res) => {
//     try {
//         const advances = await Advance.find({ status: 'pending' })
//             .populate('worker', 'name')
//             .sort({ date: -1 });
//         res.json({ advances });
//     } catch (error) {
//         res.json({ advances: [] });
//     }
// });

// module.exports = router;