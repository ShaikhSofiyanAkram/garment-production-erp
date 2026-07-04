const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');

const app = express();

// ======================================
// MIDDLEWARE (Order Matters!)
// ======================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ======================================
// SESSION
// ======================================

app.use(session({
    secret: 'garment_erp_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }
}));

// ======================================
// FLASH
// ======================================

app.use(flash());

// ======================================
// SETTINGS MIDDLEWARE
// ======================================

const { loadSettings } = require('./middleware/settings');
app.use(loadSettings);

// ======================================
// GLOBAL VARIABLES
// ======================================

app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
    res.locals.user = req.session.user || null;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// ======================================
// VIEW ENGINE & LAYOUT (ONLY ONCE - FINAL)
// ======================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// ✅ Use express-ejs-layouts
app.use(expressLayouts);

// ✅ Conditional Layout Middleware (ONLY ONCE - AFTER expressLayouts)
app.use((req, res, next) => {
    // Check if URL contains print-statement or collect-payment
    const url = req.originalUrl || req.url || '';
    const isPrintRoute = url.includes('print-statement') || 
                         url.includes('collect-payment') ||
                         req.path.includes('print-statement') || 
                         req.path.includes('collect-payment');
    
    if (isPrintRoute) {
        res.locals.layout = false;
        console.log('🖨️ Print/Collect route - Layout disabled:', url);
    } else {
        res.locals.layout = 'layouts/main';
    }
    next();
});

// ======================================
// ROUTES
// ======================================

// Auth routes
app.use('/auth', require('./routes/auth'));

// Worker management
app.use('/workers', require('./routes/workers'));

// Production modules
app.use('/fabrics', require('./routes/fabrics'));
app.use('/products', require('./routes/products'));
app.use('/cutting', require('./routes/cutting'));
app.use('/assignments', require('./routes/assignment'));
app.use('/production', require('./routes/production'));
app.use('/finishing', require('./routes/finishing'));
app.use('/packing', require('./routes/packing'));

// Billing and Payments
app.use('/bills', require('./routes/bills'));
app.use('/payments', require('./routes/payments'));
app.use('/payment', require('./routes/payment'));
app.use('/payment-collection', require('./routes/payment-collection'));

// Advance routes
app.use('/advance', require('./routes/advance'));

// Pressman
app.use('/pressman', require('./routes/pressman'));

// Dashboard
app.use('/dashboard', require('./routes/dashboard'));

// Reports
app.use('/reports', require('./routes/reports'));

// Karigar
app.use('/karigar', require('./routes/karigar'));

// Clients
app.use('/clients', require('./routes/clients'));

// Attendance
app.use('/attendance', require('./routes/attendance'));

// Settings
app.use('/settings', require('./routes/settings'));

// Debug
app.use('/debug', require('./routes/debug'));

// API
app.use('/api', require('./routes/api'));

// Make sure AdvanceClient model is loaded
const AdvanceClient = require('./models/AdvanceClient');
// Add with other routes
app.use('/payment-advance', require('./routes/payment-advance'));

// Add with other routes
app.use('/attendance', require('./routes/attendance'));
// Add with other routes - ensure it's before 404 handler
app.use('/attendance', require('./routes/attendance'));


// ======================================
// HOME ROUTE
// ======================================

app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.redirect('/auth/login');
});

// ======================================
// DASHBOARD
// ======================================

app.get('/dashboard', (req, res) => {
    res.render('dashboard/admin-new', {
        title: 'Dashboard',
        user: req.session.user,
        currentPage: 'dashboard'
    });
});

// ======================================
// DASHBOARD API
// ======================================

app.get('/dashboard/api/stats', async (req, res) => {
    res.json({ success: true, message: 'API working' });
});

// ======================================
// THEME API
// ======================================

app.post('/api/settings/theme', (req, res) => {
    res.json({ success: true });
});

// ======================================
// 404 HANDLER
// ======================================

app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Page Not Found</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body>
            <div class="container mt-5">
                <div class="alert alert-danger">
                    <h1>404 - Page Not Found</h1>
                    <p>The page you are looking for does not exist.</p>
                    <p>Requested URL: ${req.url}</p>
                    <a href="/dashboard" class="btn btn-primary">
                        Go to Dashboard
                    </a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ======================================
// ERROR HANDLER
// ======================================

app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>500 - Server Error</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body>
            <div class="container mt-5">
                <div class="alert alert-danger">
                    <h1>500 - Server Error</h1>
                    <p>${err.message}</p>
                    <a href="/dashboard" class="btn btn-primary">
                        Go to Dashboard
                    </a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ======================================
// EXPORT
// ======================================

module.exports = app;



// const express = require('express');
// const session = require('express-session');
// const flash = require('connect-flash');
// const methodOverride = require('method-override');
// const cookieParser = require('cookie-parser');
// const path = require('path');
// const expressLayouts = require('express-ejs-layouts');
// const mongoose = require('mongoose');

// const app = express();

// // ======================================
// // MIDDLEWARE
// // ======================================

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
// app.use(methodOverride('_method'));
// app.use(express.static(path.join(__dirname, 'public')));

// // ======================================
// // SESSION
// // ======================================

// app.use(session({
//     secret: 'garment_erp_secret',
//     resave: false,
//     saveUninitialized: true,
//     cookie: { maxAge: 3600000 }
// }));

// // ======================================
// // FLASH
// // ======================================

// app.use(flash());

