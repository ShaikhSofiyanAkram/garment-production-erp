const mongoose = require('mongoose');

const fabricWasteSchema = new mongoose.Schema({
    wasteNumber: { type: String, unique: true },
    fabricStock: { type: mongoose.Schema.Types.ObjectId, ref: 'FabricStock', required: true },
    wastedMeters: { type: Number, required: true, min: 0 },
    wasteType: { type: String, enum: ['cutting_waste', 'damage', 'defective', 'sample', 'other'], required: true },
    wasteReason: { type: String, required: true },
    wasteDate: { type: Date, default: Date.now },
    remark: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

fabricWasteSchema.pre('save', async function(next) {
    if (!this.wasteNumber) {
        const count = await mongoose.model('FabricWaste').countDocuments();
        this.wasteNumber = `WSTE-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('FabricWaste', fabricWasteSchema);
// const mongoose = require('mongoose');

// const fabricWasteSchema = new mongoose.Schema({
//     wasteNumber: {
//         type: String,
//         unique: true
//     },
//     fabricStock: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'FabricStock',
//         required: true
//     },
    
//     // Waste Details
//     wastedMeters: {
//         type: Number,
//         required: true,
//         min: 0
//     },
//     wasteType: {
//         type: String,
//         enum: ['cutting_waste', 'damage', 'defective', 'sample', 'other'],
//         required: true
//     },
//     wasteReason: {
//         type: String,
//         required: true
//     },
    
//     wasteDate: {
//         type: Date,
//         default: Date.now
//     },
    
//     remark: {
//         type: String,
//         default: ''
//     },
    
//     createdBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//     }
// });

// // Auto generate waste number
// fabricWasteSchema.pre('save', async function(next) {
//     if (!this.wasteNumber) {
//         const count = await mongoose.model('FabricWaste').countDocuments();
//         this.wasteNumber = `WSTE-${String(count + 1).padStart(5, '0')}`;
//     }
//     next();
// });

// module.exports = mongoose.model('FabricWaste', fabricWasteSchema);