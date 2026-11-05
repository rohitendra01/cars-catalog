const mongoose = require('mongoose');
const Car = require('../models/Car');
const Lead = require('../models/Lead');
const cloudinary = require('cloudinary').v2;
const { calculateCroPricing } = require('../utils/croPricing');
const { GOOGLE_PLACE_ID } = require('../utils/googlePlace');
const { logError, logWarning } = require('../utils/logger');

function formatPrice(price) {
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) return '';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

function hasListedPrice(car) {
    return Number.isFinite(Number(car && car.price)) && Number(car.price) > 0;
}

function parseEquipment(value) {
    const values = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(values.flatMap(item => String(item).split(/[,;\n]+/)).map(item => item.trim()).filter(Boolean))];
}

function queryText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function positiveInteger(value, fallback, maximum) {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
    return Math.min(maximum, Math.max(1, Number(value)));
}

function numericQuery(value) {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function getPublicBaseUrl(req) {
    const configuredBaseUrl = process.env.PUBLIC_BASE_URL;
    if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');
    return `${req.protocol || 'http'}://${req.get('host') || 'localhost:3000'}`;
}

// ─── Public Route Handlers ─────────────────────────────────────────────────────

exports.getHomePage = async (req, res) => {
    try {
        const featuredCars = await Car.find({ isFeatured: true, status: 'Available', reservation_status: { $ne: 'Reserved' } }).limit(3).lean();
        featuredCars.forEach(car => { car.croPricing = hasListedPrice(car) ? calculateCroPricing(car) : null; });
        res.render('index', {
            featuredCars,
            formatPrice,
            googlePlaceId: GOOGLE_PLACE_ID,
            isAdmin: Boolean(req.session && req.session.isAdmin),
            canonicalUrl: `${getPublicBaseUrl(req)}/`
        });
    } catch (err) {
        logError('page.home.failed', err, req);
        res.status(500).send('Server Error');
    }
};

exports.getCarPricing = async (req, res) => {
    try {
        if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
            return res.status(400).json({ error: 'Invalid vehicle id.' });
        }
        const car = await Car.findById(req.params.id).select('price market_value status reservation_status').lean();
        if (!car) return res.status(404).json({ error: 'Vehicle not found.' });
        res.set('Cache-Control', 'no-store');
        if (!Number.isFinite(Number(car.price)) || Number(car.price) <= 0) {
            return res.status(404).json({ error: 'Pricing is not available for this vehicle.' });
        }
        res.json(calculateCroPricing(car));
    } catch (err) {
        logError('api.car_pricing.failed', err, req);
        res.status(500).json({ error: 'Failed to calculate vehicle pricing.' });
    }
};

