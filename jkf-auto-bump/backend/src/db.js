const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        trial_expires_at DATETIME,
        credits INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        cookie_string TEXT NOT NULL,
        interval_minutes INTEGER DEFAULT 60,
        status TEXT DEFAULT 'idle',
        last_run DATETIME,
        next_run DATETIME,
        last_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
`);

// Migrations for existing databases
const migrations = [
    { column: 'top_expires_at', sql: 'ALTER TABLE tasks ADD COLUMN top_expires_at DATETIME' },
    { column: 'free_status', sql: 'ALTER TABLE tasks ADD COLUMN free_status TEXT' },
    { column: 'jkf_username', sql: 'ALTER TABLE tasks ADD COLUMN jkf_username TEXT' },
    { column: 'jkf_password', sql: 'ALTER TABLE tasks ADD COLUMN jkf_password TEXT' },
];
for (const m of migrations) {
    try {
        const cols = db.pragma(`table_info(tasks)`);
        if (!cols.find(c => c.name === m.column)) {
            db.exec(m.sql);
            console.log(`[DB] Added column: ${m.column}`);
        }
    } catch (e) { /* column already exists */ }
}

module.exports = db;
