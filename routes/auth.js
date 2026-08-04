const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Worker = require('../models/Worker');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==================== LOGIN PAGE ====================
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login', {
        title: 'Login',
        layout: false
    });
});

// ==================== LOGIN API (FIXED) ====================
// ==================== LOGIN API (FIXED) ====================
// ==================== LOGIN API (FIXED) ====================
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        console.log('🔐 ===== LOGIN ATTEMPT =====');
        console.log('📧 Email/Username:', email);
        console.log('🔑 Password length:', password?.length || 0);
        
        const user = await User.findOne({ 
            $or: [{ email: email }, { username: email }] 
        });
        
        if (!user) {
            console.log('❌ User not found');
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        console.log('✅ User found:', { 
            email: user.email, 
            username: user.username,
            hashedPassword: user.password ? user.password.substring(0, 20) + '...' : 'No'
        });
        
        if (!user.isActive) {
            return res.status(401).json({ error: 'Account deactivated' });
        }
        
        // ✅ DIRECT bcrypt compare - WITH ERROR HANDLING
        let isValid = false;
        try {
            isValid = await bcrypt.compare(password, user.password);
            console.log('🔑 bcrypt.compare result:', isValid);
        } catch (err) {
            console.error('❌ bcrypt.compare error:', err.message);
        }
        
        if (!isValid) {
            console.log('❌ Invalid password');
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // ✅ Role check
        if (role && user.role !== role) {
            console.log('⚠️ Role mismatch');
            return res.status(401).json({ error: `Invalid credentials for ${role}` });
        }
        
        // ✅ Update last login
        user.lastLogin = new Date();
        await user.save();
        
        let worker = null;
        if (user.workerId) {
            worker = await Worker.findById(user.workerId);
        }
        
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            workerId: user.workerId
        };
        
        console.log('✅ Login successful:', { email: user.email, role: user.role });
        
        res.json({
            success: true,
            redirectUrl: '/dashboard',
            user: {
                id: user._id,
                name: user.username,
                email: user.email,
                role: user.role,
                worker: worker ? { name: worker.name, workerType: worker.workerType } : null
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// ==================== LOGOUT ====================
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
});

// ==================== REGISTER ====================
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/register', {
        title: 'Register',
        layout: 'layouts/main'
    });
});

router.post('/register', async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;
        
        if (password !== confirmPassword) {
            req.flash('error_msg', 'Passwords do not match');
            return res.redirect('/auth/register');
        }
        
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            req.flash('error_msg', 'Username or email already exists');
            return res.redirect('/auth/register');
        }
        
        const user = new User({
            username,
            email,
            password,
            role: 'admin',
            name: username
        });
        
        await user.save();
        
        req.flash('success_msg', 'Registration successful! Please login.');
        res.redirect('/auth/login');
        
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Registration failed: ' + error.message);
        res.redirect('/auth/register');
    }
});






// // ✅ TEMPORARY DEBUG ROUTE - Remove after testing
// router.get('/debug-users', async (req, res) => {
//     try {
//         const users = await User.find({}).select('email username password role');
//         res.json(users);
//     } catch (error) {
//         res.json({ error: error.message });
//     }
// });





module.exports = router;                                                                                                                                             





// const express = require('express');
// const router = express.Router();
// const User = require('../models/User');
// const Worker = require('../models/Worker');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');

// // Login page
// router.get('/login', (req, res) => {
//     if (req.session.user) {
//         const role = req.session.user.role;
//         if (role === 'admin') return res.redirect('/dashboard');
//         if (role === 'cutting') return res.redirect('/cutting/dashboard');
//         if (role === 'karigar') return res.redirect('/karigar/dashboard');
//         if (role === 'helper') return res.redirect('/helper/dashboard');
//         if (role === 'pressman') return res.redirect('/pressman/dashboard');
//         return res.redirect('/dashboard');
//     }
//     res.render('auth/login', { 
//         title: 'Login',
//         layout: false
//     });
// });

