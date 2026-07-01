const mongoose = require('mongoose');

const pressmanEntrySchema = new mongoose.Schema({
    entryNumber: { 
        type: String, 
        unique: true,
        sparse: true
    },
    pressman: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Worker',
        required: true 
    },
    date: { 
        type: Date, 
        default: Date.now,
        required: true 
    },
    entries: [{
        product: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'PressmanProduct',
            required: true 
        },
        productName: {
            type: String,
            required: true
        },
        size: {
            type: String,
            default: 'One Size'
        },
        quantity: { 
            type: Number, 
            required: true,
            min: 1,
            default: 0 
        },
        rate: { 
            type: Number, 
            required: true,
            min: 0,
            default: 0 
        },
        amount: { 
            type: Number, 
            required: true,
            min: 0,
            default: 0 
        }
    }],
    totalQuantity: { 
        type: Number, 
        default: 0 
    },
    totalAmount: { 
        type: Number, 
        default: 0 
    },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'paid', 'rejected'],
        default: 'pending' 
    },
    remark: {
        type: String,
        trim: true
    },
    paymentDate: {
        type: Date
    },
    paidAmount: {
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
    approvedAt: Date
}, { 
    timestamps: true 
});

// ✅ FIXED: Auto-generate entry number with duplicate check
pressmanEntrySchema.pre('save', async function(next) {
    try {
        // ✅ If entryNumber already exists, skip generation
        if (this.entryNumber) {
            return next();
        }
        
        // ✅ Get the highest entry number
        const lastEntry = await this.constructor.findOne(
            {},
            { entryNumber: 1 },
            { sort: { entryNumber: -1 } }
        );
        
        let nextNumber = 1;
        if (lastEntry && lastEntry.entryNumber) {
            const match = lastEntry.entryNumber.match(/PRS-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }
        
        // ✅ Generate new entry number
        this.entryNumber = `PRS-${String(nextNumber).padStart(5, '0')}`;
        
        // ✅ Calculate totals
        this.totalQuantity = this.entries.reduce((sum, e) => sum + (e.quantity || 0), 0);
        this.totalAmount = this.entries.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        console.log('✅ Generated entry number:', this.entryNumber);
        next();
        
    } catch (error) {
        console.error('❌ Error generating entry number:', error);
        next(error);
    }
});

// ✅ Indexes
pressmanEntrySchema.index({ entryNumber: 1 }, { unique: true, sparse: true });
pressmanEntrySchema.index({ pressman: 1, date: -1 });
pressmanEntrySchema.index({ status: 1 });

module.exports = mongoose.model('PressmanEntry', pressmanEntrySchema);