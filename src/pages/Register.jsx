import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ALLOWED_ROLES = ["admin", "manager", "employer", "customer"];
const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  employer: "Employer",
  customer: "Customer",
};

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { role: roleParam } = useParams();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState(
    ALLOWED_ROLES.includes(roleParam) ? roleParam : "customer",
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ALLOWED_ROLES.includes(roleParam) && roleParam !== role) {
      setRole(roleParam);
    }
  }, [roleParam, role]);

  async function registerUser(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, role }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Registration failed");
      }
      if (data.pendingApproval) {
        setSuccess(
          "Your manager/employer account is pending admin approval. You will receive access once approved.",
        );
      } else {
        await login({ username, password });
        navigate(`/${role}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/30 p-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 text-2xl font-black mb-4">
            ƒ
          </div>
          <h1 className="text-3xl font-bold">Create your Felix account</h1>
          <p className="text-sm text-slate-400 mt-2">
            Choose the right role and access the dashboard that matches your
            work.
          </p>
        </div>

        <form onSubmit={registerUser} className="space-y-5">
          <label className="block text-sm font-medium text-slate-300">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              {ALLOWED_ROLES.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {ROLE_LABELS[roleOption]}
                </option>
              ))}
            </select>
            {(role === "manager" || role === "employer") && (
              <p className="text-xs text-amber-200 mt-2">
                Manager and Employer accounts require admin approval before
                login.
              </p>
            )}
          </label>

          <label className="block text-sm font-medium text-slate-300">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="Choose a username"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            Email (optional)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="Enter a strong password"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="Repeat your password"
            />
          </label>

          {success && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-100">
              {success}
            </div>
          )}
          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading
              ? "Creating account..."
              : `Register as ${ROLE_LABELS[role]}`}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-amber-400 hover:text-amber-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
