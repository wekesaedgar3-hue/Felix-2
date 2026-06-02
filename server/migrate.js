const fs = require("fs");
const path = require("path");
const db = require("./db");

async function run() {
  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
    console.log("Running migration", f);
    try {
      await db.query(sql);
      console.log("Migration applied:", f);
    } catch (err) {
      console.error("Migration failed:", f, err.message);
      process.exit(1);
    }
  }
  console.log("Migrations completed");
  process.exit(0);
}

run();
