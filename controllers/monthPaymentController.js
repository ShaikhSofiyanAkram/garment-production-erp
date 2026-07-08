const Worker = require('../models/Worker');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const PaymentAdvance = require('../models/PaymentAdvance');
const Packing = require('../models/Packing');
const Cutting = require('../models/Cutting');

// ==================== MONTH PAYMENT PAGE ====================
// ==================== GET MONTH PAYMENT ====================
// ==================== GET MONTH PAYMENT ====================
exports.getMonthPayment = async (req, res) => {
    try {
        const { workerId, monthKey } = req.params;
        const [year, month] = monthKey.split('-').map(Number);

        const worker = await Worker.findById(workerId);
        if (!worker) {
            req.flash('error_msg', 'Worker not found');
            return res.redirect('/payments');
        }

        // ✅ Get attendance for this month
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const attendance = await Attendance.find({
            worker: workerId,
            date: { $gte: monthStart, $lte: monthEnd }
        }).sort({ date: 1 });

        // ✅ Calculate month summary
        const presentDays = attendance.filter(a => a.status === 'present').length;
        const halfDays = attendance.filter(a => a.status === 'half-day').length;
        const absentDays = attendance.filter(a => a.status === 'absent').length;
        const holidayDays = attendance.filter(a => a.status === 'holiday').length;

        const monthlyRate = worker.monthlyRate || 0;
        const dailyRate = Math.round(monthlyRate / 26);
        const workingDays = Math.min(presentDays + (halfDays * 0.5), 26);
        const monthEarnings = Math.round(workingDays * dailyRate);

        // ✅ Check if month is already paid
        const isPaid = attendance.length > 0 && attendance.every(a => a.monthPaid === true);
        const paidAmount = isPaid ? attendance[0]?.monthPaidAmount || 0 : 0;

        // ✅ Get ALL payments for this month (CRITICAL FIX)
        const allPayments = await Payment.find({
            worker: workerId,
            paymentDate: { $gte: monthStart, $lte: monthEnd }
        });
        const totalPaid = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // ✅ Get pending advances
        const pendingAdvances = await PaymentAdvance.find({
            worker: workerId,
            status: 'pending'
        });
        const totalAdvances = pendingAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);

        // ✅ Calculate net payable (Earnings - Already Paid - Advances)
        let netPayable = monthEarnings - totalPaid - totalAdvances;

        // ✅ If month is already paid, set net payable to 0
        if (isPaid) {
            netPayable = 0;
        }

        // ✅ Ensure net payable is not negative
        netPayable = Math.max(0, netPayable);

        // ✅ Get product data
        let productName = 'N/A';
        let size = 'N/A';
        let pieces = 0;

        if (worker.workerType === 'helper') {
            const packing = await Packing.findOne({
                packingDate: { $gte: monthStart, $lte: monthEnd }
            });
            if (packing && packing.entries && packing.entries.length > 0) {
                const firstEntry = packing.entries[0];
                productName = firstEntry.productName || 'Packing';
                size = firstEntry.size || 'N/A';
                pieces = firstEntry.packedPieces || 0;
            }
        } else if (worker.workerType === 'cutting') {
            const cutting = await Cutting.findOne({
                createdAt: { $gte: monthStart, $lte: monthEnd },
                cuttingWorker: workerId
            });
            if (cutting) {
                productName = cutting.productName || 'Cutting';
                if (cutting.sizes && cutting.sizes.length > 0) {
                    size = cutting.sizes[0].size || 'N/A';
                    pieces = cutting.sizes[0].pieces || 0;
                }
            }
        }

        // ✅ Get payments list
        const payments = await Payment.find({
            worker: workerId,
            paymentDate: { $gte: monthStart, $lte: monthEnd }
        }).sort({ paymentDate: -1 });

        // ✅ Debug logs
        console.log(`📊 Month: ${monthKey}, Earnings: ${monthEarnings}, Total Paid: ${totalPaid}, Advances: ${totalAdvances}, Net: ${netPayable}, IsPaid: ${isPaid}`);

        res.render('payments/month-payment', {
            title: `${worker.name} - ${monthKey} Payment`,
            worker: worker,
            monthKey: monthKey,
            monthStart: monthStart,
            monthEnd: monthEnd,
            attendance: attendance,
            presentDays: presentDays,
            halfDays: halfDays,
            absentDays: absentDays,
            holidayDays: holidayDays,
            dailyRate: dailyRate,
            monthEarnings: monthEarnings,
            isPaid: isPaid,
            paidAmount: paidAmount,
            productName: productName,
            size: size,
            pieces: pieces,
            totalPaid: totalPaid,           // ✅ All payments for this month
            totalAdvances: totalAdvances,
            netPayable: netPayable,          // ✅ 0 if isPaid true
            payments: payments,
            user: req.session.user,
            currentPage: 'payments'
        });
    } catch (error) {
        console.error('❌ Error loading month payment:', error);
        req.flash('error_msg', 'Error loading month payment: ' + error.message);
        res.redirect('/payments');
    }
};

