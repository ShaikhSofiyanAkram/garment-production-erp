const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { protect, adminOnly } = require('../middleware/auth');

// All routes require authentication and admin access
router.get('/', protect, adminOnly, clientController.getClients);
router.get('/create', protect, adminOnly, clientController.createForm);
router.post('/create', protect, adminOnly, clientController.createClient);
router.get('/edit/:id', protect, adminOnly, clientController.editForm);
router.put('/edit/:id', protect, adminOnly, clientController.updateClient);
router.delete('/delete/:id', protect, adminOnly, clientController.deleteClient);

// API routes for dropdown (used in billing)
router.get('/api/list', protect, adminOnly, clientController.getClientApi);
router.post('/api/quick-add', protect, adminOnly, clientController.quickAddClient);
router.get('/api/parties', protect, adminOnly, clientController.getParties);
router.get('/api/clients-list', protect, adminOnly, clientController.getClientsList);

module.exports = router;