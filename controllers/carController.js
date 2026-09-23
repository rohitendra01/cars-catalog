const Car       = require('../models/Car');
const cloudinary = require('cloudinary').v2;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format a number as Indian Rupees string (e.g. ₹21,50,000)
 */
function formatPrice(price) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(price);
}

// ─── Public Route Handlers ─────────────────────────────────────────────────────

/**
 * GET /
 * Render homepage with up to 3 featured cars
 */
exports.getHomePage = async (req, res) => {
    try {
        const featuredCars = await Car.find({ isFeatured: true }).limit(3).lean();
        res.render('index', { featuredCars, formatPrice });
    } catch (err) {
        console.error('getHomePage error:', err);
        res.status(500).send('Server Error');
    }
};

/**
 * GET /inventory
 * Fetch all cars, applying optional server-side filters from query string:
 *   ?search=mahindra  &make=Mahindra  &bodyType=SUV  &fuelType=Diesel
 *   &transmission=Automatic  &maxPrice=2000000  &sort=price-asc
 */
exports.getInventory = async (req, res) => {
    try {
        const { search, make, bodyType, fuelType, transmission, maxPrice, sort } = req.query;

        // Build Mongoose filter object
        const filter = {};

        if (make)         filter.make     = { $regex: make, $options: 'i' };
        if (bodyType)     filter.bodyType = bodyType;
        if (fuelType)     filter.fuelType = fuelType;
        if (transmission) filter.transmission = transmission;
        if (maxPrice)     filter.price    = { $lte: Number(maxPrice) };

        if (search) {
            const q = { $regex: search, $options: 'i' };
            filter.$or = [
                { make: q }, { model: q }, { rto: q },
                { bodyType: q }, { description: q }
            ];
        }

        // Build sort option
        let sortOption = { createdAt: -1 };         // default: newest
        if (sort === 'price-asc')  sortOption = { price: 1 };
        if (sort === 'price-desc') sortOption = { price: -1 };
        if (sort === 'km-asc')     sortOption = { mileage: 1 };
        if (sort === 'year-desc')  sortOption = { year: -1 };

        const cars = await Car.find(filter).sort(sortOption).lean();

        res.render('inventory', { cars, formatPrice, query: req.query });
    } catch (err) {
        console.error('getInventory error:', err);
        res.status(500).send('Server Error');
    }
};

/**
 * GET /inventory/:id
 * Fetch a single car by MongoDB _id and render the detail page
 */
exports.getCarDetail = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id).lean();
        if (!car) {
            return res.status(404).render('404', { message: 'Car not found.' });
        }
        // Attach virtuals manually since .lean() strips them
        car.primaryImage = (car.images && car.images.length > 0)
            ? car.images[0].url
            : 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80';
        car.formattedPrice = formatPrice(car.price);

        res.render('car-detail', { car, formatPrice });
    } catch (err) {
        // Handle invalid ObjectId gracefully
        if (err.name === 'CastError') {
            return res.status(404).render('404', { message: 'Car not found.' });
        }
        console.error('getCarDetail error:', err);
        res.status(500).send('Server Error');
    }
};

/**
 * GET /admin/add
 * Render the legacy admin form to add a new car (kept for compatibility)
 */
exports.getAddCarForm = (req, res) => {
    res.render('admin/add-car', { error: null, success: null });
};

/**
 * POST /admin/add
 * Process the legacy admin form:
 *   1. Multer middleware has already uploaded files to Cloudinary
 *   2. Build images array from req.files
 *   3. Create and save the Car document
 *   4. Redirect to inventory on success
 */
exports.postAddCar = async (req, res) => {
    try {
        const {
            make, model, year, price, mileage,
            fuelType, transmission, seats,
            bodyType, extColor, intColor,
            ownership, rto, description, isFeatured
        } = req.body;

        // Build Cloudinary images array from uploaded files
        const images = (req.files || []).map(file => ({
            url:       file.path,              // Cloudinary secure URL
            public_id: file.filename           // Cloudinary public_id
        }));

        const newCar = new Car({
            make:         make.trim(),
            model:        model.trim(),
            year:         Number(year),
            price:        Number(price),
            mileage:      Number(mileage),
            fuelType,
            transmission,
            seats:        Number(seats) || 5,
            bodyType:     bodyType || 'Sedan',
            extColor:     extColor || '',
            intColor:     intColor || '',
            ownership:    ownership || '1st Owner',
            rto:          rto || '',
            description:  description || '',
            isFeatured:   isFeatured === 'on',
            images
        });

        await newCar.save();
        res.redirect('/inventory');
    } catch (err) {
        console.error('postAddCar error:', err);
        // On validation error, re-render the form with the error
        res.render('admin/add-car', {
            error: err.message || 'Failed to add car. Please check all required fields.',
            success: null
        });
    }
};

