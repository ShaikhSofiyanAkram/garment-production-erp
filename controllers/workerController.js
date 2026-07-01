const Worker = require('../models/Worker');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

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

exports.registerWorker = async (req, res) => {
    try {
        console.log('=== REGISTER WORKER START ===');
        
        const { 
            name, phone, email, address, workerType, paymentType, 
            monthlyRate, username, password 
        } = req.body;
        
        // Validation
        if (!name || !phone || !email || !workerType || !paymentType) {
            req.flash('error_msg', 'Please fill all required fields');
            return res.redirect('/workers/register');
        }
        
        // Validate email format
        if (!email.includes('@') || !email.includes('.')) {
            req.flash('error_msg', 'Please enter a valid email address');
            return res.redirect('/workers/register');
        }
        
        // Check if email already exists in Worker
        const existingWorker = await Worker.findOne({ email });
        if (existingWorker) {
            req.flash('error_msg', 'Worker with this email already exists!');
            return res.redirect('/workers/register');
        }
        
        // Check if email already exists in User
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error_msg', 'Email already registered as user!');
            return res.redirect('/workers/register');
        }
        
        // Generate username
        let finalUsername = username;
        if (!finalUsername || finalUsername === '') {
            finalUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
            let userExists = await User.findOne({ username: finalUsername });
            let counter = 1;
            while (userExists) {
                finalUsername = `${finalUsername}${counter}`;
                userExists = await User.findOne({ username: finalUsername });
                counter++;
                if (counter > 10) break;
            }
        } else {
            const userExists = await User.findOne({ username: finalUsername });
            if (userExists) {
                req.flash('error_msg', 'Username already exists!');
                return res.redirect('/workers/register');
            }
        }
        
        // Set password
        const finalPassword = password || 'worker123';
        
        // Determine role for User model
        let userRole = 'worker';
        if (workerType === 'cutting') userRole = 'cutting';
        if (workerType === 'karigar') userRole = 'karigar';
        if (workerType === 'helper') userRole = 'helper';
        if (workerType === 'pressman') userRole = 'pressman';
        
        console.log('Creating User with:', { finalUsername, email, userRole });
        
        // FIRST: Create Worker profile
        const workerData = {
            name: name,
            phone: phone,
            email: email,
            address: address || '',
            workerType: workerType,
            paymentType: paymentType,
            isActive: true,
            joiningDate: new Date(),
            createdAt: new Date()
        };
        
        if (paymentType === 'monthly' && monthlyRate) {
            workerData.monthlyRate = parseFloat(monthlyRate);
        }
        
        // Handle file uploads
        if (req.files) {
            workerData.documents = {};
            if (req.files.aadhar) workerData.documents.aadhar = req.files.aadhar[0].filename;
            if (req.files.pan) workerData.documents.pan = req.files.pan[0].filename;
            if (req.files.photo) workerData.documents.photo = req.files.photo[0].filename;
        }
        
        const worker = await Worker.create(workerData);
        console.log('Worker created:', worker._id);
        
        // SECOND: Create User account with reference to Worker
        const user = new User({
            username: finalUsername,
            email: email,
            password: finalPassword,
            role: userRole,
            workerId: worker._id,
            isActive: true,
            createdAt: new Date()
        });
        await user.save();
        console.log('User created:', user._id);
        
        // THIRD: Update Worker with userId
        await Worker.findByIdAndUpdate(worker._id, { userId: user._id });
        
        req.flash('success_msg', `✅ Worker "${name}" registered successfully! 
            Username: ${finalUsername} | Password: ${finalPassword}`);
        res.redirect('/workers');
        
    } catch (error) {
        console.error('Worker registration error:', error);
        req.flash('error_msg', 'Error registering worker: ' + error.message);
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
exports.viewWorker = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/workers');
        }
        res.render('workers/view', { 
            title: 'Worker Details', 
            worker,
            user: req.session.user,
            currentPage: 'workers'
        });
    } catch (error) {
        console.error(error);
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