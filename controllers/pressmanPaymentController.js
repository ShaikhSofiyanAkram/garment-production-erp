const PressmanEntry = require('../models/PressmanEntry');
const PressmanProduct = require('../models/PressmanProduct');
const Worker = require('../models/Worker');
const Payment = require('../models/Payment');
const Advance = require('../models/Advance');
const mongoose = require('mongoose');

// ==================== GET PRESSMAN PAYMENT SUMMARY ====================
exports.getPressmanPaymentSummary = async (req, res) => {
    try {
        const { workerId, fromDate, toDate } = req.query;
        
        let filter = {};
        if (workerId) filter.pressman = workerId;
        if (fromDate && toDate) {
            filter.date = { 
                $gte: new Date(fromDate), 
                $lte: new Date(toDate) 
            };
        }
        
        const entries = await PressmanEntry.find(filter)
            .populate('pressman', 'name workerType')
            .sort({ date: -1 });
        
        let totalPieces = 0;
        let totalAmount = 0;
        let workDetails = [];
        
        for (const entry of entries) {
            for (const item of entry.entries) {
                workDetails.push({
                    entryNumber: entry.entryNumber,
                    date: entry.date,
                    productName: item.productName,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    status: entry.status
                });
                totalPieces += item.quantity;
                totalAmount += item.amount;
            }
        }
        
        res.json({
            success: true,
            workDetails,
            totalPieces,
            totalAmount,
            entryCount: entries.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== GET PRESSMAN PAYMENT STATEMENT ====================
exports.getPressmanStatement = async (req, res) => {
    try {
        const workerId = req.params.id;
        const { period } = req.query; // 'week', 'month', 'all'
        
        const worker = await Worker.findById(workerId);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }
        
        // Date filter
        let dateFilter = {};
        const now = new Date();
        
        if (period === 'week') {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            dateFilter = { $gte: weekStart };
        } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { $gte: monthStart };
        }
        
        // Get entries
        const entries = await PressmanEntry.find({
            pressman: workerId,
            ...(Object.keys(dateFilter).length && { date: dateFilter })
        }).sort({ date: -1 });
        
        let workDetails = [];
        let totalPieces = 0;
        let totalEarnings = 0;
        
        for (const entry of entries) {
            for (const item of entry.entries) {
                workDetails.push({
                    date: entry.date,
                    entryNumber: entry.entryNumber,
                    productName: item.productName,
                    pieces: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    status: entry.status
                });
                totalPieces += item.quantity;
                totalEarnings += item.amount;
            }
        }
        
        // Get payments
        const payments = await Payment.find({ 
            worker: workerId,
            ...(Object.keys(dateFilter).length && { paymentDate: dateFilter })
        }).sort({ paymentDate: -1 });
        
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        // Get advances
        const advances = await Advance.find({ 
            worker: workerId,
            ...(Object.keys(dateFilter).length && { date: dateFilter })
        }).sort({ date: -1 });
        
        const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
        
        const netPayable = totalEarnings - totalPaid - totalAdvances;
        
        res.render('payments/statement', {
            title: `Payment Statement - ${worker.name}`,
            worker: worker,
            workDetails: workDetails,
            totalPieces: totalPieces,
            totalEarnings: totalEarnings,
            totalPaid: totalPaid,
            totalAdvances: totalAdvances,
            netPayable: netPayable,
            payments: payments,
            advances: advances,
            period: period || 'all',
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error_msg', 'Error loading statement');
        res.redirect('/payments');
    }
};

// ==================== PROCESS PRESSMAN PAYMENT ====================
exports.processPressmanPayment = async (req, res) => {
    try {
        const { workerId, amount, paymentMethod, reference, remark, entryIds } = req.body;
        
        const worker = await Worker.findById(workerId);
        if (!worker) {
            return res.status(404).json({ success: false, error: 'Worker not found' });
        }
        
        // Create payment
        const payment = new Payment({
            worker: workerId,
            workerType: 'pressman',
            amount: parseFloat(amount),
            paymentMethod: paymentMethod || 'Cash',
            reference: reference || '',
            remark: remark || '',
            paymentDate: new Date(),
            createdBy: req.session.user.id
        });
        
        await payment.save();
        
        // Update entry statuses if entryIds provided
        if (entryIds && entryIds.length) {
            await PressmanEntry.updateMany(
                { _id: { $in: entryIds } },
                { status: 'paid', paymentDate: new Date(), paidAmount: parseFloat(amount) }
            );
        }
        
        res.json({ success: true, payment });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== GET PRESSMAN PAYMENT HISTORY ====================
exports.getPressmanPaymentHistory = async (req, res) => {
    try {
        const workerId = req.params.id;
        
        const payments = await Payment.find({ 
            worker: workerId,
            workerType: 'pressman'
        }).sort({ paymentDate: -1 });
        
        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};