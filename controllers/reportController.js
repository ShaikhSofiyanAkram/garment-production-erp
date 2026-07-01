const Cutting = require('../models/Cutting');
const ProductionReturn = require('../models/ProductionReturn');
const Finishing = require('../models/Finishing');
const Packing = require('../models/Packing');
const Worker = require('../models/Worker');
const PaymentHelper = require('../utils/paymentHelper');

// Get Loss Report - Fixed Layout
exports.getLossReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {};
        
        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        
        const cuttings = await Cutting.find(query);
        const totalCuttingPieces = cuttings.reduce((sum, c) => sum + (c.totalPieces || 0), 0);
        
        const productionReturns = await ProductionReturn.find(query);
        const totalDamaged = productionReturns.reduce((sum, pr) => sum + (pr.totalDamage || 0), 0);
        const totalMissing = productionReturns.reduce((sum, pr) => sum + (pr.totalMissing || 0), 0);
        
        const finishingEntries = await Finishing.find(query);
        const totalRejected = finishingEntries.reduce((sum, f) => sum + (f.rejectedPieces || 0), 0);
        
        const packings = await Packing.find(query);
        const totalPacked = packings.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        const totalLoss = totalDamaged + totalMissing + totalRejected;
        const lossPercentage = totalCuttingPieces > 0 ? (totalLoss / totalCuttingPieces) * 100 : 0;
        
        // Render without layout to avoid body error
        res.render('reports/loss', {
            title: 'Loss Report',
            layout: false,  // Important: No layout
            user: req.session.user,
            startDate,
            endDate,
            totalCuttingPieces,
            totalDamaged,
            totalMissing,
            totalRejected,
            totalPacked,
            totalLoss,
            lossPercentage: lossPercentage.toFixed(2)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating loss report: ' + error.message);
    }
};

exports.getWorkerPaymentReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();
        
        const workers = await Worker.find({ isActive: true });
        const reports = [];
        
        for (const worker of workers) {
            if (worker.workerType === 'karigar') {
                const payment = await PaymentHelper.calculateKarigarPayment(
                    worker._id,
                    `${currentYear}-${currentMonth}-01`,
                    `${currentYear}-${currentMonth}-${new Date(currentYear, currentMonth, 0).getDate()}`
                );
                reports.push({
                    worker,
                    ...payment,
                    paymentType: 'Piece-based',
                    amount: payment.totalAmount
                });
            } else if (worker.workerType === 'pressman') {
                const payment = await PaymentHelper.calculatePressmanPayment(
                    worker._id,
                    `${currentYear}-${currentMonth}-01`,
                    `${currentYear}-${currentMonth}-${new Date(currentYear, currentMonth, 0).getDate()}`
                );
                reports.push({
                    worker,
                    ...payment,
                    paymentType: 'Piece-based',
                    amount: payment.totalAmount
                });
            } else if (worker.workerType === 'helper') {
                const payment = await PaymentHelper.calculateHelperSalary(worker._id, currentMonth, currentYear);
                reports.push({
                    worker,
                    paymentType: 'Monthly Fixed',
                    amount: payment.totalAmount,
                    daysWorked: payment.daysWorked
                });
            } else {
                const payment = await PaymentHelper.calculateCuttingSalary(worker._id, currentMonth, currentYear);
                reports.push({
                    worker,
                    paymentType: 'Monthly Fixed',
                    amount: payment.totalAmount,
                    totalCuttings: payment.totalCuttings
                });
            }
        }
        
        // Render without layout to avoid body error
        res.render('reports/worker-payment', {
            title: 'Worker Payment Report',
            layout: false,  // Important: No layout
            user: req.session.user,
            reports,
            month: parseInt(currentMonth),
            year: parseInt(currentYear)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating payment report: ' + error.message);
    }
};

