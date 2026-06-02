import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export default function DashboardManager() {
  const {
    user,
    realUser,
    logout,
    clearImpersonation,
    impersonatedRole,
    token,
  } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Data State
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dynamic RBAC Local State (Synced from Backend Config)
  const [permissions, setPermissions] = useState({
    approveUsers: false,
    viewLedgers: false,
    overrideRates: false,
  });

  // Fetch initial allocations, verification data, and runtime configs
  useEffect(() => {
    if (!token) return;
    let mounted = true;

    const fetchManagerData = async () => {
      try {
        setLoading(true);
        // Fetch all loans (not just pending) so manager sees full portfolio
        const loanData = await apiFetch("/api/loans", token);
        if (mounted) setLoans(loanData.loans || []);

        // Simulating loading the current administrative RBAC profile configurations
        // In a live system, this endpoint sends the current settings toggled by the admin
        const configData = await apiFetch("/api/auth/permissions", token, {
          headers: {
            "X-Impersonated-Role": user?.role,
          },
        }).catch(() => ({
          permissions: {
            approveUsers: true,
            viewLedgers: true,
            overrideRates: false,
          }, // Fallback to current Admin default
        }));
        if (mounted) setPermissions(configData.permissions);
      } catch (err) {
        console.warn(
          "Error fetching manager core console streams:",
          err.message,
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchManagerData();
    // Poll for updates every 3 seconds so manager sees disbursements in real-time
    const interval = setInterval(fetchManagerData, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [token, user]);

  // Derived Performance Indicators (KPIs)
  const verificationQueueCount = loans.filter(
    (l) => l.status === "pending_verification",
  ).length;
  const verifiedCount = loans.filter(
    (l) => l.status === "pending_approval",
  ).length;
  const rejectedCount = loans.filter((l) => l.status === "rejected").length;
  const totalAssignedVolume = loans.reduce((acc, l) => acc + l.principal, 0);
  const averageLoanSize =
    loans.length > 0 ? totalAssignedVolume / loans.length : 0;

  // Underwriting Action Wrapper
  const handleVerifyApplication = async (loanId, action) => {
    if (!permissions.approveUsers) {
      alert(
        "Access Denied: You do not have 'approveUsers' rights allocated by the Admin Console.",
      );
      return;
    }

    try {
      const endpoint = action === "verify" ? "/verify" : "/reject";
      const headers = {};
      if (impersonatedRole) {
        headers["X-Impersonated-Role"] = impersonatedRole;
      }
      const data = await apiFetch(`/api/loans/${loanId}${endpoint}`, token, {
        method: "POST",
        body: JSON.stringify({}),
        headers,
      });

      // Optimistically update the UI list pipeline state
      setLoans((prev) => prev.map((l) => (l.id === loanId ? data.loan : l)));
      alert(
        `Loan execution successful: Application ${loanId} marked as ${action}ed.`,
      );
    } catch (err) {
      alert(`Verification processing error: ${err.message}`);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* ─── SIDEBAR COMPONENT ─── */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-amber-500/20">
              M
            </div>
            <div>
              <div className="font-bold text-white tracking-wide leading-none">
                Felix
              </div>
              <span className="text-xs text-slate-500">
                Operation Risk Manager
              </span>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span>📊</span> Operation Overview
            </button>
            <button
              onClick={() => setActiveTab("underwriting")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "underwriting"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span>🔎</span> Verification Queue
              </div>
              {verificationQueueCount > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === "underwriting" ? "bg-slate-900 text-amber-400" : "bg-amber-500 text-slate-900"}`}
                >
                  {verificationQueueCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("processed")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "processed"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span>✅</span> Processed Accounts
              </div>
              {verifiedCount + rejectedCount > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === "processed" ? "bg-slate-900 text-amber-400" : "bg-amber-500 text-slate-900"}`}
                >
                  {verifiedCount + rejectedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("rights")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "rights"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span>🛡️</span> My Allocated Rights
            </button>
          </nav>
        </div>

        <div>
          <div className="p-3 bg-slate-900 rounded-xl mb-4 border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
              {user?.username?.slice(0, 2) || "MG"}
            </div>
            <div className="truncate flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {user?.username || "manager_account"}
              </div>
              <div className="text-[10px] text-slate-500 tracking-wider uppercase">
                {user?.role || "Manager"}
              </div>
            </div>
          </div>
          {impersonatedRole && realUser?.role === "admin" && (
            <button
              onClick={clearImpersonation}
              className="w-full mb-3 px-4 py-2 text-xs text-slate-100 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-xl font-medium transition"
            >
              Stop Impersonation
            </button>
          )}
          <button
            onClick={logout}
            className="w-full py-2.5 text-xs text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl font-medium transition"
          >
            Terminate Session
          </button>
        </div>
      </aside>

      {/* ─── MAIN FRAME WORKSPACE ─── */}
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Manager Verification Terminal
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Review operational profiles, verify ledger balances, and clear
              loans for master execution.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 border border-slate-800 rounded-full text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${permissions.approveUsers ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
              />
              Verification Authority:{" "}
              {permissions.approveUsers ? "Active" : "Disabled by Admin"}
            </div>
          </div>
        </header>

        {/* ─── TAB: OVERVIEW ─── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* MANAGER RUNTIME METRICS CARD DECK */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Assigned Pipeline Volume
                </div>
                <div className="text-2xl font-bold mt-2 text-white">
                  KES {fmt(totalAssignedVolume)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Total pending administrative valuation
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Unresolved Underwriting Tasks
                </div>
                <div className="text-2xl font-bold mt-2 text-amber-400">
                  {verificationQueueCount} Applications
                </div>
                <div className="text-xs text-amber-500/70 mt-1">
                  Awaiting verification signatures
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Mean Requested Matrix
                </div>
                <div className="text-2xl font-bold mt-2 text-violet-400">
                  KES {fmt(averageLoanSize)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Average pipeline evaluation scale
                </div>
              </div>
            </div>

            {/* PIPELINE LIVE VIEW */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6">
              <h3 className="font-bold text-white mb-4">
                Assigned Accounts Overview
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="py-3 px-2">Loan Reference</th>
                      <th className="py-3 px-2">Borrower Phone</th>
                      <th className="py-3 px-2">Principal Allocation</th>
                      <th className="py-3 px-2">Assigned Rate</th>
                      <th className="py-3 px-2 text-right">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {loans.slice(0, 5).map((l) => (
                      <tr
                        key={l.id}
                        className="hover:bg-slate-900/50 transition"
                      >
                        <td className="py-3 px-2 font-mono text-xs font-bold text-white">
                          {l.id}
                        </td>
                        <td className="py-3 px-2 text-xs">+254{l.phone}</td>
                        <td className="py-3 px-2 font-semibold">
                          KES {fmt(l.principal)}
                        </td>
                        <td className="py-3 px-2 text-amber-400">
                          {(l.rate * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-2 text-right">
                          <StatusBadge status={l.status} />
                        </td>
                      </tr>
                    ))}
                    {loans.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-slate-500 text-xs"
                        >
                          No active verification entries assigned to portfolio.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: VERIFICATION UNDERWRITING QUEUE ─── */}
        {activeTab === "underwriting" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-2">
              Loan Verification Workflows
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Evaluate background employment parameters, inspect calculation
              matrix data models, and approve profiles to forward them to the
              Admin's automated B2C disbursement gateway.
            </p>

            <div className="space-y-4">
              {loans
                .filter((l) => l.status === "pending_verification")
                .map((loan) => (
                  <div
                    key={loan.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-white tracking-wider">
                          {loan.id}
                        </span>
                        <span className="text-xs text-slate-400">
                          | Applicant Contact: +254{loan.phone}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          Principal:{" "}
                          <span className="text-white font-bold">
                            KES {fmt(loan.principal)}
                          </span>
                        </div>
                        <div>
                          Tenor Frame:{" "}
                          <span className="text-white font-bold">
                            {loan.tenor} Days
                          </span>
                        </div>
                        <div>
                          Assigned Rate:{" "}
                          <span className="text-amber-400 font-bold">
                            {(loan.rate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          Deduction Matrix:{" "}
                          <span className="text-white uppercase font-bold">
                            {loan.schedule_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        disabled={!permissions.approveUsers}
                        onClick={() =>
                          handleVerifyApplication(loan.id, "verify")
                        }
                        className={`px-4 py-2 rounded-xl font-bold text-xs transition shadow-lg ${
                          permissions.approveUsers
                            ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/10"
                            : "bg-slate-800 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        Verify Account
                      </button>
                      <button
                        disabled={!permissions.approveUsers}
                        onClick={() =>
                          handleVerifyApplication(loan.id, "reject")
                        }
                        className={`px-3 py-2 rounded-xl font-semibold text-xs transition ${
                          permissions.approveUsers
                            ? "bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400"
                            : "bg-slate-800 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        Flag/Reject
                      </button>
                    </div>
                  </div>
                ))}

              {verificationQueueCount === 0 && (
                <div className="py-12 text-center text-slate-500 text-sm">
                  ✨ Perfect workflow compliance! The verification queue is
                  currently empty.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: RBAC STATUS MATRIX ─── */}
        {activeTab === "rights" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-2">
              My Runtime Permissions Framework
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              These structural capabilities are assigned directly from the main{" "}
              <strong>Admin Right Control Matrix</strong>. If you require
              operational changes, contact your core master console root
              administrator.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={`p-4 rounded-xl border ${permissions.approveUsers ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm text-white">
                    Verify Applications
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${permissions.approveUsers ? "bg-emerald-400" : "bg-red-400"}`}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Allows managers to forward processing entries directly to the
                  B2C Paybill interfaces.
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border ${permissions.viewLedgers ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm text-white">
                    View Internal Ledgers
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${permissions.viewLedgers ? "bg-emerald-400" : "bg-red-400"}`}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Grants permission to query historical payment files and core
                  database logs.
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border ${permissions.overrideRates ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm text-white">
                    Override Interest Rates
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${permissions.overrideRates ? "bg-emerald-400" : "bg-red-400"}`}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Grants capability to configure dynamic deductions outside
                  system base configurations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: PROCESSED ACCOUNTS ─── */}
        {activeTab === "processed" && (
          <div className="space-y-6">
            {/* Verified and Rejected Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-emerald-800/30 shadow-xl">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Verified Accounts
                </div>
                <div className="text-2xl font-bold mt-2 text-emerald-400">
                  {verifiedCount} Applications
                </div>
                <div className="text-xs text-emerald-500/70 mt-1">
                  Sent to admin for disbursement
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-red-800/30 shadow-xl">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Rejected Accounts
                </div>
                <div className="text-2xl font-bold mt-2 text-red-400">
                  {rejectedCount} Applications
                </div>
                <div className="text-xs text-red-500/70 mt-1">
                  Flagged and removed from pipeline
                </div>
              </div>
            </div>

            {/* Verified Accounts Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Verified Accounts
                (Pending Disbursement)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="py-3 px-2">Loan Reference</th>
                      <th className="py-3 px-2">Borrower Phone</th>
                      <th className="py-3 px-2">Principal</th>
                      <th className="py-3 px-2">Rate</th>
                      <th className="py-3 px-2">Verified Date</th>
                      <th className="py-3 px-2">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {loans
                      .filter((l) => l.status === "pending_approval")
                      .map((l) => (
                        <tr
                          key={l.id}
                          className="hover:bg-slate-900/50 transition"
                        >
                          <td className="py-3 px-2 font-mono text-xs font-bold text-white">
                            {l.id}
                          </td>
                          <td className="py-3 px-2 text-xs">+254{l.phone}</td>
                          <td className="py-3 px-2 font-semibold">
                            KES {fmt(l.principal)}
                          </td>
                          <td className="py-3 px-2 text-amber-400">
                            {(l.rate * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-2 text-xs text-slate-400">
                            {l.verifiedAt || "—"}
                          </td>
                          <td className="py-3 px-2">
                            <StatusBadge status={l.status} />
                          </td>
                        </tr>
                      ))}
                    {verifiedCount === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-500 text-xs"
                        >
                          No verified accounts awaiting disbursement.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rejected Accounts Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-red-400">✕</span> Rejected Accounts
                (Removed from Pipeline)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="py-3 px-2">Loan Reference</th>
                      <th className="py-3 px-2">Borrower Phone</th>
                      <th className="py-3 px-2">Principal</th>
                      <th className="py-3 px-2">Rate</th>
                      <th className="py-3 px-2">Applied Date</th>
                      <th className="py-3 px-2">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {loans
                      .filter((l) => l.status === "rejected")
                      .map((l) => (
                        <tr
                          key={l.id}
                          className="hover:bg-slate-900/50 transition"
                        >
                          <td className="py-3 px-2 font-mono text-xs font-bold text-white">
                            {l.id}
                          </td>
                          <td className="py-3 px-2 text-xs">+254{l.phone}</td>
                          <td className="py-3 px-2 font-semibold">
                            KES {fmt(l.principal)}
                          </td>
                          <td className="py-3 px-2 text-amber-400">
                            {(l.rate * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-2 text-xs text-slate-400">
                            {l.appliedAt || "—"}
                          </td>
                          <td className="py-3 px-2">
                            <StatusBadge status={l.status} />
                          </td>
                        </tr>
                      ))}
                    {rejectedCount === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-500 text-xs"
                        >
                          No rejected accounts on record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
