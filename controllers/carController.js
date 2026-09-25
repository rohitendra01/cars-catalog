const mongoose = require('mongoose');
const Car = require('../models/Car');
const Lead = require('../models/Lead');
const cloudinary = require('cloudinary').v2;

function formatPrice(price) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(price);
}

// ─── Public Route Handlers ─────────────────────────────────────────────────────

exports.getHomePage = async (req, res) => {
    try {
        const featuredCars = await Car.find({ isFeatured: true, status: 'Available' }).limit(3).lean();
        res.render('index', {
            featuredCars,
            formatPrice,
            isAdmin: Boolean(req.session && req.session.isAdmin),
            canonicalUrl: '/'
        });
    } catch (err) {
        console.error('getHomePage error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getInventory = async (req, res) => {
    try {
        const {
            search, make, bodyType, fuelType, transmission,
            minPrice, maxPrice, minYear, maxYear, maxMileage, shortlist,
            status, sort, page = 1, limit = 12
        } = req.query;

        const isShortlist = Object.prototype.hasOwnProperty.call(req.query, 'shortlist');
        const shortlistIds = isShortlist
            ? [...new Set((typeof shortlist === 'string' ? shortlist : '').split(',')
                .filter(id => /^[a-f\d]{24}$/i.test(id))
                .map(id => id.toLowerCase()))]
            : [];

        // Default to Available for catalog visibility
        const filter = { status: status || 'Available' };

        if (isShortlist) filter._id = { $in: shortlistIds };

        if (search && search.trim()) {
            filter.$text = { $search: search.trim() };
        }
        if (make) filter.make = new RegExp(`^${make.trim()}`, 'i');
        if (bodyType) filter.bodyType = bodyType;
        if (fuelType) filter.fuelType = fuelType;
        if (transmission) filter.transmission = transmission;

        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        const sortMap = {
            'price-asc': { price: 1 },
            'price-desc': { price: -1 },
            'km-asc': { mileage: 1 },
            'year-desc': { year: -1 },
            'newest': { createdAt: -1 }
        };
        const sortOption = sortMap[sort] || { createdAt: -1 };
        let cars;
        let total;

        if (isShortlist) {
            const foundCars = await Car.find(filter).lean();
            const carsById = new Map(foundCars.map(car => [String(car._id), car]));
            cars = shortlistIds.map(id => carsById.get(id)).filter(Boolean);
            total = cars.length;
        } else {
            const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
            [cars, total] = await Promise.all([
                Car.find(filter).sort(sortOption).skip(skip).limit(Number(limit)).lean(),
                Car.countDocuments(filter)
            ]);
        }

        res.render('inventory', {
            cars, total, currentPage: Number(page), totalPages: Math.ceil(total / limit),
            query: req.query, isShortlist, shortlistIds, formatPrice,
            isAdmin: Boolean(req.session && req.session.isAdmin),
            canonicalUrl: '/inventory'
        });
    } catch (err) {
        console.error('getInventory error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getCarDetail = async (req, res) => {
    try {
        const rawIdentifier = (req.params.slug || req.params.id || '').trim();
        if (!rawIdentifier) {
            return res.status(404).render('404', {
                message: 'Car not found.',
                isAdmin: Boolean(req.session && req.session.isAdmin)
            });
        }

        // 1. Try finding by SEO slug (case-insensitive)
        let car = await Car.findOne({ slug: rawIdentifier.toLowerCase() }).lean();

        // If found by slug but URL casing was different, 301 redirect to canonical lowercase URL
        if (car && rawIdentifier !== car.slug) {
            return res.redirect(301, `/inventory/${car.slug}`);
        }

        // 2. If not found by slug and identifier is a valid MongoDB ObjectId, check by _id
        if (!car && mongoose.Types.ObjectId.isValid(rawIdentifier)) {
            const carDoc = await Car.findById(rawIdentifier);
            if (carDoc) {
                // If car has no slug yet, save to generate one
                if (!carDoc.slug) {
                    await carDoc.save();
                }
                // 301 Permanent Redirect to SEO friendly URL
                if (carDoc.slug) {
                    return res.redirect(301, `/inventory/${carDoc.slug}`);
                }
                car = carDoc.toObject();
            }
        }

        if (!car) return res.status(404).render('404', {
            message: 'Car not found.',
            isAdmin: Boolean(req.session && req.session.isAdmin)
        });

        car.primaryImage = (car.images && car.images.length > 0) ? car.images[0].url : 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80';
        car.formattedPrice = formatPrice(car.price);
        res.render('car-detail', {
            car,
            formatPrice,
            isAdmin: Boolean(req.session && req.session.isAdmin),
            canonicalUrl: `/inventory/${car.slug || car._id}`,
            ogImage: car.primaryImage
        });
    } catch (err) {
        if (err.name === 'CastError') return res.status(404).render('404', {
            message: 'Car not found.',
            isAdmin: Boolean(req.session && req.session.isAdmin)
        });
        console.error('getCarDetail error:', err);
        res.status(500).send('Server Error');
    }
};

// ─── Legacy Admin Form Routes ─────────────────────────────────────────────

exports.getAddCarForm = (req, res) => {
    res.render('admin/add-car', { error: null, success: null });
};

exports.postAddCar = async (req, res) => {
    try {
        const {
            make, model, variant, year, price, mileage,
            fuelType, transmission, seats, bodyType,
            extColor, intColor, ownership, rtoLocation, description,
            status, isFeatured, featSunroof, featAlloyWheels, featTouchscreen, featReverseCamera
        } = req.body;

        const images = (req.files || []).map(file => ({
            url: file.path,
            public_id: file.filename
        }));

        const newCar = new Car({
            make: make.trim(), model: model.trim(), variant: variant ? variant.trim() : '',
            year: Number(year), price: Number(price), mileage: Number(mileage),
            fuelType, transmission, seats: Number(seats) || 5, bodyType: bodyType || 'Sedan',
            extColor: extColor || '', intColor: intColor || '',
            ownership: ownership || '1st Owner', rtoLocation: rtoLocation || '',
            description: description || '',
            status: status || 'Available',
            isFeatured: isFeatured === 'on',
            features: {
                sunroof: featSunroof === 'on',
                alloyWheels: featAlloyWheels === 'on',
                touchscreen: featTouchscreen === 'on',
                reverseCamera: featReverseCamera === 'on'
            },
            images
        });

        await newCar.save();
        res.redirect(`/inventory/${newCar.slug}`);
    } catch (err) {
        res.render('admin/add-car', { error: err.message, success: null });
    }
};

exports.deleteCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.status(404).send('Car not found.');
        for (const img of car.images) await cloudinary.uploader.destroy(img.public_id);
        await Car.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// ─── SPA Dashboard API Handlers ───────────────────────────────────────────
const { ADMIN_USER, ADMIN_PASS } = require('../middleware/auth');

exports.getAdminLogin = (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.redirect('/admin');
    }
    res.render('admin/login', { error: null });
};

exports.postAdminLogin = (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    res.render('admin/login', { error: 'Invalid credentials.' });
};

exports.postAdminLogout = (req, res) => {
    req.session.destroy(err => {
        res.redirect('/');
    });
};

exports.getAdminDashboard = (req, res) => {
    res.render('admin/dashboard');
};

exports.getAdminCars = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const { search, fuelType, bodyType, status, sort } = req.query;

        const filter = {};
        if (fuelType) filter.fuelType = fuelType;
        if (bodyType) filter.bodyType = bodyType;
        if (status) filter.status = status;

        if (search && search.trim()) {
            filter.$text = { $search: search.trim() };
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'price-asc') sortOption = { price: 1 };
        if (sort === 'price-desc') sortOption = { price: -1 };
        if (sort === 'year-desc') sortOption = { year: -1 };

        const [cars, total] = await Promise.all([
            Car.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
            Car.countDocuments(filter)
        ]);

        cars.forEach(car => {
            car.primaryImage = (car.images && car.images.length > 0) ? car.images[0].url : 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80';
        });

        res.json({ cars, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 } });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cars.' });
    }
};