exports.getInventory = async (req, res) => {
    try {
        const {
            search, make, bodyType, fuelType, transmission,
            minPrice, maxPrice, minYear, maxYear, maxMileage, minSeats, shortlist, sort
        } = req.query;

        const isShortlist = Object.prototype.hasOwnProperty.call(req.query, 'shortlist');
        const shortlistIds = isShortlist
            ? [...new Set((typeof shortlist === 'string' ? shortlist : '').split(',')
                .filter(id => /^[a-f\d]{24}$/i.test(id))
                .map(id => id.toLowerCase()))]
            : [];

        const filter = { status: 'Available', reservation_status: { $ne: 'Reserved' } };

        if (isShortlist) filter._id = { $in: shortlistIds };

        const searchTerm = queryText(search).slice(0, 100);
        if (searchTerm.length >= 3) {
            const regex = new RegExp(escapeRegex(searchTerm), 'i');
            filter.$or = [
                { make: regex },
                { model: regex },
                { variant: regex },
                { bodyType: regex },
                { fuelType: regex }
            ];
        }
        const makeTerm = queryText(make).slice(0, 60);
        if (makeTerm) filter.make = new RegExp(`^${escapeRegex(makeTerm)}`, 'i');
        if (['SUV', 'Hatchback', 'Sedan', 'Mini Van', 'MUV', 'Coupe', 'Convertible'].includes(bodyType)) filter.bodyType = bodyType;
        if (['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'].includes(fuelType)) filter.fuelType = fuelType;
        if (['Manual', 'Automatic'].includes(transmission)) filter.transmission = transmission;

        const priceRange = {};
        const minimumPrice = numericQuery(minPrice);
        const maximumPrice = numericQuery(maxPrice);
        if (minimumPrice !== null && minimumPrice >= 0) priceRange.$gte = minimumPrice;
        if (maximumPrice !== null && maximumPrice >= 0) priceRange.$lte = maximumPrice;
        if (Object.keys(priceRange).length) filter.price = priceRange;

        const yearRange = {};
        const minimumYear = numericQuery(minYear);
        const maximumYear = numericQuery(maxYear);
        if (minimumYear !== null && minimumYear >= 1900) yearRange.$gte = minimumYear;
        if (maximumYear !== null && maximumYear >= 1900) yearRange.$lte = maximumYear;
        if (Object.keys(yearRange).length) filter.year = yearRange;

        const mileageLimit = numericQuery(maxMileage);
        if (mileageLimit !== null && mileageLimit >= 0) filter.mileage = { $lte: mileageLimit };
        const minimumSeats = numericQuery(minSeats);
        if (minimumSeats !== null && minimumSeats >= 2 && minimumSeats <= 12) filter.seats = { $gte: minimumSeats };

        const sortMap = {
            'price-asc': { price: 1 },
            'price-desc': { price: -1 },
            'km-asc': { mileage: 1 },
            'year-desc': { year: -1 },
            'newest': { createdAt: -1 }
        };
        const sortOption = sortMap[queryText(sort)] || { createdAt: -1 };
        let cars;
        let total;
        const limit = positiveInteger(req.query.limit, 12, 48);
        const requestedPage = positiveInteger(req.query.page, 1, 1000000);
        let currentPage = requestedPage;
        let totalPages;

        if (isShortlist) {
            const foundCars = await Car.find(filter).lean();
            const carsById = new Map(foundCars.map(car => [String(car._id), car]));
            cars = shortlistIds.map(id => carsById.get(id)).filter(Boolean);
            total = cars.length;
            totalPages = total ? 1 : 0;
            currentPage = 1;
        } else {
            total = await Car.countDocuments(filter);
            totalPages = Math.ceil(total / limit);
            currentPage = totalPages ? Math.min(requestedPage, totalPages) : 1;
            const skip = (currentPage - 1) * limit;
            cars = await Car.find(filter).sort(sortOption).skip(skip).limit(limit).lean();
        }

        cars.forEach(car => { car.croPricing = hasListedPrice(car) ? calculateCroPricing(car) : null; });
        res.render('inventory', {
            cars, total, currentPage, totalPages,
            query: req.query, isShortlist, shortlistIds, formatPrice,
            isAdmin: Boolean(req.session && req.session.isAdmin),
            canonicalUrl: `${getPublicBaseUrl(req)}/inventory`
        });
    } catch (err) {
        logError('page.inventory.failed', err, req);
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

        const similarityFilters = [];
        if (car.make) similarityFilters.push({ make: car.make });
        if (car.bodyType) similarityFilters.push({ bodyType: car.bodyType });
        const similarBaseFilter = {
            _id: { $ne: car._id },
            status: 'Available',
            reservation_status: { $ne: 'Reserved' },
            ...(similarityFilters.length ? { $or: similarityFilters } : {})
        };
        let similarCars = await Car.find(similarBaseFilter)
            .sort({ isFeatured: -1, createdAt: -1 })
            .limit(4)
            .lean();
        if (!similarCars.length) {
            similarCars = await Car.find({ _id: { $ne: car._id }, status: 'Available', reservation_status: { $ne: 'Reserved' } })
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(4)
                .lean();
        }

        car.primaryImage = (car.images && car.images.length > 0) ? car.images[0].url : `${getPublicBaseUrl(req)}/pictures/hero1.jpeg`;
        const hasPrice = Number.isFinite(Number(car.price)) && Number(car.price) > 0;
        car.croPricing = hasPrice ? calculateCroPricing(car) : null;
        car.formattedPrice = hasPrice ? formatPrice(car.croPricing.current_price) : '';
        similarCars.forEach(similarCar => {
            similarCar.croPricing = Number.isFinite(Number(similarCar.price)) && Number(similarCar.price) > 0
                ? calculateCroPricing(similarCar)
                : null;
        });
        res.render('car-detail', {
            car,
            similarCars,
            formatPrice,
            isAdmin: Boolean(req.session && req.session.isAdmin),
            canonicalUrl: `${getPublicBaseUrl(req)}/inventory/${car.slug || car._id}`,
            absoluteCarUrl: `${getPublicBaseUrl(req)}/inventory/${car.slug || car._id}`,
            ogImage: car.primaryImage
        });
    } catch (err) {
        if (err.name === 'CastError') return res.status(404).render('404', {
            message: 'Car not found.',
            isAdmin: Boolean(req.session && req.session.isAdmin)
        });
        logError('page.car_detail.failed', err, req);
        res.status(500).send('Server Error');
    }
};

