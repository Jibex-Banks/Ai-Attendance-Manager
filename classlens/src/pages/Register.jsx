import React, { useState } from "react";
import { joinUrl, API_BASE } from "../api";
import { useNavigate } from "react-router-dom";

export default function Register() {
    const navigate = useNavigate()
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone_number: "",
    department: "",
    passport_path: "",
  });
  const [status, setStatus] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, passport_path: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setStatus("Registering...");
    try {
      const res = await fetch(joinUrl(API_BASE, "/register/student"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setStatus(res.ok ? data.message || "Registered" : data.error || "Error");
      navigate('/students')
    } catch {
      setStatus("Error contacting server");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Register</h2>
      <form onSubmit={submit} className="bg-white p-6 rounded-xl shadow space-y-3">
        {["name", "email", "phone_number", "department"].map((field) => (
          <label key={field} className="block">
            {field.replace("_", " ").toUpperCase()}
            <input
              name={field}
              onChange={onChange}
              className="w-full mt-1 p-2 border rounded"
              required={field === "name"}
            />
          </label>
        ))}

        <label className="block">
          Passport
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="w-full mt-1 p-2 border rounded"
          />
        </label>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-sky-600 text-white rounded">Submit</button>
          <div className="text-sm text-slate-500">{status}</div>
        </div>
      </form>
    </div>
  );
}
