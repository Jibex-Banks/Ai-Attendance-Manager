import React, { useRef, useEffect, useState } from "react";
import { Plus, Search, StepBack, StepForward, UserCircle } from "lucide-react";
import { joinUrl, API_BASE } from "../api";

export default function Scan() {
    const videoElement = useRef(null);
    const canvasRef = useRef(null);
    const [status, setStatus] = useState("");
    const [streaming, setStreaming] = useState(false);

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
                tracks.forEach(t => t.stop());
            }
        };
    }, []);

    const captureAndSend = async () => {
        // draw current frame to canvas
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
                body: JSON.stringify({ image: dataUrl })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(JSON.stringify(data));
            } else {
                setStatus(data.error || JSON.stringify(data));
            }
        } catch (err) {
            setStatus("Network or server error");
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="topbar flex justify-between items-center mb-4">
                <div className="greeting"><h1 className="text-xl font-bold">Live Scanner</h1></div>
                <div className="account flex items-center gap-2"><span>Operator</span><UserCircle /></div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-xl shadow">
                    <video className="face w-full rounded" autoPlay playsInline muted ref={videoElement} />
                    <div className="mt-3 flex gap-2">
                        <button onClick={captureAndSend} className="px-3 py-2 bg-sky-600 text-white rounded">Capture & Scan</button>
                        <button onClick={() => window.location.reload()} className="px-3 py-2 border rounded">Restart</button>
                        <div className="text-sm text-slate-500">{status}</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow">
                    <h3 className="font-semibold">Instructions</h3>
                    <ol className="list-decimal ml-5 mt-2 text-sm text-slate-600">
                        <li>Allow camera access.</li>
                        <li>Position face in view and click <strong>Capture & Scan</strong>.</li>
                        <li>If match found, the attendance will be recorded and you will see the result here.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
