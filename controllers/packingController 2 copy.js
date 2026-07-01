const Packing = require('../models/Packing');
const Product = require('../models/Product');

exports.getPackingEntries = async (req, res) => {
    try {
        const packings = await Packing.find()
            .populate('createdBy', 'username')
            .sort({ packingDate: -1 });
        res.render('packing/index', { title: 'Packing Management', packings });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching packing records');
        res.redirect('/dashboard');
    }
};

exports.createForm = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true });
        res.render('packing/create', { title: 'Final Packing Entry', products });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/packing');
    }
};

exports.createPacking = async (req, res) => {
    try {
        console.log('=== PACKING SUBMIT START ===');
        console.log('Request body:', req.body);
        
        const { packingEntries, remark } = req.body;
        
        if (!packingEntries) {
            console.log('ERROR: packingEntries is missing');
            req.flash('error_msg', 'No packing entries found. Please add at least one entry.');
            return res.redirect('/packing/create');
        }
        
        let entries = [];
        try {
            entries = JSON.parse(packingEntries);
            console.log('Parsed entries:', entries);
        } catch(e) {
            console.log('JSON parse error:', e);
            req.flash('error_msg', 'Invalid packing data format');
            return res.redirect('/packing/create');
        }
        
        if (!entries || entries.length === 0) {
            console.log('ERROR: entries array is empty');
            req.flash('error_msg', 'Please add at least one packing entry with Product, Category, Size, and Pieces');
            return res.redirect('/packing/create');
        }
        
        // Validate each entry
        let totalPieces = 0;
        const validEntries = [];
        
        for (let entry of entries) {
            if (entry.productName && entry.category && entry.size && entry.packedPieces > 0) {
                validEntries.push({
                    productName: entry.productName,
                    category: entry.category,
                    size: entry.size,
                    packedPieces: entry.packedPieces
                });
                totalPieces += entry.packedPieces;
            } else {
                console.log('Invalid entry skipped:', entry);
            }
        }
        
        if (validEntries.length === 0) {
            console.log('ERROR: No valid entries after validation');
            req.flash('error_msg', 'Please fill all fields (Product, Category, Size, Pieces > 0)');
            return res.redirect('/packing/create');
        }
        
        console.log(`Saving ${validEntries.length} entries, total pieces: ${totalPieces}`);
        
        const packing = await Packing.create({
            entries: validEntries,
            totalPieces: totalPieces,
            remark: remark || '',
            createdBy: req.session.user.id
        });
        
        console.log(`Packing created: ${packing.packingNumber}`);
        req.flash('success_msg', `✅ Packing entry created: ${packing.packingNumber} | Total: ${totalPieces} pieces`);
        res.redirect('/packing');
        
    } catch (error) {
        console.error('Packing creation error:', error);
        req.flash('error_msg', 'Error creating packing entry: ' + error.message);
        res.redirect('/packing/create');
    }
};

exports.viewPacking = async (req, res) => {
    try {
        const packing = await Packing.findById(req.params.id);
        if (!packing) {
            req.flash('error_msg', 'Packing record not found');
            return res.redirect('/packing');
        }
        res.render('packing/view', { title: 'Packing Details', packing });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching record');
        res.redirect('/packing');
    }
};

exports.deletePacking = async (req, res) => {
    try {
        await Packing.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Packing entry deleted');
        res.redirect('/packing');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting record');
        res.redirect('/packing');
    }
};