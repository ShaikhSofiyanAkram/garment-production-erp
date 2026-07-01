const mongoose = require('mongoose');

const karigarEntrySchema = new mongoose.Schema({
    entryNumber: { type: String, unique: true },
    karigar: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    date: { type: Date, default: Date.now, required: true },
    
    entries: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        size: String,
        quantity: { type: Number, default: 0 },
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }
    }],
    
    totalQuantity: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    
    status: { type: String, enum: ['pending', 'approved', 'paid'], default: 'pending' },
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

karigarEntrySchema.pre('save', async function(next) {
    if (!this.entryNumber) {
        const count = await mongoose.model('KarigarEntry').countDocuments();
        this.entryNumber = `KAR-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('KarigarEntry', karigarEntrySchema);