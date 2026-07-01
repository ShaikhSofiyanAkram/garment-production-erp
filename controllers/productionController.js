// const ProductionReturn = require('../models/ProductionReturn');
// const Assignment = require('../models/Assignment');
// const Cutting = require('../models/Cutting');
// const Worker = require('../models/Worker');

// // Get all returns grouped by assignment
// exports.getReturns = async (req, res) => {
//     try {
//         const allReturns = await ProductionReturn.find()
//             .populate('assignment', 'assignmentId')
//             .populate('karigar', 'name')
//             .populate('cutting', 'cuttingNumber')
//             .sort({ returnDate: -1 });
        
//         // Group by assignment
//         const groupedReturns = {};
        
//         allReturns.forEach(returnItem => {
//             if (!returnItem.assignment) return;
//             const assignmentId = returnItem.assignment._id.toString();
            
//             if (!groupedReturns[assignmentId]) {
//                 groupedReturns[assignmentId] = {
//                     assignment: returnItem.assignment,
//                     karigar: returnItem.karigar,
//                     cutting: returnItem.cutting,
//                     productName: returnItem.productName,
//                     productCategory: returnItem.productCategory,
//                     totalGiven: returnItem.totalGiven,
//                     totalReturned: 0,
//                     totalDamage: 0,
//                     totalMissing: 0,
//                     returns: [],
//                     latestReturn: null
//                 };
//             }
            
//             groupedReturns[assignmentId].returns.push(returnItem);
//             groupedReturns[assignmentId].totalReturned += returnItem.totalReturned || 0;
//             groupedReturns[assignmentId].totalDamage += returnItem.totalDamage || 0;
//             groupedReturns[assignmentId].totalMissing += returnItem.totalMissing || 0;
            
//             if (!groupedReturns[assignmentId].latestReturn ||
//                 returnItem.returnDate > groupedReturns[assignmentId].latestReturn.returnDate) {
//                 groupedReturns[assignmentId].latestReturn = returnItem;
//             }
//         });
        
//         res.render('production/index', {
//             title: 'Production Returns',
//             returns: Object.values(groupedReturns)
//         });
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error fetching returns');
//         res.redirect('/dashboard');
//     }
// };

// // Return form - Load assignment with existing returns
// // Return form - Load assignment with existing returns
// exports.returnForm = async (req, res) => {
//     try {
//         // Get all assignments that are not fully completed
//         const assignments = await Assignment.find({
//             status: { $ne: 'completed' }
//         }).populate('karigar', 'name');
        
//         // Process each assignment to calculate remaining pieces
//         const processedAssignments = [];
        
//         for (let assignment of assignments) {
//             // Get all existing returns for this assignment
//             const existingReturns = await ProductionReturn.find({ 
//                 assignment: assignment._id 
//             });
            
//             // Calculate already returned per size
//             const alreadyReturnedPerSize = {};
//             const alreadyDamagedPerSize = {};
//             const alreadyMissingPerSize = {};
            
//             existingReturns.forEach(ret => {
//                 if (ret.sizes && ret.sizes.length) {
//                     ret.sizes.forEach(s => {
//                         alreadyReturnedPerSize[s.size] = (alreadyReturnedPerSize[s.size] || 0) + (s.returned || 0);
//                         alreadyDamagedPerSize[s.size] = (alreadyDamagedPerSize[s.size] || 0) + (s.damage || 0);
//                         alreadyMissingPerSize[s.size] = (alreadyMissingPerSize[s.size] || 0) + (s.missing || 0);
//                     });
//                 }
//             });
            
//             // Build size-wise data with remaining calculation
//             const sizesWithRemaining = [];
//             let totalAlreadyReturned = 0;
//             let totalAlreadyDamaged = 0;
//             let totalAlreadyMissing = 0;
            
//             if (assignment.sizes && assignment.sizes.length) {
//                 for (const sizeItem of assignment.sizes) {
//                     const size = sizeItem.size;
//                     const given = sizeItem.pieces || 0;
//                     const alreadyReturned = alreadyReturnedPerSize[size] || 0;
//                     const alreadyDamaged = alreadyDamagedPerSize[size] || 0;
//                     const alreadyMissing = alreadyMissingPerSize[size] || 0;
//                     const totalAlreadyForSize = alreadyReturned + alreadyDamaged + alreadyMissing;
//                     const remaining = given - totalAlreadyForSize;
                    
