import React, { useRef, useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { joinUrl, API_BASE } from "../api";
import { useNavigate } from "react-router-dom";

export default function Scan() {
  const videoElement = useRef(null);
  const [status, setStatus] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState([]);
  const navigate = useNavigate();

  // Fetch available classes from backend
  useEffect(() => {
    fetch(joinUrl(API_BASE, "/classes"))
      .then((r) => r.json())
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  // Start camera
  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoElement.current) {
          videoElement.current.srcObject = stream;
          setStreaming(true);
        }
      } catch (error) {
        console.error("Video Error.. ", error);
        setStatus("Camera permission denied or not available");
      }
    }
    start();

    return () => {
      if (videoElement.current && videoElement.current.srcObject) {
        const tracks = videoElement.current.srcObject.getTracks();
        tracks.forEach((t) => t.stop());
      }
    };
  }, []);

  const captureAndSend = async () => {
    if (!classId) {
      setStatus("Please select a class before scanning.");
      return;
    }

    const video = videoElement.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

    setStatus("Scanning...");

    try {
      const res = await fetch(joinUrl(API_BASE, "/mark_attendance"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, class_id: classId }),
      });
        console.log(classId)
      const data = await res.json();
      if (res.ok) {
        setStatus(`${data.result}`);
        if (data.result == "Match Not Found"){

        }
        else{
        setTimeout(() => navigate("/attendance"), 1000);
        }
      } else {
        setStatus(data.error || "Scan failed");
      }
    } catch (err) {
      setStatus("Network or server error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="topbar flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Live Scanner</h1>
        <div className="account flex items-center gap-2">
          <span>Operator</span>
          <UserCircle />
        </div>
      </div>

      <div className="mb-4">
        <label className="block mb-1 font-semibold">Select Class</label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="p-2 border rounded w-full md:w-1/3"
        >
          <option value="">-- Choose a class --</option>
          {classes.map((c) => (
            <option key={c.class_id} value={c.class_id}>
              {c.class_name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <video
            className="w-full rounded"
            autoPlay
            playsInline
            muted
            ref={videoElement}
          />
          <div className="mt-3 flex gap-2 items-center">
            <button
              onClick={captureAndSend}
              className="px-3 py-2 bg-sky-600 text-white rounded"
            >
              Capture & Scan
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 border rounded"
            >
              Restart
            </button>
            <div className="text-sm text-slate-500">{status}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-semibold">Instructions</h3>
          <ol className="list-decimal ml-5 mt-2 text-sm text-slate-600">
            <li>Select the class before scanning.</li>
            <li>Allow camera access.</li>
            <li>Position face in view and click <strong>Capture & Scan</strong>.</li>
            <li>If a match is found, attendance will be recorded for that class.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
