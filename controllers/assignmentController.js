const Assignment = require('../models/Assignment');
const Cutting = require('../models/Cutting');
const Worker = require('../models/Worker');
const ProductionReturn = require('../models/ProductionReturn');

// ============ GET ALL ASSIGNMENTS WITH FILTERS ============
exports.getAssignments = async (req, res) => {
    try {
        const { filter } = req.query;
        let query = { isArchived: false };
        
        if (filter === 'completed') query.status = 'completed';
        else if (filter === 'pending') query.status = 'pending';
        else if (filter === 'partial') query.status = 'partial';
        else if (filter === 'old') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query.completedAt = { $lt: thirtyDaysAgo };
            query.status = 'completed';
        }
        
        const assignments = await Assignment.find(query)
            .populate('cutting', 'cuttingNumber')
            .populate('karigar', 'name')
            .sort({ assignedDate: -1 });
        
        const totalAssignments = await Assignment.countDocuments({ isArchived: false });
        const completedCount = await Assignment.countDocuments({ status: 'completed', isArchived: false });
        const pendingCount = await Assignment.countDocuments({ status: 'pending', isArchived: false });
        const partialCount = await Assignment.countDocuments({ status: 'partial', isArchived: false });
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const oldCompletedCount = await Assignment.countDocuments({ 
            status: 'completed', completedAt: { $lt: thirtyDaysAgo }, isArchived: false 
        });
        
        res.render('assignment/index', { 
            title: 'Assignments', assignments, totalAssignments, completedCount,
            pendingCount, partialCount, oldCompletedCount, currentFilter: filter || 'all'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching assignments');
        res.redirect('/dashboard');
    }
};

// ============ CREATE ASSIGNMENT FORM ============
exports.createForm = async (req, res) => {
    try {
        const cuttings = await Cutting.find({ status: { $ne: 'completed' } }).sort({ createdAt: -1 });
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        res.render('assignment/create', { title: 'New Assignment', cuttings, karigars });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading form');
        res.redirect('/assignments');
    }
};

// ============ CREATE ASSIGNMENT ============
exports.createAssignment = async (req, res) => {
    try {
        const { cutting, karigar, assignmentData, dueDate, remark } = req.body;
        const { sizes, totalGiven } = JSON.parse(assignmentData);
        
        // ✅ Get cutting data first
        const cuttingData = await Cutting.findById(cutting);
        
        if (!cuttingData) {
            req.flash('error_msg', 'Cutting not found');
            return res.redirect('/assignments/create');
        }
        
        // Update size-wise assigned pieces
        const updatedSizes = cuttingData.sizes.map(sizeItem => {
            const assignPieces = sizes[sizeItem.size] || 0;
            if (assignPieces > 0) {
                return {
                    ...sizeItem.toObject(),
                    assignedPieces: (sizeItem.assignedPieces || 0) + assignPieces
                };
            }
            return sizeItem;
        });
        
        // Calculate total assigned pieces
        const totalAssigned = updatedSizes.reduce((sum, s) => sum + (s.assignedPieces || 0), 0);
        
        // Determine new status
        let newStatus = 'assigned';
        if (totalAssigned >= cuttingData.totalPieces) {
            newStatus = 'completed';
        } else if (totalAssigned > 0) {
            newStatus = 'partial';
        }
        
        // Update cutting
        await Cutting.findByIdAndUpdate(cutting, {
            sizes: updatedSizes,
            assignedPieces: totalAssigned,
            status: newStatus
        });
        
        // Format sizes array for assignment
        const sizesArray = [];
        for (const [size, pieces] of Object.entries(sizes)) {
            if (pieces > 0) {
                sizesArray.push({ size, pieces });
            }
        }
        
        // Create assignment
        const assignment = await Assignment.create({
            cutting,
            karigar,
            productName: cuttingData.productName,
            productCategory: cuttingData.productCategory,
            sizes: sizesArray,
            givenPieces: totalGiven,
            dueDate: dueDate || null,
            remark,
            createdBy: req.session.user.id
        });
        
        req.flash('success_msg', `Assignment created: ${assignment.assignmentId} (${totalGiven} pieces)`);
        res.redirect('/assignments');
        
    } catch (error) {
        console.error('Assignment creation error:', error);
        req.flash('error_msg', 'Error creating assignment: ' + error.message);
        res.redirect('/assignments/create');
    }
};

// ============ GET SINGLE ASSIGNMENT (API) ============
exports.getAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('cutting').populate('karigar').populate('product');
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
        res.json({ ...assignment.toObject(), returnedPieces: assignment.returnedPieces || 0, givenPieces: assignment.givenPieces });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ============ EDIT FORM ============
exports.editForm = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('cutting', 'cuttingNumber productName productCategory totalPieces sizes assignedPieces')
            .populate('karigar', 'name');
        
        if (!assignment) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect('/assignments');
        }
        
        const karigars = await Worker.find({ workerType: 'karigar', isActive: true });
        const cuttingData = await Cutting.findById(assignment.cutting);
        
        let completeSizes = [];
        if (cuttingData && cuttingData.sizes) {
            completeSizes = cuttingData.sizes.map(cuttingSize => {
                const existingSize = assignment.sizes?.find(s => s.size === cuttingSize.size);
                return {
                    size: cuttingSize.size,
                    given: cuttingSize.pieces,
                    assigned: existingSize?.pieces || 0
                };
            });
        }
        
        res.render('assignment/edit', { title: 'Edit Assignment', assignment, karigars, cuttingData, completeSizes });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading edit form');
        res.redirect('/assignments');
    }
};

