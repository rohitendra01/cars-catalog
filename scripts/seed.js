require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Car = require('../models/Car');

const seedCars = [
    {
        make: 'Mahindra',
        model: 'Scorpio-N Z8 L 4WD',
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
        rto: 'MH-02 (Mumbai)',
        isFeatured: true,
        description: 'Top-of-the-line Scorpio-N with 4WD, panoramic sunroof, and 360-degree camera. Full service history available.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200&q=80',
                public_id: 'autovault-cars/seed-scorpio-n'
            }
        ]
    },
    {
        make: 'Tata',
        model: 'Harrier Fearless Plus Dark Edition',
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
        rto: 'DL-3C (Delhi)',
        isFeatured: true,
        description: 'Premium Dark Edition Harrier with panoramic sunroof, ventilated seats, and Terrain Response Modes. Accident-free.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=1200&q=80',
                public_id: 'autovault-cars/seed-harrier'
            }
        ]
    },
    {
        make: 'Tata',
        model: 'Nexon EV Empowered Plus',
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
        rto: 'KA-01 (Bengaluru)',
        isFeatured: true,
        description: '40.5 kWh battery with 465km MIDC range. Connected car features. Fast charging capable. 1.5 years old with original warranty intact.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1200&q=80',
                public_id: 'autovault-cars/seed-nexon-ev'
            }
        ]
    },
    {
        make: 'Mahindra',
        model: 'Thar LX 4x4 Hard Top',
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
        rto: 'HR-26 (Gurugram)',
        isFeatured: true,
        description: 'Iconic Thar in Red Rage. 4x4 with low-range transfer case, rear differential lock. Perfect weekend off-road machine.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=1200&q=80',
                public_id: 'autovault-cars/seed-thar'
            }
        ]
    },
    {
        make: 'Maruti Suzuki',
        model: 'Grand Vitara Alpha+ Hybrid',
        year: 2023,
        price: 1680000,
        mileage: 16000,
        fuelType: 'Petrol',
        transmission: 'Automatic',
        seats: 5,
        bodyType: 'SUV',
        extColor: 'Nexa Blue',
        intColor: 'Bordeaux & Black',
        ownership: '1st Owner',
        rto: 'TS-09 (Hyderabad)',
        isFeatured: false,
        description: 'Strong hybrid SUV with 40km/l claimed ARAI mileage. HUD, panoramic sunroof, wireless charging. Excellent city fuel efficiency.',
        images: [
            {
                url: 'https://images.unsplash.com/photo-1617814076367-b75f4fd15328?w=1200&q=80',
                public_id: 'autovault-cars/seed-grand-vitara'
            }
        ]
    },
    {
        make: 'Maruti Suzuki',
        model: 'Swift ZXi Plus',
        year: 2022,
        price: 740000,
        mileage: 29000,
        fuelType: 'Petrol',
        transmission: 'Manual',
        seats: 5,
        bodyType: 'Hatchback',
        extColor: 'Solid Fire Red',
        intColor: 'Black',
        ownership: '1st Owner',
        rto: 'MH-12 (Pune)',
        isFeatured: false,
        description: 'Top-variant Swift with SmartPlay Pro infotainment, reverse camera, auto climate control. Excellent city commuter.',
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

        if (!process.env.MONGO_URI || process.env.MONGO_URI.includes('<user>') || process.env.MONGO_URI.includes('cluster.mongodb.net')) {
            console.log('⚠️ Warning: Placeholder MONGO_URI detected in .env. Attempting fallback or please update .env with real credentials.');
        }

        console.log(`🔌 Connecting to MongoDB...`);
        await mongoose.connect(mongoUri);
        console.log('✅ Connected');

        // Clear existing documents
        const deleted = await Car.deleteMany({});
        console.log(`🗑  Cleared ${deleted.deletedCount} existing car(s)`);

        // Insert fresh seed data
        const inserted = await Car.insertMany(seedCars);
        console.log(`🌱 Seeded ${inserted.length} car(s) successfully:\n`);
        inserted.forEach(c => console.log(`   • ${c.year} ${c.make} ${c.model} — ₹${c.price.toLocaleString('en-IN')} (ID: ${c._id})`));

        console.log('\n🚀 Seed complete! Start the server: node server.js\n');
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
