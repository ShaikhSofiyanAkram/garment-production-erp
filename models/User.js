const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['admin', 'cutting', 'karigar', 'helper', 'pressman', 'worker'],
        default: 'worker'
    },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// ✅ Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        console.log('✅ Password hashed successfully');
        next();
    } catch (error) {
        console.error('❌ Password hashing error:', error);
        next(error);
    }
});

// ✅ Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        if (!this.password) return false;
        const result = await bcrypt.compare(candidatePassword, this.password);
        console.log('🔑 comparePassword result:', result);
        return result;
    } catch (error) {
        console.error('❌ comparePassword error:', error);
        return false;
    }
};

module.exports = mongoose.model('User', userSchema);