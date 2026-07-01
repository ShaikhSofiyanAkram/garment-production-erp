const express = require('express');
const router = express.Router();
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const BillPayment = require('../models/BillPayment');
const AdvanceClient = require('../models/AdvanceClient');
const { protect, adminOnly } = require('../middleware/auth');

// ============================================================
// VIEW ROUTES
// ============================================================

router.get('/', protect, adminOnly, async (req, res) => {
    try {
        const { client, fromDate, toDate, status } = req.query;
        let filter = {};
        if (client) filter.client = client;
        if (status) filter.status = status;
        if (fromDate || toDate) {
            filter.billDate = {};
            if (fromDate) filter.billDate.$gte = new Date(fromDate);
            if (toDate) filter.billDate.$lte = new Date(toDate);
        }
        const bills = await Bill.find(filter).populate('client', 'name').sort({ billDate: -1 });
        const clients = await Client.find({ isActive: true });
        
        res.render('bills/index', { 
            title: 'Bills Management', 
            bills, 
            clients, 
            client: client || '',
            fromDate: fromDate || '',
            toDate: toDate || '',
            status: status || '',
            user: req.session.user,
            currentPage: 'bills'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching bills');
        res.redirect('/dashboard');
    }
});

router.get('/create', protect, adminOnly, async (req, res) => {
    try {
        const clients = await Client.find({ isActive: true });
        res.render('bills/create', { 
            title: 'Create New Bill', 
            clients,
            user: req.session.user,
            currentPage: 'bills'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/bills');
    }
});

router.post('/create', protect, adminOnly, async (req, res) => {
    try {
        const { client, billDate, dueDate, items, gstPercent, roundOff, remark, paymentTerms } = req.body;
        
        let itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
        let subtotal = itemsArray.reduce((sum, item) => sum + (item.amount || item.quantity * item.rate), 0);
        
        const gst = parseFloat(gstPercent) || 0;
        const cgst = subtotal * (gst/2) / 100;
        const sgst = subtotal * (gst/2) / 100;
        let total = subtotal + cgst + sgst;
        
        let roundOffAmount = 0;
        if (roundOff === 'up') { 
            roundOffAmount = Math.ceil(total) - total; 
            total = Math.ceil(total); 
        } else if (roundOff === 'down') { 
            roundOffAmount = total - Math.floor(total); 
            total = Math.floor(total); 
        }
        
        const bill = await Bill.create({
            client,
            billDate: billDate || new Date(),
            dueDate: dueDate || null,
            items: itemsArray,
            subtotal,
            gstPercent: gst,
            cgstAmount: cgst,
            sgstAmount: sgst,
            roundOff: roundOffAmount,
            totalAmount: total,
            remark: remark || '',
            paymentTerms: paymentTerms || 'weekly',
            createdBy: req.session.user.id
        });
        
        req.flash('success_msg', `✅ Bill ${bill.billNumber} created successfully`);
        res.redirect('/bills');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating bill: ' + error.message);
        res.redirect('/bills/create');
    }
});

router.get('/view/:id', protect, adminOnly, async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate('client', 'name');
        res.render('bills/view', { 
            title: 'Bill Details', 
            bill,
            user: req.session.user,
            currentPage: 'bills'
        });
    } catch (error) {
        req.flash('error_msg', 'Bill not found');
        res.redirect('/bills');
    }
});

router.get('/print/:id', protect, adminOnly, async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate('client', 'name');
        res.render('bills/print', { title: 'Print Bill', bill, layout: false });
    } catch (error) {
        req.flash('error_msg', 'Error printing bill');
        res.redirect('/bills');
    }
});

