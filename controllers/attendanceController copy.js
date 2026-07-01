const Attendance = require('../models/Attendance');
const AttendanceBulk = require('../models/AttendanceBulk');
const Worker = require('../models/Worker');
const Setting = require('../models/Setting');

// Get attendance page with filters
exports.getAttendance = async (req, res) => {
    try {
        const { month, year, workerType, week } = req.query;
        
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();
        
        // Build filter
        let filter = {};
        if (month && year) {
            const startDate = new Date(currentYear, currentMonth - 1, 1);
            const endDate = new Date(currentYear, currentMonth, 0);
            filter.date = { $gte: startDate, $lte: endDate };
        }
        if (workerType) filter.workerType = workerType;
        
        // Get workers based on type
        let workers = [];
        if (workerType === 'helper') {
            workers = await Worker.find({ workerType: 'helper', isActive: true });
        } else if (workerType === 'cutting') {
            workers = await Worker.find({ workerType: 'cutting', isActive: true });
        } else if (workerType === 'karigar') {
            workers = await Worker.find({ workerType: 'karigar', isActive: true });
        } else if (workerType === 'pressman') {
            workers = await Worker.find({ workerType: 'pressman', isActive: true });
        } else {
            workers = await Worker.find({ isActive: true });
        }
        
        // Get attendance records for the period
        const attendanceRecords = await Attendance.find(filter);
        
        // Build attendance map
        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            const key = `${record.worker}_${new Date(record.date).toDateString()}`;
            attendanceMap[key] = record;
        });
        
        // Calculate days in month
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        
        // Get Friday holiday setting
        const fridayHolidaySetting = await Setting.findOne({ category: 'rates', key: 'friday_holiday' });
        const isFridayHoliday = fridayHolidaySetting ? fridayHolidaySetting.value : true;
        
        // Check which days are Fridays
        const fridays = [];
        days.forEach(day => {
            const date = new Date(currentYear, currentMonth - 1, day);
            if (date.getDay() === 5) { // Friday
                fridays.push(day);
            }
        });
        
        res.render('attendance/index', {
            title: 'Attendance Management',
            workers,
            attendanceMap,
            days,
            fridays,
            currentMonth,
            currentYear,
            workerType: workerType || '',
            isFridayHoliday,
            monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading attendance page');
        res.redirect('/dashboard');
    }
};

// Save single attendance (admin can mark for any day)
exports.saveAttendance = async (req, res) => {
    try {
        const { workerId, workerType, date, status, note, checkIn, checkOut } = req.body;
        
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);
        
        // Check if entry exists
        let attendance = await Attendance.findOne({
            worker: workerId,
            date: attendanceDate
        });
        
        if (attendance) {
            // Update existing
            attendance.status = status;
            attendance.note = note || '';
            if (checkIn) attendance.checkIn = new Date(`${date}T${checkIn}`);
            if (checkOut) attendance.checkOut = new Date(`${date}T${checkOut}`);
            if (checkIn && checkOut) {
                const hours = (attendance.checkOut - attendance.checkIn) / (1000 * 3600);
                attendance.workingHours = hours;
            }
            attendance.markedBy = req.session.user.id;
            attendance.markedAt = new Date();
            await attendance.save();
        } else {
            // Create new
            attendance = new Attendance({
                worker: workerId,
                workerType,
                date: attendanceDate,
                status,
                note: note || '',
                markedBy: req.session.user.id
            });
            
            if (checkIn) attendance.checkIn = new Date(`${date}T${checkIn}`);
            if (checkOut) attendance.checkOut = new Date(`${date}T${checkOut}`);
            if (checkIn && checkOut) {
                const hours = (attendance.checkOut - attendance.checkIn) / (1000 * 3600);
                attendance.workingHours = hours;
            }
            
            await attendance.save();
        }
        
        req.flash('success_msg', `Attendance marked for ${new Date(date).toLocaleDateString()}`);
        res.redirect('/attendance');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error saving attendance');
        res.redirect('/attendance');
    }
};

