const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerType: { type: String, enum: ['helper', 'cutting', 'karigar', 'pressman'], required: true },
    amount: { type: Number, required: true },
    paymentType: { type: String, enum: ['salary', 'piece_wage', 'advance_settlement'], required: true },
    paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'cheque', 'upi'], default: 'cash' },
    reference: String,
    paymentDate: { type: Date, default: Date.now },
    month: Number,
    year: Number,
    fromDate: Date,
    toDate: Date,
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);