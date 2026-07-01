const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userType: {
        type: String,
        enum: ['admin', 'cutting', 'karigar', 'helper', 'pressman'],
        required: true
    },
    action: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'PRINT', 'EXPORT'],
        required: true
    },
    module: {
        type: String,
        enum: ['auth', 'cutting', 'assignment', 'production', 'finishing', 'packing', 'billing', 'payment', 'worker', 'product', 'fabric', 'settings', 'report'],
        required: true
    },
    recordId: {
        type: mongoose.Schema.Types.ObjectId
    },
    details: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
        changes: String
    },
    ipAddress: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ module: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);