//                     sizesWithRemaining.push({
//                         size: size,
//                         given: given,
//                         alreadyReturned: alreadyReturned,
//                         alreadyDamaged: alreadyDamaged,
//                         alreadyMissing: alreadyMissing,
//                         remaining: remaining,
//                         isComplete: remaining === 0,
//                         isPartial: alreadyReturned > 0 && remaining > 0
//                     });
                    
//                     totalAlreadyReturned += alreadyReturned;
//                     totalAlreadyDamaged += alreadyDamaged;
//                     totalAlreadyMissing += alreadyMissing;
//                 }
//             }
            
//             const totalReturnedSoFar = totalAlreadyReturned + totalAlreadyDamaged + totalAlreadyMissing;
//             const remainingTotal = assignment.givenPieces - totalReturnedSoFar;
            
//             // Create processed assignment object
//             processedAssignments.push({
//                 _id: assignment._id,
//                 assignmentId: assignment.assignmentId,
//                 karigar: assignment.karigar,
//                 productName: assignment.productName,
//                 productCategory: assignment.productCategory,
//                 givenPieces: assignment.givenPieces,
//                 status: assignment.status,
//                 sizes: assignment.sizes,
//                 sizesWithRemaining: sizesWithRemaining,
//                 alreadyReturnedTotal: totalAlreadyReturned,
//                 alreadyDamagedTotal: totalAlreadyDamaged,
//                 alreadyMissingTotal: totalAlreadyMissing,
//                 totalReturnedSoFar: totalReturnedSoFar,
//                 remainingTotal: remainingTotal
//             });
//         }
        
//         console.log('Processed assignments:', processedAssignments.length);
//         if (processedAssignments.length > 0) {
//             console.log('First assignment sizes:', processedAssignments[0].sizesWithRemaining);
//         }
        
//         res.render('production/return', { 
//             title: 'Production Return', 
//             assignments: processedAssignments 
//         });
        
//     } catch (error) {
//         console.error('Error in returnForm:', error);
//         req.flash('error_msg', 'Error loading return form: ' + error.message);
//         res.redirect('/production');
//     }
// };

// // Create return with proper validation
// // Create return with proper validation and status update
// exports.createReturn = async (req, res) => {
//     try {
//         const { assignment, returnData, remark, damageReason, missingReason } = req.body;
        
//         // Parse return data
//         let sizesData = {};
//         if (typeof returnData === 'string') {
//             sizesData = JSON.parse(returnData);
//         } else {
//             sizesData = returnData;
//         }
        
//         // Get assignment details
//         const assignmentData = await Assignment.findById(assignment);
//         if (!assignmentData) {
//             req.flash('error_msg', 'Assignment not found');
//             return res.redirect('/production/return');
//         }
        
//         // Get all existing returns for this assignment
//         const existingReturns = await ProductionReturn.find({ assignment });
        
//         // Calculate already returned per size
//         const alreadyReturnedPerSize = {};
//         const alreadyDamagedPerSize = {};
//         const alreadyMissingPerSize = {};
        
//         existingReturns.forEach(ret => {
//             if (ret.sizes && ret.sizes.length) {
//                 ret.sizes.forEach(s => {
//                     alreadyReturnedPerSize[s.size] = (alreadyReturnedPerSize[s.size] || 0) + (s.returned || 0);
//                     alreadyDamagedPerSize[s.size] = (alreadyDamagedPerSize[s.size] || 0) + (s.damage || 0);
//                     alreadyMissingPerSize[s.size] = (alreadyMissingPerSize[s.size] || 0) + (s.missing || 0);
//                 });
//             }
//         });
        
//         // Process each size and validate
//         let totalReturned = 0;
//         let totalDamage = 0;
//         let totalMissing = 0;
//         const sizesArray = [];
//         let hasError = false;
//         let errorMessage = '';
        
//         // Get original sizes from assignment
//         const originalSizes = {};
//         if (assignmentData.sizes && assignmentData.sizes.length) {
//             assignmentData.sizes.forEach(s => {
//                 originalSizes[s.size] = s.pieces || 0;
//             });
//         }
        
