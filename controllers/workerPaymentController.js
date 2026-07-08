const Worker = require('../models/Worker');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const PressmanEntry = require('../models/PressmanEntry');
const PressmanProduct = require('../models/PressmanProduct');
const Payment = require('../models/Payment');
const Advance = require('../models/Advance'); // Billing advance
const PaymentAdvance = require('../models/PaymentAdvance'); // Payment advance
const Attendance = require('../models/Attendance');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// =====================================================================
// 1. HELPER FUNCTIONS
// =====================================================================

// ==================== GET WEEK START (SATURDAY) ====================
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 6) ? 0 : (day + 1);
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ==================== FIND PRODUCT AND RATE (WITH DEBUG) ====================
async function findProductAndRate(productName, size) {
    console.log(`\n  🔍 ===== SEARCHING =====`);
    console.log(`  📝 Product: "${productName}"`);
    console.log(`  📏 Size: "${size}"`);

    if (!productName || productName === 'N/A' || productName === '') {
        console.log(`  ⚠️ No product name provided`);
        return { product: null, rate: 0, matchedName: productName, matchedSize: size };
    }

    let product = null;
    let matchedName = productName;
    let matchedSize = size;

    // METHOD 1: Case-insensitive exact match
    console.log(`  📌 Method 1: Exact match (case-insensitive)`);
    product = await Product.findOne({
        name: { $regex: new RegExp(`^${productName}$`, 'i') }
    });
    if (product) {
        console.log(`  ✅ Found: "${product.name}" (exact match)`);
    }

    // METHOD 2: Case-insensitive contains match
    if (!product) {
        console.log(`  📌 Method 2: Contains match`);
        product = await Product.findOne({
            name: { $regex: new RegExp(productName, 'i') }
        });
        if (product) {
            console.log(`  ✅ Found: "${product.name}" (contains match)`);
        }
    }

    // METHOD 3: Word-by-word search
    if (!product) {
        console.log(`  📌 Method 3: Word-by-word search`);
        const words = productName.split(' ').filter(w => w.length > 2);
        for (const word of words) {
            const temp = await Product.findOne({
                name: { $regex: new RegExp(word, 'i') }
            });
            if (temp) {
                product = temp;
                console.log(`  ✅ Found: "${product.name}" (word: "${word}")`);
                break;
            }
        }
    }

    // METHOD 4: Without common words
    if (!product) {
        console.log(`  📌 Method 4: Without common words`);
        const cleanName = productName
            .replace(/full|half|kids|mens|women|regular|slim|design|print|fancy|new|old/g, '')
            .trim();
        if (cleanName && cleanName.length > 2 && cleanName !== productName) {
            product = await Product.findOne({
                name: { $regex: new RegExp(cleanName, 'i') }
            });
            if (product) {
                console.log(`  ✅ Found: "${product.name}" (clean: "${cleanName}")`);
            }
        }
    }

    if (!product) {
        console.log(`  ❌ NO PRODUCT FOUND for: "${productName}"`);
        return { product: null, rate: 0, matchedName: productName, matchedSize: size };
    }

    matchedName = product.name;
    console.log(`  ✅ PRODUCT FOUND: "${product.name}" (${product.category})`);

    // GET KARIGAR RATE FOR SIZE
    let rate = 0;

    if (!product.sizeRates || product.sizeRates.length === 0) {
        console.log(`  ⚠️ No sizeRates found for product`);
        return { product, rate: 0, matchedName, matchedSize };
    }

    console.log(`  📊 SizeRates available: ${product.sizeRates.length}`);
    product.sizeRates.forEach(sr => {
        console.log(`    - "${sr.size}": ₹${sr.karigarRate}`);
    });

    let sizeRate = null;

    // Method A: Exact match
    console.log(`  📌 Size Match A: Exact match`);
    sizeRate = product.sizeRates.find(sr => sr.size === size);
    if (sizeRate) {
        console.log(`  ✅ Exact match: "${size}" → ₹${sizeRate.karigarRate}`);
    }

    // Method B: Case-insensitive
    if (!sizeRate) {
        console.log(`  📌 Size Match B: Case-insensitive`);
        sizeRate = product.sizeRates.find(sr =>
            sr.size.toLowerCase() === size.toLowerCase()
        );
        if (sizeRate) {
            console.log(`  ✅ Case-insensitive match: "${sizeRate.size}" → ₹${sizeRate.karigarRate}`);
        }
    }

    // Method C: Trim
    if (!sizeRate) {
        console.log(`  📌 Size Match C: Trim`);
        sizeRate = product.sizeRates.find(sr =>
            sr.size.trim() === size.trim()
        );
        if (sizeRate) {
            console.log(`  ✅ Trim match: "${sizeRate.size}" → ₹${sizeRate.karigarRate}`);
        }
    }

    // Method D: Partial match
    if (!sizeRate) {
        console.log(`  📌 Size Match D: Partial match`);
        sizeRate = product.sizeRates.find(sr =>
            size.includes(sr.size) || sr.size.includes(size)
        );
        if (sizeRate) {
            console.log(`  ✅ Partial match: "${sizeRate.size}" → ₹${sizeRate.karigarRate}`);
        }
    }

    // Method E: Numeric
    if (!sizeRate) {
        console.log(`  📌 Size Match E: Numeric`);
        const sizeNum = parseInt(size);
        if (!isNaN(sizeNum)) {
            sizeRate = product.sizeRates.find(sr => {
                const srNum = parseInt(sr.size);
                return !isNaN(srNum) && srNum === sizeNum;
            });
            if (sizeRate) {
                console.log(`  ✅ Numeric match: "${sizeRate.size}" → ₹${sizeRate.karigarRate}`);
            }
        }
    }

    // Method F: First available (fallback)
    if (!sizeRate) {
        console.log(`  📌 Size Match F: First available (fallback)`);
        sizeRate = product.sizeRates[0];
        if (sizeRate) {
            console.log(`  ⚠️ Using first available: "${sizeRate.size}" → ₹${sizeRate.karigarRate}`);
        }
    }

    if (sizeRate) {
        rate = sizeRate.karigarRate || 0;
        matchedSize = sizeRate.size;
        console.log(`  ✅ FINAL RATE: ₹${rate} (size: ${matchedSize})`);
    } else {
        console.log(`  ❌ NO RATE FOUND`);
    }

    console.log(`  ==========================\n`);

    return { product, rate, matchedName, matchedSize };
}

