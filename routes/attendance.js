const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

// ============ VIEW ROUTES ============
// Attendance management page
router.get('/', protect, adminOnly, attendanceController.getAttendance);

// ============ API ROUTES ============
// Save single attendance
router.post('/save', protect, adminOnly, attendanceController.saveAttendance);

// Get worker attendance summary
router.get('/worker-summary', protect, adminOnly, attendanceController.getWorkerSummary);

// Toggle attendance (for worker detail page)
router.post('/toggle', protect, adminOnly, attendanceController.toggleAttendance);

// Mark all present for a month
router.post('/mark-all-present', protect, adminOnly, attendanceController.markAllPresent);

// Dashboard widget
router.get('/widget', protect, adminOnly, attendanceController.getAttendanceWidget);

module.exports = router;