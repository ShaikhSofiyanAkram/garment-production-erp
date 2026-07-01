const Worker = require('../models/Worker');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const PressmanEntry = require('../models/PressmanEntry');
const Finishing = require('../models/Finishing');
const Cutting = require('../models/Cutting');
const Advance = require('../models/Advance');
const Payment = require('../models/Payment');
const Product = require('../models/Product');

// ============ GET PAYMENT DASHBOARD ============
exports.getPaymentDashboard = async (req, res) => {
    try {
        const helpers = await Worker.find({ workerType: 'helper', isActive: true });
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        const pressmans = await Worker.find({ workerType: 'pressman', isActive: true });
        const cuttings = await Worker.find({ workerType: 'cutting', isActive: true });
        
        res.render('payments/index', {
            title: 'Payment Management',
            helpers: helpers || [],
            karigars: karigars || [],
            pressmans: pressmans || [],
            cuttings: cuttings || [],
            user: req.session.user,
            currentPage: 'payments',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error_msg', 'Error loading payment dashboard');
        res.redirect('/dashboard');
    }
};

// ============ KARIGAR DETAIL VIEW ============
exports.getKarigarDetail = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }
        res.render('payments/karigar-detail', {
            title: `${worker.name} - Karigar Payment`,
            worker,
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        req.flash('error_msg', 'Error loading worker details');
        res.redirect('/payments');
    }
};

// ============ PRESSMAN DETAIL VIEW ============
exports.getPressmanDetail = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }
        res.render('payments/pressman-detail', {
            title: `${worker.name} - Pressman Payment`,
            worker,
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        req.flash('error_msg', 'Error loading worker details');
        res.redirect('/payments');
    }
};

// ============ HELPER DETAIL VIEW ============
exports.getHelperDetail = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        res.render('payments/helper-detail', {
            title: `${worker.name} - Helper Payment`,
            worker,
            currentMonth,
            currentYear,
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        req.flash('error_msg', 'Error loading worker details');
        res.redirect('/payments');
    }
};

// ============ CUTTING DETAIL VIEW ============
exports.getCuttingDetail = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        res.render('payments/cutting-detail', {
            title: `${worker.name} - Cutting Worker Payment`,
            worker,
            currentMonth,
            currentYear,
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        req.flash('error_msg', 'Error loading worker details');
        res.redirect('/payments');
    }
};

