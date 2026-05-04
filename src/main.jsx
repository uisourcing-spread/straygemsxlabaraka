import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import Vendeur from "./Vendeur";
import SetPassword from "./SetPassword";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/"             element={<Dashboard />} />
      <Route path="/vendeur"      element={<Vendeur />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="*"             element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>
);
