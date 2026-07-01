const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🔧 Garment ERP System Setup\n');
console.log('============================\n');

// Create directories
const dirs = [
    'public/uploads/workers',
    'public/uploads/fabrics',
    'public/uploads/temp',
    'logs'
];

console.log('📁 Creating directories...');
dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`   Created: ${dir}`);
    }
});

// Create .env if not exists
if (!fs.existsSync(path.join(__dirname, '.env'))) {
    console.log('\n📝 Creating .env file...');
    const envContent = `PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/garment_erp
JWT_SECRET=garment_erp_secret_${Date.now()}
JWT_EXPIRE=30d
SESSION_SECRET=session_secret_${Math.random().toString(36).substring(7)}
NODE_ENV=development`;
    
    fs.writeFileSync(path.join(__dirname, '.env'), envContent);
    console.log('✅ .env file created');
}

console.log('\n✨ Setup completed!\n');
console.log('Next steps:');
console.log('1. Run: npm install');
console.log('2. Run: mongod (in another terminal)');
console.log('3. Run: npm start');
console.log('4. Open: http://localhost:3000\n');