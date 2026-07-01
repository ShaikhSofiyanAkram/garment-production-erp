const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque'],
        default: 'Cash'
    },
    reference: {
        type: String,
        trim: true
    },
    remark: {
        type: String,
        trim: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    // ✅ For adjusting advances
    advanceIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Advance'
    }],
    adjustedAdvanceAmount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed'],
        default: 'pending'
    }
}, { 
    timestamps: true 
});

// ✅ Indexes
paymentSchema.index({ worker: 1, paymentDate: -1 });
paymentSchema.index({ workerType: 1, paymentDate: -1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);