const AdvanceClient = require('../models/AdvanceClient');
const Client = require('../models/Client');
const Bill = require('../models/Bill');

// Get all advances
exports.getAdvances = async (req, res) => {
    try {
        const advances = await AdvanceClient.find()
            .populate('client', 'name phone')
            .populate('adjustedBills.bill', 'billNumber')
            .sort({ paymentDate: -1 });
        
        const clients = await Client.find({ isActive: true });
        
        const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
        const totalAdjusted = advances.reduce((sum, a) => {
            return sum + a.adjustedBills.reduce((s, adj) => s + adj.amount, 0);
        }, 0);
        const totalRemaining = totalAdvance - totalAdjusted;
        
        res.render('advance/index', {
            title: 'Client Advance Management',
            advances,
            clients,
            totalAdvance,
            totalAdjusted,
            totalRemaining,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            user: req.session.user,
            currentPage: 'advance'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading advances');
        res.redirect('/dashboard');
    }
};

// Create advance payment
exports.createAdvance = async (req, res) => {
    try {
        const { client, amount, paymentMethod, reference, paymentDate, remark } = req.body;
        
        const advance = new AdvanceClient({
            client,
            amount: parseFloat(amount),
            paymentMethod,
            reference,
            paymentDate: paymentDate || new Date(),
            remark,
            createdBy: req.session.user.id
        });
        
        await advance.save();
        
        req.flash('success_msg', `✅ Advance of ₹${parseFloat(amount).toLocaleString()} recorded for client`);
        res.redirect('/advance');
        
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating advance');
        res.redirect('/advance');
    }
};

// Get client advance details - ✅ USED BY PAYMENT COLLECTION
// Get client advance details (FIXED)
// Get client advance details (FIXED - Called from bills API)
exports.getClientAdvance = async (req, res) => {
    try {
        const clientId = req.params.clientId;
        
        console.log(`🔍 Fetching advance for client: ${clientId}`);
        
        const advances = await AdvanceClient.find({ 
            client: clientId
        }).sort({ paymentDate: -1 });
        
        console.log(`📦 Found ${advances.length} advances`);
        
        let totalAdvance = 0;
        let totalAdjusted = 0;
        let availableAdvance = 0;
        
        const formattedAdvances = advances.map(a => {
            const adjusted = a.adjustedBills.reduce((s, adj) => s + adj.amount, 0);
            const remaining = a.amount - adjusted;
            
            totalAdvance += a.amount;
            totalAdjusted += adjusted;
            availableAdvance += remaining;
            
            console.log(`   Advance ${a._id}: amount=${a.amount}, adjusted=${adjusted}, remaining=${remaining}, status=${a.status}`);
            
            return {
                id: a._id,
                amount: a.amount,
                remaining: remaining,
                adjusted: adjusted,
                paymentDate: a.paymentDate,
                status: a.status
            };
        });
        
        res.json({
            success: true,
            advances: formattedAdvances,
            totalAdvance: totalAdvance,
            totalAdjusted: totalAdjusted,
            availableAdvance: availableAdvance
        });
        
    } catch (error) {
        console.error('Error getting client advance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Adjust advance against bill
exports.adjustAdvance = async (req, res) => {
    try {
        const { advanceId, billId, amount } = req.body;
        
        const advance = await AdvanceClient.findById(advanceId);
        if (!advance) {
            return res.status(404).json({ success: false, error: 'Advance not found' });
        }
        
        const bill = await Bill.findById(billId);
        if (!bill) {
            return res.status(404).json({ success: false, error: 'Bill not found' });
        }
        
        const currentUsed = advance.adjustedBills.reduce((sum, adj) => sum + adj.amount, 0);
        const available = advance.amount - currentUsed;
        
        if (amount > available) {
            return res.status(400).json({ success: false, error: `Only ₹${available} advance available` });
        }
        
        // Add adjustment
        advance.adjustedBills.push({
            bill: billId,
            amount: parseFloat(amount),
            adjustedDate: new Date()
        });
        
        // Update bill paid amount from advance
        bill.paidAmount += parseFloat(amount);
        bill.pendingAmount = bill.totalAmount - bill.paidAmount;
        
        if (bill.pendingAmount === 0) {
            bill.status = 'paid';
        } else if (bill.paidAmount > 0) {
            bill.status = 'partial';
        }
        
        await bill.save();
        
        // Update advance status
        const newUsed = advance.adjustedBills.reduce((sum, adj) => sum + adj.amount, 0);
        if (newUsed >= advance.amount) {
            advance.status = 'exhausted';
        } else if (newUsed > 0) {
            advance.status = 'partial';
        }
        
        await advance.save();
        
        res.json({ 
            success: true, 
            message: `₹${amount} adjusted from advance for bill ${bill.billNumber}`,
            billPending: bill.pendingAmount,
            advanceRemaining: advance.amount - newUsed
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete advance
exports.deleteAdvance = async (req, res) => {
    try {
        const advance = await AdvanceClient.findById(req.params.id);
        if (!advance) {
            req.flash('error_msg', 'Advance not found');
            return res.redirect('/advance');
        }
        
        if (advance.adjustedBills.length > 0) {
            req.flash('error_msg', 'Cannot delete advance that has been used against bills');
            return res.redirect('/advance');
        }
        
        await AdvanceClient.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Advance deleted successfully');
        res.redirect('/advance');
        
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting advance');
        res.redirect('/advance');
    }
};

// Get advance statement
exports.getAdvanceStatement = async (req, res) => {
    try {
        const { clientId, fromDate, toDate } = req.query;
        
        let filter = {};
        if (clientId) filter.client = clientId;
        if (fromDate || toDate) {
            filter.paymentDate = {};
            if (fromDate) filter.paymentDate.$gte = new Date(fromDate);
            if (toDate) filter.paymentDate.$lte = new Date(toDate);
        }
        
        const advances = await AdvanceClient.find(filter)
            .populate('client', 'name phone')
            .populate('adjustedBills.bill', 'billNumber');
        
        const clients = await Client.find({ isActive: true });
        
        if (req.xhr) {
            return res.json({ advances });
        }
        
        res.render('advance/statement', {
            title: 'Advance Statement',
            advances,
            clients,
            clientId,
            fromDate,
            toDate,
            user: req.session.user,
            currentPage: 'advance'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error generating statement');
        res.redirect('/advance');
    }
};
