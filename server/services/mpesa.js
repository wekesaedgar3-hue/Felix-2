const fetch = require("node-fetch");
const dotenv = require("dotenv");
dotenv.config();

const DARJA_OAUTH =
  process.env.MPESA_OAUTH_URL ||
  "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const DARJA_STK =
  process.env.MPESA_STK_URL ||
  "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

async function getAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("MPESA credentials not configured");
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const resp = await fetch(DARJA_OAUTH, {
    headers: { Authorization: `Basic ${basic}` },
  });
  const j = await resp.json();
  return j.access_token;
}

async function sendStkPush({ phone, amount, accountRef, description }) {
  const token = await getAccessToken();
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  const shortcode = process.env.MPESA_SHORTCODE || "174379";
  const passkey = process.env.MPESA_PASSKEY || "";
  let password = process.env.MPESA_STK_PASSWORD || "";
  if (passkey && shortcode) {
    password = Buffer.from(shortcode + passkey + timestamp).toString("base64");
  }
  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL:
      process.env.MPESA_CALLBACK_URL ||
      "https://example.com/api/mpesa/callback",
    AccountReference: accountRef || "FelixLoan",
    TransactionDesc: description || "Loan repayment",
  };
  const resp = await fetch(DARJA_STK, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return resp.json();
}

function verifyCallback(req) {
  // Simple verification: check a shared secret header if configured
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (secret) {
    const h =
      req.headers["x-mpesa-callback-secret"] ||
      req.headers["x-callback-secret"];
    return h === secret;
  }
  return true;
}

module.exports = { getAccessToken, sendStkPush, verifyCallback };
