const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Worker = require('../models/Worker');

// ==================== GET WEEK START ====================
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 6) ? 0 : (day + 1);
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ==================== ATTENDANCE DASHBOARD ====================
// ==================== ATTENDANCE DASHBOARD (WITH FILTERS) ====================
// ==================== ATTENDANCE DASHBOARD ====================
// ==================== ATTENDANCE DASHBOARD ====================
router.get('/', protect, adminOnly, async (req, res) => {
    try {
        const { weekStart, view, month, workerType, status, date } = req.query;
        let viewMode = view || 'week';
        
        // ✅ Determine date range
        let startDate, endDate;
        let monthStart = new Date();
        let weekStartDate = new Date();
        
        if (viewMode === 'month') {
            // Month view
            const monthDate = month ? new Date(month) : new Date();
            monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
            const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            startDate = monthStart;
            endDate = monthEnd;
            endDate.setHours(23, 59, 59, 999);
            weekStartDate = startDate;
        } else {
            // Week view (default)
            viewMode = 'week';
            weekStartDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
            startDate = weekStartDate;
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            monthStart = startDate;
        }
        
        // ✅ Build worker filter
        let workerFilter = { isActive: true };
        if (workerType === 'helper') {
            workerFilter.workerType = 'helper';
        } else if (workerType === 'cutting') {
            workerFilter.workerType = 'cutting';
        } else {
            workerFilter.workerType = { $in: ['helper', 'cutting'] };
        }
        
        // Get workers
        const workers = await Worker.find(workerFilter);
        
        // Get attendance for each worker
        const attendanceData = [];
        for (const worker of workers) {
            const attendance = await Attendance.find({
                worker: worker._id,
                date: { $gte: startDate, $lte: endDate }
            });
            
            const present = attendance.filter(a => a.status === 'present').length;
            const absent = attendance.filter(a => a.status === 'absent').length;
            const halfDay = attendance.filter(a => a.status === 'half-day').length;
            const holiday = attendance.filter(a => a.status === 'holiday').length;
            const total = attendance.length;
            
            // Calculate pending days
            let totalDays = 7; // Default week
            if (viewMode === 'month') {
                totalDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
            }
            const pending = totalDays - total;
            
            attendanceData.push({
                worker: worker,
                attendance: attendance,
                present: present,
                absent: absent,
                halfDay: halfDay,
                holiday: holiday,
                total: total,
                pending: pending,
                totalDays: totalDays
            });
        }
        
        res.render('attendance/index', {
            title: 'Attendance Management',
            workers: attendanceData,
            weekStart: startDate,
            weekEnd: endDate,
            monthStart: monthStart,
            viewMode: viewMode,  // ✅ CRITICAL: Pass viewMode
            user: req.session.user,
            currentPage: 'attendance',
            getWeekStart: getWeekStart,
            query: req.query,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Error loading attendance:', error);
        req.flash('error_msg', 'Error loading attendance');
        res.redirect('/dashboard');
    }
});

// ==================== BULK ATTENDANCE ====================
router.post('/bulk', protect, adminOnly, async (req, res) => {
    try {
        const { weekStart, attendanceData } = req.body;
        
        if (!attendanceData || attendanceData.length === 0) {
            return res.status(400).json({ success: false, error: 'No attendance data' });
        }
        
        const startDate = new Date(weekStart);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        
        let savedCount = 0;
        
        for (const item of attendanceData) {
            const { workerId, date, status, remark } = item;
            
            // Skip if status is pending (don't save)
            if (status === 'pending') continue;
            
            let attendance = await Attendance.findOne({
                worker: workerId,
                date: new Date(date)
            });
            
            if (attendance) {
                attendance.status = status || 'present';
                attendance.remark = remark || '';
                await attendance.save();
            } else {
                const worker = await Worker.findById(workerId);
                if (!worker) continue;
                
                attendance = new Attendance({
                    worker: workerId,
                    workerType: worker.workerType,
                    date: new Date(date),
                    status: status || 'present',
                    weekStart: startDate,
                    weekEnd: endDate,
                    remark: remark || '',
                    createdBy: req.session.user.id
                });
                await attendance.save();
            }
            savedCount++;
        }
        
        res.json({ 
            success: true, 
            message: `${savedCount} attendance records saved successfully!` 
        });
    } catch (error) {
        console.error('Error saving bulk attendance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;