// ─── SPA Dashboard API Handlers ───────────────────────────────────────────
const {
    validateCredentials,
    createAdminSessionToken,
    activateAdminSession,
    isCurrentAdminSession,
    revokeAdminSession,
    getLoginRateLimit,
    recordFailedLogin,
    clearFailedLoginAttempts,
    destroyStaleSession
} = require('../middleware/auth');

exports.getAdminLogin = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        if (await isCurrentAdminSession(req)) {
            return res.redirect('/admin');
        }
    } catch (err) {
        logError('admin.login.session_check_failed', err, req);
        return res.status(503).send('Admin authentication is temporarily unavailable.');
    }

    if (req.session && req.session.isAdmin) {
        return destroyStaleSession(req, res, () => res.render('admin/login', { error: null }));
    }

    res.render('admin/login', { error: null });
};

exports.postAdminLogin = async (req, res) => {
    const { username, password } = req.body;
    res.set('Cache-Control', 'no-store');

    const rateLimit = getLoginRateLimit(req);
    if (rateLimit.limited) {
        logWarning('admin.login.rate_limited', 'Admin sign-in attempts exceeded the configured limit.', req);
        res.set('Retry-After', String(rateLimit.retryAfterSeconds));
        return res.status(429).render('admin/login', {
            error: 'Too many unsuccessful sign-in attempts. Please try again later.'
        });
    }

    if (!validateCredentials(username, password)) {
        logWarning('admin.login.invalid_credentials', 'Admin sign-in credentials were rejected.', req);
        recordFailedLogin(req);
        return res.render('admin/login', { error: 'Invalid credentials.' });
    }

    try {
        clearFailedLoginAttempts(req);

        // Rotate the session id and privilege token before granting admin access.
        await new Promise((resolve, reject) => {
            req.session.regenerate(err => err ? reject(err) : resolve());
        });
        const adminSessionToken = createAdminSessionToken();
        req.session.isAdmin = true;
        req.session.adminSessionToken = adminSessionToken;
        req.session.loginAt = Date.now();

        await new Promise((resolve, reject) => {
            req.session.save(err => err ? reject(err) : resolve());
        });

        // One atomic MongoDB document update selects the only valid admin session.
        // Requests from the previous device fail the active-token check immediately.
        await activateAdminSession(adminSessionToken);
        return res.redirect('/admin');
    } catch (err) {
        logError('admin.login.session_setup_failed', err, req);
        if (!req.session) {
            return res.status(503).render('admin/login', { error: 'Login failed. Please try again.' });
        }
        req.session.destroy(destroyErr => {
            if (destroyErr) logError('admin.login.session_cleanup_failed', destroyErr, req);
            res.clearCookie('av.sid', {
                path: '/',
                httpOnly: true,
                sameSite: 'strict',
                secure: process.env.NODE_ENV === 'production'
            });
            return res.status(503).render('admin/login', { error: 'Login failed. Please try again.' });
        });
    }
};

