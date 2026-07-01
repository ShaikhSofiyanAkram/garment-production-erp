const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
    billNumber: { type: String, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    billDate: { type: Date, default: Date.now },
    dueDate: Date,
    items: [{
        productName: String,
        category: String,
        size: String,
        quantity: Number,
        rate: Number,
        amount: Number
    }],
    subtotal: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 18 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
    paymentTerms: { type: String, default: 'weekly' },
    remark: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// ✅ FIXED: Generate bill number with proper sequence
billSchema.pre('save', async function(next) {
    if (!this.billNumber) {
        try {
            // ✅ Get current date for prefix
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const prefix = `BILL-${year}${month}-`;
            
            // ✅ Find the maximum bill number for this month
            const lastBill = await mongoose.model('Bill')
                .findOne({ billNumber: { $regex: `^${prefix}` } })
                .sort({ billNumber: -1 });
            
            let nextNumber = 1;
            if (lastBill && lastBill.billNumber) {
                const lastNum = parseInt(lastBill.billNumber.replace(prefix, ''));
                if (!isNaN(lastNum)) {
                    nextNumber = lastNum + 1;
                }
            }
            
            // ✅ Ensure we don't exceed 5 digits
            if (nextNumber > 99999) {
                // Reset if exceeding limit
                nextNumber = 1;
            }
            
            this.billNumber = `${prefix}${String(nextNumber).padStart(5, '0')}`;
            
            console.log('✅ Generated bill number:', this.billNumber);
            
        } catch (error) {
            console.error('Error generating bill number:', error);
            // ✅ Fallback: use timestamp
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const timestamp = Date.now().toString().slice(-6);
            this.billNumber = `BILL-${year}${month}-${timestamp}`;
        }
    }
    
    // ✅ Calculate pending amount
    this.pendingAmount = this.totalAmount - this.paidAmount;
    if (this.pendingAmount === 0) {
        this.status = 'paid';
    } else if (this.paidAmount > 0) {
        this.status = 'partial';
    } else {
        this.status = 'pending';
    }
    
    next();
});

module.exports = mongoose.model('Bill', billSchema);