// ==================== GET KARIGAR RATE ====================
function getKarigarRate(product, size) {
    if (!product) return 0;

    if (product.sizeRates && product.sizeRates.length > 0) {
        let sizeRate = product.sizeRates.find(sr => sr.size === size);
        if (!sizeRate) {
            sizeRate = product.sizeRates.find(sr =>
                size.includes(sr.size) || sr.size.includes(size)
            );
        }
        if (!sizeRate) {
            const sizeNum = parseInt(size);
            if (!isNaN(sizeNum)) {
                sizeRate = product.sizeRates.find(sr => {
                    const srNum = parseInt(sr.size);
                    return !isNaN(srNum) && srNum === sizeNum;
                });
            }
        }
        if (!sizeRate) {
            sizeRate = product.sizeRates[0];
        }
        if (sizeRate) {
            return sizeRate.karigarRate || 0;
        }
    }

    if (product.karigarRate !== undefined && product.karigarRate !== null) {
        return product.karigarRate || 0;
    }

    if (product.rates && product.rates.karigar !== undefined) {
        return product.rates.karigar || 0;
    }

    return 0;
}

// ==================== GET WORKER EARNINGS (UNIFIED) ====================
// ==================== GET WORKER EARNINGS (UNIFIED - COMPLETE FIX) ====================
// ==================== GET WORKER EARNINGS (UPDATED - Month-wise) ====================
// ==================== GET WORKER EARNINGS (UNIFIED) ====================
async function getWorkerEarnings(worker, dateFilter = {}) {
    let totalPieces = 0;
    let totalEarnings = 0;
    let workDetails = [];
    let monthSummaries = [];

    // ==================== KARIGAR ====================
    if (worker.workerType === 'karigar') {
        const assignments = await Assignment.find({
            karigar: worker._id,
            status: 'completed',
            ...(Object.keys(dateFilter).length && { assignedDate: dateFilter })
        }).populate('product');

        for (const assign of assignments) {
            const returns = await ProductionReturn.find({ assignment: assign._id });
            const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);

            let size = 'N/A';
            if (assign.sizes && assign.sizes.length > 0) {
                if (typeof assign.sizes[0] === 'object') {
                    size = assign.sizes[0].size || 'N/A';
                } else {
                    size = assign.sizes[0] || 'N/A';
                }
            }

            let productName = 'N/A';
            let rate = 0;

            let product = null;
            if (assign.product) {
                product = assign.product;
                productName = assign.product.name || 'N/A';
                rate = getKarigarRate(assign.product, size);
            } else if (assign.productName) {
                const result = await findProductAndRate(assign.productName, size);
                productName = result.matchedName || assign.productName;
                rate = result.rate || 0;
                if (result.product) {
                    product = result.product;
                }
            }

            const amount = totalReturned * rate;
            workDetails.push({
                date: assign.assignedDate,
                assignmentId: assign.assignmentId,
                productName: productName,
                size: size,
                pieces: totalReturned,
                rate: rate,
                amount: amount
            });
            totalPieces += totalReturned;
            totalEarnings += amount;
        }
    }

    // ==================== PRESSMAN ====================
    else if (worker.workerType === 'pressman') {
        const entries = await PressmanEntry.find({
            pressman: worker._id,
            ...(Object.keys(dateFilter).length && { date: dateFilter })
        });

        for (const entry of entries) {
            for (const item of entry.entries) {
                workDetails.push({
                    date: entry.date,
                    entryNumber: entry.entryNumber,
                    productName: item.productName || 'Unknown',
                    size: item.size || 'N/A',
                    pieces: item.quantity || 0,
                    rate: item.rate || 0,
                    amount: item.amount || 0
                });
                totalPieces += item.quantity || 0;
                totalEarnings += item.amount || 0;
            }
        }
    }

    // ==================== HELPER ====================
    // ==================== HELPER ====================
    else if (worker.workerType === 'helper') {
        console.log(`📊 Calculating Helper earnings for: ${worker.name}`);

        const monthlyRate = worker.monthlyRate || 0;
        const dailyRate = Math.round(monthlyRate / 26);

        const attendance = await Attendance.find({
            worker: worker._id,
            ...(Object.keys(dateFilter).length && { date: dateFilter })
        }).sort({ date: 1 });

        if (attendance.length === 0) {
            console.log(`⚠️ No attendance found for ${worker.name}`);
            return {
                totalPieces: 0,
                totalEarnings: 0,
                totalPaid: 0,
                totalAdvances: 0,
                netPayable: 0,
                workDetails: [],
                monthSummaries: []
            };
        }

        const monthMap = {};
        for (const att of attendance) {
            const monthKey = att.date.getFullYear() + '-' + String(att.date.getMonth() + 1).padStart(2, '0');
            if (!monthMap[monthKey]) {
                monthMap[monthKey] = [];
            }
            monthMap[monthKey].push(att);
        }

        const Packing = require('../models/Packing');

        for (const [monthKey, monthAttendance] of Object.entries(monthMap)) {
            const [year, month] = monthKey.split('-').map(Number);
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);

            const presentDays = monthAttendance.filter(a => a.status === 'present').length;
            const halfDays = monthAttendance.filter(a => a.status === 'half-day').length;

            const workingDays = Math.min(presentDays + (halfDays * 0.5), 26);
            const monthEarnings = Math.round(workingDays * dailyRate);

            const isPaid = monthAttendance.every(a => a.monthPaid === true);
            const paidAmount = isPaid ? monthAttendance[0]?.monthPaidAmount || 0 : 0;

            let packingData = null;
            const packing = await Packing.findOne({
                packingDate: { $gte: monthStart, $lte: monthEnd }
            });

            let productName = 'Packing';
            let size = 'N/A';
            let pieces = 1;

            if (packing && packing.entries && packing.entries.length > 0) {
                const firstEntry = packing.entries[0];
                productName = firstEntry.productName || 'Packing';
                size = firstEntry.size || 'N/A';
                pieces = firstEntry.packedPieces || 1;
            }

            // ✅ Add to month summaries
            monthSummaries.push({
                month: monthKey,
                monthStart: monthStart,
                monthEnd: monthEnd,
                presentDays: presentDays,
                halfDays: halfDays,
                workingDays: Math.round(workingDays),
                earnings: monthEarnings,
                isPaid: isPaid,
                paidAmount: paidAmount,
                productName: productName,
                size: size,
                pieces: pieces
            });

            // ✅ Add to workDetails with presentDays and halfDays
            workDetails.push({
                date: monthStart,
                monthKey: monthKey,
                productName: `📅 ${monthKey} - ${productName}`,
                size: size,
                presentDays: presentDays,        // ✅ ADDED
                halfDays: halfDays,              // ✅ ADDED
                days: Math.round(workingDays),
                pieces: pieces * presentDays,
                rate: dailyRate,
                amount: monthEarnings,
                status: isPaid ? 'paid' : 'pending',
                type: 'month-summary',
                isPaid: isPaid,
                monthKey: monthKey
            });

            totalPieces += pieces * presentDays;
            totalEarnings += monthEarnings;
        }
    }

    // ==================== CUTTING ====================
    else if (worker.workerType === 'cutting') {
        console.log(`📊 Calculating Cutting earnings for: ${worker.name}`);

        const monthlyRate = worker.monthlyRate || 0;
        const dailyRate = Math.round(monthlyRate / 26);

        const attendance = await Attendance.find({
            worker: worker._id,
            ...(Object.keys(dateFilter).length && { date: dateFilter })
        }).sort({ date: 1 });

        if (attendance.length === 0) {
            return {
                totalPieces: 0,
                totalEarnings: 0,
                totalPaid: 0,
                totalAdvances: 0,
                netPayable: 0,
                workDetails: [],
                monthSummaries: []
            };
        }

        const monthMap = {};
        for (const att of attendance) {
            const monthKey = att.date.getFullYear() + '-' + String(att.date.getMonth() + 1).padStart(2, '0');
            if (!monthMap[monthKey]) {
                monthMap[monthKey] = [];
            }
            monthMap[monthKey].push(att);
        }

        const Cutting = require('../models/Cutting');

        for (const [monthKey, monthAttendance] of Object.entries(monthMap)) {
            const [year, month] = monthKey.split('-').map(Number);
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);

            const presentDays = monthAttendance.filter(a => a.status === 'present').length;
            const halfDays = monthAttendance.filter(a => a.status === 'half-day').length;

            const workingDays = Math.min(presentDays + (halfDays * 0.5), 26);
            const monthEarnings = Math.round(workingDays * dailyRate);

            const isPaid = monthAttendance.every(a => a.monthPaid === true);
            const paidAmount = isPaid ? monthAttendance[0]?.monthPaidAmount || 0 : 0;

            let cuttingData = null;
            const cutting = await Cutting.findOne({
                createdAt: { $gte: monthStart, $lte: monthEnd },
                cuttingWorker: worker._id
            });

            let productName = 'Cutting';
            let size = 'N/A';
            let pieces = 1;

            if (cutting) {
                productName = cutting.productName || 'Cutting';
                if (cutting.sizes && cutting.sizes.length > 0) {
                    size = cutting.sizes[0].size || 'N/A';
                    pieces = cutting.sizes[0].pieces || 1;
                }
            }

            // ✅ Add to month summaries
            monthSummaries.push({
                month: monthKey,
                monthStart: monthStart,
                monthEnd: monthEnd,
                presentDays: presentDays,
                halfDays: halfDays,
                workingDays: Math.round(workingDays),
                earnings: monthEarnings,
                isPaid: isPaid,
                paidAmount: paidAmount,
                productName: productName,
                size: size,
                pieces: pieces
            });

            // ✅ Add to workDetails with presentDays and halfDays
            workDetails.push({
                date: monthStart,
                monthKey: monthKey,
                productName: `📅 ${monthKey} - ${productName}`,
                size: size,
                presentDays: presentDays,        // ✅ ADDED
                halfDays: halfDays,              // ✅ ADDED
                days: Math.round(workingDays),
                pieces: pieces * presentDays,
                rate: dailyRate,
                amount: monthEarnings,
                status: isPaid ? 'paid' : 'pending',
                type: 'month-summary',
                isPaid: isPaid,
                monthKey: monthKey
            });

            totalPieces += pieces * presentDays;
            totalEarnings += monthEarnings;
        }
    }
    // ✅ GET PAYMENTS
    const payments = await Payment.find({ worker: worker._id });
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // ✅ GET PENDING ADVANCES
    const pendingAdvances = await PaymentAdvance.find({
        worker: worker._id,
        status: 'pending'
    });
    const totalAdvances = pendingAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);

    return {
        totalPieces,
        totalEarnings,
        totalPaid,
        totalAdvances,
        netPayable: totalEarnings - totalPaid - totalAdvances,
        workDetails,
        monthSummaries: monthSummaries || []
    };
} // ✅ THIS CLOSES THE FUNCTION PROPERLY
// =====================================================================
// 2. MAIN CONTROLLER FUNCTIONS
// =====================================================================

