const KarigarEntry = require('../models/KarigarEntry');
const Product = require('../models/Product');
const Worker = require('../models/Worker');
const ProductionReturn = require('../models/ProductionReturn');
const Assignment = require('../models/Assignment');

// Get all entries
exports.getEntries = async (req, res) => {
    try {
        const entries = await KarigarEntry.find()
            .populate('karigar', 'name')
            .populate('entries.product', 'name')
            .sort({ date: -1 });
        res.render('karigar/index', { title: 'Karigar Entries', entries });
    } catch (error) {
        req.flash('error_msg', 'Error fetching entries');
        res.redirect('/dashboard');
    }
};

// Create entry form
exports.createForm = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true });
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        res.render('karigar/create', { title: 'Karigar Entry', products, karigars });
    } catch (error) {
        req.flash('error_msg', 'Error loading form');
        res.redirect('/karigar');
    }
};

// Get karigar production returns (API)
exports.getKarigarReturns = async (req, res) => {
    try {
        const { karigarId } = req.query;
        
        // Get all assignments for this karigar with production returns
        const assignments = await Assignment.find({ karigar: karigarId })
            .populate('product', 'name rates')
            .populate({
                path: 'productionReturn',
                model: 'ProductionReturn'
            });
        
        const pendingReturns = [];
        
        for (const assignment of assignments) {
            const productionReturn = await ProductionReturn.findOne({ assignment: assignment._id });
            
            if (productionReturn && productionReturn.status !== 'completed') {
                pendingReturns.push({
                    assignmentId: assignment.assignmentId,
                    productId: assignment.product._id,
                    productName: assignment.product.name,
                    size: assignment.sizes[0]?.size || 'N/A',
                    returnedPieces: productionReturn.returned,
                    damagePieces: productionReturn.damage,
                    missingPieces: productionReturn.missing,
                    rate: assignment.product.rates.karigar,
                    pendingPieces: productionReturn.returned // Pieces to be paid
                });
            }
        }
        
        res.json({ success: true, pendingReturns });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

// Create entry
exports.createEntry = async (req, res) => {
    try {
        const { karigar, date, entriesData, remark } = req.body;
        const entries = JSON.parse(entriesData);
        
        let totalQuantity = 0;
        let totalAmount = 0;
        const entriesArray = [];
        
        for (const item of entries) {
            if (item.quantity > 0) {
                const product = await Product.findById(item.product);
                const rate = product.rates.karigar;
                const amount = item.quantity * rate;
                
                entriesArray.push({
                    product: item.product,
                    productName: product.name,
                    size: item.size,
                    quantity: item.quantity,
                    rate: rate,
                    amount: amount
                });
                
                totalQuantity += item.quantity;
                totalAmount += amount;
            }
        }
        
        const entry = await KarigarEntry.create({
            karigar,
            date: date || new Date(),
            entries: entriesArray,
            totalQuantity,
            totalAmount,
            remark,
            createdBy: req.session.user.id
        });
        
        req.flash('success_msg', `Entry created: ${entry.entryNumber} - ₹${totalAmount}`);
        res.redirect('/karigar');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating entry');
        res.redirect('/karigar/create');
    }
};

// View single entry
exports.viewEntry = async (req, res) => {
    try {
        const entry = await KarigarEntry.findById(req.params.id)
            .populate('karigar', 'name')
            .populate('entries.product', 'name');
        
        if (!entry) {
            req.flash('error_msg', 'Entry not found');
            return res.redirect('/karigar');
        }
        
        res.render('karigar/view', { title: 'Karigar Entry Details', entry });
    } catch (error) {
        req.flash('error_msg', 'Error fetching entry');
        res.redirect('/karigar');
    }
};

// Delete entry
exports.deleteEntry = async (req, res) => {
    try {
        await KarigarEntry.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Entry deleted');
        res.redirect('/karigar');
    } catch (error) {
        req.flash('error_msg', 'Error deleting entry');
        res.redirect('/karigar');
    }
};

// Approve entry
exports.approveEntry = async (req, res) => {
    try {
        await KarigarEntry.findByIdAndUpdate(req.params.id, { status: 'approved' });
        req.flash('success_msg', 'Entry approved');
        res.redirect('/karigar/view/' + req.params.id);
    } catch (error) {
        req.flash('error_msg', 'Error approving entry');
        res.redirect('/karigar');
    }
};

// Mark as paid
exports.markAsPaid = async (req, res) => {
    try {
        await KarigarEntry.findByIdAndUpdate(req.params.id, { status: 'paid' });
        req.flash('success_msg', 'Entry marked as paid');
        res.redirect('/karigar/view/' + req.params.id);
    } catch (error) {
        req.flash('error_msg', 'Error marking as paid');
        res.redirect('/karigar');
    }
};