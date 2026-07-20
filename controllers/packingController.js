const Packing = require('../models/Packing');
const Product = require('../models/Product');

exports.getPackingEntries = async (req, res) => {
    try {
        const packings = await Packing.find()
            .populate('createdBy', 'username')
            .sort({ packingDate: -1 });
        res.render('packing/index', { 
            title: 'Packing Management', 
            packings,
            user: req.session.user,
            currentPage: 'packing'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching packing records');
        res.redirect('/dashboard');
    }
};

exports.createForm = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true });
        res.render('packing/create', { 
            title: 'Final Packing Entry', 
            products: products || [],
            user: req.session.user,
            currentPage: 'packing'
        });
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
            req.flash('error_msg', 'Please add at least one packing entry with Product, Category, Size, and Pieces');
            return res.redirect('/packing/create');
        }
        
        // ✅ Check for duplicates
        const seen = new Set();
        for (const entry of entries) {
            const key = `${entry.productName}|${entry.category}|${entry.size}`;
            if (seen.has(key)) {
                req.flash('error_msg', `Duplicate entry found: ${entry.productName} - ${entry.category} - ${entry.size}`);
                return res.redirect('/packing/create');
            }
            seen.add(key);
        }
        
        // ✅ Validate each entry
        let totalPieces = 0;
        const validEntries = [];
        
        for (let entry of entries) {
            if (entry.productName && entry.category && entry.size && entry.packedPieces > 0) {
                // ✅ Check if product exists in database (optional)
                const product = await Product.findOne({ 
                    name: entry.productName, 
                    category: entry.category 
                });
                
                validEntries.push({
                    productName: entry.productName,
                    category: entry.category,
                    size: entry.size,
                    packedPieces: entry.packedPieces,
                    product: product?._id || null
                });
                totalPieces += entry.packedPieces;
            } else {
                console.log('Invalid entry skipped:', entry);
            }
        }
        
        if (validEntries.length === 0) {
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
        res.render('packing/view', { 
            title: 'Packing Details', 
            packing,
            user: req.session.user,
            currentPage: 'packing'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching record');
        res.redirect('/packing');
    }
};

exports.deletePacking = async (req, res) => {
    try {
        await Packing.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Packing entry deleted successfully');
        res.redirect('/packing');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting record');
        res.redirect('/packing');
    }
};









// ==================== GET AUTO FROM FINISHING ====================
exports.getAutoFromFinishing = async (req, res) => {
    try {
        // ✅ Get all finishing records that are not yet packed
        const Finishing = require('../models/Finishing');
        const Packing = require('../models/Packing');
        
        // ✅ Get all finishing records with their details
        const finishingRecords = await Finishing.find({
            status: 'completed',
            isPacked: { $ne: true } // ✅ Only get unfinished records
        }).populate('assignmentId', 'assignmentId productName')
          .populate('karigarId', 'name')
          .populate('helperId', 'name')
          .sort({ finishingDate: -1 });
        
        // ✅ Get already packed items (product + size combination)
        const packedItems = await Packing.find({}, 'entries');
        const packedSet = new Set();
        
        for (const pack of packedItems) {
            for (const entry of pack.entries) {
                // ✅ Create unique key: productId + size
                const key = entry.product + '-' + entry.size;
                packedSet.add(key);
            }
        }
        
        // ✅ Filter finishing records that have already been packed
        const availableRecords = [];
        for (const record of finishingRecords) {
            // ✅ Check if this finishing record's product+size is already packed
            const key = record.productId + '-' + record.size;
            if (!packedSet.has(key)) {
                availableRecords.push(record);
            }
        }
        
        // ✅ Format data for display
        const formattedRecords = availableRecords.map(record => ({
            id: record._id,
            finishingNumber: record.finishingNumber || 'FIN-0000',
            productName: record.productName || 'Unknown',
            size: record.size || 'N/A',
            passedPieces: record.passedPieces || 0,
            category: record.category || 'N/A',
            // ✅ Include all sizes if available
            sizes: record.sizes || [],
            // ✅ For backwards compatibility
            sizeDetails: record.sizeDetails || []
        }));
        
        res.json({
            success: true,
            records: formattedRecords,
            total: formattedRecords.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching auto finishing:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== FINALIZE PACKING ====================
exports.finalizePacking = async (req, res) => {
    try {
        const { entries, remark, source } = req.body;
        
        if (!entries || entries.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No entries to pack' 
            });
        }
        
        // ✅ Create packing entry
        const Packing = require('../models/Packing');
        const Finishing = require('../models/Finishing');
        
        const packing = new Packing({
            entries: entries.map(e => ({
                product: e.productId,
                productName: e.productName,
                category: e.category,
                size: e.size,
                packedPieces: e.pieces || e.passedPieces || 0,
                finishingId: e.finishingId || null
            })),
            totalPieces: entries.reduce((sum, e) => sum + (e.pieces || e.passedPieces || 0), 0),
            remark: remark || '',
            createdBy: req.session.user.id,
            source: source || 'auto' // auto or manual
        });
        
        await packing.save();
        
        // ✅ Mark finishing records as packed
        if (source === 'auto') {
            const finishingIds = entries.map(e => e.finishingId).filter(id => id);
            if (finishingIds.length > 0) {
                await Finishing.updateMany(
                    { _id: { $in: finishingIds } },
                    { isPacked: true, packedAt: new Date() }
                );
            }
        }
        
        res.json({
            success: true,
            packing: packing,
            message: 'Packing finalized successfully!'
        });
        
    } catch (error) {
        console.error('❌ Error finalizing packing:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==================== DELETE PACKED ENTRY ====================
exports.deletePackedEntry = async (req, res) => {
    try {
        const { packingId, entryIndex } = req.params;
        
        const Packing = require('../models/Packing');
        const packing = await Packing.findById(packingId);
        
        if (!packing) {
            return res.status(404).json({ success: false, error: 'Packing not found' });
        }
        
        // ✅ Remove the entry
        if (entryIndex !== undefined && packing.entries[entryIndex]) {
            // ✅ Get finishingId before removing
            const finishingId = packing.entries[entryIndex].finishingId;
            
            // ✅ Remove entry
            packing.entries.splice(entryIndex, 1);
            
            // ✅ Recalculate total pieces
            packing.totalPieces = packing.entries.reduce((sum, e) => sum + (e.packedPieces || 0), 0);
            
            await packing.save();
            
            // ✅ Unmark finishing record
            if (finishingId) {
                const Finishing = require('../models/Finishing');
                await Finishing.findByIdAndUpdate(finishingId, { isPacked: false });
            }
            
            res.json({ 
                success: true, 
                message: 'Entry removed successfully!',
                totalPieces: packing.totalPieces
            });
        } else {
            res.status(404).json({ success: false, error: 'Entry not found' });
        }
    } catch (error) {
        console.error('❌ Error deleting packed entry:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};









exports.createPacking = async (req, res) => {
    try {
        console.log('=== PACKING SUBMIT START ===');
        console.log('Request body:', req.body);
        
        const { packingEntries, remark } = req.body;
        
        if (!packingEntries) {
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
            req.flash('error_msg', 'Please add at least one packing entry with Product, Category, Size, and Pieces');
            return res.redirect('/packing/create');
        }
        
        // ✅ Check for duplicates
        const seen = new Set();
        for (const entry of entries) {
            const key = `${entry.productName}|${entry.category}|${entry.size}`;
            if (seen.has(key)) {
                req.flash('error_msg', `Duplicate entry found: ${entry.productName} - ${entry.category} - ${entry.size}`);
                return res.redirect('/packing/create');
            }
            seen.add(key);
        }
        
        // ✅ Validate each entry
        let totalPieces = 0;
        const validEntries = [];
        
        for (let entry of entries) {
            if (entry.productName && entry.category && entry.size && entry.packedPieces > 0) {
                const product = await Product.findOne({ 
                    name: entry.productName, 
                    category: entry.category 
                });
                
                validEntries.push({
                    productName: entry.productName,
                    category: entry.category,
                    size: entry.size,
                    packedPieces: entry.packedPieces,
                    product: product?._id || null
                });
                totalPieces += entry.packedPieces;
            } else {
                console.log('Invalid entry skipped:', entry);
            }
        }
        
        if (validEntries.length === 0) {
            req.flash('error_msg', 'Please fill all fields (Product, Category, Size, Pieces > 0)');
            return res.redirect('/packing/create');
        }
        
        console.log(`Saving ${validEntries.length} entries, total pieces: ${totalPieces}`);
        
        // ✅ Create packing with retry logic for duplicate key error
        let packing = null;
        let retries = 3;
        
        while (retries > 0 && !packing) {
            try {
                packing = await Packing.create({
                    entries: validEntries,
                    totalPieces: totalPieces,
                    remark: remark || '',
                    createdBy: req.session.user.id
                });
            } catch (error) {
                if (error.code === 11000 && retries > 1) {
                    // ✅ Duplicate key error - retry
                    console.log('Duplicate key error, retrying...');
                    retries--;
                    // ✅ Wait a bit before retry
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    throw error;
                }
            }
        }
        
        if (!packing) {
            throw new Error('Failed to create packing after retries');
        }
        
        console.log(`Packing created: ${packing.packingNumber}`);
        req.flash('success_msg', `✅ Packing entry created: ${packing.packingNumber} | Total: ${totalPieces} pieces`);
        res.redirect('/packing');
        
    } catch (error) {
        console.error('Packing creation error:', error);
        req.flash('error_msg', 'Error creating packing entry: ' + error.message);
        res.redirect('/packing/create');
    }
};