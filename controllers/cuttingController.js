const Cutting = require('../models/Cutting');
const Product = require('../models/Product');
const Worker = require('../models/Worker');
const Client = require('../models/Client');

// ============ GET ALL CUTTINGS ============
exports.getCuttingEntries = async (req, res) => {
    try {
        const cuttings = await Cutting.find()
            .populate('cuttingWorker', 'name')
            .sort({ createdAt: -1 });
        
        res.render('cutting/index', {
            title: 'Cutting Management',
            cuttings: cuttings || [],
            user: req.session.user,
            currentPage: 'cutting'
        });
    } catch (error) {
        console.error('Error fetching cuttings:', error);
        req.flash('error_msg', 'Error fetching cutting entries');
        res.redirect('/dashboard');
    }
};

// ============ CREATE CUTTING FORM ============
exports.createForm = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true }).sort({ name: 1 });
        const workers = await Worker.find({ workerType: 'cutting', isActive: true });
        const clients = await Client.find({ isActive: true }).sort({ name: 1 });
        
        // Log product categories for debugging
        console.log('Products with categories:');
        products.forEach(p => {
            console.log(`- ${p.name} : ${p.category}`);
        });
        
        res.render('cutting/create', {
            title: 'New Cutting Entry',
            products: products || [],
            workers: workers || [],
            clients: clients || [],
            user: req.session.user,
            currentPage: 'cutting'
        });
    } catch (error) {
        console.error('Error loading form:', error);
        req.flash('error_msg', 'Error loading form: ' + error.message);
        res.redirect('/cutting');
    }
};

// ============ CREATE CUTTING ============
exports.createCutting = async (req, res) => {
    try {
        const { client, productName, productCategory, sizesData, remark, cuttingWorker } = req.body;
        
        console.log('Received cutting data:', { client, productName, productCategory });
        
        // Parse sizes data
        let sizesArray = [];
        let totalPieces = 0;
        
        if (sizesData) {
            const sizesObj = typeof sizesData === 'string' ? JSON.parse(sizesData) : sizesData;
            for (const [size, pieces] of Object.entries(sizesObj)) {
                const pieceCount = parseInt(pieces) || 0;
                if (pieceCount > 0) {
                    sizesArray.push({ size: size, pieces: pieceCount });
                    totalPieces += pieceCount;
                }
            }
        }
        
        if (sizesArray.length === 0) {
            req.flash('error_msg', 'Please add at least one size with pieces');
            return res.redirect('/cutting/create');
        }
        
        // Generate cutting number
        const count = await Cutting.countDocuments();
        const cuttingNumber = `CUT-${String(count + 1).padStart(5, '0')}`;
        
        const cutting = await Cutting.create({
            cuttingNumber: cuttingNumber,
            client: client || null,
            productName: productName,
            productCategory: productCategory || 'Other',
            sizes: sizesArray,
            totalPieces: totalPieces,
            remark: remark || '',
            cuttingWorker: cuttingWorker || null,
            createdBy: req.session.user.id,
            status: 'pending'
        });
        
        req.flash('success_msg', `✅ Cutting entry created: ${cutting.cuttingNumber} (${totalPieces} pieces)`);
        res.redirect('/cutting');
        
    } catch (error) {
        console.error('Cutting creation error:', error);
        req.flash('error_msg', 'Error creating cutting entry: ' + error.message);
        res.redirect('/cutting/create');
    }
};

