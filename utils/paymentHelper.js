const Worker = require('../models/Worker');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const Packing = require('../models/Packing');
const Finishing = require('../models/Finishing');
const Cutting = require('../models/Cutting');

class PaymentHelper {
    static async calculateKarigarPayment(karigarId, startDate, endDate) {
        try {
            const assignments = await Assignment.find({
                karigar: karigarId,
                assignedDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
            }).populate('product');
            
            let totalPieces = 0;
            let totalAmount = 0;
            
            for (const assignment of assignments) {
                const productionReturn = await ProductionReturn.findOne({ assignment: assignment._id });
                if (productionReturn && productionReturn.returned) {
                    const pieces = productionReturn.returned;
                    totalPieces += pieces;
                    totalAmount += pieces * (assignment.product?.rates?.karigar || 0);
                }
            }
            
            return { totalPieces, totalAmount, assignmentsCount: assignments.length };
        } catch (error) {
            console.error('Error in calculateKarigarPayment:', error);
            return { totalPieces: 0, totalAmount: 0, assignmentsCount: 0 };
        }
    }
    
    static async calculatePressmanPayment(pressmanId, startDate, endDate) {
        try {
            const packings = await Packing.find({
                packingDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
            }).populate({
                path: 'finishing',
                populate: {
                    path: 'productionReturn',
                    populate: { path: 'assignment', populate: { path: 'product' } }
                }
            });
            
            let totalPieces = 0;
            let totalAmount = 0;
            
            for (const packing of packings) {
                const product = packing.finishing?.productionReturn?.assignment?.product;
                if (product && product.rates?.pressman) {
                    totalPieces += packing.packedPieces;
                    totalAmount += packing.packedPieces * product.rates.pressman;
                }
            }
            
            return { totalPieces, totalAmount, packingsCount: packings.length };
        } catch (error) {
            console.error('Error in calculatePressmanPayment:', error);
            return { totalPieces: 0, totalAmount: 0, packingsCount: 0 };
        }
    }
    
    static async calculateHelperSalary(helperId, month, year) {
        try {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            const finishingEntries = await Finishing.find({
                helper: helperId,
                finishingDate: { $gte: startDate, $lte: endDate }
            });
            
            const worker = await Worker.findById(helperId);
            const monthlySalary = worker?.rate || 0;
            const daysWorked = [...new Set(finishingEntries.map(f => 
                new Date(f.finishingDate).toDateString()
            ))].length;
            
            return {
                monthlySalary,
                daysWorked,
                perDayRate: monthlySalary / 26,
                totalAmount: monthlySalary,
                entriesCount: finishingEntries.length
            };
        } catch (error) {
            console.error('Error in calculateHelperSalary:', error);
            return { monthlySalary: 0, daysWorked: 0, perDayRate: 0, totalAmount: 0, entriesCount: 0 };
        }
    }
    
    static async calculateCuttingSalary(cuttingWorkerId, month, year) {
        try {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            const cuttings = await Cutting.find({
                cuttingWorker: cuttingWorkerId,
                createdAt: { $gte: startDate, $lte: endDate }
            });
            
            const worker = await Worker.findById(cuttingWorkerId);
            
            return {
                monthlySalary: worker?.rate || 0,
                totalCuttings: cuttings.length,
                totalPieces: cuttings.reduce((sum, c) => sum + (c.totalPieces || 0), 0),
                totalAmount: worker?.rate || 0
            };
        } catch (error) {
            console.error('Error in calculateCuttingSalary:', error);
            return { monthlySalary: 0, totalCuttings: 0, totalPieces: 0, totalAmount: 0 };
        }
    }
}

module.exports = PaymentHelper;