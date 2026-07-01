const Cutting = require('../models/Cutting');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const Finishing = require('../models/Finishing');
const Packing = require('../models/Packing');
const Bill = require('../models/Bill');
const Worker = require('../models/Worker');

// Get admin dashboard stats
exports.getAdminStats = async (req, res) => {
    try {
        // Today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Month date range
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        // Get today's production (packing pieces)
        const todayPacking = await Packing.find({
            packingDate: { $gte: today, $lt: tomorrow }
        });
        const todayProduction = todayPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        // Get yesterday's production for trend
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
        const yesterdayPacking = await Packing.find({
            packingDate: { $gte: yesterday, $lt: yesterdayEnd }
        });
        const yesterdayProduction = yesterdayPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        // Calculate trend percentage
        let productionTrend = 0;
        if (yesterdayProduction > 0) {
            productionTrend = ((todayProduction - yesterdayProduction) / yesterdayProduction) * 100;
        }
        
        // Monthly production
        const monthlyPacking = await Packing.find({
            packingDate: { $gte: monthStart, $lte: monthEnd }
        });
        const monthlyProduction = monthlyPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        // Pending bills
        const pendingBillsList = await Bill.find({ status: { $ne: 'paid' } });
        const pendingBills = pendingBillsList.length;
        const pendingAmount = pendingBillsList.reduce((sum, b) => sum + (b.pendingAmount || 0), 0);
        
        // Active workers
        const activeWorkers = await Worker.countDocuments({ isActive: true });
        
        // Active assignments (pending or partial)
        const activeAssignments = await Assignment.countDocuments({
            status: { $in: ['pending', 'partial'] }
        });
        
        // Recent assignments (last 5)
        const recentAssignments = await Assignment.find()
            .populate('karigar', 'name')
            .sort({ assignedDate: -1 })
            .limit(5);
        
        // Recent bills (last 5)
        const recentBills = await Bill.find()
            .populate('client', 'name')
            .sort({ billDate: -1 })
            .limit(5);
        
        // Production trend data for chart (last 7 days)
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
        
        // Order status data for chart
        const totalAssignments = await Assignment.countDocuments();
        const completedAssignments = await Assignment.countDocuments({ status: 'completed' });
        const partialAssignments = await Assignment.countDocuments({ status: 'partial' });
        const pendingAssignments = await Assignment.countDocuments({ status: 'pending' });
        
        const statusData = {
            labels: ['Completed', 'Partial', 'Pending'],
            values: [completedAssignments, partialAssignments, pendingAssignments]
        };
        
        res.json({
            todayProduction,
            monthlyProduction,
            productionTrend: productionTrend.toFixed(1),
            pendingBills,
            pendingAmount,
            activeWorkers,
            activeAssignments,
            recentAssignments: recentAssignments.map(a => ({
                assignmentId: a.assignmentId,
                karigar: a.karigar,
                productName: a.productName,
                givenPieces: a.givenPieces,
                status: a.status
            })),
            recentBills: recentBills.map(b => ({
                billNumber: b.billNumber,
                client: b.client,
                totalAmount: b.totalAmount,
                status: b.status
            })),
            productionData,
            statusData
        });
        
    } catch (error) {
        console.error('Dashboard API error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get worker dashboard stats based on role
exports.getWorkerStats = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const userRole = req.session.user.role;
        const worker = await Worker.findOne({ 
            $or: [
                { _id: userId },
                { userId: userId }
            ]
        });
        
        let stats = {};
        
        if (userRole === 'cutting' || (worker && worker.workerType === 'cutting')) {
            // Cutting Worker Stats
            const myCuttings = await Cutting.find({ cuttingWorker: userId });
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayCuttings = await Cutting.find({
                cuttingWorker: userId,
                createdAt: { $gte: todayStart }
            });
            
            stats = {
                totalCuttings: myCuttings.length,
                todayCuttings: todayCuttings.length,
                totalPieces: myCuttings.reduce((sum, c) => sum + (c.totalPieces || 0), 0),
                monthlySalary: worker ? worker.monthlyRate : 0,
                recentCuttings: myCuttings.slice(0, 5)
            };
            
        } else if (userRole === 'karigar' || (worker && worker.workerType === 'karigar')) {
            // Karigar Stats
            const myAssignments = await Assignment.find({ karigar: userId });
            const completedAssignments = myAssignments.filter(a => a.status === 'completed');
            const pendingAssignments = myAssignments.filter(a => a.status === 'pending');
            const partialAssignments = myAssignments.filter(a => a.status === 'partial');
            
            // Get production returns
            const returns = await ProductionReturn.find({ karigar: userId });
            const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
            
            // Get payments
            const Payment = require('../models/Payment');
            const payments = await Payment.find({ worker: userId });
            const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);
            
            stats = {
                totalAssignments: myAssignments.length,
                completedAssignments: completedAssignments.length,
                pendingAssignments: pendingAssignments.length,
                partialAssignments: partialAssignments.length,
                totalReturned,
                totalEarnings,
                recentAssignments: myAssignments.slice(0, 5)
            };
            
        } else if (userRole === 'helper' || (worker && worker.workerType === 'helper')) {
            // Helper Stats
            const finishingEntries = await Finishing.find({ helper: userId });
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayFinishing = await Finishing.find({
                helper: userId,
                finishingDate: { $gte: todayStart }
            });
            
            const totalReceived = finishingEntries.reduce((sum, f) => sum + (f.receivedPieces || 0), 0);
            const totalRejected = finishingEntries.reduce((sum, f) => sum + (f.rejectedPieces || 0), 0);
            const totalPassed = finishingEntries.reduce((sum, f) => sum + (f.passedPieces || 0), 0);
            
            // Get payments
            const Payment = require('../models/Payment');
            const payments = await Payment.find({ worker: userId });
            const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);
            
            // Get monthly salary from worker
            const monthlySalary = worker ? worker.monthlyRate : 0;
            
            // Get this month's earnings (based on attendance)
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const thisMonthFinishing = await Finishing.find({
                helper: userId,
                finishingDate: { $gte: monthStart }
            });
            const thisMonthPieces = thisMonthFinishing.reduce((sum, f) => sum + (f.passedPieces || 0), 0);
            const thisMonthEarnings = monthlySalary; // Simplified - can be calculated from attendance
            
            stats = {
                totalEntries: finishingEntries.length,
                todayEntries: todayFinishing.length,
                totalReceived,
                totalRejected,
                totalPassed,
                totalEarnings,
                monthlySalary,
                thisMonthEarnings,
                attendanceInfo: { present: 0, total: 0 }, // Will be populated from attendance
                recentEntries: finishingEntries.slice(0, 5),
                weeklyData: [] // For chart
            };
            
        } else if (userRole === 'pressman' || (worker && worker.workerType === 'pressman')) {
            // Pressman Stats
            const PressmanEntry = require('../models/PressmanEntry');
            const entries = await PressmanEntry.find({ pressman: userId });
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEntries = await PressmanEntry.find({
                pressman: userId,
                date: { $gte: todayStart }
            });
            
            const totalQuantity = entries.reduce((sum, e) => sum + (e.totalQuantity || 0), 0);
            const totalAmount = entries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
            
            // Get payments
            const Payment = require('../models/Payment');
            const payments = await Payment.find({ worker: userId });
            const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);
            const pendingAmount = totalAmount - totalEarnings;
            
            // Weekly data for chart
            const weeklyData = [];
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            for (let i = 0; i < 4; i++) {
                const weekDate = new Date(weekStart);
                weekDate.setDate(weekStart.getDate() - (i * 7));
                const weekEnd = new Date(weekDate);
                weekEnd.setDate(weekDate.getDate() + 7);
                
                const weekEntries = await PressmanEntry.find({
                    pressman: userId,
                    date: { $gte: weekDate, $lt: weekEnd }
                });
                const weekAmount = weekEntries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
                weeklyData.unshift({
                    week: `Week ${4 - i}`,
                    amount: weekAmount
                });
            }
            
            stats = {
                totalEntries: entries.length,
                todayEntries: todayEntries.length,
                totalQuantity,
                totalAmount,
                totalEarnings,
                pendingAmount,
                weeklyData,
                recentEntries: entries.slice(0, 5)
            };
        }
        
        res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Worker stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};