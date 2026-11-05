require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Car = require('../models/Car');

// Demo listings use stable reference IDs so this script can be run repeatedly.
// It only inserts missing demo records and never deletes or overwrites listings.
// Images are intentionally omitted so they can be added through the admin form.
const seedCars = [
    {
        referenceId: 'DEMO-IND-001',
        make: 'Hyundai', model: 'Creta', variant: 'SX (O) IVT', year: 2022,
        price: 1540000, market_value: 1640000, mileage: 32500,
        fuelType: 'Petrol', transmission: 'Automatic', seats: 5, bodyType: 'SUV',
        extColor: 'Phantom Black', intColor: 'Black', ownership: '1st Owner',
        rtoLocation: 'MP-20 (Jabalpur)', isFeatured: true,
        description: 'Well-kept Creta with panoramic sunroof, touchscreen infotainment and rear camera.',
        equipment: ['Panoramic sunroof', 'Rear parking camera', 'Alloy wheels'],
        features: { sunroof: true, alloyWheels: true, touchscreen: true, reverseCamera: true }
    },
    {
        referenceId: 'DEMO-IND-002',
        make: 'Kia', model: 'Seltos', variant: 'GTX Plus 1.5 Diesel AT', year: 2021,
        price: 1480000, mileage: 42800, fuelType: 'Diesel', transmission: 'Automatic',
        seats: 5, bodyType: 'SUV', extColor: 'Gravity Grey', intColor: 'Black',
        ownership: '1st Owner', rtoLocation: 'MH-12 (Pune)',
        description: 'Seltos with automatic transmission, ventilated front seats and a panoramic sunroof.',
        equipment: ['Ventilated front seats', 'Sunroof', 'Alloy wheels'],
        features: { sunroof: true, alloyWheels: true, touchscreen: true, reverseCamera: true }
    },
    {
        referenceId: 'DEMO-IND-003',
        make: 'Maruti Suzuki', model: 'Baleno', variant: 'Alpha', year: 2023,
        price: 875000, market_value: 910000, mileage: 18200, fuelType: 'Petrol',
        transmission: 'Manual', seats: 5, bodyType: 'Hatchback', extColor: 'Nexa Blue',
        intColor: 'Black and Blue', ownership: '1st Owner', rtoLocation: 'DL-8C (Delhi)',
        isFeatured: true,
        description: 'Top-trim Baleno with touchscreen infotainment, rear camera and connected features.',
        equipment: ['Touchscreen infotainment', 'Rear parking camera'],
        features: { alloyWheels: true, touchscreen: true, reverseCamera: true }
    },
    {
        referenceId: 'DEMO-IND-004',
        make: 'Honda', model: 'City', variant: 'VX CVT', year: 2020,
        price: 1165000, mileage: 48100, fuelType: 'Petrol', transmission: 'Automatic',
        seats: 5, bodyType: 'Sedan', extColor: 'Radiant Red', intColor: 'Beige',
        ownership: '2nd Owner', rtoLocation: 'KA-03 (Bengaluru)',
        description: 'Comfortable City sedan with automatic transmission, sunroof and Honda Sensing features.',
        equipment: ['Sunroof', 'Cruise control', 'Rear camera'],
        features: { sunroof: true, touchscreen: true, reverseCamera: true }
    },
    {
        referenceId: 'DEMO-IND-005',
        make: 'Toyota', model: 'Innova Crysta', variant: 'ZX 2.4 Diesel', year: 2019,
        price: 1790000, mileage: 69200, fuelType: 'Diesel', transmission: 'Manual',
        seats: 7, bodyType: 'MUV', extColor: 'Silver', intColor: 'Black',
        ownership: '1st Owner', rtoLocation: 'UP-16 (Noida)',
        description: 'Seven-seat Innova Crysta with a spacious cabin and a full service record.',
        equipment: ['Alloy wheels', 'Rear parking camera'],
        features: { alloyWheels: true, touchscreen: true, reverseCamera: true }
    },
    {
        referenceId: 'DEMO-IND-006',
        make: 'Tata', model: 'Punch', variant: 'Creative AMT', year: 2022,
        price: 810000, mileage: 26700, fuelType: 'Petrol', transmission: 'Automatic',
        seats: 5, bodyType: 'SUV', extColor: 'Atomic Orange', intColor: 'Black',
        ownership: '1st Owner', rtoLocation: 'RJ-14 (Jaipur)', isFeatured: true,
        description: 'Compact Punch with automatic transmission, touchscreen and rear camera.',
        equipment: ['Touchscreen infotainment', 'Rear parking camera'],
        features: { alloyWheels: true, touchscreen: true, reverseCamera: true }
    },
    {
        referenceId: 'DEMO-IND-007',
        make: 'Mahindra', model: 'XUV700', variant: 'AX7 Diesel AT', year: 2023,
        price: 2120000, market_value: 2240000, mileage: 22100, fuelType: 'Diesel',
        transmission: 'Automatic', seats: 7, bodyType: 'SUV', extColor: 'Everest White',
        intColor: 'Coffee Black', ownership: '1st Owner', rtoLocation: 'HR-26 (Gurugram)',
        description: 'Seven-seat XUV700 with panoramic sunroof, ADAS and dual-screen infotainment.',
        equipment: ['Panoramic sunroof', 'ADAS', 'Alloy wheels'],
        features: { sunroof: true, alloyWheels: true, touchscreen: true, reverseCamera: true }
    },
    {
        referenceId: 'DEMO-IND-008',
        make: 'Skoda', model: 'Slavia', variant: 'Style 1.0 TSI', year: 2022,
        price: 1325000, mileage: 30900, fuelType: 'Petrol', transmission: 'Manual',
        seats: 5, bodyType: 'Sedan', extColor: 'Crystal Blue', intColor: 'Black',
        ownership: '1st Owner', rtoLocation: 'TS-09 (Hyderabad)',
        description: 'Slavia sedan with turbo-petrol engine, sunroof and touchscreen infotainment.',
        equipment: ['Sunroof', 'Touchscreen infotainment', 'Alloy wheels'],
        features: { sunroof: true, alloyWheels: true, touchscreen: true, reverseCamera: true }
    },
    {
        referenceId: 'DEMO-IND-009',
        make: 'Renault', model: 'Kwid', variant: 'RXT', year: 2021,
        mileage: 38400, fuelType: 'Petrol', transmission: 'Manual', seats: 5,
        bodyType: 'Hatchback', extColor: 'Zanskar Blue', ownership: '2nd Owner',
        rtoLocation: 'GJ-01 (Ahmedabad)',
        description: 'Compact city hatchback with touchscreen infotainment and a practical cabin.',
        equipment: ['Touchscreen infotainment'],
        features: { touchscreen: true }
    },
    {
        referenceId: 'DEMO-IND-010',
        make: 'MG', model: 'ZS EV', variant: 'Exclusive', year: 2022,
        price: 1890000, market_value: 1980000, mileage: 21500, fuelType: 'Electric',
        transmission: 'Automatic', seats: 5, bodyType: 'SUV', extColor: 'Starry Black',
        intColor: 'Black', ownership: '1st Owner', rtoLocation: 'MH-02 (Mumbai)',
        description: 'Electric SUV with panoramic sunroof, connected features and fast charging support.',
        equipment: ['Panoramic sunroof', 'Alloy wheels', 'Rear parking camera'],
        features: { sunroof: true, alloyWheels: true, touchscreen: true, reverseCamera: true }
    }
];

async function seed() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/autovault';
    let inserted = 0;
    let skipped = 0;

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);

        for (const data of seedCars) {
            const existing = await Car.findOne({ referenceId: data.referenceId }).select('_id').lean();
            if (existing) {
                skipped += 1;
                continue;
            }

            const car = await Car.create(data);
            inserted += 1;
            console.log(`Added ${car.year} ${car.make} ${car.model} (${car.referenceId})`);
        }

        console.log(`Seed complete: ${inserted} added, ${skipped} already existed. No image records were added.`);
    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seed();
