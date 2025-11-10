require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { logger } = require('./middleware/errorHandler');

// Ensure database directory exists
const dbDir = path.dirname(process.env.DB_PATH || path.join(__dirname, 'marketplace.db'));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(process.env.DB_PATH || path.join(__dirname, 'marketplace.db'));

// Create database connection with better error handling
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Failed to connect to database:', err);
    process.exit(1);
  }
  logger.info('Connected to SQLite database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Set database optimizations
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA synchronous = NORMAL');
db.run('PRAGMA cache_size = 1000000');
db.run('PRAGMA temp_store = memory');

// Handle database errors
db.on('error', (err) => {
  logger.error('Database error:', err);
});

// Graceful database shutdown
process.on('exit', () => {
  logger.info('Closing database connection...');
  db.close((err) => {
    if (err) {
      logger.error('Error closing database:', err);
    } else {
      logger.info('Database connection closed');
    }
  });
});

module.exports = db;
