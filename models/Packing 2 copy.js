const mongoose = require('mongoose');

const packingSchema = new mongoose.Schema({
    packingNumber: { type: String, unique: true },
    packingDate: { type: Date, default: Date.now },
    
    entries: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        category: String,
        size: String,
        packedPieces: { type: Number, default: 0 }
    }],

    totalPieces: { type: Number, default: 0 },
    
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

packingSchema.pre('save', async function(next) {
    if (!this.packingNumber) {
        const count = await mongoose.model('Packing').countDocuments();
        this.packingNumber = `PAC-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Packing', packingSchema);