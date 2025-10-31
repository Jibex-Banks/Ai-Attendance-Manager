import React, { useEffect, useState } from "react";
import { joinUrl, API_BASE } from "../api";

export default function Students() {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetch(joinUrl(API_BASE, "/students"))
      .then((r) => r.json())
      .then(setStudents)
      .catch(() => setStudents([]));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Students</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {students.map((s) => (
          <div
            key={s.student_id}
            className="bg-white p-4 rounded-xl border shadow-sm"
          >
            <img
              src={
                s.passport_path ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}`
              }
              alt=""
              className="w-full h-40 object-cover rounded-md"
            />
            <div className="mt-2 font-semibold">{s.name}</div>
            <div className="text-sm">{s.department}</div>
            <div className="text-xs text-slate-400">{s.email}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
