const mongoose = require('mongoose');

const advanceClientSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    amount: { type: Number, required: true },
    remainingAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'cheque', 'upi'], default: 'cash' },
    reference: String,
    paymentDate: { type: Date, default: Date.now },
    adjustedBills: [{
        bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
        amount: Number,
        adjustedDate: { type: Date, default: Date.now }
    }],
    status: { type: String, enum: ['active', 'partial', 'exhausted'], default: 'active' },
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// ✅ Auto update remainingAmount and status before save
advanceClientSchema.pre('save', function(next) {
    const totalAdjusted = this.adjustedBills.reduce((sum, adj) => sum + adj.amount, 0);
    this.remainingAmount = this.amount - totalAdjusted;
    
    if (this.remainingAmount <= 0) {
        this.status = 'exhausted';
    } else if (totalAdjusted > 0) {
        this.status = 'partial';
    } else {
        this.status = 'active';
    }
    
    console.log(`📊 Advance ${this._id}: amount=${this.amount}, adjusted=${totalAdjusted}, remaining=${this.remainingAmount}, status=${this.status}`);
    next();
});

module.exports = mongoose.model('AdvanceClient', advanceClientSchema);