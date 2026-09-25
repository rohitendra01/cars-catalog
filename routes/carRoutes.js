const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');
const {
    getHomePage,
    getInventory,
    getCarDetail,
    getSitemap,
    getRobotsTxt,
    postLead,
    getAddCarForm,
    postAddCar,
    deleteCar,
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

// ─── Legacy Admin Form Routes (kept for backward compatibility) ────────────────
router.get('/admin/add', requireAdmin, getAddCarForm);
router.post('/admin/add', requireAdmin, upload.array('images', 10), postAddCar);

// Legacy delete route (POST because HTML forms don't support DELETE)
router.post('/admin/delete/:id', requireAdmin, deleteCar);

// ─── Admin Dashboard (SPA Shell) ──────────────────────────────────────────────
router.get('/admin/login', getAdminLogin);
router.post('/admin/login', express.urlencoded({ extended: true }), postAdminLogin);
router.post('/admin/logout', postAdminLogout);

router.get('/admin', requireAdmin, getAdminDashboard);

// ─── Admin Car API Routes (JSON) ──────────────────────────────────────────────
// All protected by requireAdmin middleware

// GET  /admin/cars?page=1&limit=20&search=&fuelType=&bodyType=&sort=newest
router.get('/admin/cars', requireAdmin, getAdminCars);

// GET  /admin/cars/:id
router.get('/admin/cars/:id', requireAdmin, getAdminCarById);

// POST /admin/cars  (multipart — multer handles Cloudinary upload)
router.post('/admin/cars', requireAdmin, upload.array('images', 10), postAdminCar);

// PUT  /admin/cars/:id  (multipart — multer handles new image uploads)
router.put('/admin/cars/:id', requireAdmin, upload.array('images', 10), putAdminCar);

// DELETE /admin/cars/:id
router.delete('/admin/cars/:id', requireAdmin, deleteAdminCar);

module.exports = router;
