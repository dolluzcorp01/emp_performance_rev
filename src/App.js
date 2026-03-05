import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import ClientConfig from "./Pages/ClientConfig";
import ReviewFormPage from "./Pages/ReviewFormPage";

function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />

      {/* Internal */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/add-client" element={<ClientConfig />} />
      <Route path="/client/:clientId" element={<ClientConfig />} />

      {/* Preview — internal staff only, back + share visible, form is read-only */}
      <Route path="/preview-form/:clientId" element={<ReviewFormPage mode="preview" />} />

      {/* Published — employee-facing, login required, submit & close / submit & continue */}
      <Route path="/review-form/:clientId" element={<ReviewFormPage mode="published" />} />
    </Routes>
  );
}

export default App;