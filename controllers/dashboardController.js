const Cutting = require('../models/Cutting');
const Packing = require('../models/Packing');
const Bill = require('../models/Bill');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const Finishing = require('../models/Finishing');
const Worker = require('../models/Worker');
const Payment = require('../models/Payment');
const PressmanEntry = require('../models/PressmanEntry');

// ==================== MAIN DASHBOARD ====================
exports.getDashboard = async (req, res) => {
    try {
        const role = req.session.user?.role || 'admin';
        
        // Admin Dashboard
        if (role === 'admin') {
            return res.render('dashboard/admin-new', {
                title: 'Admin Dashboard',
                user: req.session.user,
                currentPage: 'dashboard',
                layout: 'layouts/main'
            });
        }
        
        // Worker Dashboards
        const worker = await Worker.findOne({ 
            $or: [{ _id: req.session.user.workerId }, { userId: req.session.user.id }]
        });
        
        if (!worker) {
            return res.render('dashboard/worker-dashboard', {
                title: 'Worker Dashboard',
                user: req.session.user,
                worker: null,
                layout: 'layouts/main'
            });
        }
        
        // Role-based worker dashboard
        const dashboardData = await getWorkerDashboardData(worker);
        
        return res.render('dashboard/worker-dashboard', {
            title: `${worker.workerType.charAt(0).toUpperCase() + worker.workerType.slice(1)} Dashboard`,
            user: req.session.user,
            worker: worker,
            stats: dashboardData,
            layout: 'layouts/main'
        });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error_msg', 'Error loading dashboard');
        res.redirect('/dashboard');
    }
};

