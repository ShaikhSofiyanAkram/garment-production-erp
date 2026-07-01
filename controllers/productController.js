const Product = require('../models/Product');

// ============ GET PRODUCTS ============
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
        res.render('products/index', { 
            title: 'Products Management', 
            products,
            user: req.session.user,
            currentPage: 'products'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching products');
        res.redirect('/dashboard');
    }
};

// ============ CREATE FORM ============
exports.createForm = async (req, res) => {
    try {
        const existingProducts = await Product.find({ isActive: true }).select('name');
        res.render('products/create', { 
            title: 'Add New Product',
            existingProducts: existingProducts || [],
            user: req.session.user,
            currentPage: 'products'
        });
    } catch (error) {
        console.error(error);
        res.render('products/create', { 
            title: 'Add New Product',
            existingProducts: [],
            user: req.session.user,
            currentPage: 'products'
        });
    }
};

// ============ CREATE PRODUCT (FIXED) ============
exports.createProduct = async (req, res) => {
    try {
        let { name, category, sizes, colors, sizeRates, customCategory, productSelect, newProductName } = req.body;
        
        console.log('Received body:', req.body);
        console.log('Received sizeRates:', sizeRates);
        
        // ========== HANDLE PRODUCT NAME ==========
        let finalName = '';
        
        // Case 1: From productSelect dropdown
        if (productSelect && productSelect !== 'other' && productSelect !== '') {
            finalName = productSelect;
        }
        // Case 2: From newProductName input
        else if (newProductName && newProductName.trim() !== '') {
            finalName = newProductName.trim();
        }
        // Case 3: From name field (fallback)
        else if (name && typeof name === 'string' && name.trim() !== '') {
            finalName = name.trim();
        }
        // Case 4: From name array
        else if (Array.isArray(name)) {
            const validNames = name.filter(n => n && n.trim() !== '');
            finalName = validNames.length > 0 ? validNames[validNames.length - 1] : '';
        }
        
        if (!finalName || finalName.trim() === '') {
            req.flash('error_msg', 'Product name is required');
            return res.redirect('/products/create');
        }
        
        finalName = finalName.trim();
        console.log('Final product name:', finalName);
        
        // ========== HANDLE CATEGORY ==========
        let finalCategory = category;
        if (category === 'kids' || category === 'Kids') finalCategory = 'Kids';
        else if (category === 'mens' || category === 'Mens') finalCategory = 'Mens';
        else if (category === 'other' || category === 'Other') finalCategory = 'Other';
        
        if (!finalCategory) {
            req.flash('error_msg', 'Please select a category');
            return res.redirect('/products/create');
        }
        
        console.log('Final category:', finalCategory);
        
        // ========== PARSE SIZES ==========
        let sizesArray = [];
        if (sizes) {
            if (typeof sizes === 'string') {
                sizesArray = sizes.split(',').map(s => s.trim()).filter(s => s !== '');
            } else if (Array.isArray(sizes)) {
                sizesArray = sizes.filter(s => s && s.trim() !== '');
            }
        }
        
        console.log('Sizes array:', sizesArray);
        
        // ========== HANDLE COLORS ==========
        let colorsArray = [];
        if (colors) {
            let tempColors = Array.isArray(colors) ? colors : [colors];
            for (let color of tempColors) {
                if (!color || color.trim() === '') continue;
                if (color === 'other') {
                    const otherColor = req.body.otherColorName;
                    if (otherColor && otherColor.trim() !== '') {
                        colorsArray.push(otherColor.trim());
                    }
                } else {
                    colorsArray.push(color.trim());
                }
            }
        }
        colorsArray = [...new Set(colorsArray)];
        console.log('Colors array:', colorsArray);
        
        // ========== PARSE SIZE RATES ==========
        let sizeRatesArray = [];
        if (sizeRates) {
            try {
                sizeRatesArray = typeof sizeRates === 'string' ? JSON.parse(sizeRates) : sizeRates;
                sizeRatesArray = sizeRatesArray.filter(r => r.size && (r.clientRate > 0 || r.karigarRate > 0));
            } catch(e) {
                console.error('Error parsing sizeRates:', e);
                sizeRatesArray = [];
            }
        }
        console.log('Final sizeRatesArray:', sizeRatesArray);
        
        // ========== CREATE PRODUCT ==========
        const productData = {
            name: finalName,
            category: finalCategory,
            sizes: sizesArray,
            colors: colorsArray,
            sizeRates: sizeRatesArray
        };
        
        // Add custom category if Other
        if (finalCategory === 'Other' && customCategory) {
            productData.customCategory = customCategory;
        }
        
        const product = await Product.create(productData);
        console.log('Product created successfully:', product._id);
        
        req.flash('success_msg', `✅ Product "${product.name}" added successfully with ${sizesArray.length} sizes`);
        res.redirect('/products');
        
    } catch (error) {
        console.error('Product creation error:', error);
        if (error.code === 11000) {
            req.flash('error_msg', 'Product with this name already exists!');
        } else {
            req.flash('error_msg', 'Error creating product: ' + error.message);
        }
        res.redirect('/products/create');
    }
};

