const express    = require('express');
const router     = express.Router();
const upload     = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');
const {
    // ── Public ──────────────────────────────────────────────────────────────
    getHomePage,
    getInventory,
    getCarDetail,
    // ── Legacy admin form ───────────────────────────────────────────────────
    getAddCarForm,
    postAddCar,
    deleteCar,
    // ── New admin dashboard API ─────────────────────────────────────────────
    getAdminDashboard,
    getAdminCars,
    getAdminCarById,
    postAdminCar,
    putAdminCar,
    deleteAdminCar
} = require('../controllers/carController');

// ─── Public Routes ─────────────────────────────────────────────────────────────
router.get('/',              getHomePage);
router.get('/inventory',     getInventory);
router.get('/inventory/:id', getCarDetail);

// ─── Legacy Admin Form Routes (kept for backward compatibility) ────────────────
router.get('/admin/add',  requireAdmin, getAddCarForm);
router.post('/admin/add', requireAdmin, upload.array('images', 10), postAddCar);

// Legacy delete route (POST because HTML forms don't support DELETE)
router.post('/admin/delete/:id', requireAdmin, deleteCar);

// ─── Admin Dashboard (SPA Shell) ──────────────────────────────────────────────
router.get('/admin', requireAdmin, getAdminDashboard);

// ─── Admin Car API Routes (JSON) ──────────────────────────────────────────────
// All protected by requireAdmin middleware

// GET  /admin/cars?page=1&limit=20&search=&fuelType=&bodyType=&sort=newest
router.get('/admin/cars',     requireAdmin, getAdminCars);

// GET  /admin/cars/:id
router.get('/admin/cars/:id', requireAdmin, getAdminCarById);

// POST /admin/cars  (multipart — multer handles Cloudinary upload)
router.post('/admin/cars',    requireAdmin, upload.array('images', 10), postAdminCar);

// PUT  /admin/cars/:id  (multipart — multer handles new image uploads)
router.put('/admin/cars/:id', requireAdmin, upload.array('images', 10), putAdminCar);

// DELETE /admin/cars/:id
router.delete('/admin/cars/:id', requireAdmin, deleteAdminCar);

module.exports = router;
