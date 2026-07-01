const FabricBatch = require('../models/FabricBatch');

// Get all batches
exports.getBatches = async (req, res) => {
    try {
        const batches = await FabricBatch.find()
            .sort({ date: -1 })
            .populate('createdBy', 'username');
        
        // Group by month for summary
        const monthlySummary = {};
        batches.forEach(batch => {
            const monthYear = new Date(batch.date).toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!monthlySummary[monthYear]) {
                monthlySummary[monthYear] = {
                    totalMeters: 0,
                    totalBatches: 0,
                    totalItems: 0
                };
            }
            monthlySummary[monthYear].totalMeters += batch.totalMeters;
            monthlySummary[monthYear].totalBatches++;
            monthlySummary[monthYear].totalItems += batch.totalItems;
        });
        
        res.render('fabrics/index', { 
            title: 'Fabric Batches', 
            batches,
            monthlySummary
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching fabric batches');
        res.redirect('/dashboard');
    }
};

// Show create form
exports.createForm = (req, res) => {
    res.render('fabrics/create', { title: 'New Fabric Batch Entry' });
};

// Create batch with multiple items
// Create batch with multiple items





exports.createBatch = async (req, res) => {
    try {
        const { date, items, supplier, overallRemark } = req.body;
        
        console.log('Received data:', req.body);
        
        // Parse items from form
        let itemsArray = [];
        
        if (items) {
            // Get fabric types (support both select and other)
            let fabricTypes = items.fabricType || [];
            let fabricTypeSelects = items.fabricTypeSelect || [];
            let otherFabrics = items.otherFabric || [];
            
            // Get colors
            let colors = items.color || [];
            let colorSelects = items.colorSelect || [];
            let otherColors = items.otherColor || [];
            
            const totalTypes = Math.max(
                fabricTypes.length,
                fabricTypeSelects.length,
                otherFabrics.length,
                colors.length,
                colorSelects.length,
                otherColors.length
            );
            
            for (let i = 0; i < totalTypes; i++) {
                // Determine fabric type
                let fabricType = fabricTypes[i] || '';
                if (!fabricType && fabricTypeSelects[i] === 'Other') {
                    fabricType = otherFabrics[i] || '';
                } else if (!fabricType && fabricTypeSelects[i]) {
                    fabricType = fabricTypeSelects[i];
                }
                
                // Determine color
                let color = colors[i] || '';
                if (!color && colorSelects[i] === 'Other') {
                    color = otherColors[i] || '';
                } else if (!color && colorSelects[i]) {
                    color = colorSelects[i];
                }
                
                const totalMeters = parseFloat(items.totalMeters?.[i]) || 0;
                const remark = items.remark?.[i] || '';
                
                if (fabricType && fabricType !== '' && totalMeters > 0) {
                    itemsArray.push({
                        fabricType: fabricType.trim(),
                        totalMeters,
                        color: color || '',
                        remark: remark || ''
                    });
                }
            }
        }
        
        if (itemsArray.length === 0) {
            req.flash('error_msg', 'At least one fabric item is required');
            return res.redirect('/fabrics/create');
        }
        
        const batch = new FabricBatch({
            date: date || new Date(),
            items: itemsArray,
            supplier: supplier || '',
            overallRemark: overallRemark || '',
            createdBy: req.session.user.id
        });
        
        await batch.save();
        
        req.flash('success_msg', `Batch ${batch.batchNumber} saved with ${itemsArray.length} items`);
        res.redirect('/fabrics');
        
    } catch (error) {
        console.error('Error creating batch:', error);
        req.flash('error_msg', 'Error saving fabric batch: ' + error.message);
        res.redirect('/fabrics/create');
    }
};




// exports.createBatch = async (req, res) => {
//     try {
//         const { date, items, supplier, overallRemark } = req.body;
        
//         console.log('Received data:', req.body);
        
//         // Parse items from form
//         let itemsArray = [];
//         if (items && items.fabricType) {
//             const itemCount = Array.isArray(items.fabricType) ? items.fabricType.length : 1;
//             for (let i = 0; i < itemCount; i++) {
//                 const fabricType = Array.isArray(items.fabricType) ? items.fabricType[i] : items.fabricType;
//                 const totalMeters = parseFloat(Array.isArray(items.totalMeters) ? items.totalMeters[i] : items.totalMeters);
//                 const color = Array.isArray(items.color) ? items.color[i] : (items.color || '');
//                 const remark = Array.isArray(items.remark) ? items.remark[i] : (items.remark || '');
                
//                 if (fabricType && fabricType !== '' && totalMeters > 0) {
//                     itemsArray.push({
//                         fabricType,
//                         totalMeters,
//                         color: color || '',
//                         remark: remark || ''
//                     });
//                 }
//             }
//         }
        
//         if (itemsArray.length === 0) {
//             req.flash('error_msg', 'At least one fabric item is required');
//             return res.redirect('/fabrics/create');
//         }
        
//         const batch = new FabricBatch({
//             date: date || new Date(),
//             items: itemsArray,
//             supplier: supplier || '',
//             overallRemark: overallRemark || '',
//             createdBy: req.session.user.id
//         });
        
//         await batch.save();
        
//         req.flash('success_msg', `Batch ${batch.batchNumber} saved with ${itemsArray.length} items`);
//         res.redirect('/fabrics');
        
//     } catch (error) {
//         console.error('Error creating batch:', error);
//         req.flash('error_msg', 'Error saving fabric batch: ' + error.message);
//         res.redirect('/fabrics/create');
//     }
// };

// View single batch details
exports.viewBatch = async (req, res) => {
    try {
        const batch = await FabricBatch.findById(req.params.id).populate('createdBy', 'username');
        if (!batch) {
            req.flash('error_msg', 'Batch not found');
            return res.redirect('/fabrics');
        }
        res.render('fabrics/view', { title: `Batch: ${batch.batchNumber}`, batch });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching batch details');
        res.redirect('/fabrics');
    }
};

// Delete batch
exports.deleteBatch = async (req, res) => {
    try {
        await FabricBatch.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Batch deleted successfully');
        res.redirect('/fabrics');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting batch');
        res.redirect('/fabrics');
    }
};

// Get single batch by ID (for modal view - API)
exports.getBatch = async (req, res) => {
    try {
        const batch = await FabricBatch.findById(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        res.json(batch);
    } catch (error) {
        console.error('Error fetching batch:', error);
        res.status(500).json({ error: 'Server error' });
    }
};










// const Fabric = require('../models/Fabric');

// exports.getFabrics = async (req, res) => {
//   try {
//     const fabrics = await Fabric.find().sort({ entryDate: -1 }).populate('createdBy', 'username');
//     res.render('fabrics/index', { title: 'Fabric Management', fabrics });
//   } catch (error) {
//     req.flash('error_msg', 'Error fetching fabrics');
//     res.redirect('/dashboard');
//   }
// };

// exports.createForm = (req, res) => {
//   res.render('fabrics/create', { title: 'Add Fabric Entry' });
// };

// exports.createFabric = async (req, res) => {
//   try {
//     const { fabricType, fabricName, items, totalMeters, remark } = req.body;
    
//     let itemsArray = [];
//     if (items) {
//       const itemCount = Array.isArray(items.itemName) ? items.itemName.length : 1;
//       for (let i = 0; i < itemCount; i++) {
//         itemsArray.push({
//           itemName: Array.isArray(items.itemName) ? items.itemName[i] : items.itemName,
//           metersPerItem: parseFloat(Array.isArray(items.metersPerItem) ? items.metersPerItem[i] : items.metersPerItem),
//           quantity: parseInt(Array.isArray(items.quantity) ? items.quantity[i] : items.quantity),
//           totalMeters: parseFloat(Array.isArray(items.totalMeters) ? items.totalMeters[i] : items.totalMeters)
//         });
//       }
//     }
    
//     await Fabric.create({
//       fabricType,
//       fabricName,
//       items: itemsArray,
//       totalMeters: parseFloat(totalMeters),
//       remark,
//       createdBy: req.session.user.id
//     });
    
//     req.flash('success_msg', 'Fabric entry added successfully');
//     res.redirect('/fabrics');
//   } catch (error) {
//     console.error(error);
//     req.flash('error_msg', 'Error adding fabric entry');
//     res.redirect('/fabrics/create');
//   }
// };