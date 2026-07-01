// const express = require('express');
// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const path = require('path');
// const fs = require('fs');
// const session = require('express-session');
// const flash = require('connect-flash');
// const methodOverride = require('method-override');
// const cookieParser = require('cookie-parser');
// const expressLayouts = require('express-ejs-layouts');

// dotenv.config();

// // Ensure upload directories exist
// const uploadDirs = [
//     'public/uploads/workers',
//     'public/uploads/fabrics',
//     'public/uploads/temp',
//     'logs'
// ];

// uploadDirs.forEach(dir => {
//     const fullPath = path.join(__dirname, dir);
//     if (!fs.existsSync(fullPath)) {
//         fs.mkdirSync(fullPath, { recursive: true });
//         console.log(`Created directory: ${dir}`);
//     }
// });

// const app = express();

// // Middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
// app.use(methodOverride('_method'));
// app.use(express.static(path.join(__dirname, 'public')));

// // Session configuration
// app.use(session({
//     secret: process.env.SESSION_SECRET || 'garment_erp_secret',
//     resave: false,
//     saveUninitialized: true,
//     cookie: { maxAge: 3600000 }
// }));

// // Flash messages
// app.use(flash());

// // Global variables
// app.use((req, res, next) => {
//     res.locals.success_msg = req.flash('success_msg');
//     res.locals.error_msg = req.flash('error_msg');
//     res.locals.user = req.session.user || null;
//     next();
// });

// // View engine
// app.use(expressLayouts);
// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));
// app.set('layout', 'layouts/main');

// // ============ ROUTES ============
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
// app.use('/dashboard', require('./routes/dashboard'));
// app.use('/reports', require('./routes/reports'));

// // Home route
// app.get('/', (req, res) => {
//     if (req.session.user) {
//         res.redirect('/dashboard');
//     } else {
//         res.redirect('/auth/login');
//     }
// });

// // Error handling middleware
// app.use((req, res) => {
//     res.status(404).render('error/404', { 
//         title: 'Page Not Found',
//         layout: 'layouts/main'
//     });
// });

// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     req.flash('error_msg', err.message || 'Something went wrong!');
//     res.redirect('back');
// });

// // MongoDB connection
// const PORT = process.env.PORT || 3000;

// mongoose.connect(process.env.MONGODB_URI)
//     .then(() => {
//         console.log('✅ MongoDB Connected Successfully');
//         app.listen(PORT, () => {
//             console.log(`\n🚀 Garment ERP Server Running!`);
//             console.log(`📍 URL: http://localhost:${PORT}`);
//             console.log(`📅 Started: ${new Date().toLocaleString()}`);
//             console.log(`\n📋 Default Admin Login:`);
//             console.log(`   Username: admin`);
//             console.log(`   Password: admin123`);
//             console.log(`\n💡 First time? Register at: http://localhost:${PORT}/auth/register\n`);
//         });
//     })
//     .catch(err => {
//         console.error('❌ MongoDB Connection Error:', err.message);
//         console.log('\n💡 Make sure MongoDB is running: "mongod" in another terminal\n');
//         process.exit(1);
//     });

const app = require('./app');
const mongoose = require('mongoose');
const dotenv = require('dotenv');


dotenv.config();

const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/garment_erp')
    .then(() => {
        console.log('✅ MongoDB Connected Successfully');
        app.listen(PORT, () => {
            console.log(`\n🚀 Garment ERP Server Running!`);
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`📅 Started: ${new Date().toLocaleString()}`);
            console.log(`\n📋 Test URLs:`);
            console.log(`   http://localhost:${PORT}/pressman`);
            console.log(`   http://localhost:${PORT}/payments`);
            console.log(`   http://localhost:${PORT}/dashboard\n`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.log('\n💡 Make sure MongoDB is running: "mongod" in another terminal\n');
        process.exit(1);
    });