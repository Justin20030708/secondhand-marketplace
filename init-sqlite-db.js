const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DB_DIR, "secondhand-marketplace.sqlite");

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

async function init() {
  fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new sqlite3.Database(DB_PATH);

  try {
    await run(db, "PRAGMA foreign_keys = ON");

    await run(
      db,
      `
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL CHECK (price > 0),
        category TEXT NOT NULL,
        image TEXT NOT NULL,
        status TEXT NOT NULL,
        seller TEXT NOT NULL
      )
      `
    );

    const countRow = await get(db, "SELECT COUNT(*) AS count FROM products");
    console.log(`SQLite initialization completed: ${DB_PATH}`);
    console.log(`Current products rows: ${countRow.count}`);
  } finally {
    db.close();
  }
}

init().catch((error) => {
  console.error("Failed to initialize SQLite database:", error);
  process.exit(1);
});
