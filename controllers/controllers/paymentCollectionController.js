const Bill = require('../models/Bill');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const BillPayment = require('../models/BillPayment');

// Payment Collection Page
exports.getPaymentCollection = async (req, res) => {
    try {
        let billIds = [];
        
        if (req.query.bills) {
            if (typeof req.query.bills === 'string') {
                billIds = [req.query.bills];
            } else {
                billIds = req.query.bills;
            }
        }
        
        const bills = await Bill.find({ _id: { $in: billIds } })
            .populate('client', 'name phone address gstNo');
        
        const clients = await Client.find({ isActive: true });
        
        // Calculate totals
        const totalAmount = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const totalPaid = bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        const totalPending = totalAmount - totalPaid;
        
        res.render('payment-collection/index', {
            title: 'Payment Collection',
            bills,
            clients,
            totalAmount,
            totalPaid,
            totalPending,
            selectedBillIds: billIds,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading payment collection');
        res.redirect('/bills/pending-summary');
    }
};

// Process Payment
exports.processPayment = async (req, res) => {
    try {
        const { billIds, amount, paymentMethod, reference, paymentDate, remark } = req.body;
        
        let ids = [];
        if (typeof billIds === 'string') {
            ids = [billIds];
        } else if (Array.isArray(billIds)) {
            ids = billIds;
        }
        
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            req.flash('error_msg', 'Please enter a valid amount');
            return res.redirect(`/payment-collection?bills=${ids.join(',')}`);
        }
        
        let remainingAmount = paymentAmount;
        const paymentRecords = [];
        
        // Process each bill
        for (const billId of ids) {
            if (remainingAmount <= 0) break;
            
            const bill = await Bill.findById(billId);
            if (!bill) continue;
            
            const pendingAmount = bill.totalAmount - bill.paidAmount;
            if (pendingAmount <= 0) continue;
            
            const payAmount = Math.min(remainingAmount, pendingAmount);
            
            // Update bill
            bill.paidAmount += payAmount;
            bill.pendingAmount = bill.totalAmount - bill.paidAmount;
            
            if (bill.pendingAmount === 0) {
                bill.status = 'paid';
            } else if (bill.paidAmount > 0) {
                bill.status = 'partial';
            }
            
            await bill.save();
            
            // Create payment record
            const payment = await BillPayment.create({
                bill: bill._id,
                client: bill.client,
                amount: payAmount,
                paymentDate: paymentDate || new Date(),
                paymentMethod: paymentMethod,
                reference: reference || '',
                remark: remark || '',
                createdBy: req.session.user.id
            });
            
            paymentRecords.push(payment);
            remainingAmount -= payAmount;
        }
        
        if (paymentRecords.length === 0) {
            req.flash('error_msg', 'No payment was processed');
        } else {
            req.flash('success_msg', `Payment of ₹${paymentAmount.toLocaleString()} processed successfully for ${paymentRecords.length} bill(s)`);
        }
        
        res.redirect('/bills/pending-summary');
        
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error processing payment: ' + error.message);
        res.redirect('/bills/pending-summary');
    }
};

// Get Bill Details for Payment (AJAX)
exports.getBillDetails = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate('client', 'name phone');
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }
        
        res.json({
            billNumber: bill.billNumber,
            clientName: bill.client?.name,
            totalAmount: bill.totalAmount,
            paidAmount: bill.paidAmount,
            pendingAmount: bill.totalAmount - bill.paidAmount,
            billDate: bill.billDate,
            status: bill.status
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Print Payment Receipt
exports.printReceipt = async (req, res) => {
    try {
        const payment = await BillPayment.findById(req.params.id)
            .populate('bill', 'billNumber totalAmount')
            .populate('client', 'name phone address gstNo')
            .populate('createdBy', 'username');
        
        if (!payment) {
            req.flash('error_msg', 'Payment not found');
            return res.redirect('/bills/pending-summary');
        }
        
        res.render('payment-collection/receipt', {
            title: 'Payment Receipt',
            payment,
            layout: false
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error printing receipt');
        res.redirect('/bills/pending-summary');
    }
};