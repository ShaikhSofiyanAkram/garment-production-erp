const mongoose = require('mongoose');

const billPaymentSchema = new mongoose.Schema({
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    amount: { type: Number, required: true },
    advanceAmount: { type: Number, default: 0 },
    cashAmount: { type: Number, default: 0 },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'cheque', 'upi'], default: 'cash' },
    reference: String,
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('BillPayment', billPaymentSchema);