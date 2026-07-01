const mongoose = require('mongoose');

const attendanceBulkSchema = new mongoose.Schema({
    batchNumber: { type: String, unique: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    entries: [{
        worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
        workerType: String,
        date: Date,
        status: String,
        note: String
    }],
    totalEntries: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'submitted', 'approved'], default: 'submitted' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
});

attendanceBulkSchema.pre('save', async function(next) {
    if (!this.batchNumber) {
        const count = await mongoose.model('AttendanceBulk').countDocuments();
        const year = new Date().getFullYear();
        const week = Math.ceil((new Date() - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        this.batchNumber = `ATT-${year}-W${week}-${String(count + 1).padStart(3, '0')}`;
    }
    next();
});

module.exports = mongoose.model('AttendanceBulk', attendanceBulkSchema);