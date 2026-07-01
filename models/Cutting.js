const mongoose = require('mongoose');

const cuttingSchema = new mongoose.Schema({
    cuttingNumber: { type: String, unique: true, sparse: true },
    client: { type: String, default: null },
    productName: { type: String, required: true },
    productCategory: { type: String, required: true },
    sizes: [{
        size: String,
        pieces: Number,
        assignedPieces: { type: Number, default: 0 }
    }],
    colors: [String],
    totalPieces: { type: Number, required: true },
    assignedPieces: { type: Number, default: 0 },
    remark: String,
    cuttingWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
        type: String, 
        enum: ['pending', 'assigned', 'partial', 'completed'], 
        default: 'pending' 
    },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Auto-generate cutting number
cuttingSchema.pre('save', async function(next) {
    if (!this.cuttingNumber) {
        const count = await mongoose.model('Cutting').countDocuments();
        this.cuttingNumber = `CUT-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Cutting', cuttingSchema);