//         for (const [size, data] of Object.entries(sizesData.sizes || {})) {
//             const given = originalSizes[size] || 0;
//             const alreadyReturned = alreadyReturnedPerSize[size] || 0;
//             const alreadyDamaged = alreadyDamagedPerSize[size] || 0;
//             const alreadyMissing = alreadyMissingPerSize[size] || 0;
//             const totalAlready = alreadyReturned + alreadyDamaged + alreadyMissing;
//             const maxAllowed = given - totalAlready;
            
//             const returnedNow = parseInt(data.returned) || 0;
//             const damageNow = parseInt(data.damage) || 0;
//             const missingNow = parseInt(data.missing) || 0;
//             const totalNow = returnedNow + damageNow + missingNow;
            
//             // Validation
//             if (totalNow > maxAllowed) {
//                 hasError = true;
//                 errorMessage = `Size ${size}: Cannot return more than ${maxAllowed} pieces. Already returned: ${totalAlready} out of ${given}. You entered ${totalNow}.`;
//                 break;
//             }
            
//             if (returnedNow < 0 || damageNow < 0 || missingNow < 0) {
//                 hasError = true;
//                 errorMessage = `Invalid values for size ${size}. Values cannot be negative.`;
//                 break;
//             }
            
//             if (totalNow > 0) {
//                 sizesArray.push({
//                     size: size,
//                     given: given,
//                     returned: returnedNow,
//                     damage: damageNow,
//                     missing: missingNow,
//                     alreadyReturned: alreadyReturned,
//                     remaining: maxAllowed - totalNow
//                 });
//             }
            
//             totalReturned += returnedNow;
//             totalDamage += damageNow;
//             totalMissing += missingNow;
//         }
        
//         if (hasError) {
//             req.flash('error_msg', errorMessage);
//             return res.redirect('/production/return');
//         }
        
//         if (totalReturned === 0 && totalDamage === 0 && totalMissing === 0) {
//             req.flash('error_msg', 'Please enter at least one piece to return');
//             return res.redirect('/production/return');
//         }
        
//         // Calculate previous totals
//         const previousTotalReturned = existingReturns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
//         const previousTotalDamage = existingReturns.reduce((sum, r) => sum + (r.totalDamage || 0), 0);
//         const previousTotalMissing = existingReturns.reduce((sum, r) => sum + (r.totalMissing || 0), 0);
        
//         const newTotalReturned = previousTotalReturned + totalReturned;
//         const newTotalDamage = previousTotalDamage + totalDamage;
//         const newTotalMissing = previousTotalMissing + totalMissing;
//         const grandTotal = newTotalReturned + newTotalDamage + newTotalMissing;
//         const totalGiven = assignmentData.givenPieces;
        
//         // Determine if partial and status
//         const isPartial = grandTotal < totalGiven;
//         const isCompleted = grandTotal >= totalGiven;
        
//         // Create production return record
//         const productionReturn = new ProductionReturn({
//             assignment: assignment,
//             karigar: assignmentData.karigar,
//             cutting: assignmentData.cutting,
//             productName: assignmentData.productName,
//             productCategory: assignmentData.productCategory,
//             sizes: sizesArray,
//             totalGiven: totalGiven,
//             totalReturned: totalReturned,
//             totalDamage: totalDamage,
//             totalMissing: totalMissing,
//             isPartial: isPartial,
//             previousTotalReturned: previousTotalReturned,
//             damageReason: damageReason || '',
//             missingReason: missingReason || '',
//             remark: remark || '',
//             createdBy: req.session.user.id
//         });
        
//         await productionReturn.save();
        
//         // ============ CRITICAL: UPDATE ASSIGNMENT STATUS ============
//         let assignmentStatus = 'pending';
//         if (isCompleted) {
//             assignmentStatus = 'completed';
//         } else if (grandTotal > 0) {
//             assignmentStatus = 'partial';
//         }
        
//         console.log(`Updating assignment ${assignmentData.assignmentId}:`);
//         console.log(`  Given: ${totalGiven}`);
//         console.log(`  Total Returned (including damage/missing): ${grandTotal}`);
//         console.log(`  New Status: ${assignmentStatus}`);
        
//         await Assignment.findByIdAndUpdate(assignment, {
//             returnedPieces: newTotalReturned,
//             damagedPieces: newTotalDamage,
//             missingPieces: newTotalMissing,
//             status: assignmentStatus,
//             completedAt: isCompleted ? new Date() : null
//         });
        
