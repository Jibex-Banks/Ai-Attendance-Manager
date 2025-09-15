import React, { useEffect, useState } from "react";
import { joinUrl, API_BASE } from "../api";

export default function Attendance() {
    const [records, setRecords] = useState([]);
    useEffect(() => {
        fetch(joinUrl(API_BASE, "/attendance")).then(r => r.json()).then(setRecords).catch(() => setRecords([]));
    }, []);

    // SSE subscription to update live records
    useEffect(() => {
        const sse = new EventSource(joinUrl(API_BASE, "/events/attendance"));
        sse.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                setRecords(prev => [data, ...prev]);
            } catch (err) { }
        };
        sse.onerror = () => sse.close();
        return () => sse.close();
    }, []);

    const exportReports = () => {
        window.open(joinUrl(API_BASE, "/reports/export"), "_blank");
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Attendance Records</h2>
                <button onClick={exportReports} className="px-3 py-1 bg-sky-600 text-white rounded">Export CSV</button>
            </div>
            <div className="overflow-x-auto bg-white border rounded-lg">
                <table className="min-w-full text-left table-auto">
                    <thead className="bg-slate-50">
                        <tr><th className="p-3">ID</th><th className="p-3">Student</th><th className="p-3">In Time</th><th className="p-3">Status</th></tr>
                    </thead>
                    <tbody>
                        {records.map(r => (
                            <tr key={r.attendance_id || Math.random()} className="border-t">
                                <td className="p-3">{r.attendance_id}</td>
                                <td className="p-3">{r.student_id}</td>
                                <td className="p-3">{new Date(r.in_time).toLocaleString()}</td>
                                <td className="p-3">{r.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
