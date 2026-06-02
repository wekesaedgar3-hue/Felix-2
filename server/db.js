const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

// Build connection string from environment with sensible defaults
const connString =
  process.env.DATABASE_URL ||
  process.env.PG_CONN_STRING ||
  `postgres://${process.env.PG_USER || "postgres"}:${process.env.PG_PASSWORD || "postgres"}@${process.env.PG_HOST || "127.0.0.1"}:${process.env.PG_PORT || 5432}/${process.env.PG_DATABASE || "felix"}`;

const pool = new Pool({ connectionString: connString });

// Verify connection with retries to provide a clearer error when Postgres is down
async function verifyConnection(retries = 5, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log("Postgres connection established");
      return;
    } catch (err) {
      console.error(
        `Postgres connect attempt ${i + 1}/${retries} failed: ${err.code || err.message}`,
      );
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.error("\nUnable to connect to Postgres after multiple attempts.");
  console.error(
    "Ensure Postgres is running and environment variables are correct.",
  );
  console.error(
    "Example: run a local container with:\n  docker run --name felix-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres",
  );
  console.error(
    "Or set PG_CONN_STRING / DATABASE_URL to a reachable Postgres instance.",
  );
  process.exit(1);
}

verifyConnection();

module.exports = { query: (text, params) => pool.query(text, params), pool };