//         // Verify update was successful
//         const updatedAssignment = await Assignment.findById(assignment);
//         console.log(`  Updated Assignment Status: ${updatedAssignment.status}`);
        
//         const message = isCompleted ? 
//             `✅ Production return completed! All ${totalGiven} pieces returned. Assignment marked as COMPLETED.` : 
//             `✅ Partial return recorded (${grandTotal}/${totalGiven} pieces). Assignment status: ${assignmentStatus}.`;
        
//         req.flash('success_msg', message);
//         res.redirect('/production');
        
//     } catch (error) {
//         console.error('Production return error:', error);
//         req.flash('error_msg', 'Error recording production return: ' + error.message);
//         res.redirect('/production/return');
//     }
// };

// // Delete return record
// exports.deleteReturn = async (req, res) => {
//     try {
//         const returnRecord = await ProductionReturn.findById(req.params.id);
//         if (!returnRecord) {
//             req.flash('error_msg', 'Return record not found');
//             return res.redirect('/production');
//         }
        
//         // Get all returns for this assignment (including this one)
//         const allReturns = await ProductionReturn.find({ 
//             assignment: returnRecord.assignment 
//         });
        
//         // Recalculate totals excluding this record
//         let newTotalReturned = 0;
//         let newTotalDamage = 0;
//         let newTotalMissing = 0;
        
//         allReturns.forEach(ret => {
//             if (ret._id.toString() !== req.params.id) {
//                 newTotalReturned += ret.totalReturned || 0;
//                 newTotalDamage += ret.totalDamage || 0;
//                 newTotalMissing += ret.totalMissing || 0;
//             }
//         });
        
//         const grandTotal = newTotalReturned + newTotalDamage + newTotalMissing;
//         const assignment = await Assignment.findById(returnRecord.assignment);
        
//         let newStatus = 'pending';
//         if (assignment && grandTotal >= assignment.givenPieces) {
//             newStatus = 'completed';
//         } else if (grandTotal > 0) {
//             newStatus = 'partial';
//         }
        
//         if (assignment) {
//             await Assignment.findByIdAndUpdate(returnRecord.assignment, {
//                 returnedPieces: newTotalReturned,
//                 damagedPieces: newTotalDamage,
//                 missingPieces: newTotalMissing,
//                 status: newStatus
//             });
//         }
        
//         await ProductionReturn.findByIdAndDelete(req.params.id);
        
//         req.flash('success_msg', 'Return record deleted successfully');
//         res.redirect('/production');
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error deleting return record');
//         res.redirect('/production');
//     }
// };

// // Get single return (API)
// // Get all returns grouped by assignment
// exports.getReturns = async (req, res) => {
//     try {
//         const allReturns = await ProductionReturn.find()
//             .populate('assignment', 'assignmentId status givenPieces')
//             .populate('karigar', 'name')
//             .populate('cutting', 'cuttingNumber')
//             .sort({ returnDate: -1 });
        
//         // Group by assignment
//         const groupedReturns = {};
        
//         for (let returnItem of allReturns) {
//             if (!returnItem.assignment) continue;
//             const assignmentId = returnItem.assignment._id.toString();
            
//             if (!groupedReturns[assignmentId]) {
//                 // Get fresh assignment data to ensure correct status
//                 const freshAssignment = await Assignment.findById(assignmentId);
                
//                 groupedReturns[assignmentId] = {
//                     assignment: {
//                         _id: freshAssignment._id,
//                         assignmentId: freshAssignment.assignmentId,
//                         status: freshAssignment.status  // Use fresh status
//                     },
//                     karigar: returnItem.karigar,
//                     cutting: returnItem.cutting,
//                     productName: returnItem.productName,
//                     productCategory: returnItem.productCategory,
//                     totalGiven: returnItem.totalGiven,
//                     totalReturned: 0,
//                     totalDamage: 0,
//                     totalMissing: 0,
//                     returns: [],
//                     latestReturn: null
//                 };
//             }
            
//             groupedReturns[assignmentId].returns.push(returnItem);
//             groupedReturns[assignmentId].totalReturned += returnItem.totalReturned || 0;
//             groupedReturns[assignmentId].totalDamage += returnItem.totalDamage || 0;
//             groupedReturns[assignmentId].totalMissing += returnItem.totalMissing || 0;
            