router.get('/whatsapp/:id', protect, adminOnly, async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate('client', 'name');
        let message = `🏭 *GARMENT FACTORY ERP* 🏭\n━━━━━━━━━━━━━━━━━━━━\n📄 *INVOICE*: ${bill.billNumber}\n📅 *Date*: ${new Date(bill.billDate).toLocaleDateString()}\n👤 *Client*: ${bill.client.name}\n━━━━━━━━━━━━━━━━━━━━\n*ITEMS:*\n`;
        bill.items.forEach((item, i) => {
            message += `${i+1}. ${item.productName} (${item.size}) - ${item.quantity} x ₹${item.rate} = ₹${item.amount}\n`;
        });
        message += `━━━━━━━━━━━━━━━━━━━━\n💰 *Subtotal*: ₹${bill.subtotal}\n🧾 *GST (${bill.gstPercent}%)*: ₹${bill.cgstAmount + bill.sgstAmount}\n🎯 *TOTAL*: ₹${bill.totalAmount}\n━━━━━━━━━━━━━━━━━━━━\n💵 *Paid*: ₹${bill.paidAmount}\n⏳ *Pending*: ₹${bill.pendingAmount}\n📊 *Status*: ${bill.status.toUpperCase()}\n━━━━━━━━━━━━━━━━━━━━\nThank you for your business! 🙏`;
        res.json({ whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`, message });
    } catch (error) {
        res.status(500).json({ error: 'Error generating WhatsApp format' });
    }
});

router.get('/pending-summary', protect, adminOnly, async (req, res) => {
    try {
        const { client, fromDate, toDate } = req.query;
        let filter = { status: { $ne: 'paid' } };
        if (client) filter.client = client;
        if (fromDate || toDate) {
            filter.billDate = {};
            if (fromDate) filter.billDate.$gte = new Date(fromDate);
            if (toDate) filter.billDate.$lte = new Date(toDate);
        }
        const bills = await Bill.find(filter).populate('client', 'name');
        const clients = await Client.find({ isActive: true });
        
        res.render('bills/pending-summary', { 
            title: 'Pending Bills Summary', 
            bills, 
            clients, 
            client: client || '',
            fromDate: fromDate || '',
            toDate: toDate || '',
            user: req.session.user,
            currentPage: 'bills'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading pending summary');
        res.redirect('/bills');
    }
});

router.get('/payment-collection', protect, adminOnly, async (req, res) => {
    try {
        res.render('bills/payment-collection', {
            title: 'Payment Collection',
            user: req.session.user,
            currentPage: 'payment-collection'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading payment collection');
        res.redirect('/bills/pending-summary');
    }
});

router.post('/print-selected', protect, adminOnly, async (req, res) => {
    try {
        const { billIds } = req.body;
        let ids = [];
        if (typeof billIds === 'string') {
            try { ids = JSON.parse(billIds); } catch(e) { ids = [billIds]; }
        } else if (Array.isArray(billIds)) { ids = billIds; }
        
        const bills = await Bill.find({ _id: { $in: ids } }).populate('client', 'name');
        const totalAmount = bills.reduce((sum, b) => sum + b.totalAmount, 0);
        const totalPaid = bills.reduce((sum, b) => sum + b.paidAmount, 0);
        const totalPending = totalAmount - totalPaid;
        
        res.render('bills/selected-print', { 
            title: 'Selected Bills Summary', 
            bills, 
            totalAmount, 
            totalPaid, 
            totalPending, 
            layout: false 
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error printing selected bills');
        res.redirect('/bills/pending-summary');
    }
});

// ============================================================
// API ROUTES
// ============================================================

router.post('/api/selected', protect, adminOnly, async (req, res) => {
    try {
        const { billIds } = req.body;
        const bills = await Bill.find({ _id: { $in: billIds } }).populate('client', 'name phone');
        res.json({ success: true, bills });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ============================================================
// ✅ PROCESS PAYMENT WITH ADVANCE - COMPLETE REWRITE
// ============================================================
router.post('/api/process-payment', protect, adminOnly, async (req, res) => {
    try {
        const { billIds, amount, paymentMethod, reference, paymentDate, remark } = req.body;
        
        console.log('========================================');
        console.log('📝 PAYMENT PROCESSING');
        console.log('Bill IDs:', billIds);
        console.log('Amount:', amount);
        console.log('========================================');
        
        let billIdsArray = Array.isArray(billIds) ? billIds : (billIds ? billIds.split(',') : []);
        
        if (billIdsArray.length === 0) {
            req.flash('error_msg', 'No bills selected');
            return res.redirect('/bills/pending-summary');
        }
        
        const finalAmount = parseFloat(amount) || 0;
        
        if (finalAmount <= 0) {
            req.flash('error_msg', 'Invalid payment amount');
            return res.redirect('/bills/pending-summary');
        }
        
        let totalPaid = 0;
        let totalAdvanceUsed = 0;
        let totalCashUsed = 0;
        let clientId = null;
        let firstBill = null;
        let allBills = [];
        let totalPendingAmount = 0;
        
        // ✅ Get all bills and client
        for (const billId of billIdsArray) {
            const bill = await Bill.findById(billId);
            if (!bill) continue;
            allBills.push(bill);
            if (!clientId) clientId = bill.client;
            if (!firstBill) firstBill = bill;
            totalPendingAmount += bill.pendingAmount || 0;
        }
        
        console.log(`📊 Total Pending Amount: ${totalPendingAmount}`);
        console.log(`📊 Client ID: ${clientId}`);
        
        if (finalAmount > totalPendingAmount) {
            req.flash('error_msg', `Payment amount exceeds pending amount`);
            return res.redirect('/bills/pending-summary');
        }
        
        // ✅ GET AVAILABLE ADVANCE FROM BACKEND
        let availableAdvance = 0;
        if (clientId) {
            const advances = await AdvanceClient.find({ client: clientId });
            console.log(`📦 Found ${advances.length} advances for client ${clientId}`);
            
            for (const adv of advances) {
                const used = adv.adjustedBills.reduce((sum, adj) => sum + adj.amount, 0);
                const remaining = adv.amount - used;
                console.log(`   Advance ${adv._id}: amount=${adv.amount}, used=${used}, remaining=${remaining}`);
                if (remaining > 0) {
                    availableAdvance += remaining;
                }
            }
        }
        
        console.log(`💰 Available Advance: ${availableAdvance}`);
        
        // ✅ Calculate advance and cash split
        const advanceToUse = Math.min(finalAmount, availableAdvance);
        const cashToUse = finalAmount - advanceToUse;
        
        console.log(`💰 Advance to use: ${advanceToUse}, Cash to use: ${cashToUse}`);
        
        // ✅ Process each bill
        for (const bill of allBills) {
            const pending = bill.pendingAmount || 0;
            if (pending <= 0) continue;
            
            const remainingAmount = finalAmount - totalPaid;
            const toPay = Math.min(remainingAmount, pending);
            if (toPay <= 0) continue;
            
            const advanceForBill = Math.min(toPay, advanceToUse - totalAdvanceUsed);
            const cashForBill = toPay - advanceForBill;
            
            console.log(`📊 Bill ${bill.billNumber}: toPay=${toPay}, advance=${advanceForBill}, cash=${cashForBill}`);
            
            // ✅ Update bill
            bill.paidAmount += toPay;
            bill.pendingAmount = bill.totalAmount - bill.paidAmount;
            bill.status = bill.pendingAmount === 0 ? 'paid' : (bill.paidAmount > 0 ? 'partial' : 'pending');
            await bill.save();
            console.log(`✅ Bill ${bill.billNumber}: Paid ₹${toPay}, New Pending: ${bill.pendingAmount}`);
            
            // ✅ Create payment record
            await BillPayment.create({
                bill: bill._id,
                client: bill.client,
                amount: toPay,
                advanceAmount: advanceForBill || 0,
                cashAmount: cashForBill || 0,
                paymentMethod: paymentMethod || 'cash',
                reference: reference || '',
                paymentDate: paymentDate || new Date(),
                remark: remark || '',
                createdBy: req.session.user.id
            });
            
            totalPaid += toPay;
            totalAdvanceUsed += advanceForBill || 0;
            totalCashUsed += cashForBill || 0;
        }
        
        console.log(`📊 Total Paid: ${totalPaid}, Advance Used: ${totalAdvanceUsed}, Cash Used: ${totalCashUsed}`);
        
        // ✅ ADJUST ADVANCE RECORDS
        if (totalAdvanceUsed > 0 && clientId && firstBill) {
            console.log('========================================');
            console.log('🔍 ADJUSTING ADVANCE');
            console.log(`Client: ${clientId}`);
            console.log(`Advance to adjust: ${totalAdvanceUsed}`);
            console.log('========================================');
            
            try {
                const advances = await AdvanceClient.find({ client: clientId });
                console.log(`📦 Found ${advances.length} advances for client ${clientId}`);
                
                let remainingToAdjust = totalAdvanceUsed;
                
                for (const advance of advances) {
                    if (remainingToAdjust <= 0) break;
                    
                    const used = advance.adjustedBills.reduce((sum, adj) => sum + adj.amount, 0);
                    const available = advance.amount - used;
                    
                    console.log(`   Advance ${advance._id}: amount=${advance.amount}, used=${used}, available=${available}`);
                    
                    if (available <= 0) {
                        console.log(`   ⏭️ Skipping - no balance`);
                        continue;
                    }
                    
                    const toAdjust = Math.min(remainingToAdjust, available);
                    
                    if (toAdjust > 0) {
                        advance.adjustedBills.push({
                            bill: firstBill._id,
                            amount: toAdjust,
                            adjustedDate: new Date()
                        });
                        
                        await advance.save();
                        console.log(`✅ Advance ${advance._id}: Adjusted ₹${toAdjust}, New Remaining: ${advance.remainingAmount}, Status: ${advance.status}`);
                        
                        remainingToAdjust -= toAdjust;
                    }
                }
                
                console.log(`✅ Advance adjustment complete. Remaining: ${remainingToAdjust}`);
                
            } catch (advError) {
                console.error('❌ Advance adjustment error:', advError);
            }
        }
        
        console.log('========================================');
        console.log('✅ PAYMENT COMPLETE');
        console.log('========================================');
        
        req.flash('success_msg', `✅ Payment of ₹${totalPaid.toLocaleString()} processed`);
        res.redirect('/bills/pending-summary');
        
    } catch (error) {
        console.error('❌ Payment error:', error);
        req.flash('error_msg', 'Error processing payment: ' + error.message);
        res.redirect('/bills/pending-summary');
    }
});

module.exports = router;