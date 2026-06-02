import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardAdmin from "./pages/DashboardAdmin";
import DashboardManager from "./pages/DashboardManager";
import DashboardEmployer from "./pages/DashboardEmployer";
import DashboardCustomer from "./pages/DashboardCustomer";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register/:role?" element={<Register />} />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DashboardAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/*"
        element={
          <ProtectedRoute allowedRoles={["manager"]}>
            <DashboardManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/*"
        element={
          <ProtectedRoute allowedRoles={["employer"]}>
            <DashboardEmployer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/*"
        element={
          <ProtectedRoute allowedRoles={["customer"]}>
            <DashboardCustomer />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