//             if (!groupedReturns[assignmentId].latestReturn ||
//                 returnItem.returnDate > groupedReturns[assignmentId].latestReturn.returnDate) {
//                 groupedReturns[assignmentId].latestReturn = returnItem;
//             }
//         }
        
//         // Calculate final status for each group based on actual totals
//         for (const [id, group] of Object.entries(groupedReturns)) {
//             const totalReturnedSum = group.totalReturned + group.totalDamage + group.totalMissing;
//             if (totalReturnedSum >= group.totalGiven && group.totalGiven > 0) {
//                 group.status = 'completed';
//             } else if (totalReturnedSum > 0) {
//                 group.status = 'partial';
//             } else {
//                 group.status = 'pending';
//             }
//             group.totalReturnedSum = totalReturnedSum;
//         }
        
//         res.render('production/index', {
//             title: 'Production Returns',
//             returns: Object.values(groupedReturns)
//         });
//     } catch (error) {
//         console.error('Error fetching returns:', error);
//         req.flash('error_msg', 'Error fetching returns: ' + error.message);
//         res.redirect('/dashboard');
//     }
// };

// // Get returns by assignment (API)
// exports.getReturnsByAssignment = async (req, res) => {
//     try {
//         const returns = await ProductionReturn.find({ 
//             assignment: req.params.assignmentId 
//         }).sort({ returnDate: -1 });
        
//         res.json({ returns });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // Get remaining pieces for assignment (API)
// exports.getRemainingPieces = async (req, res) => {
//     try {
//         const assignment = await Assignment.findById(req.params.assignmentId);
//         if (!assignment) {
//             return res.status(404).json({ error: 'Assignment not found' });
//         }
        
//         const existingReturns = await ProductionReturn.find({ 
//             assignment: req.params.assignmentId 
//         });
        
//         const alreadyReturned = existingReturns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
//         const alreadyDamaged = existingReturns.reduce((sum, r) => sum + (r.totalDamage || 0), 0);
//         const alreadyMissing = existingReturns.reduce((sum, r) => sum + (r.totalMissing || 0), 0);
//         const totalSoFar = alreadyReturned + alreadyDamaged + alreadyMissing;
//         const remaining = assignment.givenPieces - totalSoFar;
        
//         res.json({
//             success: true,
//             given: assignment.givenPieces,
//             alreadyReturned,
//             alreadyDamaged,
//             alreadyMissing,
//             totalSoFar,
//             remaining
//         });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

const ProductionReturn = require('../models/ProductionReturn');
const Assignment = require('../models/Assignment');
const Cutting = require('../models/Cutting');
const Worker = require('../models/Worker');

// ============ GET ALL RETURNS GROUPED ============
exports.getReturns = async (req, res) => {
    try {
        const allReturns = await ProductionReturn.find()
            .populate('assignment', 'assignmentId status givenPieces')
            .populate('karigar', 'name')
            .populate('cutting', 'cuttingNumber')
            .sort({ returnDate: -1 });
        
        const groupedReturns = {};
        
        for (let returnItem of allReturns) {
            if (!returnItem.assignment) continue;
            const assignmentId = returnItem.assignment._id.toString();
            
            if (!groupedReturns[assignmentId]) {
                const freshAssignment = await Assignment.findById(assignmentId);
                
                groupedReturns[assignmentId] = {
                    assignment: {
                        _id: freshAssignment?._id,
                        assignmentId: freshAssignment?.assignmentId,
                        status: freshAssignment?.status || 'pending'
                    },
                    karigar: returnItem.karigar,
                    cutting: returnItem.cutting,
                    productName: returnItem.productName,
                    productCategory: returnItem.productCategory,
                    totalGiven: returnItem.totalGiven,
                    totalReturned: 0,
                    totalDamage: 0,
                    totalMissing: 0,
                    returns: [],
                    latestReturn: null
                };
            }
            
            groupedReturns[assignmentId].returns.push(returnItem);
            groupedReturns[assignmentId].totalReturned += returnItem.totalReturned || 0;
            groupedReturns[assignmentId].totalDamage += returnItem.totalDamage || 0;
            groupedReturns[assignmentId].totalMissing += returnItem.totalMissing || 0;
            
            if (!groupedReturns[assignmentId].latestReturn ||
                returnItem.returnDate > groupedReturns[assignmentId].latestReturn.returnDate) {
                groupedReturns[assignmentId].latestReturn = returnItem;
            }
        }
        
        res.render('production/index', {
            title: 'Production Returns',
            returns: Object.values(groupedReturns)
        });
    } catch (error) {
        console.error('Error fetching returns:', error);
        req.flash('error_msg', 'Error fetching returns: ' + error.message);
        res.redirect('/dashboard');
    }
};