// ============ EDIT FORM ============
// ============ EDIT FORM ============
// ============ EDIT FORM ============
// ============ EDIT FORM ============
// ============ EDIT FORM ============
// ============ EDIT FORM ============
exports.editForm = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('error_msg', 'Product not found');
            return res.redirect('/products');
        }
        
        // ✅ Ensure product has all required fields
        console.log('Editing product:', product.name);
        console.log('Sizes:', product.sizes);
        console.log('SizeRates:', product.sizeRates);
        
        res.render('products/edit', { 
            title: 'Edit Product', 
            product: product,
            user: req.session.user,
            currentPage: 'products'
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching product');
        res.redirect('/products');
    }
};
// ============ UPDATE PRODUCT ============
// ============ UPDATE PRODUCT ============
exports.updateProduct = async (req, res) => {
    try {
        let { name, category, sizes, colors, isActive, sizeRates, customCategory } = req.body;
        
        console.log('Update body:', req.body);
        
        // Handle name
        let finalName = name ? name.trim() : '';
        if (!finalName) {
            req.flash('error_msg', 'Product name is required');
            return res.redirect(`/products/edit/${req.params.id}`);
        }
        
        // Handle category
        let finalCategory = category;
        if (category === 'kids' || category === 'Kids') finalCategory = 'Kids';
        else if (category === 'mens' || category === 'Mens') finalCategory = 'Mens';
        else if (category === 'other' || category === 'Other') finalCategory = 'Other';
        
        console.log('Final category:', finalCategory);
        
        // Handle colors
        let colorsArray = [];
        if (colors) {
            try {
                colorsArray = typeof colors === 'string' ? JSON.parse(colors) : colors;
                colorsArray = Array.isArray(colorsArray) ? colorsArray : [];
            } catch(e) {
                colorsArray = [];
            }
        }
        colorsArray = [...new Set(colorsArray)];
        
        // Parse size rates
        let sizeRatesArray = [];
        if (sizeRates) {
            try {
                sizeRatesArray = typeof sizeRates === 'string' ? JSON.parse(sizeRates) : sizeRates;
                sizeRatesArray = sizeRatesArray.filter(r => r.size && (r.clientRate > 0 || r.karigarRate > 0));
            } catch(e) {
                console.error('Error parsing sizeRates:', e);
                sizeRatesArray = [];
            }
        }
        console.log('Size rates to update:', sizeRatesArray.length);
        
        const updateData = {
            name: finalName,
            category: finalCategory,
            colors: colorsArray,
            sizeRates: sizeRatesArray,
            isActive: isActive === 'on'
        };
        
        if (finalCategory === 'Other' && customCategory) {
            updateData.customCategory = customCategory;
        }
        
        await Product.findByIdAndUpdate(req.params.id, updateData);
        
        req.flash('success_msg', '✅ Product updated successfully');
        res.redirect('/products');
        
    } catch (error) {
        console.error('Error updating product:', error);
        req.flash('error_msg', 'Error updating product: ' + error.message);
        res.redirect(`/products/edit/${req.params.id}`);
    }
};

// ============ DELETE PRODUCT ============
exports.deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, { isActive: false });
        req.flash('success_msg', 'Product deleted successfully');
        res.redirect('/products');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting product');
        res.redirect('/products');
    }
};