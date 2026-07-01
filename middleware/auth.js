// middleware/auth.js
const protect = async (req, res, next) => {
    // Check if session exists
    if (!req.session) {
        req.flash('error_msg', 'Session expired. Please login again.');
        return res.redirect('/auth/login');
    }
    
    if (!req.session.user) {
        req.flash('error_msg', 'Please login to access this resource');
        return res.redirect('/auth/login');
    }
    next();
};

const adminOnly = async (req, res, next) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
        req.flash('error_msg', 'Admin access required');
        return res.redirect('/dashboard');
    }
    next();
};

const workerAccess = async (req, res, next) => {
    if (!req.session || !req.session.user) {
        req.flash('error_msg', 'Please login');
        return res.redirect('/auth/login');
    }
    next();
};

module.exports = { protect, adminOnly, workerAccess };