// ============ RETURN FORM ============
exports.returnForm = async (req, res) => {
    try {
        const assignments = await Assignment.find({
            status: { $ne: 'completed' }
        }).populate('karigar', 'name');
        
        const processedAssignments = [];
        
        for (let assignment of assignments) {
            const existingReturns = await ProductionReturn.find({ 
                assignment: assignment._id 
            });
            
            const alreadyReturnedPerSize = {};
            const alreadyDamagedPerSize = {};
            const alreadyMissingPerSize = {};
            
            existingReturns.forEach(ret => {
                if (ret.sizes && ret.sizes.length) {
                    ret.sizes.forEach(s => {
                        alreadyReturnedPerSize[s.size] = (alreadyReturnedPerSize[s.size] || 0) + (s.returned || 0);
                        alreadyDamagedPerSize[s.size] = (alreadyDamagedPerSize[s.size] || 0) + (s.damage || 0);
                        alreadyMissingPerSize[s.size] = (alreadyMissingPerSize[s.size] || 0) + (s.missing || 0);
                    });
                }
            });
            
            const sizesWithRemaining = [];
            let totalAlreadyReturned = 0;
            let totalAlreadyDamaged = 0;
            let totalAlreadyMissing = 0;
            
            if (assignment.sizes && assignment.sizes.length) {
                for (const sizeItem of assignment.sizes) {
                    const size = sizeItem.size;
                    const given = sizeItem.pieces || 0;
                    const alreadyReturned = alreadyReturnedPerSize[size] || 0;
                    const alreadyDamaged = alreadyDamagedPerSize[size] || 0;
                    const alreadyMissing = alreadyMissingPerSize[size] || 0;
                    const remaining = given - (alreadyReturned + alreadyDamaged + alreadyMissing);
                    
                    sizesWithRemaining.push({
                        size: size,
                        given: given,
                        alreadyReturned: alreadyReturned,
                        alreadyDamaged: alreadyDamaged,
                        alreadyMissing: alreadyMissing,
                        remaining: remaining,
                        isComplete: remaining === 0,
                        isPartial: alreadyReturned > 0 && remaining > 0
                    });
                    
                    totalAlreadyReturned += alreadyReturned;
                    totalAlreadyDamaged += alreadyDamaged;
                    totalAlreadyMissing += alreadyMissing;
                }
            }
            
            const totalReturnedSoFar = totalAlreadyReturned + totalAlreadyDamaged + totalAlreadyMissing;
            const remainingTotal = assignment.givenPieces - totalReturnedSoFar;
            
            processedAssignments.push({
                _id: assignment._id,
                assignmentId: assignment.assignmentId,
                karigar: assignment.karigar,
                productName: assignment.productName,
                productCategory: assignment.productCategory,
                givenPieces: assignment.givenPieces,
                status: assignment.status,
                sizes: assignment.sizes,
                sizesWithRemaining: sizesWithRemaining,
                alreadyReturnedTotal: totalAlreadyReturned,
                alreadyDamagedTotal: totalAlreadyDamaged,
                alreadyMissingTotal: totalAlreadyMissing,
                totalReturnedSoFar: totalReturnedSoFar,
                remainingTotal: remainingTotal
            });
        }
        
        res.render('production/return', { 
            title: 'Production Return', 
            assignments: processedAssignments 
        });
    } catch (error) {
        console.error('Error in returnForm:', error);
        req.flash('error_msg', 'Error loading return form: ' + error.message);
        res.redirect('/production');
    }
};

