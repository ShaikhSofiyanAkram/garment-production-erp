const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');

const resetPassword = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        const username = 'zeeshan'; // Your username
        const newPassword = 'admin123'; // New password
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const result = await User.updateOne(
            { username: username },
            { $set: { password: hashedPassword } }
        );
        
        if (result.modifiedCount > 0) {
            console.log(`Password reset successful for user: ${username}`);
            console.log(`New password: ${newPassword}`);
        } else {
            console.log(`User not found: ${username}`);
            
            // Create new user if not exists
            const newUser = new User({
                username: 'zeeshan',
                email: 'zeeshan@example.com',
                password: newPassword
            });
            await newUser.save();
            console.log('New user created with password:', newPassword);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resetPassword();