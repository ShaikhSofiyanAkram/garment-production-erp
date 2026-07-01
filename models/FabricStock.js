// const mongoose = require('mongoose');

// const fabricStockSchema = new mongoose.Schema({
//     // Batch Information
//     batchNumber: {
//         type: String,
//         required: true,
//         unique: true
//     },
//     fabricType: {
//         type: String,
//         required: true,
//         trim: true
//     },
//     fabricName: {
//         type: String,
//         required: true,
//         trim: true
//     },
//     color: {
//         type: String,
//         default: ''
//     },
    
//     // Supplier Information
//     supplier: {
//         type: String,
//         default: ''
//     },
//     purchaseDate: {
//         type: Date,
//         required: true,
//         default: Date.now
//     },
//     invoiceNumber: {
//         type: String,
//         default: ''
//     },
    
//     // Quantity Details
//     rollNumber: {
//         type: String,
//         default: ''
//     },
//     metersPerRoll: {
//         type: Number,
//         default: 0
//     },
//     totalRolls: {
//         type: Number,
//         required: true,
//         min: 1
//     },
//     totalMeters: {
//         type: Number,
//         required: true,
//         min: 0
//     },
    
//     // Stock Tracking
//     remainingMeters: {
//         type: Number,
//         required: true,
//         default: 0
//     },
//     consumedMeters: {
//         type: Number,
//         default: 0
//     },
//     wastedMeters: {
//         type: Number,
//         default: 0
//     },
    
//     // Status
//     status: {
//         type: String,
//         enum: ['in_stock', 'partial', 'exhausted', 'wasted'],
//         default: 'in_stock'
//     },
    
//     // Metadata
//     remark: {
//         type: String,
//         default: ''
//     },
//     createdBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//     },
//     createdAt: {
//         type: Date,
//         default: Date.now
//     },
//     updatedAt: {
//         type: Date,
//         default: Date.now
//     }
// });

// // Update remaining meters before save
// fabricStockSchema.pre('save', function(next) {
//     this.remainingMeters = this.totalMeters - (this.consumedMeters || 0) - (this.wastedMeters || 0);
    
//     if (this.remainingMeters <= 0) {
//         this.status = 'exhausted';
//     } else if (this.consumedMeters > 0 || this.wastedMeters > 0) {
//         this.status = 'partial';
//     } else {
//         this.status = 'in_stock';
//     }
    
//     this.updatedAt = new Date();
//     next();
// });

// module.exports = mongoose.model('FabricStock', fabricStockSchema);

const mongoose = require('mongoose');

const fabricStockSchema = new mongoose.Schema({
    batchNumber: { type: String, unique: true },
    fabricType: { type: String, required: true, trim: true },
    fabricName: { type: String, required: true, trim: true },
    color: { type: String, default: '' },
    supplier: { type: String, default: '' },
    purchaseDate: { type: Date, required: true, default: Date.now },
    invoiceNumber: { type: String, default: '' },
    rollNumber: { type: String, default: '' },
    metersPerRoll: { type: Number, default: 0 },
    totalRolls: { type: Number, required: true, min: 1 },
    totalMeters: { type: Number, required: true, min: 0 },
    remainingMeters: { type: Number, required: true, default: 0 },
    consumedMeters: { type: Number, default: 0 },
    wastedMeters: { type: Number, default: 0 },
    status: { type: String, enum: ['in_stock', 'partial', 'exhausted', 'wasted'], default: 'in_stock' },
    remark: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

fabricStockSchema.pre('save', function(next) {
    this.remainingMeters = this.totalMeters - (this.consumedMeters || 0) - (this.wastedMeters || 0);
    if (this.remainingMeters <= 0) this.status = 'exhausted';
    else if (this.consumedMeters > 0 || this.wastedMeters > 0) this.status = 'partial';
    else this.status = 'in_stock';
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('FabricStock', fabricStockSchema);