// Loss Chart Data API
exports.getLossChartData = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let startDate, endDate;
        const today = new Date();
        
        if (period === 'week') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            endDate = today;
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (period === 'year') {
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
        } else {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
            endDate = today;
        }
        
        const query = { createdAt: { $gte: startDate, $lte: endDate } };
        
        const cuttings = await Cutting.find(query);
        const returns = await ProductionReturn.find(query);
        const packings = await Packing.find(query);
        
        const totalCut = cuttings.reduce((sum, c) => sum + (c.totalPieces || 0), 0);
        const totalReturned = returns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
        const totalDamaged = returns.reduce((sum, r) => sum + (r.totalDamage || 0), 0);
        const totalMissing = returns.reduce((sum, r) => sum + (r.totalMissing || 0), 0);
        const totalPacked = packings.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        res.json({
            success: true,
            data: {
                totalCut,
                totalReturned,
                totalDamaged,
                totalMissing,
                totalPacked,
                lossPercentage: totalCut > 0 ? ((totalDamaged + totalMissing) / totalCut) * 100 : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Export Loss Report as PDF
exports.exportLossReportPDF = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {};
        
        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        
        const cuttings = await Cutting.find(query);
        const totalCuttingPieces = cuttings.reduce((sum, c) => sum + (c.totalPieces || 0), 0);
        
        const productionReturns = await ProductionReturn.find(query);
        const totalDamaged = productionReturns.reduce((sum, pr) => sum + (pr.totalDamage || 0), 0);
        const totalMissing = productionReturns.reduce((sum, pr) => sum + (pr.totalMissing || 0), 0);
        
        const finishingEntries = await Finishing.find(query);
        const totalRejected = finishingEntries.reduce((sum, f) => sum + (f.rejectedPieces || 0), 0);
        
        const packings = await Packing.find(query);
        const totalPacked = packings.reduce((sum, p) => sum + (p.totalPieces || 0), 0);
        
        const totalLoss = totalDamaged + totalMissing + totalRejected;
        const lossPercentage = totalCuttingPieces > 0 ? (totalLoss / totalCuttingPieces) * 100 : 0;
        
        // For PDF generation, render HTML
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Loss Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .company { font-size: 24px; font-weight: bold; color: #1a5f7a; }
                    .title { font-size: 18px; margin-top: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #1a5f7a; color: white; }
                    .total { font-weight: bold; background: #f5f5f5; }
                    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company">GARMENT FACTORY ERP</div>
                    <div class="title">Loss Report</div>
                    <div>Period: ${startDate || 'All'} to ${endDate || 'All'}</div>
                </div>
                <table>
                    <thead>
                        <tr><th>Parameter</th><th>Value</th><th>Percentage</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Total Cutting Pieces</td><td>${totalCuttingPieces}</td><td>100%</td></tr>
                        <tr><td>Damaged Pieces</td><td>${totalDamaged}</td><td>${totalCuttingPieces > 0 ? ((totalDamaged/totalCuttingPieces)*100).toFixed(2) : 0}%</td></tr>
                        <tr><td>Missing Pieces</td><td>${totalMissing}</td><td>${totalCuttingPieces > 0 ? ((totalMissing/totalCuttingPieces)*100).toFixed(2) : 0}%</td></tr>
                        <tr><td>Rejected in Finishing</td><td>${totalRejected}</td><td>${totalCuttingPieces > 0 ? ((totalRejected/totalCuttingPieces)*100).toFixed(2) : 0}%</td></tr>
                        <tr class="total"><td>Total Loss</td><td>${totalLoss}</td><td>${lossPercentage.toFixed(2)}%</td></tr>
                        <tr class="total"><td>Final Production (Packed)</td><td>${totalPacked}</td><td>${totalCuttingPieces > 0 ? ((totalPacked/totalCuttingPieces)*100).toFixed(2) : 0}%</td></tr>
                    </tbody>
                </table>
                <div class="footer">
                    Generated on: ${new Date().toLocaleString()}<br>
                    This is a computer generated report.
                </div>
            </body>
            </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        res.status(500).send('Error generating PDF: ' + error.message);
    }
};