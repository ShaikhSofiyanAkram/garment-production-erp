const FabricStock = require('../models/FabricStock');
const FabricConsumption = require('../models/FabricConsumption');
const FabricWaste = require('../models/FabricWaste');
const Cutting = require('../models/Cutting');

// Get all fabric stock with filters
exports.getStock = async (req, res) => {
    try {
        const { fabricType, status, fromDate, toDate } = req.query;
        let filter = {};
        
        if (fabricType) filter.fabricType = fabricType;
        if (status) filter.status = status;
        if (fromDate || toDate) {
            filter.purchaseDate = {};
            if (fromDate) filter.purchaseDate.$gte = new Date(fromDate);
            if (toDate) filter.purchaseDate.$lte = new Date(toDate);
        }
        
        const stock = await FabricStock.find(filter).sort({ purchaseDate: -1 });
        
        const summary = {
            totalMeters: stock.reduce((sum, s) => sum + (s.totalMeters || 0), 0),
            remainingMeters: stock.reduce((sum, s) => sum + (s.remainingMeters || 0), 0),
            consumedMeters: stock.reduce((sum, s) => sum + (s.consumedMeters || 0), 0),
            wastedMeters: stock.reduce((sum, s) => sum + (s.wastedMeters || 0), 0),
            totalBatches: stock.length,
            lowStock: stock.filter(s => s.remainingMeters < 100 && s.remainingMeters > 0).length,
            exhausted: stock.filter(s => s.status === 'exhausted').length
        };
        
        res.render('fabrics/stock/index', {
            title: 'Fabric Stock Ledger',
            stock,
            summary,
            filters: { fabricType, status, fromDate, toDate }
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching fabric stock');
        res.redirect('/fabrics');
    }
};

// Show add stock form
exports.addStockForm = async (req, res) => {
    res.render('fabrics/stock/add', { title: 'Add Fabric Stock' });
};

// Add new fabric stock
exports.addStock = async (req, res) => {
    try {
        const { fabricType, fabricName, color, supplier, purchaseDate, invoiceNumber,
                rollNumber, metersPerRoll, totalRolls, totalMeters, remark } = req.body;
        
        const count = await FabricStock.countDocuments();
        const batchNumber = `FAB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
        
        const stock = new FabricStock({
            batchNumber,
            fabricType,
            fabricName,
            color: color || '',
            supplier: supplier || '',
            purchaseDate: purchaseDate || new Date(),
            invoiceNumber: invoiceNumber || '',
            rollNumber: rollNumber || '',
            metersPerRoll: parseFloat(metersPerRoll) || 0,
            totalRolls: parseInt(totalRolls),
            totalMeters: parseFloat(totalMeters),
            remainingMeters: parseFloat(totalMeters),
            remark: remark || '',
            createdBy: req.session.user.id
        });
        
        await stock.save();
        
        req.flash('success_msg', `Stock added: ${batchNumber} (${totalMeters} meters)`);
        res.redirect('/fabrics/stock');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error adding fabric stock');
        res.redirect('/fabrics/stock/add');
    }
};

// View stock details
exports.viewStock = async (req, res) => {
    try {
        const stock = await FabricStock.findById(req.params.id);
        const consumptions = await FabricConsumption.find({ fabricStock: stock._id })
            .populate('cutting', 'cuttingNumber productName totalPieces')
            .sort({ consumptionDate: -1 });
        const wastes = await FabricWaste.find({ fabricStock: stock._id })
            .sort({ wasteDate: -1 });
        
        res.render('fabrics/stock/view', {
            title: 'Stock Details',
            stock,
            consumptions,
            wastes
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Stock not found');
        res.redirect('/fabrics/stock');
    }
};

// Update stock
exports.updateStock = async (req, res) => {
    try {
        const { fabricType, fabricName, color, supplier, invoiceNumber, remark } = req.body;
        
        await FabricStock.findByIdAndUpdate(req.params.id, {
            fabricType,
            fabricName,
            color,
            supplier,
            invoiceNumber,
            remark,
            updatedAt: new Date()
        });
        
        req.flash('success_msg', 'Stock updated successfully');
        res.redirect(`/fabrics/stock/view/${req.params.id}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating stock');
        res.redirect(`/fabrics/stock/view/${req.params.id}`);
    }
};

// Delete stock
exports.deleteStock = async (req, res) => {
    try {
        await FabricStock.findByIdAndUpdate(req.params.id, {
            status: 'exhausted',
            remainingMeters: 0
        });
        
        req.flash('success_msg', 'Stock marked as exhausted');
        res.redirect('/fabrics/stock');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting stock');
        res.redirect('/fabrics/stock');
    }
};

// Add consumption
exports.addConsumption = async (req, res) => {
    try {
        const { fabricStockId, cuttingId, consumedMeters, wastedMeters, metersPerPiece, remark } = req.body;
        
        const stock = await FabricStock.findById(fabricStockId);
        if (!stock) {
            req.flash('error_msg', 'Fabric stock not found');
            return res.redirect('/fabrics/stock');
        }
        
        if (consumedMeters > stock.remainingMeters) {
            req.flash('error_msg', `Insufficient stock! Available: ${stock.remainingMeters} meters`);
            return res.redirect('/fabrics/stock');
        }
        
        const cutting = await Cutting.findById(cuttingId);
        
        const consumption = new FabricConsumption({
            fabricStock: fabricStockId,
            cutting: cuttingId,
            consumedMeters: parseFloat(consumedMeters),
            wastedMeters: parseFloat(wastedMeters) || 0,
            productName: cutting ? cutting.productName : 'Unknown',
            productCategory: cutting ? cutting.productCategory : 'Unknown',
            totalPieces: cutting ? cutting.totalPieces : 0,
            metersPerPiece: parseFloat(metersPerPiece),
            remark: remark || '',
            createdBy: req.session.user.id
        });
        
        await consumption.save();
        
        stock.consumedMeters = (stock.consumedMeters || 0) + parseFloat(consumedMeters);
        stock.wastedMeters = (stock.wastedMeters || 0) + (parseFloat(wastedMeters) || 0);
        stock.remainingMeters = stock.totalMeters - stock.consumedMeters - stock.wastedMeters;
        await stock.save();
        
        req.flash('success_msg', `Consumption recorded: ${consumedMeters} meters used`);
        res.redirect(`/fabrics/stock/view/${fabricStockId}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error recording consumption');
        res.redirect('/fabrics/stock');
    }
};

// Add waste
exports.addWaste = async (req, res) => {
    try {
        const { fabricStockId, wastedMeters, wasteType, wasteReason, remark } = req.body;
        
        const stock = await FabricStock.findById(fabricStockId);
        if (!stock) {
            req.flash('error_msg', 'Fabric stock not found');
            return res.redirect('/fabrics/stock');
        }
        
        if (wastedMeters > stock.remainingMeters) {
            req.flash('error_msg', `Cannot waste more than available! Available: ${stock.remainingMeters} meters`);
            return res.redirect('/fabrics/stock');
        }
        
        const waste = new FabricWaste({
            fabricStock: fabricStockId,
            wastedMeters: parseFloat(wastedMeters),
            wasteType,
            wasteReason,
            remark: remark || '',
            createdBy: req.session.user.id
        });
        
        await waste.save();
        
        stock.wastedMeters = (stock.wastedMeters || 0) + parseFloat(wastedMeters);
        stock.remainingMeters = stock.totalMeters - stock.consumedMeters - stock.wastedMeters;
        await stock.save();
        
        req.flash('success_msg', `Waste recorded: ${wastedMeters} meters`);
        res.redirect(`/fabrics/stock/view/${fabricStockId}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error recording waste');
        res.redirect('/fabrics/stock');
    }
};

// Get stock summary API
exports.getStockSummary = async (req, res) => {
    try {
        const stock = await FabricStock.find({ status: { $in: ['in_stock', 'partial'] } });
        
        const summary = {
            totalTypes: [...new Set(stock.map(s => s.fabricType))].length,
            totalBatches: stock.length,
            totalMeters: stock.reduce((sum, s) => sum + s.remainingMeters, 0),
            lowStock: stock.filter(s => s.remainingMeters < 100).length,
            byFabricType: {}
        };
        
        stock.forEach(s => {
            if (!summary.byFabricType[s.fabricType]) {
                summary.byFabricType[s.fabricType] = { totalMeters: 0, batches: 0 };
            }
            summary.byFabricType[s.fabricType].totalMeters += s.remainingMeters;
            summary.byFabricType[s.fabricType].batches++;
        });
        
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get low stock alert
exports.getLowStockAlert = async (req, res) => {
    try {
        const lowStock = await FabricStock.find({ 
            remainingMeters: { $lt: 100, $gt: 0 },
            status: { $ne: 'exhausted' }
        }).sort({ remainingMeters: 1 });
        
        res.json({ lowStock, count: lowStock.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};