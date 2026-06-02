import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await login({ username, password });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/30 p-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 text-2xl font-black mb-4">
            ƒ
          </div>
          <h1 className="text-3xl font-bold">Welcome back to Felix</h1>
          <p className="text-sm text-slate-400 mt-2">
            Sign in to access your portal and manage loans, approvals, and
            payments.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-medium text-slate-300">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="your.username"
            />
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="Enter your password"
            />
          </label>

          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-amber-400 hover:text-amber-300"
          >
            Register now
          </Link>
        </p>
      </div>
    </div>
  );
}
