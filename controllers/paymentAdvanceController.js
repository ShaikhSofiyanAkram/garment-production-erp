const PaymentAdvance = require('../models/PaymentAdvance');
const Worker = require('../models/Worker');
const Payment = require('../models/Payment');

// ==================== ADVANCE DASHBOARD ====================
// ==================== ADVANCE DASHBOARD ====================
exports.getPaymentAdvanceDashboard = async (req, res) => {
    try {
        const { workerType, status, fromDate, toDate } = req.query;
        
        // Build filter
        let filter = {};
        if (workerType) filter.workerType = workerType;
        if (status) filter.status = status;
        if (fromDate && toDate) {
            filter.date = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            };
            filter.date.$lte.setHours(23, 59, 59, 999);
        }
        
        const advances = await PaymentAdvance.find(filter)
            .populate('worker', 'name phone workerType')
            .populate('createdBy', 'username')
            .sort({ date: -1 });
        
        // Stats
        const totalAdvances = await PaymentAdvance.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalPending = totalAdvances[0]?.total || 0;
        
        const totalAdjusted = await PaymentAdvance.aggregate([
            { $match: { status: 'adjusted' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalAdjustedAmount = totalAdjusted[0]?.total || 0;
        
        // ✅ Get ALL workers (for dynamic dropdown)
        const workers = await Worker.find({ isActive: true }).select('name workerType');
        
        res.render('payment-advance/index', {
            title: 'Payment Advance Management',
            advances: advances || [],
            totalPending: totalPending || 0,
            totalAdjusted: totalAdjustedAmount || 0,
            totalAdvances: advances.length || 0,
            workers: workers || [],
            query: req.query,
            user: req.session.user,
            currentPage: 'payment-advance',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('❌ Error loading payment advance dashboard:', error);
        req.flash('error_msg', 'Error loading payment advance dashboard');
        res.redirect('/dashboard');
    }
};

// ==================== CREATE ADVANCE ====================
exports.createPaymentAdvance = async (req, res) => {
    try {
        const { workerId, workerType, amount, purpose, remark } = req.body;
        
        console.log('📝 Creating advance:', { workerId, amount, purpose });
        
        if (!workerId || !amount || amount <= 0) {
            req.flash('error_msg', 'Invalid data');
            return res.redirect('/payments/advances');
        }
        
        const worker = await Worker.findById(workerId);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments/advances');
        }
        
        const advance = new PaymentAdvance({
            worker: workerId,
            workerType: workerType || worker.workerType,
            amount: parseFloat(amount),
            purpose: purpose || 'General',
            remark: remark || '',
            date: new Date(),
            status: 'pending',
            createdBy: req.session.user.id
        });
        
        await advance.save();
        
        console.log('✅ Advance created:', advance._id);
        req.flash('success_msg', `Advance of ₹${advance.amount} recorded for ${worker.name}`);
        res.redirect('/payments/advances');
    } catch (error) {
        console.error('❌ Error creating advance:', error);
        req.flash('error_msg', 'Error creating advance: ' + error.message);
        res.redirect('/payments/advances');
    }
};

// ==================== ADJUST ADVANCE ====================
exports.adjustPaymentAdvance = async (req, res) => {
    try {
        const advanceId = req.params.id;
        const { paymentId, adjustedAmount } = req.body;
        
        const advance = await PaymentAdvance.findById(advanceId);
        if (!advance) {
            return res.status(404).json({ success: false, error: 'Advance not found' });
        }
        
        if (advance.status === 'adjusted') {
            return res.status(400).json({ success: false, error: 'Advance already adjusted' });
        }
        
        advance.status = 'adjusted';
        advance.adjustedInPayment = paymentId;
        advance.adjustedAmount = parseFloat(adjustedAmount) || advance.amount;
        advance.adjustedAt = new Date();
        advance.approvedBy = req.session.user.id;
        
        await advance.save();
        
        res.json({ success: true, advance });
    } catch (error) {
        console.error('❌ Error adjusting advance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== CANCEL ADVANCE ====================
exports.cancelPaymentAdvance = async (req, res) => {
    try {
        const advance = await PaymentAdvance.findById(req.params.id);
        if (!advance) {
            return res.status(404).json({ success: false, error: 'Advance not found' });
        }
        
        if (advance.status === 'adjusted') {
            return res.status(400).json({ success: false, error: 'Cannot cancel adjusted advance' });
        }
        
        advance.status = 'cancelled';
        await advance.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error cancelling advance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== GET WORKER ADVANCES ====================
exports.getWorkerPaymentAdvances = async (req, res) => {
    try {
        const workerId = req.params.id;
        const advances = await PaymentAdvance.find({ 
            worker: workerId,
            status: 'pending'
        }).sort({ date: -1 });
        
        const totalPending = advances.reduce((sum, a) => sum + a.amount, 0);
        
        res.json({ 
            success: true, 
            advances: advances,
            totalPending: totalPending,
            count: advances.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== API: GET ADVANCE SUMMARY ====================
exports.getPaymentAdvanceSummary = async (req, res) => {
    try {
        const { workerId } = req.query;
        
        let filter = { status: 'pending' };
        if (workerId) filter.worker = workerId;
        
        const advances = await PaymentAdvance.find(filter)
            .populate('worker', 'name workerType');
        
        const total = advances.reduce((sum, a) => sum + a.amount, 0);
        
        res.json({
            success: true,
            advances: advances,
            total: total,
            count: advances.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
