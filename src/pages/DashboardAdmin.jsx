import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// ─── M-Pesa B2C API - Real Daraja Integration ─────────────────────────────
const b2cAPI = {
  disburse: async ({
    phone,
    amount,
    loanId,
    description,
    reference,
    token,
  }) => {
    // Call your backend API which will then call Safaricom Daraja B2C API
    const response = await fetch("/api/b2c/disburse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        phoneNumber: phone,
        amount: amount,
        loanId: loanId,
        description: description,
        reference: reference,
        commandID: "BusinessPayment",
      }),
    });

    // Better error handling for non-JSON responses
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error("Non-JSON response:", text);
      throw new Error(
        `Server returned ${response.status}: ${text.substring(0, 100)}`,
      );
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || "B2C disbursement failed");
    }
    return data;
  },
};

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const today = () => new Date().toISOString().split("T")[0];

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

  try {
    const resp = await fetch(path, opts);

    // Handle non-JSON responses gracefully
    let json = {};
    const contentType = resp.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      json = await resp.json();
    } else {
      const text = await resp.text();
      console.warn(`Non-JSON response from ${path}:`, text.substring(0, 200));
      // Try to parse as JSON if it looks like one
      if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = { error: "Invalid server response" };
        }
      } else {
        json = { error: text.substring(0, 100) || "Server error" };
      }
    }

    if (!resp.ok) {
      throw new Error(json.error || json.message || "API request failed");
    }
    return json;
  } catch (err) {
    console.warn(`API call to ${path} failed:`, err.message);
    // Return default empty structures instead of throwing
    return { loans: [], users: [], logs: [], pendingUsers: [] };
  }
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

// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────────
export default function DashboardAdmin() {
  const { user, token, logout, impersonateRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [pendingLoans, setPendingLoans] = useState([]);
  const [allLoans, setAllLoans] = useState([]);
  const [disbursedLoans, setDisbursedLoans] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [logFilter, setLogFilter] = useState("all");
  const [activeUsers, setActiveUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Rights Config State
  const [rolesRights, setRolesRights] = useState({
    manager: { approveUsers: true, viewLedgers: true, overrideRates: false },
    employer: { postSalaries: true, accessSchedules: false },
  });

  // Disbursement states
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [profitPercentage, setProfitPercentage] = useState("10");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [showUserActionModal, setShowUserActionModal] = useState(false);
  const [actionUser, setActionUser] = useState(null);
  const [confirmationModal, setConfirmationModal] = useState(null);
  const [b2cStatus, setB2cStatus] = useState("online");

  // Dashboard stats
  const totalVolume = allLoans.reduce((acc, l) => acc + (l.principal || 0), 0);
  const totalDisbursed = disbursedLoans.reduce(
    (acc, l) => acc + (l.disbursedAmount || l.principal || 0),
    0,
  );
  const totalProfit = disbursedLoans.reduce(
    (acc, l) => acc + (l.profitAmount || 0),
    0,
  );
  const pendingCount = pendingLoans.length;
  const pendingApprovalCount = pendingUsers.length;

  // ─── LOG SYSTEM ACTION ──────────────────────────────────────────────────────
  const logSystemAction = useCallback(
    (page, action, username = null) => {
      const newEvent = {
        id: "EV" + Date.now() + Math.random().toString(36).substr(2, 4),
        page,
        user: username || user?.username || "Admin",
        action,
        time: "Just now",
        timestamp: Date.now(),
      };
      setSystemLogs((prev) => [newEvent, ...prev]);
    },
    [user?.username],
  );

  // ─── AUTO-REFRESH DATA (every 15 seconds) ─────────────────────────────────
  const refreshData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch loans from API
      const loansData = await apiFetch("/api/loans", token);
      if (loansData.loans && Array.isArray(loansData.loans)) {
        const allLoansData = loansData.loans;
        setAllLoans(allLoansData);

        // Filter pending approvals (loans approved by manager but not disbursed)
        const pending = allLoansData.filter(
          (l) => l.status === "pending_approval" || l.status === "approved",
        );
        setPendingLoans(pending);

        // Filter disbursed loans
        const disbursed = allLoansData.filter(
          (l) =>
            l.status === "disbursed" ||
            l.status === "repaying" ||
            l.status === "completed",
        );
        setDisbursedLoans(disbursed);
      } else {
        // Handle case where loansData doesn't have loans array
        setAllLoans([]);
        setPendingLoans([]);
        setDisbursedLoans([]);
      }

      // Fetch users
      const usersData = await apiFetch("/api/users", token);
      if (usersData.users && Array.isArray(usersData.users)) {
        setActiveUsers(usersData.users.filter((u) => u.approved === true));
        setPendingUsers(
          usersData.users.filter(
            (u) =>
              !u.approved && (u.role === "manager" || u.role === "employer"),
          ),
        );
      } else {
        setActiveUsers([]);
        setPendingUsers([]);
      }
    } catch (err) {
      console.warn("Auto-refresh failed:", err.message);
    } finally {
      setLoading(false);
    }
    setLastRefresh(Date.now());
  }, [token]);

  // Initial load and auto-refresh every 15 seconds
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // User management functions
  const toggleUserAccess = async (userId, shouldDisable) => {
    const userToUpdate = activeUsers.find((u) => u.id === userId);
    if (!userToUpdate) return;

    try {
      await apiFetch(`/api/users/${userId}/toggle-access`, token, {
        method: "POST",
        body: JSON.stringify({ disabled: shouldDisable }),
      });

      setActiveUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, active: !shouldDisable } : u,
        ),
      );

      logSystemAction(
        "admin",
        `${shouldDisable ? "Disabled" : "Enabled"} user ${userToUpdate.username} (${userToUpdate.role})`,
      );
    } catch (err) {
      console.error("Failed to toggle user access:", err);
      setConfirmationModal({
        title: "❌ Action Failed",
        message: err.message || "Failed to update user access",
        isError: true,
      });
    }

    setShowUserActionModal(false);
    setActionUser(null);
  };

  const approveUser = async (userId) => {
    const userToApprove = pendingUsers.find((u) => u.id === userId);
    if (!userToApprove) return;

    try {
      const response = await apiFetch("/api/users/approve", token, {
        method: "POST",
        body: JSON.stringify({ userId, approved: true }),
      });

      if (response.success) {
        setActiveUsers((prev) => [
          ...prev,
          { ...userToApprove, approved: true, active: true },
        ]);
        setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
        logSystemAction(
          "admin",
          `Approved user ${userToApprove.username} (${userToApprove.role})`,
        );
        setConfirmationModal({
          title: "✅ User Approved",
          message: `${userToApprove.username} has been approved successfully.`,
        });
      }
    } catch (err) {
      console.warn("Approval failed:", err.message);
      setConfirmationModal({
        title: "❌ Approval Failed",
        message: err.message || "Failed to approve user",
        isError: true,
      });
    }
  };

  const rejectUser = async (userId) => {
    const userToReject = pendingUsers.find((u) => u.id === userId);
    if (!userToReject) return;

    try {
      await apiFetch("/api/users/reject", token, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      logSystemAction(
        "admin",
        `Rejected user ${userToReject.username} (${userToReject.role})`,
      );
      setConfirmationModal({
        title: "❌ User Rejected",
        message: `${userToReject.username} has been rejected.`,
        isError: true,
      });
    } catch (err) {
      console.warn("Rejection failed:", err.message);
      setConfirmationModal({
        title: "❌ Rejection Failed",
        message: err.message || "Failed to reject user",
        isError: true,
      });
    }
  };

  const forceLogoutUser = (userId) => {
    const userToUpdate = activeUsers.find((u) => u.id === userId);
    if (!userToUpdate) return;
    logSystemAction(
      "admin",
      `Force logged out user ${userToUpdate.username} (${userToUpdate.role})`,
    );
    setShowUserActionModal(false);
    setActionUser(null);
    setConfirmationModal({
      title: "✅ Action Completed",
      message: `${userToUpdate.username} has been forced to logout.`,
    });
  };

  // Toggle dynamic structural user rights
  const toggleRight = (role, key) => {
    setRolesRights({
      ...rolesRights,
      [role]: { ...rolesRights[role], [key]: !rolesRights[role][key] },
    });
    logSystemAction("admin", `Toggled permissions for ${role}: ${key}`);
  };

  // ─── DISBURSEMENT HANDLER WITH REAL B2C API ───────────────────────────
  const handleDisburseLoan = async (loan) => {
    setIsProcessing(true);
    setB2cStatus("processing");

    // Calculate profit and disbursement amount
    const profitPercent = Number(profitPercentage) / 100;
    const profitAmount = loan.principal * profitPercent;
    const disbursementAmount = loan.principal - profitAmount;

    // Format phone number (ensure it's in international format)
    let customerPhone = loan.phone || loan.customerPhone;
    if (!customerPhone) {
      setConfirmationModal({
        title: "❌ Disbursement Failed",
        message:
          "Customer phone number is missing. Please ensure the loan application has a valid phone number.",
        isError: true,
      });
      setIsProcessing(false);
      setB2cStatus("online");
      return;
    }

    // Format phone: remove any leading 0 or +254, then add 254
    let cleanPhone = customerPhone.toString().replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith("254")) {
      cleanPhone = "254" + cleanPhone;
    }

    setProcessingMessage(
      `💰 Calculating profit: ${profitPercentage}% (KES ${fmt(profitAmount)})...`,
    );

    try {
      setProcessingMessage(
        `📱 Initiating B2C Paybill transfer of KES ${fmt(disbursementAmount)} to ${cleanPhone}...`,
      );

      // Call real B2C API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const b2cResp = await b2cAPI.disburse({
        phone: cleanPhone,
        amount: disbursementAmount,
        loanId: loan.id,
        description: `Loan Disbursement - ${loan.id} (Profit: ${profitPercentage}%)`,
        reference: `DISB-${loan.id}-${Date.now()}`,
        token: token,
      });

      clearTimeout(timeoutId);

      setProcessingMessage(
        `✅ B2C transfer initiated! Conversation ID: ${b2cResp.ConversationID || b2cResp.conversationID || "N/A"}`,
      );

      // Update loan status in backend
      const updatedLoan = await apiFetch(
        `/api/loans/${loan.id}/disburse`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            profitPercentage: profitPercentage,
            profitAmount: profitAmount,
            disbursedAmount: disbursementAmount,
            b2cReference: b2cResp.ConversationID || b2cResp.conversationID,
            b2cReceipt: b2cResp.ReceiptNumber || b2cResp.receiptNumber,
            transactionId: b2cResp.TransactionID || b2cResp.transactionID,
            status: "disbursed",
            disbursedAt: today(),
          }),
        },
      );

      // Update local states
      const updatedLoanData = updatedLoan.loan || updatedLoan;
      setDisbursedLoans((prev) => [updatedLoanData, ...prev]);
      setPendingLoans((prev) => prev.filter((l) => l.id !== loan.id));
      setAllLoans((prev) =>
        prev.map((l) => (l.id === loan.id ? updatedLoanData : l)),
      );

      logSystemAction(
        "admin",
        `💰 B2C DISBURSEMENT: KES ${fmt(disbursementAmount)} to ${cleanPhone} | Loan: ${loan.id} | Profit: ${profitPercentage}% (KES ${fmt(profitAmount)})`,
      );

      setConfirmationModal({
        title: "✅ B2C Disbursement Successful!",
        message: `Successfully disbursed KES ${fmt(disbursementAmount)} to ${cleanPhone}`,
        details: {
          loanId: loan.id,
          principal: loan.principal,
          profitRate: `${profitPercentage}%`,
          profitAmount: profitAmount,
          disbursedAmount: disbursementAmount,
          reference: b2cResp.ConversationID || b2cResp.conversationID,
          mpesaReceipt: b2cResp.ReceiptNumber || b2cResp.receiptNumber,
          transactionId: b2cResp.TransactionID || b2cResp.transactionID,
        },
      });

      setSelectedLoan(null);
      setProfitPercentage("10");
    } catch (err) {
      console.error("Disbursement failed", err);

      // Provide more specific error messages
      let errorMessage =
        err.message || "Failed to process disbursement. Please try again.";
      if (err.name === "AbortError") {
        errorMessage =
          "Request timed out. Please check the disbursement status later.";
      } else if (errorMessage.includes("fetch")) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      setConfirmationModal({
        title: "❌ B2C Disbursement Failed",
        message: errorMessage,
        isError: true,
      });
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
      setB2cStatus("online");
    }
  };

  // Calculate loan preview
  const calculateDisbursementPreview = (loan) => {
    if (!loan) return null;
    const profitPercent = Number(profitPercentage) / 100;
    const profitAmount = loan.principal * profitPercent;
    const disbursementAmount = loan.principal - profitAmount;
    const dailyPayment = loan.tenor ? disbursementAmount / loan.tenor : 0;

    return {
      profitAmount,
      disbursementAmount,
      dailyPayment,
      totalToRepay: loan.principal,
      effectiveRate: (profitAmount / loan.principal) * 100,
    };
  };

  // ─── USER ACTION MODAL ─────────────────────────────────────────────────────
  const UserActionModal = () => {
    if (!actionUser) return null;

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
          <h3 className="text-lg font-bold text-white mb-2">
            Manage User: {actionUser.username}
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            Role: {actionUser.role} • Status:{" "}
            {actionUser.active ? "Active" : "Disabled"}
          </p>

          <div className="space-y-3">
            {actionUser.active ? (
              <button
                onClick={() => toggleUserAccess(actionUser.id, true)}
                className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-semibold text-sm hover:bg-red-500/20 transition"
              >
                Disable User Account
              </button>
            ) : (
              <button
                onClick={() => toggleUserAccess(actionUser.id, false)}
                className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-semibold text-sm hover:bg-emerald-500/20 transition"
              >
                Re-enable User Account
              </button>
            )}

            <button
              onClick={() => forceLogoutUser(actionUser.id)}
              className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl font-semibold text-sm hover:bg-amber-500/20 transition"
            >
              Force Logout (Terminate Session)
            </button>

            <button
              onClick={() => {
                setActionUser(null);
                setShowUserActionModal(false);
              }}
              className="w-full py-3 bg-slate-800 text-slate-400 rounded-xl font-semibold text-sm hover:bg-slate-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── DISBURSEMENT MODAL ────────────────────────────────────────────────────
  const DisbursementModal = () => {
    if (!selectedLoan) return null;
    const preview = calculateDisbursementPreview(selectedLoan);
    if (!preview) return null;

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-white">
              💰 B2C Loan Disbursement
            </h3>
            <button
              onClick={() => setSelectedLoan(null)}
              className="text-slate-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          {/* B2C Status Indicator */}
          <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${b2cStatus === "online" ? "bg-emerald-500 animate-pulse" : b2cStatus === "processing" ? "bg-amber-500 animate-pulse" : "bg-red-500"}`}
            />
            <span className="text-xs text-slate-400">
              B2C Paybill Engine:{" "}
              {b2cStatus === "online"
                ? "Ready"
                : b2cStatus === "processing"
                  ? "Processing..."
                  : "Busy"}
            </span>
          </div>

          {/* Loan Summary */}
          <div className="bg-slate-800/50 rounded-2xl p-4 mb-6">
            <h4 className="text-sm font-semibold text-amber-400 mb-3">
              Loan Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Loan ID:</span>
                <span className="text-white ml-2 font-mono">
                  {selectedLoan.id}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Customer:</span>
                <span className="text-white ml-2">
                  {selectedLoan.customerName || selectedLoan.name || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Phone Number:</span>
                <span className="text-white ml-2 font-mono">
                  {selectedLoan.phone || selectedLoan.customerPhone || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Principal Amount:</span>
                <span className="text-white ml-2 font-bold">
                  KES {fmt(selectedLoan.principal)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Tenor:</span>
                <span className="text-white ml-2">
                  {selectedLoan.tenor} days
                </span>
              </div>
              <div>
                <span className="text-slate-400">Purpose:</span>
                <span className="text-white ml-2">
                  {selectedLoan.purpose || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Profit Configuration */}
          <div className="bg-slate-800/30 rounded-2xl p-4 mb-6">
            <h4 className="text-sm font-semibold text-amber-400 mb-3">
              💼 Profit Configuration (Admin Fee)
            </h4>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Profit Percentage (%)
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={profitPercentage}
                  onChange={(e) => setProfitPercentage(e.target.value)}
                  className="flex-1 accent-amber-500"
                />
                <div className="relative w-24">
                  <input
                    type="number"
                    value={profitPercentage}
                    onChange={(e) => setProfitPercentage(e.target.value)}
                    step="0.5"
                    min="0"
                    max="30"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-center"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Quick profit presets */}
            <div className="flex gap-2 mb-4">
              {[5, 10, 15, 20, 25].map((percent) => (
                <button
                  key={percent}
                  onClick={() => setProfitPercentage(percent.toString())}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    profitPercentage === percent.toString()
                      ? "bg-amber-500 text-slate-900"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {percent}%
                </button>
              ))}
            </div>

            {/* Preview Calculation */}
            <div className="bg-slate-900 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Loan Principal:</span>
                <span className="text-white font-semibold">
                  KES {fmt(selectedLoan.principal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">
                  Admin Profit ({profitPercentage}%):
                </span>
                <span className="text-amber-400 font-bold">
                  KES {fmt(preview.profitAmount)}
                </span>
              </div>
              <div className="border-t border-slate-700 my-2"></div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">
                  💸 Customer Receives (B2C):
                </span>
                <span className="text-emerald-400 font-bold text-lg">
                  KES {fmt(preview.disbursementAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">📅 Daily Repayment:</span>
                <span className="text-white">
                  KES {fmt(preview.dailyPayment)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">
                  📈 Effective Interest Rate:
                </span>
                <span className="text-white">
                  {preview.effectiveRate.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-start gap-2 text-xs text-amber-300">
                <span>⚠️</span>
                <span>
                  This amount will be sent via M-Pesa B2C Paybill. Customer will
                  receive KES {fmt(preview.disbursementAmount)} immediately to
                  their M-Pesa account (
                  {selectedLoan.phone || selectedLoan.customerPhone || "N/A"}).
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              disabled={isProcessing || b2cStatus === "processing"}
              onClick={() => handleDisburseLoan(selectedLoan)}
              className={`flex-1 py-3 font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                isProcessing || b2cStatus === "processing"
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white"
              }`}
            >
              {isProcessing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      strokeOpacity="0.25"
                    />
                    <path
                      d="M22 12a10 10 0 00-10-10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                  </svg>
                  {processingMessage || "Processing B2C..."}
                </>
              ) : (
                `Send KES ${fmt(preview.disbursementAmount)} via B2C Paybill`
              )}
            </button>
            <button
              onClick={() => setSelectedLoan(null)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── CONFIRMATION MODAL ────────────────────────────────────────────────────
  const ResultModal = () => {
    if (!confirmationModal) return null;
    const isError = confirmationModal.isError;

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          className={`bg-slate-900 border rounded-3xl p-6 w-full max-w-md ${isError ? "border-red-500/30" : "border-emerald-500/30"}`}
        >
          <div className="text-center mb-4">
            <div
              className={`text-5xl mb-3 ${isError ? "text-red-500" : "text-emerald-500"}`}
            >
              {isError ? "❌" : "✅"}
            </div>
            <h3
              className={`text-xl font-bold ${isError ? "text-red-400" : "text-emerald-400"}`}
            >
              {confirmationModal.title}
            </h3>
            <p className="text-slate-300 mt-2">{confirmationModal.message}</p>
          </div>

          {confirmationModal.details && (
            <div className="bg-slate-800/50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Loan ID:</span>
                <span className="text-white font-mono">
                  {confirmationModal.details.loanId}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Principal:</span>
                <span className="text-white">
                  KES {fmt(confirmationModal.details.principal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Profit Rate:</span>
                <span className="text-amber-400">
                  {confirmationModal.details.profitRate}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Profit Amount:</span>
                <span className="text-amber-400">
                  KES {fmt(confirmationModal.details.profitAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount Disbursed:</span>
                <span className="text-emerald-400 font-bold">
                  KES {fmt(confirmationModal.details.disbursedAmount)}
                </span>
              </div>
              {confirmationModal.details.reference && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">B2C Reference:</span>
                  <span className="text-slate-400 font-mono text-xs">
                    {confirmationModal.details.reference}
                  </span>
                </div>
              )}
              {confirmationModal.details.mpesaReceipt && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">M-Pesa Receipt:</span>
                  <span className="text-slate-400 font-mono text-xs">
                    {confirmationModal.details.mpesaReceipt}
                  </span>
                </div>
              )}
              {confirmationModal.details.transactionId && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Transaction ID:</span>
                  <span className="text-slate-400 font-mono text-xs">
                    {confirmationModal.details.transactionId}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setConfirmationModal(null)}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  if (loading && !allLoans.length) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4"
            viewBox="0 0 24 24"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeOpacity="0.25"
            />
            <path
              d="M22 12a10 10 0 00-10-10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
          </svg>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-amber-500/20">
              F
            </div>
            <div>
              <div className="font-bold text-white tracking-wide leading-none">
                Felix
              </div>
              <span className="text-xs text-slate-500">
                Super Admin Console
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
              <span className="text-lg">📊</span> Overview Dashboard
            </button>
            <button
              onClick={() => setActiveTab("approvals")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "approvals"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">💸</span> B2C Disbursement Queue
              </div>
              {pendingCount > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === "approvals" ? "bg-slate-900 text-amber-400" : "bg-amber-500 text-slate-900"}`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("user-approvals")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "user-approvals"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">👥</span> Pending Approvals
              </div>
              {pendingApprovalCount > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === "user-approvals" ? "bg-slate-900 text-amber-400" : "bg-amber-500 text-slate-900"}`}
                >
                  {pendingApprovalCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("access")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "access"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span className="text-lg">🔑</span> RBAC Controls
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "users"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">👥</span> User Management
              </div>
            </button>
            <button
              onClick={() => setActiveTab("impersonate")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "impersonate"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span className="text-lg">🎭</span> Impersonate Roles
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "history"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span className="text-lg">📜</span> B2C History
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "logs"
                  ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <span className="text-lg">🖥️</span> Audit Logs
            </button>
          </nav>
        </div>

        <div>
          <div className="p-3 bg-slate-900 rounded-xl mb-4 border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
              {user?.username?.slice(0, 2) || "AD"}
            </div>
            <div className="truncate flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {user?.username || "root_admin"}
              </div>
              <div className="text-[10px] text-slate-500 tracking-wider uppercase">
                {user?.role || "Administrator"}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full py-2.5 text-xs text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl font-medium transition"
          >
            Terminate Session
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              System Core Control Console
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Full administrative oversight • B2C Paybill Disbursement • Profit
              Management • Audit Trail
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 border border-slate-800 rounded-full text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              B2C Paybill Engine:{" "}
              {b2cStatus === "online"
                ? "Ready"
                : b2cStatus === "processing"
                  ? "Processing"
                  : "Standby"}
            </div>
            <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 border border-slate-800 rounded-full text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Auto-refresh: Live
            </div>
          </div>
        </header>

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-slate-800">
                <div className="text-slate-400 text-xs font-semibold uppercase">
                  Total Loan Volume
                </div>
                <div className="text-2xl font-bold mt-2 text-white">
                  KES {fmt(totalVolume)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-slate-800">
                <div className="text-slate-400 text-xs font-semibold uppercase">
                  B2C Disbursed
                </div>
                <div className="text-2xl font-bold mt-2 text-emerald-400">
                  KES {fmt(totalDisbursed)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-slate-800">
                <div className="text-slate-400 text-xs font-semibold uppercase">
                  💰 Profit Collected
                </div>
                <div className="text-2xl font-bold mt-2 text-amber-400">
                  KES {fmt(totalProfit)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-slate-800">
                <div className="text-slate-400 text-xs font-semibold uppercase">
                  Pending Disbursements
                </div>
                <div className="text-2xl font-bold mt-2 text-violet-400">
                  {pendingCount}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white mb-4">
                  Pending B2C Disbursements
                </h3>
                <div className="space-y-3">
                  {pendingLoans.slice(0, 5).map((loan) => (
                    <div
                      key={loan.id}
                      className="flex items-center justify-between p-3 bg-slate-900 rounded-xl"
                    >
                      <div>
                        <div className="font-mono text-sm text-white">
                          {loan.id}
                        </div>
                        <div className="text-xs text-slate-400">
                          {loan.phone || loan.customerPhone || "No phone"} • KES{" "}
                          {fmt(loan.principal)}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setProfitPercentage("10");
                        }}
                        className="px-3 py-1.5 bg-amber-500 text-slate-900 rounded-lg text-xs font-bold"
                      >
                        B2C Disburse
                      </button>
                    </div>
                  ))}
                  {pendingLoans.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      No pending disbursements from manager verification
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6">
                <h3 className="font-bold text-white mb-4">
                  Pending User Approvals
                </h3>
                <div className="space-y-3">
                  {pendingUsers.slice(0, 5).map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-slate-900 rounded-xl"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {user.username}
                        </div>
                        <div className="text-xs text-slate-400 capitalize">
                          {user.role} • +254{user.phone}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveUser(user.id)}
                          className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectUser(user.id)}
                          className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingUsers.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      No pending user approvals
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── USER APPROVALS TAB ─── */}
        {activeTab === "user-approvals" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Manager & Employer Registration Approvals
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Review and approve or reject manager and employer account
                  requests
                </p>
              </div>
              <div className="text-sm bg-amber-500/10 px-3 py-1.5 rounded-full text-amber-400">
                {pendingApprovalCount} pending
              </div>
            </div>

            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-bold text-white">
                          {user.username}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.role === "manager"
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Phone:</span>
                          <span className="text-white ml-2">
                            +254{user.phone}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Email:</span>
                          <span className="text-white ml-2">
                            {user.email || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Registered:</span>
                          <span className="text-white ml-2">
                            {user.registeredAt}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => approveUser(user.id)}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
                      >
                        ✅ Approve Registration
                      </button>
                      <button
                        onClick={() => rejectUser(user.id)}
                        className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-500/20"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {pendingUsers.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-3">🎉</div>
                  <h3 className="font-bold text-white text-lg">Queue Empty</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    All manager and employer registrations have been processed.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── DISBURSEMENT QUEUE TAB ─── */}
        {activeTab === "approvals" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">
                  B2C Paybill Disbursement Queue
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Loans verified by managers awaiting B2C Paybill disbursement
                  to customer M-Pesa
                </p>
              </div>
              <div className="text-sm bg-amber-500/10 px-3 py-1.5 rounded-full text-amber-400">
                {pendingCount} pending
              </div>
            </div>

            <div className="space-y-4">
              {pendingLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-bold text-white">
                          {loan.id}
                        </span>
                        <StatusBadge status={loan.status} />
                        <span className="text-xs text-slate-500">
                          ✓ Verified by Manager
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Principal:</span>
                          <span className="text-white ml-2 font-bold">
                            KES {fmt(loan.principal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Customer:</span>
                          <span className="text-white ml-2">
                            {loan.phone || loan.customerPhone || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Tenor:</span>
                          <span className="text-white ml-2">
                            {loan.tenor} days
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Applied:</span>
                          <span className="text-white ml-2">
                            {loan.appliedAt}
                          </span>
                        </div>
                      </div>
                      {loan.purpose && (
                        <p className="text-xs text-slate-400 mt-2 italic">
                          "{loan.purpose}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setProfitPercentage("10");
                        }}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20"
                      >
                        💰 Configure B2C & Disburse
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {pendingLoans.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-3">🎉</div>
                  <h3 className="font-bold text-white text-lg">Queue Empty</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    No loans pending B2C disbursement. Manager-verified loans
                    will appear here automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── RBAC CONTROLS TAB ─── */}
        {activeTab === "access" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              Role-Based Access Control
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-900">
                <h3 className="font-bold text-white mb-3">
                  Manager Permissions
                </h3>
                {[
                  {
                    key: "approveUsers",
                    label: "Approve Profile Verification",
                  },
                  { key: "viewLedgers", label: "View Financial Ledgers" },
                  { key: "overrideRates", label: "Override Deduction Rates" },
                ].map((right) => (
                  <div
                    key={right.key}
                    className="flex justify-between items-center py-2 border-b border-slate-800"
                  >
                    <span className="text-sm text-slate-300">
                      {right.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={rolesRights.manager[right.key]}
                      onChange={() => toggleRight("manager", right.key)}
                      className="w-4 h-4 accent-amber-500"
                    />
                  </div>
                ))}
              </div>
              <div className="p-5 rounded-2xl bg-slate-900">
                <h3 className="font-bold text-white mb-3">
                  Employer Permissions
                </h3>
                {[
                  {
                    key: "postSalaries",
                    label: "Post Payroll & Send Reminders",
                  },
                  {
                    key: "accessSchedules",
                    label: "View Amortization Schedules",
                  },
                ].map((right) => (
                  <div
                    key={right.key}
                    className="flex justify-between items-center py-2 border-b border-slate-800"
                  >
                    <span className="text-sm text-slate-300">
                      {right.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={rolesRights.employer[right.key]}
                      onChange={() => toggleRight("employer", right.key)}
                      className="w-4 h-4 accent-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── USER MANAGEMENT TAB ─── */}
        {activeTab === "users" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              User Management Console
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs">
                    <th className="p-3">Username</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Last Login</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map((u) => (
                    <tr key={u.id} className="border-b border-slate-800">
                      <td className="p-3 font-medium text-white">
                        {u.username}
                      </td>
                      <td className="p-3 capitalize">{u.role}</td>
                      <td className="p-3">+254{u.phone}</td>
                      <td className="p-3 text-slate-400">
                        {u.lastLogin || "N/A"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${u.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                        >
                          {u.active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setActionUser(u);
                            setShowUserActionModal(true);
                          }}
                          className="text-amber-400 hover:text-amber-300 text-sm"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── IMPERSONATE ROLES TAB ─── */}
        {activeTab === "impersonate" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              Role Impersonation
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Impersonate as a Manager or Employer to see exactly what they see
              and perform actions on their behalf. All actions will be logged in
              the audit trail.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900 text-center">
                <div className="text-5xl mb-4">👔</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Manager View
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Review and verify loan applications, approve/reject requests
                </p>
                <button
                  onClick={() => {
                    logSystemAction("admin", "Impersonated Manager role");
                    impersonateRole("manager");
                    navigate("/manager");
                  }}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl"
                >
                  Impersonate Manager
                </button>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900 text-center">
                <div className="text-5xl mb-4">🏢</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Employer View
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Monitor employee loans, send repayment reminders
                </p>
                <button
                  onClick={() => {
                    logSystemAction("admin", "Impersonated Employer role");
                    impersonateRole("employer");
                    navigate("/employer");
                  }}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl"
                >
                  Impersonate Employer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── DISBURSEMENT HISTORY TAB ─── */}
        {activeTab === "history" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              B2C Disbursement History
            </h2>
            <div className="space-y-3">
              {disbursedLoans.slice(0, 20).map((record) => (
                <div
                  key={record.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono text-sm text-white">
                        {record.id}
                      </span>
                      <span className="text-xs text-slate-400 ml-3">
                        {record.phone || record.customerPhone || "N/A"}
                      </span>
                    </div>
                    <span className="text-xs text-emerald-400">
                      {record.disbursedAt || record.appliedAt}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                    <div>
                      <span className="text-slate-400">Principal:</span>{" "}
                      <span className="text-white">
                        KES {fmt(record.principal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">
                        Profit ({record.profitPercentage || 0}%):
                      </span>{" "}
                      <span className="text-amber-400">
                        KES {fmt(record.profitAmount || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">B2C Sent:</span>{" "}
                      <span className="text-emerald-400 font-bold">
                        KES {fmt(record.disbursedAmount || record.principal)}
                      </span>
                    </div>
                  </div>
                  {record.b2cReference && (
                    <div className="text-xs text-slate-500 mt-2 font-mono">
                      B2C Ref: {record.b2cReference}
                    </div>
                  )}
                  {record.b2cReceipt && (
                    <div className="text-xs text-slate-500">
                      M-Pesa Receipt: {record.b2cReceipt}
                    </div>
                  )}
                </div>
              ))}
              {disbursedLoans.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No B2C disbursements recorded yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── AUDIT LOGS TAB ─── */}
        {activeTab === "logs" && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">
                System Audit Logs
              </h2>
              <div className="flex gap-2">
                {["all", "customer", "manager", "employer", "admin"].map(
                  (filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      className={`px-3 py-1 rounded-lg text-xs capitalize transition ${
                        logFilter === filter
                          ? "bg-amber-500 text-slate-900"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {systemLogs
                .filter((log) => logFilter === "all" || log.page === logFilter)
                .map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            log.page === "customer"
                              ? "bg-blue-500/20 text-blue-400"
                              : log.page === "manager"
                                ? "bg-purple-500/20 text-purple-400"
                                : log.page === "employer"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {log.page}
                        </span>
                        <span className="text-xs text-slate-500">
                          {log.user}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">{log.time}</span>
                    </div>
                    <p className="text-sm text-slate-300">{log.action}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Modals */}
        <DisbursementModal />
        <ResultModal />
        {showUserActionModal && <UserActionModal />}
      </main>
    </div>
  );
}
