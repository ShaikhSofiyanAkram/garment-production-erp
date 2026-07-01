const mongoose = require('mongoose');

const fabricConsumptionSchema = new mongoose.Schema({
    consumptionNumber: { type: String, unique: true },
    fabricStock: { type: mongoose.Schema.Types.ObjectId, ref: 'FabricStock', required: true },
    cutting: { type: mongoose.Schema.Types.ObjectId, ref: 'Cutting' },
    consumedMeters: { type: Number, required: true, min: 0 },
    wastedMeters: { type: Number, default: 0 },
    productName: { type: String, required: true },
    productCategory: { type: String, required: true },
    totalPieces: { type: Number, required: true },
    metersPerPiece: { type: Number, required: true },
    consumptionDate: { type: Date, default: Date.now },
    remark: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

fabricConsumptionSchema.pre('save', async function(next) {
    if (!this.consumptionNumber) {
        const count = await mongoose.model('FabricConsumption').countDocuments();
        this.consumptionNumber = `CONS-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('FabricConsumption', fabricConsumptionSchema);   





// const mongoose = require('mongoose');
// const fabricConsumptionSchema = new mongoose.Schema({
//     consumptionNumber: {
//         type: String,
//         unique: true
//     },
//     fabricStock: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'FabricStock',
//         required: true
//     },
    
//     // Reference to cutting where fabric was used
//     cutting: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Cutting'
//     },
    
//     // Consumption Details
//     consumedMeters: {
//         type: Number,
//         required: true,
//         min: 0
//     },
//     wastedMeters: {
//         type: Number,
//         default: 0
//     },
    
//     // Product Details
//     productName: {
//         type: String,
//         required: true
//     },
//     productCategory: {
//         type: String,
//         required: true
//     },
//     totalPieces: {
//         type: Number,
//         required: true
//     },
    
//     // Per-piece consumption
//     metersPerPiece: {
//         type: Number,
//         required: true
//     },
    
//     consumptionDate: {
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

// // Auto generate consumption number
// fabricConsumptionSchema.pre('save', async function(next) {
//     if (!this.consumptionNumber) {
//         const count = await mongoose.model('FabricConsumption').countDocuments();
//         this.consumptionNumber = `CONS-${String(count + 1).padStart(5, '0')}`;
//     }
//     next();
// });

// module.exports = mongoose.model('FabricConsumption', fabricConsumptionSchema);