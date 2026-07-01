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
    adjustedAt: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { 
    timestamps: true 
});

// ✅ Indexes
paymentAdvanceSchema.index({ worker: 1, date: -1 });
paymentAdvanceSchema.index({ status: 1, worker: 1 });
paymentAdvanceSchema.index({ workerType: 1, status: 1 });


// Check if model exists, if not create it



module.exports = mongoose.model('PaymentAdvance', paymentAdvanceSchema);