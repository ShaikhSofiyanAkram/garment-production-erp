const mongoose = require('mongoose');

const blockedMonthSchema = new mongoose.Schema({
    month: {
        type: String,
        required: true,
        unique: true
    },
    blocked: {
        type: Boolean,
        default: true
    },
    blockedAt: {
        type: Date,
        default: Date.now
    },
    blockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker'
    },
    remark: {
        type: String,
        trim: true
    }
}, { timestamps: true });

blockedMonthSchema.index({ month: 1 }, { unique: true });

module.exports = mongoose.model('BlockedMonth', blockedMonthSchema);