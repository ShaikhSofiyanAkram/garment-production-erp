const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    workerType: { type: String, enum: ['karigar', 'pressman', 'helper', 'cutting', 'admin'], required: true },
    paymentType: { type: String, enum: ['piece', 'monthly'], default: 'piece' },
    monthlyRate: { type: Number, default: 0, min: 0 },
    // ✅ NEW: Link to User
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        sparse: true
    },
    joiningDate: { type: Date, default: Date.now },
    aadharNumber: { type: String, trim: true },
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        accountHolderName: String
    },
    documents: [{ name: String, url: String, uploadedAt: Date }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

workerSchema.index({ name: 1, workerType: 1 });
workerSchema.index({ isActive: 1, workerType: 1 });
workerSchema.index({ phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Worker', workerSchema);