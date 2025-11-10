require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const { router: authRoutes } = require('./routes/auth');
const productRoutes = require('./routes/products');
const messageRoutes = require('./routes/messages');
const commentRoutes = require('./routes/comments');
const likeRoutes = require('./routes/likes');
const db = require('./db');

// Import middleware
const {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  securityHeaders,
  corsOptions,
  sanitizeInput,
  validateFileUpload
} = require('./middleware/security');

const {
  errorHandler,
  notFoundHandler,
  requestLogger,
  healthCheck,
  logger
} = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions
});
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(securityHeaders);

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024
}));

// CORS middleware
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

// General rate limiting
app.use('/api', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Static file serving with caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Serve uploaded files with caching
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true
}));

// Health check endpoint
app.get('/health', healthCheck);

// API Routes with specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', uploadLimiter, productRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);

// File upload validation for all routes
app.use('/api/products/upload', validateFileUpload);

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
  });

  socket.on('sendMessage', (data) => {
    const { senderId, receiverId, text } = data;
    // Save to DB
    db.run('INSERT INTO messages (sender_id, receiver_id, text) VALUES (?, ?, ?)', [senderId, receiverId, text], function(err) {
      if (err) {
        console.error('Error saving message:', err);
        return;
      }
      const message = { id: this.lastID, sender_id: senderId, receiver_id: receiverId, text, sent_at: new Date() };
      io.to(receiverId).emit('receiveMessage', message);
      io.to(senderId).emit('receiveMessage', message);
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    logger.info('HTTP server closed');
    db.close((err) => {
      if (err) {
        logger.error('Error closing database:', err);
        process.exit(1);
      }
      logger.info('Database connection closed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
// For Vercel deployment
if (process.env.VERCEL) {
  module.exports = app;
}
