// reset-worker-password.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetPassword() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/garment_erp');
        console.log('✅ Connected');
        
        const email = 'worker@example.com';
        const newPassword = 'worker123';
        
        // ✅ Generate fresh hash
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        console.log('🔑 New hash:', hashedPassword);
        
        // ✅ Update user
        const result = await mongoose.connection.collection('users').updateOne(
            { email: email },
            { $set: { password: hashedPassword } }
        );
        
        console.log('✅ Updated:', result);
        
        // ✅ Verify
        const user = await mongoose.connection.collection('users').findOne({ email: email });
        const isValid = await bcrypt.compare(newPassword, user.password);
        console.log('🔑 Verification:', isValid ? '✅ SUCCESS' : '❌ FAILED');
        
        await mongoose.disconnect();
        console.log('✅ Done');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

resetPassword();