// ============ UPDATE ASSIGNMENT ============
exports.updateAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const { karigar, givenPieces, dueDate, remark, sizesData } = req.body;
        
        const existingAssignment = await Assignment.findById(id);
        if (!existingAssignment) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect('/assignments');
        }
        
        const cuttingData = await Cutting.findById(existingAssignment.cutting);
        
        let sizesArray = [];
        let totalGiven = parseInt(givenPieces);
        
        if (sizesData) {
            sizesArray = JSON.parse(sizesData);
            totalGiven = sizesArray.reduce((sum, s) => sum + (parseInt(s.pieces) || 0), 0);
        }
        
        const otherAssignments = await Assignment.find({ cutting: existingAssignment.cutting, _id: { $ne: id } });
        const assignedToOthers = otherAssignments.reduce((sum, a) => sum + a.givenPieces, 0);
        const maxAllowed = cuttingData.totalPieces - assignedToOthers + existingAssignment.givenPieces;
        
        if (totalGiven > maxAllowed) {
            req.flash('error_msg', `Cannot assign more than ${maxAllowed} pieces`);
            return res.redirect(`/assignments/edit/${id}`);
        }
        
        const newTotalAssigned = assignedToOthers + totalGiven;
        let cuttingStatus = newTotalAssigned >= cuttingData.totalPieces ? 'completed' : (newTotalAssigned > 0 ? 'partial' : 'pending');
        
        await Cutting.findByIdAndUpdate(existingAssignment.cutting, { assignedPieces: newTotalAssigned, status: cuttingStatus });
        await Assignment.findByIdAndUpdate(id, { karigar, givenPieces: totalGiven, sizes: sizesArray, dueDate: dueDate || null, remark: remark || '' });
        
        req.flash('success_msg', 'Assignment updated successfully');
        res.redirect('/assignments');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating assignment');
        res.redirect(`/assignments/edit/${req.params.id}`);
    }
};

// ============ DELETE ASSIGNMENT ============
exports.deleteAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect('/assignments');
        }
        
        const cuttingData = await Cutting.findById(assignment.cutting);
        if (cuttingData) {
            const newAssignedPieces = Math.max(0, (cuttingData.assignedPieces || 0) - assignment.givenPieces);
            let cuttingStatus = newAssignedPieces >= cuttingData.totalPieces ? 'completed' : (newAssignedPieces > 0 ? 'assigned' : 'pending');
            await Cutting.findByIdAndUpdate(assignment.cutting, { assignedPieces: newAssignedPieces, status: cuttingStatus });
        }
        
        await ProductionReturn.deleteMany({ assignment: req.params.id });
        await Assignment.findByIdAndDelete(req.params.id);
        
        req.flash('success_msg', 'Assignment deleted successfully');
        res.redirect('/assignments');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting assignment');
        res.redirect('/assignments');
    }
};

// ============ ARCHIVE OLD ASSIGNMENTS ============
exports.archiveOldAssignments = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const result = await Assignment.updateMany(
            { status: 'completed', completedAt: { $lt: thirtyDaysAgo }, isArchived: false },
            { $set: { isArchived: true } }
        );
        req.flash('success_msg', `${result.modifiedCount} old assignments archived`);
        res.redirect('/assignments');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error archiving assignments');
        res.redirect('/assignments');
    }
};

// ============ DELETE OLD ASSIGNMENTS PERMANENTLY ============
exports.deleteOldAssignments = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const oldAssignments = await Assignment.find({ status: 'completed', completedAt: { $lt: thirtyDaysAgo }, isArchived: false });
        const assignmentIds = oldAssignments.map(a => a._id);
        await ProductionReturn.deleteMany({ assignment: { $in: assignmentIds } });
        const result = await Assignment.deleteMany({ status: 'completed', completedAt: { $lt: thirtyDaysAgo }, isArchived: false });
        req.flash('success_msg', `${result.deletedCount} old assignments permanently deleted`);
        res.redirect('/assignments');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting old assignments');
        res.redirect('/assignments');
    }
};

// ============ PRINT ASSIGNMENT ============
exports.printAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('cutting', 'cuttingNumber client')
            .populate('karigar', 'name phone address');
        if (!assignment) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect('/assignments');
        }
        res.render('assignment/print', { title: 'Print Assignment', assignment, layout: false });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error printing assignment');
        res.redirect('/assignments');
    }
};