require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const carRoutes = require('./routes/carRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

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

const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'autovault-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

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
    res.status(500).send(`<h1>500 - Server Error</h1><pre>${err.message}</pre>`);
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
