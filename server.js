require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const carRoutes = require('./routes/carRoutes');

// ─── Guard: fail fast if SESSION_SECRET is missing ────────────────────────────
if (!process.env.SESSION_SECRET) {
    console.error('❌  SESSION_SECRET is not set in your .env file. Refusing to start.');
    process.exit(1);
}
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.error('❌  ADMIN_USERNAME and ADMIN_PASSWORD must be set. Default admin credentials are disabled.');
    process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.ADMIN_PASSWORD.length < 12) {
    console.error('❌  ADMIN_PASSWORD must be at least 12 characters in production.');
    process.exit(1);
}
if (process.env.NODE_ENV === 'production' && Buffer.byteLength(process.env.SESSION_SECRET) < 32) {
    console.error('❌  SESSION_SECRET must be at least 32 characters in production.');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') {
    // The deployment should terminate HTTPS at a single trusted reverse proxy.
    app.set('trust proxy', 1);
}

// ─── View Engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.formatPrice = function (price) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(price || 0);
};

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Session Store (MongoDB-backed, persisted across restarts) ────────────────
const SESSION_TTL_SECONDS = 60 * 60 * 2; // 2-hour idle timeout

app.use(session({
    secret: process.env.SESSION_SECRET,
    name: 'av.sid',                   // non-default name hides the tech stack
    resave: false,
    saveUninitialized: false,
    rolling: true,                    // reset TTL on every request (idle timeout)
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions',
        ttl: SESSION_TTL_SECONDS,     // auto-expire old sessions in MongoDB
        autoRemove: 'native'          // use MongoDB TTL index for cleanup
    }),
    cookie: {
        httpOnly: true,               // JS cannot read the cookie (XSS protection)
        sameSite: 'strict',           // CSRF protection
        secure: process.env.NODE_ENV === 'production', // HTTPS-only in production
        maxAge: SESSION_TTL_SECONDS * 1000
    }
}));

// ─── Expose session auth state to every view ──────────────────────────────────
app.use((req, res, next) => {
    res.locals.isAdmin = Boolean(req.session && req.session.isAdmin);
    next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', carRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('404', {
        message: 'Page not found.',
        isAdmin: Boolean(req.session && req.session.isAdmin)
    });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Request failed:', err);
    res.status(500).send('<h1>500 - Server Error</h1><p>Please try again later.</p>');
});

// ─── MongoDB + Server Startup ─────────────────────────────────────────────────
const mongoUri = process.env.MONGO_URI;

if (!process.env.MONGO_URI || process.env.MONGO_URI.includes('<user>') || process.env.MONGO_URI.includes('cluster.mongodb.net')) {
}

mongoose.connect(mongoUri)
    .then(async () => {
        console.log('✅ MongoDB Connected');
        try {
            const Car = require('./models/Car');
            const carsWithoutSlug = await Car.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] });
            if (carsWithoutSlug.length > 0) {
                console.log(`Populating SEO slugs for ${carsWithoutSlug.length} cars...`);
                for (const car of carsWithoutSlug) {
                    await car.save();
                }
                console.log('✅ SEO slugs populated successfully.');
            }
        } catch (slugErr) {
            console.warn('⚠️ Warning during slug population:', slugErr.message);
        }

        app.listen(PORT, () => {
            console.log(`🚀 AutoVault India running → http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });
