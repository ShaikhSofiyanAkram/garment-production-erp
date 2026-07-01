const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
    {
        assignmentId: {
            type: String,
            unique: true
        },

        // किस cutting से assignment आया
        cutting: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Cutting',
            required: true
        },

        // किस worker/karigar को दिया
        karigar: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Worker',
            required: true
        },

        // Product reference
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },

        // Product details
        productName: {
            type: String,
            required: true,
            trim: true
        },

        productCategory: {
            type: String,
            required: true,
            trim: true
        },

        // Sizes data
        sizes: [
            {
                size: {
                    type: String,
                    required: true
                },

                pieces: {
                    type: Number,
                    required: true,
                    min: 0
                }
            }
        ],

        // Total pieces given to karigar
        givenPieces: {
            type: Number,
            required: true,
            min: 0
        },

        // Returned finished pieces
        returnedPieces: {
            type: Number,
            default: 0,
            min: 0
        },

        // Damaged pieces
        damagedPieces: {
            type: Number,
            default: 0,
            min: 0
        },

        // Missing/lost pieces
        missingPieces: {
            type: Number,
            default: 0,
            min: 0
        },

        // Assignment status
        status: {
            type: String,
            enum: ['pending', 'partial', 'completed'],
            default: 'pending'
        },

        // Dates
        assignedDate: {
            type: Date,
            default: Date.now
        },

        completedAt: {
            type: Date
        },

        dueDate: {
            type: Date
        },

        // Extra note
        remark: {
            type: String,
            trim: true
        },

        // Soft delete / archive
        isArchived: {
            type: Boolean,
            default: false
        },

        // कौन user ने create किया
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }

    },
    {
        timestamps: true
    }
);


// Auto Generate Assignment ID
assignmentSchema.pre('save', async function (next) {
    try {
        // Generate assignmentId only once
        if (!this.assignmentId) {
            const count = await mongoose.model('Assignment').countDocuments();

            this.assignmentId = `ASN-${String(count + 1).padStart(4, '0')}`;
        }

        // Set completedAt automatically
        if (this.status === 'completed' && !this.completedAt) {
            this.completedAt = new Date();
        }

        next();
    }
    catch (error) {
        next(error);
    }
});


module.exports = mongoose.model('Assignment', assignmentSchema);