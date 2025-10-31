import React from "react";
import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Home from "./pages/Home";
import Students from "./pages/Students";
import Attendance from "./pages/Attendance";
import Register from "./pages/Register";
import Scan from "./pages/Scan";
import Admin from "./pages/Admin";
import "./index.css";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-slate-800">
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/students" element={<Students />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/register" element={<Register />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  );
}
