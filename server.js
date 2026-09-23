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

// ─── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ─── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', carRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('404', { message: 'Page not found.' });
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
    .then(() => {
        console.log('✅ MongoDB Connected');
        app.listen(PORT, () => {
            console.log(`🚀 AutoVault India running → http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });
