const Worker = require('../models/Worker');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// ============ LIST WORKERS ============
exports.getWorkers = async (req, res) => {
    try {
        const workers = await Worker.find({ isActive: true }).sort({ createdAt: -1 });
        res.render('workers/index', { 
            title: 'Workers Management', 
            workers,
            user: req.session.user,
            currentPage: 'workers',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching workers');
        res.redirect('/dashboard');
    }
};

// ============ CREATE WORKER (SIMPLE - No Login) ============
exports.createForm = (req, res) => {
    res.render('workers/create', { 
        title: 'Add New Worker',
        user: req.session.user,
        currentPage: 'workers'
    });
};

exports.createWorker = async (req, res) => {
    try {
        const { name, phone, email, address, workerType, paymentType, monthlyRate } = req.body;
        
        // Check if email exists
        const existing = await Worker.findOne({ email });
        if (existing) {
            req.flash('error_msg', 'Worker with this email already exists!');
            return res.redirect('/workers/create');
        }
        
        const workerData = {
            name,
            phone,
            email,
            address,
            workerType,
            paymentType,
            isActive: true,
            documents: {
                aadhar: req.files?.aadhar ? req.files.aadhar[0].filename : null,
                pan: req.files?.pan ? req.files.pan[0].filename : null,
                photo: req.files?.photo ? req.files.photo[0].filename : null
            }
        };
        
        if (paymentType === 'monthly' && monthlyRate) {
            workerData.monthlyRate = parseFloat(monthlyRate);
        }
        
        await Worker.create(workerData);
        
        req.flash('success_msg', `Worker "${name}" added successfully!`);
        res.redirect('/workers');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating worker: ' + error.message);
        res.redirect('/workers/create');
    }
};

// ============ REGISTER WORKER (WITH LOGIN CREDENTIALS) ============
exports.registerForm = async (req, res) => {
    try {
        res.render('workers/register-worker', {
            title: 'Register New Worker',
            user: req.session.user,
            currentPage: 'register-worker',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/workers');
    }
};

// ==================== REGISTER WORKER (WITH LOGIN CREDENTIALS) ====================
// ==================== REGISTER WORKER ====================
// ==================== REGISTER WORKER (COMPLETE FIX) ====================
// ==================== REGISTER WORKER (COMPLETE FIX WITH DEBUG) ====================
// ==================== REGISTER WORKER (FIXED - No Spread Operator) ====================
// ==================== REGISTER WORKER (FIXED - AUTO HASH) ====================
exports.registerWorker = async (req, res) => {
    try {
        const { 
            name, email, phone, address, workerType, 
            paymentType, monthlyRate, username, password 
        } = req.body;
        
        console.log('📝 ===== REGISTERING WORKER =====');
        console.log('📝 Name:', name);
        console.log('📝 Email:', email);
        console.log('📝 Username:', username);
        
        // ✅ Validate
        if (!name || !email || !phone || !workerType) {
            req.flash('error_msg', 'All required fields must be filled');
            return res.redirect('/workers/register');
        }
        
        // ✅ Check existing
        const existingWorker = await Worker.findOne({ 
            $or: [{ phone }, { email }] 
        });
        if (existingWorker) {
            req.flash('error_msg', 'Worker already exists');
            return res.redirect('/workers/register');
        }
        
        const finalUsername = username || name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
        const finalPassword = password || 'worker123';
        
        // ✅ Check existing user
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username: finalUsername }] 
        });
        if (existingUser) {
            req.flash('error_msg', 'Email or username already exists');
            return res.redirect('/workers/register');
        }
        
        // ✅ Create Worker
        const worker = new Worker({
            name: name,
            email: email,
            phone: phone,
            address: address || '',
            workerType: workerType,
            paymentType: paymentType || 'piece',
            monthlyRate: monthlyRate || 0,
            isActive: true,
            createdBy: req.session.user.id
        });
        await worker.save();
        console.log('✅ Worker saved:', worker._id);
        
        // ✅ AUTO HASH PASSWORD
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(finalPassword, salt);
        console.log('🔑 Auto-hashed password:', hashedPassword);
        
        // ✅ Create User with hashed password
        const user = new User({
            username: finalUsername,
            email: email,
            password: hashedPassword,  // ✅ AUTO HASHED
            role: workerType === 'cutting' ? 'cutting' :
                  workerType === 'karigar' ? 'karigar' :
                  workerType === 'helper' ? 'helper' :
                  workerType === 'pressman' ? 'pressman' : 'worker',
            workerId: worker._id,
            isActive: true
        });
        await user.save();
        console.log('✅ User saved:', user._id);
        
        worker.userId = user._id;
        await worker.save();
        
        req.flash('success_msg', 
            '✅ Worker "' + name + '" registered!<br>' +
            '🔑 Username: <strong>' + finalUsername + '</strong><br>' +
            '🔑 Password: <strong>' + finalPassword + '</strong>'
        );
        res.redirect('/workers');
        
    } catch (error) {
        console.error('❌ Register error:', error);
        req.flash('error_msg', 'Error: ' + error.message);
        res.redirect('/workers/register');
    }
};


