const PressmanEntry = require('../models/PressmanEntry');
const PressmanProduct = require('../models/PressmanProduct');
const Worker = require('../models/Worker');

// ==================== DASHBOARD ====================
exports.getPressmanDashboard = async (req, res) => {
    try {
        const entries = await PressmanEntry.find()
            .populate('pressman', 'name')
            .sort({ date: -1 })
            .limit(50);
        
        const pressmen = await Worker.find({ 
            workerType: 'pressman', 
            isActive: true 
        }).select('name');
        
        const products = await PressmanProduct.find({ isActive: true });
        
        const stats = {
            totalEntries: await PressmanEntry.countDocuments(),
            totalProducts: products.length,
            totalPressmen: pressmen.length,
            pendingEntries: await PressmanEntry.countDocuments({ status: 'pending' }),
            totalAmount: await PressmanEntry.aggregate([
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ])
        };
        
        res.render('pressman/index', {
            title: 'Pressman Management',
            entries: entries || [],
            pressmen: pressmen || [],
            products: products || [],
            stats: stats,
            user: req.session.user,
            currentPage: 'pressman',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error_msg', 'Error loading pressman dashboard');
        res.redirect('/dashboard');
    }
};

// ==================== GET ENTRY FORM ====================
exports.getEntryForm = async (req, res) => {
    try {
        const pressmen = await Worker.find({ 
            workerType: 'pressman', 
            isActive: true 
        }).select('name');
        
        const products = await PressmanProduct.find({ 
            isActive: true 
        }).select('name rate');
        
        res.render('pressman/create', {
            title: 'New Pressman Entry',
            pressmen: pressmen || [],
            products: products || [],
            entry: null,
            user: req.session.user,
            currentPage: 'pressman'
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/pressman');
    }
};

// ==================== CREATE ENTRY ====================
// ==================== CREATE ENTRY ====================
exports.createEntry = async (req, res) => {
    try {
        const { pressmanId, date, entries, remark } = req.body;
        
        console.log('📝 Creating pressman entry:', { pressmanId, entries });
        
        // ✅ Validate pressman
        const pressman = await Worker.findById(pressmanId);
        if (!pressman) {
            return res.status(400).json({ 
                success: false, 
                error: 'Pressman not found' 
            });
        }
        
        // ✅ Parse entries
        let parsedEntries = [];
        if (typeof entries === 'string') {
            try {
                parsedEntries = JSON.parse(entries);
            } catch (e) {
                parsedEntries = [];
            }
        } else if (Array.isArray(entries)) {
            parsedEntries = entries;
        }
        
        if (!parsedEntries || parsedEntries.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'At least one product is required' 
            });
        }
        
        // ✅ Process entries with size
        const processedEntries = [];
        for (const item of parsedEntries) {
            if (!item.product || !item.quantity) continue;
            
            const product = await PressmanProduct.findById(item.product);
            if (!product) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Product not found: ${item.product}` 
                });
            }
            
            // ✅ Get rate - either from size or uniform
            let rate = 0;
            let size = item.size || 'One Size';
            
            if (product.hasSizeRates && product.sizeRates && product.sizeRates.length > 0) {
                const sizeRate = product.sizeRates.find(sr => sr.size === size);
                rate = sizeRate ? sizeRate.rate : 0;
            } else {
                rate = product.rate || 0;
                size = 'One Size';
            }
            
            const quantity = parseInt(item.quantity) || 0;
            const amount = quantity * rate;
            
            processedEntries.push({
                product: product._id,
                productName: product.name,
                size: size,
                quantity: quantity,
                rate: rate,
                amount: amount
            });
        }
        
        if (processedEntries.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No valid entries found' 
            });
        }
        
        // ✅ Create entry - let model auto-generate entryNumber
        const entry = new PressmanEntry({
            pressman: pressmanId,
            date: date || new Date(),
            entries: processedEntries,
            status: 'pending',
            remark: remark || '',
            createdBy: req.session.user.id
        });
        
        // ✅ Try to save with retry if duplicate
        let saved = false;
        let retries = 0;
        let lastError = null;
        
        while (!saved && retries < 3) {
            try {
                await entry.save();
                saved = true;
                console.log('✅ Entry saved:', entry.entryNumber);
            } catch (error) {
                lastError = error;
                if (error.code === 11000) {
                    // ✅ Duplicate key error - regenerate entry number
                    retries++;
                    console.log(`⚠️ Duplicate entry number, retry ${retries}...`);
                    // Clear entryNumber to regenerate
                    entry.entryNumber = undefined;
                    // Add small delay
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    throw error;
                }
            }
        }
        
        if (!saved) {
            throw lastError || new Error('Failed to save entry after retries');
        }
        
        req.flash('success_msg', `Entry ${entry.entryNumber} created successfully!`);
        res.json({ 
            success: true, 
            entry: entry,
            redirect: '/pressman'
        });
        
    } catch (error) {
        console.error('❌ Error creating entry:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                error: 'Duplicate entry number. Please try again.' 
            });
        }
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ 
                success: false, 
                error: errors.join(', ') 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// ==================== VIEW ENTRY ====================
exports.viewEntry = async (req, res) => {
    try {
        const entry = await PressmanEntry.findById(req.params.id)
            .populate('pressman', 'name');
        
        if (!entry) {
            req.flash('error_msg', 'Entry not found');
            return res.redirect('/pressman');
        }
        
        res.render('pressman/view', {
            title: `Entry ${entry.entryNumber}`,
            entry: entry,
            user: req.session.user,
            currentPage: 'pressman'
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error_msg', 'Error loading entry');
        res.redirect('/pressman');
    }
};

// ==================== UPDATE STATUS ====================
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const entry = await PressmanEntry.findById(req.params.id);
        
        if (!entry) {
            return res.status(404).json({ 
                success: false, 
                error: 'Entry not found' 
            });
        }
        
        entry.status = status;
        if (status === 'approved') {
            entry.approvedBy = req.session.user.id;
            entry.approvedAt = new Date();
        }
        if (status === 'paid') {
            entry.paymentDate = new Date();
        }
        
        await entry.save();
        
        res.json({ success: true, entry });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== DELETE ENTRY ====================
exports.deleteEntry = async (req, res) => {
    try {
        const entry = await PressmanEntry.findByIdAndDelete(req.params.id);
        if (!entry) {
            return res.status(404).json({ 
                success: false, 
                error: 'Entry not found' 
            });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== API: GET PRESSMAN WORK ====================
exports.getPressmanWork = async (req, res) => {
    try {
        const { workerId, fromDate, toDate } = req.query;
        
        let filter = {};
        if (workerId) filter.pressman = workerId;
        if (fromDate && toDate) {
            filter.date = { 
                $gte: new Date(fromDate), 
                $lte: new Date(toDate) 
            };
        }
        
        const entries = await PressmanEntry.find(filter)
            .populate('pressman', 'name')
            .sort({ date: -1 });
        
        let workDetails = [];
        let totalPieces = 0;
        let totalAmount = 0;
        
        for (const entry of entries) {
            for (const item of entry.entries) {
                workDetails.push({
                    entryNumber: entry.entryNumber,
                    date: entry.date,
                    productName: item.productName,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    status: entry.status
                });
                totalPieces += item.quantity;
                totalAmount += item.amount;
            }
        }
        
        res.json({ 
            success: true, 
            work: workDetails, 
            totalPieces, 
            totalAmount,
            entryCount: entries.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// ==================== API: GET PRESSMEN LIST ====================
exports.getPressmenList = async (req, res) => {
    try {
        const pressmen = await Worker.find({ 
            workerType: 'pressman', 
            isActive: true 
        }).select('_id name');
        res.json({ success: true, pressmen });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== VIEW ENTRY ====================
exports.viewEntry = async (req, res) => {
    try {
        const id = req.params.id;
        
        // ✅ Check if ID is valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            req.flash('error_msg', 'Invalid entry ID');
            return res.redirect('/pressman');
        }
        
        const entry = await PressmanEntry.findById(id)
            .populate('pressman', 'name')
            .populate('createdBy', 'username')
            .populate('approvedBy', 'username');
        
        if (!entry) {
            req.flash('error_msg', 'Entry not found');
            return res.redirect('/pressman');
        }
        
        res.render('pressman/view', {
            title: `Entry ${entry.entryNumber}`,
            entry: entry,
            user: req.session.user,
            currentPage: 'pressman'
        });
    } catch (error) {
        console.error('❌ Error viewing entry:', error);
        req.flash('error_msg', 'Error loading entry: ' + error.message);
        res.redirect('/pressman');
    }
};

// ✅ Make sure to import mongoose at top
const mongoose = require('mongoose');