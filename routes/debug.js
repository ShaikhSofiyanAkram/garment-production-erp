const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { protect, adminOnly } = require('../middleware/auth');

// ONLY FOR DEBUG - Reset password for a user
router.post('/reset-password', protect, adminOnly, async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findOneAndUpdate({ email }, { password: hashedPassword });
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ONLY FOR DEBUG - List all users
router.get('/users', protect, adminOnly, async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 });
        res.json(users);
    } catch (error) {
        res.json({ error: error.message });
    }
});

module.exports = router;