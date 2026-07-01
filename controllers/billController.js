const Bill = require('../models/Bill');
const Client = require('../models/Client');
const BillPayment = require('../models/BillPayment');
const Packing = require('../models/Packing');
const Product = require('../models/Product');

// Get all bills with filters
exports.getBills = async (req, res) => {
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
            client, 
            fromDate, 
            toDate, 
            status,
            user: req.session.user,
            currentPage: 'bills'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching bills');
        res.redirect('/dashboard');
    }
};

// Create bill form
exports.createForm = async (req, res) => {
    try {
        const clients = await Client.find({ isActive: true });
        const products = await Product.find({ isActive: true });
        
        res.render('bills/create', { 
            title: 'Create New Bill', 
            clients,
            products,
            user: req.session.user,
            currentPage: 'bills'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/bills');
    }
};

// Create bill
exports.createBill = async (req, res) => {
    try {
        const { client, billDate, dueDate, items, gstPercent, roundOff, remark, paymentTerms } = req.body;
        
        console.log('📝 Creating bill for client:', client);
        
        let itemsArray = [];
        if (typeof items === 'string') {
            try {
                itemsArray = JSON.parse(items);
            } catch(e) {
                itemsArray = [];
            }
        } else if (Array.isArray(items)) {
            itemsArray = items;
        }
        
        if (!itemsArray || itemsArray.length === 0) {
            req.flash('error_msg', 'Please add at least one item');
            return res.redirect('/bills/create');
        }
        
        // Calculate totals
        let subtotal = 0;
        itemsArray.forEach(item => {
            if (!item.amount && item.quantity && item.rate) {
                item.amount = item.quantity * item.rate;
            }
            subtotal += item.amount || 0;
        });
        
        const gstPercentNum = parseFloat(gstPercent) || 0;
        const cgstAmount = subtotal * (gstPercentNum / 2) / 100;
        const sgstAmount = subtotal * (gstPercentNum / 2) / 100;
        let totalAmount = subtotal + cgstAmount + sgstAmount;
        
        let roundOffAmount = 0;
        if (roundOff === 'up') {
            roundOffAmount = Math.ceil(totalAmount) - totalAmount;
            totalAmount = Math.ceil(totalAmount);
        } else if (roundOff === 'down') {
            roundOffAmount = totalAmount - Math.floor(totalAmount);
            totalAmount = Math.floor(totalAmount);
        }
        
        const bill = await Bill.create({
            client,
            billDate: billDate || new Date(),
            dueDate: dueDate || null,
            items: itemsArray,
            subtotal,
            gstPercent: gstPercentNum,
            cgstAmount,
            sgstAmount,
            roundOff: roundOffAmount,
            totalAmount,
            remark: remark || '',
            paymentTerms: paymentTerms || 'weekly',
            createdBy: req.session.user.id
        });
        
        req.flash('success_msg', `✅ Bill ${bill.billNumber} created successfully`);
        res.redirect('/bills');
        
    } catch (error) {
        console.error('Bill creation error:', error);
        req.flash('error_msg', 'Error creating bill: ' + error.message);
        res.redirect('/bills/create');
    }
};

// View bill
// View bill (FIXED)
exports.viewBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate('client', 'name gstNo phone address');
        
        // ✅ Get payments for this bill
        let payments = [];
        try {
            const BillPayment = require('../models/BillPayment');
            payments = await BillPayment.find({ bill: bill._id }).populate('createdBy', 'username');
        } catch(e) {
            console.log('Payment model not found, skipping payments');
        }
        
        res.render('bills/view', { 
            title: 'Bill Details', 
            bill, 
            payments: payments || [],  // ✅ Always pass array
            user: req.session.user,
            currentPage: 'bills'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Bill not found');
        res.redirect('/bills');
    }
};

// Print bill
exports.printBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate('client', 'name gstNo phone address');
        res.render('bills/print', { title: 'Print Bill', bill, layout: false });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error printing bill');
        res.redirect('/bills');
    }
};

// WhatsApp format
exports.getWhatsAppFormat = async (req, res) => {
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
};

// Pending bills summary
exports.pendingSummary = async (req, res) => {
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
            client, 
            fromDate, 
            toDate,
            user: req.session.user,
            currentPage: 'bills'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading pending summary');
        res.redirect('/bills');
    }
};