// ============ EDIT WORKER ============
exports.editForm = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/workers');
        }
        res.render('workers/edit', { 
            title: 'Edit Worker', 
            worker,
            user: req.session.user,
            currentPage: 'workers'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching worker');
        res.redirect('/workers');
    }
};

exports.updateWorker = async (req, res) => {
    try {
        const { name, phone, email, address, workerType, paymentType, monthlyRate, isActive } = req.body;
        
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/workers');
        }
        
        const updateData = {
            name,
            phone,
            email,
            address,
            workerType,
            paymentType,
            isActive: isActive === 'on'
        };
        
        if (paymentType === 'monthly' && monthlyRate) {
            updateData.monthlyRate = parseFloat(monthlyRate);
        } else {
            updateData.monthlyRate = 0;
        }
        
        await Worker.findByIdAndUpdate(req.params.id, updateData);
        
        // Update User email if changed
        if (worker.userId && email !== worker.email) {
            await User.findByIdAndUpdate(worker.userId, { email: email });
        }
        
        req.flash('success_msg', 'Worker updated successfully');
        res.redirect('/workers');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating worker');
        res.redirect(`/workers/edit/${req.params.id}`);
    }
};

// ============ DELETE WORKER ============
exports.deleteWorker = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (worker) {
            if (worker.userId) {
                await User.findByIdAndDelete(worker.userId);
            }
            await Worker.findByIdAndDelete(req.params.id);
        }
        req.flash('success_msg', 'Worker deleted successfully');
        res.redirect('/workers');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting worker');
        res.redirect('/workers');
    }
};

// ============ VIEW WORKER DETAILS ============
// ==================== VIEW WORKER DETAILS ====================
exports.viewWorker = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/workers');
        }
        
        // Get user details if exists
        let user = null;
        if (worker.userId) {
            user = await User.findById(worker.userId);
        }
        
        res.render('workers/view', {
            title: `Worker Details: ${worker.name}`,
            worker: worker,
            user: user,
            currentPage: 'workers'
        });
    } catch (error) {
        console.error('❌ View worker error:', error);
        req.flash('error_msg', 'Error loading worker details');
        res.redirect('/workers');
    }
};

// ============ API ROUTES ============
exports.getPaymentHistory = async (req, res) => {
    try {
        const Payment = require('../models/Payment');
        const payments = await Payment.find({ worker: req.params.id }).sort({ paymentDate: -1 });
        res.json({ payments });
    } catch (error) {
        res.json({ payments: [] });
    }
};