// ============ GET SINGLE CUTTING ============
exports.getCutting = async (req, res) => {
    try {
        const cutting = await Cutting.findById(req.params.id)
            .populate('cuttingWorker', 'name');
        
        if (!cutting) {
            return res.status(404).json({ error: 'Cutting not found' });
        }
        
        res.json(cutting);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ============ DELETE CUTTING ============
exports.deleteCutting = async (req, res) => {
    try {
        const cutting = await Cutting.findById(req.params.id);
        if (!cutting) {
            req.flash('error_msg', 'Cutting not found');
            return res.redirect('/cutting');
        }
        
        await Cutting.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Cutting entry deleted successfully');
        res.redirect('/cutting');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting cutting entry');
        res.redirect('/cutting');
    }
};



// const Cutting = require('../models/Cutting');
// const Product = require('../models/Product');
// const Worker = require('../models/Worker');

// exports.getCuttingEntries = async (req, res) => {
//     try {
//         const cuttings = await Cutting.find()
//             .populate('product', 'name')
//             .populate('cuttingWorker', 'name')
//             .sort({ createdAt: -1 });
//         res.render('cutting/index', { title: 'Cutting Management', cuttings });
//     } catch (error) {
//         req.flash('error_msg', 'Error fetching cutting entries');
//         res.redirect('/dashboard');
//     }
// };

// exports.createForm = async (req, res) => {
//     try {
//         const products = await Product.find({ isActive: true });
//         const workers = await Worker.find({ workerType: 'cutting', isActive: true });
//         res.render('cutting/create', { title: 'New Cutting Entry', products, workers });
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error loading form');
//         res.redirect('/cutting');
//     }
// };

// exports.createCutting = async (req, res) => {
//     try {
//         const { client, product, sizesData, colors, remark, cuttingWorker } = req.body;
        
//         // Parse sizes data
//         let sizesArray = [];
//         let totalPieces = 0;
        
//         if (sizesData) {
//             const sizesObj = JSON.parse(sizesData);
//             for (const [size, pieces] of Object.entries(sizesObj)) {
//                 if (pieces > 0) {
//                     sizesArray.push({
//                         size: size,
//                         pieces: parseInt(pieces)
//                     });
//                     totalPieces += parseInt(pieces);
//                 }
//             }
//         }
        
//         // Parse colors
//         const colorsArray = colors ? colors.split(',') : [];
        
//         const cutting = await Cutting.create({
//             client: client || null,
//             product,
//             sizes: sizesArray,
//             colors: colorsArray,
//             totalPieces,
//             remark,
//             cuttingWorker: cuttingWorker || null,
//             createdBy: req.session.user.id
//         });
        
//         req.flash('success_msg', `Cutting entry created: ${cutting.cuttingNumber}`);
//         res.redirect('/cutting');
        
//     } catch (error) {
//         console.error('Cutting creation error:', error);
//         req.flash('error_msg', 'Error creating cutting entry: ' + error.message);
//         res.redirect('/cutting/create');
//     }
// };

// exports.getCutting = async (req, res) => {
//     try {
//         const cutting = await Cutting.findById(req.params.id)
//             .populate('product', 'name')
//             .populate('cuttingWorker', 'name');
//         res.json(cutting);
//     } catch (error) {
//         res.status(404).json({ error: 'Not found' });
//     }
// };






// const Cutting = require('../models/Cutting');
// const Product = require('../models/Product');
// const Worker = require('../models/Worker');

// exports.getCuttingEntries = async (req, res) => {
//   try {
//     const cuttings = await Cutting.find()
//       .populate('product', 'name')
//       .populate('cuttingWorker', 'name')
//       .sort({ createdAt: -1 });
//     res.render('cutting/index', { title: 'Cutting Management', cuttings });
//   } catch (error) {
//     req.flash('error_msg', 'Error fetching cutting entries');
//     res.redirect('/dashboard');
//   }
// };

// exports.createForm = async (req, res) => {
//   try {
//     const products = await Product.find({ isActive: true });
//     const workers = await Worker.find({ workerType: 'cutting', isActive: true });
//     res.render('cutting/create', { title: 'New Cutting Entry', products, workers });
//   } catch (error) {
//     req.flash('error_msg', 'Error loading form');
//     res.redirect('/cutting');
//   }
// };

// exports.createCutting = async (req, res) => {
//   try {
//     const { client, product, size, color, totalPieces, remark, cuttingWorker } = req.body;
    
//     await Cutting.create({
//       client: client || null,
//       product,
//       size,
//       color,
//       totalPieces: parseInt(totalPieces),
//       remark,
//       cuttingWorker: cuttingWorker || null,
//       createdBy: req.session.user.id
//     });
    
//     req.flash('success_msg', 'Cutting entry created successfully');
//     res.redirect('/cutting');
//   } catch (error) {
//     console.error(error);
//     req.flash('error_msg', 'Error creating cutting entry');
//     res.redirect('/cutting/create');
//   }
// };

// exports.getCutting = async (req, res) => {
//   try {
//     const cutting = await Cutting.findById(req.params.id)
//       .populate('product', 'name sizes colors rates')
//       .populate('cuttingWorker', 'name');
//     res.json(cutting);
//   } catch (error) {
//     res.status(404).json({ error: 'Not found' });
//   }
// };