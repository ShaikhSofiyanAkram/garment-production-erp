const mongoose = require('mongoose');

const fabricItemSchema = new mongoose.Schema({
    fabricType: {
        type: String,
        required: true,
        trim: true
    },
    totalMeters: {
        type: Number,
        required: true,
        min: 0
    },
    color: {
        type: String,
        default: ''
    },
    remark: {
        type: String,
        default: ''
    }
});

const fabricBatchSchema = new mongoose.Schema({
    batchNumber: {
        type: String,
        unique: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    items: [fabricItemSchema],
    totalMeters: {
        type: Number,
        default: 0
    },
    totalItems: {
        type: Number,
        default: 0
    },
    supplier: {
        type: String,
        default: ''
    },
    overallRemark: {
        type: String,
        default: ''
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Generate batch number before saving
fabricBatchSchema.pre('save', async function(next) {
    if (!this.batchNumber) {
        const date = new Date(this.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const FabricBatch = mongoose.model('FabricBatch');
        const count = await FabricBatch.countDocuments({ date: this.date });
        this.batchNumber = `FAB-${year}${month}${day}-${String(count + 1).padStart(3, '0')}`;
    }
    
    // Calculate totals
    this.totalItems = this.items.length;
    this.totalMeters = this.items.reduce((sum, item) => sum + (item.totalMeters || 0), 0);
    next();
});

module.exports = mongoose.model('FabricBatch', fabricBatchSchema);