exports.getAdminCarById = async (req, res) => {
    try {
        let car;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            car = await Car.findById(req.params.id).lean();
        }
        if (!car) {
            car = await Car.findOne({ slug: req.params.id }).lean();
        }
        if (!car) return res.status(404).json({ error: 'Car not found.' });
        res.json({ car });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch car.' });
    }
};

exports.postAdminCar = async (req, res) => {
    try {
        const {
            make, model, variant, year, price, mileage, fuelType, transmission, seats,
            bodyType, extColor, intColor, ownership, rtoLocation, description, status,
            isFeatured, featSunroof, featAlloyWheels, featTouchscreen, featReverseCamera
        } = req.body;

        if (!make || !model || !year || !price || !fuelType || !transmission) {
            return res.status(400).json({ error: 'Required fields missing.' });
        }

        const images = (req.files || []).map(file => ({ url: file.path, public_id: file.filename }));

        const newCar = new Car({
            make: make.trim(), model: model.trim(), variant: variant ? variant.trim() : '',
            year: Number(year), price: Number(price), mileage: Number(mileage),
            fuelType, transmission, seats: Number(seats) || 5, bodyType: bodyType || 'Sedan',
            extColor: extColor || '', intColor: intColor || '', ownership: ownership || '1st Owner',
            rtoLocation: rtoLocation || '', description: description || '',
            status: status || 'Available', isFeatured: isFeatured === 'true',
            features: {
                sunroof: featSunroof === 'true',
                alloyWheels: featAlloyWheels === 'true',
                touchscreen: featTouchscreen === 'true',
                reverseCamera: featReverseCamera === 'true'
            },
            images
        });

        await newCar.save();
        res.status(201).json({ success: true, car: newCar.toJSON() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.putAdminCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.status(404).json({ error: 'Car not found.' });

        let imagesToDelete = req.body.imagesToDelete ? JSON.parse(req.body.imagesToDelete) : [];
        if (imagesToDelete.length > 0) {
            await Promise.all(imagesToDelete.map(pid => cloudinary.uploader.destroy(pid).catch(() => null)));
            car.images = car.images.filter(img => !imagesToDelete.includes(img.public_id));
        }

        const newImages = (req.files || []).map(file => ({ url: file.path, public_id: file.filename }));
        car.images.push(...newImages);

        const scalarFields = ['make', 'model', 'variant', 'year', 'price', 'mileage', 'fuelType', 'transmission', 'seats', 'bodyType', 'extColor', 'intColor', 'ownership', 'rtoLocation', 'description', 'status'];
        scalarFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (['year', 'price', 'mileage', 'seats'].includes(field)) {
                    car[field] = Number(req.body[field]);
                } else {
                    car[field] = req.body[field];
                }
            }
        });

        if (req.body.isFeatured !== undefined) car.isFeatured = req.body.isFeatured === 'true';

        if (req.body.featSunroof !== undefined) car.features.sunroof = req.body.featSunroof === 'true';
        if (req.body.featAlloyWheels !== undefined) car.features.alloyWheels = req.body.featAlloyWheels === 'true';
        if (req.body.featTouchscreen !== undefined) car.features.touchscreen = req.body.featTouchscreen === 'true';
        if (req.body.featReverseCamera !== undefined) car.features.reverseCamera = req.body.featReverseCamera === 'true';

        await car.save();
        res.json({ success: true, car: car.toJSON() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteAdminCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.status(404).json({ error: 'Car not found.' });
        if (car.images) await Promise.all(car.images.map(img => cloudinary.uploader.destroy(img.public_id).catch(() => null)));
        await Car.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── SEO Sitemap & Robots ──────────────────────────────────────────────────
exports.getSitemap = async (req, res) => {
    try {
        const host = req.get('host') || 'localhost:3000';
        const protocol = req.protocol || 'http';
        const baseUrl = `${protocol}://${host}`;

        const cars = await Car.find({ status: 'Available' }).select('slug updatedAt').lean();

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        // Home
        xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

        // Inventory
        xml += `  <url>\n    <loc>${baseUrl}/inventory</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;

        // Individual Car PDPs using SEO slugs
        cars.forEach(car => {
            if (car.slug) {
                const lastmod = car.updatedAt
                    ? new Date(car.updatedAt).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0];
                xml += `  <url>\n    <loc>${baseUrl}/inventory/${car.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
            }
        });

        xml += `</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        console.error('getSitemap error:', err);
        res.status(500).send('Error generating sitemap');
    }
};

exports.getRobotsTxt = (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const robots = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /admin/*',
        `Sitemap: ${baseUrl}/sitemap.xml`
    ].join('\n');

    res.header('Content-Type', 'text/plain');
    res.send(robots);
};

// ─── Lead Submissions (Test Drives & Inquiries) ───────────────────────────
exports.postLead = async (req, res) => {
    try {
        const { carId, customerName, phone, email, inquiryType, message } = req.body;
        if (!customerName || !phone) {
            return res.status(400).json({ error: 'Customer name and phone number are required.' });
        }

        const lead = new Lead({
            carId: carId && mongoose.Types.ObjectId.isValid(carId) ? carId : undefined,
            customerName: String(customerName).trim(),
            phone: String(phone).trim(),
            email: email ? String(email).trim() : undefined,
            inquiryType: inquiryType || 'Schedule Visit',
            message: message ? String(message).trim() : ''
        });

        await lead.save();
        res.status(201).json({ success: true, message: 'Lead captured successfully.', lead });
    } catch (err) {
        console.error('postLead error:', err);
        res.status(500).json({ error: 'Failed to record lead: ' + err.message });
    }
};
