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

// ✅ FIXED: Generate packing number with proper sequence
packingSchema.pre('save', async function(next) {
    if (!this.packingNumber) {
        try {
            // ✅ Get the last packing number and increment
            const lastPacking = await mongoose.model('Packing')
                .findOne()
                .sort({ packingNumber: -1 })
                .select('packingNumber');
            
            let nextNumber = 1;
            if (lastPacking && lastPacking.packingNumber) {
                const lastNum = parseInt(lastPacking.packingNumber.replace('PAC-', ''));
                if (!isNaN(lastNum)) {
                    nextNumber = lastNum + 1;
                }
            }
            
            this.packingNumber = `PAC-${String(nextNumber).padStart(5, '0')}`;
        } catch (error) {
            console.error('Error generating packing number:', error);
            // ✅ Fallback: use timestamp
            this.packingNumber = `PAC-${Date.now().toString().slice(-6)}`;
        }
    }
    next();
});

module.exports = mongoose.model('Packing', packingSchema);