// // ======================================
// // SETTINGS MIDDLEWARE
// // ======================================

// const { loadSettings } = require('./middleware/settings');
// app.use(loadSettings);

// // ======================================
// // GLOBAL VARIABLES
// // ======================================

// app.use((req, res, next) => {
//     res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
//     res.locals.user = req.session.user || null;
//     res.locals.success_msg = req.flash('success_msg');
//     res.locals.error_msg = req.flash('error_msg');
//     next();
// });

// // ======================================
// // VIEW ENGINE
// // ======================================

// app.use(expressLayouts);

// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));
// app.set('layout', 'layouts/main');

// // ======================================
// // ROUTES
// // ======================================

// app.use('/auth', require('./routes/auth'));
// app.use('/workers', require('./routes/workers'));
// app.use('/fabrics', require('./routes/fabrics'));
// app.use('/products', require('./routes/products'));
// app.use('/cutting', require('./routes/cutting'));
// app.use('/assignments', require('./routes/assignment'));
// app.use('/production', require('./routes/production'));
// app.use('/finishing', require('./routes/finishing'));
// app.use('/packing', require('./routes/packing'));
// app.use('/bills', require('./routes/bills'));
// app.use('/payments', require('./routes/payments'));
// app.use('/payment', require('./routes/payment'));
// app.use('/payment-collection', require('./routes/payment-collection'));
// app.use('/pressman', require('./routes/pressman'));
// app.use('/dashboard', require('./routes/dashboard'));
// app.use('/reports', require('./routes/reports'));
// app.use('/karigar', require('./routes/karigar'));
// app.use('/clients', require('./routes/clients'));
// app.use('/attendance', require('./routes/attendance'));
// app.use('/settings', require('./routes/settings'));
// app.use('/debug', require('./routes/debug'));
// // Add after other routes
// app.use('/api', require('./routes/api'));
// // Attendance routes
// app.use('/attendance', require('./routes/attendance'));

// // Add this with other routes
// app.use('/payments', require('./routes/payments'));

// // Add with other routes
// app.use('/advance', require('./routes/advance'));
// // Make sure AdvanceClient model is loaded
// const AdvanceClient = require('./models/AdvanceClient');

// // Add this with other routes
// const reportsRoutes = require('./routes/reports');
// app.use('/reports', reportsRoutes);


// // In app.js, add this middleware for print routes
// app.use('/payments/print-statement', (req, res, next) => {
//     res.locals.layout = false;
//     next();
// });

// // ✅ Remove or comment layout middleware for print routes
// // app.use((req, res, next) => {
// //     res.locals.layout = 'layouts/main';
// //     next();
// // });

// // ✅ Add this instead - conditional layout
// app.use((req, res, next) => {
//     // If route is print-statement, disable layout
//     if (req.path.includes('/print-statement') || req.path.includes('/collect-payment')) {
//         res.locals.layout = false;
//     } else {
//         res.locals.layout = 'layouts/main';
//     }
//     next();
// });

// // OR use express-ejs-layouts properly
// // app.use(layouts);
// // app.set('layout', 'layouts/main');
// // ======================================
// // HOME ROUTE
// // ======================================

// app.get('/', (req, res) => {
//     if (req.session.user) {
//         return res.redirect('/dashboard');
//     }
//     res.redirect('/auth/login');
// });

// // ======================================
// // DASHBOARD
// // ======================================

// app.get('/dashboard', (req, res) => {
//     res.render('dashboard/admin-new', {
//         title: 'Dashboard',
//         user: req.session.user,
//         currentPage: 'dashboard'
//     });
// });

// // Add with other routes
// // app.use('/advance', require('./routes/advance'));

// // ======================================
// // DASHBOARD API
// // ======================================

// app.get('/dashboard/api/stats', async (req, res) => {
//     // API to fetch dashboard stats
// });


// // Add this line with other routes
// app.use('/advance', require('./routes/advance'));
// // ======================================
// // THEME API
// // ======================================

// app.post('/api/settings/theme', (req, res) => {
//     res.json({ success: true });
// });

// // ======================================
// // 404 HANDLER
// // ======================================

// app.use((req, res) => {
//     res.status(404).send(`
//         <!DOCTYPE html>
//         <html>
//         <head>
//             <title>404 - Page Not Found</title>
//             <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
//         </head>
//         <body>
//             <div class="container mt-5">
//                 <div class="alert alert-danger">
//                     <h1>404 - Page Not Found</h1>
//                     <p>The page you are looking for does not exist.</p>
//                     <p>Requested URL: ${req.url}</p>
//                     <a href="/dashboard" class="btn btn-primary">
//                         Go to Dashboard
//                     </a>
//                 </div>
//             </div>
//         </body>
//         </html>
//     `);
// });

// // ======================================
// // ERROR HANDLER
// // ======================================

// app.use((err, req, res, next) => {
//     console.error(err.stack);

//     res.status(500).send(`
//         <!DOCTYPE html>
//         <html>
//         <head>
//             <title>500 - Server Error</title>
//             <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
//         </head>
//         <body>
//             <div class="container mt-5">
//                 <div class="alert alert-danger">
//                     <h1>500 - Server Error</h1>
//                     <p>${err.message}</p>
//                     <a href="/dashboard" class="btn btn-primary">
//                         Go to Dashboard
//                     </a>
//                 </div>
//             </div>
//         </body>
//         </html>
//     `);
// });

// // ======================================
// // EXPORT
// // ======================================

// module.exports = app;