// ============ GET STATEMENT ============
exports.getStatement = async (req, res) => {
    try {
        const { workerId, workerType, fromDate, toDate } = req.query;
        let payments = [];
        let advances = [];
        let worker = null;
        
        if (workerId) {
            worker = await Worker.findById(workerId);
            payments = await Payment.find({ worker: workerId });
            advances = await Advance.find({ worker: workerId });
        }
        
        res.render('payments/statement', {
            title: 'Payment Statement',
            worker,
            payments,
            advances,
            fromDate,
            toDate,
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        req.flash('error_msg', 'Error generating statement');
        res.redirect('/payments');
    }
};

// ============ API: GET WORKER STATS ============
exports.getWorkerStats = async (req, res) => {
    try {
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        const pressmans = await Worker.find({ workerType: 'pressman', isActive: true });
        const helpers = await Worker.find({ workerType: 'helper', isActive: true });
        const cuttings = await Worker.find({ workerType: 'cutting', isActive: true });
        
        const stats = {
            karigars: [],
            pressmans: [],
            helpers: [],
            cuttings: [],
            summary: {
                totalKarigarPieces: 0,
                totalPressmanPieces: 0,
                pendingAdvances: 0,
                totalPendingPayment: 0
            }
        };
        
        // ============ KARIGAR STATS ============
        for (const k of karigars) {
            const assignments = await Assignment.find({ karigar: k._id, status: 'completed' });
            const returns = await ProductionReturn.find({ karigar: k._id });
            const advances = await Advance.find({ worker: k._id, status: 'pending' });
            const payments = await Payment.find({ worker: k._id });
            
            let totalPieces = 0;
            let totalEarnings = 0;
            
            for (const ret of returns) {
                totalPieces += ret.totalReturned || 0;
                // Get product rate
                const product = await Product.findOne({ name: ret.productName });
                const rate = product?.rates?.karigar || 0;
                totalEarnings += (ret.totalReturned || 0) * rate;
            }
            
            const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
            const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
            const pendingAmount = Math.max(0, totalEarnings - paidAmount - totalAdvance);
            
            stats.karigars.push({
                id: k._id,
                name: k.name,
                totalPieces,
                totalEarnings,
                totalAdvance,
                pendingAmount,
                paidAmount
            });
            
            stats.summary.totalKarigarPieces += totalPieces;
            stats.summary.pendingAdvances += advances.length;
            stats.summary.totalPendingPayment += pendingAmount;
        }
        
        // ============ PRESSMAN STATS ============
        for (const p of pressmans) {
            const entries = await PressmanEntry.find({ pressman: p._id });
            const advances = await Advance.find({ worker: p._id, status: 'pending' });
            const payments = await Payment.find({ worker: p._id });
            
            const totalPieces = entries.reduce((sum, e) => sum + (e.totalQuantity || 0), 0);
            const totalEarnings = entries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
            const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
            const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
            const pendingAmount = Math.max(0, totalEarnings - paidAmount - totalAdvance);
            
            stats.pressmans.push({
                id: p._id,
                name: p.name,
                totalPieces,
                totalEarnings,
                totalAdvance,
                pendingAmount,
                paidAmount
            });
            
            stats.summary.totalPressmanPieces += totalPieces;
            stats.summary.totalPendingPayment += pendingAmount;
        }
        
        // ============ HELPER STATS ============
        for (const h of helpers) {
            const finishing = await Finishing.find({ helper: h._id });
            const advances = await Advance.find({ worker: h._id, status: 'pending' });
            
            const uniqueDays = new Set(finishing.map(f => new Date(f.finishingDate).toDateString()));
            const daysPresent = uniqueDays.size;
            const totalDays = 26;
            const dailyRate = h.monthlyRate / totalDays;
            const earnedSalary = daysPresent * dailyRate;
            const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
            const netPayable = Math.max(0, earnedSalary - totalAdvance);
            
            stats.helpers.push({
                id: h._id,
                name: h.name,
                daysPresent,
                totalDays,
                monthlySalary: h.monthlyRate,
                earnedSalary,
                totalAdvance,
                netPayable
            });
        }
        
        // ============ CUTTING STATS ============
        for (const c of cuttings) {
            const advances = await Advance.find({ worker: c._id, status: 'pending' });
            const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
            const netPayable = Math.max(0, c.monthlyRate - totalAdvance);
            
            stats.cuttings.push({
                id: c._id,
                name: c.name,
                monthlyRate: c.monthlyRate,
                totalAdvance,
                netPayable
            });
        }
        
        res.json({ success: true, ...stats });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, error: error.message });
    }
};

