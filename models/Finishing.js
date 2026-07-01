const mongoose = require('mongoose');

const finishingSchema = new mongoose.Schema({
    finishingNumber: { type: String, unique: true },
    productionReturn: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionReturn', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    helper: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    
    receivedPieces: { type: Number, required: true },
    rejectedPieces: { type: Number, default: 0 },
    passedPieces: { type: Number, default: 0 },
    
    sizeBreakdown: [{
        size: String,
        received: Number,
        rejected: Number,
        passed: Number
    }],
    
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    },
    
    finishingDate: { type: Date, default: Date.now },
    completedDate: Date,
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto generate finishing number
finishingSchema.pre('save', async function(next) {
    if (!this.finishingNumber) {
        const count = await mongoose.model('Finishing').countDocuments();
        this.finishingNumber = `FIN-${String(count + 1).padStart(5, '0')}`;
    }
    
    this.passedPieces = this.receivedPieces - this.rejectedPieces;
    
    // ✅ Auto set status
    if (this.passedPieces >= 0) {
        this.status = 'completed';
        this.completedDate = new Date();
    }
    
    next();
});

module.exports = mongoose.model('Finishing', finishingSchema);