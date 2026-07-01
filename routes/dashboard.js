// const express = require('express');
// const router = express.Router();
// const { protect } = require('../middleware/auth');

// // Dashboard Home - Without Navbar (Only Sidebar)
// router.get('/', protect, async (req, res) => {
//     try {
//         // Dashboard ke liye special layout - jisme navbar nahi hai
//         res.render('dashboard/pro-dashboard', {
//             title: 'Dashboard',
//             user: req.session.user,
//             currentPage: 'dashboard',
//             layout: false,  // ← This removes the main layout
//             success_msg: req.flash('success_msg'),
//             error_msg: req.flash('error_msg')
//         });
//     } catch (error) {
//         console.error('Dashboard error:', error);
//         req.flash('error_msg', 'Error loading dashboard');
//         res.redirect('/');
//     }
// });

// // Add these routes for badges
// router.get('/api/cutting/count', protect, async (req, res) => {
//     const Cutting = require('../models/Cutting');
//     const count = await Cutting.countDocuments({ status: { $ne: 'completed' } });
//     res.json({ count });
// });

// router.get('/api/assignments/pending-count', protect, async (req, res) => {
//     const Assignment = require('../models/Assignment');
//     const count = await Assignment.countDocuments({ status: { $ne: 'completed' } });
//     res.json({ count });
// });

// router.get('/api/bills/pending-count', protect, async (req, res) => {
//     const Bill = require('../models/Bill');
//     const count = await Bill.countDocuments({ status: { $ne: 'paid' } });
//     res.json({ count });
// });

// router.get('/api/notifications/count', protect, async (req, res) => {
//     // You can implement real notification system
//     res.json({ count: 0 });
// });
// // API Routes for Dashboard Stats
// router.get('/api/stats', protect, async (req, res) => {
//     try {
//         const Packing = require('../models/Packing');
//         const Bill = require('../models/Bill');
//         const Assignment = require('../models/Assignment');
//         const Worker = require('../models/Worker');
//         const Cutting = require('../models/Cutting');
        
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);
//         const tomorrow = new Date(today);
//         tomorrow.setDate(tomorrow.getDate() + 1);
        
//         // Today's Production
//         const todayPacking = await Packing.find({
//             packingDate: { $gte: today, $lt: tomorrow }
//         });
//         const todayProduction = todayPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
//         // Monthly Production
//         const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
//         const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
//         const monthlyPacking = await Packing.find({
//             packingDate: { $gte: monthStart, $lte: monthEnd }
//         });
//         const monthlyProduction = monthlyPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
//         // Yesterday Production for trend
//         const yesterday = new Date(today);
//         yesterday.setDate(yesterday.getDate() - 1);
//         const yesterdayEnd = new Date(yesterday);
//         yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
//         const yesterdayPacking = await Packing.find({
//             packingDate: { $gte: yesterday, $lt: yesterdayEnd }
//         });
//         const yesterdayProduction = yesterdayPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
//         let productionTrend = 0;
//         if (yesterdayProduction > 0) {
//             productionTrend = ((todayProduction - yesterdayProduction) / yesterdayProduction) * 100;
//         }
        
//         // Pending Bills
//         const pendingBillsList = await Bill.find({ status: { $ne: 'paid' } });
//         const pendingBills = pendingBillsList.length;
//         const pendingAmount = pendingBillsList.reduce((sum, b) => sum + (b.pendingAmount || 0), 0);
        
//         // Active Workers & Assignments
//         const activeWorkers = await Worker.countDocuments({ isActive: true });
//         const activeAssignments = await Assignment.countDocuments({
//             status: { $in: ['pending', 'partial'] }
//         });
        
//         // Production Data for Chart (Last 7 days)
//         const productionData = [];
//         for (let i = 6; i >= 0; i--) {
//             const date = new Date(today);
//             date.setDate(date.getDate() - i);
//             date.setHours(0, 0, 0, 0);
//             const nextDay = new Date(date);
//             nextDay.setDate(nextDay.getDate() + 1);
            
