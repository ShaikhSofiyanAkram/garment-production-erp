const mongoose = require('mongoose');
const Bill = require('./models/Bill');

async function fixBillNumbers() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/garment_erp');
        console.log('✅ Connected to MongoDB');
        
        // Find all bills with duplicate numbers
        const duplicates = await Bill.aggregate([
            { $group: { _id: '$billNumber', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        
        console.log('📊 Duplicate bill numbers found:', duplicates.length);
        
        for (const dup of duplicates) {
            const bills = await Bill.find({ billNumber: dup._id }).sort({ createdAt: 1 });
            console.log(`📝 Fixing ${bills.length} duplicates for ${dup._id}`);
            
            // Keep the first one, update the rest
            for (let i = 1; i < bills.length; i++) {
                const date = new Date();
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const timestamp = Date.now().toString().slice(-6) + i;
                const newNumber = `BILL-${year}${month}-${timestamp}`;
                
                await Bill.findByIdAndUpdate(bills[i]._id, { billNumber: newNumber });
                console.log(`  ✅ Updated ${bills[i].billNumber} → ${newNumber}`);
            }
        }
        
        // Find max bill number for each month
        const prefix = `BILL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-`;
        const lastBill = await Bill.findOne({ billNumber: { $regex: `^${prefix}` } }).sort({ billNumber: -1 });
        
        console.log(`\n📋 Current month's last bill: ${lastBill?.billNumber || 'None'}`);
        
        await mongoose.disconnect();
        console.log('✅ Done');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixBillNumbers();