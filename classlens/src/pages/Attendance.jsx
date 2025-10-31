import React, { useEffect, useState } from "react";
import { joinUrl, API_BASE } from "../api";

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  // Load classes for filter dropdown
  useEffect(() => {
    fetch(joinUrl(API_BASE, "/classes"))
      .then((r) => r.json())
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  // Load attendance (filtered)
  useEffect(() => {
    const endpoint = classId
      ? joinUrl(API_BASE, `/attendance/${classId}`)
      : joinUrl(API_BASE, "/attendance");

    fetch(endpoint)
      .then((r) => r.json())
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [classId]);

  const exportReports = () => {
    fetch(joinUrl(API_BASE, "/reports/generate"), { method: "POST" })
      .then((r) => console.log(r))
      .catch((e) => console.error(e));
    window.open(joinUrl(API_BASE, "/reports/export"), "_blank");
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <h2 className="text-2xl font-bold">Attendance Records</h2>
        <div className="flex items-center gap-3">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name}
              </option>
            ))}
          </select>
          <button
            onClick={exportReports}
            className="px-3 py-1 bg-sky-600 text-white rounded"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border rounded-lg">
        <table className="min-w-full text-left table-auto">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Student</th>
              <th className="p-3">Class</th>
              <th className="p-3">In Time</th>
              <th className="p-3">Out Time</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td className="p-3 text-center text-slate-500" colSpan={5}>
                  No records found
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.attendance_id || Math.random()} className="border-t">
                  <td className="p-3">{r.attendance_id}</td>
                  <td className="p-3">{r.student}</td>
                  <td className="p-3">{r.class || "—"}</td>
                  <td className="p-3">
                    {new Date(r.in_time).toLocaleString()}
                  </td>
                  <td className="p-3">
                    { r.out_time ? new Date(r.out_time).toLocaleString() : "—"}
                  </td>
                  <td className="p-3">{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
