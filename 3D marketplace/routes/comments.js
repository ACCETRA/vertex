const express = require('express');
const db = require('../db');
const { verifyToken } = require('./auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateComment, validatePortfolioIdParam, validateCommentIdParam } = require('../middleware/validation');

const router = express.Router();

// Get comments for a product with pagination
router.get('/:portfolioId', validatePortfolioIdParam, asyncHandler(async (req, res) => {
  const productId = req.params.portfolioId;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const query = `
      SELECT c.*, u.username, u.bio, u.profile_pic
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.product_id = ?
      ORDER BY c.timestamp DESC
      LIMIT ? OFFSET ?
    `;

    db.all(query, [productId, limit, offset], (err, comments) => {
      if (err) throw err;

      // Get total count for pagination
      db.get('SELECT COUNT(*) as total FROM comments WHERE product_id = ?', [productId], (err, countResult) => {
        if (err) throw err;

        res.json({
          comments,
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

// Add comment to product
router.post('/:portfolioId', verifyToken, validatePortfolioIdParam, validateComment, asyncHandler(async (req, res) => {
  const productId = req.params.portfolioId;
  const { text } = req.body;
  const userId = req.user.id;

  // Verify product exists
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) throw err;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.run('INSERT INTO comments (product_id, user_id, text) VALUES (?, ?, ?)', [productId, userId, text], function(err) {
      if (err) throw err;

      // Get the inserted comment with user details
      db.get(`
        SELECT c.*, u.username, u.bio, u.profile_pic
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `, [this.lastID], (err, comment) => {
        if (err) throw err;

        res.status(201).json({
          comment,
          message: 'Comment added successfully'
        });
      });
    });
  });
}));

// Update comment (only by author)
router.put('/:commentId', verifyToken, validateCommentIdParam, validateComment, asyncHandler(async (req, res) => {
  const commentId = req.params.commentId;
  const { text } = req.body;
  const userId = req.user.id;

  // Check if user owns the comment
  db.get('SELECT user_id FROM comments WHERE id = ?', [commentId], (err, comment) => {
    if (err) throw err;
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== userId) return res.status(403).json({ error: 'Not authorized to update this comment' });

    db.run('UPDATE comments SET text = ? WHERE id = ?', [text, commentId], function(err) {
      if (err) throw err;
      if (this.changes === 0) return res.status(404).json({ error: 'Comment not found' });

      res.json({ message: 'Comment updated successfully' });
    });
  });
}));

// Delete comment (only by author)
router.delete('/:commentId', verifyToken, validateCommentIdParam, asyncHandler(async (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.id;

  // Check if user owns the comment
  db.get('SELECT user_id FROM comments WHERE id = ?', [commentId], (err, comment) => {
    if (err) throw err;
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== userId) return res.status(403).json({ error: 'Not authorized to delete this comment' });

    db.run('DELETE FROM comments WHERE id = ?', [commentId], function(err) {
      if (err) throw err;
      if (this.changes === 0) return res.status(404).json({ error: 'Comment not found' });

      res.json({ message: 'Comment deleted successfully' });
    });
  });
}));

module.exports = router;