// ============ API: KARIGAR DATA ============
exports.getKarigarData = async (req, res) => {
    try {
        const { id } = req.params;
        const { from, to } = req.query;
        
        const startDate = new Date(from);
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        
        // Get production returns with product rates
        const returns = await ProductionReturn.find({
            karigar: id,
            returnDate: { $gte: startDate, $lte: endDate }
        });
        
        const work = [];
        let totalPieces = 0;
        let totalEarnings = 0;
        
        for (const ret of returns) {
            const product = await Product.findOne({ name: ret.productName });
            const rate = product?.rates?.karigar || 0;
            const amount = (ret.totalReturned || 0) * rate;
            totalPieces += ret.totalReturned || 0;
            totalEarnings += amount;
            
            work.push({
                date: ret.returnDate,
                assignmentId: ret.assignmentId,
                product: ret.productName,
                size: ret.sizes?.map(s => s.size).join(', ') || 'N/A',
                pieces: ret.totalReturned || 0,
                rate: rate,
                amount: amount
            });
        }
        
        const payments = await Payment.find({
            worker: id,
            paymentDate: { $gte: startDate, $lte: endDate }
        });
        
        const advances = await Advance.find({
            worker: id,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        
        res.json({
            success: true,
            work,
            payments,
            advances,
            summary: {
                totalEarnings,
                totalPieces,
                totalAdvance,
                paidAmount,
                pendingPayment: Math.max(0, totalEarnings - paidAmount - totalAdvance)
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, error: error.message });
    }
};

// ============ API: PRESSMAN DATA ============
exports.getPressmanData = async (req, res) => {
    try {
        const { id } = req.params;
        const { from, to } = req.query;
        
        const startDate = new Date(from);
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        
        const entries = await PressmanEntry.find({
            pressman: id,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const formattedEntries = entries.map(e => ({
            date: e.date,
            entryNumber: e.entryNumber,
            products: e.entries || [],
            quantity: e.totalQuantity || 0,
            amount: e.totalAmount || 0,
            status: e.status
        }));
        
        const payments = await Payment.find({
            worker: id,
            paymentDate: { $gte: startDate, $lte: endDate }
        });
        
        const advances = await Advance.find({
            worker: id,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const totalEarnings = entries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        
        res.json({
            success: true,
            entries: formattedEntries,
            payments,
            advances,
            summary: {
                totalEarnings,
                totalPieces: entries.reduce((sum, e) => sum + (e.totalQuantity || 0), 0),
                totalAdvance,
                paidAmount,
                pendingPayment: Math.max(0, totalEarnings - paidAmount - totalAdvance)
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, error: error.message });
    }
};

// ============ API: HELPER DATA ============
exports.getHelperData = async (req, res) => {
    try {
        const { id } = req.params;
        const { month, year } = req.query;
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const finishing = await Finishing.find({
            helper: id,
            finishingDate: { $gte: startDate, $lte: endDate }
        });
        
        const advances = await Advance.find({
            worker: id,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const worker = await Worker.findById(id);
        
        // Calculate attendance
        const days = {};
        let workingDays = 0;
        let presentDays = 0;
        let fridays = 0;
        
        for (let d = 1; d <= endDate.getDate(); d++) {
            const date = new Date(year, month - 1, d);
            const dayOfWeek = date.getDay();
            
            if (dayOfWeek === 5) {
                fridays++;
                days[d] = { holiday: true };
            } else {
                workingDays++;
                const isPresent = finishing.some(f => 
                    new Date(f.finishingDate).getDate() === d
                );
                days[d] = { present: isPresent };
                if (isPresent) presentDays++;
            }
        }
        
        const dailyRate = workingDays > 0 ? worker.monthlyRate / workingDays : 0;
        const earnedSalary = presentDays * dailyRate;
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        const netPayable = Math.max(0, earnedSalary - totalAdvance);
        
        res.json({
            success: true,
            attendance: {
                days,
                totalDays: endDate.getDate(),
                workingDays,
                presentDays,
                fridays
            },
            dailyRate,
            earnedSalary,
            totalAdvance,
            netPayable,
            advances
        });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, error: error.message });
    }
};

// ============ API: CUTTING DATA ============
exports.getCuttingData = async (req, res) => {
    try {
        const { id } = req.params;
        const { month, year } = req.query;
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const cuttings = await Cutting.find({
            cuttingWorker: id,
            createdAt: { $gte: startDate, $lte: endDate }
        });
        
        const advances = await Advance.find({
            worker: id,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const worker = await Worker.findById(id);
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        const netPayable = Math.max(0, (worker?.monthlyRate || 0) - totalAdvance);
        
        res.json({
            success: true,
            cuttings,
            advances,
            monthlyRate: worker?.monthlyRate || 0,
            totalAdvance,
            netPayable
        });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: false, error: error.message });
    }
};

// ============ API: WORKERS BY TYPE ============
exports.getWorkersByType = async (req, res) => {
    try {
        const workers = await Worker.find({
            workerType: req.params.type,
            isActive: true
        });
        res.json({ success: true, workers });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

// ============ API: GET ADVANCES ============
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

// ============ CREATE ADVANCE ============
exports.createAdvance = async (req, res) => {
    try {
        const { workerId, workerType, amount, purpose, remark } = req.body;
        
        if (!workerId || !workerType || !amount || amount <= 0) {
            req.flash('error_msg', 'Please fill all required fields');
            return res.redirect('/payments');
        }
        
        await Advance.create({
            worker: workerId,
            workerType,
            amount: parseFloat(amount),
            purpose: purpose || '',
            remark: remark || '',
            createdBy: req.session.user.id
        });
        
        req.flash('success_msg', `✅ Advance of ₹${parseFloat(amount).toLocaleString()} recorded`);
        res.redirect('/payments');
    } catch (error) {
        console.error('Error creating advance:', error);
        req.flash('error_msg', 'Error recording advance: ' + error.message);
        res.redirect('/payments');
    }
};

// ============ DELETE ADVANCE ============
exports.deleteAdvance = async (req, res) => {
    try {
        const advance = await Advance.findById(req.params.id);
        if (!advance) {
            return res.json({ success: false, error: 'Advance not found' });
        }
        await advance.deleteOne();
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};