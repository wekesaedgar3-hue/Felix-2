import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { computeLoan, amortizationSchedule } from "../utils/loan";

// ─── Mock shared loan store (replace with your real context/API) ──────────────
let _loanStore = [];
export const getLoanStore = () => _loanStore;
export const addToLoanStore = (loan) => {
  _loanStore = [loan, ..._loanStore];
};

// ─── M-Pesa API simulation (wire to real Daraja API) ─────────────────────────
const mpesaAPI = {
  stkPush: async ({ phone, amount, ref }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          CheckoutRequestID: "ws_CO_" + Date.now(),
          CustomerMessage: "Success. Request accepted for processing",
          phone,
          amount,
          ref,
        });
      }, 2000);
    });
  },
  queryStatus: async (checkoutId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          checkoutId,
        });
      }, 1500);
    });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const today = () => new Date().toISOString().split("T")[0];
const addDays = (d, n) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
};

async function apiFetch(path, token, options = {}) {
  const opts = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };
  if (token) {
    opts.headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(path, opts);
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json.error || "API request failed");
  }
  return json;
}

const STATUS_META = {
  pending_verification: {
    label: "Verification Pending",
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  pending_approval: {
    label: "Awaiting Disbursement",
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  pending: {
    label: "Pending Review",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  disbursed: {
    label: "Disbursed",
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  repaying: {
    label: "Repaying",
    bg: "bg-violet-100",
    text: "text-violet-700",
    dot: "bg-violet-500",
  },
  completed: {
    label: "Completed",
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 ${accent} text-white`}
    >
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white opacity-10" />
      <div className="absolute -bottom-6 -right-2 w-28 h-28 rounded-full bg-white opacity-5" />
      <div className="relative z-10">
        <div className="text-2xl mb-2">{icon}</div>
        <div className="text-2xl font-bold font-display">{value}</div>
        <div className="text-sm font-medium opacity-90 mt-0.5">{label}</div>
        {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function NavItem({ id, icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
        active
          ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30"
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      }`}
    >
      <span className="text-base w-5 flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-slate-900 text-amber-400" : "bg-amber-500 text-slate-900"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── SECTION: Loan Calculator & Application ───────────────────────────────────
function LoanApplicationSection({ onApply, activeLoans }) {
  const [step, setStep] = useState(1);
  const [principal, setPrincipal] = useState(2000);
  const [rate, setRate] = useState(0.1);
  const [tenor, setTenor] = useState(20);
  const [schedule_type, setScheduleType] = useState("daily");
  const [purpose, setPurpose] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const calc = computeLoan({
    P: Number(principal),
    d: Number(rate),
    n: Number(tenor),
  });
  const schedule = amortizationSchedule({
    P: Number(principal),
    d: Number(rate),
    n: Number(tenor),
  });

  const scheduleRows =
    schedule_type === "daily"
      ? schedule
      : schedule_type === "weekly"
        ? schedule.filter(
            (_, i) => (i + 1) % 7 === 0 || i === schedule.length - 1,
          )
        : [{ day: tenor, amount: calc.totalPayable }];

  const canApply =
    activeLoans.filter((l) =>
      ["pending", "approved", "disbursed", "repaying"].includes(l.status),
    ).length === 0;

  const handleSubmit = async () => {
    if (!principal || !tenor || !purpose.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      await onApply({
        principal: Number(principal),
        deduction_rate: Number(rate),
        tenor_days: Number(tenor),
        schedule_type,
        purpose,
        phone,
      });
      setSubmitted(true);
      setPurpose("");
      setPhone("");
      setStep(1);
      setTimeout(() => {
        setSubmitted(false);
      }, 3000);
    } catch (err) {
      console.error("Loan submit failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl animate-bounce">
          <svg
            className="w-10 h-10 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800 font-display">
          Application Submitted!
        </h3>
        <p className="text-slate-500 text-center max-w-sm">
          Your loan application has been sent for review. You will be notified
          once it is approved.
        </p>
        <StatusBadge status="pending" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s ? "bg-amber-500 text-slate-900" : "bg-slate-200 text-slate-400"}`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-1 rounded-full transition-all ${step > s ? "bg-amber-500" : "bg-slate-200"}`}
              />
            )}
          </React.Fragment>
        ))}
        <div className="ml-2 text-sm text-slate-500">
          {step === 1
            ? "Loan Parameters"
            : step === 2
              ? "Payment Schedule"
              : "Review & Submit"}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Loan Amount (KES)
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_240px] items-center">
              <input
                type="number"
                min="500"
                max="100000"
                step="100"
                value={principal}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setPrincipal(
                    Number.isNaN(value)
                      ? 500
                      : Math.max(500, Math.min(100000, value)),
                  );
                }}
                className="w-full border-2 border-slate-200 focus:border-amber-400 rounded-2xl px-4 py-3 text-slate-800 outline-none transition"
                placeholder="Enter loan amount"
              />
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <input
                  type="range"
                  min="500"
                  max="100000"
                  step="500"
                  value={principal}
                  onChange={(e) => setPrincipal(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>KES 500</span>
              <span>KES 100,000</span>
            </div>
            <div className="text-3xl font-bold text-slate-800 font-display">
              KES {fmt(principal)}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Deduction Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full border-2 border-slate-200 focus:border-amber-400 rounded-xl px-4 py-3 text-slate-800 outline-none transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  {(rate * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Set by admin — displayed for reference
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Loan Tenor (days)
              </label>
              <input
                type="number"
                min="5"
                max="365"
                value={tenor}
                onChange={(e) => setTenor(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-amber-400 rounded-xl px-4 py-3 text-slate-800 outline-none transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Loan Purpose
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              placeholder="Briefly describe why you need this loan..."
              className="w-full border-2 border-slate-200 focus:border-amber-400 rounded-xl px-4 py-3 text-slate-800 outline-none transition resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Daily Payment</div>
              <div className="font-bold text-slate-800">
                KES {fmt(calc.dailyPayment)}
              </div>
            </div>
            <div className="text-center border-x border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Total Interest</div>
              <div className="font-bold text-amber-600">
                KES {fmt(calc.totalInterest)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Total Payable</div>
              <div className="font-bold text-slate-800">
                KES {fmt(calc.totalPayable)}
              </div>
            </div>
          </div>
          {!canApply && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              You have an active loan. Please complete repayment before applying
              again.
            </div>
          )}
          <button
            disabled={!purpose.trim() || !canApply}
            onClick={() => setStep(2)}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/20"
          >
            Continue to Payment Schedule
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Repayment Schedule
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  v: "daily",
                  label: "Daily",
                  sub: `KES ${fmt(calc.dailyPayment)}/day`,
                },
                {
                  v: "weekly",
                  label: "Weekly",
                  sub: `KES ${fmt(calc.dailyPayment * 7)}/wk`,
                },
                {
                  v: "monthly",
                  label: "Monthly",
                  sub: `KES ${fmt(calc.totalPayable)}/mo`,
                },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setScheduleType(opt.v)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${schedule_type === opt.v ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-amber-300"}`}
                >
                  <div
                    className={`font-bold text-sm ${schedule_type === opt.v ? "text-amber-700" : "text-slate-700"}`}
                  >
                    {opt.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{opt.sub}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Auto-deduction will prompt your M-Pesa PIN on each due date
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              M-Pesa Phone Number
            </label>
            <div className="flex">
              <span className="bg-slate-100 border-2 border-r-0 border-slate-200 rounded-l-xl px-3 flex items-center text-slate-600 text-sm font-medium">
                +254
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="7XXXXXXXX"
                className="flex-1 border-2 border-slate-200 focus:border-amber-400 rounded-r-xl px-4 py-3 text-slate-800 outline-none transition"
              />
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-sm">
                Repayment Preview
              </span>
              <span className="text-xs text-slate-400">
                {scheduleRows.length} installments
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">
                      Period
                    </th>
                    <th className="px-4 py-2 text-right text-xs text-slate-400 font-medium">
                      Amount (KES)
                    </th>
                    <th className="px-4 py-2 text-right text-xs text-slate-400 font-medium">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map((s, i) => (
                    <tr
                      key={i}
                      className="border-t border-slate-100 hover:bg-slate-100"
                    >
                      <td className="px-4 py-2 text-slate-700">
                        {schedule_type === "daily"
                          ? `Day ${s.day}`
                          : schedule_type === "weekly"
                            ? `Week ${i + 1}`
                            : "Full Amount"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800">
                        {fmt(s.amount)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-400 text-xs">
                        {addDays(today(), s.day)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:border-slate-300 transition"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!phone.trim()}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 font-bold rounded-xl transition shadow-lg shadow-amber-500/20"
            >
              Review Application
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-4">
              Loan Summary
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Principal", `KES ${fmt(principal)}`],
                ["Interest Rate", `${(rate * 100).toFixed(0)}%`],
                ["Tenor", `${tenor} days`],
                [
                  "Schedule",
                  schedule_type.charAt(0).toUpperCase() +
                    schedule_type.slice(1),
                ],
                ["Daily Payment", `KES ${fmt(calc.dailyPayment)}`],
                ["Total Interest", `KES ${fmt(calc.totalInterest)}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-slate-400">{k}</div>
                  <div className="font-semibold text-sm mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
              <span className="text-slate-300">Total Payable</span>
              <span className="text-2xl font-bold text-amber-400 font-display">
                KES {fmt(calc.totalPayable)}
              </span>
            </div>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            By submitting, you agree that M-Pesa auto-deductions will occur on
            each due date. Ensure sufficient funds are available on +254{phone}.
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:border-slate-300 transition"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      strokeWidth="4"
                      strokeOpacity="0.25"
                    />
                    <path d="M22 12a10 10 0 00-10-10" strokeWidth="4" />
                  </svg>
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECTION: My Loans ────────────────────────────────────────────────────────
function MyLoansSection({ loans, onPayNow }) {
  const [expanded, setExpanded] = useState(null);
  if (!loans.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-700">No loans yet</h3>
        <p className="text-slate-400 text-sm mt-1">
          Apply for a loan to get started
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {loans.map((loan) => {
        const progress = loan.calc?.totalPayable
          ? Math.min(100, (loan.paidAmount / loan.calc.totalPayable) * 100)
          : 0;
        const isOpen = expanded === loan.id;
        return (
          <div
            key={loan.id}
            className="border border-slate-200 rounded-2xl overflow-hidden hover:border-amber-300 transition-all"
          >
            <div
              className="p-4 cursor-pointer flex items-center gap-4"
              onClick={() => setExpanded(isOpen ? null : loan.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800 font-display">
                    {loan.id}
                  </span>
                  <StatusBadge status={loan.status} />
                </div>
                <div className="text-sm text-slate-500">
                  KES {fmt(loan.principal)} &bull; {loan.tenor} days &bull;{" "}
                  {loan.schedule_type}
                </div>
                {["disbursed", "repaying"].includes(loan.status) && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Repaid: KES {fmt(loan.paidAmount)}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-amber-400 rounded-full transition-all duration-700"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
            {isOpen && (
              <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
                  {[
                    ["Applied", loan.appliedAt],
                    ["Disbursed", loan.disbursedAt || "Pending"],
                    ["Daily Rate", `KES ${fmt(loan.calc?.dailyPayment)}`],
                    ["Total Payable", `KES ${fmt(loan.calc?.totalPayable)}`],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="bg-white rounded-xl p-3 border border-slate-100"
                    >
                      <div className="text-xs text-slate-400">{k}</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-4">
                  <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Schedule Preview
                  </div>
                  <div className="max-h-36 overflow-y-auto">
                    {(loan.schedule || []).slice(0, 10).map((s, i) => (
                      <div
                        key={i}
                        className="flex justify-between px-3 py-2 text-xs border-b border-slate-50 last:border-0"
                      >
                        <span className="text-slate-500">
                          {loan.schedule_type === "daily"
                            ? `Day ${s.day}`
                            : loan.schedule_type === "weekly"
                              ? `Week ${i + 1}`
                              : "Full"}
                        </span>
                        <span className="font-medium text-slate-800">
                          KES {fmt(s.amount)}
                        </span>
                        <span className="text-slate-400">
                          {addDays(loan.appliedAt, s.day)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {["disbursed", "repaying"].includes(loan.status) && (
                  <button
                    onClick={() => onPayNow(loan)}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition shadow-lg shadow-amber-500/20"
                  >
                    Make Payment via M-Pesa
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SECTION: Payment Module (M-Pesa STK Push) ───────────────────────────────
function PaymentSection({ loans, onPaymentComplete }) {
  const disbursedLoans = loans.filter((l) =>
    ["disbursed", "repaying"].includes(l.status),
  );
  const [selectedLoan, setSelectedLoan] = useState(disbursedLoans[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("mpesa");
  const [stage, setStage] = useState("idle"); // idle | pushing | pin_wait | confirming | success | error
  const [result, setResult] = useState(null);
  const [pinDigits, setPinDigits] = useState(["", "", "", "", ""]);
  const pinRefs = useRef([]);

  const loan = disbursedLoans.find((l) => l.id === selectedLoan);
  const remaining = loan ? loan.calc.totalPayable - loan.paidAmount : 0;

  const handlePinChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pinDigits];
    next[i] = val;
    setPinDigits(next);
    if (val && i < 4) pinRefs.current[i + 1]?.focus();
  };

  const handlePay = async () => {
    if (!loan || !phone.trim() || !amount) return;
    setStage("pushing");
    const resp = await mpesaAPI.stkPush({
      phone: `+254${phone}`,
      amount: Number(amount),
      ref: selectedLoan,
    });
    if (resp.success) {
      setStage("pin_wait");
    } else {
      setStage("error");
    }
  };

  const handlePinSubmit = async () => {
    if (pinDigits.some((d) => d === "")) return;
    setStage("confirming");
    const status = await mpesaAPI.queryStatus(
      result?.CheckoutRequestID || "test",
    );
    if (status.ResultCode === 0) {
      onPaymentComplete(selectedLoan, Number(amount));
      setResult({ ...status, amount, phone });
      setStage("success");
    } else {
      setStage("error");
    }
  };

  const reset = () => {
    setStage("idle");
    setAmount("");
    setPinDigits(["", "", "", "", ""]);
    setResult(null);
  };

  if (!disbursedLoans.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-700">
          No active loans for payment
        </h3>
        <p className="text-slate-400 text-sm mt-1">
          Disbursed loans will appear here
        </p>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-5">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-30" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-slate-800 font-display">
            Payment Successful!
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            KES {fmt(result?.amount)} received
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            Your payment has been recorded and visible to admin/manager/employer
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-center w-full max-w-xs">
          <div className="text-emerald-700 font-semibold mb-2">
            Transaction Reference
          </div>
          <div className="font-mono text-xs text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-lg">
            {result?.checkoutId || "TXN" + Date.now()}
          </div>
        </div>
        <button
          onClick={reset}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition"
        >
          Make Another Payment
        </button>
      </div>
    );
  }

  if (stage === "pin_wait") {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-6 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-800 font-display">
            Enter M-Pesa PIN
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            A request of <strong>KES {fmt(amount)}</strong> has been sent to
            +254{phone}
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Enter your M-Pesa PIN to authorize
          </p>
        </div>
        <div className="flex gap-3">
          {pinDigits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (pinRefs.current[i] = el)}
              type="password"
              maxLength={1}
              value={d}
              onChange={(e) => handlePinChange(i, e.target.value)}
              className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-200 focus:border-amber-400 rounded-xl outline-none transition bg-white"
            />
          ))}
        </div>
        <button
          onClick={handlePinSubmit}
          disabled={pinDigits.some((d) => d === "") || stage === "confirming"}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition"
        >
          {stage === "confirming" ? "Confirming..." : "Authorize Payment"}
        </button>
        <button
          onClick={reset}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex gap-3">
        {[
          { v: "mpesa", label: "M-Pesa" },
          { v: "bank", label: "Bank Transfer" },
        ].map((m) => (
          <button
            key={m.v}
            onClick={() => setMethod(m.v)}
            className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${method === m.v ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:border-amber-300"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Select Loan
        </label>
        <select
          value={selectedLoan}
          onChange={(e) => setSelectedLoan(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-amber-400 rounded-xl px-4 py-3 text-slate-800 outline-none transition bg-white"
        >
          {disbursedLoans.map((l) => (
            <option key={l.id} value={l.id}>
              {l.id} — KES {fmt(l.principal)} (Remaining: KES{" "}
              {fmt(l.calc.totalPayable - l.paidAmount)})
            </option>
          ))}
        </select>
      </div>

      {loan && (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          {[
            ["Total", `KES ${fmt(loan.calc.totalPayable)}`],
            ["Paid", `KES ${fmt(loan.paidAmount)}`],
            ["Remaining", `KES ${fmt(remaining)}`],
          ].map(([k, v]) => (
            <div
              key={k}
              className="bg-slate-50 border border-slate-100 rounded-xl p-3"
            >
              <div className="text-xs text-slate-400">{k}</div>
              <div className="font-bold text-slate-800 text-xs mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Amount to Pay (KES)
        </label>
        <div className="flex gap-2 mb-2">
          {loan &&
            [
              { label: "Daily", val: loan.calc.dailyPayment },
              { label: "Full", val: remaining },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setAmount(String(Math.ceil(opt.val)))}
                className="px-3 py-1.5 text-xs font-semibold border-2 border-slate-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 text-slate-600 transition"
              >
                {opt.label}: KES {fmt(opt.val)}
              </button>
            ))}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className="w-full border-2 border-slate-200 focus:border-amber-400 rounded-xl px-4 py-3 text-slate-800 outline-none transition"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          {method === "mpesa" ? "M-Pesa Phone Number" : "Bank Account Number"}
        </label>
        {method === "mpesa" ? (
          <div className="flex">
            <span className="bg-slate-100 border-2 border-r-0 border-slate-200 rounded-l-xl px-3 flex items-center text-slate-600 text-sm font-medium">
              +254
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="7XXXXXXXX"
              className="flex-1 border-2 border-slate-200 focus:border-amber-400 rounded-r-xl px-4 py-3 text-slate-800 outline-none transition"
            />
          </div>
        ) : (
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter bank account number"
            className="w-full border-2 border-slate-200 focus:border-amber-400 rounded-xl px-4 py-3 text-slate-800 outline-none transition"
          />
        )}
      </div>

      {method === "mpesa" && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs">
          <svg
            className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Payments are secured and processed via Safaricom Daraja M-Pesa API
          (STK Push). An M-Pesa prompt will be sent to your phone.
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!amount || !phone.trim() || stage === "pushing" || !loan}
        className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
      >
        {stage === "pushing" ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                strokeWidth="4"
                strokeOpacity="0.25"
              />
              <path d="M22 12a10 10 0 00-10-10" strokeWidth="4" />
            </svg>
            Sending STK Push...
          </>
        ) : (
          `Pay KES ${amount ? fmt(amount) : "0.00"} via ${method === "mpesa" ? "M-Pesa" : "Bank"}`
        )}
      </button>
    </div>
  );
}

// ─── SECTION: Transaction History ─────────────────────────────────────────────
function TransactionsSection({ transactions }) {
  if (!transactions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-700">No transactions yet</h3>
        <p className="text-slate-400 text-sm mt-1">
          Your payment history will appear here
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {transactions.map((tx, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-amber-300 transition"
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === "payment" ? "bg-emerald-100" : "bg-blue-100"}`}
          >
            <svg
              className={`w-5 h-5 ${tx.type === "payment" ? "text-emerald-600" : "text-blue-600"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {tx.type === "payment" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 13l-5 5m0 0l-5-5m5 5V6"
                />
              )}
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 text-sm">
              {tx.description}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {tx.date} &bull; Ref: {tx.ref}
            </div>
          </div>
          <div
            className={`font-bold ${tx.type === "payment" ? "text-emerald-600" : "text-blue-600"}`}
          >
            {tx.type === "payment" ? "-" : "+"} KES {fmt(tx.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: Auto-Pay Settings ───────────────────────────────────────────────
function AutoPaySection({ loans }) {
  const [autoPaySettings, setAutoPaySettings] = useState({});
  const activeLoan = loans.find((l) =>
    ["disbursed", "repaying"].includes(l.status),
  );

  const toggle = (loanId) => {
    setAutoPaySettings((prev) => ({ ...prev, [loanId]: !prev[loanId] }));
  };

  if (!activeLoan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-700">No active loans</h3>
        <p className="text-slate-400 text-sm mt-1">
          Auto-pay settings will appear for disbursed loans
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-800 mb-1">Automated Repayment</h3>
        <p className="text-slate-600 text-sm">
          Enable auto-pay to have your M-Pesa account automatically debited on
          each due date. You will receive a PIN prompt notification.
        </p>
      </div>
      <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-800">{activeLoan.id}</div>
            <div className="text-sm text-slate-500 mt-0.5">
              KES {fmt(activeLoan.calc.dailyPayment)} /{" "}
              {activeLoan.schedule_type}
            </div>
          </div>
          <button
            onClick={() => toggle(activeLoan.id)}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${autoPaySettings[activeLoan.id] ? "bg-amber-500" : "bg-slate-200"}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${autoPaySettings[activeLoan.id] ? "left-8" : "left-1"}`}
            />
          </button>
        </div>
        {autoPaySettings[activeLoan.id] && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-xl">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Auto-pay enabled. You will be prompted for your M-Pesa PIN on each{" "}
              {activeLoan.schedule_type} due date.
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-400">Next Due Date</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {addDays(
                    today(),
                    activeLoan.schedule_type === "daily"
                      ? 1
                      : activeLoan.schedule_type === "weekly"
                        ? 7
                        : 30,
                  )}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-400">Auto-debit Amount</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  KES {fmt(activeLoan.calc.dailyPayment)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="text-xs text-slate-400 flex items-start gap-2">
        <svg
          className="w-4 h-4 flex-shrink-0 text-slate-400 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        Ensure your M-Pesa account has sufficient balance on each due date.
        Insufficient funds will trigger a failed payment notification.
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function DashboardCustomer() {
  const { user, token, logout } = useAuth();
  const [activeNav, setActiveNav] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loans, setLoans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [payTarget, setPayTarget] = useState(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const data = await apiFetch("/api/loans/user", token);
        setLoans(data.loans || []);
      } catch (err) {
        console.warn("Failed to load loans", err.message);
      }
    };
    load();
  }, [token]);

  const handleApply = async (loanRequest) => {
    if (!token) return;
    try {
      const data = await apiFetch("/api/loans/apply", token, {
        method: "POST",
        body: JSON.stringify(loanRequest),
      });
      const loan = data.loan;
      setLoans((prev) => [loan, ...prev]);
      setTransactions((prev) => [
        {
          type: "loan",
          description: `Loan Application — ${loan.id}`,
          amount: loan.principal,
          date: today(),
          ref: loan.id,
        },
        ...prev,
      ]);
      setActiveNav("my-loans");
    } catch (err) {
      console.error("Loan application failed", err.message);
      alert(err.message);
    }
  };

  const handlePaymentComplete = (loanId, amount) => {
    (async () => {
      const authToken = token;
      try {
        const resp = await apiFetch(`/api/loans/${loanId}/pay`, authToken, {
          method: "POST",
          body: JSON.stringify({ amount, method: "mpesa" }),
        });
        const updated = resp.loan;
        setLoans((prev) => prev.map((l) => (l.id === loanId ? updated : l)));
        setTransactions((prev) => [
          {
            type: "payment",
            description: `Loan Repayment — ${loanId}`,
            amount,
            date: today(),
            ref: resp.loan.transactions?.slice(-1)[0]?.id || "TXN" + Date.now(),
          },
          ...prev,
        ]);
      } catch (err) {
        console.warn(
          "Failed to record payment via API, falling back to local update",
          err.message,
        );
        setLoans((prev) =>
          prev.map((l) => {
            if (l.id !== loanId) return l;
            const newPaid = l.paidAmount + amount;
            return {
              ...l,
              paidAmount: newPaid,
              status: newPaid >= l.calc.totalPayable ? "completed" : "repaying",
            };
          }),
        );
        setTransactions((prev) => [
          {
            type: "payment",
            description: `Loan Repayment — ${loanId}`,
            amount,
            date: today(),
            ref: "TXN" + Date.now(),
          },
          ...prev,
        ]);
      }
    })();
  };

  const handlePayNow = (loan) => {
    setPayTarget(loan);
    setActiveNav("payment");
  };

  const activeLoanCount = loans.filter((l) =>
    ["pending", "approved", "disbursed", "repaying"].includes(l.status),
  ).length;
  const totalBorrowed = loans.reduce((s, l) => s + l.principal, 0);
  const totalPaid = loans.reduce((s, l) => s + l.paidAmount, 0);
  const totalOutstanding = loans.reduce(
    (s, l) => s + Math.max(0, l.calc?.totalPayable - l.paidAmount),
    0,
  );

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7h18M3 12h18M3 17h18"
          />
        </svg>
      ),
    },
    {
      id: "apply",
      label: "Apply for Loan",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      ),
    },
    {
      id: "my-loans",
      label: "My Loans",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      badge: activeLoanCount || null,
    },
    {
      id: "payment",
      label: "Make Payment",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
      ),
    },
    {
      id: "auto-pay",
      label: "Auto-Pay",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: "history",
      label: "Transactions",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      badge: transactions.length || null,
    },
  ];

  const sectionTitle =
    navItems.find((n) => n.id === activeNav)?.label || "Overview";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        * { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #f59e0b; border-radius: 99px; }
        .sidebar-overlay { backdrop-filter: blur(4px); }
      `}</style>

      <div className="min-h-screen bg-slate-50 flex">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 sidebar-overlay z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ──────────────────────────────────────── */}
        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-slate-900 flex flex-col z-40 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          {/* Logo */}
          <div className="px-5 py-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-slate-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <div className="font-display font-bold text-white text-lg leading-none">
                  Felix
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Microfinance
                </div>
              </div>
            </div>
          </div>

          {/* User pill */}
          <div className="px-4 py-4 border-b border-slate-800">
            <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-sm">
                {(user?.username || "C")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {user?.username || "Customer"}
                </div>
                <div className="text-xs text-slate-400 capitalize">
                  {user?.role || "customer"}
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.id}
                id={item.id}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                active={activeNav === item.id}
                onClick={(id) => {
                  setActiveNav(id);
                  setSidebarOpen(false);
                }}
              />
            ))}
          </nav>

          {/* Logout */}
          <div className="px-3 py-4 border-t border-slate-800">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────── */}
        <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
          {/* Topbar */}
          <header className="sticky top-0 z-20 bg-white border-b border-slate-100 px-4 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
              >
                <svg
                  className="w-5 h-5 text-slate-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 font-display">
                  {sectionTitle}
                </h1>
                <p className="text-xs text-slate-400">
                  Customer Portal &mdash; Felix Microfinance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-medium text-amber-700">
                  Portal Active
                </span>
              </div>
              <button
                onClick={() => setActiveNav("apply")}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm rounded-xl transition shadow-md shadow-amber-500/20"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Apply
              </button>
            </div>
          </header>

          {/* Page body */}
          <main className="flex-1 px-4 lg:px-8 py-6">
            {/* ── OVERVIEW ─────────────────────────────────── */}
            {activeNav === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    }
                    label="Total Borrowed"
                    value={`KES ${fmt(totalBorrowed)}`}
                    accent="bg-gradient-to-br from-slate-800 to-slate-900"
                  />
                  <StatCard
                    icon={
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    }
                    label="Total Paid"
                    value={`KES ${fmt(totalPaid)}`}
                    accent="bg-gradient-to-br from-emerald-600 to-emerald-700"
                  />
                  <StatCard
                    icon={
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    }
                    label="Outstanding"
                    value={`KES ${fmt(totalOutstanding)}`}
                    accent="bg-gradient-to-br from-amber-500 to-orange-500"
                  />
                  <StatCard
                    icon={
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    }
                    label="Active Loans"
                    value={activeLoanCount}
                    sub={`${loans.length} total`}
                    accent="bg-gradient-to-br from-violet-600 to-violet-700"
                  />
                </div>

                {loans.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-amber-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-display font-bold text-slate-800 text-xl mb-2">
                      Welcome to Felix
                    </h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                      Get started by applying for a loan. Funds are disbursed
                      directly to your M-Pesa account after approval.
                    </p>
                    <button
                      onClick={() => setActiveNav("apply")}
                      className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition shadow-lg shadow-amber-500/20"
                    >
                      Apply for Your First Loan
                    </button>
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-display font-bold text-slate-800">
                          Recent Loans
                        </h2>
                        <button
                          onClick={() => setActiveNav("my-loans")}
                          className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
                        >
                          View all
                        </button>
                      </div>
                      <div className="space-y-3">
                        {loans.slice(0, 3).map((loan) => (
                          <div
                            key={loan.id}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-800">
                                  {loan.id}
                                </span>
                                <StatusBadge status={loan.status} />
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                KES {fmt(loan.principal)} &bull;{" "}
                                {loan.appliedAt}
                              </div>
                            </div>
                            {["disbursed", "repaying"].includes(
                              loan.status,
                            ) && (
                              <button
                                onClick={() => handlePayNow(loan)}
                                className="text-xs px-3 py-1.5 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition flex-shrink-0"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-display font-bold text-slate-800">
                          Recent Transactions
                        </h2>
                        <button
                          onClick={() => setActiveNav("history")}
                          className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
                        >
                          View all
                        </button>
                      </div>
                      <div className="space-y-2">
                        {transactions.slice(0, 5).map((tx, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === "payment" ? "bg-emerald-100" : "bg-blue-100"}`}
                            >
                              <svg
                                className={`w-3.5 h-3.5 ${tx.type === "payment" ? "text-emerald-600" : "text-blue-600"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d={
                                    tx.type === "payment"
                                      ? "M7 11l5-5m0 0l5 5m-5-5v12"
                                      : "M17 13l-5 5m0 0l-5-5m5 5V6"
                                  }
                                />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">
                                {tx.description}
                              </div>
                              <div className="text-xs text-slate-400">
                                {tx.date}
                              </div>
                            </div>
                            <div
                              className={`text-xs font-bold ${tx.type === "payment" ? "text-emerald-600" : "text-blue-600"}`}
                            >
                              {tx.type === "payment" ? "-" : "+"}{" "}
                              {fmt(tx.amount)}
                            </div>
                          </div>
                        ))}
                        {!transactions.length && (
                          <div className="text-sm text-slate-400 text-center py-4">
                            No transactions yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTIONS ─────────────────────────────────── */}
            {activeNav !== "overview" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                {activeNav === "apply" && (
                  <LoanApplicationSection
                    onApply={handleApply}
                    activeLoans={loans}
                  />
                )}
                {activeNav === "my-loans" && (
                  <MyLoansSection loans={loans} onPayNow={handlePayNow} />
                )}
                {activeNav === "payment" && (
                  <PaymentSection
                    loans={loans}
                    preselected={payTarget?.id}
                    onPaymentComplete={(id, amt) => {
                      handlePaymentComplete(id, amt);
                      setPayTarget(null);
                    }}
                  />
                )}
                {activeNav === "auto-pay" && <AutoPaySection loans={loans} />}
                {activeNav === "history" && (
                  <TransactionsSection transactions={transactions} />
                )}
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="px-8 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Felix Microfinance &copy; {new Date().getFullYear()}</span>
            <span>Secured by M-Pesa Daraja API</span>
          </footer>
        </div>
      </div>
    </>
  );
}
