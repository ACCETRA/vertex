const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(process.env.DB_PATH || './marketplace.db');
const db = new sqlite3.Database(dbPath);

console.log('Running database migrations...');

// Migration scripts
const migrations = [
  {
    version: 1,
    description: 'Add indexes for better performance',
    up: `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_comments_product ON comments(product_id);
      CREATE INDEX IF NOT EXISTS idx_likes_product ON likes(product_id);
    `
  },
  {
    version: 2,
    description: 'Add user sessions table',
    up: `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `
  }
];

// Check current migration version
db.get('SELECT name FROM sqlite_master WHERE type="table" AND name="migrations"', (err, row) => {
  if (err) {
    console.error('Error checking migrations table:', err);
    return;
  }

  if (!row) {
    // Create migrations table
    db.run(`
      CREATE TABLE migrations (
        version INTEGER PRIMARY KEY,
        description TEXT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating migrations table:', err);
        return;
      }
      runMigrations();
    });
  } else {
    runMigrations();
  }
});

function runMigrations() {
  db.get('SELECT MAX(version) as current_version FROM migrations', (err, row) => {
    if (err) {
      console.error('Error getting current migration version:', err);
      return;
    }

    const currentVersion = row ? row.current_version || 0 : 0;
    console.log(`Current migration version: ${currentVersion}`);

    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log('✓ No pending migrations');
      db.close();
      return;
    }

    console.log(`Running ${pendingMigrations.length} migration(s)...`);

    let completed = 0;
    pendingMigrations.forEach(migration => {
      db.run(migration.up, (err) => {
        if (err) {
          console.error(`Error running migration ${migration.version}:`, err);
          return;
        }

        // Record migration
        db.run('INSERT INTO migrations (version, description) VALUES (?, ?)',
          [migration.version, migration.description], (err) => {
            if (err) {
              console.error(`Error recording migration ${migration.version}:`, err);
              return;
            }

            console.log(`✓ Migration ${migration.version} applied: ${migration.description}`);
            completed++;

            if (completed === pendingMigrations.length) {
              console.log('✓ All migrations completed successfully');
              db.close();
            }
          });
      });
    });
  });
}
