const mongoose = require('mongoose');

// ⭐ Size Rate Schema
const sizeRateSchema = new mongoose.Schema({
    size: { type: String, required: true },
    clientRate: { type: Number, required: true, default: 0, min: 0 },
    karigarRate: { type: Number, required: true, default: 0, min: 0 }
}, { _id: false });

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true, enum: ['Kids', 'Mens', 'Other'] },
    customCategory: { type: String, default: '' },
    
    // ⭐ MAIN: Size-wise rates
    sizeRates: [sizeRateSchema],
    
    sizes: [String],
    colors: [String],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Method to get rate for a specific size
productSchema.methods.getRate = function(size, type = 'client') {
    if (this.sizeRates && this.sizeRates.length > 0) {
        const sizeRate = this.sizeRates.find(sr => sr.size === size);
        if (sizeRate) {
            return type === 'client' ? sizeRate.clientRate : sizeRate.karigarRate;
        }
    }
    return 0;
};

// Method to get all rates for display
productSchema.methods.getAllRates = function() {
    if (this.sizeRates && this.sizeRates.length > 0) {
        return this.sizeRates;
    }
    return [];
};

// Auto-generate sizes based on category
productSchema.pre('save', function(next) {
    if ((!this.sizes || this.sizes.length === 0) && this.category !== 'Other') {
        switch(this.category) {
            case 'Kids':
                this.sizes = ['1','2','3','4','5','6','7','8','9','10','11','12'];
                break;
            case 'Mens':
                this.sizes = [];
                for (let i = 26; i <= 60; i += 2) {
                    this.sizes.push(i.toString());
                }
                break;
        }
    }
    next();
});

module.exports = mongoose.model('Product', productSchema);