exports.postAdminLogout = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        // A stale device must not revoke a newer device's active session.
        await revokeAdminSession(req.session && req.session.adminSessionToken);
    } catch (err) {
        logError('admin.logout.session_revocation_failed', err, req);
    }

    if (!req.session) {
        res.clearCookie('av.sid', { path: '/' });
        return res.redirect('/');
    }

    req.session.destroy(err => {
        if (err) logError('admin.logout.session_destroy_failed', err, req);
        res.clearCookie('av.sid', {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production'
        });
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

        const searchTerm = queryText(search).slice(0, 100);
        if (searchTerm.length >= 3) {
            const regex = new RegExp(escapeRegex(searchTerm), 'i');
            filter.$or = [
                { make: regex },
                { model: regex },
                { variant: regex },
                { bodyType: regex },
                { fuelType: regex }
            ];
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
            car.primaryImage = (car.images && car.images.length > 0) ? car.images[0].url : '';
        });

        res.json({ cars, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 } });
    } catch (err) {
        logError('admin.cars.list_failed', err, req);
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
        logError('admin.car.load_failed', err, req);
        res.status(500).json({ error: 'Failed to fetch car.' });
    }
};

const carFieldLabels = {
    make: 'car name', model: 'model', variant: 'variant', year: 'year of manufacture', price: 'price',
    mileage: 'mileage', fuelType: 'fuel type', transmission: 'transmission', seats: 'seating capacity',
    bodyType: 'body type', ownership: 'ownership', status: 'listing status', reservation_status: 'reservation status',
    manufacturedDate: 'manufactured date', referenceId: 'reference ID', market_value: 'market value'
};

function validationMessage(error) {
    const field = error.path || 'car details';
    const label = carFieldLabels[field] || 'car details';
    if (error.kind === 'required') return 'Please enter or choose the ' + label + '.';
    if (error.kind === 'enum') return 'Please choose a valid ' + label + '.';
    if (error.kind === 'min') return 'The ' + label + ' is below the allowed value.';
    if (error.kind === 'max') return 'The ' + label + ' is above the allowed value.';
    if (error.name === 'CastError') return 'Please enter a valid ' + label + '.';
    return 'Please check the ' + label + '.';
}

function sendCarSaveError(res, err, action, req) {
    logError('admin.car.save_failed', err, req, { action });
    if (err.code === 11000 && (err.keyPattern && err.keyPattern.referenceId || err.keyValue && err.keyValue.referenceId)) {
        return res.status(409).json({ error: 'That reference ID is already in use. Please enter a different one.' });
    }
    if (err.name === 'ValidationError' || err.name === 'CastError') {
        const errors = err.name === 'ValidationError' ? Object.values(err.errors) : [err];
        const fields = errors.map(error => ({ field: error.path || '', message: validationMessage(error) }));
        return res.status(400).json({ error: 'Please check the car details and try again.', fields });
    }
    return res.status(500).json({ error: 'We could not ' + action + ' right now. Please try again later.' });
}

async function removeUploadedImages(files, req) {
    await Promise.all((files || []).map(file => file.filename
        ? cloudinary.uploader.destroy(file.filename).catch(err => logWarning('admin.car.upload_cleanup_failed', err.message, req, { assetId: file.filename }))
        : Promise.resolve()));
}

