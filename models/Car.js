const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    url: { type: String, required: true, trim: true },
    public_id: { type: String, default: '' }
}, { _id: false });

const carSchema = new mongoose.Schema({
    make: { type: String, required: true, trim: true, index: true },
    model: { type: String, required: true, trim: true, index: true },
    variant: { type: String, trim: true, default: '' },
    year: { type: Number, required: true, index: true },
    manufacturedDate: { type: Date, default: null },
    referenceId: { type: String, trim: true, uppercase: true, unique: true, sparse: true, index: true },
    slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true, index: true },

    // Keep price as the exact INR amount. priceInLakhs is a presentation virtual.
    price: { type: Number, required: true, index: true, min: 1 },
    mileage: { type: Number, required: true, index: true, min: 0 },
    fuelType: {
        type: String,
        required: true,
        enum: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'],
        index: true
    },
    transmission: {
        type: String,
        required: true,
        enum: ['Manual', 'Automatic'],
        index: true
    },
    seats: { type: Number, required: true, default: 5, min: 2, max: 12 },
    ownership: {
        type: String,
        enum: ['1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner'],
        default: '1st Owner'
    },

    engine: { type: String, trim: true, default: '' },
    bodyType: {
        type: String,
        enum: ['SUV', 'Hatchback', 'Sedan', 'EV', 'MUV', 'Coupe', 'Convertible'],
        default: 'Sedan',
        index: true
    },
    extColor: { type: String, trim: true, default: '' },
    intColor: { type: String, trim: true, default: '' },
    registrationState: { type: String, trim: true, default: '' },
    rtoLocation: { type: String, trim: true, default: '' },
    insuranceType: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },

    // Canonical, free-form equipment list. `features` remains for compatibility
    // with existing listings and the current admin feature toggles.
    equipment: [{ type: String, trim: true }],
    features: {
        sunroof: { type: Boolean, default: false },
        alloyWheels: { type: Boolean, default: false },
        touchscreen: { type: Boolean, default: false },
        reverseCamera: { type: Boolean, default: false }
    },

    status: {
        type: String,
        enum: ['Available', 'Sold'],
        default: 'Available',
        index: true
    },
    isFeatured: { type: Boolean, default: false },
    images: [imageSchema]
}, {
    timestamps: true
});

carSchema.index({
    make: 'text',
    model: 'text',
    variant: 'text',
    rtoLocation: 'text',
    description: 'text'
}, {
    weights: { make: 5, model: 4, variant: 3, rtoLocation: 2, description: 1 },
    name: 'CatalogTextIndex'
});

carSchema.virtual('odometer').get(function () {
    return this.mileage;
}).set(function (value) {
    this.mileage = value;
});

carSchema.virtual('imageUrls').get(function () {
    return (this.images || []).map(image => typeof image === 'string' ? image : image.url).filter(Boolean);
});

carSchema.virtual('primaryImage').get(function () {
    if (this.images && this.images.length > 0) {
        const image = this.images[0];
        return typeof image === 'string' ? image : image.url;
    }
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80';
});

carSchema.virtual('priceInLakhs').get(function () {
    return Number(this.price || 0) / 100000;
});

carSchema.virtual('formattedPrice').get(function () {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(this.price);
});

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(doc) {
    const raw = [doc.year, doc.make, doc.model, doc.variant]
        .filter(Boolean)
        .join(' ');
    const baseSlug = slugify(raw) || 'car';
    let slug = baseSlug;
    let counter = 1;

    const Model = doc.constructor;
    while (true) {
        const existing = await Model.findOne({
            slug,
            _id: { $ne: doc._id }
        }).select('_id').lean();

        if (!existing) break;
        counter++;
        slug = `${baseSlug}-${counter}`;
    }

    return slug;
}

carSchema.pre('save', async function () {
    if (!this.referenceId) {
        this.referenceId = `AC${this._id.toString().slice(-8).toUpperCase()}`;
    }

    if (!this.slug || (!this.isModified('slug') && (this.isModified('make') || this.isModified('model') || this.isModified('year') || this.isModified('variant')))) {
        this.slug = await generateUniqueSlug(this);
    } else if (this.isModified('slug')) {
        this.slug = slugify(this.slug);
    }
});

carSchema.statics.slugify = slugify;

carSchema.set('toJSON', { virtuals: true });
carSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Car', carSchema);
