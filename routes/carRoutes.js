const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');
const { getGoogleReviewSummary } = require('../controllers/googleReviewController');
const { postClientError } = require('../controllers/clientErrorController');
const { logError } = require('../utils/logger');
const {
    getHomePage,
    getInventory,
    getCarDetail,
    getCarPricing,
    getSitemap,
    getRobotsTxt,
    postLead,
    getAdminLogin,
    postAdminLogin,
    postAdminLogout,
    getAdminDashboard,
    getAdminCars,
    getAdminCarById,
    postAdminCar,
    putAdminCar,
    deleteAdminCar
} = require('../controllers/carController');

function handleCarImages(req, res, next) {
    upload.array('images', 10)(req, res, err => {
        if (!err) return next();

        logError('admin.car.image_upload_failed', err, req, { uploadCode: err.code });
        if (err.code === 'INVALID_IMAGE_TYPE') {
            return res.status(400).json({ error: 'Please use JPG, PNG, WebP, or AVIF images.' });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Each image must be 5 MB or smaller.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: 'You can upload up to 10 images for a car.' });
        }

        return res.status(503).json({ error: 'We could not upload the images right now. Please try again later.' });
    });
}

// ─── Public Routes ─────────────────────────────────────────────────────────────
router.get('/', getHomePage);
router.get('/inventory', getInventory);
router.get('/inventory/:slug', getCarDetail);

// SEO Canonical Redirects & Aliases
router.get('/cars', (req, res) => res.redirect(301, '/inventory'));
router.get('/cars/:slug', (req, res) => res.redirect(301, `/inventory/${req.params.slug}`));
router.get('/car/:slug', (req, res) => res.redirect(301, `/inventory/${req.params.slug}`));

// Dynamic XML Sitemap & Robots for Search Engines
router.get('/sitemap.xml', getSitemap);
router.get('/robots.txt', getRobotsTxt);

// Test Drive & Customer Lead API
router.post('/api/leads', postLead);
router.post('/api/client-errors', postClientError);

router.get('/api/cars/:id/pricing', getCarPricing);
router.get('/api/google-review-summary', getGoogleReviewSummary);

// ─── Admin Dashboard (SPA Shell) ──────────────────────────────────────────────
router.get('/admin/login', getAdminLogin);
router.post('/admin/login', express.urlencoded({ extended: true }), postAdminLogin);
router.post('/admin/logout', postAdminLogout);

router.get('/admin', requireAdmin, getAdminDashboard);
router.get('/admin/session', requireAdmin, (req, res) => res.sendStatus(204));

// ─── Admin Car API Routes (JSON) ──────────────────────────────────────────────
// All protected by requireAdmin middleware

// GET  /admin/cars?page=1&limit=20&search=&fuelType=&bodyType=&sort=newest
router.get('/admin/cars', requireAdmin, getAdminCars);

// GET  /admin/cars/:id
router.get('/admin/cars/:id', requireAdmin, getAdminCarById);

// POST /admin/cars  (multipart — multer handles Cloudinary upload)
router.post('/admin/cars', requireAdmin, handleCarImages, postAdminCar);

// PUT  /admin/cars/:id  (multipart — multer handles new image uploads)
router.put('/admin/cars/:id', requireAdmin, handleCarImages, putAdminCar);

// DELETE /admin/cars/:id
router.delete('/admin/cars/:id', requireAdmin, deleteAdminCar);

module.exports = router;
