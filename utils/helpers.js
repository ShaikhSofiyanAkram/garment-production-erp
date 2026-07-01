const moment = require('moment');

// Generate unique ID
function generateUniqueId(prefix = 'ID') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Calculate days difference
function daysDifference(date1, date2) {
    const diffTime = Math.abs(new Date(date2) - new Date(date1));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Validate production return
function validateProductionReturn(returned, damage, missing, given) {
    const total = returned + damage + missing;
    return {
        isValid: total === given,
        total,
        given,
        difference: total - given
    };
}

// Get status badge class
function getStatusBadgeClass(status) {
    const statusMap = {
        'pending': 'warning',
        'partial': 'info',
        'completed': 'success',
        'paid': 'success',
        'assigned': 'primary',
        'active': 'success',
        'inactive': 'danger'
    };
    return statusMap[status] || 'secondary';
}

// Format date
function formatDate(date, format = 'DD/MM/YYYY') {
    return moment(date).format(format);
}

module.exports = {
    generateUniqueId,
    formatCurrency,
    daysDifference,
    validateProductionReturn,
    getStatusBadgeClass,
    formatDate
};