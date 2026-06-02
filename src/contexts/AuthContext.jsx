import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [impersonatedRole, setImpersonatedRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem("felix_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      setUser(parsed.user);
      setToken(parsed.token);
      setImpersonatedRole(parsed.impersonatedRole || null);
    }
  }, []);

  useEffect(() => {
    if (user && token) {
      localStorage.setItem(
        "felix_auth",
        JSON.stringify({ user, token, impersonatedRole }),
      );
    } else {
      localStorage.removeItem("felix_auth");
    }
  }, [user, token, impersonatedRole]);

  async function login({ username, password }) {
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
      const error = await resp.json();
      throw new Error(error.error || "Login failed");
    }
    const data = await resp.json();
    const payload = {
      user: data.user,
      token: data.token,
      impersonatedRole: null,
    };
    localStorage.setItem("felix_auth", JSON.stringify(payload));
    setUser(data.user);
    setToken(data.token);
    setImpersonatedRole(null);

    if (data.user.role === "admin") navigate("/admin");
    if (data.user.role === "manager") navigate("/manager");
    if (data.user.role === "employer") navigate("/employer");
    if (data.user.role === "customer") navigate("/customer");
  }

  function logout() {
    localStorage.removeItem("felix_auth");
    setUser(null);
    setToken(null);
    setImpersonatedRole(null);
    navigate("/");
  }

  function impersonateRole(role) {
    if (!user || user.role !== "admin") return;
    setImpersonatedRole(role);
  }

  function clearImpersonation() {
    setImpersonatedRole(null);
  }

  const effectiveUser = user
    ? { ...user, role: impersonatedRole || user.role }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        realUser: user,
        token,
        login,
        logout,
        impersonatedRole,
        impersonateRole,
        clearImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