//             const dayPacking = await Packing.find({
//                 packingDate: { $gte: date, $lt: nextDay }
//             });
//             const dayTotal = dayPacking.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
            
//             productionData.push({
//                 label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
//                 value: dayTotal
//             });
//         }
        
//         // Status Data for Chart
//         const totalAssignments = await Assignment.countDocuments();
//         const completedAssignments = await Assignment.countDocuments({ status: 'completed' });
//         const partialAssignments = await Assignment.countDocuments({ status: 'partial' });
//         const pendingAssignments = await Assignment.countDocuments({ status: 'pending' });
        
//         const statusData = {
//             labels: ['Completed', 'Partial', 'Pending'],
//             values: [completedAssignments, partialAssignments, pendingAssignments]
//         };
        
//         // Recent Activities
//         const recentCuttings = await Cutting.find().sort({ createdAt: -1 }).limit(3);
//         const recentAssignments = await Assignment.find().sort({ assignedDate: -1 }).limit(3);
        
//         const recentActivities = [];
        
//         for (const cut of recentCuttings) {
//             recentActivities.push({
//                 type: 'cutting',
//                 title: `New Cutting: ${cut.cuttingNumber || 'CUT-' + cut._id.toString().slice(-6)}`,
//                 description: `${cut.productName || 'Product'} - ${cut.totalPieces || 0} pieces`,
//                 time: timeAgo(cut.createdAt),
//                 color: '#4361ee'
//             });
//         }
        
//         for (const assign of recentAssignments) {
//             recentActivities.push({
//                 type: 'assignment',
//                 title: `Assignment Created: ${assign.assignmentId || 'ASN-' + assign._id.toString().slice(-6)}`,
//                 description: `${assign.productName || 'Product'} assigned`,
//                 time: timeAgo(assign.assignedDate),
//                 color: '#f59e0b'
//             });
//         }
        
//         // Recent Bills
//         const recentBills = await Bill.find().populate('client', 'name').sort({ billDate: -1 }).limit(5);
//         const formattedBills = recentBills.map(b => ({
//             clientName: b.client?.name || 'Unknown',
//             amount: b.totalAmount,
//             date: new Date(b.billDate).toLocaleDateString(),
//             status: b.status
//         }));
        
//         // Top Products
//         const allPackings = await Packing.find();
//         const productCount = {};
//         for (const pack of allPackings) {
//             for (const entry of (pack.entries || [])) {
//                 const name = entry.productName;
//                 productCount[name] = (productCount[name] || 0) + (entry.packedPieces || 0);
//             }
//         }
//         const topProducts = Object.entries(productCount)
//             .map(([name, pieces]) => ({ name, pieces }))
//             .sort((a, b) => b.pieces - a.pieces)
//             .slice(0, 5);
        
//         // Financial Stats
//         const allBills = await Bill.find();
//         const totalBillsAmount = allBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
//         const collectedAmount = allBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        
//         res.json({
//             todayProduction,
//             monthlyProduction,
//             productionTrend: productionTrend.toFixed(1),
//             pendingBills,
//             pendingAmount,
//             activeWorkers,
//             activeAssignments,
//             productionData,
//             statusData,
//             recentActivities,
//             recentBills: formattedBills,
//             topProducts,
//             totalBillsAmount,
//             collectedAmount
//         });
        
//     } catch (error) {
//         console.error('Dashboard API error:', error);
//         res.status(500).json({ error: error.message });
//     }
// });
// // Add these routes after your existing routes in routes/dashboard.js

// // Get counts for sidebar badges
// router.get('/api/counts', protect, async (req, res) => {
//     try {
//         const Cutting = require('../models/Cutting');
//         const Assignment = require('../models/Assignment');
//         const ProductionReturn = require('../models/ProductionReturn');
//         const Finishing = require('../models/Finishing');
//         const Packing = require('../models/Packing');
//         const Bill = require('../models/Bill');
//         const Worker = require('../models/Worker');
//         const Product = require('../models/Product');
//         const Fabric = require('../models/Fabric');
        
