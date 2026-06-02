const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./db");
const mpesa = require("./services/mpesa");

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";

app.get("/api/config", (req, res) => {
  res.json({ deductionRate: 0.1 });
});

const ALLOWED_ROLES = ["admin", "manager", "employer", "customer"];

// Register
app.post("/api/auth/register", async (req, res) => {
  const { username, password, role = "customer", email } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "missing username or password" });
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: "invalid role" });
  }
  try {
    const existing = await db.query("SELECT id FROM users WHERE username=$1", [
      username,
    ]);
    if (existing.rows.length) {
      return res.status(409).json({ error: "username already exists" });
    }
    const hash = await bcrypt.hash(password, 10);
    const needsApproval = ["manager", "employer"].includes(role);
    const result = await db.query(
      "INSERT INTO users(username, email, role, password_hash, approved) VALUES($1,$2,$3,$4,$5) RETURNING id, username, role, email, created_at, approved",
      [username, email || null, role, hash, !needsApproval],
    );
    const user = result.rows[0];
    res.json({
      user,
      pendingApproval: needsApproval,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "missing" });
  try {
    const q = await db.query(
      "SELECT id, username, role, password_hash, approved FROM users WHERE username=$1",
      [username],
    );
    const u = q.rows[0];
    if (!u) return res.status(401).json({ error: "invalid" });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid" });
    if (["manager", "employer"].includes(u.role) && !u.approved) {
      return res.status(403).json({
        error: "Your account is pending admin approval before you can sign in.",
      });
    }
    const token = jwt.sign(
      { id: u.id, username: u.username, role: u.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({
      token,
      user: {
        id: u.id,
        username: u.username,
        role: u.role,
        approved: u.approved,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function ensureAuth(req, res, next) {
  const h = req.headers["authorization"];
  if (!h) return res.status(401).json({ error: "no token" });
  const parts = h.split(" ");
  if (parts.length !== 2) return res.status(401).json({ error: "malformed" });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid token" });
  }
}

async function ensureUserApprovalColumn() {
  try {
    await db.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT TRUE",
    );
    await db.query("UPDATE users SET approved = TRUE WHERE approved IS NULL");
  } catch (err) {
    console.warn("User approval migration check failed:", err.message);
  }
}

ensureUserApprovalColumn();

app.get("/api/auth/permissions", ensureAuth, (req, res) => {
  const headerRole = req.headers["x-impersonated-role"];
  const role = ALLOWED_ROLES.includes(headerRole) ? headerRole : req.user.role;
  const permissionsByRole = {
    admin: {
      approveUsers: true,
      viewLedgers: true,
      overrideRates: true,
    },
    manager: {
      approveUsers: true,
      viewLedgers: true,
      overrideRates: true,
    },
    employer: {
      approveUsers: false,
      viewLedgers: true,
      overrideRates: false,
    },
    customer: {
      approveUsers: false,
      viewLedgers: false,
      overrideRates: false,
    },
  };
  res.json({
    permissions: permissionsByRole[role] || permissionsByRole.customer,
  });
});

app.get("/api/users/pending", ensureAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const result = await db.query(
      "SELECT id, username, email, role, created_at FROM users WHERE approved = false AND role IN ('manager', 'employer') ORDER BY created_at DESC",
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/:id/approve", ensureAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  try {
    const result = await db.query(
      "UPDATE users SET approved = TRUE WHERE id = $1 AND role IN ('manager', 'employer') RETURNING id, username, email, role, approved, created_at",
      [id],
    );
    if (!result.rows.length) {
      return res
        .status(404)
        .json({ error: "user not found or not pending approval" });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/:id/reject", ensureAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  try {
    const result = await db.query(
      "DELETE FROM users WHERE id = $1 AND approved = false AND role IN ('manager', 'employer') RETURNING id, username, email, role, approved",
      [id],
    );
    if (!result.rows.length) {
      return res
        .status(404)
        .json({ error: "user not found or not pending approval" });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const loanStore = [];

// Helper to find a loan by id
function findLoan(id) {
  return loanStore.find((l) => l.id === id);
}

function computeLoanPayload(P, d, n) {
  const Fdeduct = +(P * d).toFixed(2);
  const Adisburse = +(P - Fdeduct).toFixed(2);
  const Ltotal = +(P * (1 + d)).toFixed(2);
  const Rdaily = +(Ltotal / n).toFixed(2);
  // Add aliases to match frontend expectation (totalPayable, dailyPayment)
  return {
    P,
    d,
    n,
    Fdeduct,
    Adisburse,
    Ltotal,
    Rdaily,
    totalPayable: Ltotal,
    dailyPayment: Rdaily,
  };
}

app.post("/api/loans/apply", ensureAuth, async (req, res) => {
  const {
    principal,
    deduction_rate,
    tenor_days,
    phone,
    purpose,
    schedule_type,
    employerId,
  } = req.body;
  if (!principal || !deduction_rate || !tenor_days) {
    return res.status(400).json({ error: "missing loan fields" });
  }
  const calc = computeLoanPayload(principal, deduction_rate, tenor_days);
  const loan = {
    id: `LN${Date.now()}`,
    userId: req.user.id,
    username: req.user.username,
    principal,
    rate: deduction_rate,
    tenor: tenor_days,
    phone: phone || "",
    purpose: purpose || "",
    schedule_type: schedule_type || "daily",
    status: "pending_verification",
    appliedAt: new Date().toISOString().split("T")[0],
    verifiedAt: null,
    disbursedAt: null,
    paidAmount: 0,
    calc,
    schedule: [],
    employerId: employerId || null,
    transactions: [],
  };
  loan.schedule = Array.from({ length: tenor_days }, (_, i) => ({
    day: i + 1,
    amount: +(calc.Ltotal / tenor_days).toFixed(2),
  }));
  loanStore.unshift(loan);
  res.json({ loan });
});

app.get("/api/loans/user", ensureAuth, (req, res) => {
  const loans = loanStore.filter((loan) => loan.userId === req.user.id);
  res.json({ loans });
});

// Return pending_verification loans for manager verification queue
app.get("/api/loans/pending-verification", ensureAuth, (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "forbidden" });
  }
  const loans = loanStore.filter(
    (loan) => loan.status === "pending_verification",
  );
  res.json({ loans });
});

// Return pending_approval loans for admin disbursement
app.get("/api/loans/pending-approval", ensureAuth, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  const loans = loanStore.filter((loan) => loan.status === "pending_approval");
  res.json({ loans });
});

// Generic loans endpoint: admin/manager/employer see all loans, customer sees own
app.get("/api/loans", ensureAuth, (req, res) => {
  if (["admin", "manager", "employer"].includes(req.user.role)) {
    return res.json({ loans: loanStore });
  }
  const loans = loanStore.filter((loan) => loan.userId === req.user.id);
  res.json({ loans });
});

// Register a payment/deduction against a loan so all portals see updated figures
app.post("/api/loans/:id/pay", ensureAuth, (req, res) => {
  const { id } = req.params;
  const { amount, method = "manual", external_ref = null } = req.body;
  const loan = findLoan(id);
  if (!loan) return res.status(404).json({ error: "loan not found" });

  const numeric = Number(amount || 0);
  if (!numeric || numeric <= 0) {
    return res.status(400).json({ error: "invalid amount" });
  }

  // record transaction and update paidAmount/status
  const tx = {
    id: `TX${Date.now()}`,
    time: new Date().toISOString(),
    amount: numeric,
    method,
    external_ref,
    by: req.user.username,
  };
  loan.transactions = loan.transactions || [];
  loan.transactions.push(tx);
  loan.paidAmount = +(Number(loan.paidAmount || 0) + numeric).toFixed(2);

  if (
    loan.paidAmount >= (loan.calc && loan.calc.Ltotal ? loan.calc.Ltotal : 0)
  ) {
    loan.status = "completed";
  } else if (loan.status === "pending") {
    loan.status = "repaying";
  }

  // Respond with updated loan so frontends can refresh their views
  res.json({ loan });
});

// Manager verifies a loan account (pending_verification -> pending_approval)
app.post("/api/loans/:id/verify", ensureAuth, (req, res) => {
  const headerRole = req.headers["x-impersonated-role"];
  const role = ALLOWED_ROLES.includes(headerRole) ? headerRole : req.user.role;
  if (role !== "manager") {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const loan = loanStore.find((item) => item.id === id);
  if (!loan) return res.status(404).json({ error: "loan not found" });
  if (loan.status !== "pending_verification") {
    return res
      .status(400)
      .json({ error: "loan is not in pending verification status" });
  }
  loan.status = "pending_approval";
  loan.verifiedAt = new Date().toISOString().split("T")[0];
  res.json({ loan });
});

// Manager rejects a loan account (pending_verification -> rejected)
app.post("/api/loans/:id/reject", ensureAuth, (req, res) => {
  const headerRole = req.headers["x-impersonated-role"];
  const role = ALLOWED_ROLES.includes(headerRole) ? headerRole : req.user.role;
  if (role !== "manager") {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const loan = loanStore.find((item) => item.id === id);
  if (!loan) return res.status(404).json({ error: "loan not found" });
  if (loan.status !== "pending_verification") {
    return res
      .status(400)
      .json({ error: "loan is not in pending verification status" });
  }
  loan.status = "rejected";
  res.json({ loan });
});

// Admin disburses a loan (pending_approval -> disbursed)
app.post("/api/loans/:id/decision", ensureAuth, (req, res) => {
  const headerRole = req.headers["x-impersonated-role"];
  const role = ALLOWED_ROLES.includes(headerRole) ? headerRole : req.user.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const { decision, customRate } = req.body;
  const loan = loanStore.find((item) => item.id === id);
  if (!loan) return res.status(404).json({ error: "loan not found" });
  if (loan.status !== "pending_approval") {
    return res
      .status(400)
      .json({ error: "loan must be verified by manager first" });
  }
  if (decision === "approve") {
    const rate = Number(customRate ?? loan.rate);
    const calc = computeLoanPayload(loan.principal, rate, loan.tenor);
    loan.rate = rate;
    loan.calc = calc;
    loan.schedule = Array.from({ length: loan.tenor }, (_, i) => ({
      day: i + 1,
      amount: +(calc.Ltotal / loan.tenor).toFixed(2),
    }));
    loan.status = "disbursed";
    loan.disbursedAt = new Date().toISOString().split("T")[0];
  } else {
    loan.status = "rejected";
  }
  res.json({ loan });
});

// MPESA STK Push trigger (server-side request to Safaricom)
app.post("/api/mpesa/stkpush", ensureAuth, async (req, res) => {
  try {
    const { phone, amount, accountRef, description } = req.body;
    const r = await mpesa.sendStkPush({
      phone,
      amount,
      accountRef,
      description,
    });
    // record initiation in transactions table
    try {
      await db.query(
        "INSERT INTO transactions(loan_id, user_id, type, amount, external_ref, metadata) VALUES($1,$2,$3,$4,$5,$6)",
        [
          null,
          req.user.id,
          "stk_push_init",
          amount,
          r.CheckoutRequestID || null,
          r,
        ],
      );
    } catch (err) {
      console.warn("failed to record transaction", err.message);
    }
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// MPESA B2C Disbursement (admin to customer)
app.post("/api/mpesa/b2c", ensureAuth, async (req, res) => {
  const headerRole = req.headers["x-impersonated-role"];
  const role = ALLOWED_ROLES.includes(headerRole) ? headerRole : req.user.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const { phone, amount, loanId, description } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ error: "missing phone or amount" });
    }

    // In production, this would call M-Pesa B2C API
    // For now, we'll simulate successful disbursement
    const disbursementRef = `B2C${Date.now()}`;

    // Record disbursement transaction
    const loan = loanStore.find((l) => l.id === loanId);
    if (loan) {
      const tx = {
        id: `TX${Date.now()}`,
        time: new Date().toISOString(),
        amount: Number(amount),
        method: "b2c_paybill",
        external_ref: disbursementRef,
        by: req.user.username,
        status: "initiated",
      };
      loan.transactions = loan.transactions || [];
      loan.transactions.push(tx);
    }

    res.json({
      success: true,
      reference: disbursementRef,
      amount,
      phone,
      message: `B2C disbursement initiated to ${phone} for KES ${amount}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// MPESA callback endpoint for STK and B2C
app.post("/api/mpesa/callback", (req, res) => {
  const ok = mpesa.verifyCallback(req);
  if (!ok) return res.status(403).json({ error: "verification failed" });
  // persist callback payload
  (async () => {
    try {
      await db.query(
        "INSERT INTO transactions(loan_id, user_id, type, amount, external_ref, metadata) VALUES($1,$2,$3,$4,$5,$6)",
        [null, null, "mpesa_callback", null, null, req.body],
      );
    } catch (err) {
      console.warn("failed to persist callback", err.message);
    }
  })();
  console.log("MPESA callback", JSON.stringify(req.body).slice(0, 200));
  res.json({ result: "received" });
});

// Loan calc and persistence
app.post("/api/loans/calc", ensureAuth, async (req, res) => {
  const { P, d, n } = req.body;
  const Fdeduct = +(P * d).toFixed(2);
  const Adisburse = +(P - Fdeduct).toFixed(2);
  const Ltotal = +(P * (1 + d)).toFixed(2);
  const Rdaily = +(Ltotal / n).toFixed(2);
  res.json({ P, d, n, Fdeduct, Adisburse, Ltotal, Rdaily });
});

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () =>
  console.log("Backend listening on", port),
);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Set PORT to a free port or stop the process using it.`,
    );
    process.exit(1);
  }
  throw err;
});

module.exports = app;
