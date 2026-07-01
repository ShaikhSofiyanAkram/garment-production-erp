const Finishing = require('../models/Finishing');
const Assignment = require('../models/Assignment');
const ProductionReturn = require('../models/ProductionReturn');
const Worker = require('../models/Worker');

exports.getFinishing = async (req, res) => {
    try {
        const finishingRecords = await Finishing.find()
            .populate('assignment', 'assignmentId productName')
            .populate('helper', 'name')
            .sort({ finishingDate: -1 });

        const helpers = await Worker.find({ workerType: 'helper', isActive: true });

        res.render('finishing/index', { 
            title: 'Finishing Management', 
            finishingRecords, 
            helpers,
            user: req.session.user,
            currentPage: 'finishing'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching finishing records');
        res.redirect('/dashboard');
    }
};

exports.createForm = async (req, res) => {
    try {
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        const helpers = await Worker.find({ workerType: 'helper', isActive: true });
        
        res.render('finishing/create', {
            title: 'Finishing Entry',
            karigars: karigars || [],
            helpers: helpers || [],
            user: req.session.user,
            currentPage: 'finishing'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/finishing');
    }
};

// ============ API: GET PENDING PRODUCTION RETURNS BY KARIGAR (FIXED - ALL KARIGARS) ============
// ============ API: GET PENDING PRODUCTION RETURNS BY KARIGAR (COMPLETE FIX) ============
exports.getPendingReturnsByKarigar = async (req, res) => {
    try {
        const { karigarId } = req.params;
        
        console.log('Fetching pending returns for karigar:', karigarId);
        
        // ✅ GET: All production returns for this karigar, grouped by assignment
        const returns = await ProductionReturn.find({ 
            karigar: karigarId
        }).populate('assignment', 'assignmentId productName');
        
        console.log('Found returns:', returns.length);
        
        // ✅ GROUP: By assignment ID to avoid duplicates
        const groupedByAssignment = {};
        
        for (const ret of returns) {
            const assignmentId = ret.assignment?._id?.toString() || ret.assignment?.toString();
            if (!assignmentId) continue;
            
            if (!groupedByAssignment[assignmentId]) {
                groupedByAssignment[assignmentId] = {
                    assignmentId: ret.assignment?.assignmentId || 'N/A',
                    productName: ret.productName || 'N/A',
                    returns: [],
                    totalReturned: 0,
                    totalDamage: 0,
                    totalMissing: 0,
                    alreadyFinished: 0
                };
            }
            
            // Calculate already finished for this specific return
            const finishedEntries = await Finishing.find({ productionReturn: ret._id });
            const alreadyFinished = finishedEntries.reduce((sum, f) => sum + (f.receivedPieces || 0), 0);
            
            groupedByAssignment[assignmentId].returns.push({
                _id: ret._id,
                returned: ret.totalReturned || 0,
                damage: ret.totalDamage || 0,
                missing: ret.totalMissing || 0,
                alreadyFinished: alreadyFinished,
                available: (ret.totalReturned || 0) - alreadyFinished
            });
            
            groupedByAssignment[assignmentId].totalReturned += ret.totalReturned || 0;
            groupedByAssignment[assignmentId].totalDamage += ret.totalDamage || 0;
            groupedByAssignment[assignmentId].totalMissing += ret.totalMissing || 0;
            groupedByAssignment[assignmentId].alreadyFinished += alreadyFinished;
        }
        
        // ✅ FORMAT: Final response
        const formattedReturns = [];
        
        for (const [assignmentId, group] of Object.entries(groupedByAssignment)) {
            const totalAvailable = group.totalReturned - group.alreadyFinished;
            
            // ✅ Only show if there is available work
            if (totalAvailable > 0) {
                // ✅ For display, use the first return's _id as primary
                const primaryReturn = group.returns[0];
                
                formattedReturns.push({
                    _id: primaryReturn._id, // Use first return's ID for selection
                    assignmentId: group.assignmentId,
                    productName: group.productName,
                    totalReturned: group.totalReturned,
                    totalDamage: group.totalDamage,
                    totalMissing: group.totalMissing,
                    alreadyFinished: group.alreadyFinished,
                    availablePieces: totalAvailable,
                    // ✅ Store all return IDs for detail fetch
                    returnIds: group.returns.map(r => r._id),
                    status: group.alreadyFinished > 0 ? 'partial' : 'pending'
                });
            }
        }
        
        console.log('Formatted returns:', formattedReturns.length);
        res.json({ success: true, returns: formattedReturns });
        
    } catch (error) {
        console.error('Error in getPendingReturnsByKarigar:', error);
        res.json({ success: false, error: error.message });
    }
};

// ============ API: GET PRODUCTION RETURN DETAILS (COMPLETE FIX) ============
exports.getProductionReturnDetails = async (req, res) => {
    try {
        const { returnId } = req.params;
        
        console.log('Fetching details for return ID:', returnId);
        
        // ✅ GET: Production return
        const productionReturn = await ProductionReturn.findById(returnId)
            .populate('assignment', 'assignmentId productName productCategory givenPieces')
            .populate('karigar', 'name');
        
        if (!productionReturn) {
            console.log('Production return not found:', returnId);
            return res.json({ success: false, error: 'Production return not found' });
        }
        
        console.log('Production return found, sizes:', productionReturn.sizes?.length);
        
        // ✅ GET: All finishing entries for this production return
        const finishingEntries = await Finishing.find({ productionReturn: returnId });
        
        // ✅ Calculate finished per size
        const finishedPerSize = {};
        let alreadyFinishedTotal = 0;
        
        for (const entry of finishingEntries) {
            alreadyFinishedTotal += entry.receivedPieces || 0;
            if (entry.sizeBreakdown && entry.sizeBreakdown.length) {
                for (const sizeItem of entry.sizeBreakdown) {
                    if (!finishedPerSize[sizeItem.size]) {
                        finishedPerSize[sizeItem.size] = 0;
                    }
                    finishedPerSize[sizeItem.size] += sizeItem.passed || 0;
                }
            }
        }
        
        // ✅ Format sizes with proper data
        const sizes = (productionReturn.sizes || []).map(size => {
            const returned = parseInt(size.returned) || 0;
            const alreadyFinished = parseInt(finishedPerSize[size.size]) || 0;
            const available = Math.max(0, returned - alreadyFinished);
            
            return {
                size: size.size || 'N/A',
                given: parseInt(size.given) || 0,
                returned: returned,
                damage: parseInt(size.damage) || 0,
                missing: parseInt(size.missing) || 0,
                alreadyFinished: alreadyFinished,
                available: available
            };
        });
        
        const availableTotal = sizes.reduce((sum, s) => sum + s.available, 0);
        
        const responseData = {
            success: true,
            data: {
                _id: productionReturn._id,
                assignmentId: productionReturn.assignment?.assignmentId || 'N/A',
                productName: productionReturn.productName || 'N/A',
                karigarName: productionReturn.karigar?.name || 'N/A',
                sizes: sizes,
                totalReturned: productionReturn.totalReturned || 0,
                alreadyFinishedTotal: alreadyFinishedTotal,
                availableTotal: availableTotal
            }
        };
        
        console.log('Response data prepared, sizes:', sizes.length);
        res.json(responseData);
        
    } catch (error) {
        console.error('Error in getProductionReturnDetails:', error);
        res.json({ success: false, error: error.message });
    }
};

// ============ API: GET PRODUCTION RETURN DETAILS ============
// ============ API: GET PRODUCTION RETURN DETAILS (FIXED) ============
// ============ API: GET PRODUCTION RETURN DETAILS (FIXED) ============
exports.getProductionReturnDetails = async (req, res) => {
    try {
        const { returnId } = req.params;
        
        console.log('Fetching return details for ID:', returnId);
        
        const productionReturn = await ProductionReturn.findById(returnId)
            .populate('assignment', 'assignmentId productName productCategory givenPieces')
            .populate('karigar', 'name');
        
        if (!productionReturn) {
            console.log('Production return not found:', returnId);
            return res.json({ success: false, error: 'Production return not found' });
        }
        
        console.log('Production Return found, sizes:', productionReturn.sizes);
        
        // ✅ Get finishing entries
        const finishingEntries = await Finishing.find({ productionReturn: returnId });
        
        // ✅ Calculate finished per size
        const finishedPerSize = {};
        let alreadyFinishedTotal = 0;
        
        for (const entry of finishingEntries) {
            alreadyFinishedTotal += entry.receivedPieces || 0;
            if (entry.sizeBreakdown && entry.sizeBreakdown.length) {
                for (const sizeItem of entry.sizeBreakdown) {
                    if (!finishedPerSize[sizeItem.size]) {
                        finishedPerSize[sizeItem.size] = 0;
                    }
                    finishedPerSize[sizeItem.size] += sizeItem.passed || 0;
                }
            }
        }
        
        // ✅ Format sizes
        const sizes = (productionReturn.sizes || []).map(size => {
            const returned = parseInt(size.returned) || 0;
            const alreadyFinished = parseInt(finishedPerSize[size.size]) || 0;
            
            return {
                size: size.size || 'N/A',
                given: parseInt(size.given) || 0,
                returned: returned,
                damage: parseInt(size.damage) || 0,
                missing: parseInt(size.missing) || 0,
                alreadyFinished: alreadyFinished,
                available: Math.max(0, returned - alreadyFinished)
            };
        });
        
        // ✅ Calculate total available
        const availableTotal = sizes.reduce((sum, s) => sum + s.available, 0);
        
        const responseData = {
            success: true,
            data: {
                _id: productionReturn._id,
                assignmentId: productionReturn.assignment?.assignmentId || 'N/A',
                productName: productionReturn.productName || 'N/A',
                karigarName: productionReturn.karigar?.name || 'N/A',
                sizes: sizes,
                totalReturned: productionReturn.totalReturned || 0,
                alreadyFinishedTotal: alreadyFinishedTotal,
                availableTotal: availableTotal
            }
        };
        
        console.log('Response data:', JSON.stringify(responseData, null, 2));
        res.json(responseData);
        
    } catch (error) {
        console.error('Error in getProductionReturnDetails:', error);
        res.json({ success: false, error: error.message });
    }
};

// ============ CREATE FINISHING ENTRY ============
exports.createFinishing = async (req, res) => {
    try {
        const { productionReturnId, helper, receivedPieces, rejectedPieces, finishingDate, remark } = req.body;
        
        const productionReturn = await ProductionReturn.findById(productionReturnId);
        if (!productionReturn) {
            req.flash('error_msg', 'Production return not found');
            return res.redirect('/finishing/create');
        }
        
        const existingFinished = await Finishing.find({ productionReturn: productionReturnId });
        const totalFinished = existingFinished.reduce((sum, f) => sum + (f.receivedPieces || 0), 0);
        const remaining = productionReturn.totalReturned - totalFinished;
        
        if (receivedPieces > remaining) {
            req.flash('error_msg', `Only ${remaining} pieces remaining for finishing`);
            return res.redirect('/finishing/create');
        }
        
        const passedPieces = receivedPieces - (rejectedPieces || 0);
        
        // ✅ Create finishing entry with completed status
        const finishing = await Finishing.create({
            productionReturn: productionReturnId,
            assignment: productionReturn.assignment,
            helper: helper,
            receivedPieces: receivedPieces,
            rejectedPieces: rejectedPieces || 0,
            passedPieces: passedPieces,
            finishingDate: finishingDate || new Date(),
            remark: remark || '',
            createdBy: req.session.user.id,
            status: 'completed'
        });
        
        // ✅ Update production return status
        const newTotalFinished = totalFinished + receivedPieces;
        const isFullyFinished = newTotalFinished >= productionReturn.totalReturned;
        
        await ProductionReturn.findByIdAndUpdate(productionReturnId, {
            status: isFullyFinished ? 'completed' : 'partial'
        });
        
        if (isFullyFinished) {
            await Assignment.findByIdAndUpdate(productionReturn.assignment, {
                status: 'completed',
                completedAt: new Date()
            });
        }
        
        req.flash('success_msg', `✅ Finishing entry created! Passed: ${passedPieces} pieces`);
        res.redirect('/finishing');
        
    } catch (error) {
        console.error('Error creating finishing entry:', error);
        req.flash('error_msg', 'Error creating finishing entry: ' + error.message);
        res.redirect('/finishing/create');
    }
};

exports.viewFinishing = async (req, res) => {
    try {
        const finishing = await Finishing.findById(req.params.id)
            .populate('assignment', 'assignmentId productName')
            .populate('helper', 'name');

        if (!finishing) {
            req.flash('error_msg', 'Record not found');
            return res.redirect('/finishing');
        }

        res.render('finishing/view', { title: 'Finishing Details', finishing });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching record');
        res.redirect('/finishing');
    }
};

exports.deleteFinishing = async (req, res) => {
    try {
        await Finishing.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Finishing entry deleted');
        res.redirect('/finishing');
    } catch (error) {
        req.flash('error_msg', 'Error deleting entry');
        res.redirect('/finishing');
    }
};

exports.getAssignmentDetails = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const assignment = await Assignment.findById(assignmentId)
            .select('assignmentId productName givenPieces sizes');
        res.json({ success: true, assignment });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};

exports.getExistingFinishing = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const existingFinishings = await Finishing.find({ assignment: assignmentId });
        const totalFinished = existingFinishings.reduce((sum, f) => sum + (f.receivedPieces || 0), 0);
        res.json({ success: true, totalFinished, count: existingFinishings.length });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
};