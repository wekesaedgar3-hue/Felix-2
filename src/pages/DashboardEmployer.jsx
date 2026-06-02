import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
          className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
            active
              ? "bg-slate-900 text-amber-400"
              : "bg-amber-500 text-slate-900"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default function DashboardEmployer() {
  const {
    user,
    realUser,
    logout,
    clearImpersonation,
    impersonatedRole,
    token,
  } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [loans, setLoans] = useState([]);
  const [notificationStatus, setNotificationStatus] = useState({});

  // Sync with Mock Shared Loan Store
  async function apiFetch(path, token, options = {}) {
    const opts = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(path, opts);
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json.error || "API request failed");
    return json;
  }

  useEffect(() => {
    let mounted = true;
    const fetchLoans = async () => {
      try {
        const authToken = token;
        const data = await apiFetch("/api/loans", authToken);
        if (!mounted) return;
        setLoans(data.loans || []);
      } catch (err) {
        console.warn("Unable to load loans", err.message);
      }
    };
    fetchLoans();
    const interval = setInterval(fetchLoans, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Employer action handlers
  const handleReviewLoan = (loanId, approve) => {
    // Updates internal application states directly
    const currentStore = getLoanStore();
    const updatedStore = currentStore.map((loan) => {
      if (loan.id === loanId) {
        return { ...loan, status: approve ? "approved" : "rejected" };
      }
      return loan;
    });
    // Direct manipulation of mock store array reference
    updatedStore.forEach((l, idx) => {
      currentStore[idx] = l;
    });
    setLoans([...updatedStore]);
  };

  const handleSendNotification = (loanId, customerPhone) => {
    setNotificationStatus((prev) => ({ ...prev, [loanId]: "sending" }));
    setTimeout(() => {
      setNotificationStatus((prev) => ({ ...prev, [loanId]: "sent" }));
      setTimeout(() => {
        setNotificationStatus((prev) => ({ ...prev, [loanId]: null }));
      }, 4000);
    }, 1500);
  };

  // Compute stats metrics dynamically
  const pendingReviews = loans.filter((l) => l.status === "pending");
  const activePortfolios = loans.filter((l) =>
    ["disbursed", "repaying"].includes(l.status),
  );

  const totalDisbursedPrincipal = activePortfolios.reduce(
    (acc, curr) => acc + curr.principal,
    0,
  );
  const totalPaidBack = activePortfolios.reduce(
    (acc, curr) => acc + (curr.paidAmount || 0),
    0,
  );
  const totalRemainingDebt = activePortfolios.reduce((acc, curr) => {
    const payable = curr.calc?.Ltotal || curr.principal;
    return acc + (payable - (curr.paidAmount || 0));
  }, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row antialiased">
      {/* ─── SIDEBAR BANNER ─────────────────────────────────────────────────── */}
      <aside className="w-full md:w-64 bg-slate-950 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-amber-500/20">
              ₣
            </div>
            <div>
              <div className="font-bold tracking-tight text-white leading-none">
                Felix
              </div>
              <div className="text-[10px] text-amber-500 font-semibold tracking-wider uppercase mt-0.5">
                Employer Dashboard
              </div>
            </div>
          </div>

          <nav className="space-y-1.5">
            <NavItem
              id="overview"
              label="Overview Console"
              icon="📊"
              active={activeTab === "overview"}
              onClick={setActiveTab}
            />
            <NavItem
              id="review"
              label="Review Loan Requests"
              icon="📑"
              active={activeTab === "review"}
              onClick={setActiveTab}
              badge={pendingReviews.length || null}
            />
            <NavItem
              id="payments"
              label="Customer Debts & Ledgers"
              icon="💳"
              active={activeTab === "payments"}
              onClick={setActiveTab}
            />
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 px-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {user?.username || "Employer"}
              </div>
              <div className="text-xs text-slate-400 capitalize truncate">
                {user?.role || "Corporate Partner"}
              </div>
            </div>
          </div>
          {impersonatedRole && realUser?.role === "admin" && (
            <button
              onClick={clearImpersonation}
              className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-semibold text-amber-300 hover:bg-amber-500/15 transition-all"
            >
              Stop Impersonation
            </button>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
          >
            退出 Secure Logout
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ─────────────────────────────────────────── */}
      <main className="flex-1 bg-slate-900 p-6 md:p-10 overflow-y-auto max-h-screen">
        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight font-display">
                Workspace Summary
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Monitored operational metrics, verification queues, and system
                integration data logs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon="⏳"
                label="Unprocessed Reviews"
                value={pendingReviews.length}
                accent="bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/10 shadow-lg"
              />
              <StatCard
                icon="💵"
                label="Active Funded Principal"
                value={`KES ${fmt(totalDisbursedPrincipal)}`}
                accent="bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/10 shadow-lg"
              />
              <StatCard
                icon="✅"
                label="Recovered Payments"
                value={`KES ${fmt(totalPaidBack)}`}
                accent="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/10 shadow-lg"
              />
              <StatCard
                icon="🚨"
                label="Total Outstanding Debt"
                value={`KES ${fmt(totalRemainingDebt)}`}
                accent="bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/10 shadow-lg"
              />
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-base font-bold text-white mb-2">
                Corporate Information System Notice
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                As a corporate workspace provider, you are granted authorization
                metrics matching internal parameters. You retain complete
                operational clearance to **Review and Validate requests** based
                on employer payroll criteria. Final liquidity execution and
                balance settlement distribution modules remain secured inside
                full-scale infrastructure access.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Review Applications */}
        {activeTab === "review" && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight font-display">
                Review Applications
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Approve user eligibility indicators based on operational salary
                matching. Disbursal permissions are isolated to admin tiers.
              </p>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-4 bg-slate-900 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Loan Verification Processing Queue
              </div>
              {pendingReviews.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No applications are currently awaiting review pipelines.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {pendingReviews.map((loan) => (
                    <div
                      key={loan.id}
                      className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 hover:bg-slate-900/50 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">
                            {loan.id}
                          </span>
                          <StatusBadge status={loan.status} />
                        </div>
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-300 font-medium">
                            Callback Phone:
                          </span>{" "}
                          +254{loan.phone} &bull;
                          <span className="ml-1 text-slate-300 font-medium">
                            Tenor:
                          </span>{" "}
                          {loan.tenor} days &bull;
                          <span className="ml-1 text-slate-300 font-medium">
                            Type:
                          </span>{" "}
                          {loan.schedule_type}
                        </p>
                        <p className="text-sm text-slate-300 italic pt-1">
                          "{loan.purpose || "No stated purpose"}"
                        </p>
                      </div>

                      <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            Requested Amount
                          </div>
                          <div className="text-lg font-bold text-amber-400">
                            KES {fmt(loan.principal)}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReviewLoan(loan.id, false)}
                            className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-xl text-xs hover:bg-red-500 hover:text-white transition"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleReviewLoan(loan.id, true)}
                            className="px-4 py-2 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/10"
                          >
                            Approve Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Customer Debts & Ledgers */}
        {activeTab === "payments" && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight font-display">
                Customer Debts & Repayments
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Real-time tracking of individual loan repayments, recovered
                balances, remaining liabilities, and automated reminder
                broadcasts.
              </p>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-4 bg-slate-900 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Active Client Debt Balances Ledger
              </div>
              {activePortfolios.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No active customer debt records found in system clusters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-bold text-slate-400 bg-slate-900/50">
                        <th className="p-4">Loan Reference ID</th>
                        <th className="p-4">Total Original Payable</th>
                        <th className="p-4">Recovered via M-Pesa</th>
                        <th className="p-4">Remaining Outstandings</th>
                        <th className="p-4">Liquidation Progress</th>
                        <th className="p-4 text-right">
                          Operational Reminders
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {activePortfolios.map((loan) => {
                        const originalPayable =
                          loan.calc?.Ltotal || loan.principal;
                        const totalPaid = loan.paidAmount || 0;
                        const remainingLiability = Math.max(
                          0,
                          originalPayable - totalPaid,
                        );
                        const recoveryPercent = Math.min(
                          100,
                          (totalPaid / originalPayable) * 100,
                        );

                        return (
                          <tr
                            key={loan.id}
                            className="hover:bg-slate-900/30 transition"
                          >
                            <td className="p-4 font-bold text-white">
                              <div>{loan.id}</div>
                              <div className="text-[10px] font-medium text-slate-500 tracking-tight">
                                Phone: +254{loan.phone}
                              </div>
                            </td>
                            <td className="p-4 font-medium text-slate-300">
                              KES {fmt(originalPayable)}
                            </td>
                            <td className="p-4 text-emerald-400 font-semibold">
                              KES {fmt(totalPaid)}
                            </td>
                            <td className="p-4 text-amber-400 font-bold">
                              KES {fmt(remainingLiability)}
                            </td>
                            <td className="p-4 min-w-[140px]">
                              <div className="flex items-center gap-2">
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-1.5 bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-500"
                                    style={{ width: `${recoveryPercent}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-slate-400">
                                  {recoveryPercent.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              {remainingLiability > 0 ? (
                                <button
                                  onClick={() =>
                                    handleSendNotification(loan.id, loan.phone)
                                  }
                                  disabled={
                                    notificationStatus[loan.id] === "sending" ||
                                    notificationStatus[loan.id] === "sent"
                                  }
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-all ${
                                    notificationStatus[loan.id] === "sent"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : notificationStatus[loan.id] ===
                                          "sending"
                                        ? "bg-slate-800 text-slate-500 border-slate-700 animate-pulse"
                                        : "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-slate-950"
                                  }`}
                                >
                                  {notificationStatus[loan.id] === "sent"
                                    ? "✓ Notified"
                                    : notificationStatus[loan.id] === "sending"
                                      ? "Sending..."
                                      : "⚠️ Issue Repayment Alert"}
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-slate-500 italic bg-slate-900/80 px-2 py-1 rounded-md">
                                  Settled Account
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
