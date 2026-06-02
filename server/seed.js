const db = require("./db");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();

async function run() {
  try {
    console.log("Seeding database...");
    const pw = await bcrypt.hash("password123", 10);
    // create admin
    await db.query(
      "INSERT INTO users(username,email,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT (username) DO NOTHING",
      ["admin", "admin@example.com", "admin", pw],
    );
    // create manager
    await db.query(
      "INSERT INTO users(username,email,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT (username) DO NOTHING",
      ["manager", "manager@example.com", "manager", pw],
    );
    // create customer
    const r = await db.query(
      "INSERT INTO users(username,email,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT (username) DO NOTHING RETURNING id",
      ["alice", "alice@example.com", "customer", pw],
    );
    const userId = r.rows[0]
      ? r.rows[0].id
      : (await db.query("SELECT id FROM users WHERE username=$1", ["alice"]))
          .rows[0].id;

    // add a sample loan for alice
    await db.query(
      "INSERT INTO loans(user_id, principal, deduction_rate, tenor_days, disbursed_amount, total_repayment, status) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [userId, 2000, 0.1, 20, 1800, 2200, "approved"],
    );

    console.log("Seeding complete");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed", err);
    process.exit(1);
  }
}

run();
