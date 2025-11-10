const express = require('express');
const db = require('../db');
const { verifyToken } = require('./auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validatePortfolioIdParam, validateUserIdParam } = require('../middleware/validation');

const router = express.Router();

// Get likes count for a product
router.get('/:portfolioId/count', validatePortfolioIdParam, asyncHandler(async (req, res) => {
  const productId = req.params.portfolioId;

  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.get('SELECT COUNT(*) as count FROM likes WHERE product_id = ?', [productId], (err, row) => {
      if (err) throw err;
      res.json({ count: row.count });
    });
  });
}));

// Check if user liked a product
router.get('/:portfolioId/user/:userId', verifyToken, validatePortfolioIdParam, validateUserIdParam, asyncHandler(async (req, res) => {
  const productId = req.params.portfolioId;
  const userId = req.params.userId;

  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.get('SELECT id FROM likes WHERE product_id = ? AND user_id = ?', [productId, userId], (err, row) => {
      if (err) throw err;
      res.json({ liked: !!row });
    });
  });
}));

// Get users who liked a product
router.get('/:portfolioId/users', validatePortfolioIdParam, asyncHandler(async (req, res) => {
  const productId = req.params.portfolioId;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const query = `
      SELECT u.id, u.username, u.bio, u.profile_pic, l.created_at as liked_at
      FROM likes l
      JOIN users u ON l.user_id = u.id
      WHERE l.product_id = ?
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    db.all(query, [productId, limit, offset], (err, users) => {
      if (err) throw err;

      // Get total count
      db.get('SELECT COUNT(*) as total FROM likes WHERE product_id = ?', [productId], (err, countResult) => {
        if (err) throw err;

        res.json({
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        });
      });
    });
  });
}));

// Like a product
router.post('/:portfolioId', verifyToken, validatePortfolioIdParam, asyncHandler(async (req, res) => {
  const productId = req.params.portfolioId;
  const userId = req.user.id;

  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.run('INSERT OR IGNORE INTO likes (product_id, user_id) VALUES (?, ?)', [productId, userId], function(err) {
      if (err) throw err;

      const wasLiked = this.changes > 0;
      const message = wasLiked ? 'Product liked successfully' : 'Product was already liked';

      // Get updated like count
      db.get('SELECT COUNT(*) as count FROM likes WHERE product_id = ?', [productId], (err, row) => {
        if (err) throw err;

        res.status(wasLiked ? 201 : 200).json({
          message,
          liked: true,
          likesCount: row.count
        });
      });
    });
  });
}));

// Unlike a product
router.delete('/:portfolioId', verifyToken, validatePortfolioIdParam, asyncHandler(async (req, res) => {
  const productId = req.params.portfolioId;
  const userId = req.user.id;

  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.run('DELETE FROM likes WHERE product_id = ? AND user_id = ?', [productId, userId], function(err) {
      if (err) throw err;

      const wasUnliked = this.changes > 0;
      if (!wasUnliked) return res.status(404).json({ error: 'Like not found' });

      // Get updated like count
      db.get('SELECT COUNT(*) as count FROM likes WHERE product_id = ?', [productId], (err, row) => {
        if (err) throw err;

        res.json({
          message: 'Product unliked successfully',
          liked: false,
          likesCount: row.count
        });
      });
    });
  });
}));

// Get user's liked products
router.get('/user/:userId/products', verifyToken, validateUserIdParam, asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  // Users can only see their own liked products unless they're viewing someone else's public profile
  if (req.user.id !== parseInt(userId)) {
    return res.status(403).json({ error: 'Not authorized to view this user\'s likes' });
  }

  const query = `
    SELECT p.*, u.username as seller_username, l.created_at as liked_at
    FROM likes l
    JOIN products p ON l.product_id = p.id
    JOIN users u ON p.seller_id = u.id
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.all(query, [userId, limit, offset], (err, products) => {
    if (err) throw err;

    // Get total count
    db.get('SELECT COUNT(*) as total FROM likes WHERE user_id = ?', [userId], (err, countResult) => {
      if (err) throw err;

      res.json({
        products,
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

module.exports = router;