/**
 * POST /admin/delete/:id
 * Delete a car and its Cloudinary images (legacy route, kept for compatibility)
 */
exports.deleteCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.status(404).send('Car not found.');

        // Delete each image from Cloudinary
        for (const img of car.images) {
            await cloudinary.uploader.destroy(img.public_id);
        }

        await Car.findByIdAndDelete(req.params.id);
        res.redirect('/inventory');
    } catch (err) {
        console.error('deleteCar error:', err);
        res.status(500).send('Server Error');
    }
};

// ─── Admin Dashboard API Handlers ──────────────────────────────────────────────

/**
 * GET /admin
 * Render the new admin dashboard SPA shell
 */
exports.getAdminDashboard = (req, res) => {
    res.render('admin/dashboard');
};

/**
 * GET /admin/cars
 * JSON API — returns paginated + filtered car list.
 * Query params:
 *   ?page=1      (default 1)
 *   ?limit=20    (default 20, max 100)
 *   ?search=     (searches make, model, rto, bodyType, description)
 *   ?fuelType=   ?bodyType=   ?transmission=
 *   ?sort=newest|price-asc|price-desc|year-desc  (default newest)
 */
exports.getAdminCars = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip   = (page - 1) * limit;

        const { search, fuelType, bodyType, transmission, sort } = req.query;

        // ── Build filter ───────────────────────────────────────────────────────
        const filter = {};
        if (fuelType)     filter.fuelType     = fuelType;
        if (bodyType)     filter.bodyType     = bodyType;
        if (transmission) filter.transmission = transmission;

        if (search && search.trim()) {
            const q = { $regex: search.trim(), $options: 'i' };
            filter.$or = [
                { make: q }, { model: q }, { rto: q },
                { bodyType: q }, { description: q }
            ];
        }

        // ── Build sort ─────────────────────────────────────────────────────────
        let sortOption = { createdAt: -1 };
        if (sort === 'price-asc')  sortOption = { price:   1 };
        if (sort === 'price-desc') sortOption = { price:  -1 };
        if (sort === 'year-desc')  sortOption = { year:   -1 };

        // ── Execute queries in parallel ────────────────────────────────────────
        const [cars, total] = await Promise.all([
            Car.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
            Car.countDocuments(filter)
        ]);

        // Attach primary image virtual manually (lean() strips virtuals)
        const PLACEHOLDER = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80';
        cars.forEach(car => {
            car.primaryImage = (car.images && car.images.length > 0)
                ? car.images[0].url
                : PLACEHOLDER;
        });

        res.json({
            cars,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('getAdminCars error:', err);
        res.status(500).json({ error: 'Failed to fetch cars.', details: err.message });
    }
};

/**
 * GET /admin/cars/:id
 * JSON API — returns a single car document by ID
 */
exports.getAdminCarById = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id).lean();
        if (!car) {
            return res.status(404).json({ error: 'Car not found.' });
        }
        res.json({ car });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid car ID format.' });
        }
        console.error('getAdminCarById error:', err);
        res.status(500).json({ error: 'Failed to fetch car.', details: err.message });
    }
};

/**
 * POST /admin/cars
 * JSON API — create a new car. Multer middleware handles Cloudinary upload.
 * Body fields: make, model, year, price, mileage, fuelType, transmission,
 *              seats, bodyType, extColor, intColor, ownership, rto,
 *              description, isFeatured
 * Files: images[] (uploaded by multer-storage-cloudinary)
 */
exports.postAdminCar = async (req, res) => {
    try {
        const {
            make, model, year, price, mileage,
            fuelType, transmission, seats,
            bodyType, extColor, intColor,
            ownership, rto, description, isFeatured
        } = req.body;

        // Validate required fields explicitly for clear JSON error messages
        const missing = [];
        if (!make)     missing.push('make');
        if (!model)    missing.push('model');
        if (!year)     missing.push('year');
        if (!price)    missing.push('price');
        if (!mileage && mileage !== 0) missing.push('mileage');
        if (!fuelType) missing.push('fuelType');
        if (!transmission) missing.push('transmission');

        if (missing.length > 0) {
            return res.status(400).json({
                error: 'Validation failed — required fields missing.',
                missing
            });
        }

        // Build images array from Cloudinary-uploaded files
        const images = (req.files || []).map(file => ({
            url:       file.path,
            public_id: file.filename
        }));

        const newCar = new Car({
            make:        make.trim(),
            model:       model.trim(),
            year:        Number(year),
            price:       Number(price),
            mileage:     Number(mileage),
            fuelType,
            transmission,
            seats:       Number(seats) || 5,
            bodyType:    bodyType || 'Sedan',
            extColor:    extColor  || '',
            intColor:    intColor  || '',
            ownership:   ownership || '1st Owner',
            rto:         rto       || '',
            description: description || '',
            isFeatured:  isFeatured === 'true' || isFeatured === true || isFeatured === 'on',
            images
        });

        await newCar.save();
        res.status(201).json({ success: true, car: newCar.toJSON() });
    } catch (err) {
        console.error('postAdminCar error:', err);

        // Mongoose validation errors → 400
        if (err.name === 'ValidationError') {
            const fields = Object.keys(err.errors).map(k => ({
                field:   k,
                message: err.errors[k].message
            }));
            return res.status(400).json({ error: 'Validation failed.', fields });
        }

        res.status(500).json({ error: 'Failed to create car.', details: err.message });
    }
};

