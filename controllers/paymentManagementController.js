const PaymentHelper = require('../models/PaymentHelper');
const PaymentKarigar = require('../models/PaymentKarigar');
const PaymentPressman = require('../models/PaymentPressman');
const Advance = require('../models/Advance');
const Worker = require('../models/Worker');
const Finishing = require('../models/Finishing');
const Assignment = require('../models/Assignment');
const PressmanEntry = require('../models/PressmanEntry');

// Main payment page
exports.getPaymentPage = async (req, res) => {
    try {
        const helpers = await Worker.find({ workerType: 'helper', isActive: true });
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        const pressmans = await Worker.find({ workerType: 'pressman', isActive: true });
        
        res.render('payment/index', { 
            title: 'Payment Management',
            helpers,
            karigars,
            pressmans
        });
    } catch (error) {
        console.error(error);
        res.redirect('/dashboard');
    }
};

// ==================== HELPER PAYMENT ====================
exports.getHelperPayment = async (req, res) => {
    try {
        const { workerId, month, year } = req.query;
        const worker = await Worker.findById(workerId);
        
        // Get attendance from finishing entries (Friday holiday)
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const finishingEntries = await Finishing.find({
            helper: workerId,
            finishingDate: { $gte: startDate, $lte: endDate }
        });
        
        // Get unique dates worked (excluding Fridays)
        const workedDates = [...new Set(finishingEntries.map(e => 
            new Date(e.finishingDate).toDateString()
        ))];
        
        // Calculate holidays (Fridays)
        const totalDays = endDate.getDate();
        let fridays = 0;
        let workingDays = 0;
        
        for (let i = 1; i <= totalDays; i++) {
            const date = new Date(year, month - 1, i);
            if (date.getDay() === 5) { // Friday
                fridays++;
            } else {
                workingDays++;
            }
        }
        
        const daysPresent = workedDates.length;
        const daysAbsent = workingDays - daysPresent;
        
        // Calculate salary
        const dailyRate = worker.monthlyRate / workingDays;
        const earnedSalary = daysPresent * dailyRate;
        
        // Get advances
        const advances = await Advance.find({
            worker: workerId,
            status: 'pending'
        });
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        
        const netPayable = earnedSalary - totalAdvance;
        
        // Get previous payments
        const previousPayments = await PaymentHelper.find({
            worker: workerId,
            month: parseInt(month),
            year: parseInt(year)
        });
        
        res.json({
            success: true,
            worker: worker,
            month: month,
            year: year,
            totalDays: workingDays,
            fridays: fridays,
            daysPresent: daysPresent,
            daysAbsent: daysAbsent,
            dailyRate: dailyRate,
            earnedSalary: earnedSalary,
            totalAdvance: totalAdvance,
            netPayable: netPayable,
            advances: advances,
            previousPayments: previousPayments,
            finishingEntries: finishingEntries
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

exports.createHelperPayment = async (req, res) => {
    try {
        const { workerId, month, year, amount, remark } = req.body;
        
        const payment = await PaymentHelper.create({
            worker: workerId,
            month: parseInt(month),
            year: parseInt(year),
            netPayable: amount,
            status: 'paid',
            paymentDate: new Date(),
            remark: remark,
            createdBy: req.session.user.id
        });
        
        // Mark advances as adjusted
        await Advance.updateMany(
            { worker: workerId, status: 'pending' },
            { status: 'adjusted', adjustedIn: payment._id }
        );
        
        req.flash('success_msg', `Helper payment of ₹${amount} recorded`);
        res.redirect('/payment');
    } catch (error) {
        req.flash('error_msg', 'Error recording payment');
        res.redirect('/payment');
    }
};

// ==================== KARIGAR PAYMENT ====================
exports.getKarigarPayment = async (req, res) => {
    try {
        const { workerId, weekStart, weekEnd } = req.query;
        const worker = await Worker.findById(workerId);
        
        // Get assignments completed in this week
        const assignments = await Assignment.find({
            karigar: workerId,
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
                assignmentId: assignment.assignmentId,
                product: assignment.product?.name,
                pieces: assignment.givenPieces,
                rate: rate,
                amount: amount
            });
        }
        
        // Get advances
        const advances = await Advance.find({
            worker: workerId,
            status: 'pending'
        });
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        
        const netPayable = totalAmount - totalAdvance;
        
        // Get previous payments
        const previousPayments = await PaymentKarigar.find({
            worker: workerId,
            weekStart: { $gte: new Date(weekStart) }
        });
        
        res.json({
            success: true,
            worker: worker,
            weekStart: weekStart,
            weekEnd: weekEnd,
            totalPieces: totalPieces,
            totalAmount: totalAmount,
            totalAdvance: totalAdvance,
            netPayable: netPayable,
            workDetails: workDetails,
            advances: advances,
            previousPayments: previousPayments
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

exports.createKarigarPayment = async (req, res) => {
    try {
        const { workerId, weekStart, weekEnd, amount, remark } = req.body;
        
        const payment = await PaymentKarigar.create({
            worker: workerId,
            weekStart: new Date(weekStart),
            weekEnd: new Date(weekEnd),
            totalAmount: amount,
            netPayable: amount,
            status: 'paid',
            paymentDate: new Date(),
            remark: remark,
            createdBy: req.session.user.id
        });
        
        // Mark advances as adjusted
        await Advance.updateMany(
            { worker: workerId, status: 'pending' },
            { status: 'adjusted', adjustedIn: payment._id }
        );
        
        req.flash('success_msg', `Karigar payment of ₹${amount} recorded`);
        res.redirect('/payment');
    } catch (error) {
        req.flash('error_msg', 'Error recording payment');
        res.redirect('/payment');
    }
};

// ==================== PRESSMAN PAYMENT ====================
exports.getPressmanPayment = async (req, res) => {
    try {
        const { workerId, weekStart, weekEnd } = req.query;
        const worker = await Worker.findById(workerId);
        
        // Get pressman entries in this week
        const entries = await PressmanEntry.find({
            pressman: workerId,
            date: { $gte: new Date(weekStart), $lte: new Date(weekEnd) },
            status: 'approved'
        });
        
        let totalPieces = 0;
        let totalAmount = 0;
        
        for (const entry of entries) {
            totalPieces += entry.totalQuantity;
            totalAmount += entry.totalAmount;
        }
        
        // Get advances
        const advances = await Advance.find({
            worker: workerId,
            status: 'pending'
        });
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        
        const netPayable = totalAmount - totalAdvance;
        
        res.json({
            success: true,
            worker: worker,
            weekStart: weekStart,
            weekEnd: weekEnd,
            totalPieces: totalPieces,
            totalAmount: totalAmount,
            totalAdvance: totalAdvance,
            netPayable: netPayable,
            entries: entries,
            advances: advances
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

exports.createPressmanPayment = async (req, res) => {
    try {
        const { workerId, weekStart, weekEnd, amount, remark } = req.body;
        
        // Get entries included
        const entries = await PressmanEntry.find({
            pressman: workerId,
            date: { $gte: new Date(weekStart), $lte: new Date(weekEnd) },
            status: 'approved'
        });
        
        const payment = await PaymentPressman.create({
            worker: workerId,
            weekStart: new Date(weekStart),
            weekEnd: new Date(weekEnd),
            totalAmount: amount,
            netPayable: amount,
            entriesIncluded: entries.map(e => e._id),
            status: 'paid',
            paymentDate: new Date(),
            remark: remark,
            createdBy: req.session.user.id
        });
        
        // Update entries status to paid
        await PressmanEntry.updateMany(
            { _id: { $in: entries.map(e => e._id) } },
            { status: 'paid' }
        );
        
        // Mark advances as adjusted
        await Advance.updateMany(
            { worker: workerId, status: 'pending' },
            { status: 'adjusted', adjustedIn: payment._id }
        );
        
        req.flash('success_msg', `Pressman payment of ₹${amount} recorded`);
        res.redirect('/payment');
    } catch (error) {
        req.flash('error_msg', 'Error recording payment');
        res.redirect('/payment');
    }
};

// ==================== ADVANCE MANAGEMENT ====================
exports.createAdvance = async (req, res) => {
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
        res.redirect('/payment');
    } catch (error) {
        req.flash('error_msg', 'Error recording advance');
        res.redirect('/payment');
    }
};

exports.getAdvances = async (req, res) => {
    try {
        const advances = await Advance.find({ status: 'pending' })
            .populate('worker', 'name')
            .sort({ date: -1 });
        res.json({ advances });
    } catch (error) {
        res.json({ advances: [] });
    }
};

// ==================== STATEMENTS ====================
exports.getStatement = async (req, res) => {
    try {
        const { workerId, workerType, fromDate, toDate } = req.query;
        const worker = await Worker.findById(workerId);
        
        let payments = [];
        let advances = [];
        
        if (workerType === 'helper') {
            payments = await PaymentHelper.find({
                worker: workerId,
                paymentDate: { $gte: new Date(fromDate), $lte: new Date(toDate) }
            });
        } else if (workerType === 'karigar') {
            payments = await PaymentKarigar.find({
                worker: workerId,
                paymentDate: { $gte: new Date(fromDate), $lte: new Date(toDate) }
            });
        } else if (workerType === 'pressman') {
            payments = await PaymentPressman.find({
                worker: workerId,
                paymentDate: { $gte: new Date(fromDate), $lte: new Date(toDate) }
            });
        }
        
        advances = await Advance.find({
            worker: workerId,
            date: { $gte: new Date(fromDate), $lte: new Date(toDate) }
        });
        
        const totalPaid = payments.reduce((sum, p) => sum + p.netPayable, 0);
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        
        res.render('payment/statement', {
            title: 'Payment Statement',
            worker,
            workerType,
            fromDate,
            toDate,
            payments,
            advances,
            totalPaid,
            totalAdvance
        });
    } catch (error) {
        req.flash('error_msg', 'Error generating statement');
        res.redirect('/payment');
    }
};