// Print selected bills
exports.printSelectedBills = async (req, res) => {
    try {
        const { billIds } = req.body;
        let ids = [];
        
        if (typeof billIds === 'string') {
            try {
                ids = JSON.parse(billIds);
            } catch(e) {
                ids = [billIds];
            }
        } else if (Array.isArray(billIds)) {
            ids = billIds;
        }
        
        const bills = await Bill.find({ _id: { $in: ids } }).populate('client', 'name');
        const totalAmount = bills.reduce((sum, b) => sum + b.totalAmount, 0);
        const totalPaid = bills.reduce((sum, b) => sum + b.paidAmount, 0);
        const totalPending = totalAmount - totalPaid;
        
        if (req.xhr || req.headers.accept === 'application/json') {
            return res.json({ bills, totalAmount, totalPaid, totalPending });
        }
        
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
};

// const Bill = require('../models/Bill');
// const Product = require('../models/Product');
// // const Payment = require('../models/Payment'); // REMOVE THIS LINE
// const PaymentTransaction = require('../models/PaymentTransaction');

// exports.getBills = async (req, res) => {
//     try {
//         const bills = await Bill.find()
//             .populate('items.product', 'name')
//             .sort({ billDate: -1 });
//         res.render('bills/index', { title: 'Bills', bills });
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error fetching bills');
//         res.redirect('/dashboard');
//     }
// };

// exports.createForm = async (req, res) => {
//     try {
//         const products = await Product.find({ isActive: true });
//         res.render('bills/create', { title: 'Create Bill', products });
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error loading form');
//         res.redirect('/bills');
//     }
// };

// exports.createBill = async (req, res) => {
//     try {
//         const { client, items, totalAmount } = req.body;
        
//         let itemsArray = [];
//         if (items) {
//             const itemCount = Array.isArray(items.product) ? items.product.length : 1;
//             for (let i = 0; i < itemCount; i++) {
//                 const product = await Product.findById(Array.isArray(items.product) ? items.product[i] : items.product);
//                 const quantity = parseFloat(Array.isArray(items.quantity) ? items.quantity[i] : items.quantity);
//                 const rate = product.rates.client;
                
//                 itemsArray.push({
//                     product: product._id,
//                     quantity,
//                     rate,
//                     amount: quantity * rate
//                 });
//             }
//         }
        
//         const bill = await Bill.create({
//             client,
//             items: itemsArray,
//             totalAmount: parseFloat(totalAmount),
//             createdBy: req.session.user.id
//         });
        
//         req.flash('success_msg', `Bill ${bill.billNumber} created successfully`);
//         res.redirect('/bills');
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error creating bill');
//         res.redirect('/bills/create');
//     }
// };

// exports.viewBill = async (req, res) => {
//     try {
//         const bill = await Bill.findById(req.params.id)
//             .populate('items.product', 'name');
//         const payments = await PaymentTransaction.find({ bill: bill._id });
//         res.render('bills/view', { title: 'Bill Details', bill, payments });
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Bill not found');
//         res.redirect('/bills');
//     }
// };

// exports.printBill = async (req, res) => {
//     try {
//         const bill = await Bill.findById(req.params.id)
//             .populate('items.product', 'name');
//         res.render('bills/print', { title: 'Print Bill', bill, layout: false });
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error printing bill');
//         res.redirect('/bills');
//     }
// };
// // const Bill = require('../models/Bill');
// // const Product = require('../models/Product');
// // // const Payment = require('../models/Payment');
// // // const Payment = require('../models/Payment'); // Remove this - model doesn't exist
// // const PaymentTransaction = require('../models/PaymentTransaction'); // Use this if needed

// // exports.getBills = async (req, res) => {
// //   try {
// //     const bills = await Bill.find()
// //       .populate('items.product', 'name')
// //       .sort({ billDate: -1 });
// //     res.render('bills/index', { title: 'Bills', bills });
// //   } catch (error) {
// //     req.flash('error_msg', 'Error fetching bills');
// //     res.redirect('/dashboard');
// //   }
// // };

// // exports.createForm = async (req, res) => {
// //   try {
// //     const products = await Product.find({ isActive: true });
// //     res.render('bills/create', { title: 'Create Bill', products });
// //   } catch (error) {
// //     req.flash('error_msg', 'Error loading form');
// //     res.redirect('/bills');
// //   }
// // };

// // exports.createBill = async (req, res) => {
// //   try {
// //     const { client, items, totalAmount } = req.body;
    
// //     let itemsArray = [];
// //     if (items) {
// //       const itemCount = Array.isArray(items.product) ? items.product.length : 1;
// //       for (let i = 0; i < itemCount; i++) {
// //         const product = await Product.findById(Array.isArray(items.product) ? items.product[i] : items.product);
// //         const quantity = parseFloat(Array.isArray(items.quantity) ? items.quantity[i] : items.quantity);
// //         const rate = product.rates.client;
        
// //         itemsArray.push({
// //           product: product._id,
// //           quantity,
// //           rate,
// //           amount: quantity * rate
// //         });
// //       }
// //     }
    
// //     const bill = await Bill.create({
// //       client,
// //       items: itemsArray,
// //       totalAmount: parseFloat(totalAmount),
// //       createdBy: req.session.user.id
// //     });
    
// //     req.flash('success_msg', `Bill ${bill.billNumber} created successfully`);
// //     res.redirect('/bills');
// //   } catch (error) {
// //     console.error(error);
// //     req.flash('error_msg', 'Error creating bill');
// //     res.redirect('/bills/create');
// //   }
// // };

// // exports.viewBill = async (req, res) => {
// //   try {
// //     const bill = await Bill.findById(req.params.id)
// //       .populate('items.product', 'name');
// //     const payments = await Payment.find({ bill: bill._id });
// //     res.render('bills/view', { title: 'Bill Details', bill, payments });
// //   } catch (error) {
// //     req.flash('error_msg', 'Bill not found');
// //     res.redirect('/bills');
// //   }
// // };

// // exports.printBill = async (req, res) => {
// //   try {
// //     const bill = await Bill.findById(req.params.id)
// //       .populate('items.product', 'name');
// //     res.render('bills/print', { title: 'Print Bill', bill, layout: false });
// //   } catch (error) {
// //     req.flash('error_msg', 'Error printing bill');
// //     res.redirect('/bills');
// //   }
// // };


// exports.getWhatsAppFormat = async (req, res) => {
//     try {
//         const bill = await Bill.findById(req.params.id)
//             .populate('items.product', 'name');
        
//         let message = `🏭 *GARMENT FACTORY ERP* 🏭\n`;
//         message += `━━━━━━━━━━━━━━━━━━━━\n`;
//         message += `📄 *INVOICE*: ${bill.billNumber}\n`;
//         message += `📅 *Date*: ${new Date(bill.billDate).toLocaleDateString()}\n`;
//         message += `👤 *Client*: ${bill.client}\n`;
//         message += `━━━━━━━━━━━━━━━━━━━━\n`;
//         message += `*Items:*\n`;
        
//         bill.items.forEach((item, i) => {
//             message += `${i+1}. ${item.product?.name} - ${item.quantity} x ₹${item.rate} = ₹${item.amount}\n`;
//         });
        
//         message += `━━━━━━━━━━━━━━━━━━━━\n`;
//         message += `💰 *Total*: ₹${bill.totalAmount.toLocaleString()}\n`;
//         message += `💵 *Paid*: ₹${bill.paidAmount.toLocaleString()}\n`;
//         message += `⏳ *Pending*: ₹${bill.pendingAmount.toLocaleString()}\n`;
//         message += `📊 *Status*: ${bill.status.toUpperCase()}\n`;
//         message += `━━━━━━━━━━━━━━━━━━━━\n`;
//         message += `Thank you for your business! 🙏\n`;
        
//         // Encode for URL
//         const encodedMessage = encodeURIComponent(message);
//         const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
        
//         res.json({ whatsappUrl, message });
//     } catch (error) {
//         res.status(500).json({ error: 'Error generating WhatsApp format' });
//     }
// };


// exports.getPendingBillsSummary = async (req, res) => {
//     try {
//         const pendingBills = await Bill.find({ status: { $ne: 'paid' } })
//             .sort({ billDate: -1 });
        
//         const totalPending = pendingBills.reduce((sum, b) => sum + b.pendingAmount, 0);
//         const totalOverdue = pendingBills.filter(b => b.dueDate && new Date(b.dueDate) < new Date())
//             .reduce((sum, b) => sum + b.pendingAmount, 0);
        
//         // Group by date range
//         const last7Days = pendingBills.filter(b => {
//             const daysDiff = (new Date() - new Date(b.billDate)) / (1000 * 60 * 60 * 24);
//             return daysDiff <= 7;
//         });
        
//         const last30Days = pendingBills.filter(b => {
//             const daysDiff = (new Date() - new Date(b.billDate)) / (1000 * 60 * 60 * 24);
//             return daysDiff > 7 && daysDiff <= 30;
//         });
        
//         const olderThan30Days = pendingBills.filter(b => {
//             const daysDiff = (new Date() - new Date(b.billDate)) / (1000 * 60 * 60 * 24);
//             return daysDiff > 30;
//         });
        
//         res.render('bills/pending-summary', {
//             title: 'Pending Bills Summary',
//             pendingBills,
//             totalPending,
//             totalOverdue,
//             last7Days: {
//                 count: last7Days.length,
//                 amount: last7Days.reduce((sum, b) => sum + b.pendingAmount, 0)
//             },
//             last30Days: {
//                 count: last30Days.length,
//                 amount: last30Days.reduce((sum, b) => sum + b.pendingAmount, 0)
//             },
//             olderThan30Days: {
//                 count: olderThan30Days.length,
//                 amount: olderThan30Days.reduce((sum, b) => sum + b.pendingAmount, 0)
//             }
//         });
//     } catch (error) {
//         req.flash('error_msg', 'Error generating summary');
//         res.redirect('/bills');
//     }
// };