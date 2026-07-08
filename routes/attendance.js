const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Worker = require('../models/Worker');
const BlockedMonth = require('../models/BlockedMonth');

// ==================== GET WEEK START (SATURDAY) ====================
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 6) ? 0 : (day + 1);
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ==================== ATTENDANCE DASHBOARD ====================
router.get('/', protect, adminOnly, async (req, res) => {
    try {
        const { workerType, workerId, month, view, weekStart, status } = req.query;

        // ✅ Set default month
        let currentMonth = month ? new Date(month + '-01') : new Date();
        let monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

        // ✅ Get workers based on type
        let workerFilter = { isActive: true };
        if (workerType === 'helper') {
            workerFilter.workerType = 'helper';
        } else if (workerType === 'cutting') {
            workerFilter.workerType = 'cutting';
        } else if (workerType) {
            workerFilter.workerType = workerType;
        }

        const workers = await Worker.find(workerFilter);

        // ✅ Get attendance for all workers
        const attendanceData = [];
        let selectedWorker = null;

        for (const worker of workers) {
            const attendance = await Attendance.find({
                worker: worker._id,
                date: { $gte: monthStart, $lte: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0) }
            });

            const present = attendance.filter(a => a.status === 'present').length;
            const absent = attendance.filter(a => a.status === 'absent').length;
            const halfDay = attendance.filter(a => a.status === 'half-day').length;
            const holiday = attendance.filter(a => a.status === 'holiday').length;
            const total = attendance.length;
            const pending = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate() - total;

            const workerObj = {
                worker: worker,
                attendance: attendance,
                present: present,
                absent: absent,
                halfDay: halfDay,
                holiday: holiday,
                total: total,
                pending: pending
            };

            attendanceData.push(workerObj);

            // ✅ Check if this is the selected worker
            if (workerId && worker._id.toString() === workerId) {
                // ✅ Check if month is blocked
                const blocked = await BlockedMonth.findOne({ month: monthStart.toISOString().slice(0, 7) });
                selectedWorker = {
                    ...workerObj,
                    isMonthBlocked: !!blocked
                };
            }
        }

        // ✅ If no worker selected, but workerId is provided, try to find it
        if (workerId && !selectedWorker) {
            const worker = await Worker.findById(workerId);
            if (worker) {
                const attendance = await Attendance.find({
                    worker: worker._id,
                    date: { $gte: monthStart, $lte: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0) }
                });

                const present = attendance.filter(a => a.status === 'present').length;
                const absent = attendance.filter(a => a.status === 'absent').length;
                const halfDay = attendance.filter(a => a.status === 'half-day').length;
                const holiday = attendance.filter(a => a.status === 'holiday').length;
                const total = attendance.length;
                const pending = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate() - total;

                const blocked = await BlockedMonth.findOne({ month: monthStart.toISOString().slice(0, 7) });

                selectedWorker = {
                    worker: worker,
                    attendance: attendance,
                    present: present,
                    absent: absent,
                    halfDay: halfDay,
                    holiday: holiday,
                    total: total,
                    pending: pending,
                    isMonthBlocked: !!blocked
                };
            }
        }

        // ✅ If no worker selected, but we have workers, select first one
        if (!selectedWorker && attendanceData.length > 0) {
            const blocked = await BlockedMonth.findOne({ month: monthStart.toISOString().slice(0, 7) });
            selectedWorker = {
                ...attendanceData[0],
                isMonthBlocked: !!blocked
            };
        }

        // ✅ Prepare week data
        let weekStartDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
        let weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        weekEndDate.setHours(23, 59, 59, 999);

        res.render('attendance/index', {
            title: 'Attendance Management',
            workers: attendanceData,
            selectedWorker: selectedWorker,
            monthStart: monthStart,
            weekStart: weekStartDate,
            weekEnd: weekEndDate,
            viewMode: view || 'month',
            user: req.session.user,
            currentPage: 'attendance',
            getWeekStart: getWeekStart,
            query: req.query,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Error loading attendance:', error);
        req.flash('error_msg', 'Error loading attendance: ' + error.message);
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

            // Skip if not present or pending
            if (status === 'pending') continue;

            // Check if attendance already exists
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

// ==================== TOGGLE MONTH BLOCK ====================
router.post('/toggle-block', protect, adminOnly, async (req, res) => {
    try {
        const { month, block, workerId } = req.body;

        if (!month) {
            return res.status(400).json({ success: false, error: 'Month is required' });
        }

        if (block) {
            await BlockedMonth.findOneAndUpdate(
                { month: month },
                {
                    month: month,
                    blocked: true,
                    blockedAt: new Date(),
                    blockedBy: req.session.user.id,
                    workerId: workerId || null
                },
                { upsert: true }
            );
        } else {
            await BlockedMonth.findOneAndDelete({ month: month });
        }

        res.json({ success: true, message: `Month ${block ? 'blocked' : 'unblocked'} successfully` });
    } catch (error) {
        console.error('Error toggling month block:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;