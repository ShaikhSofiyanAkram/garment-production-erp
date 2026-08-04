// test-login.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function testLogin() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/garment_erp');
        console.log('✅ Connected');
        
        // Test 1: Check user
        const user = await User.findOne({ email: "worker@example.com" });
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        
        console.log('✅ User found:', {
            email: user.email,
            username: user.username,
            hashedPassword: user.password ? 'Yes' : 'No',
            passwordLength: user.password?.length || 0
        });
        
        // Test 2: Test password
        const testPassword = 'worker123';
        const isValid = await bcrypt.compare(testPassword, user.password);
        console.log('🔑 Password valid:', isValid);
        
        // Test 3: Generate new hash
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(testPassword, salt);
        console.log('🔑 New hash for testing:', newHash);
        
        // Test 4: Verify new hash
        const newVerify = await bcrypt.compare(testPassword, newHash);
        console.log('🔑 New hash verification:', newVerify);
        
        await mongoose.disconnect();
        console.log('✅ Done');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testLogin();