const mongoose = require('mongoose');

const paymentAdvanceSchema = new mongoose.Schema({
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true
    },
    workerType: {
        type: String,
        enum: ['karigar', 'pressman', 'helper', 'cutting'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    purpose: {
        type: String,
        trim: true,
        default: 'General'
    },
    remark: {
        type: String,
        trim: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'adjusted', 'cancelled'],
        default: 'pending'
    },
    adjustedInPayment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    adjustedAmount: {
        type: Number,
        default: 0
    },
    adjustedAt: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { 
    timestamps: true 
});

// ✅ Indexes
paymentAdvanceSchema.index({ worker: 1, date: -1 });
paymentAdvanceSchema.index({ status: 1, worker: 1 });

// ✅ Get pending total for a worker
paymentAdvanceSchema.statics.getPendingTotal = async function(workerId) {
    const result = await this.aggregate([
        { $match: { worker: workerId, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    return result[0]?.total || 0;
};

module.exports = mongoose.model('PaymentAdvance', paymentAdvanceSchema);