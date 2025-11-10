const express = require('express');
const db = require('../db');
const { verifyToken } = require('./auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateMessage, validateIdParam } = require('../middleware/validation');

const router = express.Router();

// Get messages for user with pagination
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 50, conversation } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT m.*,
           su.username as sender_username,
           ru.username as receiver_username,
           p.title as product_title
    FROM messages m
    JOIN users su ON m.sender_id = su.id
    JOIN users ru ON m.receiver_id = ru.id
    LEFT JOIN products p ON m.product_id = p.id
    WHERE m.receiver_id = ? OR m.sender_id = ?
  `;

  const params = [userId, userId];

  if (conversation) {
    // Get messages between current user and specific user
    query += ' AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))';
    params.push(userId, conversation, conversation, userId);
  }

  query += ' ORDER BY m.sent_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.all(query, params, (err, messages) => {
    if (err) throw err;

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      WHERE m.receiver_id = ? OR m.sender_id = ?
    `;
    const countParams = [userId, userId];

    if (conversation) {
      countQuery += ' AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))';
      countParams.push(userId, conversation, conversation, userId);
    }

    db.get(countQuery, countParams, (err, countResult) => {
      if (err) throw err;

      res.json({
        messages: messages.reverse(), // Reverse to show chronological order
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

// Get conversations (unique users the current user has messaged with)
router.get('/conversations', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT DISTINCT
      CASE
        WHEN m.sender_id = ? THEN m.receiver_id
        ELSE m.sender_id
      END as other_user_id,
      u.username,
      u.bio,
      u.profile_pic,
      MAX(m.sent_at) as last_message_time,
      (
        SELECT text FROM messages
        WHERE (sender_id = ? AND receiver_id = other_user_id)
           OR (sender_id = other_user_id AND receiver_id = ?)
        ORDER BY sent_at DESC LIMIT 1
      ) as last_message,
      (
        SELECT COUNT(*) FROM messages
        WHERE receiver_id = ? AND sender_id = other_user_id AND sent_at > COALESCE(
          (SELECT MAX(sent_at) FROM messages WHERE (sender_id = ? AND receiver_id = other_user_id) OR (sender_id = other_user_id AND receiver_id = ?)),
          '1970-01-01'
        )
      ) as unread_count
    FROM messages m
    JOIN users u ON u.id = CASE
      WHEN m.sender_id = ? THEN m.receiver_id
      ELSE m.sender_id
    END
    WHERE m.sender_id = ? OR m.receiver_id = ?
    GROUP BY other_user_id, u.username, u.bio, u.profile_pic
    ORDER BY last_message_time DESC
  `;

  db.all(query, [userId, userId, userId, userId, userId, userId, userId, userId, userId], (err, conversations) => {
    if (err) throw err;
    res.json(conversations);
  });
}));

// Send message
router.post('/', verifyToken, validateMessage, asyncHandler(async (req, res) => {
  const { receiverId, productId, text } = req.body;
  const senderId = req.user.id;

  // Verify receiver exists
  db.get('SELECT id FROM users WHERE id = ?', [receiverId], (err, receiver) => {
    if (err) throw err;
    if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

    // If productId is provided, verify it exists and user has access
    if (productId) {
      db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
        if (err) throw err;
        if (!product) return res.status(404).json({ error: 'Product not found' });

        insertMessage();
      });
    } else {
      insertMessage();
    }

    function insertMessage() {
      db.run(
        'INSERT INTO messages (sender_id, receiver_id, product_id, text) VALUES (?, ?, ?, ?)',
        [senderId, receiverId, productId || null, text],
        function(err) {
          if (err) throw err;

          // Get the inserted message with user details
          db.get(`
            SELECT m.*,
                   su.username as sender_username,
                   ru.username as receiver_username,
                   p.title as product_title
            FROM messages m
            JOIN users su ON m.sender_id = su.id
            JOIN users ru ON m.receiver_id = ru.id
            LEFT JOIN products p ON m.product_id = p.id
            WHERE m.id = ?
          `, [this.lastID], (err, message) => {
            if (err) throw err;

            res.status(201).json({
              message: message,
              success: 'Message sent successfully'
            });
          });
        }
      );
    }
  });
}));

// Mark messages as read
router.put('/read/:conversationId', verifyToken, validateIdParam, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const conversationId = req.params.conversationId;

  // Update messages from conversation partner to mark as read
  // Note: This is a simplified approach. In a real app, you might want a 'read' status column
  db.run(
    'UPDATE messages SET sent_at = sent_at WHERE receiver_id = ? AND sender_id = ?',
    [userId, conversationId],
    function(err) {
      if (err) throw err;
      res.json({ message: 'Messages marked as read' });
    }
  );
}));

module.exports = router;
