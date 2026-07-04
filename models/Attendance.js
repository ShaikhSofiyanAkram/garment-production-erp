const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true
    },
    workerType: {
        type: String,
        enum: ['helper', 'cutting', 'karigar', 'pressman'],
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'half-day', 'holiday'],
        default: 'present'
    },
    weekStart: {
        type: Date,
        required: true
    },
    weekEnd: {
        type: Date,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    remark: {
        type: String,
        trim: true
    }
}, { 
    timestamps: true 
});

// ✅ Indexes
attendanceSchema.index({ worker: 1, date: -1 });
attendanceSchema.index({ worker: 1, weekStart: 1, weekEnd: 1 });
attendanceSchema.index({ weekStart: 1, weekEnd: 1 });

// ✅ Virtual: Pending days in a week
attendanceSchema.virtual('pendingDays').get(function() {
    // This is a virtual, needs to be used with populated data
    // Better to calculate in controller
    return 0; // Default, override in controller
});

// ✅ Virtual: Total days in week
attendanceSchema.virtual('weekTotalDays').get(function() {
    return 7; // Week has 7 days (Saturday to Friday)
});

// ✅ Get attendance for a worker in a date range
attendanceSchema.statics.getAttendance = async function(workerId, startDate, endDate) {
    return await this.find({
        worker: workerId,
        date: { $gte: startDate, $lte: endDate }
    });
};

// ✅ Get present days count
attendanceSchema.statics.getPresentDays = async function(workerId, startDate, endDate) {
    const attendance = await this.find({
        worker: workerId,
        date: { $gte: startDate, $lte: endDate },
        status: 'present'
    });
    return attendance.length;
};

// ✅ Get week attendance summary with pending days
attendanceSchema.statics.getWeekSummary = async function(workerId, weekStart, weekEnd) {
    const attendance = await this.find({
        worker: workerId,
        date: { $gte: weekStart, $lte: weekEnd }
    });
    
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const halfDay = attendance.filter(a => a.status === 'half-day').length;
    const holiday = attendance.filter(a => a.status === 'holiday').length;
    
    // ✅ Calculate pending days (7 days - total attendance records)
    const totalDays = 7; // Week has 7 days (Saturday to Friday)
    const totalAttendance = attendance.length;
    const pending = totalDays - totalAttendance;
    
    return { 
        present, 
        absent, 
        halfDay, 
        holiday, 
        total: totalAttendance,
        pending: pending,
        totalDays: totalDays
    };
};

// ✅ Get month attendance summary with pending days
attendanceSchema.statics.getMonthSummary = async function(workerId, monthStart, monthEnd) {
    const attendance = await this.find({
        worker: workerId,
        date: { $gte: monthStart, $lte: monthEnd }
    });
    
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const halfDay = attendance.filter(a => a.status === 'half-day').length;
    const holiday = attendance.filter(a => a.status === 'holiday').length;
    
    // ✅ Calculate total days in month
    const totalDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const totalAttendance = attendance.length;
    const pending = totalDays - totalAttendance;
    
    return { 
        present, 
        absent, 
        halfDay, 
        holiday, 
        total: totalAttendance,
        pending: pending,
        totalDays: totalDays
    };
};

// ✅ Get attendance with pending count for a date range
attendanceSchema.statics.getAttendanceWithPending = async function(workerId, startDate, endDate) {
    const attendance = await this.find({
        worker: workerId,
        date: { $gte: startDate, $lte: endDate }
    });
    
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const halfDay = attendance.filter(a => a.status === 'half-day').length;
    const holiday = attendance.filter(a => a.status === 'holiday').length;
    
    // ✅ Calculate total days and pending
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const totalAttendance = attendance.length;
    const pending = diffDays - totalAttendance;
    
    return {
        attendance: attendance,
        present: present,
        absent: absent,
        halfDay: halfDay,
        holiday: holiday,
        total: totalAttendance,
        pending: pending,
        totalDays: diffDays
    };
};

module.exports = mongoose.model('Attendance', attendanceSchema);