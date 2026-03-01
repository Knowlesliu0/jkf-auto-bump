const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data.db');
const db = new Database(dbPath);

try {
    db.exec(`ALTER TABLE tasks ADD COLUMN top_expires_at DATETIME`);
    console.log("Successfully added top_expires_at column to tasks table.");
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log("Column top_expires_at already exists.");
    } else {
        console.error("Error migrating db:", error);
    }
}
db.close();
