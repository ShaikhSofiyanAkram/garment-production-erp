const Worker = require('../models/Worker');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const PressmanEntry = require('../models/PressmanEntry');
const PressmanProduct = require('../models/PressmanProduct');
const Payment = require('../models/Payment');
const Advance = require('../models/Advance');
const Attendance = require('../models/Attendance');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// ==================== ✅ GET PRODUCT BY NAME AND SIZE ====================
async function findProductAndRate(productName, size) {
    console.log(`  🔍 Searching: "${productName}" | Size: "${size}"`);
    
    if (!productName || productName === 'N/A') {
        console.log(`  ⚠️ No product name provided`);
        return { product: null, rate: 0 };
    }
    
    // ✅ Try exact match first
    let product = await Product.findOne({ 
        name: { $regex: new RegExp(`^${productName}$`, 'i') } 
    });
    
    if (!product) {
        // ✅ Try partial match
        product = await Product.findOne({ 
            name: { $regex: new RegExp(productName, 'i') } 
        });
    }
    
    if (!product) {
        // ✅ Try by removing common words
        const cleanName = productName.replace(/full|half|kids|mens|women|regular|slim/g, '').trim();
        if (cleanName && cleanName !== productName) {
            product = await Product.findOne({ 
                name: { $regex: new RegExp(cleanName, 'i') } 
            });
        }
    }
    
    if (!product) {
        console.log(`  ❌ No product found for: "${productName}"`);
        return { product: null, rate: 0 };
    }
    
    console.log(`  ✅ Product found: ${product.name} (${product.category})`);
    
    // ✅ Get karigar rate for the size
    let rate = 0;
    if (product.sizeRates && product.sizeRates.length > 0) {
        console.log(`  📊 SizeRates:`, product.sizeRates.map(sr => `${sr.size}: ₹${sr.karigarRate}`).join(', '));
        
        // Try exact match
        let sizeRate = product.sizeRates.find(sr => sr.size === size);
        
        // Try case-insensitive
        if (!sizeRate) {
            sizeRate = product.sizeRates.find(sr => 
                sr.size.toLowerCase() === size.toLowerCase()
            );
        }
        
        // Try partial match
        if (!sizeRate) {
            sizeRate = product.sizeRates.find(sr => 
                size.includes(sr.size) || sr.size.includes(size)
            );
        }
        
        // Try numeric match
        if (!sizeRate) {
            const sizeNum = parseInt(size);
            if (!isNaN(sizeNum)) {
                sizeRate = product.sizeRates.find(sr => {
                    const srNum = parseInt(sr.size);
                    return !isNaN(srNum) && srNum === sizeNum;
                });
            }
        }
        
        if (sizeRate) {
            rate = sizeRate.karigarRate || 0;
            console.log(`  ✅ Rate found: ${sizeRate.size} → ₹${rate}`);
        } else {
            // Use first available rate
            rate = product.sizeRates[0]?.karigarRate || 0;
            console.log(`  ⚠️ No match for "${size}", using first rate: ₹${rate}`);
        }
    }
    
    return { product, rate };
}

