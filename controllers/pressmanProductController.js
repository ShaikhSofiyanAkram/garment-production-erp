const PressmanProduct = require('../models/PressmanProduct');

// ==================== GET PRODUCTS PAGE ====================
exports.getProducts = async (req, res) => {
    try {
        const products = await PressmanProduct.find()
            .sort({ category: 1, name: 1 });
        
        console.log('📦 Products found:', products.map(p => ({
            name: p.name,
            hasSizeRates: p.hasSizeRates,
            rate: p.rate,
            sizeRates: p.sizeRates
        })));
        
        res.render('pressman/products', {
            title: 'Pressman Products & Rates',
            products: products || [],
            user: req.session.user,
            currentPage: 'pressman',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('❌ Error loading products:', error);
        req.flash('error_msg', 'Error loading products: ' + error.message);
        res.redirect('/pressman');
    }
};

// ==================== GET PRODUCT FORM ====================
exports.getProductForm = async (req, res) => {
    try {
        let product = null;
        if (req.params.id) {
            product = await PressmanProduct.findById(req.params.id);
            if (!product) {
                req.flash('error_msg', 'Product not found');
                return res.redirect('/pressman/products');
            }
        }
        
        res.render('pressman/product-form', {
            title: product ? 'Edit Product' : 'New Product',
            product: product,
            user: req.session.user,
            currentPage: 'pressman'
        });
    } catch (error) {
        console.error('❌ Error loading product form:', error);
        req.flash('error_msg', 'Error loading form: ' + error.message);
        res.redirect('/pressman/products');
    }
};

// ==================== CREATE PRODUCT ====================
exports.createProduct = async (req, res) => {
    try {
        const { name, category, rateType, rate, size, sizeRate, description } = req.body;
        
        console.log('📝 Creating product:', { name, category, rateType, rate, size, sizeRate });
        
        // ✅ Check if product exists
        const existing = await PressmanProduct.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') } 
        });
        
        if (existing) {
            req.flash('error_msg', `Product "${name}" already exists!`);
            return res.redirect('/pressman/products/new');
        }
        
        let productData = {
            name: name.trim(),
            category: category || 'Mens',
            description: description || '',
            createdBy: req.session.user.id,
            isActive: true,
            hasSizeRates: false,
            rate: 0,
            sizeRates: []
        };
        
        // ✅ Handle rate type
        if (rateType === 'size') {
            // Size-wise rates - handle both array and single values
            const sizes = Array.isArray(size) ? size : (size ? [size] : []);
            const rates = Array.isArray(sizeRate) ? sizeRate : (sizeRate ? [sizeRate] : []);
            
            const sizeRates = [];
            for (let i = 0; i < sizes.length; i++) {
                if (sizes[i] && rates[i]) {
                    sizeRates.push({
                        size: sizes[i].trim(),
                        rate: parseFloat(rates[i]) || 0
                    });
                }
            }
            
            if (sizeRates.length === 0) {
                req.flash('error_msg', 'Please add at least one size with rate');
                return res.redirect('/pressman/products/new');
            }
            
            productData.hasSizeRates = true;
            productData.sizeRates = sizeRates;
            productData.rate = 0;
            
            console.log('✅ Size-wise rates:', sizeRates);
        } else {
            // Uniform rate
            if (!rate || parseFloat(rate) <= 0) {
                req.flash('error_msg', 'Please enter a valid rate');
                return res.redirect('/pressman/products/new');
            }
            productData.hasSizeRates = false;
            productData.rate = parseFloat(rate);
            productData.sizeRates = [];
        }
        
        const product = new PressmanProduct(productData);
        await product.save();
        
        console.log('✅ Product created:', product.name, 'hasSizeRates:', product.hasSizeRates);
        req.flash('success_msg', `Product "${product.name}" created successfully!`);
        res.redirect('/pressman/products');
        
    } catch (error) {
        console.error('❌ Error creating product:', error);
        req.flash('error_msg', 'Error creating product: ' + error.message);
        res.redirect('/pressman/products/new');
    }
};

// ==================== UPDATE PRODUCT ====================
exports.updateProduct = async (req, res) => {
    try {
        const { name, category, rateType, rate, size, sizeRate, isActive, description } = req.body;
        const product = await PressmanProduct.findById(req.params.id);
        
        if (!product) {
            req.flash('error_msg', 'Product not found');
            return res.redirect('/pressman/products');
        }
        
        // ✅ Check if name already exists
        const existing = await PressmanProduct.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            _id: { $ne: product._id }
        });
        
        if (existing) {
            req.flash('error_msg', `Product "${name}" already exists!`);
            return res.redirect(`/pressman/products/${product._id}/edit`);
        }
        
        // ✅ Update basic info
        product.name = name.trim();
        product.category = category || 'Mens';
        product.description = description || '';
        product.isActive = isActive === 'true' || isActive === true;
        
        // ✅ Handle rate type
        if (rateType === 'size') {
            const sizes = Array.isArray(size) ? size : (size ? [size] : []);
            const rates = Array.isArray(sizeRate) ? sizeRate : (sizeRate ? [sizeRate] : []);
            
            const sizeRates = [];
            for (let i = 0; i < sizes.length; i++) {
                if (sizes[i] && rates[i]) {
                    sizeRates.push({
                        size: sizes[i].trim(),
                        rate: parseFloat(rates[i]) || 0
                    });
                }
            }
            
            if (sizeRates.length === 0) {
                req.flash('error_msg', 'Please add at least one size with rate');
                return res.redirect(`/pressman/products/${product._id}/edit`);
            }
            
            product.hasSizeRates = true;
            product.sizeRates = sizeRates;
            product.rate = 0;
            
            console.log('✅ Updated size-wise rates:', sizeRates);
        } else {
            if (!rate || parseFloat(rate) <= 0) {
                req.flash('error_msg', 'Please enter a valid rate');
                return res.redirect(`/pressman/products/${product._id}/edit`);
            }
            product.hasSizeRates = false;
            product.rate = parseFloat(rate);
            product.sizeRates = [];
        }
        
        await product.save();
        
        console.log('✅ Product updated:', product.name);
        req.flash('success_msg', `Product "${product.name}" updated successfully!`);
        res.redirect('/pressman/products');
        
    } catch (error) {
        console.error('❌ Error updating product:', error);
        req.flash('error_msg', 'Error updating product: ' + error.message);
        res.redirect('/pressman/products');
    }
};

// ==================== DELETE PRODUCT ====================
exports.deleteProduct = async (req, res) => {
    try {
        const product = await PressmanProduct.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }
        
        console.log('✅ Product deleted:', product.name);
        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Error deleting product:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// ==================== API: GET PRODUCTS ====================
exports.getProductsAPI = async (req, res) => {
    try {
        const products = await PressmanProduct.find({ isActive: true })
            .select('_id name rate category hasSizeRates sizeRates')
            .sort({ name: 1 });
        
        // ✅ Log for debugging
        console.log('📦 API Products:', products.map(p => ({
            name: p.name,
            hasSizeRates: p.hasSizeRates,
            rate: p.rate,
            sizeRates: p.sizeRates
        })));
        
        res.json({ success: true, products });
        
    } catch (error) {
        console.error('❌ Error fetching products API:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};