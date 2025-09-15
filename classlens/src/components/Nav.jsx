import React from "react";
import { Link } from "react-router-dom";

export default function Nav() {
    return (
        <nav className="bg-gradient-to-r from-sky-700 to-teal-600 text-white px-6 py-4 sticky top-0 z-40 shadow-md">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
                <Link to="/" className="font-extrabold text-xl">ClassLens</Link>
                <div className="flex gap-4 items-center">
                    <Link to="/students" className="hidden md:inline-block hover:underline">Students</Link>
                    <Link to="/attendance" className="hidden md:inline-block hover:underline">Attendance</Link>
                    <Link to="/scan" className="bg-white text-sky-700 px-3 py-1 rounded-lg shadow hover:scale-105 transition">Live Scan</Link>
                </div>
            </div>
        </nav>
    );
}
