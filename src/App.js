import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import ClientConfig from "./Pages/ClientConfig";
import CreateReviewForm from "./Pages/CreateReviewForm";

function App() {
  return (
    <Routes>
      {/* Login */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Client configuration */}
      <Route path="/add-client" element={<ClientConfig />} />
      <Route path="/client/:clientId" element={<ClientConfig />} />

      {/* Create Review Form */}
      <Route path="/create-review" element={<CreateReviewForm />} />
      <Route path="/create-review/:clientId" element={<CreateReviewForm />} />
    </Routes>
  );
}

export default App;