















































































































const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const testAuth = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');
        
        const db = mongoose.connection.db;
        const users = await db.collection('users').find().toArray();
        
        console.log('Users in database:');
        users.forEach(user => {
            console.log(`- Username: ${user.username}, Email: ${user.email}`);
            console.log(`  Password hash: ${user.password.substring(0, 30)}...`);
            
            // Test password 'admin123' (or whatever you used)
            const testPassword = 'admin123';
            bcrypt.compare(testPassword, user.password, (err, result) => {
                console.log(`  Password '${testPassword}' match: ${result}`);
            });
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

testAuth();