// // Login API - Working
// router.post('/login', async (req, res) => {
//     try {
//         const { email, password, role } = req.body;
        
//         console.log('Login attempt:', { email, role });
        
//         // Find user by email
//         let user = await User.findOne({ email });
        
//         if (!user) {
//             console.log('User not found:', email);
//             return res.status(401).json({ error: 'Invalid email or password' });
//         }
        
//         // Check if user is active
//         if (!user.isActive) {
//             return res.status(401).json({ error: 'Account is deactivated. Contact admin.' });
//         }
        
//         // Verify password
//         const isValid = await user.comparePassword(password);
        
//         if (!isValid) {
//             console.log('Invalid password for:', email);
//             return res.status(401).json({ error: 'Invalid email or password' });
//         }
        
//         // Check role if provided
//         if (role && user.role !== role) {
//             console.log('Role mismatch:', { expected: role, actual: user.role });
//             return res.status(401).json({ error: `Invalid credentials for ${role} role` });
//         }
        
//         // Update last login
//         user.lastLogin = new Date();
//         await user.save();
        
//         // Get worker details if exists
//         let worker = null;
//         if (user.workerId) {
//             worker = await Worker.findById(user.workerId);
//         }
        
//         // Set session
//         req.session.user = {
//             id: user._id,
//             username: user.username,
//             email: user.email,
//             role: user.role,
//             name: user.name || user.username,
//             workerId: user.workerId
//         };
        
//         // Generate JWT token
//         const token = jwt.sign(
//             {
//                 userId: user._id,
//                 email: user.email,
//                 role: user.role,
//                 name: user.username
//             },
//             process.env.JWT_SECRET || 'garment_erp_secret',
//             { expiresIn: '24h' }
//         );
        
//         console.log('Login successful:', { email, role: user.role });
        
//         // Determine redirect URL based on role
//         let redirectUrl = '/dashboard';
//         if (user.role === 'admin') redirectUrl = '/dashboard';
//         else if (user.role === 'cutting') redirectUrl = '/cutting/dashboard';
//         else if (user.role === 'karigar') redirectUrl = '/karigar/dashboard';
//         else if (user.role === 'helper') redirectUrl = '/helper/dashboard';
//         else if (user.role === 'pressman') redirectUrl = '/pressman/dashboard';
        
//         res.json({
//             success: true,
//             token,
//             redirectUrl,
//             user: {
//                 id: user._id,
//                 name: user.username,
//                 email: user.email,
//                 role: user.role,
//                 worker: worker ? {
//                     name: worker.name,
//                     workerType: worker.workerType
//                 } : null
//             }
//         });
        
//     } catch (error) {
//         console.error('Login error:', error);
//         res.status(500).json({ error: 'Server error. Please try again.' });
//     }
// });

// // Logout
// router.get('/logout', (req, res) => {
//     req.session.destroy();
//     res.redirect('/auth/login');
// });

// // Register page (Admin only - but for first time)
// router.get('/register', (req, res) => {
//     if (req.session.user) {
//         return res.redirect('/dashboard');
//     }
//     res.render('auth/register', { 
//         title: 'Register',
//         layout: 'layouts/main'
//     });
// });

// router.post('/register', async (req, res) => {
//     try {
//         const { username, email, password, confirmPassword } = req.body;
        
//         if (password !== confirmPassword) {
//             req.flash('error_msg', 'Passwords do not match');
//             return res.redirect('/auth/register');
//         }
        
//         const existingUser = await User.findOne({ $or: [{ username }, { email }] });
//         if (existingUser) {
//             req.flash('error_msg', 'Username or email already exists');
//             return res.redirect('/auth/register');
//         }
        
//         const user = new User({
//             username,
//             email,
//             password,
//             role: 'admin',
//             name: username
//         });
        
//         await user.save();
        
//         req.flash('success_msg', 'Registration successful! Please login.');
//         res.redirect('/auth/login');
        
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Registration failed: ' + error.message);
//         res.redirect('/auth/register');
//     }
// });

// module.exports = router;