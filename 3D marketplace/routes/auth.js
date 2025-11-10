const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateSignup, validateLogin, validateProfileUpdate, validateIdParam } = require('../middleware/validation');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Signup
router.post('/signup', validateSignup, asyncHandler(async (req, res) => {
  const { username, email, password, accountType, bio, profilePic } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (username, email, password, account_type, bio, profile_pic) VALUES (?, ?, ?, ?, ?, ?)',
    [username, email, hashedPassword, accountType, bio || null, profilePic || null],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        throw err; // Let error handler deal with it
      }

      const token = jwt.sign(
        { id: this.lastID, username, accountType },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: {
          id: this.lastID,
          username,
          email,
          accountType,
          bio,
          profilePic
        }
      });
    }
  );
}));

// Login
router.post('/login', validateLogin, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT id, username, email, password, account_type, bio, profile_pic FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) throw err;
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, username: user.username, accountType: user.account_type },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        accountType: user.account_type,
        bio: user.bio,
        profilePic: user.profile_pic
      }
    });
  });
}));

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).json({ error: 'Access denied. No token provided.' });

  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied. Invalid token format.' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(400).json({ error: 'Invalid token' });
  }
};

// Get user profile
router.get('/profile/:userId', validateIdParam, asyncHandler(async (req, res) => {
  const userId = req.params.userId;

  db.get('SELECT id, username, bio, profile_pic, account_type, created_at FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) throw err;
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      username: user.username,
      bio: user.bio,
      profilePic: user.profile_pic,
      accountType: user.account_type,
      createdAt: user.created_at
    });
  });
}));

// Update user profile
router.put('/profile', verifyToken, validateProfileUpdate, asyncHandler(async (req, res) => {
  const { bio, profilePic } = req.body;
  const userId = req.user.id;

  db.run('UPDATE users SET bio = ?, profile_pic = ? WHERE id = ?', [bio, profilePic, userId], function(err) {
    if (err) throw err;
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Profile updated successfully' });
  });
}));

module.exports = { router, verifyToken };
