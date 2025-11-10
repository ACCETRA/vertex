const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure database directory exists
const dbDir = path.dirname(process.env.DB_PATH || './marketplace.db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(process.env.DB_PATH || './marketplace.db');
const db = new sqlite3.Database(dbPath);

console.log('Initializing database...');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      account_type TEXT NOT NULL CHECK(account_type IN ('client', 'seller')),
      bio TEXT,
      profile_pic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('✓ Users table created');
  });

  // Portfolios table (expanded from products)
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      dimension TEXT DEFAULT '3D',
      tags TEXT,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      seller_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users (id)
    )
  `, (err) => {
    if (err) console.error('Error creating products table:', err);
    else console.log('✓ Products table created');
  });

  // Messages table
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      product_id INTEGER,
      text TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users (id),
      FOREIGN KEY (receiver_id) REFERENCES users (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    )
  `, (err) => {
    if (err) console.error('Error creating messages table:', err);
    else console.log('✓ Messages table created');
  });

  // Comments table
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `, (err) => {
    if (err) console.error('Error creating comments table:', err);
    else console.log('✓ Comments table created');
  });

  // Likes table
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      UNIQUE(product_id, user_id)
    )
  `, (err) => {
    if (err) console.error('Error creating likes table:', err);
    else console.log('✓ Likes table created');
  });

  // Insert demo user if not exists
  db.get('SELECT id FROM users WHERE email = ?', ['demo@artstation.com'], (err, row) => {
    if (!row) {
      const bcrypt = require('bcrypt');
      const hashedPassword = bcrypt.hashSync('demo123', 10);
      db.run(
        'INSERT INTO users (username, email, password, account_type, bio, profile_pic) VALUES (?, ?, ?, ?, ?, ?)',
        ['DemoUser', 'demo@artstation.com', hashedPassword, 'seller', 'Demo account for prototyping', null],
        function(err) {
          if (err) console.error('Error creating demo user:', err);
          else console.log('✓ Demo user created');
        }
      );
    } else {
      console.log('✓ Demo user already exists');
    }
  });

  // Close database connection
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
      process.exit(1);
    }
    console.log('✓ Database initialization completed successfully');
  });
});