// ==================== PAYMENT DASHBOARD ====================
exports.getPaymentDashboard = async (req, res) => {
    try {
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        const pressmans = await Worker.find({ workerType: 'pressman', isActive: true });
        const helpers = await Worker.find({ workerType: 'helper', isActive: true });
        const cuttings = await Worker.find({ workerType: 'cutting', isActive: true });
        
        const karigarEarnings = await calculateKarigarEarnings(karigars);
        const pressmanEarnings = await calculatePressmanEarnings(pressmans);
        const helperEarnings = await calculateHelperEarnings(helpers);
        const cuttingEarnings = await calculateCuttingEarnings(cuttings);
        
        const totalWorkers = await Worker.countDocuments({ isActive: true });
        
        const pendingAdvances = await Advance.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalPendingAdvances = pendingAdvances[0]?.total || 0;
        
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const monthlyPayments = await Payment.aggregate([
            { $match: { paymentDate: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalMonthlyPayments = monthlyPayments[0]?.total || 0;
        
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
            activeKarigars: karigars?.length || 0,
            activePressmans: pressmans?.length || 0,
            activeHelpers: helpers?.length || 0,
            activeCuttings: cuttings?.length || 0,
            pendingAdvances: totalPendingAdvances || 0,
            monthlyPayments: totalMonthlyPayments || 0,
            totalPaidThisMonth: totalMonthlyPayments || 0,
            user: req.session.user,
            currentPage: 'payments',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('❌ Error loading payment dashboard:', error);
        req.flash('error_msg', 'Error loading payment dashboard: ' + error.message);
        res.redirect('/dashboard');
    }
};

// ==================== ✅ CALCULATE KARIGAR EARNINGS (FIXED) ====================
async function calculateKarigarEarnings(karigars) {
    const results = [];
    
    for (const karigar of karigars) {
        try {
            console.log(`\n📊 ========== ${karigar.name} ==========`);
            
            // ✅ Get assignments
            const assignments = await Assignment.find({
                karigar: karigar._id,
                status: 'completed'
            });
            
            console.log(`📦 Assignments: ${assignments.length}`);
            
            let totalPieces = 0;
            let totalEarnings = 0;
            let workDetails = [];
            
            for (const assign of assignments) {
                console.log(`\n  📄 ${assign.assignmentId}`);
                
                // ✅ Get production returns
                const returns = await ProductionReturn.find({ assignment: assign._id });
                const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
                console.log(`    Returned: ${totalReturned} pieces`);
                
                // ✅ Get product name from assignment
                let productName = 'N/A';
                let size = 'N/A';
                let rate = 0;
                
                // ✅ Get product name - try multiple sources
                if (assign.productName) {
                    productName = assign.productName;
                } else if (assign.product && assign.product.name) {
                    productName = assign.product.name;
                } else if (assign.productId) {
                    // Try to find product by ID
                    try {
                        const product = await Product.findById(assign.productId);
                        if (product) productName = product.name;
                    } catch (err) {}
                }
                
                // ✅ Get size
                if (assign.sizes && assign.sizes.length > 0) {
                    if (typeof assign.sizes[0] === 'object') {
                        size = assign.sizes[0].size || 'N/A';
                    } else {
                        size = assign.sizes[0] || 'N/A';
                    }
                }
                
                console.log(`    Product: "${productName}", Size: "${size}"`);
                
                // ✅ Find product and rate from Product system
                if (productName !== 'N/A') {
                    const result = await findProductAndRate(productName, size);
                    rate = result.rate;
                    if (result.product) {
                        productName = result.product.name; // Use exact product name
                    }
                } else {
                    console.log(`  ⚠️ No product name available`);
                }
                
                const amount = totalReturned * rate;
                console.log(`    ✅ Rate: ₹${rate}, Amount: ₹${amount}`);
                
                workDetails.push({
                    assignmentId: assign.assignmentId,
                    productName: productName,
                    size: size,
                    totalReturned: totalReturned,
                    rate: rate,
                    amount: amount
                });
                
                totalPieces += totalReturned;
                totalEarnings += amount;
            }
            
            // ✅ Get payments
            const payments = await Payment.find({ worker: karigar._id });
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            // ✅ Get advances
            const advances = await Advance.find({ 
                worker: karigar._id,
                status: 'pending'
            });
            const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
            
            const netPayable = totalEarnings - totalPaid - totalAdvances;
            
            console.log(`\n✅ ${karigar.name}: ${totalPieces} pieces, ₹${totalEarnings} earnings, ₹${netPayable} net`);
            console.log(`========================================\n`);
            
            results.push({
                worker: karigar,
                totalPieces: totalPieces,
                totalEarnings: totalEarnings,
                totalPaid: totalPaid,
                totalAdvances: totalAdvances,
                netPayable: netPayable,
                workDetails: workDetails
            });
            
        } catch (error) {
            console.error(`❌ Error calculating earnings for ${karigar.name}:`, error);
            results.push({
                worker: karigar,
                totalPieces: 0,
                totalEarnings: 0,
                totalPaid: 0,
                totalAdvances: 0,
                netPayable: 0,
                workDetails: []
            });
        }
    }
    
    return results;
}

// ==================== CALCULATE PRESSMAN EARNINGS ====================
async function calculatePressmanEarnings(pressmans) {
    const results = [];
    
    for (const pressman of pressmans) {
        try {
            const entries = await PressmanEntry.find({ 
                pressman: pressman._id 
            });
            
            let totalPieces = 0;
            let totalEarnings = 0;
            let workDetails = [];
            
            for (const entry of entries) {
                for (const item of entry.entries) {
                    const quantity = item.quantity || 0;
                    const rate = item.rate || 0;
                    const amount = quantity * rate;
                    
                    workDetails.push({
                        entryNumber: entry.entryNumber,
                        productName: item.productName || 'Unknown',
                        size: item.size || 'N/A',
                        quantity: quantity,
                        rate: rate,
                        amount: amount
                    });
                    
                    totalPieces += quantity;
                    totalEarnings += amount;
                }
            }
            
            const payments = await Payment.find({ worker: pressman._id });
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            const advances = await Advance.find({ 
                worker: pressman._id,
                status: 'pending'
            });
            const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
            
            const netPayable = totalEarnings - totalPaid - totalAdvances;
            
            results.push({
                worker: pressman,
                totalPieces: totalPieces,
                totalEarnings: totalEarnings,
                totalPaid: totalPaid,
                totalAdvances: totalAdvances,
                netPayable: netPayable,
                workDetails: workDetails
            });
            
        } catch (error) {
            console.error(`❌ Error calculating earnings for ${pressman.name}:`, error);
            results.push({
                worker: pressman,
                totalPieces: 0,
                totalEarnings: 0,
                totalPaid: 0,
                totalAdvances: 0,
                netPayable: 0,
                workDetails: []
            });
        }
    }
    
    return results;
}

// ==================== CALCULATE HELPER EARNINGS ====================
async function calculateHelperEarnings(helpers) {
    const results = [];
    for (const helper of helpers) {
        try {
            const attendance = await Attendance.find({ worker: helper._id });
            const presentDays = attendance.filter(a => a.status === 'present').length;
            const dailyRate = (helper.monthlyRate || 0) / 26;
            const workingDays = Math.min(presentDays, 26);
            const totalEarnings = workingDays * dailyRate;
            
            const payments = await Payment.find({ worker: helper._id });
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            const advances = await Advance.find({ 
                worker: helper._id,
                status: 'pending'
            });
            const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
            
            const netPayable = totalEarnings - totalPaid - totalAdvances;
            
            results.push({
                worker: helper,
                totalPieces: 0,
                totalEarnings: totalEarnings,
                totalPaid: totalPaid,
                totalAdvances: totalAdvances,
                netPayable: netPayable,
                workDetails: []
            });
        } catch (error) {
            console.error(`❌ Error calculating earnings for ${helper.name}:`, error);
            results.push({
                worker: helper,
                totalPieces: 0,
                totalEarnings: 0,
                totalPaid: 0,
                totalAdvances: 0,
                netPayable: 0,
                workDetails: []
            });
        }
    }
    return results;
}

// ==================== CALCULATE CUTTING EARNINGS ====================
async function calculateCuttingEarnings(cuttings) {
    const results = [];
    for (const cutting of cuttings) {
        try {
            const attendance = await Attendance.find({ worker: cutting._id });
            const presentDays = attendance.filter(a => a.status === 'present').length;
            const dailyRate = (cutting.monthlyRate || 0) / 26;
            const workingDays = Math.min(presentDays, 26);
            const totalEarnings = workingDays * dailyRate;
            
            const payments = await Payment.find({ worker: cutting._id });
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            const advances = await Advance.find({ 
                worker: cutting._id,
                status: 'pending'
            });
            const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
            
            const netPayable = totalEarnings - totalPaid - totalAdvances;
            
            results.push({
                worker: cutting,
                totalPieces: 0,
                totalEarnings: totalEarnings,
                totalPaid: totalPaid,
                totalAdvances: totalAdvances,
                netPayable: netPayable,
                workDetails: []
            });
        } catch (error) {
            console.error(`❌ Error calculating earnings for ${cutting.name}:`, error);
            results.push({
                worker: cutting,
                totalPieces: 0,
                totalEarnings: 0,
                totalPaid: 0,
                totalAdvances: 0,
                netPayable: 0,
                workDetails: []
            });
        }
    }
    return results;
}

// ==================== ✅ WORKER DETAIL (COMPLETE FIX) ====================
exports.getWorkerDetail = async (req, res) => {
    try {
        const workerId = req.params.id;
        const worker = await Worker.findById(workerId);
        
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }
        
        let workDetails = [];
        let totalPieces = 0;
        let totalEarnings = 0;
        let payments = [];
        let advances = [];
        
        // ==================== KARIGAR ====================
        if (worker.workerType === 'karigar') {
            console.log(`\n📊 ========== ${worker.name} DETAIL ==========`);
            
            const assignments = await Assignment.find({
                karigar: workerId,
                status: 'completed'
            });
            
            console.log(`📦 Assignments: ${assignments.length}`);
            
            for (const assign of assignments) {
                console.log(`\n  📄 ${assign.assignmentId}`);
                
                // ✅ Get production returns
                const returns = await ProductionReturn.find({ assignment: assign._id });
                const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
                console.log(`    Returned: ${totalReturned} pieces`);
                
                // ✅ Get product name
                let productName = 'N/A';
                let size = 'N/A';
                let rate = 0;
                
                // Try to get product name from multiple sources
                if (assign.productName) {
                    productName = assign.productName;
                } else if (assign.product && assign.product.name) {
                    productName = assign.product.name;
                }
                
                // Get size
                if (assign.sizes && assign.sizes.length > 0) {
                    if (typeof assign.sizes[0] === 'object') {
                        size = assign.sizes[0].size || 'N/A';
                    } else {
                        size = assign.sizes[0] || 'N/A';
                    }
                }
                
                console.log(`    Product: "${productName}", Size: "${size}"`);
                
                // ✅ Find product and rate from Product system
                if (productName !== 'N/A') {
                    const result = await findProductAndRate(productName, size);
                    rate = result.rate;
                    if (result.product) {
                        productName = result.product.name;
                    }
                }
                
                const amount = totalReturned * rate;
                console.log(`    ✅ Rate: ₹${rate}, Amount: ₹${amount}`);
                
                workDetails.push({
                    date: assign.assignedDate,
                    assignmentId: assign.assignmentId,
                    productName: productName,
                    size: size,
                    pieces: totalReturned,
                    rate: rate,
                    amount: amount,
                    status: 'completed'
                });
                
                totalPieces += totalReturned;
                totalEarnings += amount;
            }
            
            console.log(`\n✅ Total: ${totalPieces} pieces, ₹${totalEarnings} earnings`);
            console.log(`========================================\n`);
        }
        
        // ==================== PRESSMAN ====================
        else if (worker.workerType === 'pressman') {
            console.log(`\n📊 ========== ${worker.name} (Pressman) ==========`);
            
            const entries = await PressmanEntry.find({ pressman: workerId })
                .sort({ date: -1 });
            
            console.log(`📦 Entries: ${entries.length}`);
            
            for (const entry of entries) {
                for (const item of entry.entries) {
                    workDetails.push({
                        date: entry.date,
                        assignmentId: entry.entryNumber,
                        productName: item.productName || 'Unknown',
                        size: item.size || 'N/A',
                        pieces: item.quantity || 0,
                        rate: item.rate || 0,
                        amount: item.amount || 0,
                        status: entry.status || 'pending'
                    });
                    totalPieces += item.quantity || 0;
                    totalEarnings += item.amount || 0;
                }
            }
        }
        
        // ==================== HELPER ====================
        else if (worker.workerType === 'helper') {
            const attendance = await Attendance.find({ worker: workerId });
            const presentDays = attendance.filter(a => a.status === 'present').length;
            const dailyRate = (worker.monthlyRate || 0) / 26;
            const workingDays = Math.min(presentDays, 26);
            totalEarnings = workingDays * dailyRate;
            
            for (const att of attendance) {
                workDetails.push({
                    date: att.date,
                    assignmentId: 'Attendance',
                    productName: 'Monthly Salary',
                    size: '-',
                    pieces: 1,
                    rate: dailyRate,
                    amount: att.status === 'present' ? dailyRate : 0,
                    status: att.status
                });
            }
        }
        
        // ==================== CUTTING ====================
        else if (worker.workerType === 'cutting') {
            const attendance = await Attendance.find({ worker: workerId });
            const presentDays = attendance.filter(a => a.status === 'present').length;
            const dailyRate = (worker.monthlyRate || 0) / 26;
            const workingDays = Math.min(presentDays, 26);
            totalEarnings = workingDays * dailyRate;
            
            for (const att of attendance) {
                workDetails.push({
                    date: att.date,
                    assignmentId: 'Attendance',
                    productName: 'Monthly Salary',
                    size: '-',
                    pieces: 1,
                    rate: dailyRate,
                    amount: att.status === 'present' ? dailyRate : 0,
                    status: att.status
                });
            }
        }
        
        // ==================== GET PAYMENTS & ADVANCES ====================
        payments = await Payment.find({ worker: workerId }).sort({ paymentDate: -1 });
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        advances = await Advance.find({ worker: workerId }).sort({ date: -1 });
        const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
        
        const netPayable = totalEarnings - totalPaid - totalAdvances;
        
        res.render('payments/worker-detail', {
            title: `${worker.name} - Payment Details`,
            worker: worker,
            workDetails: workDetails,
            totalPieces: totalPieces,
            totalEarnings: totalEarnings,
            totalPaid: totalPaid,
            totalAdvances: totalAdvances,
            netPayable: netPayable,
            payments: payments,
            advances: advances,
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
exports.getWorkerStatement = async (req, res) => {
    try {
        const workerId = req.params.id;
        const { period, fromDate, toDate } = req.query;
        
        const worker = await Worker.findById(workerId);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }
        
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
        } else if (period === 'custom' && fromDate && toDate) {
            dateFilter = { 
                $gte: new Date(fromDate), 
                $lte: new Date(toDate) 
            };
        }
        
        let workDetails = [];
        let totalPieces = 0;
        let totalEarnings = 0;
        
        if (worker.workerType === 'karigar') {
            const assignments = await Assignment.find({
                karigar: workerId,
                status: 'completed',
                ...(Object.keys(dateFilter).length && { assignedDate: dateFilter })
            });
            
            for (const assign of assignments) {
                const returns = await ProductionReturn.find({ assignment: assign._id });
                const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
                
                let productName = 'N/A';
                let size = 'N/A';
                let rate = 0;
                
                if (assign.productName) productName = assign.productName;
                if (assign.sizes && assign.sizes.length > 0) {
                    size = typeof assign.sizes[0] === 'object' ? assign.sizes[0].size || 'N/A' : assign.sizes[0] || 'N/A';
                }
                
                if (productName !== 'N/A') {
                    const result = await findProductAndRate(productName, size);
                    rate = result.rate;
                    if (result.product) productName = result.product.name;
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
        } else if (worker.workerType === 'pressman') {
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
        
        const payments = await Payment.find({
            worker: workerId,
            ...(Object.keys(dateFilter).length && { paymentDate: dateFilter })
        }).sort({ paymentDate: -1 });
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const advances = await Advance.find({
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
            period: period || 'all',
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        console.error('❌ Error loading statement:', error);
        req.flash('error_msg', 'Error loading statement');
        res.redirect('/payments');
    }
};

// ==================== API FUNCTIONS ====================
exports.getWorkersByType = async (req, res) => {
    try {
        const { type } = req.query;
        const workers = await Worker.find({
            workerType: type,
            isActive: true
        }).select('name _id workerType');
        res.json({ success: true, workers });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

exports.recordAdvance = async (req, res) => {
    try {
        const { workerId, workerType, amount, purpose, remark } = req.body;
        
        if (!workerId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid data' });
        }
        
        const advance = await Advance.create({
            worker: workerId,
            workerType: workerType || 'karigar',
            amount: parseFloat(amount),
            purpose: purpose || 'General',
            remark: remark || '',
            date: new Date(),
            status: 'pending',
            createdBy: req.session.user.id
        });
        
        res.json({ success: true, advance });
    } catch (error) {
        console.error('❌ Error recording advance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getRecentAdvances = async (req, res) => {
    try {
        const advances = await Advance.find()
            .populate('worker', 'name')
            .sort({ date: -1 })
            .limit(20);
        res.json({ success: true, advances });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

exports.recordPayment = async (req, res) => {
    try {
        const { workerId, workerType, amount, paymentMethod, reference, paymentDate, remark } = req.body;
        
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
        
        const payment = new Payment({
            worker: workerId,
            workerType: workerType || worker.workerType,
            amount: parseFloat(amount),
            paymentMethod: paymentMethod || 'Cash',
            reference: reference || '',
            remark: remark || '',
            paymentDate: paymentDate || new Date(),
            createdBy: req.session.user.id,
            status: 'completed'
        });
        
        await payment.save();
        
        res.json({
            success: true,
            payment: payment,
            message: 'Payment recorded successfully!'
        });
        
    } catch (error) {
        console.error('❌ Error recording payment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = exports;