exports.postAdminCar = async (req, res) => {
    let saved = false;
    try {
        const { make, model, variant, year, price, mileage, fuelType, transmission, seats,
            bodyType, extColor, intColor, ownership, rtoLocation, description, status,
            manufacturedDate, referenceId, engine, registrationState, insuranceType, equipment,
            isFeatured, featSunroof, featAlloyWheels, featTouchscreen, featReverseCamera } = req.body;

        const required = [
            ['make', make], ['model', model], ['year', year]
        ];
        const missing = required.filter(([, value]) => value == null || String(value).trim() === '');
        if (missing.length) {
            await removeUploadedImages(req.files, req);
            return res.status(400).json({
                error: 'Please complete the required car details.',
                fields: missing.map(([field]) => ({ field, message: 'Please enter or choose the ' + carFieldLabels[field] + '.' }))
            });
        }

        const images = (req.files || []).map(file => ({ url: file.path, public_id: file.filename }));
        const newCar = new Car({
            make: make.trim(), model: model.trim(), variant: variant ? variant.trim() : '',
            year: Number(year),
            price: price == null || String(price).trim() === '' ? undefined : Number(price),
            mileage: mileage == null || String(mileage).trim() === '' ? undefined : Number(mileage),
            manufacturedDate: manufacturedDate ? new Date(manufacturedDate) : undefined,
            referenceId: referenceId ? referenceId.trim() : undefined,
            fuelType: fuelType || undefined, transmission: transmission || undefined,
            seats: Number(seats) || 5, bodyType: bodyType || 'Sedan',
            engine: engine || '', registrationState: registrationState || '', insuranceType: insuranceType || '',
            extColor: extColor || '', intColor: intColor || '', ownership: ownership || '1st Owner',
            rtoLocation: rtoLocation || '', description: description || '', equipment: parseEquipment(equipment),
            status: status || 'Available', isFeatured: isFeatured === 'true',
            market_value: Number(req.body.market_value) || 0,
            discount_tag: req.body.discount_tag || '',
            reservation_status: req.body.reservation_status || '',
            features: {
                sunroof: featSunroof === 'true', alloyWheels: featAlloyWheels === 'true',
                touchscreen: featTouchscreen === 'true', reverseCamera: featReverseCamera === 'true'
            },
            images
        });
        await newCar.save();
        saved = true;
        res.status(201).json({ success: true, car: newCar.toJSON() });
    } catch (err) {
        if (!saved) await removeUploadedImages(req.files, req);
        return sendCarSaveError(res, err, 'save this car', req);
    }
};

exports.putAdminCar = async (req, res) => {
    let saved = false;
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            await removeUploadedImages(req.files, req);
            return res.status(404).json({ error: 'This car listing could not be found.' });
        }
        const car = await Car.findById(req.params.id);
        if (!car) {
            await removeUploadedImages(req.files, req);
            return res.status(404).json({ error: 'This car listing could not be found.' });
        }

        let imagesToDelete = [];
        if (req.body.imagesToDelete) {
            try {
                imagesToDelete = JSON.parse(req.body.imagesToDelete);
            } catch (err) {
                logWarning('admin.car.invalid_image_selection', err.message, req);
                await removeUploadedImages(req.files, req);
                return res.status(400).json({ error: 'Please refresh the listing and try selecting its images again.' });
            }
            if (!Array.isArray(imagesToDelete) || imagesToDelete.some(id => typeof id !== 'string')) {
                await removeUploadedImages(req.files, req);
                return res.status(400).json({ error: 'Please refresh the listing and try selecting its images again.' });
            }
        }

        const currentImages = car.images || [];
        const selectedIds = new Set(imagesToDelete);
        const removedImages = currentImages.filter(image => selectedIds.has(image.public_id));
        const retainedImages = currentImages.filter(image => !selectedIds.has(image.public_id));
        const newImages = (req.files || []).map(file => ({ url: file.path, public_id: file.filename }));
        if (newImages.length && retainedImages.length + newImages.length > 10) {
            await removeUploadedImages(req.files, req);
            return res.status(400).json({ error: 'A car can have up to 10 images. Remove an image before adding another.' });
        }
        car.images = retainedImages.concat(newImages);

        const scalarFields = ['make', 'model', 'variant', 'year', 'price', 'mileage', 'manufacturedDate', 'referenceId', 'engine', 'fuelType', 'transmission', 'seats', 'bodyType', 'extColor', 'intColor', 'ownership', 'registrationState', 'rtoLocation', 'insuranceType', 'description', 'status', 'discount_tag', 'reservation_status'];
        scalarFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (['year', 'price', 'mileage', 'seats'].includes(field)) {
                    const value = String(req.body[field]).trim();
                    car[field] = value === '' && field === 'seats' ? 5 : value === '' && ['price', 'mileage'].includes(field) ? undefined : Number(value);
                } else if (['fuelType', 'transmission'].includes(field) && String(req.body[field]).trim() === '') {
                    car[field] = undefined;
                } else if (field === 'manufacturedDate') car[field] = req.body[field] ? new Date(req.body[field]) : null;
                else car[field] = req.body[field];
            }
        });

        if (req.body.equipment !== undefined) car.equipment = parseEquipment(req.body.equipment);
        if (req.body.isFeatured !== undefined) car.isFeatured = req.body.isFeatured === 'true';
        if (req.body.market_value !== undefined) car.market_value = Number(req.body.market_value) || 0;
        if (req.body.featSunroof !== undefined) car.features.sunroof = req.body.featSunroof === 'true';
        if (req.body.featAlloyWheels !== undefined) car.features.alloyWheels = req.body.featAlloyWheels === 'true';
        if (req.body.featTouchscreen !== undefined) car.features.touchscreen = req.body.featTouchscreen === 'true';
        if (req.body.featReverseCamera !== undefined) car.features.reverseCamera = req.body.featReverseCamera === 'true';

        await car.save();
        saved = true;
        await Promise.all(removedImages.map(image => image.public_id
            ? cloudinary.uploader.destroy(image.public_id).catch(err => logWarning('admin.car.image_remove_failed', err.message, req, { assetId: image.public_id }))
            : Promise.resolve()));
        res.json({ success: true, car: car.toJSON() });
    } catch (err) {
        if (!saved) await removeUploadedImages(req.files, req);
        return sendCarSaveError(res, err, 'update this car', req);
    }
};

