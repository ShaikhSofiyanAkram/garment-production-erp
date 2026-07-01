const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true
    },
    workerType: {
        type: String,
        enum: ['cutting', 'helper', 'karigar', 'pressman'],
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'half_day', 'leave', 'holiday'],
        default: 'absent'
    },
    checkIn: {
        type: Date
    },
    checkOut: {
        type: Date
    },
    workingHours: {
        type: Number,
        default: 0
    },
    note: {
        type: String,
        default: ''
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    markedAt: {
        type: Date,
        default: Date.now
    }
});

attendanceSchema.index({ worker: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);