// ==================== PROCESS MONTH PAYMENT ====================
exports.processMonthPayment = async (req, res) => {
    try {
        const { workerId, monthKey, amount, paymentMethod, reference, paymentDate, remark, adjustAdvance } = req.body;
        const [year, month] = monthKey.split('-').map(Number);

        const worker = await Worker.findById(workerId);
        if (!worker) {
            return res.status(404).json({ success: false, error: 'Worker not found' });
        }

        // ✅ Calculate month earnings
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const attendance = await Attendance.find({
            worker: workerId,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        const presentDays = attendance.filter(a => a.status === 'present').length;
        const halfDays = attendance.filter(a => a.status === 'half-day').length;
        const monthlyRate = worker.monthlyRate || 0;
        const dailyRate = Math.round(monthlyRate / 26);
        const workingDays = Math.min(presentDays + (halfDays * 0.5), 26);
        const monthEarnings = Math.round(workingDays * dailyRate);

        // ✅ Get existing payments for this month
        const existingPayments = await Payment.find({
            worker: workerId,
            paymentDate: { $gte: monthStart, $lte: monthEnd }
        });
        const totalPaid = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // ✅ Get pending advances
        const pendingAdvances = await PaymentAdvance.find({
            worker: workerId,
            status: 'pending'
        });
        const totalAdvances = pendingAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);

        const netPayable = monthEarnings - totalPaid - totalAdvances;
        const paymentAmount = parseFloat(amount);

        if (paymentAmount > netPayable + totalAdvances) {
            return res.status(400).json({
                success: false,
                error: `Payment amount (₹${paymentAmount}) exceeds net payable (₹${netPayable + totalAdvances})`
            });
        }

        let adjustedAdvanceAmount = 0;
        let adjustedAdvanceIds = [];
        let remainingAmount = paymentAmount;

        // ✅ Adjust advance if checked
        if (adjustAdvance === true || adjustAdvance === 'true') {
            for (const advance of pendingAdvances) {
                if (remainingAmount <= 0) break;
                const adjustAmount = Math.min(advance.amount, remainingAmount);
                advance.status = 'adjusted';
                advance.adjustedAmount = adjustAmount;
                advance.adjustedAt = new Date();
                await advance.save();
                adjustedAdvanceIds.push(advance._id);
                adjustedAdvanceAmount += adjustAmount;
                remainingAmount -= adjustAmount;
            }
        }

        // ✅ Create payment
        const payment = new Payment({
            worker: workerId,
            workerType: worker.workerType,
            amount: paymentAmount,
            paymentMethod: paymentMethod || 'Cash',
            reference: reference || '',
            remark: remark || '',
            paymentDate: paymentDate || new Date(),
            createdBy: req.session.user.id,
            status: 'completed',
            adjustedAdvanceAmount: adjustedAdvanceAmount,
            adjustedAdvanceIds: adjustedAdvanceIds,
            monthKey: monthKey // ✅ Store month reference
        });
        await payment.save();

        // ✅ Mark attendance as paid for this month
        if (attendance.length > 0) {
            await Attendance.updateMany(
                {
                    worker: workerId,
                    date: { $gte: monthStart, $lte: monthEnd }
                },
                {
                    monthPaid: true,
                    monthPaidAt: new Date(),
                    monthPaidAmount: paymentAmount
                }
            );
        }

        // ✅ Update advances with payment reference
        if (adjustedAdvanceIds.length > 0) {
            await PaymentAdvance.updateMany(
                { _id: { $in: adjustedAdvanceIds } },
                { adjustedInPayment: payment._id }
            );
        }

        res.json({
            success: true,
            payment: payment,
            adjustedAdvanceAmount: adjustedAdvanceAmount,
            message: `✅ ${monthKey} payment recorded successfully!`
        });

    } catch (error) {
        console.error('❌ Error processing month payment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};