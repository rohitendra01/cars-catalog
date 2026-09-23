const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary SDK from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true
});

// Configure Multer-Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder:         'autovault-cars',          // Organized folder in your Cloudinary account
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
        transformation: [
            {
                width:   1200,
                height:  800,
                crop:    'limit',                  // Resize down if larger, never upscale
                quality: 80,                       // 80% quality — good compression/clarity balance
                format:  'webp'                    // Always serve as WebP for optimal loading
            }
        ],
        // Generate a unique public_id so filenames don't collide
        public_id: (req, file) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const originalName = file.originalname.replace(/\.[^/.]+$/, '').replace(/\s+/g, '-');
            return `car-${originalName}-${uniqueSuffix}`;
        }
    }
});

// File filter — only allow image MIME types
const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPG, PNG, WebP) are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }  // 10 MB max per file
});

module.exports = upload;
