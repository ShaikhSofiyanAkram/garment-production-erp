// In Node REPL or create test.js
const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = 'worker123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log('Password:', password);
    console.log('Salt:', salt);
    console.log('Hash:', hash);
    
    // Verify
    const verify = await bcrypt.compare(password, hash);
    console.log('Verification:', verify ? '✅ PASSED' : '❌ FAILED');
}

generateHash();