// ==================== ADMIN STATS API ====================
exports.getAdminStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Today's Production
        const todayPacking = await Packing.find({
            packingDate: { $gte: today, $lt: tomorrow }
        });
        const todayProduction = todayPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        // Monthly Production
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        const monthlyPacking = await Packing.find({
            packingDate: { $gte: monthStart, $lte: monthEnd }
        });
        const monthlyProduction = monthlyPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        // Yesterday Production
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
        const yesterdayPacking = await Packing.find({
            packingDate: { $gte: yesterday, $lt: yesterdayEnd }
        });
        const yesterdayProduction = yesterdayPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        let productionTrend = 0;
        if (yesterdayProduction > 0) {
            productionTrend = ((todayProduction - yesterdayProduction) / yesterdayProduction) * 100;
        }
        
        // Pending Bills
        const pendingBillsList = await Bill.find({ status: { $ne: 'paid' } });
        const pendingBills = pendingBillsList.length;
        const pendingAmount = pendingBillsList.reduce((sum, b) => sum + (b.pendingAmount || 0), 0);
        
        // Active Workers
        const activeWorkers = await Worker.countDocuments({ isActive: true });
        const workerBreakdown = {
            karigar: await Worker.countDocuments({ workerType: 'karigar', isActive: true }),
            pressman: await Worker.countDocuments({ workerType: 'pressman', isActive: true }),
            helper: await Worker.countDocuments({ workerType: 'helper', isActive: true }),
            cutting: await Worker.countDocuments({ workerType: 'cutting', isActive: true })
        };
        
        // Active Assignments
        const activeAssignments = await Assignment.countDocuments({
            status: { $in: ['pending', 'partial'] }
        });
        
        // Production Data (Last 7 days)
        const productionData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            
            const dayPacking = await Packing.find({
                packingDate: { $gte: date, $lt: nextDay }
            });
            const dayTotal = dayPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
            
            productionData.push({
                label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
                value: dayTotal
            });
        }
        
        // Assignment Status
        const totalAssignments = await Assignment.countDocuments();
        const completedAssignments = await Assignment.countDocuments({ status: 'completed' });
        const partialAssignments = await Assignment.countDocuments({ status: 'partial' });
        const pendingAssignments = await Assignment.countDocuments({ status: 'pending' });
        
        const statusData = {
            labels: ['Completed', 'Partial', 'Pending'],
            values: [completedAssignments, partialAssignments, pendingAssignments]
        };
        
        // Worker Performance
        const workerPerformance = await Assignment.aggregate([
            {
                $match: { status: 'completed' }
            },
            {
                $group: {
                    _id: '$karigar',
                    totalGiven: { $sum: '$givenPieces' },
                    totalReturned: { $sum: '$returnedPieces' }
                }
            },
            {
                $lookup: {
                    from: 'workers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'worker'
                }
            },
            {
                $unwind: {
                    path: '$worker',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    workerName: '$worker.name',
                    workerType: '$worker.workerType',
                    totalGiven: 1,
                    totalReturned: 1,
                    efficiency: {
                        $cond: [
                            { $eq: ['$totalGiven', 0] },
                            0,
                            { $multiply: [{ $divide: ['$totalReturned', '$totalGiven'] }, 100] }
                        ]
                    }
                }
            },
            {
                $sort: { efficiency: -1 }
            },
            {
                $limit: 5
            }
        ]);
        
        // Recent Activities
        const recentActivities = await getRecentActivities();
        
        // Recent Bills
        const recentBills = await Bill.find()
            .populate('client', 'name')
            .sort({ billDate: -1 })
            .limit(5);
        
        const formattedBills = recentBills.map(b => ({
            billNumber: b.billNumber,
            clientName: b.client?.name || 'Unknown',
            amount: b.totalAmount,
            date: new Date(b.billDate).toLocaleDateString(),
            status: b.status
        }));
        
        // Top Products
        const topProducts = await getTopProducts();
        
        // Financial Stats
        const allBills = await Bill.find();
        const totalBillsAmount = allBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const collectedAmount = allBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        const monthlyTarget = 500000;
        
        res.json({
            todayProduction,
            monthlyProduction,
            productionTrend: productionTrend.toFixed(1),
            pendingBills,
            pendingAmount,
            activeWorkers,
            workerBreakdown,
            activeAssignments,
            productionData,
            statusData,
            workerPerformance,
            recentActivities,
            recentBills: formattedBills,
            topProducts,
            totalBillsAmount,
            collectedAmount,
            monthlyTarget,
            collectionPercentage: totalBillsAmount > 0 ? ((collectedAmount / totalBillsAmount) * 100).toFixed(1) : 0
        });
        
    } catch (error) {
        console.error('Dashboard API error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== WORKER STATS API ====================
exports.getWorkerStats = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const worker = await Worker.findOne({ 
            $or: [{ _id: userId }, { userId: userId }]
        });
        
        if (!worker) {
            return res.status(404).json({ success: false, error: 'Worker not found' });
        }
        
        const stats = await getWorkerDashboardData(worker);
        res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Worker stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== HELPER FUNCTIONS ====================

async function getWorkerDashboardData(worker) {
    const stats = {
        workerType: worker.workerType,
        name: worker.name,
        monthlyRate: worker.monthlyRate || 0,
        today: 0,
        week: 0,
        month: 0,
        total: 0,
        pending: 0,
        completed: 0,
        earnings: 0,
        recentActivities: []
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    if (worker.workerType === 'karigar') {
        const assignments = await Assignment.find({ karigar: worker._id });
        const returns = await ProductionReturn.find({ karigar: worker._id });
        const payments = await Payment.find({ worker: worker._id });
        
        stats.total = assignments.length;
        stats.completed = assignments.filter(a => a.status === 'completed').length;
        stats.pending = assignments.filter(a => a.status === 'pending' || a.status === 'partial').length;
        stats.earnings = payments.reduce((sum, p) => sum + p.amount, 0);
        stats.totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
        stats.totalGiven = assignments.reduce((sum, a) => sum + (a.givenPieces || 0), 0);
        
        // Recent assignments
        const recentAssign = await Assignment.find({ karigar: worker._id })
            .sort({ assignedDate: -1 })
            .limit(5);
        stats.recentActivities = recentAssign.map(a => ({
            type: 'assignment',
            title: a.assignmentId,
            description: `${a.productName} - ${a.givenPieces} pieces`,
            time: timeAgo(a.assignedDate),
            status: a.status
        }));
        
    } else if (worker.workerType === 'pressman') {
        const entries = await PressmanEntry.find({ pressman: worker._id });
        const payments = await Payment.find({ worker: worker._id });
        
        stats.total = entries.length;
        stats.today = entries.filter(e => new Date(e.date) >= today).length;
        stats.totalQuantity = entries.reduce((sum, e) => sum + (e.totalQuantity || 0), 0);
        stats.totalAmount = entries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
        stats.earnings = payments.reduce((sum, p) => sum + p.amount, 0);
        stats.pendingAmount = stats.totalAmount - stats.earnings;
        
        const recentEntries = await PressmanEntry.find({ pressman: worker._id })
            .sort({ date: -1 })
            .limit(5);
        stats.recentActivities = recentEntries.map(e => ({
            type: 'pressman',
            title: e.entryNumber,
            description: `${e.totalQuantity} pieces - ₹${e.totalAmount}`,
            time: timeAgo(e.date),
            status: e.status
        }));
        
    } else if (worker.workerType === 'helper') {
        const finishingEntries = await Finishing.find({ helper: worker._id });
        const payments = await Payment.find({ worker: worker._id });
        
        stats.total = finishingEntries.length;
        stats.today = finishingEntries.filter(e => new Date(e.createdAt) >= today).length;
        stats.totalReceived = finishingEntries.reduce((sum, f) => sum + (f.receivedPieces || 0), 0);
        stats.totalRejected = finishingEntries.reduce((sum, f) => sum + (f.rejectedPieces || 0), 0);
        stats.totalPassed = finishingEntries.reduce((sum, f) => sum + (f.passedPieces || 0), 0);
        stats.earnings = payments.reduce((sum, p) => sum + p.amount, 0);
        
        const recentFinishing = await Finishing.find({ helper: worker._id })
            .sort({ createdAt: -1 })
            .limit(5);
        stats.recentActivities = recentFinishing.map(f => ({
            type: 'finishing',
            title: `Finishing Entry`,
            description: `${f.passedPieces} passed out of ${f.receivedPieces}`,
            time: timeAgo(f.createdAt),
            status: f.status
        }));
        
    } else if (worker.workerType === 'cutting') {
        const cuttings = await Cutting.find({ cuttingWorker: worker._id });
        const payments = await Payment.find({ worker: worker._id });
        
        stats.total = cuttings.length;
        stats.today = cuttings.filter(c => new Date(c.createdAt) >= today).length;
        stats.totalPieces = cuttings.reduce((sum, c) => sum + (c.totalPieces || 0), 0);
        stats.earnings = payments.reduce((sum, p) => sum + p.amount, 0);
        stats.monthlySalary = worker.monthlyRate || 0;
        
        const recentCuttings = await Cutting.find({ cuttingWorker: worker._id })
            .sort({ createdAt: -1 })
            .limit(5);
        stats.recentActivities = recentCuttings.map(c => ({
            type: 'cutting',
            title: c.cuttingNumber,
            description: `${c.productName} - ${c.totalPieces} pieces`,
            time: timeAgo(c.createdAt),
            status: c.status
        }));
    }
    
    return stats;
}

async function getRecentActivities() {
    const activities = [];
    
    // Recent Cuttings
    const recentCuttings = await Cutting.find()
        .sort({ createdAt: -1 })
        .limit(3);
    for (const cut of recentCuttings) {
        activities.push({
            type: 'cutting',
            title: `New Cutting: ${cut.cuttingNumber}`,
            description: `${cut.productName} - ${cut.totalPieces} pieces`,
            time: timeAgo(cut.createdAt),
            color: '#4361ee'
        });
    }
    
    // Recent Assignments
    const recentAssignments = await Assignment.find()
        .sort({ assignedDate: -1 })
        .limit(3);
    for (const assign of recentAssignments) {
        activities.push({
            type: 'assignment',
            title: `Assignment: ${assign.assignmentId}`,
            description: `${assign.productName} - ${assign.givenPieces} pieces`,
            time: timeAgo(assign.assignedDate),
            color: '#f59e0b'
        });
    }
    
    // Recent Bills
    const recentBills = await Bill.find()
        .sort({ billDate: -1 })
        .limit(3);
    for (const bill of recentBills) {
        activities.push({
            type: 'bill',
            title: `Bill: ${bill.billNumber}`,
            description: `₹${bill.totalAmount} - ${bill.status}`,
            time: timeAgo(bill.billDate),
            color: '#22c55e'
        });
    }
    
    // Sort by time (most recent first)
    activities.sort((a, b) => {
        const timeA = parseInt(a.time) || 0;
        const timeB = parseInt(b.time) || 0;
        return timeA - timeB;
    });
    
    return activities.slice(0, 8);
}

async function getTopProducts() {
    const allPackings = await Packing.find();
    const productCount = {};
    
    for (const pack of allPackings) {
        for (const entry of (pack.entries || [])) {
            const name = entry.productName;
            productCount[name] = (productCount[name] || 0) + (entry.packedPieces || 0);
        }
    }
    
    return Object.entries(productCount)
        .map(([name, pieces]) => ({ name, pieces }))
        .sort((a, b) => b.pieces - a.pieces)
        .slice(0, 5);
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ==================== EXPORT ====================
module.exports = exports;