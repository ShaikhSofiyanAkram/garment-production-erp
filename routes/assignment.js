const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, adminOnly, assignmentController.getAssignments);
router.get('/create', protect, adminOnly, assignmentController.createForm);
router.post('/create', protect, adminOnly, assignmentController.createAssignment);
router.get('/print/:id', protect, adminOnly, assignmentController.printAssignment);
router.get('/edit/:id', protect, adminOnly, assignmentController.editForm);
router.put('/edit/:id', protect, adminOnly, assignmentController.updateAssignment);
router.delete('/delete/:id', protect, adminOnly, assignmentController.deleteAssignment);
router.post('/archive-old', protect, adminOnly, assignmentController.archiveOldAssignments);
router.post('/delete-old', protect, adminOnly, assignmentController.deleteOldAssignments);
router.get('/:id', protect, adminOnly, assignmentController.getAssignment);

module.exports = router;