exports.getKarigarWork = async (req, res) => {
    try {
        const Assignment = require('../models/Assignment');
        const assignments = await Assignment.find({
            karigar: req.params.id,
            status: 'completed'
        }).populate('product');
        
        const work = [];
        for (const a of assignments) {
            const weekStart = new Date(a.assignedDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            work.push({
                weekStart, weekEnd,
                product: a.product?.name || 'Unknown',
                pieces: a.givenPieces,
                amount: a.givenPieces * (a.product?.rates?.karigar || 0)
            });
        }
        res.json({ work });
    } catch (error) {
        res.json({ work: [] });
    }
};

exports.getPressmanWork = async (req, res) => {
    try {
        const PressmanEntry = require('../models/PressmanEntry');
        const entries = await PressmanEntry.find({ pressman: req.params.id }).sort({ date: -1 });
        res.json({ entries });
    } catch (error) {
        res.json({ entries: [] });
    }
};








// ==================== CREATE WORKER (WITHOUT LOGIN) ====================
exports.createWorker = async (req, res) => {
    try {
        const { name, email, phone, address, workerType, paymentType, monthlyRate } = req.body;
        
        console.log('📝 Creating worker (no login):', { name, workerType });
        
        const existingWorker = await Worker.findOne({ phone: phone });
        if (existingWorker) {
            req.flash('error_msg', 'Worker with this phone already exists');
            return res.redirect('/workers/create');
        }
        
        const worker = new Worker({
            name: name,
            email: email || '',
            phone: phone,
            address: address || '',
            workerType: workerType,
            paymentType: paymentType || 'piece',
            monthlyRate: monthlyRate || 0,
            isActive: true,
            createdBy: req.session.user.id
        });
        
        await worker.save();
        
        req.flash('success_msg', 'Worker "' + name + '" added successfully!');
        res.redirect('/workers');
        
    } catch (error) {
        console.error('❌ Create worker error:', error);
        req.flash('error_msg', 'Error adding worker: ' + error.message);
        res.redirect('/workers/create');
    }
};

// ==================== GET WORKERS LIST ====================
exports.getWorkers = async (req, res) => {
    try {
        const workers = await Worker.find().sort({ createdAt: -1 });
        res.render('workers/index', {
            title: 'Workers Management',
            workers: workers,
            currentPage: 'workers',
            user: req.session.user
        });
    } catch (error) {
        console.error('❌ Get workers error:', error);
        req.flash('error_msg', 'Error loading workers');
        res.redirect('/dashboard');
    }
};

// ==================== GET REGISTER FORM ====================
exports.registerForm = async (req, res) => {
    res.render('workers/register-worker', {
        title: 'Register Worker',
        currentPage: 'workers',
        user: req.session.user
    });
};

// ==================== GET CREATE FORM ====================
exports.createForm = async (req, res) => {
    res.render('workers/create', {
        title: 'Add Worker',
        currentPage: 'workers',
        user: req.session.user
    });
};

// ==================== VIEW WORKER ====================
exports.viewWorker = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/workers');
        }
        
        let user = null;
        if (worker.userId) {
            user = await User.findById(worker.userId);
        }
        
        res.render('workers/view', {
            title: 'Worker Details: ' + worker.name,
            worker: worker,
            user: user,
            currentPage: 'workers'
        });
    } catch (error) {
        console.error('❌ View worker error:', error);
        req.flash('error_msg', 'Error loading worker details');
        res.redirect('/workers');
    }
};

// ==================== UPDATE WORKER ====================
exports.updateWorker = async (req, res) => {
    try {
        const { name, phone, email, address, workerType, paymentType, monthlyRate, isActive } = req.body;
        
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/workers');
        }
        
        worker.name = name;
        worker.phone = phone;
        worker.email = email || '';
        worker.address = address || '';
        worker.workerType = workerType;
        worker.paymentType = paymentType;
        worker.monthlyRate = monthlyRate || 0;
        worker.isActive = isActive === 'true' || isActive === true;
        worker.updatedBy = req.session.user.id;
        
        await worker.save();
        
        req.flash('success_msg', 'Worker updated successfully!');
        res.redirect('/workers');
        
    } catch (error) {
        console.error('❌ Update worker error:', error);
        req.flash('error_msg', 'Error updating worker: ' + error.message);
        res.redirect('/workers');
    }
};

// ==================== DELETE WORKER ====================
exports.deleteWorker = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            return res.status(404).json({ success: false, error: 'Worker not found' });
        }
        
        // Delete associated user if exists
        if (worker.userId) {
            await User.findByIdAndDelete(worker.userId);
        }
        
        await Worker.findByIdAndDelete(req.params.id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Delete worker error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== API: PAYMENT HISTORY ====================
exports.getPaymentHistory = async (req, res) => {
    try {
        const Payment = require('../models/Payment');
        const payments = await Payment.find({ worker: req.params.id }).sort({ paymentDate: -1 });
        res.json({ payments: payments || [] });
    } catch (error) {
        console.error('❌ Payment history error:', error);
        res.json({ payments: [] });
    }
};

// ==================== API: KARIGAR WORK ====================
exports.getKarigarWork = async (req, res) => {
    try {
        const Assignment = require('../models/Assignment');
        const assignments = await Assignment.find({ karigar: req.params.id });
        res.json({ work: assignments || [] });
    } catch (error) {
        console.error('❌ Karigar work error:', error);
        res.json({ work: [] });
    }
};

// ==================== API: PRESSMAN WORK ====================
exports.getPressmanWork = async (req, res) => {
    try {
        const PressmanEntry = require('../models/PressmanEntry');
        const entries = await PressmanEntry.find({ pressman: req.params.id });
        res.json({ entries: entries || [] });
    } catch (error) {
        console.error('❌ Pressman work error:', error);
        res.json({ entries: [] });
    }
};


// ==================== EDIT FORM ====================
exports.editForm = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/workers');
        }
        
        res.render('workers/edit', {
            title: 'Edit Worker',
            worker: worker,
            currentPage: 'workers',
            user: req.session.user
        });
    } catch (error) {
        console.error('❌ Edit form error:', error);
        req.flash('error_msg', 'Error loading worker');
        res.redirect('/workers');
    }
};

module.exports = exports;
