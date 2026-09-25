require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Car = require('../models/Car');

const seedCars = [
    {
        make: 'Mahindra',
        model: 'Scorpio-N',
        variant: 'Z8 L 4WD',
        year: 2023,
        price: 2150000,
        mileage: 18500,
        fuelType: 'Diesel',
        transmission: 'Automatic',
        seats: 7,
        bodyType: 'SUV',
        extColor: 'Napoli Black',
        intColor: 'Coffee Black & Rich Tan',
        ownership: '1st Owner',
        rtoLocation: 'MH-02 (Mumbai)',
        isFeatured: true,
        features: {
            sunroof: true,
            alloyWheels: true,
            touchscreen: true,
            reverseCamera: true
        },
        description: 'Top-of-the-line Scorpio-N with 4WD, electric sunroof, Sony 12-speaker audio and 360-degree camera. Full company service history available.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200&q=80',
                public_id: 'autovault-cars/seed-scorpio-n'
            }
        ]
    },
    {
        make: 'Tata',
        model: 'Harrier',
        variant: 'Fearless Plus Dark Edition',
        year: 2023,
        price: 1980000,
        mileage: 14000,
        fuelType: 'Diesel',
        transmission: 'Automatic',
        seats: 5,
        bodyType: 'SUV',
        extColor: 'Oberon Black',
        intColor: 'Carnelian Red',
        ownership: '1st Owner',
        rtoLocation: 'DL-3C (Delhi)',
        isFeatured: true,
        features: {
            sunroof: true,
            alloyWheels: true,
            touchscreen: true,
            reverseCamera: true
        },
        description: 'Premium Dark Edition Harrier with panoramic sunroof, ventilated leatherette seats, and ADAS Level 2 safety suite. Accident-free.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=1200&q=80',
                public_id: 'autovault-cars/seed-harrier'
            }
        ]
    },
    {
        make: 'Tata',
        model: 'Nexon EV',
        variant: 'Empowered Plus',
        year: 2023,
        price: 1475000,
        mileage: 12500,
        fuelType: 'Electric',
        transmission: 'Automatic',
        seats: 5,
        bodyType: 'EV',
        extColor: 'Empowered Oxide',
        intColor: 'Dual-Tone Grey',
        ownership: '1st Owner',
        rtoLocation: 'KA-01 (Bengaluru)',
        isFeatured: true,
        features: {
            sunroof: true,
            alloyWheels: true,
            touchscreen: true,
            reverseCamera: true
        },
        description: '40.5 kWh battery with 465km claimed range. V2V and V2L fast charging capable. Balance 6.5 years battery warranty intact.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1200&q=80',
                public_id: 'autovault-cars/seed-nexon-ev'
            }
        ]
    },
    {
        make: 'Mahindra',
        model: 'Thar',
        variant: 'LX 4x4 Hard Top',
        year: 2022,
        price: 1420000,
        mileage: 26000,
        fuelType: 'Diesel',
        transmission: 'Manual',
        seats: 4,
        bodyType: 'SUV',
        extColor: 'Red Rage',
        intColor: 'All-Black',
        ownership: '1st Owner',
        rtoLocation: 'HR-26 (Gurugram)',
        isFeatured: true,
        features: {
            sunroof: false,
            alloyWheels: true,
            touchscreen: true,
            reverseCamera: false
        },
        description: 'Iconic Thar in Red Rage. 4x4 with low-range transfer case and mechanical locking differential. Equipped with all-terrain tyres.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=1200&q=80',
                public_id: 'autovault-cars/seed-thar'
            }
        ]
    },
    {
        make: 'Maruti Suzuki',
        model: 'Grand Vitara',
        variant: 'Alpha+ Strong Hybrid',
        year: 2023,
        price: 1680000,
        mileage: 16000,
        fuelType: 'Hybrid',
        transmission: 'Automatic',
        seats: 5,
        bodyType: 'SUV',
        extColor: 'Nexa Blue',
        intColor: 'Bordeaux & Black',
        ownership: '1st Owner',
        rtoLocation: 'TS-09 (Hyderabad)',
        isFeatured: false,
        features: {
            sunroof: true,
            alloyWheels: true,
            touchscreen: true,
            reverseCamera: true
        },
        description: 'Intelligent electric hybrid technology delivering 27.97 km/l fuel efficiency. Panoramic sunroof, HUD, 360-view camera, and wireless Apple CarPlay.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1617814076367-b75f4fd15328?w=1200&q=80',
                public_id: 'autovault-cars/seed-grand-vitara'
            }
        ]
    },
    {
        make: 'Maruti Suzuki',
        model: 'Swift',
        variant: 'ZXi Plus',
        year: 2022,
        price: 740000,
        mileage: 29000,
        fuelType: 'Petrol',
        transmission: 'Manual',
        seats: 5,
        bodyType: 'Hatchback',
        extColor: 'Solid Fire Red',
        intColor: 'Sporty Black',
        ownership: '1st Owner',
        rtoLocation: 'MH-12 (Pune)',
        isFeatured: false,
        features: {
            sunroof: false,
            alloyWheels: true,
            touchscreen: true,
            reverseCamera: true
        },
        description: 'Top-spec Swift with SmartPlay Pro touchscreen, LED projector headlamps, cruise control, and precision-cut alloy wheels.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=1200&q=80',
                public_id: 'autovault-cars/seed-swift'
            }
        ]
    }
];

async function seed() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/autovault';

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected');

        // Clear existing documents
        const deleted = await Car.deleteMany({});
        console.log(`🗑  Cleared ${deleted.deletedCount} existing car(s)`);

        // Insert fresh seed data using create() to trigger pre('save') slug hooks
        const created = await Car.create(seedCars);
        console.log(`🌱 Seeded ${created.length} car(s) successfully with SEO slugs:\n`);
        created.forEach(c => {
            console.log(`   • ${c.year} ${c.make} ${c.model} ${c.variant || ''}`);
            console.log(`     Slug: /inventory/${c.slug}`);
            console.log(`     Price: ₹${c.price.toLocaleString('en-IN')} | ID: ${c._id}\n`);
        });

        console.log('🚀 Seed complete! Start the server with: npm run dev\n');
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