// ============ CREATE RETURN ============
exports.createReturn = async (req, res) => {
    try {
        const { assignment, returnData, remark, damageReason, missingReason } = req.body;
        
        let sizesData = {};
        if (typeof returnData === 'string') {
            sizesData = JSON.parse(returnData);
        } else {
            sizesData = returnData;
        }
        
        const assignmentData = await Assignment.findById(assignment);
        if (!assignmentData) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect('/production/return');
        }
        
        const existingReturns = await ProductionReturn.find({ assignment });
        
        const alreadyReturnedPerSize = {};
        const alreadyDamagedPerSize = {};
        const alreadyMissingPerSize = {};
        
        existingReturns.forEach(ret => {
            if (ret.sizes && ret.sizes.length) {
                ret.sizes.forEach(s => {
                    alreadyReturnedPerSize[s.size] = (alreadyReturnedPerSize[s.size] || 0) + (s.returned || 0);
                    alreadyDamagedPerSize[s.size] = (alreadyDamagedPerSize[s.size] || 0) + (s.damage || 0);
                    alreadyMissingPerSize[s.size] = (alreadyMissingPerSize[s.size] || 0) + (s.missing || 0);
                });
            }
        });
        
        let totalReturned = 0;
        let totalDamage = 0;
        let totalMissing = 0;
        const sizesArray = [];
        let hasError = false;
        let errorMessage = '';
        
        const originalSizes = {};
        if (assignmentData.sizes && assignmentData.sizes.length) {
            assignmentData.sizes.forEach(s => {
                originalSizes[s.size] = s.pieces || 0;
            });
        }
        
        for (const [size, data] of Object.entries(sizesData.sizes || {})) {
            const given = originalSizes[size] || 0;
            const alreadyReturned = alreadyReturnedPerSize[size] || 0;
            const alreadyDamaged = alreadyDamagedPerSize[size] || 0;
            const alreadyMissing = alreadyMissingPerSize[size] || 0;
            const totalAlready = alreadyReturned + alreadyDamaged + alreadyMissing;
            const maxAllowed = given - totalAlready;
            
            const returnedNow = parseInt(data.returned) || 0;
            const damageNow = parseInt(data.damage) || 0;
            const missingNow = parseInt(data.missing) || 0;
            const totalNow = returnedNow + damageNow + missingNow;
            
            if (totalNow > maxAllowed) {
                hasError = true;
                errorMessage = `Size ${size}: Cannot return more than ${maxAllowed} pieces.`;
                break;
            }
            
            if (totalNow > 0) {
                sizesArray.push({
                    size: size,
                    given: given,
                    returned: returnedNow,
                    damage: damageNow,
                    missing: missingNow,
                    alreadyReturned: alreadyReturned,
                    remaining: maxAllowed - totalNow
                });
            }
            
            totalReturned += returnedNow;
            totalDamage += damageNow;
            totalMissing += missingNow;
        }
        
        if (hasError) {
            req.flash('error_msg', errorMessage);
            return res.redirect('/production/return');
        }
        
        if (totalReturned === 0 && totalDamage === 0 && totalMissing === 0) {
            req.flash('error_msg', 'Please enter at least one piece to return');
            return res.redirect('/production/return');
        }
        
        const previousTotalReturned = existingReturns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
        const previousTotalDamage = existingReturns.reduce((sum, r) => sum + (r.totalDamage || 0), 0);
        const previousTotalMissing = existingReturns.reduce((sum, r) => sum + (r.totalMissing || 0), 0);
        
        const newTotalReturned = previousTotalReturned + totalReturned;
        const newTotalDamage = previousTotalDamage + totalDamage;
        const newTotalMissing = previousTotalMissing + totalMissing;
        const grandTotal = newTotalReturned + newTotalDamage + newTotalMissing;
        const totalGiven = assignmentData.givenPieces;
        
        const isPartial = grandTotal < totalGiven;
        const isCompleted = grandTotal >= totalGiven;
        
        const productionReturn = new ProductionReturn({
            assignment: assignment,
            karigar: assignmentData.karigar,
            cutting: assignmentData.cutting,
            productName: assignmentData.productName,
            productCategory: assignmentData.productCategory,
            sizes: sizesArray,
            totalGiven: totalGiven,
            totalReturned: totalReturned,
            totalDamage: totalDamage,
            totalMissing: totalMissing,
            isPartial: isPartial,
            previousTotalReturned: previousTotalReturned,
            damageReason: damageReason || '',
            missingReason: missingReason || '',
            remark: remark || '',
            createdBy: req.session.user.id
        });
        
        await productionReturn.save();
        
        let assignmentStatus = 'pending';
        if (isCompleted) {
            assignmentStatus = 'completed';
        } else if (grandTotal > 0) {
            assignmentStatus = 'partial';
        }
        
        await Assignment.findByIdAndUpdate(assignment, {
            returnedPieces: newTotalReturned,
            damagedPieces: newTotalDamage,
            missingPieces: newTotalMissing,
            status: assignmentStatus,
            completedAt: isCompleted ? new Date() : null
        });
        
        const message = isCompleted ? 
            `✅ Production return completed! Assignment marked as COMPLETED.` : 
            `✅ Partial return recorded (${grandTotal}/${totalGiven} pieces).`;
        
        req.flash('success_msg', message);
        res.redirect('/production');
        
    } catch (error) {
        console.error('Production return error:', error);
        req.flash('error_msg', 'Error recording production return: ' + error.message);
        res.redirect('/production/return');
    }
};

