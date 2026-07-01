const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['general', 'rates', 'system', 'backup', 'roles']
    },
    key: {
        type: String,
        required: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: String,
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for unique category+key
settingSchema.index({ category: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Setting', settingSchema);