// ==================== PAYMENT DASHBOARD ====================
exports.getPaymentDashboard = async (req, res) => {
    try {
        const { workerType, fromDate, toDate, status } = req.query;

        let filter = { isActive: true };
        if (workerType && workerType !== '') filter.workerType = workerType;
        if (status === 'inactive') filter.isActive = false;

        let dateFilter = {};
        if (fromDate && toDate) {
            dateFilter.$gte = new Date(fromDate);
            dateFilter.$lte = new Date(toDate);
            dateFilter.$lte.setHours(23, 59, 59, 999);
        }

        const karigars = await Worker.find({ workerType: 'karigar', ...filter });
        const pressmans = await Worker.find({ workerType: 'pressman', ...filter });
        const helpers = await Worker.find({ workerType: 'helper', ...filter });
        const cuttings = await Worker.find({ workerType: 'cutting', ...filter });

        const karigarEarnings = [];
        for (const k of karigars) {
            const data = await getWorkerEarnings(k, dateFilter);
            karigarEarnings.push({ worker: k, ...data });
        }

        const pressmanEarnings = [];
        for (const p of pressmans) {
            const data = await getWorkerEarnings(p, dateFilter);
            pressmanEarnings.push({ worker: p, ...data });
        }

        const helperEarnings = [];
        for (const h of helpers) {
            const data = await getWorkerEarnings(h, dateFilter);
            helperEarnings.push({ worker: h, ...data });
        }

        const cuttingEarnings = [];
        for (const c of cuttings) {
            const data = await getWorkerEarnings(c, dateFilter);
            cuttingEarnings.push({ worker: c, ...data });
        }

        const totalWorkers = await Worker.countDocuments({ isActive: true });
        const activeKarigars = await Worker.countDocuments({ workerType: 'karigar', isActive: true });
        const activePressmans = await Worker.countDocuments({ workerType: 'pressman', isActive: true });
        const activeHelpers = await Worker.countDocuments({ workerType: 'helper', isActive: true });
        const activeCuttings = await Worker.countDocuments({ workerType: 'cutting', isActive: true });

        // ✅ Pending advances from PaymentAdvance
        const pendingAdvances = await PaymentAdvance.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalPendingAdvances = pendingAdvances[0]?.total || 0;

        // Weekly payments
        const weekStart = getWeekStart(new Date());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weeklyPayments = await Payment.aggregate([
            { $match: { paymentDate: { $gte: weekStart, $lte: weekEnd } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalWeeklyPayments = weeklyPayments[0]?.total || 0;

        res.render('payments/index', {
            title: 'Payment Management',
            karigars: karigars || [],
            pressmans: pressmans || [],
            helpers: helpers || [],
            cuttings: cuttings || [],
            karigarEarnings: karigarEarnings || [],
            pressmanEarnings: pressmanEarnings || [],
            helperEarnings: helperEarnings || [],
            cuttingEarnings: cuttingEarnings || [],
            totalWorkers: totalWorkers || 0,
            activeKarigars: activeKarigars || 0,
            activePressmans: activePressmans || 0,
            activeHelpers: activeHelpers || 0,
            activeCuttings: activeCuttings || 0,
            pendingAdvances: totalPendingAdvances || 0,
            monthlyPayments: totalWeeklyPayments || 0,
            totalPaidThisMonth: totalWeeklyPayments || 0,
            user: req.session.user,
            currentPage: 'payments',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            query: req.query
        });
    } catch (error) {
        console.error('❌ Error loading payment dashboard:', error);
        req.flash('error_msg', 'Error loading payment dashboard: ' + error.message);
        res.redirect('/dashboard');
    }
};

// ==================== WORKER DETAIL ====================
exports.getWorkerDetail = async (req, res) => {
    try {
        const workerId = req.params.id;
        const worker = await Worker.findById(workerId);

        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }

        const earnings = await getWorkerEarnings(worker);

        const payments = await Payment.find({ worker: workerId }).sort({ paymentDate: -1 });
        const advances = await PaymentAdvance.find({ worker: workerId }).sort({ date: -1 });

        res.render('payments/worker-detail', {
            title: `${worker.name} - Payment Details`,
            worker: worker,
            workDetails: earnings.workDetails || [],
            totalPieces: earnings.totalPieces || 0,
            totalEarnings: earnings.totalEarnings || 0,
            totalPaid: earnings.totalPaid || 0,
            totalAdvances: earnings.totalAdvances || 0,
            netPayable: earnings.netPayable || 0,
            payments: payments || [],
            advances: advances || [],
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        console.error('❌ Error loading worker detail:', error);
        req.flash('error_msg', 'Error loading worker details: ' + error.message);
        res.redirect('/payments');
    }
};

// ==================== WORKER STATEMENT ====================
// ==================== WORKER STATEMENT ====================
exports.getWorkerStatement = async (req, res) => {
    try {
        const workerId = req.params.id;
        const { period, fromDate, toDate } = req.query;

        const worker = await Worker.findById(workerId);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }

        // ✅ BUILD DATE FILTER
        let dateFilter = {};
        const now = new Date();
        let activePeriod = period || 'week';

        if (!period && !fromDate && !toDate) {
            const weekStart = getWeekStart(now);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            dateFilter = { $gte: weekStart, $lte: weekEnd };
            activePeriod = 'week';
        }

        if (period === 'week') {
            const weekStart = getWeekStart(now);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            dateFilter = { $gte: weekStart, $lte: weekEnd };
            activePeriod = 'week';
        } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            monthEnd.setHours(23, 59, 59, 999);
            dateFilter = { $gte: monthStart, $lte: monthEnd };
            activePeriod = 'month';
        } else if (period === 'all') {
            dateFilter = {};
            activePeriod = 'all';
        }

        if (fromDate && toDate) {
            const start = new Date(fromDate);
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { $gte: start, $lte: end };
            activePeriod = 'custom';
        } else if (fromDate && !toDate) {
            const start = new Date(fromDate);
            dateFilter = { $gte: start };
            activePeriod = 'custom';
        } else if (!fromDate && toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { $lte: end };
            activePeriod = 'custom';
        }

        let workDetails = [];
        let totalPieces = 0;
        let totalEarnings = 0;

        // ==================== KARIGAR ====================
        if (worker.workerType === 'karigar') {
            const assignments = await Assignment.find({
                karigar: workerId,
                status: 'completed',
                ...(Object.keys(dateFilter).length && { assignedDate: dateFilter })
            }).populate('product');

            for (const assign of assignments) {
                const returns = await ProductionReturn.find({ assignment: assign._id });
                const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);

                let size = 'N/A';
                if (assign.sizes && assign.sizes.length > 0) {
                    size = typeof assign.sizes[0] === 'object' ? assign.sizes[0].size || 'N/A' : assign.sizes[0] || 'N/A';
                }

                let productName = 'N/A';
                let rate = 0;
                if (assign.product) {
                    productName = assign.product.name || 'N/A';
                    if (assign.product.sizeRates) {
                        const sizeRate = assign.product.sizeRates.find(sr => sr.size === size);
                        rate = sizeRate?.karigarRate || 0;
                    }
                }

                const amount = totalReturned * rate;
                workDetails.push({
                    date: assign.assignedDate,
                    assignmentId: assign.assignmentId,
                    productName: productName,
                    size: size,
                    pieces: totalReturned,
                    rate: rate,
                    amount: amount
                });
                totalPieces += totalReturned;
                totalEarnings += amount;
            }
        }

        // ==================== PRESSMAN ====================
        else if (worker.workerType === 'pressman') {
            const entries = await PressmanEntry.find({
                pressman: workerId,
                ...(Object.keys(dateFilter).length && { date: dateFilter })
            });

            for (const entry of entries) {
                for (const item of entry.entries) {
                    workDetails.push({
                        date: entry.date,
                        entryNumber: entry.entryNumber,
                        productName: item.productName || 'Unknown',
                        size: item.size || 'N/A',
                        pieces: item.quantity || 0,
                        rate: item.rate || 0,
                        amount: item.amount || 0
                    });
                    totalPieces += item.quantity || 0;
                    totalEarnings += item.amount || 0;
                }
            }
        }

        // ==================== HELPER (UPDATED - Month-wise) ====================
        else if (worker.workerType === 'helper') {
            console.log(`📊 Helper Statement for: ${worker.name}`);

            const monthlyRate = worker.monthlyRate || 0;
            const dailyRate = Math.round(monthlyRate / 26);

            const attendance = await Attendance.find({
                worker: workerId,
                ...(Object.keys(dateFilter).length && { date: dateFilter })
            }).sort({ date: 1 });

            if (attendance.length > 0) {
                // ✅ Group by month
                const monthMap = {};
                for (const att of attendance) {
                    const monthKey = att.date.getFullYear() + '-' + String(att.date.getMonth() + 1).padStart(2, '0');
                    if (!monthMap[monthKey]) {
                        monthMap[monthKey] = [];
                    }
                    monthMap[monthKey].push(att);
                }

                const Packing = require('../models/Packing');

                for (const [monthKey, monthAttendance] of Object.entries(monthMap)) {
                    const [year, month] = monthKey.split('-').map(Number);
                    const monthStart = new Date(year, month - 1, 1);
                    const monthEnd = new Date(year, month, 0);

                    const presentDays = monthAttendance.filter(a => a.status === 'present').length;
                    const halfDays = monthAttendance.filter(a => a.status === 'half-day').length;

                    const workingDays = Math.min(presentDays + (halfDays * 0.5), 26);
                    const monthEarnings = Math.round(workingDays * dailyRate);

                    const isPaid = monthAttendance.every(a => a.monthPaid === true);

                    // ✅ Get packing data
                    let packingData = null;
                    const packing = await Packing.findOne({
                        packingDate: { $gte: monthStart, $lte: monthEnd }
                    });

                    let productName = 'Packing';
                    let size = 'N/A';
                    let pieces = 1;

                    if (packing && packing.entries && packing.entries.length > 0) {
                        const firstEntry = packing.entries[0];
                        productName = firstEntry.productName || 'Packing';
                        size = firstEntry.size || 'N/A';
                        pieces = firstEntry.packedPieces || 1;
                    }

                    // ✅ ADD MONTH FIELDS TO workDetails
                    workDetails.push({
                        date: monthStart,
                        monthKey: monthKey,                    // ✅ ADDED
                        presentDays: presentDays,              // ✅ ADDED
                        halfDays: halfDays,                    // ✅ ADDED
                        days: Math.round(workingDays),         // ✅ ADDED
                        productName: `📅 ${monthKey} - ${productName}`,
                        size: size,
                        pieces: pieces * presentDays,
                        rate: dailyRate,
                        amount: monthEarnings,
                        isPaid: isPaid,                        // ✅ ADDED
                        type: 'month-summary'
                    });

                    totalPieces += pieces * presentDays;
                    totalEarnings += monthEarnings;
                }
            }
        }

        // ==================== CUTTING (UPDATED - Month-wise) ====================
        else if (worker.workerType === 'cutting') {
            console.log(`📊 Cutting Statement for: ${worker.name}`);

            const monthlyRate = worker.monthlyRate || 0;
            const dailyRate = Math.round(monthlyRate / 26);

            const attendance = await Attendance.find({
                worker: workerId,
                ...(Object.keys(dateFilter).length && { date: dateFilter })
            }).sort({ date: 1 });

            if (attendance.length > 0) {
                // ✅ Group by month
                const monthMap = {};
                for (const att of attendance) {
                    const monthKey = att.date.getFullYear() + '-' + String(att.date.getMonth() + 1).padStart(2, '0');
                    if (!monthMap[monthKey]) {
                        monthMap[monthKey] = [];
                    }
                    monthMap[monthKey].push(att);
                }

                const Cutting = require('../models/Cutting');

                for (const [monthKey, monthAttendance] of Object.entries(monthMap)) {
                    const [year, month] = monthKey.split('-').map(Number);
                    const monthStart = new Date(year, month - 1, 1);
                    const monthEnd = new Date(year, month, 0);

                    const presentDays = monthAttendance.filter(a => a.status === 'present').length;
                    const halfDays = monthAttendance.filter(a => a.status === 'half-day').length;

                    const workingDays = Math.min(presentDays + (halfDays * 0.5), 26);
                    const monthEarnings = Math.round(workingDays * dailyRate);

                    const isPaid = monthAttendance.every(a => a.monthPaid === true);

                    // ✅ Get cutting data
                    let cuttingData = null;
                    const cutting = await Cutting.findOne({
                        createdAt: { $gte: monthStart, $lte: monthEnd },
                        cuttingWorker: workerId
                    });

                    let productName = 'Cutting';
                    let size = 'N/A';
                    let pieces = 1;

                    if (cutting) {
                        productName = cutting.productName || 'Cutting';
                        if (cutting.sizes && cutting.sizes.length > 0) {
                            size = cutting.sizes[0].size || 'N/A';
                            pieces = cutting.sizes[0].pieces || 1;
                        }
                    }

                    // ✅ ADD MONTH FIELDS TO workDetails
                    workDetails.push({
                        date: monthStart,
                        monthKey: monthKey,                    // ✅ ADDED
                        presentDays: presentDays,              // ✅ ADDED
                        halfDays: halfDays,                    // ✅ ADDED
                        days: Math.round(workingDays),         // ✅ ADDED
                        productName: `📅 ${monthKey} - ${productName}`,
                        size: size,
                        pieces: pieces * presentDays,
                        rate: dailyRate,
                        amount: monthEarnings,
                        isPaid: isPaid,                        // ✅ ADDED
                        type: 'month-summary'
                    });

                    totalPieces += pieces * presentDays;
                    totalEarnings += monthEarnings;
                }
            }
        }

        // ✅ GET PAYMENTS
        const payments = await Payment.find({
            worker: workerId,
            ...(Object.keys(dateFilter).length && { paymentDate: dateFilter })
        }).sort({ paymentDate: -1 });
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // ✅ GET ADVANCES
        const advances = await PaymentAdvance.find({
            worker: workerId,
            ...(Object.keys(dateFilter).length && { date: dateFilter })
        }).sort({ date: -1 });
        const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);

        const netPayable = totalEarnings - totalPaid - totalAdvances;

        res.render('payments/statement', {
            title: `Statement - ${worker.name}`,
            worker: worker,
            workDetails: workDetails,
            totalPieces: totalPieces,
            totalEarnings: totalEarnings,
            totalPaid: totalPaid,
            totalAdvances: totalAdvances,
            netPayable: netPayable,
            payments: payments,
            advances: advances,
            period: activePeriod,
            fromDate: fromDate || '',
            toDate: toDate || '',
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        console.error('❌ Error loading statement:', error);
        req.flash('error_msg', 'Error loading statement: ' + error.message);
        res.redirect('/payments');
    }
};



// ==================== PRINT STATEMENT ====================
exports.printStatement = async (req, res) => {
    try {
        const { workers, period, fromDate, toDate, _t } = req.query;
        const workerIds = workers ? workers.split(',') : [];

        console.log('📄 ===== PRINT STATEMENT =====');
        console.log('📄 Workers:', workerIds);
        console.log('📅 Period:', period);
        console.log('📅 From Date:', fromDate);
        console.log('📅 To Date:', toDate);

        if (workerIds.length === 0) {
            req.flash('error_msg', 'No workers selected');
            return res.redirect('/payments');
        }

        let dateFilter = {};
        const now = new Date();

        if (fromDate && toDate) {
            dateFilter.$gte = new Date(fromDate);
            dateFilter.$lte = new Date(toDate);
            dateFilter.$lte.setHours(23, 59, 59, 999);
        } else if (period === 'week') {
            const weekStart = getWeekStart(now);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            dateFilter = { $gte: weekStart, $lte: weekEnd };
        } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            monthEnd.setHours(23, 59, 59, 999);
            dateFilter = { $gte: monthStart, $lte: monthEnd };
        }

        const workerData = [];
        for (const id of workerIds) {
            const worker = await Worker.findById(id);
            if (!worker) continue;

            const earnings = await getWorkerEarnings(worker, dateFilter);

            const paymentFilter = {};
            if (Object.keys(dateFilter).length > 0) {
                paymentFilter.paymentDate = dateFilter;
            }
            const payments = await Payment.find({
                worker: worker._id,
                ...paymentFilter
            }).sort({ paymentDate: -1 });
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

            const advanceFilter = {};
            if (Object.keys(dateFilter).length > 0) {
                advanceFilter.date = dateFilter;
            }
            const advances = await PaymentAdvance.find({
                worker: worker._id,
                ...advanceFilter
            }).sort({ date: -1 });
            const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);

            const netPayable = earnings.totalEarnings - totalPaid - totalAdvances;

            workerData.push({
                name: worker.name,
                workerType: worker.workerType,
                phone: worker.phone || 'N/A',
                totalPieces: earnings.totalPieces || 0,
                totalEarnings: earnings.totalEarnings || 0,
                totalPaid: totalPaid || 0,
                totalAdvances: totalAdvances || 0,
                netPayable: netPayable || 0,
                workDetails: earnings.workDetails || [],
                payments: payments || [],
                advances: advances || []
            });
        }

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.render('payments/print-statement', {
            title: 'Payment Statement Print',
            workers: workerData,
            user: req.session.user,
            layout: false
        });
    } catch (error) {
        console.error('❌ Error printing statement:', error);
        req.flash('error_msg', 'Error printing statement: ' + error.message);
        res.redirect('/payments');
    }
};

// ==================== COLLECT PAYMENT ====================
exports.collectPayment = async (req, res) => {
    try {
        const { workers } = req.query;
        const workerIds = workers ? workers.split(',') : [];

        if (workerIds.length === 0) {
            req.flash('error_msg', 'No workers selected');
            return res.redirect('/payments');
        }

        const workerData = [];
        let totalEarnings = 0;
        let totalPaid = 0;
        let totalAdvances = 0;

        for (const id of workerIds) {
            const worker = await Worker.findById(id);
            if (!worker) continue;

            const earnings = await getWorkerEarnings(worker);

            workerData.push({
                name: worker.name,
                workerType: worker.workerType,
                phone: worker.phone || '',
                isActive: worker.isActive,
                totalPieces: earnings.totalPieces || 0,
                totalEarnings: earnings.totalEarnings || 0,
                totalPaid: earnings.totalPaid || 0,
                totalAdvances: earnings.totalAdvances || 0,
                netPayable: earnings.netPayable || 0
            });

            totalEarnings += earnings.totalEarnings || 0;
            totalPaid += earnings.totalPaid || 0;
            totalAdvances += earnings.totalAdvances || 0;
        }

        const netPayable = totalEarnings - totalPaid - totalAdvances;

        res.render('payments/collect-payment', {
            title: 'Collect Payment',
            workers: workerData,
            totalEarnings: totalEarnings,
            totalPaid: totalPaid,
            totalAdvances: totalAdvances,
            netPayable: netPayable,
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        console.error('❌ Error loading collect payment:', error);
        req.flash('error_msg', 'Error loading collect payment: ' + error.message);
        res.redirect('/payments');
    }
};

// ==================== BULK PAYMENT ====================
exports.bulkPayment = async (req, res) => {
    try {
        const { workerIds, amount, paymentMethod, reference, paymentDate, remark } = req.body;

        const ids = Array.isArray(workerIds) ? workerIds : workerIds.split(',');
        const paymentAmount = parseFloat(amount) || 0;

        if (ids.length === 0 || paymentAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid data' });
        }

        let totalPayable = 0;
        for (const id of ids) {
            const worker = await Worker.findById(id);
            if (!worker) continue;
            const earnings = await getWorkerEarnings(worker);
            totalPayable += earnings.netPayable || 0;
        }

        if (paymentAmount > totalPayable) {
            return res.status(400).json({
                success: false,
                error: `Payment amount (₹${paymentAmount}) exceeds total payable (₹${totalPayable})`
            });
        }

        const payments = [];
        let remainingAmount = paymentAmount;

        for (const id of ids) {
            const worker = await Worker.findById(id);
            if (!worker) continue;

            const earnings = await getWorkerEarnings(worker);
            const individualPayable = earnings.netPayable || 0;

            if (individualPayable > 0 && remainingAmount > 0) {
                const payAmount = Math.min(remainingAmount, individualPayable);
                const payment = new Payment({
                    worker: worker._id,
                    workerType: worker.workerType,
                    amount: payAmount,
                    paymentMethod: paymentMethod || 'Cash',
                    reference: reference || '',
                    remark: remark || '',
                    paymentDate: paymentDate || new Date(),
                    createdBy: req.session.user.id,
                    status: 'completed'
                });
                await payment.save();
                payments.push(payment);
                remainingAmount -= payAmount;
            }
        }

        res.json({
            success: true,
            payments: payments,
            message: `₹${paymentAmount} payment recorded for ${ids.length} workers`
        });
    } catch (error) {
        console.error('❌ Error processing bulk payment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =====================================================================
// 3. ADVANCE FUNCTIONS
// =====================================================================

// ==================== GET ADVANCES PAGE ====================
// ==================== GET ADVANCES PAGE ====================
exports.getAdvancesPage = async (req, res) => {
    try {
        const { workerType, status, fromDate, toDate } = req.query;

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
            .populate('worker', 'name workerType phone')
            .sort({ date: -1 });

        const workers = await Worker.find({ isActive: true })
            .select('name workerType');

        const totalAdvances = await PaymentAdvance.countDocuments();
        const pendingAdvances = await PaymentAdvance.find({ status: 'pending' });
        const pendingAmount = pendingAdvances.reduce((sum, a) => sum + a.amount, 0);
        const adjustedAdvances = await PaymentAdvance.find({ status: 'adjusted' });
        const adjustedAmount = adjustedAdvances.reduce((sum, a) => sum + a.adjustedAmount, 0);
        const activeWorkers = await Worker.countDocuments({ isActive: true });

        res.render('payments/advances', {
            title: 'Payment Advance Management',
            advances: advances || [],
            workers: workers || [],
            totalAdvances: totalAdvances || 0,
            pendingAmount: pendingAmount || 0,
            adjustedAmount: adjustedAmount || 0,
            activeWorkers: activeWorkers || 0,
            user: req.session.user,
            currentPage: 'payments',
            // ✅ PASS QUERY TO VIEW
            query: req.query
        });
    } catch (error) {
        console.error('❌ Error loading advances page:', error);
        req.flash('error_msg', 'Error loading advances page: ' + error.message);
        res.redirect('/payments');
    }
};

// ==================== API: GET WORKER ADVANCES ====================
exports.getWorkerAdvances = async (req, res) => {
    try {
        const { workerId } = req.params;

        const advances = await PaymentAdvance.find({
            worker: workerId
        }).sort({ date: -1 });

        const pendingTotal = await PaymentAdvance.getPendingTotal(workerId);

        res.json({
            success: true,
            advances: advances || [],
            pendingTotal: pendingTotal || 0
        });
    } catch (error) {
        console.error('❌ Error fetching advances:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== API: RECORD ADVANCE ====================
exports.recordAdvance = async (req, res) => {
    try {
        const { workerId, workerType, amount, purpose, remark } = req.body;

        console.log('📝 Recording payment advance:', { workerId, amount, purpose });

        if (!workerId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid data' });
        }

        const worker = await Worker.findById(workerId);
        if (!worker) {
            return res.status(404).json({ success: false, error: 'Worker not found' });
        }

        const advance = await PaymentAdvance.create({
            worker: workerId,
            workerType: workerType || worker.workerType,
            amount: parseFloat(amount),
            purpose: purpose || 'General',
            remark: remark || '',
            date: new Date(),
            status: 'pending',
            createdBy: req.session.user.id
        });

        console.log('✅ Payment advance recorded:', advance._id);

        res.json({
            success: true,
            advance: advance,
            message: 'Advance recorded successfully!'
        });
    } catch (error) {
        console.error('❌ Error recording advance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== API: ADJUST ADVANCE ====================
exports.adjustAdvance = async (req, res) => {
    try {
        const { id } = req.params;

        const advance = await PaymentAdvance.findById(id);
        if (!advance) {
            return res.status(404).json({ success: false, error: 'Advance not found' });
        }

        advance.status = 'adjusted';
        advance.adjustedAt = new Date();
        advance.adjustedAmount = advance.amount;
        await advance.save();

        res.json({ success: true, advance });
    } catch (error) {
        console.error('❌ Error adjusting advance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== API: DELETE ADVANCE ====================
exports.deleteAdvance = async (req, res) => {
    try {
        const { id } = req.params;

        const advance = await PaymentAdvance.findByIdAndDelete(id);
        if (!advance) {
            return res.status(404).json({ success: false, error: 'Advance not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting advance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== API: GET RECENT ADVANCES ====================
exports.getRecentAdvances = async (req, res) => {
    try {
        const advances = await PaymentAdvance.find()
            .populate('worker', 'name')
            .sort({ date: -1 })
            .limit(20);
        res.json({ success: true, advances });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

// ==================== API: RECORD PAYMENT ====================
// ==================== API: RECORD PAYMENT ====================
// ==================== API: RECORD PAYMENT ====================
exports.recordPayment = async (req, res) => {
    try {
        const {
            workerId,
            workerType,
            amount,
            paymentMethod,
            reference,
            paymentDate,
            remark,
            adjustAdvance
        } = req.body;

        if (!workerId || !amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid data'
            });
        }

        const worker = await Worker.findById(workerId);
        if (!worker) {
            return res.status(404).json({
                success: false,
                error: 'Worker not found'
            });
        }

        // ✅ Get worker earnings
        const earnings = await getWorkerEarnings(worker);
        const totalEarnings = earnings.totalEarnings;
        const totalPaid = earnings.totalPaid;
        const totalAdvances = earnings.totalAdvances;
        const netPayable = totalEarnings - totalPaid - totalAdvances;
        const totalAllowed = totalEarnings - totalPaid; // Max payment allowed

        // ✅ Allow any amount up to total earnings - total paid
        if (parseFloat(amount) > totalAllowed) {
            return res.status(400).json({
                success: false,
                error: `Payment amount (₹${amount}) exceeds max allowed (₹${totalAllowed})`
            });
        }

        let adjustedAdvanceAmount = 0;
        let adjustedAdvanceIds = [];
        let remainingAmount = parseFloat(amount);

        // ✅ Only adjust advance if checkbox is checked
        if (adjustAdvance === true || adjustAdvance === 'true') {
            // Get pending advances
            const pendingAdvances = await PaymentAdvance.find({
                worker: workerId,
                status: 'pending'
            }).sort({ date: 1 });

            for (const advance of pendingAdvances) {
                if (remainingAmount <= 0) break;

                const adjustAmount = Math.min(advance.amount, remainingAmount);

                advance.status = 'adjusted';
                advance.adjustedAmount = adjustAmount;
                advance.adjustedAt = new Date();
                await advance.save();

                adjustedAdvanceIds.push(advance._id);
                adjustedAdvanceAmount += adjustAmount;
                remainingAmount -= adjustAmount;
            }
        }

        // ✅ Create payment
        const payment = new Payment({
            worker: workerId,
            workerType: workerType || worker.workerType,
            amount: parseFloat(amount),
            paymentMethod: paymentMethod || 'Cash',
            reference: reference || '',
            remark: remark || '',
            paymentDate: paymentDate || new Date(),
            createdBy: req.session.user.id,
            status: 'completed',
            adjustedAdvanceAmount: adjustedAdvanceAmount,
            adjustedAdvanceIds: adjustedAdvanceIds
        });

        await payment.save();

        // ✅ Update advances with payment reference
        if (adjustedAdvanceIds.length > 0) {
            await PaymentAdvance.updateMany(
                { _id: { $in: adjustedAdvanceIds } },
                { adjustedInPayment: payment._id }
            );
        }

        res.json({
            success: true,
            payment: payment,
            adjustedAdvanceAmount: adjustedAdvanceAmount,
            message: `Payment recorded! Adjusted ₹${adjustedAdvanceAmount} from advance.`
        });

    } catch (error) {
        console.error('❌ Error recording payment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==================== API: WORKERS BY TYPE ====================
exports.getWorkersByType = async (req, res) => {
    try {
        const { type } = req.query;
        const workers = await Worker.find({
            workerType: type,
            isActive: true
        }).select('name _id workerType phone');
        res.json({ success: true, workers });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

module.exports = exports;