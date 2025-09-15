import React, { useState } from "react";
import { joinUrl, API_BASE } from "../api";

export default function Register() {
    const [form, setForm] = useState({ name: '', email: '', phone_number: '', department: '', passport_path: '' });
    const [status, setStatus] = useState('');
    function onChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }
    async function submit(e) {
        e.preventDefault();
        setStatus("Registering...");
        try {
            const res = await fetch(joinUrl(API_BASE, "/register/student"), {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
            });
            const data = await res.json();
            if (res.ok) setStatus(data.message || "Registered");
            else setStatus(data.error || "Error");
        } catch (err) { setStatus("Error contacting server"); }
    }
    return (
        <div className="max-w-3xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-4">Register</h2>
            <form onSubmit={submit} className="bg-white p-6 rounded-xl shadow">
                <label className="block">Name<input name="name" required onChange={onChange} className="w-full mt-1 p-2 border rounded" /></label>
                <label className="block mt-3">Email<input name="email" onChange={onChange} className="w-full mt-1 p-2 border rounded" /></label>
                <label className="block mt-3">Phone<input name="phone_number" onChange={onChange} className="w-full mt-1 p-2 border rounded" /></label>
                <label className="block mt-3">Department<input name="department" onChange={onChange} className="w-full mt-1 p-2 border rounded" /></label>
                <label className="block mt-3">Passport (paste base64 data URL)<input name="passport_path" onChange={onChange} className="w-full mt-1 p-2 border rounded" /></label>
                <div className="mt-4 flex items-center gap-3">
                    <button className="px-4 py-2 bg-sky-600 text-white rounded">Submit</button>
                    <div className="text-sm text-slate-500">{status}</div>
                </div>
            </form>
        </div>
    );
}