// ============ DELETE RETURN ============
exports.deleteReturn = async (req, res) => {
    try {
        const returnRecord = await ProductionReturn.findById(req.params.id);
        if (!returnRecord) {
            req.flash('error_msg', 'Return record not found');
            return res.redirect('/production');
        }
        
        const allReturns = await ProductionReturn.find({ 
            assignment: returnRecord.assignment 
        });
        
        let newTotalReturned = 0;
        let newTotalDamage = 0;
        let newTotalMissing = 0;
        
        allReturns.forEach(ret => {
            if (ret._id.toString() !== req.params.id) {
                newTotalReturned += ret.totalReturned || 0;
                newTotalDamage += ret.totalDamage || 0;
                newTotalMissing += ret.totalMissing || 0;
            }
        });
        
        const grandTotal = newTotalReturned + newTotalDamage + newTotalMissing;
        const assignment = await Assignment.findById(returnRecord.assignment);
        
        let newStatus = 'pending';
        if (assignment && grandTotal >= assignment.givenPieces) {
            newStatus = 'completed';
        } else if (grandTotal > 0) {
            newStatus = 'partial';
        }
        
        if (assignment) {
            await Assignment.findByIdAndUpdate(returnRecord.assignment, {
                returnedPieces: newTotalReturned,
                damagedPieces: newTotalDamage,
                missingPieces: newTotalMissing,
                status: newStatus
            });
        }
        
        await ProductionReturn.findByIdAndDelete(req.params.id);
        
        req.flash('success_msg', 'Return record deleted successfully');
        res.redirect('/production');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting return record');
        res.redirect('/production');
    }
};

// ============ GET SINGLE RETURN (API) ============
exports.getReturn = async (req, res) => {
    try {
        const returnRecord = await ProductionReturn.findById(req.params.id)
            .populate('assignment', 'assignmentId')
            .populate('karigar', 'name');
        
        if (!returnRecord) {
            return res.status(404).json({ error: 'Return not found' });
        }
        
        res.json(returnRecord);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============ GET RETURNS BY ASSIGNMENT (API) ============
exports.getReturnsByAssignment = async (req, res) => {
    try {
        const returns = await ProductionReturn.find({ 
            assignment: req.params.assignmentId 
        }).sort({ returnDate: -1 });
        
        res.json({ returns });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============ GET REMAINING PIECES (API) ============
exports.getRemainingPieces = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.assignmentId);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        const existingReturns = await ProductionReturn.find({ 
            assignment: req.params.assignmentId 
        });
        
        const alreadyReturned = existingReturns.reduce((sum, r) => sum + (r.totalReturned || 0), 0);
        const alreadyDamaged = existingReturns.reduce((sum, r) => sum + (r.totalDamage || 0), 0);
        const alreadyMissing = existingReturns.reduce((sum, r) => sum + (r.totalMissing || 0), 0);
        const totalSoFar = alreadyReturned + alreadyDamaged + alreadyMissing;
        const remaining = assignment.givenPieces - totalSoFar;
        
        res.json({
            success: true,
            given: assignment.givenPieces,
            alreadyReturned,
            alreadyDamaged,
            alreadyMissing,
            totalSoFar,
            remaining
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};