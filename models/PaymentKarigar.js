const mongoose = require('mongoose');

const paymentKarigarSchema = new mongoose.Schema({
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    weekStart: Date,
    weekEnd: Date,
    totalPieces: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    advanceGiven: { type: Number, default: 0 },
    advanceRemark: String,
    netPayable: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
    paymentDate: Date,
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentKarigar', paymentKarigarSchema);