exports.deleteAdminCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.status(404).json({ error: 'Car not found.' });
        if (car.images) await Promise.all(car.images.map(img => img.public_id
            ? cloudinary.uploader.destroy(img.public_id).catch(err => logWarning('admin.car.image_delete_failed', err.message, req, { assetId: img.public_id }))
            : Promise.resolve()));
        await Car.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        logError('admin.car.delete_failed', err, req);
        res.status(500).json({ error: 'We could not delete this car right now. Please try again later.' });
    }
};

// ─── SEO Sitemap & Robots ──────────────────────────────────────────────────
exports.getSitemap = async (req, res) => {
    try {
        const baseUrl = getPublicBaseUrl(req);

        const cars = await Car.find({ status: 'Available', reservation_status: { $ne: 'Reserved' } }).select('slug updatedAt').lean();

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
        logError('seo.sitemap.failed', err, req);
        res.status(500).send('Error generating sitemap');
    }
};

exports.getRobotsTxt = (req, res) => {
    const baseUrl = getPublicBaseUrl(req);

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
        const { carId, customerName, phone, email, inquiryType, message } = req.body || {};
        const name = String(customerName || '').trim();
        const phoneNumber = String(phone || '').trim();
        const emailAddress = String(email || '').trim();
        const requestMessage = String(message || '').trim();
        if (name.length > 120 || phoneNumber.length > 30 || emailAddress.length > 254 || requestMessage.length > 1500) {
            return res.status(400).json({ error: 'One or more fields exceed the allowed length.' });
        }
        if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
            return res.status(400).json({ error: 'Enter a valid email address.' });
        }

        const allowedInquiryTypes = ['Request Price', 'Request Details', 'Schedule Visit', 'Reserve Vehicle', 'Unlock Price'];
        const type = inquiryType || 'Schedule Visit';
        if (!allowedInquiryTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid inquiry type.' });
        }

        let car = null;
        if (carId) {
            if (!mongoose.Types.ObjectId.isValid(carId)) {
                return res.status(400).json({ error: 'Invalid vehicle reference.' });
            }
            car = await Car.findById(carId).select('make model status reservation_status').lean();
            if (!car) return res.status(404).json({ error: 'Vehicle not found.' });
        }
        if (type === 'Reserve Vehicle') {
            if (!car) return res.status(400).json({ error: 'A vehicle is required for a reservation request.' });
            if (car.status !== 'Available' || car.reservation_status === 'Reserved') {
                return res.status(409).json({ error: 'This vehicle is no longer available for a reservation request.' });
            }
        }

        const lead = new Lead({
            carId: car ? car._id : undefined,
            customerName: name,
            phone: phoneNumber,
            email: emailAddress || undefined,
            inquiryType: type,
            message: requestMessage
        });

        await lead.save();
        res.status(201).json({ success: true, message: 'Your request has been sent to the dealership.' });
    } catch (err) {
        logError('api.lead.submit_failed', {
            name: err.name || 'Error',
            code: err.code,
            message: 'Lead submission could not be saved.'
        }, req);
        res.status(500).json({ error: 'Failed to record your request. Please try again later.' });
    }
};
