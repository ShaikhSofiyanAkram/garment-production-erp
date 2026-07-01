const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const dotenv = require('dotenv');

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Create default admin if not exists
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            await User.create({
                username: 'admin',
                email: 'admin@garment.com',
                password: 'admin123',
                role: 'admin'
            });
            console.log('Admin user created: username=admin, password=admin123');
        }
        
        // Create default products if none exist
        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            const defaultProducts = [
                { name: 'Kurta Pajama Kids (1-12)', category: 'Kids Wear', rates: { client: 800, karigar: 200, pressman: 50 } },
                { name: 'Pathani Kids (1-12)', category: 'Kids Wear', rates: { client: 900, karigar: 250, pressman: 60 } },
                { name: 'Kurta Pajama (36-50)', category: 'Mens Wear', rates: { client: 1200, karigar: 300, pressman: 80 } },
                { name: 'Pathani (36-50)', category: 'Mens Wear', rates: { client: 1500, karigar: 350, pressman: 100 } },
                { name: 'Shirt', category: 'Formal', rates: { client: 600, karigar: 150, pressman: 40 } },
                { name: 'Pant', category: 'Formal', rates: { client: 700, karigar: 180, pressman: 45 } },
                { name: 'Pajama', category: 'Casual', rates: { client: 400, karigar: 100, pressman: 30 } },
                { name: 'School Uniform', category: 'Kids Wear', rates: { client: 500, karigar: 120, pressman: 35 } }
            ];
            
            for (const product of defaultProducts) {
                await Product.create({
                    ...product,
                    sizes: ['S', 'M', 'L', 'XL'],
                    colors: ['Red', 'Blue', 'Black', 'White']
                });
            }
            console.log('Default products created');
        }
        
        console.log('Seed data completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};

seedData();