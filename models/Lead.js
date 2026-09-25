const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car' },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    inquiryType: {
        type: String,
        enum: ['Request Price', 'Request Details', 'Schedule Visit'],
        default: 'Request Details'
    },
    status: {
        type: String,
        enum: ['New', 'Contacted', 'Closed'],
        default: 'New'
    },
    message: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);