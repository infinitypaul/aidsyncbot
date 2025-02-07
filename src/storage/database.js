const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, "carebot.db");
const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error("❌ Database connection failed:", err.message);
    } else {
        console.log(`✅ Database connected: ${databasePath}`);
    }
});


db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS support_groups (
                                                      group_id INTEGER PRIMARY KEY,
                                                      group_name TEXT NOT NULL,
                                                      company_name TEXT NOT NULL,
                                                      email TEXT NOT NULL,
                                                      access_control TEXT DEFAULT 'admin', -- "admin" or "anyone"
                                                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);


    db.run(`
        CREATE TABLE IF NOT EXISTS admins (
                                              user_id INTEGER NOT NULL,
                                              username TEXT NOT NULL,
                                              group_id INTEGER NOT NULL, 
                                              PRIMARY KEY (user_id, group_id), 
                                              FOREIGN KEY (group_id) REFERENCES support_groups(group_id) ON DELETE CASCADE
        )
    `);
});

module.exports = db;
