import React, { useEffect, useState, useRef } from "react";
import {
  Plus,
  Search,
  UserCircle,
  Users,
  BookOpen,
  FileText,
  Settings,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { joinUrl, API_BASE } from "../api";



function SmallInput({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="block">
      <div className="text-sm text-slate-600 mb-1">{label}</div>
      <input
        className="w-full p-2 border rounded"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}


export default function Admin() {
  const [tab, setTab] = useState("overview");

  // Data states
  const [faculties, setFaculties] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [reports, setReports] = useState([]);

  // Form states (faculty/class)
  const [facName, setFacName] = useState("");
  const [facEmail, setFacEmail] = useState("");
  const [facPhone, setFacPhone] = useState("");
  const [facRole, setFacRole] = useState("");

  const [className, setClassName] = useState("");
  const [classFacultyId, setClassFacultyId] = useState("");
  const [classStart, setClassStart] = useState("");
  const [classEnd, setClassEnd] = useState("");

  // Student search/filter
  const [searchQuery, setSearchQuery] = useState("");

  // SSE
  const [events, setEvents] = useState([]);
  const evtSourceRef = useRef(null);

  // Fetch helpers
  async function fetchFaculties() {
    try {
      const res = await fetch(`${API_BASE}/faculties`);
      if (!res.ok) throw new Error("Failed to fetch faculties");
      const data = await res.json();
      setFaculties(data);
    } catch (e) {
      console.error(e);
    }
  }

  // Mark all remaining students absent at the end of a class
async function handleEndClass(classId) {
  if (!window.confirm("Are you sure you want to end this class and mark remaining students as absent?")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/mark_absent/${classId}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to end class");

    alert(data.message || "Class ended successfully");
    await fetchAttendance(); // refresh attendance data
  } catch (err) {
    alert("Error ending class: " + err.message);
  }
}

  async function fetchClasses() {
    try {
      const res = await fetch(`${API_BASE}/classes`);
      if (!res.ok) throw new Error("Failed to fetch classes");
      const data = await res.json();
      setClasses(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchStudents() {
    try {
      const res = await fetch(`${API_BASE}/students`);
      if (!res.ok) throw new Error("Failed to fetch students");
      const data = await res.json();
      setStudents(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchAttendance() {
    try {
      const res = await fetch(`${API_BASE}/attendance`);
      if (!res.ok) throw new Error("Failed to fetch attendance");
      const data = await res.json();
      setAttendance(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchReports() {
    try {
      const res = await fetch(`${API_BASE}/reports`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      setReports(data);
    } catch (e) {
      console.error(e);
    }
  }

  // Create faculty
  async function createFaculty(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/faculties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: facName, email: facEmail, phone_number: facPhone, role: facRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      // reset + reload
      setFacName(""); setFacEmail(""); setFacPhone(""); setFacRole("");
      await fetchFaculties();
      alert("Faculty created");
    } catch (err) {
      alert("Error creating faculty: " + err.message);
    }
  }

  // Create class
  async function createClass(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: className,
          faculty_id: classFacultyId || null,
          schedule_start_time: classStart || null,
          schedule_end_time: classEnd || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setClassName(""); setClassFacultyId(""); setClassStart(""); setClassEnd("");
      await fetchClasses();
      alert("Class created");
    } catch (err) {
      alert("Error creating class: " + err.message);
    }
  }

  // Generate reports
  async function handleGenerateReports() {
    try {
      const res = await fetch(`${API_BASE}/reports/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      await fetchReports();
      alert("Reports generated");
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  // Export CSV
  function handleExportReports() {
    // open export endpoint in new tab to trigger download
    const url = `${API_BASE}/reports/export`;
    window.open(url, "_blank");
  }

  // SSE connect
  useEffect(() => {
    // open only once
    const src = new EventSource(`${API_BASE || ""}/events/attendance`);
    evtSourceRef.current = src;
    src.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        setEvents((s) => [parsed, ...s].slice(0, 50)); // keep a small list
        // also refresh attendance list shortly after event
        fetchAttendance();
      } catch (err) {
        console.error("SSE parse", err);
      }
    };
    src.onerror = (e) => {
      // EventSource reconnects automatically; log for debugging
      console.error("SSE error", e);
    };
    return () => {
      src.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initial load when admin page mounts
  useEffect(() => {
    fetchFaculties();
    fetchClasses();
    fetchStudents();
    fetchAttendance();
    fetchReports();
  }, []);

  // filtered students
  const visibleStudents = students.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="w-6 h-6" /> ClassLens — Admin
        </h1>

        <div className="flex items-center gap-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-2 rounded border"
            placeholder="Search students or emails..."
          />
          <Search />
          <Link to="/" className="text-sm text-slate-600">Back to Home</Link>
        </div>
      </div>

      {/* tabs */}
      <div className="mb-6 flex gap-3">
        {[
          ["overview", "Overview", Zap],
          ["faculties", "Faculties", UserCircle],
          ["classes", "Classes", BookOpen],
          ["students", "Students", Users],
          ["attendance", "Attendance", FileText],
          ["reports", "Reports", FileText],
          ["settings", "Settings", Settings],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl ${tab === id ? "bg-sky-600 text-white" : "bg-white border text-slate-700"}`}
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              <span className="text-sm">{label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* content */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* left column */}
        <div className="bg-white p-6 rounded-xl shadow">
          {tab === "overview" && (
            <>
              <h2 className="text-xl font-semibold mb-3">Overview</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded">
                  <div className="text-xs text-slate-500">Faculties</div>
                  <div className="text-2xl font-bold">{faculties.length}</div>
                </div>
                <div className="p-4 border rounded">
                  <div className="text-xs text-slate-500">Classes</div>
                  <div className="text-2xl font-bold">{classes.length}</div>
                </div>
                <div className="p-4 border rounded">
                  <div className="text-xs text-slate-500">Students</div>
                  <div className="text-2xl font-bold">{students.length}</div>
                </div>
                <div className="p-4 border rounded">
                  <div className="text-xs text-slate-500">Today's Attendance</div>
                  <div className="text-2xl font-bold">{attendance.length}</div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold mb-2">Live attendance events</h3>
                <div className="max-h-48 overflow-auto border rounded p-2">
                  {events.length === 0 ? (
                    <div className="text-sm text-slate-500">No events yet</div>
                  ) : (
                    events.map((ev, i) => (
                      <div key={i} className="py-2 border-b last:border-b-0">
                        <div className="text-sm font-semibold">Student ID: {ev.student_id}</div>
                        <div className="text-xs text-slate-500">Class: {ev.class_id} • {new Date(ev.in_time).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {tab === "faculties" && (
            <>
              <h2 className="text-xl font-semibold mb-3">Faculties</h2>

              <form onSubmit={createFaculty} className="space-y-3 mb-4">
                <SmallInput label="Name" value={facName} onChange={setFacName} />
                <SmallInput label="Email" value={facEmail} onChange={setFacEmail} />
                <SmallInput label="Phone" value={facPhone} onChange={setFacPhone} />
                <SmallInput label="Role" value={facRole} onChange={setFacRole} />
                <div className="flex gap-3">
                  <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Faculty
                  </button>
                  <button type="button" onClick={fetchFaculties} className="px-4 py-2 border rounded">Refresh</button>
                </div>
              </form>

              <div className="mt-4">
                <h3 className="font-semibold mb-2">Existing Faculties</h3>
                <div className="space-y-2">
                  {faculties.length === 0 && <div className="text-sm text-slate-500">No faculties yet</div>}
                  {faculties.map((f) => (
                    <div key={f.faculty_id} className="p-3 border rounded flex justify-between items-center">
                      <div>
                        <div className="font-medium">{f.name}</div>
                        <div className="text-sm text-slate-500">{f.email} • {f.phone_number}</div>
                      </div>
                      <div className="text-sm text-slate-400">{f.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "classes" && (
            <>
              <h2 className="text-xl font-semibold mb-3">Classes</h2>

              <form onSubmit={createClass} className="space-y-3 mb-4">
                <SmallInput label="Class Name" value={className} onChange={setClassName} />
                <label className="block">
                  <div className="text-sm text-slate-600 mb-1">Faculty</div>
                  <select
                    value={classFacultyId}
                    onChange={(e) => setClassFacultyId(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">— choose faculty —</option>
                    {faculties.map((f) => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.name}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <SmallInput label="Start (HH:MM)" value={classStart} onChange={setClassStart} placeholder="08:00" />
                  <SmallInput label="End (HH:MM)" value={classEnd} onChange={setClassEnd} placeholder="09:30" />
                </div>

                <div className="flex gap-3">
                  <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Create Class</button>
                  <button type="button" onClick={fetchClasses} className="px-4 py-2 border rounded">Refresh</button>
                </div>
              </form>

              <div>
                <h3 className="font-semibold mb-2">Class list</h3>
                <div className="space-y-2">
                  {classes.length === 0 && <div className="text-sm text-slate-500">No classes</div>}
                 {classes.map((c) => (
  <div key={c.class_id} className="p-3 border rounded flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <div>
        <div className="font-medium">{c.class_name}</div>
        <div className="text-sm text-slate-500">
          Faculty: {c.faculty_id ?? "—"}
        </div>
      </div>
      <div className="text-sm text-slate-500">
        {c.schedule_start_time ?? ""} — {c.schedule_end_time ?? ""}
      </div>
    </div>

    <div className="flex justify-end">
      <button
        onClick={() => handleEndClass(c.class_id)}
        className="px-3 py-1 bg-rose-600 text-white rounded text-sm hover:bg-rose-700"
      >
        End Class
      </button>
    </div>
  </div>
))}

                </div>
              </div>
            </>
          )}

          {tab === "students" && (
            <>
              <h2 className="text-xl font-semibold mb-3">Students</h2>

              <div className="mb-4">
                <div className="text-sm text-slate-500">Search by name or email above</div>
              </div>

              <div className="space-y-2">
                {visibleStudents.length === 0 && <div className="text-sm text-slate-500">No students found</div>}
                {visibleStudents.map((s) => (
                  <div key={s.student_id} className="p-3 border rounded flex justify-between items-center">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-sm text-slate-500">{s.email} • {s.department}</div>
                    </div>
                    <div className="text-sm text-slate-400">{new Date(s.created_at || "").toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "attendance" && (
            <>
              <h2 className="text-xl font-semibold mb-3">Today's Attendance</h2>
              <div className="space-y-2">
                {attendance.length === 0 && <div className="text-sm text-slate-500">No attendance records for today</div>}
                {attendance.map((a) => (
                  <div key={a.attendance_id} className="p-3 border rounded flex justify-between items-center">
                    <div>
                      <div className="font-medium">{a.student}</div>
                      <div className="text-sm text-slate-500">Class: {a.class_id} • {a.status}</div>
                    </div>
                    <div className="text-sm text-slate-400">{a.in_time ? new Date(a.in_time).toLocaleTimeString() : ""}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "reports" && (
            <>
              <h2 className="text-xl font-semibold mb-3">Reports</h2>
              <div className="flex gap-3 mb-4">
                <button onClick={handleGenerateReports} className="px-4 py-2 bg-sky-600 text-white rounded">Generate</button>
                <button onClick={handleExportReports} className="px-4 py-2 border rounded">Export CSV</button>
                <button onClick={fetchReports} className="px-4 py-2 border rounded">Refresh</button>
              </div>

              <div className="space-y-2">
                {reports.length === 0 && <div className="text-sm text-slate-500">No reports</div>}
                {reports.map((r) => (
                  <div key={r.report_id} className="p-3 border rounded flex justify-between items-center">
                    <div>
                      <div className="font-medium">Student ID: {r.student_id}</div>
                      <div className="text-sm text-slate-500">Attendance: {r.attendance_percentage ?? "—"}% • {r.remarks}</div>
                    </div>
                    <div className="text-sm text-slate-400">{r.generated_at ? new Date(r.generated_at).toLocaleString() : ""}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "settings" && (
            <>
              <h2 className="text-xl font-semibold mb-3">Settings</h2>
              <div className="text-sm text-slate-600">
                This panel is reserved for admin settings (create admin, change thresholds, toggle match threshold).
                You can implement calls to:
                <pre className="bg-slate-50 p-2 rounded text-xs mt-2">POST /admin/create</pre>
              </div>
            </>
          )}
        </div>

        {/* right column (secondary panels) */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="font-semibold mb-2">Quick actions</h3>
            <div className="flex gap-3">
              <Link to="/scan" className="px-4 py-2 bg-sky-600 text-white rounded">Open Scanner</Link>
              <Link to="/register" className="px-4 py-2 border rounded">Register Student</Link>
            </div>
            <p className="text-sm text-slate-500 mt-3">SSE stream endpoint: <code>/events/attendance</code></p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="font-semibold mb-2">Recent event log</h3>
            <div className="max-h-48 overflow-auto border rounded p-2">
              {events.length === 0 ? <div className="text-sm text-slate-500">No recent events</div> :
                events.map((ev, i) => (
                  <div key={i} className="py-2 border-b last:border-b-0 text-sm">
                    <div className="font-medium">ID: {ev.student_id} • class {ev.class_id}</div>
                    <div className="text-slate-500">{new Date(ev.in_time).toLocaleString()}</div>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="font-semibold mb-2">System</h3>
            <div className="text-sm text-slate-500">API: <code>{API_BASE || "same origin"}</code></div>
            <div className="text-sm text-slate-500 mt-2">Match threshold used in backend: <code>MATCH_THRESHOLD</code> env var (server side)</div>
            <div className="mt-3">
              <button onClick={() => { fetchFaculties(); fetchClasses(); fetchStudents(); fetchAttendance(); fetchReports(); }} className="px-3 py-2 border rounded">Refresh all</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
