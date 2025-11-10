const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { verifyToken } = require('./auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateProductUpload, validateIdParam } = require('../middleware/validation');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads'));
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for file uploads with enhanced security
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES ?
    process.env.ALLOWED_FILE_TYPES.split(',') :
    ['.glb', '.gltf', '.obj', '.fbx', '.png', '.jpg', '.jpeg', '.gif'];

  const ext = '.' + file.originalname.split('.').pop().toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
    files: 1
  }
});

// Get all products with pagination and filtering
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, category, search, seller } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT p.*, u.username as seller_username, u.bio as seller_bio,
           COUNT(DISTINCT l.id) as likes_count,
           COUNT(DISTINCT c.id) as comments_count
    FROM products p
    JOIN users u ON p.seller_id = u.id
    LEFT JOIN likes l ON p.id = l.product_id
    LEFT JOIN comments c ON p.id = c.product_id
  `;

  const params = [];
  const conditions = [];

  if (category) {
    conditions.push('p.category = ?');
    params.push(category);
  }

  if (search) {
    conditions.push('(p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (seller) {
    conditions.push('u.username = ?');
    params.push(seller);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.all(query, params, (err, rows) => {
    if (err) throw err;

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM products p JOIN users u ON p.seller_id = u.id';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    db.get(countQuery, params.slice(0, -2), (err, countResult) => {
      if (err) throw err;

      res.json({
        products: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
}));

// Get single product by ID
router.get('/:id', validateIdParam, asyncHandler(async (req, res) => {
  const productId = req.params.id;

  db.get(`
    SELECT p.*, u.username as seller_username, u.bio as seller_bio,
           COUNT(DISTINCT l.id) as likes_count,
           COUNT(DISTINCT c.id) as comments_count
    FROM products p
    JOIN users u ON p.seller_id = u.id
    LEFT JOIN likes l ON p.id = l.product_id
    LEFT JOIN comments c ON p.id = c.product_id
    WHERE p.id = ?
    GROUP BY p.id
  `, [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json(product);
  });
}));

// Upload product
router.post('/upload', verifyToken, upload.single('model'), validateProductUpload, asyncHandler(async (req, res) => {
  if (req.user.accountType !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can upload products' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { title, description, price, category, dimension, tags } = req.body;
  const filePath = req.file.path;

  // Generate thumbnail (placeholder for now)
  const thumbnailPath = null; // TODO: Implement thumbnail generation

  db.run(
    'INSERT INTO products (title, description, price, category, dimension, tags, file_path, thumbnail_path, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, description || null, parseFloat(price), category, dimension || '3D', tags || null, filePath, thumbnailPath, req.user.id],
    function(err) {
      if (err) throw err;

      res.status(201).json({
        id: this.lastID,
        message: 'Product uploaded successfully',
        filePath: req.file.filename
      });
    }
  );
}));

// Update product
router.put('/:id', verifyToken, validateIdParam, validateProductUpload, asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const { title, description, price, category, dimension, tags } = req.body;

  // Check if user owns the product
  db.get('SELECT seller_id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.seller_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to update this product' });

    db.run(
      'UPDATE products SET title = ?, description = ?, price = ?, category = ?, dimension = ?, tags = ? WHERE id = ?',
      [title, description || null, parseFloat(price), category, dimension || '3D', tags || null, productId],
      function(err) {
        if (err) throw err;
        if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });

        res.json({ message: 'Product updated successfully' });
      }
    );
  });
}));

// Delete product
router.delete('/:id', verifyToken, validateIdParam, asyncHandler(async (req, res) => {
  const productId = req.params.id;

  // Check if user owns the product
  db.get('SELECT seller_id, file_path FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.seller_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to delete this product' });

    // Delete file from filesystem
    if (fs.existsSync(product.file_path)) {
      fs.unlinkSync(product.file_path);
    }

    db.run('DELETE FROM products WHERE id = ?', [productId], function(err) {
      if (err) throw err;
      if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });

      res.json({ message: 'Product deleted successfully' });
    });
  });
}));

// Get products by seller
router.get('/seller/:sellerId', validateIdParam, asyncHandler(async (req, res) => {
  const sellerId = req.params.sellerId;

  db.all(`
    SELECT p.*, COUNT(DISTINCT l.id) as likes_count, COUNT(DISTINCT c.id) as comments_count
    FROM products p
    LEFT JOIN likes l ON p.id = l.product_id
    LEFT JOIN comments c ON p.id = c.product_id
    WHERE p.seller_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [sellerId], (err, rows) => {
    if (err) throw err;
    res.json(rows);
  });
}));

module.exports = router;
