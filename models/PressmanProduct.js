const mongoose = require('mongoose');

const pressmanProductSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    category: { 
        type: String, 
        enum: ['Kids', 'Mens', 'Both', 'Other'],
        default: 'Mens'
    },
    hasSizeRates: {
        type: Boolean,
        default: false
    },
    rate: { 
        type: Number, 
        min: 0,
        default: 0
    },
    sizeRates: {
        type: [{
            size: {
                type: String,
                required: true,
                trim: true
            },
            rate: {
                type: Number,
                required: true,
                min: 0
            }
        }],
        default: []
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    description: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { 
    timestamps: true 
});

// ✅ Indexes
pressmanProductSchema.index({ name: 1 }, { unique: true });
pressmanProductSchema.index({ isActive: 1, category: 1 });

module.exports = mongoose.model('PressmanProduct', pressmanProductSchema);