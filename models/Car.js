const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    public_id: { type: String, required: true }
}, { _id: false });

const carSchema = new mongoose.Schema({
    // Core Catalog Identity
    make: { type: String, required: true, trim: true, index: true },
    model: { type: String, required: true, trim: true, index: true },
    variant: { type: String, trim: true }, // e.g., "Z8 L 4WD"
    year: { type: Number, required: true, index: true },
    price: { type: Number, required: true, index: true },
    mileage: { type: Number, required: true, index: true },
    slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true, index: true },

    // Specifications for Filtering
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
    bodyType: {
        type: String,
        required: true,
        enum: ['SUV', 'Hatchback', 'Sedan', 'EV', 'MUV', 'Coupe', 'Convertible'],
        default: 'Sedan',
        index: true
    },
    seats: { type: Number, required: true, default: 5 },

    ownership: {
        type: String,
        enum: ['1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner'],
        default: '1st Owner'
    },
    rtoLocation: { type: String, trim: true, default: '' },

    extColor: { type: String, trim: true, default: '' },
    intColor: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },

    // Feature Highlights (Queryable for catalog UI)
    features: {
        sunroof: { type: Boolean, default: false },
        alloyWheels: { type: Boolean, default: false },
        touchscreen: { type: Boolean, default: false },
        reverseCamera: { type: Boolean, default: false }
    },

    // Catalog State Management
    status: {
        type: String,
        enum: ['Available', 'Sold'],
        default: 'Available',
        index: true
    },
    isFeatured: { type: Boolean, default: false },

    // Media
    images: [imageSchema]
}, {
    timestamps: true
});

// Text index for unified catalog search bar
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

// Virtual: primary image URL (first image or placeholder)
carSchema.virtual('primaryImage').get(function () {
    if (this.images && this.images.length > 0) {
        return this.images[0].url;
    }
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80';
});

// Virtual: formatted price for Indian Rupees
carSchema.virtual('formattedPrice').get(function () {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(this.price);
});

// Helper function to convert car attributes into URL-friendly slug
function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-') // Replace non-alphanumeric characters and whitespace with hyphens
        .replace(/^-+|-+$/g, '');   // Trim leading and trailing hyphens
}

// Generate guaranteed unique slug by checking for collisions
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

        if (!existing) {
            break;
        }

        counter++;
        slug = `${baseSlug}-${counter}`;
    }

    return slug;
}

// Generate unique SEO slug before saving
carSchema.pre('save', async function () {
    if (!this.slug || (!this.isModified('slug') && (this.isModified('make') || this.isModified('model') || this.isModified('year') || this.isModified('variant')))) {
        this.slug = await generateUniqueSlug(this);
    } else if (this.isModified('slug')) {
        this.slug = slugify(this.slug);
    }
});

carSchema.statics.slugify = slugify;

// Ensure virtuals appear in JSON payloads
carSchema.set('toJSON', { virtuals: true });
carSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Car', carSchema);