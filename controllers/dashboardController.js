const Cutting = require('../models/Cutting');
const Packing = require('../models/Packing');
const Bill = require('../models/Bill');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const Finishing = require('../models/Finishing');

exports.getDashboard = async (req, res) => {
  try {
    const totalProduction = await Packing.countDocuments();
    const pendingBills = await Bill.find({ status: { $ne: 'paid' } });
    const totalPendingAmount = pendingBills.reduce((sum, bill) => sum + bill.pendingAmount, 0);
    const totalPayments = await Bill.aggregate([
      { $group: { _id: null, total: { $sum: '$paidAmount' } } }
    ]);
    
    const cuttingLoss = await Cutting.aggregate([
      {
        $lookup: {
          from: 'packings',
          localField: '_id',
          foreignField: 'finishing.productionReturn.assignment.cutting',
          as: 'packed'
        }
      }
    ]);
    
    const workerPerformance = await Assignment.aggregate([
      {
        $group: {
          _id: '$karigar',
          totalGiven: { $sum: '$givenPieces' },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'workers',
          localField: '_id',
          foreignField: '_id',
          as: 'worker'
        }
      }
    ]);
    
    res.render('dashboard/admin', {
      title: 'Dashboard',
      totalProduction,
      pendingBills: pendingBills.length,
      totalPendingAmount,
      totalPayments: totalPayments[0]?.total || 0,
      workerPerformance,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
};

// Add this at the end of the file - Dashboard API Methods

exports.getAdminStats = async (req, res) => {
    try {
        const Packing = require('../models/Packing');
        const Bill = require('../models/Bill');
        const Assignment = require('../models/Assignment');
        const Worker = require('../models/Worker');
        const Cutting = require('../models/Cutting');
        const Payment = require('../models/Payment');
        
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
        const monthlyPacking = await Packing.find({
            packingDate: { $gte: monthStart, $lte: monthEnd }
        });
        const monthlyProduction = monthlyPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        // Yesterday Production for trend
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
        
        // Active Workers & Assignments
        const activeWorkers = await Worker.countDocuments({ isActive: true });
        const activeAssignments = await Assignment.countDocuments({
            status: { $in: ['pending', 'partial'] }
        });
        
        // Production Data for Chart (Last 7 days)
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
        
        // Status Data for Chart
        const totalAssignments = await Assignment.countDocuments();
        const completedAssignments = await Assignment.countDocuments({ status: 'completed' });
        const partialAssignments = await Assignment.countDocuments({ status: 'partial' });
        const pendingAssignments = await Assignment.countDocuments({ status: 'pending' });
        
        const statusData = {
            labels: ['Completed', 'Partial', 'Pending'],
            values: [completedAssignments, partialAssignments, pendingAssignments]
        };
        
        // Recent Activities
        const recentCuttings = await Cutting.find().sort({ createdAt: -1 }).limit(3);
        const recentAssignments = await Assignment.find().sort({ assignedDate: -1 }).limit(3);
        
        const recentActivities = [];
        
        for (const cut of recentCuttings) {
            recentActivities.push({
                type: 'cutting',
                title: `New Cutting: ${cut.cuttingNumber}`,
                description: `${cut.productName} - ${cut.totalPieces} pieces`,
                time: timeAgo(cut.createdAt),
                color: '#4361ee'
            });
        }
        
        for (const assign of recentAssignments) {
            recentActivities.push({
                type: 'assignment',
                title: `Assignment Created: ${assign.assignmentId}`,
                description: `${assign.productName} assigned to karigar`,
                time: timeAgo(assign.assignedDate),
                color: '#f59e0b'
            });
        }
        
        // Recent Transactions (Bills)
        const recentBills = await Bill.find().populate('client', 'name').sort({ billDate: -1 }).limit(5);
        const formattedBills = recentBills.map(b => ({
            clientName: b.client?.name || 'Unknown',
            amount: b.totalAmount,
            date: new Date(b.billDate).toLocaleDateString(),
            status: b.status
        }));
        
        // Top Products (from Packing)
        const allPackings = await Packing.find();
        const productCount = {};
        for (const pack of allPackings) {
            for (const entry of (pack.entries || [])) {
                const name = entry.productName;
                productCount[name] = (productCount[name] || 0) + (entry.packedPieces || 0);
            }
        }
        const topProducts = Object.entries(productCount)
            .map(([name, pieces]) => ({ name, pieces }))
            .sort((a, b) => b.pieces - a.pieces)
            .slice(0, 5);
        
        // Financial Stats
        const allBills = await Bill.find();
        const totalBillsAmount = allBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const collectedAmount = allBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        const monthlyTarget = 10000; // Set your target
        
        res.json({
            todayProduction,
            monthlyProduction,
            productionTrend: productionTrend.toFixed(1),
            pendingBills,
            pendingAmount,
            activeWorkers,
            activeAssignments,
            productionData,
            statusData,
            recentActivities,
            recentBills: formattedBills,
            topProducts,
            totalBillsAmount,
            collectedAmount,
            monthlyTarget
        });
        
    } catch (error) {
        console.error('Dashboard API error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getWorkerStats = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const Worker = require('../models/Worker');
        const Assignment = require('../models/Assignment');
        const ProductionReturn = require('../models/ProductionReturn');
        const Finishing = require('../models/Finishing');
        const Payment = require('../models/Payment');
        
        const worker = await Worker.findOne({ 
            $or: [{ _id: userId }, { userId: userId }]
        });
        
        let stats = {};
        
        if (worker?.workerType === 'karigar') {
            const assignments = await Assignment.find({ karigar: worker._id });
            const returns = await ProductionReturn.find({ karigar: worker._id });
            const payments = await Payment.find({ worker: worker._id });
            
            stats = {
                totalAssignments: assignments.length,
                completedAssignments: assignments.filter(a => a.status === 'completed').length,
                pendingAssignments: assignments.filter(a => a.status === 'pending').length,
                partialAssignments: assignments.filter(a => a.status === 'partial').length,
                totalReturned: returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0),
                totalEarnings: payments.reduce((sum, p) => sum + p.amount, 0),
                weeklyData: []
            };
        } else if (worker?.workerType === 'helper') {
            const finishingEntries = await Finishing.find({ helper: worker._id });
            const payments = await Payment.find({ worker: worker._id });
            
            stats = {
                totalEntries: finishingEntries.length,
                totalReceived: finishingEntries.reduce((sum, f) => sum + (f.receivedPieces || 0), 0),
                totalRejected: finishingEntries.reduce((sum, f) => sum + (f.rejectedPieces || 0), 0),
                totalPassed: finishingEntries.reduce((sum, f) => sum + (f.passedPieces || 0), 0),
                totalEarnings: payments.reduce((sum, p) => sum + p.amount, 0),
                monthlySalary: worker.monthlyRate || 0,
                attendanceInfo: { present: 0, total: 0 }
            };
        } else if (worker?.workerType === 'pressman') {
            const PressmanEntry = require('../models/PressmanEntry');
            const entries = await PressmanEntry.find({ pressman: worker._id });
            const payments = await Payment.find({ worker: worker._id });
            const totalAmount = entries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
            const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);
            
            stats = {
                totalEntries: entries.length,
                todayEntries: entries.filter(e => {
                    const today = new Date().toDateString();
                    return new Date(e.date).toDateString() === today;
                }).length,
                totalQuantity: entries.reduce((sum, e) => sum + (e.totalQuantity || 0), 0),
                totalAmount,
                totalEarnings,
                pendingAmount: totalAmount - totalEarnings,
                weeklyData: []
            };
        } else if (worker?.workerType === 'cutting') {
            const Cutting = require('../models/Cutting');
            const cuttings = await Cutting.find({ cuttingWorker: worker._id });
            
            stats = {
                totalCuttings: cuttings.length,
                todayCuttings: cuttings.filter(c => {
                    const today = new Date().toDateString();
                    return new Date(c.createdAt).toDateString() === today;
                }).length,
                totalPieces: cuttings.reduce((sum, c) => sum + (c.totalPieces || 0), 0),
                monthlySalary: worker.monthlyRate || 0
            };
        }
        
        res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Worker stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Helper function for time ago
function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
};

// Add this at the end of the file - Dashboard API Methods

exports.getAdminStats = async (req, res) => {
    try {
        const Packing = require('../models/Packing');
        const Bill = require('../models/Bill');
        const Assignment = require('../models/Assignment');
        const Worker = require('../models/Worker');
        const Cutting = require('../models/Cutting');
        const Payment = require('../models/Payment');
        
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
        const monthlyPacking = await Packing.find({
            packingDate: { $gte: monthStart, $lte: monthEnd }
        });
        const monthlyProduction = monthlyPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        // Yesterday Production for trend
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
        
        // Active Workers & Assignments
        const activeWorkers = await Worker.countDocuments({ isActive: true });
        const activeAssignments = await Assignment.countDocuments({
            status: { $in: ['pending', 'partial'] }
        });
        
        // Production Data for Chart (Last 7 days)
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
        
        // Status Data for Chart
        const totalAssignments = await Assignment.countDocuments();
        const completedAssignments = await Assignment.countDocuments({ status: 'completed' });
        const partialAssignments = await Assignment.countDocuments({ status: 'partial' });
        const pendingAssignments = await Assignment.countDocuments({ status: 'pending' });
        
        const statusData = {
            labels: ['Completed', 'Partial', 'Pending'],
            values: [completedAssignments, partialAssignments, pendingAssignments]
        };
        
        // Recent Activities
        const recentCuttings = await Cutting.find().sort({ createdAt: -1 }).limit(3);
        const recentAssignments = await Assignment.find().sort({ assignedDate: -1 }).limit(3);
        
        const recentActivities = [];
        
        for (const cut of recentCuttings) {
            recentActivities.push({
                type: 'cutting',
                title: `New Cutting: ${cut.cuttingNumber}`,
                description: `${cut.productName} - ${cut.totalPieces} pieces`,
                time: timeAgo(cut.createdAt),
                color: '#4361ee'
            });
        }
        
        for (const assign of recentAssignments) {
            recentActivities.push({
                type: 'assignment',
                title: `Assignment Created: ${assign.assignmentId}`,
                description: `${assign.productName} assigned to karigar`,
                time: timeAgo(assign.assignedDate),
                color: '#f59e0b'
            });
        }
        
        // Recent Transactions (Bills)
        const recentBills = await Bill.find().populate('client', 'name').sort({ billDate: -1 }).limit(5);
        const formattedBills = recentBills.map(b => ({
            clientName: b.client?.name || 'Unknown',
            amount: b.totalAmount,
            date: new Date(b.billDate).toLocaleDateString(),
            status: b.status
        }));
        
        // Top Products (from Packing)
        const allPackings = await Packing.find();
        const productCount = {};
        for (const pack of allPackings) {
            for (const entry of (pack.entries || [])) {
                const name = entry.productName;
                productCount[name] = (productCount[name] || 0) + (entry.packedPieces || 0);
            }
        }
        const topProducts = Object.entries(productCount)
            .map(([name, pieces]) => ({ name, pieces }))
            .sort((a, b) => b.pieces - a.pieces)
            .slice(0, 5);
        
        // Financial Stats
        const allBills = await Bill.find();
        const totalBillsAmount = allBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const collectedAmount = allBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        const monthlyTarget = 10000; // Set your target
        
        res.json({
            todayProduction,
            monthlyProduction,
            productionTrend: productionTrend.toFixed(1),
            pendingBills,
            pendingAmount,
            activeWorkers,
            activeAssignments,
            productionData,
            statusData,
            recentActivities,
            recentBills: formattedBills,
            topProducts,
            totalBillsAmount,
            collectedAmount,
            monthlyTarget
        });
        
    } catch (error) {
        console.error('Dashboard API error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getWorkerStats = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const Worker = require('../models/Worker');
        const Assignment = require('../models/Assignment');
        const ProductionReturn = require('../models/ProductionReturn');
        const Finishing = require('../models/Finishing');
        const Payment = require('../models/Payment');
        
        const worker = await Worker.findOne({ 
            $or: [{ _id: userId }, { userId: userId }]
        });
        
        let stats = {};
        
        if (worker?.workerType === 'karigar') {
            const assignments = await Assignment.find({ karigar: worker._id });
            const returns = await ProductionReturn.find({ karigar: worker._id });
            const payments = await Payment.find({ worker: worker._id });
            
            stats = {
                totalAssignments: assignments.length,
                completedAssignments: assignments.filter(a => a.status === 'completed').length,
                pendingAssignments: assignments.filter(a => a.status === 'pending').length,
                partialAssignments: assignments.filter(a => a.status === 'partial').length,
                totalReturned: returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0),
                totalEarnings: payments.reduce((sum, p) => sum + p.amount, 0),
                weeklyData: []
            };
        } else if (worker?.workerType === 'helper') {
            const finishingEntries = await Finishing.find({ helper: worker._id });
            const payments = await Payment.find({ worker: worker._id });
            
            stats = {
                totalEntries: finishingEntries.length,
                totalReceived: finishingEntries.reduce((sum, f) => sum + (f.receivedPieces || 0), 0),
                totalRejected: finishingEntries.reduce((sum, f) => sum + (f.rejectedPieces || 0), 0),
                totalPassed: finishingEntries.reduce((sum, f) => sum + (f.passedPieces || 0), 0),
                totalEarnings: payments.reduce((sum, p) => sum + p.amount, 0),
                monthlySalary: worker.monthlyRate || 0,
                attendanceInfo: { present: 0, total: 0 }
            };
        } else if (worker?.workerType === 'pressman') {
            const PressmanEntry = require('../models/PressmanEntry');
            const entries = await PressmanEntry.find({ pressman: worker._id });
            const payments = await Payment.find({ worker: worker._id });
            const totalAmount = entries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
            const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);
            
            stats = {
                totalEntries: entries.length,
                todayEntries: entries.filter(e => {
                    const today = new Date().toDateString();
                    return new Date(e.date).toDateString() === today;
                }).length,
                totalQuantity: entries.reduce((sum, e) => sum + (e.totalQuantity || 0), 0),
                totalAmount,
                totalEarnings,
                pendingAmount: totalAmount - totalEarnings,
                weeklyData: []
            };
        } else if (worker?.workerType === 'cutting') {
            const Cutting = require('../models/Cutting');
            const cuttings = await Cutting.find({ cuttingWorker: worker._id });
            
            stats = {
                totalCuttings: cuttings.length,
                todayCuttings: cuttings.filter(c => {
                    const today = new Date().toDateString();
                    return new Date(c.createdAt).toDateString() === today;
                }).length,
                totalPieces: cuttings.reduce((sum, c) => sum + (c.totalPieces || 0), 0),
                monthlySalary: worker.monthlyRate || 0
            };
        }
        
        res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Worker stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Helper function for time ago
function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}