//         // Get all counts
//         const [cuttingCount, assignmentCount, productionReturnCount, finishingCount, 
//                packingCount, billCount, workerCount, productCount, fabricCount] = await Promise.all([
//             Cutting.countDocuments({ status: { $ne: 'completed' } }),
//             Assignment.countDocuments({ status: { $in: ['pending', 'partial'] } }),
//             ProductionReturn.countDocuments({ status: { $ne: 'completed' } }),
//             Finishing.countDocuments({ status: 'pending' }),
//             Packing.countDocuments({}),  // Total packing entries today
//             Bill.countDocuments({ status: { $ne: 'paid' } }),
//             Worker.countDocuments({ isActive: true }),
//             Product.countDocuments({ isActive: true }),
//             Fabric.countDocuments({})  // Total fabric batches
//         ]);
        
//         res.json({
//             success: true,
//             counts: {
//                 cutting: cuttingCount,
//                 assignment: assignmentCount,
//                 productionReturn: productionReturnCount,
//                 finishing: finishingCount,
//                 packing: packingCount,
//                 bill: billCount,
//                 worker: workerCount,
//                 product: productCount,
//                 fabric: fabricCount
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching counts:', error);
//         res.status(500).json({ success: false, error: error.message });
//     }
// });

// // Individual count endpoints (for real-time updates)
// router.get('/api/counts/cutting', protect, async (req, res) => {
//     const Cutting = require('../models/Cutting');
//     const count = await Cutting.countDocuments({ status: { $ne: 'completed' } });
//     res.json({ count });
// });

// router.get('/api/counts/assignment', protect, async (req, res) => {
//     const Assignment = require('../models/Assignment');
//     const count = await Assignment.countDocuments({ status: { $in: ['pending', 'partial'] } });
//     res.json({ count });
// });

// router.get('/api/counts/bill', protect, async (req, res) => {
//     const Bill = require('../models/Bill');
//     const count = await Bill.countDocuments({ status: { $ne: 'paid' } });
//     res.json({ count });
// });

// router.get('/api/counts/worker', protect, async (req, res) => {
//     const Worker = require('../models/Worker');
//     const count = await Worker.countDocuments({ isActive: true });
//     res.json({ count });
// });

// router.get('/api/counts/product', protect, async (req, res) => {
//     const Product = require('../models/Product');
//     const count = await Product.countDocuments({ isActive: true });
//     res.json({ count });
// });

// router.get('/api/counts/fabric', protect, async (req, res) => {
//     const Fabric = require('../models/Fabric');
//     const count = await Fabric.countDocuments();
//     res.json({ count });
// });

// // Helper function for time ago
// function timeAgo(date) {
//     if (!date) return 'Just now';
//     const seconds = Math.floor((new Date() - new Date(date)) / 1000);
//     if (seconds < 60) return 'Just now';
//     const minutes = Math.floor(seconds / 60);
//     if (minutes < 60) return `${minutes} min ago`;
//     const hours = Math.floor(minutes / 60);
//     if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
//     const days = Math.floor(hours / 24);
//     return `${days} day${days > 1 ? 's' : ''} ago`;
// }

// module.exports = router;
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Role-based dashboard redirect
router.get('/', protect, async (req, res) => {
    const role = req.session.user.role;
    
    if (role === 'admin') {
        return res.render('dashboard/admin-new', {
            title: 'Admin Dashboard',
            user: req.session.user,
            layout: 'layouts/admin-layout'
        });
    } else if (role === 'cutting') {
        return res.render('dashboard/cutting-dashboard', {
            title: 'Cutting Worker Dashboard',
            user: req.session.user
        });
    } else if (role === 'karigar') {
        return res.render('dashboard/karigar-dashboard', {
            title: 'Karigar Dashboard',
            user: req.session.user
        });
    } else if (role === 'helper') {
        return res.render('dashboard/helper-dashboard', {
            title: 'Helper Dashboard',
            user: req.session.user
        });
    } else if (role === 'pressman') {
        return res.render('dashboard/pressman-dashboard', {
            title: 'Pressman Dashboard',
            user: req.session.user
        });
    } else {
        return res.redirect('/auth/login');
    }
});

module.exports = router;