/**
 * PUT /admin/cars/:id
 * JSON API — update an existing car.
 *
 * Partial image update strategy:
 *   • req.body.imagesToDelete  — JSON array of Cloudinary public_ids to remove
 *   • req.files                — new images uploaded via Multer (Cloudinary)
 *
 * Flow:
 *   1. Destroy each public_id in imagesToDelete from Cloudinary
 *   2. Remove those entries from car.images array in MongoDB
 *   3. Append newly uploaded file(s) to car.images
 *   4. Update scalar fields and save
 */
exports.putAdminCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) {
            return res.status(404).json({ error: 'Car not found.' });
        }

        // ── Step 1 & 2: Delete removed images from Cloudinary + MongoDB ────────
        let imagesToDelete = [];
        if (req.body.imagesToDelete) {
            try {
                imagesToDelete = JSON.parse(req.body.imagesToDelete);
            } catch {
                imagesToDelete = [];
            }
        }

        if (imagesToDelete.length > 0) {
            // Destroy from Cloudinary in parallel
            await Promise.all(
                imagesToDelete.map(pid => cloudinary.uploader.destroy(pid).catch(e =>
                    console.warn(`Cloudinary destroy warning for ${pid}:`, e.message)
                ))
            );
            // Remove from car.images array
            car.images = car.images.filter(img => !imagesToDelete.includes(img.public_id));
        }

        // ── Step 3: Append newly uploaded images ───────────────────────────────
        const newImages = (req.files || []).map(file => ({
            url:       file.path,
            public_id: file.filename
        }));
        car.images.push(...newImages);

        // ── Step 4: Update scalar fields (only if provided in body) ────────────
        const fields = [
            'make','model','year','price','mileage','fuelType','transmission',
            'seats','bodyType','extColor','intColor','ownership','rto','description'
        ];
        fields.forEach(field => {
            if (req.body[field] !== undefined && req.body[field] !== '') {
                if (['year','price','mileage','seats'].includes(field)) {
                    car[field] = Number(req.body[field]);
                } else {
                    car[field] = req.body[field];
                }
            }
        });

        // Handle boolean isFeatured
        if (req.body.isFeatured !== undefined) {
            car.isFeatured = req.body.isFeatured === 'true'
                          || req.body.isFeatured === true
                          || req.body.isFeatured === 'on';
        }

        await car.save();
        res.json({ success: true, car: car.toJSON() });
    } catch (err) {
        console.error('putAdminCar error:', err);

        if (err.name === 'ValidationError') {
            const fields = Object.keys(err.errors).map(k => ({
                field:   k,
                message: err.errors[k].message
            }));
            return res.status(400).json({ error: 'Validation failed.', fields });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid car ID format.' });
        }

        res.status(500).json({ error: 'Failed to update car.', details: err.message });
    }
};

/**
 * DELETE /admin/cars/:id
 * JSON API — delete a car and ALL its associated Cloudinary images.
 * Images are destroyed in parallel to minimise latency.
 */
exports.deleteAdminCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) {
            return res.status(404).json({ error: 'Car not found.' });
        }

        // Destroy all Cloudinary images in parallel (don't let one failure block others)
        if (car.images && car.images.length > 0) {
            await Promise.all(
                car.images.map(img =>
                    cloudinary.uploader.destroy(img.public_id).catch(e =>
                        console.warn(`Cloudinary destroy warning for ${img.public_id}:`, e.message)
                    )
                )
            );
        }

        await Car.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Car and all associated media deleted.' });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid car ID format.' });
        }
        console.error('deleteAdminCar error:', err);
        res.status(500).json({ error: 'Failed to delete car.', details: err.message });
    }
};
