const mongoose = require('mongoose');

const paymentHelperSchema = new mongoose.Schema({
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    month: Number,
    year: Number,
    totalDaysPresent: { type: Number, default: 0 },
    totalDaysAbsent: { type: Number, default: 0 },
    monthlySalary: { type: Number, default: 0 },
    advanceGiven: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
    paymentDate: Date,
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentHelper', paymentHelperSchema);