// Bulk weekly attendance entry
exports.bulkWeeklyForm = async (req, res) => {
    try {
        const { weekStart, workerType } = req.query;
        
        let startDate = weekStart ? new Date(weekStart) : new Date();
        // Set to Monday of that week
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(startDate.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        
        // Get workers
        let workers = [];
        if (workerType === 'helper') {
            workers = await Worker.find({ workerType: 'helper', isActive: true });
        } else if (workerType === 'cutting') {
            workers = await Worker.find({ workerType: 'cutting', isActive: true });
        } else {
            workers = await Worker.find({ 
                workerType: { $in: ['helper', 'cutting'] }, 
                isActive: true 
            });
        }
        
        // Get existing attendance for this week
        const existingAttendance = await Attendance.find({
            worker: { $in: workers.map(w => w._id) },
            date: { $gte: startDate, $lte: endDate }
        });
        
        // Build attendance map
        const attendanceMap = {};
        existingAttendance.forEach(att => {
            const key = `${att.worker}_${new Date(att.date).toDateString()}`;
            attendanceMap[key] = att;
        });
        
        // Generate week days
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            weekDays.push({
                date: date,
                dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
                isFriday: date.getDay() === 5
            });
        }
        
        res.render('attendance/bulk', {
            title: 'Bulk Weekly Attendance',
            workers,
            weekDays,
            startDate,
            endDate,
            workerType: workerType || '',
            attendanceMap
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading bulk attendance form');
        res.redirect('/attendance');
    }
};

// Save bulk weekly attendance
exports.saveBulkAttendance = async (req, res) => {
    try {
        const { weekStart, workerType, attendance } = req.body;
        
        const startDate = new Date(weekStart);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        
        const entries = [];
        
        // Process each attendance entry
        for (const [key, value] of Object.entries(attendance)) {
            const [workerId, dateStr] = key.split('_');
            const date = new Date(dateStr);
            date.setHours(0, 0, 0, 0);
            
            const worker = await Worker.findById(workerId);
            if (!worker) continue;
            
            // Check if entry exists
            let existing = await Attendance.findOne({
                worker: workerId,
                date: date
            });
            
            if (existing) {
                // Update existing
                existing.status = value.status;
                existing.note = value.note || '';
                existing.markedBy = req.session.user.id;
                existing.markedAt = new Date();
                await existing.save();
                entries.push({ workerId, date: dateStr, status: value.status });
            } else if (value.status !== 'absent') {
                // Create new (skip absent entries to save space)
                const newAttendance = new Attendance({
                    worker: workerId,
                    workerType: worker.workerType,
                    date: date,
                    status: value.status,
                    note: value.note || '',
                    markedBy: req.session.user.id
                });
                await newAttendance.save();
                entries.push({ workerId, date: dateStr, status: value.status });
            }
        }
        
        // Create bulk record for audit
        const bulkRecord = new AttendanceBulk({
            weekStart: startDate,
            weekEnd: endDate,
            entries: entries,
            totalEntries: entries.length,
            createdBy: req.session.user.id
        });
        await bulkRecord.save();
        
        req.flash('success_msg', `Bulk attendance saved for week starting ${startDate.toLocaleDateString()}`);
        res.redirect('/attendance');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error saving bulk attendance');
        res.redirect('/attendance');
    }
};

// Get monthly attendance summary for a worker
exports.getWorkerSummary = async (req, res) => {
    try {
        const { workerId, month, year } = req.query;
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const attendance = await Attendance.find({
            worker: workerId,
            date: { $gte: startDate, $lte: endDate }
        });
        
        const summary = {
            present: attendance.filter(a => a.status === 'present').length,
            absent: attendance.filter(a => a.status === 'absent').length,
            halfDay: attendance.filter(a => a.status === 'half_day').length,
            leave: attendance.filter(a => a.status === 'leave').length,
            totalWorkingDays: 0,
            totalHours: 0
        };
        
        // Calculate total working days (excluding Fridays if holiday)
        const fridayHolidaySetting = await Setting.findOne({ category: 'rates', key: 'friday_holiday' });
        const isFridayHoliday = fridayHolidaySetting ? fridayHolidaySetting.value : true;
        
        let workingDays = 0;
        for (let i = 1; i <= endDate.getDate(); i++) {
            const date = new Date(year, month - 1, i);
            if (!(isFridayHoliday && date.getDay() === 5)) {
                workingDays++;
            }
        }
        summary.totalWorkingDays = workingDays;
        
        // Calculate total working hours
        summary.totalHours = attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0);
        
        // Calculate salary deduction if monthly worker
        const worker = await Worker.findById(workerId);
        if (worker && worker.paymentType === 'monthly') {
            const perDayRate = worker.monthlyRate / workingDays;
            const presentDays = summary.present + (summary.halfDay * 0.5);
            summary.earnedSalary = presentDays * perDayRate;
            summary.deduction = worker.monthlyRate - summary.earnedSalary;
        }
        
        res.json({ success: true, summary, details: attendance });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get attendance calendar data for dashboard
exports.getCalendarData = async (req, res) => {
    try {
        const { month, year } = req.query;
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();
        
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0);
        
        // Get all attendance for the month
        const attendance = await Attendance.find({
            date: { $gte: startDate, $lte: endDate }
        }).populate('worker', 'name workerType');
        
        // Group by date
        const calendarData = {};
        for (let i = 1; i <= endDate.getDate(); i++) {
            const date = new Date(currentYear, currentMonth - 1, i);
            const dateStr = date.toISOString().split('T')[0];
            calendarData[dateStr] = {
                date: dateStr,
                present: 0,
                absent: 0,
                halfDay: 0,
                leave: 0,
                total: 0
            };
        }
        
        attendance.forEach(att => {
            const dateStr = att.date.toISOString().split('T')[0];
            if (calendarData[dateStr]) {
                calendarData[dateStr][att.status]++;
                calendarData[dateStr].total++;
            }
        });
        
        res.json({
            success: true,
            calendar: Object.values(calendarData),
            month: currentMonth,
            year: currentYear
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Admin dashboard attendance widget
exports.getAttendanceWidget = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Today's attendance
        const todayAttendance = await Attendance.find({
            date: { $gte: today, $lt: tomorrow },
            workerType: { $in: ['helper', 'cutting'] }
        }).populate('worker', 'name');
        
        const totalMonthlyWorkers = await Worker.countDocuments({
            workerType: { $in: ['helper', 'cutting'] },
            isActive: true
        });
        
        const presentToday = todayAttendance.filter(a => a.status === 'present').length;
        const absentToday = todayAttendance.filter(a => a.status === 'absent').length;
        const halfDayToday = todayAttendance.filter(a => a.status === 'half_day').length;
        
        // This month summary
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const monthAttendance = await Attendance.find({
            date: { $gte: monthStart, $lte: monthEnd },
            workerType: { $in: ['helper', 'cutting'] }
        });
        
        const totalPresentMonth = monthAttendance.filter(a => a.status === 'present').length;
        const totalWorkingDays = monthEnd.getDate();
        
        res.json({
            success: true,
            today: {
                total: totalMonthlyWorkers,
                present: presentToday,
                absent: absentToday,
                halfDay: halfDayToday,
                attendanceRate: totalMonthlyWorkers > 0 ? ((presentToday / totalMonthlyWorkers) * 100).toFixed(1) : 0
            },
            month: {
                totalPresent: totalPresentMonth,
                totalWorkingDays: totalWorkingDays,
                averageAttendance: totalWorkingDays > 0 ? (totalPresentMonth / totalWorkingDays).toFixed(1) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};