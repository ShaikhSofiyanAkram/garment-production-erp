const mongoose = require('mongoose');

const fabricSchema = new mongoose.Schema({
    fabricType: {
        type: String,
        required: true,
        trim: true
    },
    totalMeters: {
        type: Number,
        required: true,
        min: 0
    },
    remark: {
        type: String,
        default: ''
    },
    date: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Fabric', fabricSchema);












// const mongoose = require('mongoose');

// const fabricSchema = new mongoose.Schema({
//   fabricType: {
//     type: String,
//     required: true
//   },
//   fabricName: {
//     type: String,
//     required: true
//   },
//   items: [{
//     itemName: String,
//     metersPerItem: Number,
//     quantity: Number,
//     totalMeters: Number
//   }],
//   totalMeters: {
//     type: Number,
//     required: true
//   },
//   remark: String,
//   entryDate: {
//     type: Date,
//     default: Date.now
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }
// });

// module.exports = mongoose.model('Fabric', fabricSchema);