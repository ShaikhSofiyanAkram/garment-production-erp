const Worker = require('../models/Worker');
const Payment = require('../models/Payment');
const Advance = require('../models/Advance');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const PressmanEntry = require('../models/PressmanEntry');
const Attendance = require('../models/Attendance');
const ExcelJS = require('exceljs');

// ==================== PAYMENT SUMMARY REPORT ====================
exports.getPaymentSummary = async (req, res) => {
    try {
        const { period, fromDate, toDate } = req.query;
        
        // Date filter
        let dateFilter = {};
        const now = new Date();
        
        if (period === 'week') {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            dateFilter = { $gte: weekStart };
        } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { $gte: monthStart };
        } else if (period === 'custom' && fromDate && toDate) {
            dateFilter = { 
                $gte: new Date(fromDate), 
                $lte: new Date(toDate) 
            };
        }
        
        // Get all workers
        const workers = await Worker.find({ isActive: true });
        
        let reportData = [];
        let grandTotalEarnings = 0;
        let grandTotalPaid = 0;
        let grandTotalAdvances = 0;
        let grandNetPayable = 0;
        
        for (const worker of workers) {
            let totalEarnings = 0;
            let totalPieces = 0;
            let workDetails = [];
            
            // Calculate earnings based on worker type
            if (worker.workerType === 'karigar') {
                const assignments = await Assignment.find({
                    karigar: worker._id,
                    status: 'completed',
                    ...(Object.keys(dateFilter).length && { assignedDate: dateFilter })
                }).populate('product', 'name rates');
                
                for (const assign of assignments) {
                    const returns = await ProductionReturn.find({ assignment: assign._id });
                    const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
                    const rate = assign.product?.rates?.karigar || 0;
                    totalPieces += totalReturned;
                    totalEarnings += totalReturned * rate;
                }
            } else if (worker.workerType === 'pressman') {
                const entries = await PressmanEntry.find({
                    pressman: worker._id,
                    ...(Object.keys(dateFilter).length && { date: dateFilter })
                });
                
                for (const entry of entries) {
                    for (const item of entry.entries) {
                        totalPieces += item.quantity || 0;
                        totalEarnings += item.amount || 0;
                    }
                }
            } else if (worker.workerType === 'helper' || worker.workerType === 'cutting') {
                const attendance = await Attendance.find({
                    worker: worker._id,
                    ...(Object.keys(dateFilter).length && { date: dateFilter })
                });
                const presentDays = attendance.filter(a => a.status === 'present').length;
                const dailyRate = (worker.monthlyRate || 0) / 26;
                totalEarnings = presentDays * dailyRate;
            }
            
            // Get payments
            const payments = await Payment.find({
                worker: worker._id,
                ...(Object.keys(dateFilter).length && { paymentDate: dateFilter })
            });
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            // Get advances
            const advances = await Advance.find({
                worker: worker._id,
                ...(Object.keys(dateFilter).length && { date: dateFilter })
            });
            const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
            
            const netPayable = totalEarnings - totalPaid - totalAdvances;
            
            reportData.push({
                worker: worker,
                totalPieces,
                totalEarnings,
                totalPaid,
                totalAdvances,
                netPayable
            });
            
            grandTotalEarnings += totalEarnings;
            grandTotalPaid += totalPaid;
            grandTotalAdvances += totalAdvances;
            grandNetPayable += netPayable;
        }
        
        res.render('reports/payment-summary', {
            title: 'Payment Summary Report',
            reportData: reportData,
            grandTotalEarnings,
            grandTotalPaid,
            grandTotalAdvances,
            grandNetPayable,
            period: period || 'all',
            user: req.session.user,
            currentPage: 'reports'
        });
    } catch (error) {
        console.error('❌ Error generating report:', error);
        req.flash('error_msg', 'Error generating report');
        res.redirect('/dashboard');
    }
};

// ==================== EXPORT TO EXCEL ====================
exports.exportPaymentReport = async (req, res) => {
    try {
        const { period } = req.query;
        
        // Get data
        const workers = await Worker.find({ isActive: true });
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payment Report');
        
        // Header
        worksheet.addRow(['S.No', 'Worker Name', 'Type', 'Total Pieces', 'Earnings', 'Paid', 'Advances', 'Net Payable']);
        worksheet.getRow(1).font = { bold: true };
        
        let rowNum = 2;
        let totalEarnings = 0;
        let totalPaid = 0;
        let totalAdvances = 0;
        let totalNetPayable = 0;
        
        for (const worker of workers) {
            // Calculate earnings (simplified)
            let earnings = 0;
            let pieces = 0;
            
            if (worker.workerType === 'karigar') {
                const assignments = await Assignment.find({ karigar: worker._id, status: 'completed' });
                for (const assign of assignments) {
                    const returns = await ProductionReturn.find({ assignment: assign._id });
                    const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
                    const rate = assign.product?.rates?.karigar || 0;
                    pieces += totalReturned;
                    earnings += totalReturned * rate;
                }
            } else if (worker.workerType === 'pressman') {
                const entries = await PressmanEntry.find({ pressman: worker._id });
                for (const entry of entries) {
                    for (const item of entry.entries) {
                        pieces += item.quantity || 0;
                        earnings += item.amount || 0;
                    }
                }
            }
            
            const payments = await Payment.find({ worker: worker._id });
            const paid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            const advances = await Advance.find({ worker: worker._id });
            const advanceTotal = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
            
            const netPayable = earnings - paid - advanceTotal;
            
            worksheet.addRow([rowNum - 1, worker.name, worker.workerType, pieces, earnings, paid, advanceTotal, netPayable]);
            
            totalEarnings += earnings;
            totalPaid += paid;
            totalAdvances += advanceTotal;
            totalNetPayable += netPayable;
            rowNum++;
        }
        
        // Footer
        worksheet.addRow([]);
        worksheet.addRow(['TOTAL', '', '', '', totalEarnings, totalPaid, totalAdvances, totalNetPayable]);
        worksheet.getRow(rowNum + 1).font = { bold: true };
        
        // Set column widths
        worksheet.columns = [
            { width: 8 },
            { width: 25 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=payment-report.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('❌ Error exporting report:', error);
        res.status(500).json({ error: error.message });
    }
};