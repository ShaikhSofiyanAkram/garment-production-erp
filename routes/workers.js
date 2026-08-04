const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ============ WORKER MANAGEMENT ROUTES ============

// List all workers
router.get('/', protect, adminOnly, workerController.getWorkers);

// Create worker (simple - no login)
router.get('/create', protect, adminOnly, workerController.createForm);
router.post('/create', protect, adminOnly, upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), workerController.createWorker);

// Register worker with login credentials (Admin only)
router.get('/register', protect, adminOnly, workerController.registerForm);
router.post('/register', protect, adminOnly, upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), workerController.registerWorker);

// Edit worker
router.get('/edit/:id', protect, adminOnly, workerController.editForm);
router.put('/edit/:id', protect, adminOnly, workerController.updateWorker);

// Delete worker
router.delete('/delete/:id', protect, adminOnly, workerController.deleteWorker);

// View worker details
router.get('/view/:id', protect, adminOnly, workerController.viewWorker);

// ============ API ROUTES ============
router.get('/payment-history/:id', protect, adminOnly, workerController.getPaymentHistory);
router.get('/karigar-work/:id', protect, adminOnly, workerController.getKarigarWork);
router.get('/pressman-work/:id', protect, adminOnly, workerController.getPressmanWork);








// ============ WORKER MANAGEMENT ROUTES ============

// List all workers
router.get('/', protect, adminOnly, workerController.getWorkers);

// Create worker (simple - no login)
router.get('/create', protect, adminOnly, workerController.createForm);
router.post('/create', protect, adminOnly, upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), workerController.createWorker);

// Register worker with login credentials (Admin only)
router.get('/register', protect, adminOnly, workerController.registerForm);
router.post('/register', protect, adminOnly, upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), workerController.registerWorker);

// Edit worker
router.get('/edit/:id', protect, adminOnly, workerController.editForm);
router.put('/edit/:id', protect, adminOnly, workerController.updateWorker);

// Delete worker
router.delete('/delete/:id', protect, adminOnly, workerController.deleteWorker);

// View worker details
router.get('/view/:id', protect, adminOnly, workerController.viewWorker);

// ============ API ROUTES ============
router.get('/payment-history/:id', protect, adminOnly, workerController.getPaymentHistory);
router.get('/karigar-work/:id', protect, adminOnly, workerController.getKarigarWork);
router.get('/pressman-work/:id', protect, adminOnly, workerController.getPressmanWork);

module.exports = router;

