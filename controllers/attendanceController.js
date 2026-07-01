const Attendance = require('../models/Attendance');
const Worker = require('../models/Worker');
const Setting = require('../models/Setting');

// ============ GET ATTENDANCE PAGE ============
exports.getAttendance = async (req, res) => {
    try {
        const { month, year, workerType } = req.query;
        
        const currentMonth = parseInt(month) || new Date().getMonth() + 1;
        const currentYear = parseInt(year) || new Date().getFullYear();
        
        // Build filter
        let workerFilter = {};
        if (workerType) {
            workerFilter.workerType = workerType;
        }
        
        // Get workers
        const workers = await Worker.find({ isActive: true, ...workerFilter });
        
        // Get attendance records for the period
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0);
        
        const attendanceRecords = await Attendance.find({
            date: { $gte: startDate, $lte: endDate }
        });
        
        // Build attendance map
        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            const key = `${record.worker}_${new Date(record.date).toDateString()}`;
            attendanceMap[key] = record;
        });
        
        // Calculate days in month
        const daysInMonth = endDate.getDate();
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
        res.redirect('/payments');
    }
};

// ============ SAVE SINGLE ATTENDANCE ============
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

// ============ GET WORKER ATTENDANCE SUMMARY ============
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

// ============ API: TOGGLE ATTENDANCE (for worker detail page) ============
exports.toggleAttendance = async (req, res) => {
    try {
        const { workerId, date } = req.body;
        const dateObj = new Date(date);
        dateObj.setHours(0, 0, 0, 0);
        
        let attendance = await Attendance.findOne({ worker: workerId, date: dateObj });
        
        if (attendance) {
            attendance.status = attendance.status === 'present' ? 'absent' : 'present';
            await attendance.save();
        } else {
            attendance = await Attendance.create({
                worker: workerId,
                workerType: 'helper', // Will be updated by controller
                date: dateObj,
                status: 'present',
                markedBy: req.session.user.id
            });
        }
        
        res.json({ success: true, status: attendance.status });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error: error.message });
    }
};

// ============ API: MARK ALL PRESENT ============
exports.markAllPresent = async (req, res) => {
    try {
        const { workerId, month, year } = req.body;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const worker = await Worker.findById(workerId);
        if (!worker) {
            return res.json({ success: false, error: 'Worker not found' });
        }
        
        for (let i = 1; i <= endDate.getDate(); i++) {
            const date = new Date(year, month - 1, i);
            if (date.getDay() !== 5) { // Not Friday
                await Attendance.findOneAndUpdate(
                    { worker: workerId, date: date },
                    { 
                        worker: workerId, 
                        workerType: worker.workerType,
                        date: date, 
                        status: 'present',
                        markedBy: req.session.user.id
                    },
                    { upsert: true }
                );
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error: error.message });
    }
};

// ============ ADMIN DASHBOARD ATTENDANCE WIDGET ============
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