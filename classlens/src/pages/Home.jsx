import React from "react";
import { Plus, Search, UserCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">ClassLens</h1>
                <div className="flex items-center gap-4">
                    <input className="p-2 rounded border" placeholder="Search..." />
                    <Search />
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow">
                    <h2 className="text-xl font-semibold mb-3">Quick actions</h2>
                    <div className="flex gap-3">
                        <Link to="/scan" className="px-4 py-2 bg-sky-600 text-white rounded">Open Scanner</Link>
                        <Link to="/register" className="px-4 py-2 border rounded">Register Student</Link>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow">
                    <h2 className="text-xl font-semibold mb-3">Real-time events</h2>
                    <p className="text-sm text-slate-500">Listen for incoming attendance via SSE stream at <code>/events/attendance</code></p>
                </div>
            </div>
        </div>
    );
}
