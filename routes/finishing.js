const express = require('express');
const router = express.Router();
const finishingController = require('../controllers/finishingController');
const { protect, adminOnly } = require('../middleware/auth');

// ============ VIEW ROUTES ============
router.get('/', protect, adminOnly, finishingController.getFinishing);
router.get('/create', protect, adminOnly, finishingController.createForm);
router.post('/create', protect, adminOnly, finishingController.createFinishing);
router.get('/view/:id', protect, adminOnly, finishingController.viewFinishing);
router.get('/delete/:id', protect, adminOnly, finishingController.deleteFinishing);

// ============ API ROUTES ============
router.get('/api/pending-returns/:karigarId', protect, adminOnly, finishingController.getPendingReturnsByKarigar);
router.get('/api/production-return/:returnId', protect, adminOnly, finishingController.getProductionReturnDetails);
router.get('/api/assignment-details/:assignmentId', protect, adminOnly, finishingController.getAssignmentDetails);
router.get('/api/existing-for-assignment/:assignmentId', protect, adminOnly, finishingController.getExistingFinishing);



// Finishing routes
router.get('/new', protect, (req, res) => {
    res.render('finishing/create', {
        title: 'New Finishing Entry',
        user: req.session.user,
        currentPage: 'finishing'
    });
});


module.exports = router;