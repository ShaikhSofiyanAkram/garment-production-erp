const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const BillPayment = require('../models/BillPayment');
const AdvanceClient = require('../models/AdvanceClient');

// Payment Collection Page
router.get('/', protect, adminOnly, async (req, res) => {
    try {
        let billIds = [];
        
        if (req.query.bills) {
            if (typeof req.query.bills === 'string') {
                billIds = req.query.bills.split(',');
            } else {
                billIds = req.query.bills;
            }
        }
        
        const bills = await Bill.find({ _id: { $in: billIds } })
            .populate('client', 'name phone address gstNo');
        
        // Calculate available advance for each bill's client
        for (const bill of bills) {
            const advances = await AdvanceClient.find({ 
                client: bill.client._id
            });
            
            let totalAdvanceReceived = 0;
            let totalAdvanceUsed = 0;
            
            for (const advance of advances) {
                totalAdvanceReceived += advance.amount;
                const usedInAdvance = advance.adjustedBills.reduce((sum, adj) => sum + (adj.amount || 0), 0);
                totalAdvanceUsed += usedInAdvance;
            }
            
            bill.availableAdvance = totalAdvanceReceived - totalAdvanceUsed;
        }
        
        const totalAmount = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const totalPaid = bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        const totalPending = totalAmount - totalPaid;
        const totalAvailableAdvance = bills.reduce((sum, b) => sum + (b.availableAdvance || 0), 0);
        
        res.render('payment-collection/index', {
            title: 'Payment Collection',
            bills,
            totalAmount,
            totalPaid,
            totalPending,
            totalAvailableAdvance,
            selectedBillIds: billIds,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error_msg', 'Error loading payment collection');
        res.redirect('/bills/pending-summary');
    }
});

// Process Payment - FIXED WORKING VERSION
router.post('/process', protect, adminOnly, async (req, res) => {
    try {
        const { billIds, amount, paymentMethod, reference, paymentDate, remark, useAdvance } = req.body;
        
        console.log('========== PAYMENT PROCESSING ==========');
        console.log('Bill IDs:', billIds);
        console.log('Amount:', amount);
        console.log('Use Advance:', useAdvance);
        
        let ids = [];
        if (typeof billIds === 'string') {
            ids = billIds.split(',');
        } else if (Array.isArray(billIds)) {
            ids = billIds;
        }
        
        let paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            req.flash('error_msg', 'Please enter a valid amount');
            return res.redirect(`/payment-collection?bills=${ids.join(',')}`);
        }
        
        const bills = await Bill.find({ _id: { $in: ids } }).populate('client');
        let totalAdvanceUsed = 0;
        let remainingAmount = paymentAmount;
        let paymentRecords = [];
        
        for (const bill of bills) {
            if (remainingAmount <= 0) break;
            
            const pendingAmount = bill.totalAmount - bill.paidAmount;
            if (pendingAmount <= 0) continue;
            
            let payAmount = 0;
            let advanceUsedForThisBill = 0;
            let cashUsedForThisBill = 0;
            
            // Use advance if selected
            if (useAdvance === 'yes') {
                // Get all active advances for this client
                const advances = await AdvanceClient.find({ 
                    client: bill.client._id
                });
                
                console.log(`Found ${advances.length} advances for client ${bill.client.name}`);
                
                for (const advance of advances) {
                    if (remainingAmount <= 0) break;
                    if (payAmount >= pendingAmount) break;
                    
                    // Calculate already used amount
                    const alreadyUsed = advance.adjustedBills.reduce((sum, adj) => sum + (adj.amount || 0), 0);
                    const availableInAdvance = advance.amount - alreadyUsed;
                    
                    console.log(`Advance ${advance._id}: Amount=${advance.amount}, Used=${alreadyUsed}, Available=${availableInAdvance}`);
                    
                    if (availableInAdvance <= 0) continue;
                    
                    const remainingForBill = pendingAmount - payAmount;
                    const toTake = Math.min(availableInAdvance, remainingForBill, remainingAmount);
                    
                    if (toTake > 0) {
                        // PUSH to adjustedBills array
                        advance.adjustedBills.push({
                            bill: bill._id,
                            amount: toTake,
                            adjustedDate: new Date()
                        });
                        
                        // Update status
                        const newUsed = advance.adjustedBills.reduce((sum, adj) => sum + (adj.amount || 0), 0);
                        if (newUsed >= advance.amount) {
                            advance.status = 'exhausted';
                        } else if (newUsed > 0) {
                            advance.status = 'partial';
                        }
                        
                        // SAVE the advance
                        await advance.save();
                        console.log(`✅ Advance ${advance._id}: Used ₹${toTake}, New Status: ${advance.status}`);
                        
                        advanceUsedForThisBill += toTake;
                        payAmount += toTake;
                        remainingAmount -= toTake;
                        totalAdvanceUsed += toTake;
                    }
                }
            }
            
            // Use cash for remaining
            if (payAmount < pendingAmount && remainingAmount > 0) {
                cashUsedForThisBill = Math.min(remainingAmount, pendingAmount - payAmount);
                payAmount += cashUsedForThisBill;
                remainingAmount -= cashUsedForThisBill;
            }
            
            if (payAmount > 0) {
                // Update bill
                bill.paidAmount += payAmount;
                bill.pendingAmount = bill.totalAmount - bill.paidAmount;
                
                if (bill.pendingAmount === 0) {
                    bill.status = 'paid';
                } else if (bill.paidAmount > 0) {
                    bill.status = 'partial';
                }
                
                await bill.save();
                console.log(`✅ Bill ${bill.billNumber}: Paid ₹${payAmount}, New Pending: ${bill.pendingAmount}`);
                
                // Create payment record
                const payment = await BillPayment.create({
                    bill: bill._id,
                    client: bill.client._id,
                    amount: payAmount,
                    advanceAmount: advanceUsedForThisBill,
                    cashAmount: cashUsedForThisBill,
                    paymentDate: paymentDate || new Date(),
                    paymentMethod: paymentMethod,
                    reference: reference || '',
                    remark: remark || (advanceUsedForThisBill > 0 ? `Advance used: ₹${advanceUsedForThisBill}` : ''),
                    createdBy: req.session.user.id
                });
                
                paymentRecords.push(payment);
            }
        }
        
        // Verify advance deduction
        let verificationMsg = '';
        if (totalAdvanceUsed > 0) {
            const firstBill = bills[0];
            const updatedAdvances = await AdvanceClient.find({ client: firstBill.client._id });
            let remainingAdvance = 0;
            for (const adv of updatedAdvances) {
                const used = adv.adjustedBills.reduce((sum, adj) => sum + (adj.amount || 0), 0);
                remainingAdvance += (adv.amount - used);
            }
            verificationMsg = ` | Advance used: ₹${totalAdvanceUsed.toLocaleString()} | Remaining advance: ₹${remainingAdvance.toLocaleString()}`;
        }
        
        req.flash('success_msg', `✅ Payment of ₹${paymentAmount.toLocaleString()} processed for ${paymentRecords.length} bill(s)${verificationMsg}`);
        res.redirect('/bills/pending-summary');
        
    } catch (error) {
        console.error('Payment error:', error);
        req.flash('error_msg', 'Error processing payment: ' + error.message);
        res.redirect(`/payment-collection?bills=${billIds}`);
    }
});

// Debug route - Check advance status
router.get('/debug/advances', protect, adminOnly, async (req, res) => {
    try {
        const advances = await AdvanceClient.find().populate('client', 'name');
        
        const advanceData = [];
        let totalAdvance = 0;
        let totalUsed = 0;
        
        for (const advance of advances) {
            const usedAmount = advance.adjustedBills.reduce((sum, adj) => sum + (adj.amount || 0), 0);
            totalAdvance += advance.amount;
            totalUsed += usedAmount;
            
            advanceData.push({
                id: advance._id,
                clientName: advance.client?.name,
                amount: advance.amount,
                usedAmount: usedAmount,
                remaining: advance.amount - usedAmount,
                status: advance.status,
                adjustments: advance.adjustedBills.map(adj => ({
                    billId: adj.bill,
                    amount: adj.amount,
                    date: adj.adjustedDate
                }))
            });
        }
        
        res.json({
            success: true,
            advances: advanceData,
            totalAdvance,
            totalUsed,
            totalRemaining: totalAdvance - totalUsed
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get client advance balance
router.get('/client-advance/:clientId', protect, adminOnly, async (req, res) => {
    try {
        const advances = await AdvanceClient.find({ client: req.params.clientId });
        
        let totalAdvance = 0;
        let totalUsed = 0;
        
        for (const advance of advances) {
            totalAdvance += advance.amount;
            const used = advance.adjustedBills.reduce((sum, adj) => sum + (adj.amount || 0), 0);
            totalUsed += used;
        }
        
        res.json({
            success: true,
            totalAdvance,
            totalUsed,
            availableAdvance: totalAdvance - totalUsed,
            advances: advances.map(a => ({
                id: a._id,
                amount: a.amount,
                used: a.adjustedBills.reduce((sum, adj) => sum + (adj.amount || 0), 0),
                remaining: a.amount - a.adjustedBills.reduce((sum, adj) => sum + (adj.amount || 0), 0),
                status: a.status
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
