const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/auth');
const Product = require('../models/Product');

// View routes
router.get('/', protect, adminOnly, productController.getProducts);
router.get('/create', protect, adminOnly, productController.createForm);
router.post('/create', protect, adminOnly, productController.createProduct);
router.get('/edit/:id', protect, adminOnly, productController.editForm);
router.put('/edit/:id', protect, adminOnly, productController.updateProduct);
router.delete('/delete/:id', protect, adminOnly, productController.deleteProduct);

// ============ API ROUTES ============
// Get all products list
router.get('/api/list', protect, adminOnly, async (req, res) => {
    try {
        const products = await Product.find({ isActive: true });
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json([]);
    }
});






// Get single product with details
router.get('/api/:id', protect, adminOnly, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;



