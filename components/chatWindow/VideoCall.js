'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Phone,
  PhoneOff,
  User,
  Clock,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ringtoneService } from '../../lib/ringtone-service';

export default function VideoCall({
  callData,
  socket,
  onEndCall,
  onAcceptCall,
  onRejectCall,
  isIncoming = false,
  isGroupCall = false
}) {
  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [debugLog, setDebugLog] = useState([]);
  const [callDuration, setCallDuration] = useState(0); // Changed to state


  const peerConnection = useRef(null);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const pendingIceCandidates = useRef([]);
  const isSettingRemoteDescription = useRef(false);
  const callStartTime = useRef(null);
  const callTimerRef = useRef(0);
  const mediaStream = useRef(null);
  const screenStream = useRef(null);
  const videoSender = useRef(null);
  const audioSender = useRef(null);
  const hasRemoteStream = useRef(false);
  const pendingOffer = useRef(null);
  const timerInterval = useRef(null);


  const addDebug = (message) => {
    console.log('🎥 DEBUG:', message);
    setDebugLog(prev => [...prev.slice(-50), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:173.249.60.84:3478',
        username: 'briyan',
        credential: 'MySecurePassword2024!'
      }
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };


  useEffect(() => {
    addDebug('Component mounted - initializing video call');

    // Only initialize for OUTGOING calls
    if (!isIncoming) {
      initializeCall();
    } else {
      addDebug('Incoming call - waiting for manual acceptance');
    }

    return () => {
      addDebug('Component unmounting - cleanup');
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!socket) {
      addDebug('No socket available');
      return;
    }

    addDebug('Setting up socket listeners');

    const handleVideoOffer = async (data) => {
      addDebug(`📹 Received VIDEO OFFER from ${data.callerId}`);
      if (data.callId === callData.callId) {
        await handleOffer(data);
      }
    };

    const handleVideoAnswer = async (data) => {
      addDebug(` Received VIDEO ANSWER from ${data.targetUserId}`);
      if (data.callId === callData.callId && peerConnection.current) {
        await handleAnswer(data);
      }
    };

    const handleVideoIceCandidate = (data) => {
      addDebug('🧊 Received VIDEO ICE candidate');
      if (data.callId === callData.callId) {
        handleIceCandidate(data.candidate);
      }
    };

    const handleCallAccepted = (data) => {
      if (data.callId === callData.callId) {
        addDebug('🎉 Video call accepted by remote user');
        callStartTime.current = new Date();
      }
    };

    const handleCallEnded = (data) => {
      if (data.callId === callData.callId) {
        addDebug('📹 Video call ended by remote party');
        if (callStartTime.current) {
          const duration = Math.floor((new Date() - callStartTime.current) / 1000);
          callTimerRef.current = duration;
        }
        setCallStatus('ended');
        setTimeout(() => {
          onEndCall(callTimerRef.current);
        }, 1000);
      }
    };

    const handleCallRejected = (data) => {
      if (data.callId === callData.callId) {
        addDebug(' Call was rejected by remote party');
        setCallStatus('rejected');

        // Clean up immediately
        setTimeout(() => {
          cleanup();
          if (onEndCall) onEndCall(0);
        }, 1000);
      }
    };

    socket.on('video_call_offer', handleVideoOffer);
    socket.on('video_call_answer', handleVideoAnswer);
    socket.on('receive_video_ice_candidate', handleVideoIceCandidate);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_rejected', handleCallRejected);


    return () => {
      socket.off('video_call_offer', handleVideoOffer);
      socket.off('video_call_answer', handleVideoAnswer);
      socket.off('receive_video_ice_candidate', handleVideoIceCandidate);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_rejected', handleCallRejected);

    };
  }, [socket, callData.callId]);

  // Timer effect
  useEffect(() => {
    if (callStatus === 'active' && callStartTime.current) {
      timerInterval.current = setInterval(() => {
        const seconds = Math.floor((new Date() - callStartTime.current) / 1000);
        setCallDuration(seconds);
        callTimerRef.current = seconds;
      }, 1000);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [callStatus]);

  const cleanup = () => {
    addDebug('🧹 Cleaning up video call resources...');

    ringtoneService.stop();

    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => {
        track.stop();
        addDebug(`⏹️ Stopped track: ${track.kind}`);
      });
      mediaStream.current = null;
    }

    if (screenStream.current) {
      screenStream.current.getTracks().forEach(track => {
        track.stop();
        addDebug(`⏹️ Stopped screen share track: ${track.kind}`);
      });
      screenStream.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      addDebug('🔒 Peer connection closed');
      peerConnection.current = null;
    }

    pendingIceCandidates.current = [];
    pendingOffer.current = null;

    if (localVideo.current) {
      localVideo.current.srcObject = null;
    }
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }

    videoSender.current = null;
    audioSender.current = null;
    hasRemoteStream.current = false;
    setIsScreenSharing(false);
    setCallDuration(0);
    callTimerRef.current = 0;
    callStartTime.current = null;
  };

  const handleIceCandidate = async (candidate) => {
    addDebug("ICE candidate received");

    if (!peerConnection.current) {
      addDebug(' No peer connection, storing ICE candidate');
      pendingIceCandidates.current.push(candidate);
      return;
    }

    if (!peerConnection.current.remoteDescription) {
      addDebug('⏳ Remote description not set yet, storing ICE candidate');
      pendingIceCandidates.current.push(candidate);
      return;
    }

    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      addDebug(' ICE candidate added successfully');
    } catch (err) {
      addDebug(` ICE candidate error: ${err.message}`);
    }
  };

  const processPendingIceCandidates = async () => {
    if (pendingIceCandidates.current.length === 0) return;

    addDebug(`🔄 Processing ${pendingIceCandidates.current.length} pending ICE candidates`);

    for (const candidate of pendingIceCandidates.current) {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        addDebug(' Pending ICE candidate added');
      } catch (err) {
        addDebug(` Pending ICE candidate error: ${err.message}`);
      }
    }

    pendingIceCandidates.current = [];
  };

  const getMedia = async () => {
    try {
      addDebug('🎥 Requesting camera and microphone access...');

      const constraintSets = [
        {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            facingMode: 'user'
          }
        },
        {
          audio: true,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        },
        {
          audio: true,
          video: true
        }
      ];

      let stream = null;
      let lastError = null;

      for (const constraints of constraintSets) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          addDebug(` Media access granted`);
          break;
        } catch (err) {
          lastError = err;
          addDebug(` Failed with constraints: ${JSON.stringify(constraints)}`);
        }
      }

      if (!stream) {
        throw lastError || new Error('All constraint sets failed');
      }

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      if (videoTracks.length === 0 || audioTracks.length === 0) {
        throw new Error('No video or audio tracks found');
      }

      addDebug(`🎵 Tracks acquired: ${videoTracks.length} video, ${audioTracks.length} audio`);

      stream.getTracks().forEach((track, index) => {
        addDebug(`🔊 Track ${index}: ${track.kind} - ${track.label}`);
        track.enabled = true;
      });

      mediaStream.current = stream;
      setLocalStream(stream);

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
        localVideo.current.muted = true;
        try {
          await localVideo.current.play();
          addDebug(' Local video preview started');
        } catch (err) {
          addDebug(` Local video play error: ${err.message}`);
        }
      }

      return stream;
    } catch (err) {
      const errorMsg = ` Cannot access camera/microphone: ${err.message}`;
      addDebug(errorMsg);
      setError(errorMsg);
      throw err;
    }
  };

  const createPeerConnection = (stream) => {
    try {
      addDebug('🔗 Creating video peer connection...');
      const pc = new RTCPeerConnection(rtcConfig);

      stream.getTracks().forEach(track => {
        try {
          const sender = pc.addTrack(track, stream);
          if (track.kind === 'video') {
            videoSender.current = sender;
            addDebug(` Added video track`);
          } else if (track.kind === 'audio') {
            audioSender.current = sender;
            addDebug(` Added audio track`);
          }
        } catch (err) {
          addDebug(` Failed to add track ${track.kind}: ${err.message}`);
        }
      });

      pc.ontrack = (event) => {
        if (hasRemoteStream.current) {
          addDebug('⚠️ Ignoring duplicate ontrack event');
          return;
        }

        addDebug('🎧 ONTRACK EVENT FIRED - Remote video stream received');

        if (event.streams && event.streams.length > 0) {
          const remoteStream = event.streams[0];

          const videoTracks = remoteStream.getVideoTracks();
          const audioTracks = remoteStream.getAudioTracks();
          addDebug(`🎵 Remote stream: ${videoTracks.length} video, ${audioTracks.length} audio`);

          hasRemoteStream.current = true;
          setRemoteStream(remoteStream);

          setTimeout(() => {
            setupRemoteVideo(remoteStream);
          }, 100);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDebug(`🧊 Sending ICE candidate`);
          const targetUserId = isIncoming ? callData.callerId : callData.targetUserId;
          socket.emit('send_video_ice_candidate', {
            callId: callData.callId,
            targetUserId: targetUserId,
            candidate: event.candidate
          });
        } else {
          addDebug(' All ICE candidates gathered');
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        addDebug(`🔗 Connection state: ${state}`);

        switch (state) {
          case 'connected':
            addDebug('🎉 WebRTC CONNECTED!');
            break;
          case 'disconnected':
            addDebug('⚠️ Connection disconnected');
            setError('Connection lost - trying to reconnect...');
            break;
          case 'failed':
            setError('Connection failed. Please try again.');
            addDebug(' Connection failed');
            break;
          case 'closed':
            addDebug('🔒 Connection closed');
            break;
        }
      };

      pc.oniceconnectionstatechange = () => {
        addDebug(`🧊 ICE connection state: ${pc.iceConnectionState}`);
      };

      peerConnection.current = pc;
      return pc;
    } catch (err) {
      addDebug(` Error creating peer connection: ${err.message}`);
      throw err;
    }
  };

  const setupRemoteVideo = async (videoStream) => {
    if (!remoteVideo.current) {
      addDebug(' No remote video element available - retrying in 500ms');
      setTimeout(() => {
        if (remoteVideo.current) {
          setupRemoteVideo(videoStream);
        }
      }, 500);
      return;
    }

    addDebug('📹 Setting up remote video playback...');

    try {
      remoteVideo.current.pause();
      remoteVideo.current.srcObject = null;
      remoteVideo.current.load();

      await new Promise(resolve => setTimeout(resolve, 100));

      remoteVideo.current.srcObject = videoStream;
      remoteVideo.current.muted = false;
      remoteVideo.current.volume = 1.0;
      remoteVideo.current.playsInline = true;
      remoteVideo.current.setAttribute('playsinline', 'true');

      addDebug('▶️ Attempting to play remote video...');

      const playPromise = remoteVideo.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            addDebug('🎉 REMOTE VIDEO PLAYING SUCCESSFULLY!');
          })
          .catch(playError => {
            addDebug(` Video play failed: ${playError.message}`);
          });
      }
    } catch (error) {
      addDebug(` Error setting up remote video: ${error.message}`);
    }
  };

  const initializeCall = async () => {
    try {
      addDebug('🚀 Initializing call...');
      setError('');

      const stream = await getMedia();
      const pc = createPeerConnection(stream);

      if (!isIncoming) {
        addDebug('📤 Creating offer as caller...');

        if (pc.signalingState !== 'stable') {
          addDebug('⏳ Waiting for stable signaling state...');
          await new Promise((resolve) => {
            const checkState = () => {
              if (pc.signalingState === 'stable') {
                resolve();
              } else {
                setTimeout(checkState, 100);
              }
            };
            checkState();
          });
        }

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          voiceActivityDetection: true
        });

        addDebug(` Offer created`);

        await pc.setLocalDescription(offer);
        addDebug(`📡 Local description set`);

        const targetUserId = callData.targetUserId;
        addDebug(`📤 Sending offer to user: ${targetUserId}`);

        socket.emit('video_call_offer', {
          targetUserId: targetUserId,
          callId: callData.callId,
          callerId: callData.callerId,
          offer: offer
        });

        addDebug(' Outgoing call initialization complete');
      }
    } catch (err) {
      const errorMsg = ` Failed to initialize call: ${err.message}`;
      addDebug(errorMsg);
      setError(errorMsg);
      endCall();
    }
  };

  const handleOffer = async (data) => {
    try {
      addDebug('📥 Received offer - storing for manual acceptance...');

      // Store the offer, don't process it yet
      pendingOffer.current = data;

      addDebug(' Offer stored, waiting for user to accept');

    } catch (err) {
      const errorMsg = ` Failed to handle offer: ${err.message}`;
      addDebug(errorMsg);
      setError(errorMsg);
      rejectCall();
    }
  };

  const handleAnswer = async (data) => {
    try {
      if (!peerConnection.current) {
        addDebug(' No peer connection available');
        return;
      }

      addDebug(`📡 Current signaling state: ${peerConnection.current.signalingState}`);

      if (peerConnection.current.signalingState === 'stable') {
        addDebug(' Already stable, ignoring duplicate answer');
        return;
      }

      isSettingRemoteDescription.current = true;

      addDebug('🔄 Setting remote description from answer...');
      const answer = new RTCSessionDescription(data.answer);
      await peerConnection.current.setRemoteDescription(answer);

      isSettingRemoteDescription.current = false;

      addDebug(' Remote description set successfully');

      await processPendingIceCandidates();

      setCallStatus('active');
      callStartTime.current = new Date();

    } catch (err) {
      isSettingRemoteDescription.current = false;
      const errorMsg = ` Error setting remote description: ${err.message}`;
      addDebug(errorMsg);

      if (peerConnection.current.iceConnectionState === 'connected') {
        addDebug(' Connection already established');
        setCallStatus('active');
        callStartTime.current = new Date();
      }
    }
  };

  const acceptCall = async () => {
    addDebug(' Accepting call...');

    ringtoneService.stop();
    try {
      setError('');

      // NOW setup WebRTC after manual acceptance
      const stream = await getMedia();
      const pc = createPeerConnection(stream);

      // Process the stored offer
      if (pendingOffer.current) {
        addDebug('📥 Processing stored offer after acceptance...');

        const data = pendingOffer.current;

        addDebug(`📡 Initial signaling state: ${pc.signalingState}`);

        if (pc.signalingState !== 'stable') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        isSettingRemoteDescription.current = true;

        addDebug('🔄 Setting remote description from offer...');
        const offer = new RTCSessionDescription(data.offer);
        await pc.setRemoteDescription(offer);

        isSettingRemoteDescription.current = false;

        await processPendingIceCandidates();

        addDebug('📤 Creating answer...');
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          voiceActivityDetection: true
        });

        await pc.setLocalDescription(answer);
        addDebug(`📡 Local description set`);

        socket.emit('video_call_answer', {
          callId: data.callId,
          targetUserId: data.callerId,
          answer: answer
        });

        pendingOffer.current = null;
      }

      // Notify server
      socket.emit('accept_call', {
        callId: callData.callId,
        targetUserId: callData.callerId
      });

      setCallStatus('active');
      callStartTime.current = new Date();

      if (onAcceptCall) onAcceptCall();

      addDebug(' Call accepted and WebRTC established');

    } catch (err) {
      const errorMsg = ` Failed to accept call: ${err.message}`;
      addDebug(errorMsg);
      setError(errorMsg);
    }
  };

  const rejectCall = () => {
    addDebug(' Rejecting call...');
    socket.emit('reject_call', {
      callId: callData.callId,
      targetUserId: callData.callerId
    });
    cleanup();
    if (onRejectCall) onRejectCall();
  };

  const endCall = () => {
    addDebug('📞 Ending call...');

    let duration = callTimerRef.current;

    socket.emit('end_call', {
      callId: callData.callId,
      targetUserId: isIncoming ? callData.callerId : callData.targetUserId,
      duration: duration
    });

    cleanup();
    if (onEndCall) onEndCall(duration);
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        addDebug(`📹 Camera ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        addDebug(`🎤 Microphone ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        addDebug('🖥️ Starting screen share...');

        const screenShareStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always'
          },
          audio: true
        });

        screenStream.current = screenShareStream;

        const videoTrack = screenShareStream.getVideoTracks()[0];

        if (videoSender.current && videoTrack) {
          await videoSender.current.replaceTrack(videoTrack);
          addDebug(' Screen share track replaced');
        }

        if (localVideo.current) {
          localVideo.current.srcObject = screenShareStream;
        }

        videoTrack.onended = () => {
          addDebug('🖥️ Screen share ended by user');
          stopScreenShare();
        };

        setIsScreenSharing(true);
        addDebug(' Screen sharing started');

      } else {
        await stopScreenShare();
      }
    } catch (err) {
      addDebug(` Screen share error: ${err.message}`);
      setError('Failed to share screen');
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenStream.current) {
        screenStream.current.getTracks().forEach(track => track.stop());
        screenStream.current = null;
      }

      if (mediaStream.current && videoSender.current) {
        const videoTrack = mediaStream.current.getVideoTracks()[0];
        if (videoTrack) {
          await videoSender.current.replaceTrack(videoTrack);
          addDebug(' Camera track restored');
        }
      }

      if (localVideo.current && mediaStream.current) {
        localVideo.current.srcObject = mediaStream.current;
      }

      setIsScreenSharing(false);
      addDebug('🖥️ Screen share stopped');
    } catch (err) {
      addDebug(` Error stopping screen share: ${err.message}`);
    }
  };

  const forceVideoPlayback = async () => {
    if (remoteVideo.current && remoteStream) {
      addDebug('📹 Forcing video playback...');
      try {
        await remoteVideo.current.play();
        addDebug(' Forced video playback successful');
      } catch (err) {
        addDebug(` Forced video playback failed: ${err.message}`);
      }
    }
  };

  const retryConnection = () => {
    addDebug('🔄 Retrying connection...');
    setError('');
    cleanup();
    setTimeout(() => {
      initializeCall();
    }, 1000);
  };

  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // INCOMING CALL UI
  if (isIncoming && callStatus === 'ringing' && !isMinimized) {
    return (
      <div className="fixed top-6 right-6 z-50 animate-fade-in">
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl p-6 w-96 border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {callData.callerName || 'Unknown Caller'}
                </h3>
                <p className="text-gray-400 text-sm flex items-center">
                  <Video className="w-3 h-3 mr-1" />
                  Incoming Video Call
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden mb-3">
                {localStream ? (
                  <video
                    ref={localVideo}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-600" />
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-sm text-center">Your preview</p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={rejectCall}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
            >
              <PhoneOff className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              <span>Decline</span>
            </button>
            <button
              onClick={acceptCall}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
            >
              <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Minimized incoming call
  if (isIncoming && callStatus === 'ringing' && isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-gray-900 rounded-lg shadow-lg p-3 w-64 border border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center animate-pulse">
                <Video className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Incoming Video</p>
                <p className="text-gray-400 text-xs">{callData.callerName}</p>
              </div>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={acceptCall}
                className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                <Video className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={rejectCall}
                className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <PhoneOff className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE CALL UI
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-black flex flex-col z-50">
      {/* Top Bar */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${callStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <div>
              <h1 className="text-white font-semibold text-lg">
                {callData.callerName || callData.targetUserName || 'Video Call'}
              </h1>
              <div className="flex items-center space-x-2 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>{formatTime(callDuration)}</span>
                <span>•</span>
                <span>{callStatus === 'active' ? 'Connected' : callStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row p-4 gap-6 max-w-6xl mx-auto w-full">
        {/* Remote Video */}
        <div className="flex-1 bg-black/40 rounded-2xl border border-gray-800 overflow-hidden relative">
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
          />

          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-800/80 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-gray-700">
                  <User className="w-12 h-12 text-gray-600" />
                </div>
                <p className="text-white text-lg font-semibold mb-2">
                  {callData.callerName || 'Connecting...'}
                </p>
                <p className="text-gray-400">
                  {callStatus === 'ringing' ? 'Waiting for answer...' : 'Establishing connection...'}
                </p>
              </div>
            </div>
          )}

          {/* Remote Video Overlay */}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${remoteStream ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm">
                {remoteStream ? 'Connected' : 'Connecting'}
              </span>
            </div>
          </div>
        </div>

        {/* Local Video & Controls */}
        <div className="lg:w-96 flex flex-col">
          {/* Local Video Preview */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 mb-6">
            <h3 className="text-white font-semibold text-lg mb-4">Your Camera</h3>

            <div className="relative">
              <div className="aspect-video bg-black rounded-xl overflow-hidden">
                <video
                  ref={localVideo}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isVideoEnabled && (
                  <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
                    <VideoOff className="w-12 h-12 text-gray-600" />
                  </div>
                )}
              </div>

              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg">
                <div className="flex items-center space-x-2">
                  {isAudioEnabled ? (
                    <Mic className="w-4 h-4 text-green-400" />
                  ) : (
                    <MicOff className="w-4 h-4 text-red-400" />
                  )}
                  {isVideoEnabled ? (
                    <Video className="w-4 h-4 text-green-400" />
                  ) : (
                    <VideoOff className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className={`px-3 py-2 rounded-lg flex items-center justify-center space-x-2 ${isAudioEnabled ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                }`}>
                {isAudioEnabled ? (
                  <Mic className="w-4 h-4 text-green-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-sm ${isAudioEnabled ? 'text-green-400' : 'text-red-400'}`}>
                  {isAudioEnabled ? 'Mic On' : 'Mic Off'}
                </span>
              </div>
              <div className={`px-3 py-2 rounded-lg flex items-center justify-center space-x-2 ${isVideoEnabled ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                }`}>
                {isVideoEnabled ? (
                  <Video className="w-4 h-4 text-green-400" />
                ) : (
                  <VideoOff className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-sm ${isVideoEnabled ? 'text-green-400' : 'text-red-400'}`}>
                  {isVideoEnabled ? 'Camera On' : 'Camera Off'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <h3 className="text-white font-semibold text-lg mb-4">Quick Actions</h3>

            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={toggleAudio}
                className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all ${isAudioEnabled
                    ? 'bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50'
                    : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                  }`}
              >
                {isAudioEnabled ? (
                  <Mic className="w-5 h-5" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
                <span className="text-xs font-medium">
                  {isAudioEnabled ? 'Mute' : 'Unmute'}
                </span>
              </button>

              <button
                onClick={toggleVideo}
                className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all ${isVideoEnabled
                    ? 'bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50'
                    : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                  }`}
              >
                {isVideoEnabled ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
                <span className="text-xs font-medium">
                  {isVideoEnabled ? 'Camera Off' : 'Camera On'}
                </span>
              </button>

              <button
                onClick={toggleScreenShare}
                className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all ${isScreenSharing
                    ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
                    : 'bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50'
                  }`}
              >
                {isScreenSharing ? (
                  <ScreenShareOff className="w-5 h-5" />
                ) : (
                  <ScreenShare className="w-5 h-5" />
                )}
                <span className="text-xs font-medium">
                  {isScreenSharing ? 'Stop Share' : 'Share'}
                </span>
              </button>

              <button
                onClick={endCall}
                className="p-3 rounded-xl flex flex-col items-center justify-center space-y-2 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="text-xs font-medium">End</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center space-x-4">
            <button
              onClick={toggleAudio}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isAudioEnabled
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
                }`}
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </button>

            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoEnabled
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
                }`}
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6" />
              ) : (
                <VideoOff className="w-6 h-6" />
              )}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
            >
              {isScreenSharing ? (
                <ScreenShareOff className="w-6 h-6" />
              ) : (
                <ScreenShare className="w-6 h-6" />
              )}
            </button>

            <button
              onClick={endCall}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/25"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}