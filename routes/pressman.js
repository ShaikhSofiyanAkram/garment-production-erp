const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');

const pressmanController = require('../controllers/pressmanController');
const pressmanProductController = require('../controllers/pressmanProductController');

// ==================== ✅ PRODUCT ROUTES (FIRST - IMPORTANT) ====================
router.get('/products', protect, adminOnly, pressmanProductController.getProducts);
router.get('/products/new', protect, adminOnly, pressmanProductController.getProductForm);
router.get('/products/:id/edit', protect, adminOnly, pressmanProductController.getProductForm);
router.post('/products/create', protect, adminOnly, pressmanProductController.createProduct);
router.post('/products/:id/update', protect, adminOnly, pressmanProductController.updateProduct);
router.delete('/products/:id', protect, adminOnly, pressmanProductController.deleteProduct);

// ==================== API ROUTES ====================
router.get('/api/work', protect, pressmanController.getPressmanWork);
router.get('/api/pressmen', protect, pressmanController.getPressmenList);
router.get('/api/products', protect, pressmanProductController.getProductsAPI);

// ==================== MAIN ROUTES ====================
router.get('/', protect, adminOnly, pressmanController.getPressmanDashboard);
router.get('/new', protect, adminOnly, pressmanController.getEntryForm);
router.post('/create', protect, adminOnly, pressmanController.createEntry);

// ==================== ID ROUTES (LAST) ====================
router.get('/:id', protect, adminOnly, pressmanController.viewEntry);
router.post('/:id/status', protect, adminOnly, pressmanController.updateStatus);
router.delete('/:id', protect, adminOnly, pressmanController.deleteEntry);

module.exports = router;
