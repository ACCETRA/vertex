const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs * 60 * 1000, // Convert minutes to milliseconds
    max: max,
    message: {
      error: 'Too many requests',
      message: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// General API rate limiting
const apiLimiter = createRateLimit(
  process.env.RATE_LIMIT_WINDOW || 15,
  process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  'Too many requests from this IP, please try again later.'
);

// Stricter rate limiting for authentication endpoints
const authLimiter = createRateLimit(
  15, // 15 minutes
  5,  // 5 attempts
  'Too many authentication attempts, please try again later.'
);

// Rate limiting for file uploads
const uploadLimiter = createRateLimit(
  60, // 1 hour
  10, // 10 uploads
  'Upload limit exceeded, please try again later.'
);

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
      scriptSrc: ['\'self\'', 'https://cdnjs.cloudflare.com'],
      imgSrc: ['\'self\'', 'data:', 'https:', 'blob:'],
      connectSrc: ['\'self\'', 'ws:', 'wss:'],
      objectSrc: ['\'none\''],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for Three.js
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN ?
      process.env.CORS_ORIGIN.split(',') :
      ['http://localhost:3000'];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }

  next();
};

// File upload security middleware
const validateFileUpload = (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next();
  }

  const allowedTypes = process.env.ALLOWED_FILE_TYPES ?
    process.env.ALLOWED_FILE_TYPES.split(',') :
    ['.glb', '.gltf', '.obj', '.fbx', '.png', '.jpg', '.jpeg', '.gif'];

  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default

  for (let fieldName in req.files) {
    const file = req.files[fieldName];

    // Check file size
    if (file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        message: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
      });
    }

    // Check file extension
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: `File type ${fileExt} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    // Additional security checks
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return res.status(400).json({
        error: 'Invalid filename',
        message: 'Filename contains invalid characters'
      });
    }
  }

  next();
};

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  securityHeaders,
  corsOptions,
  sanitizeInput,
  validateFileUpload
};
