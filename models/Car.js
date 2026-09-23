const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    public_id: { type: String, required: true }
}, { _id: false });

const carSchema = new mongoose.Schema({
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    price: { type: Number, required: true },
    mileage: { type: Number, required: true },
    fuelType: { type: String, required: true, enum: ['Petrol', 'Diesel', 'CNG', 'Electric'] },
    transmission: { type: String, required: true, enum: ['Manual', 'Automatic'] },
    seats: { type: Number, required: true, default: 5 },

    bodyType: { type: String, enum: ['SUV', 'Hatchback', 'Sedan', 'EV', 'MUV', 'Coupe', 'Convertible'], default: 'Sedan' },
    extColor: { type: String, trim: true, default: '' },
    intColor: { type: String, trim: true, default: '' },
    ownership: { type: String, default: '1st Owner' },
    rto: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    isFeatured: { type: Boolean, default: false },

    // Cloudinary images array
    images: [imageSchema]
}, {
    timestamps: true
});

// Virtual: primary image URL (first image or placeholder)
carSchema.virtual('primaryImage').get(function () {
    if (this.images && this.images.length > 0) {
        return this.images[0].url;
    }
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80';
});

carSchema.virtual('formattedPrice').get(function () {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(this.price);
});

// Ensure virtuals appear in JSON
carSchema.set('toJSON', { virtuals: true });
carSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Car', carSchema);
