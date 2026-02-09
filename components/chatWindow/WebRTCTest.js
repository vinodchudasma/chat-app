'use client';

import { useState, useEffect, useRef } from 'react';

export default function WebRTCTest() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const startTest = async () => {
    try {
      console.log('🎬 Starting WebRTC test...');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      pcRef.current = pc;
      
      // Add local tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📹 Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };
      
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log(' Offer created, SDP:', offer.sdp.substring(0, 100));
      setIsConnected(true);
      
    } catch (error) {
      console.error(' WebRTC test failed:', error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">WebRTC Test</h2>
      <button 
        onClick={startTest}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        Start Test
      </button>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold">Local Video</h3>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-64 bg-black"
          />
        </div>
        <div>
          <h3 className="font-semibold">Remote Video</h3>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-64 bg-black"
          />
        </div>
      </div>
      
      <div className="mt-4">
        <p>Status: {isConnected ? 'Connected' : 'Not Connected'}</p>
        <p>Local Stream: {localStream ? 'Active' : 'Inactive'}</p>
        <p>Remote Stream: {remoteStream ? 'Active' : 'Inactive'}</p>
      </div>
    </div>
  );
}