const mongoose = require('mongoose');

const productionReturnSchema = new mongoose.Schema({
    returnNumber: {
        type: String,
        unique: true
    },
    assignment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
        required: true
    },
    karigar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true
    },
    cutting: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cutting'
    },
    productName: {
        type: String,
        required: true
    },
    productCategory: {
        type: String,
        required: true
    },
    
    // Size-wise return data
    sizes: [{
        size: String,
        given: Number,           // Original given to karigar for this size
        returned: Number,        // Returned (good pieces)
        damage: Number,          // Damaged pieces
        missing: Number,         // Missing pieces
        alreadyReturned: Number, // Previously returned for this size
        remaining: Number        // Still remaining to return
    }],
    
    // Totals
    totalGiven: {
        type: Number,
        required: true
    },
    totalReturned: {
        type: Number,
        default: 0
    },
    totalDamage: {
        type: Number,
        default: 0
    },
    totalMissing: {
        type: Number,
        default: 0
    },
    
    // Partial tracking
    isPartial: {
        type: Boolean,
        default: false
    },
    parentReturn: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductionReturn'
    },
    previousTotalReturned: {
        type: Number,
        default: 0
    },
    
    // Status
    status: {
        type: String,
        enum: ['pending', 'partial', 'completed'],
        default: 'pending'
    },
    
    // Additional fields
    damageReason: {
        type: String,
        default: ''
    },
    missingReason: {
        type: String,
        default: ''
    },
    remark: {
        type: String,
        default: ''
    },
    
    returnDate: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

// Auto generate return number
productionReturnSchema.pre('save', async function(next) {
    if (!this.returnNumber) {
        const count = await mongoose.model('ProductionReturn').countDocuments();
        this.returnNumber = `PRN-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

// Calculate status
productionReturnSchema.pre('save', function(next) {
    const totalReturnedNow = this.totalReturned + this.totalDamage + this.totalMissing;
    if (totalReturnedNow >= this.totalGiven) {
        this.status = 'completed';
        this.isPartial = false;
    } else if (totalReturnedNow > 0) {
        this.status = 'partial';
        this.isPartial = true;
    } else {
        this.status = 'pending';
    }
    next();
});

module.exports = mongoose.model('ProductionReturn', productionReturnSchema);