"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export default function DebugPanel({ socket }) {
  const { userId } = useAuth();
  const [connections, setConnections] = useState([]);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(message);
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  useEffect(() => {
    if (!socket) return;

    // Test socket connection
    addLog("🔌 Testing socket connection...");
    addLog(`Socket connected: ${socket.connected}`);
    addLog(`Socket ID: ${socket._id}`);

    // Listen for all events for debugging
    const originalEmit = socket.emit;
    socket.emit = function (event, data) {
      addLog(`📤 EMITTED: ${event}`, data);
      return originalEmit.apply(this, arguments);
    };

    const handleAllEvents = (data) => {
      addLog(`📥 RECEIVED: ${this.event}`, data);
    };

    // Listen to common events
    const events = [
      "voice_call_offer",
      "voice_call_answer",
      "voice_ice_candidate",
      "video_call_offer",
      "video_call_answer",
      "video_ice_candidate",
      "connect",
      "disconnect",
      "error",
    ];

    events.forEach((event) => {
      socket.on(event, handleAllEvents);
    });

    return () => {
      socket.emit = originalEmit;
      events.forEach((event) => {
        socket.off(event, handleAllEvents);
      });
    };
  }, [socket]);

  const testVoiceCall = async () => {
    addLog("🎯 Testing voice call...");

    try {
      // Test microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog(" Microphone access granted");

      // Test WebRTC
      const pc = new RTCPeerConnection();
      addLog(" PeerConnection created");

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      addLog(" Local tracks added");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addLog(" Offer created");

      pc.close();
      stream.getTracks().forEach((track) => track.stop());
      addLog(" Test completed");
    } catch (error) {
      addLog(` Test failed: ${error.message}`);
    }
  };

  const fetchConnections = async () => {
    try {
      const response = await fetch("/api/debug/connections");
      const data = await response.json();
      setConnections(data.connections);
      addLog(`📊 Active connections: ${data.totalConnections}`);
    } catch (error) {
      addLog(` Failed to fetch connections: ${error.message}`);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-90 text-white p-4 rounded-lg max-w-md max-h-96 overflow-auto z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug Panel</h3>
        <div className="space-x-2">
          <button
            onClick={testVoiceCall}
            className="bg-blue-500 px-2 py-1 rounded text-xs cursor-pointer"
          >
            Test Voice
          </button>
          <button
            onClick={fetchConnections}
            className="bg-green-500 px-2 py-1 rounded text-xs cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div>User ID: {userId}</div>
        <div>Socket: {socket?._id || "Disconnected"}</div>
        <div>Status: {socket?.connected ? "Connected" : "Disconnected"}</div>
      </div>

      <div className="mt-2 border-t pt-2">
        <div className="text-xs font-semibold mb-1">Logs:</div>
        <div className="text-xs space-y-1 max-h-32 overflow-auto">
          {logs.slice(-10).map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
