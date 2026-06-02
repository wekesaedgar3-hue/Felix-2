const db = require("./db");
const dotenv = require("dotenv");
dotenv.config();

async function run() {
  try {
    console.log(
      "Starting reconciliation: scanning transactions with no loan_id",
    );
    const res = await db.query(
      "SELECT id, external_ref, metadata FROM transactions WHERE loan_id IS NULL",
    );
    const rows = res.rows;
    const summary = { total: rows.length, matched: 0, unmatched: 0 };
    for (const t of rows) {
      let matchedLoanId = null;
      // try match by external_ref
      if (t.external_ref) {
        const q = await db.query(
          "SELECT id FROM loans WHERE id::text = $1 OR CAST(id AS text) = $1 LIMIT 1",
          [t.external_ref],
        );
        if (q.rows[0]) matchedLoanId = q.rows[0].id;
      }
      // try match by metadata (phone or checkout request id)
      if (!matchedLoanId && t.metadata) {
        const md =
          typeof t.metadata === "string" ? JSON.parse(t.metadata) : t.metadata;
        const phone =
          md?.Body?.stkCallback?.CustomerPhone || md?.phone || md?.PhoneNumber;
        if (phone) {
          // match loan by user phone? assuming users store phone in email field or metadata — heuristic
          const u = await db.query(
            "SELECT u.id, l.id AS loan_id FROM users u JOIN loans l ON l.user_id=u.id WHERE u.email ILIKE $1 LIMIT 1",
            [`%${phone}%`],
          );
          if (u.rows[0]) matchedLoanId = u.rows[0].loan_id;
        }
      }
      if (matchedLoanId) {
        await db.query("UPDATE transactions SET loan_id=$1 WHERE id=$2", [
          matchedLoanId,
          t.id,
        ]);
        summary.matched++;
      } else {
        summary.unmatched++;
      }
    }
    console.log("Reconciliation summary", summary);
    process.exit(0);
  } catch (err) {
    console.error("Reconcile failed", err);
    process.exit(1);
  }
}

run();
