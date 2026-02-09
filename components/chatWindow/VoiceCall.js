"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  ScreenShare,
  ScreenShareOff,
  Phone,
  PhoneOff,
  User,
  Clock,
  Minimize2,
} from "lucide-react";

export default function VoiceCall({
  callData,
  socket,
  onEndCall,
  onAcceptCall,
  onRejectCall,
  isIncoming = false,
  isGroupCall = false,
}) {
  const [callStatus, setCallStatus] = useState(
    isIncoming ? "ringing" : "calling",
  );
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState("");
  const [isRemoteSharingScreen, setIsRemoteSharingScreen] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connectionState, setConnectionState] = useState("");
  const [debugLog, setDebugLog] = useState([]);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  const peerConnection = useRef(null);
  const localAudio = useRef(null);
  const remoteAudio = useRef(null);
  const remoteVideo = useRef(null);
  const pendingIceCandidates = useRef([]);
  const callStartTime = useRef(null);
  const mediaStream = useRef(null);
  const screenStream = useRef(null);
  const audioSender = useRef(null);
  const videoSender = useRef(null);
  const dataChannel = useRef(null);
  const timerInterval = useRef(null);
  const pendingOffer = useRef(null);
  const isNegotiating = useRef(false);
  const videoTransceiver = useRef(null);
  const retryCount = useRef(0);
  const maxRetries = 3;
  const lastOfferTime = useRef(0);
  const offerCooldown = 1000;
  const socketListenersSet = useRef(false);
  const remoteVideoRef = useRef(null);
  const remoteVideoTrack = useRef(null);
  const pendingVideoRenegotiation = useRef(false);
  const screenShareStartTime = useRef(null);

  const addDebug = (message) => {
    console.log("🔊 DEBUG:", message);
    setDebugLog((prev) => [
      ...prev.slice(-20),
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:173.249.60.84:3478",
        username: "briyan",
        credential: "MySecurePassword2024!",
      },
    ],
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    sdpSemantics: "unified-plan",
  };

  useEffect(() => {
    addDebug("Component mounted - initializing voice call");

    if (!isIncoming) {
      initializeCall();
    } else {
      addDebug("Incoming call - waiting for manual acceptance");
    }

    return () => {
      addDebug("Component unmounting - cleanup");
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (callStatus === "active" && callStartTime.current) {
      timerInterval.current = setInterval(() => {
        const seconds = Math.floor((new Date() - callStartTime.current) / 1000);
        setCallTimer(seconds);
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

  useEffect(() => {
    if (!socket || socketListenersSet.current) return;

    addDebug("Setting up socket listeners");
    socketListenersSet.current = true;

    const handleVoiceOffer = async (data) => {
      addDebug(`📞 Received VOICE OFFER from ${data.callerId}`);
      addDebug(
        `Offer details: hasVideo=${data.hasVideo}, isScreenShare=${data.isScreenShare}`,
      );

      if (data.callId === callData.callId) {
        await handleOffer(data);
      }
    };

    const handleVoiceAnswer = async (data) => {
      addDebug(`✅ Received VOICE ANSWER from ${data.targetUserId}`);
      addDebug(
        `Answer details: hasVideo=${data.hasVideo}, isScreenShare=${data.isScreenShare}`,
      );

      if (data.callId === callData.callId && peerConnection.current) {
        await handleAnswer(data);
      }
    };

    const handleVoiceIceCandidate = (data) => {
      addDebug("🧊 Received VOICE ICE candidate");
      if (data.callId === callData.callId) {
        handleIceCandidate(data.candidate);
      }
    };

    const handleCallAccepted = (data) => {
      if (data.callId === callData.callId) {
        addDebug("🎉 Voice call accepted by remote user");
        callStartTime.current = new Date();
      }
    };

    const handleCallEnded = (data) => {
      if (data.callId === callData.callId) {
        addDebug("📞 Voice call ended by remote party");
        setCallStatus("ended");
        setTimeout(() => {
          onEndCall(callTimer);
        }, 1000);
      }
    };

    const handleScreenShareStarted = (data) => {
      if (data.callId === callData.callId) {
        addDebug("🖥️ Remote started screen sharing via socket");
        addDebug(
          `Screen share data: hasVideo=${data.hasVideo}, isVoiceCall=${data.isVoiceCall}`,
        );
        setIsRemoteSharingScreen(true);

        // Mark that we need video renegotiation
        pendingVideoRenegotiation.current = true;

        // If peer connection exists, create offer to receive video
        if (
          peerConnection.current &&
          peerConnection.current.connectionState === "connected"
        ) {
          setTimeout(() => {
            createOfferForVideoReception();
          }, 500);
        }
      }
    };

    const handleScreenShareStopped = (data) => {
      if (data.callId === callData.callId) {
        addDebug("🖥️ Remote stopped screen sharing via socket");
        handleRemoteScreenShareEnded();
      }
    };

    const handleCallRejected = (data) => {
      if (data.callId === callData.callId) {
        addDebug("❌ Call was rejected by remote party");
        setCallStatus("rejected");
        setTimeout(() => {
          cleanup();
          if (onEndCall) onEndCall(0);
        }, 1000);
      }
    };

    socket.on("voice_call_offer", handleVoiceOffer);
    socket.on("voice_call_answer", handleVoiceAnswer);
    socket.on("receive_voice_ice_candidate", handleVoiceIceCandidate);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_ended", handleCallEnded);
    socket.on("screen_share_started", handleScreenShareStarted);
    socket.on("screen_share_stopped", handleScreenShareStopped);
    socket.on("call_rejected", handleCallRejected);

    return () => {
      socket.off("voice_call_offer", handleVoiceOffer);
      socket.off("voice_call_answer", handleVoiceAnswer);
      socket.off("receive_voice_ice_candidate", handleVoiceIceCandidate);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_ended", handleCallEnded);
      socket.off("screen_share_started", handleScreenShareStarted);
      socket.off("screen_share_stopped", handleScreenShareStopped);
      socket.off("call_rejected", handleCallRejected);
      socketListenersSet.current = false;
    };
  }, [socket, callData.callId]);

  const createOfferForVideoReception = async () => {
    if (!peerConnection.current || isNegotiating.current) return;

    try {
      isNegotiating.current = true;
      addDebug("📤 Creating offer to receive video for screen share...");

      // Get all transceivers
      const transceivers = peerConnection.current.getTransceivers();

      // Check if we already have a video transceiver
      let videoTransceiver = transceivers.find(
        (t) =>
          t.receiver?.track?.kind === "video" ||
          t.sender?.track?.kind === "video" ||
          t.receiver?.track?.kind === "video",
      );

      if (!videoTransceiver) {
        // Create new video transceiver for receiving only
        videoTransceiver = peerConnection.current.addTransceiver("video", {
          direction: "recvonly",
        });
        addDebug("📹 Added new video transceiver (recvonly)");
      } else {
        // Update existing transceiver to receive video
        videoTransceiver.direction = "recvonly";
        addDebug("🔄 Updated existing video transceiver to recvonly");
      }

      // Create offer with video reception enabled
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.current.setLocalDescription(offer);

      const targetUserId = isIncoming
        ? callData.callerId
        : callData.targetUserId;

      socket.emit("voice_call_offer", {
        targetUserId,
        callId: callData.callId,
        callerId: isIncoming ? socket.userId : callData.callerId,
        offer,
        hasVideo: true,
        isScreenShare: true,
        callerSocketId: socket._id,
      });

      addDebug("✅ Offer to receive video sent");
      pendingVideoRenegotiation.current = false;
    } catch (err) {
      addDebug(`❌ Error creating offer for video: ${err.message}`);
      pendingVideoRenegotiation.current = true;
    } finally {
      setTimeout(() => {
        isNegotiating.current = false;
      }, 500);
    }
  };

  const displayVideoTrack = (track) => {
    if (!track) {
      addDebug("❌ No track to display");
      return;
    }

    addDebug(
      `🎬 Displaying video track: ${track._id}, kind: ${track.kind}, label: ${track.label}`,
    );

    // Store the track reference
    remoteVideoTrack.current = track;

    if (track.readyState !== "live") {
      addDebug("⚠️ Track is not in live state");
      return;
    }

    setHasVideoTrack(true);
    const videoStream = new MediaStream([track]);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = videoStream;
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.playsInline = true;
      remoteVideoRef.current.autoplay = true;

      const playVideo = async () => {
        try {
          addDebug("▶️ Attempting to play video...");
          await remoteVideoRef.current.play();
          addDebug("🎉 VIDEO PLAYING SUCCESSFULLY!");
          setIsRemoteSharingScreen(true);
          retryCount.current = 0;
        } catch (playError) {
          addDebug(`❌ Video play failed: ${playError.message}`);
          if (retryCount.current < maxRetries) {
            retryCount.current++;
            addDebug(`🔄 Retry attempt ${retryCount.current}/${maxRetries}`);
            setTimeout(() => playVideo(), 1000 * retryCount.current);
          }
        }
      };

      playVideo();
    } else {
      addDebug("⚠️ Video element not available yet, retrying...");
      setTimeout(() => displayVideoTrack(track), 100);
    }

    // Handle track ended event
    track.onended = () => {
      addDebug("🖥️ Video track ended");
      handleRemoteScreenShareEnded();
    };
  };

  const handleRemoteScreenShareEnded = () => {
    addDebug("🖥️ Remote screen share ended");
    setIsRemoteSharingScreen(false);
    setHasVideoTrack(false);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Clear track reference
    remoteVideoTrack.current = null;

    // If we're not sharing our screen, update transceiver direction
    if (!isScreenSharing && videoTransceiver.current) {
      videoTransceiver.current.direction = "inactive";
    }
  };

  const cleanup = () => {
    addDebug("🧹 Cleaning up voice call resources...");

    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach((track) => {
        track.stop();
        addDebug(`⏹️ Stopped track: ${track.kind}`);
      });
      mediaStream.current = null;
    }

    if (screenStream.current) {
      screenStream.current.getTracks().forEach((track) => {
        track.stop();
        addDebug(`⏹️ Stopped screen share track: ${track.kind}`);
      });
      screenStream.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      addDebug("🔒 Peer connection closed");
      peerConnection.current = null;
    }

    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }

    pendingIceCandidates.current = [];
    pendingOffer.current = null;
    isNegotiating.current = false;
    videoTransceiver.current = null;
    retryCount.current = 0;
    setHasVideoTrack(false);
    remoteVideoTrack.current = null;
    pendingVideoRenegotiation.current = false;
    screenShareStartTime.current = null;

    if (localAudio.current) {
      localAudio.current.srcObject = null;
    }
    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    audioSender.current = null;
    videoSender.current = null;
    setIsScreenSharing(false);
    setIsRemoteSharingScreen(false);
    setCallTimer(0);
    setConnectionState("");
    socketListenersSet.current = false;
  };

  const handleIceCandidate = async (candidate) => {
    addDebug("🧊 ICE candidate received");

    if (!peerConnection.current) {
      addDebug("⏳ No peer connection, storing ICE candidate");
      pendingIceCandidates.current.push(candidate);
      return;
    }

    if (!peerConnection.current.remoteDescription) {
      addDebug("⏳ Remote description not set yet, storing ICE candidate");
      pendingIceCandidates.current.push(candidate);
      return;
    }

    try {
      await peerConnection.current.addIceCandidate(
        new RTCIceCandidate(candidate),
      );
      addDebug("✅ ICE candidate added successfully");
    } catch (err) {
      addDebug(`❌ ICE candidate error: ${err.message}`);
    }
  };

  const processPendingIceCandidates = async () => {
    if (pendingIceCandidates.current.length === 0) return;

    addDebug(
      `🔄 Processing ${pendingIceCandidates.current.length} pending ICE candidates`,
    );

    for (const candidate of pendingIceCandidates.current) {
      try {
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
        addDebug("✅ Pending ICE candidate added");
      } catch (err) {
        addDebug(`❌ Pending ICE candidate error: ${err.message}`);
      }
    }

    pendingIceCandidates.current = [];
  };

  const getMedia = async () => {
    try {
      addDebug("🎤 Requesting microphone access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks found");
      }

      addDebug(`🎵 Audio tracks acquired: ${audioTracks.length}`);

      stream.getTracks().forEach((track, index) => {
        addDebug(`🔊 Track ${index}: ${track.kind} - ${track.label}`);
        track.enabled = true;
      });

      mediaStream.current = stream;
      setLocalStream(stream);

      if (localAudio.current) {
        localAudio.current.srcObject = stream;
        localAudio.current.muted = true;
        localAudio.current.volume = 0;
        try {
          await localAudio.current.play();
          addDebug("✅ Local audio monitoring started");
        } catch (err) {
          addDebug(`❌ Local audio play error: ${err.message}`);
        }
      }

      return stream;
    } catch (err) {
      const errorMsg = `❌ Cannot access microphone: ${err.message}`;
      addDebug(errorMsg);
      setError(errorMsg);
      throw err;
    }
  };

  const createPeerConnection = (stream) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig);

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioSender.current = pc.addTrack(audioTrack, stream);
        addDebug("✅ Added audio track");
      }

      // Create video transceiver for potential screen sharing - set to inactive initially
      const transceiver = pc.addTransceiver("video", {
        direction: "inactive",
      });
      videoTransceiver.current = transceiver;
      addDebug("📹 Added video transceiver (inactive)");

      // Create data channel for control messages
      try {
        dataChannel.current = pc.createDataChannel("screenShareControl", {
          ordered: true,
          maxRetransmits: 3,
        });

        dataChannel.current.onopen = () => {
          addDebug("📡 Data channel opened");
        };

        dataChannel.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            addDebug(`📡 Data channel message: ${data.type}`);

            if (data.type === "screen_share_started") {
              addDebug("🖥️ Remote started screen sharing via data channel");
              setIsRemoteSharingScreen(true);
              pendingVideoRenegotiation.current = true;
              // Request video reception
              setTimeout(() => {
                createOfferForVideoReception();
              }, 500);
            } else if (data.type === "screen_share_stopped") {
              addDebug("🖥️ Remote stopped screen sharing via data channel");
              handleRemoteScreenShareEnded();
            }
          } catch (parseError) {
            addDebug(
              `❌ Error parsing data channel message: ${parseError.message}`,
            );
          }
        };
      } catch (err) {
        addDebug(`❌ Data channel creation failed: ${err.message}`);
      }

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        addDebug(`📡 Incoming data channel: ${channel.label}`);

        channel.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            addDebug(`📡 Incoming data channel message: ${data.type}`);

            if (data.type === "screen_share_started") {
              addDebug("🖥️ Remote started screen sharing");
              setIsRemoteSharingScreen(true);
              pendingVideoRenegotiation.current = true;
              // Request video reception
              setTimeout(() => {
                createOfferForVideoReception();
              }, 500);
            } else if (data.type === "screen_share_stopped") {
              addDebug("🖥️ Remote stopped screen sharing");
              handleRemoteScreenShareEnded();
            }
          } catch (parseError) {
            addDebug(
              `❌ Error parsing incoming data channel message: ${parseError.message}`,
            );
          }
        };
      };

      pc.ontrack = (event) => {
        addDebug("🎧 ONTRACK EVENT FIRED");
        const track = event.track;
        const streams = event.streams;

        addDebug(
          `📹 Track kind: ${track.kind}, Streams: ${streams.length}, ReadyState: ${track.readyState}, Label: ${track.label}`,
        );

        if (track.kind === "video") {
          addDebug("🖥️ VIDEO TRACK DETECTED in ontrack");
          displayVideoTrack(track);
        } else if (track.kind === "audio") {
          addDebug("🔊 Setting up remote audio");
          setRemoteStream(streams[0] || new MediaStream([track]));
          setTimeout(() => {
            setupRemoteAudio(streams[0] || new MediaStream([track]));
          }, 100);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDebug(`🧊 Sending ICE candidate`);
          const targetUserId = isIncoming
            ? callData.callerId
            : callData.targetUserId;
          socket.emit("send_voice_ice_candidate", {
            callId: callData.callId,
            targetUserId: targetUserId,
            candidate: event.candidate,
          });
        } else {
          addDebug("✅ All ICE candidates gathered");
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        setConnectionState(state);
        addDebug(`🔗 Connection state: ${state}`);

        switch (state) {
          case "connected":
            addDebug("🎉 WebRTC CONNECTED!");
            // Check if we need to renegotiate for video
            if (pendingVideoRenegotiation.current) {
              setTimeout(() => {
                createOfferForVideoReception();
              }, 1000);
            }
            break;
          case "disconnected":
            addDebug("⚠️ Connection disconnected");
            setError("Connection lost - trying to reconnect...");
            break;
          case "failed":
            setError("Connection failed. Please try again.");
            addDebug("❌ Connection failed");
            break;
          case "closed":
            addDebug("🔒 Connection closed");
            break;
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        addDebug(`🧊 ICE connection state: ${state}`);
      };

      peerConnection.current = pc;
      return pc;
    } catch (err) {
      addDebug(`❌ Error creating peer connection: ${err.message}`);
      throw err;
    }
  };

  const setupRemoteAudio = async (audioStream) => {
    if (!remoteAudio.current) {
      addDebug("❌ No remote audio element available");
      return;
    }

    addDebug("🔊 Setting up remote audio playback...");

    try {
      remoteAudio.current.srcObject = audioStream;
      remoteAudio.current.muted = false;
      remoteAudio.current.volume = 1.0;
      remoteAudio.current.playsInline = true;

      addDebug("▶️ Attempting to play remote audio...");
      await remoteAudio.current.play();
      addDebug("🎉 REMOTE AUDIO PLAYING SUCCESSFULLY!");
    } catch (error) {
      addDebug(`❌ Error setting up remote audio: ${error.message}`);
    }
  };

  const initializeCall = async () => {
    try {
      addDebug("🚀 Initializing call...");
      setError("");

      const stream = await getMedia();
      const pc = createPeerConnection(stream);

      if (!isIncoming) {
        addDebug("📤 Creating offer as caller...");

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false, // Voice call starts without video
          voiceActivityDetection: true,
        });

        addDebug("✅ Offer created");

        await pc.setLocalDescription(offer);
        addDebug(`📡 Local description set`);

        const targetUserId = callData.targetUserId;
        addDebug(`📤 Sending offer to user: ${targetUserId}`);

        socket.emit("voice_call_offer", {
          targetUserId: targetUserId,
          callId: callData.callId,
          callerId: callData.callerId,
          offer: offer,
          hasVideo: false,
          isScreenShare: false,
          callerSocketId: socket._id,
        });

        addDebug("✅ Outgoing call initialization complete");
      }
    } catch (err) {
      const errorMsg = `❌ Failed to initialize call: ${err.message}`;
      addDebug(errorMsg);
      setError(errorMsg);
      endCall();
    }
  };

  const handleOffer = async (data) => {
    try {
      addDebug("📥 Processing offer...");
      addDebug(
        `Offer type: isScreenShare=${data.isScreenShare}, hasVideo=${data.hasVideo}`,
      );

      // Debug log the entire data
      console.log("📦 Full offer data:", {
        isScreenShare: data.isScreenShare,
        hasVideo: data.hasVideo,
        callerId: data.callerId,
        callId: data.callId,
      });

      // Check if this is a screen share renegotiation offer
      // IMPORTANT: Check if these fields exist and are truthy
      const isScreenShareOffer =
        data.isScreenShare === true || data.hasVideo === true;

      if (isScreenShareOffer) {
        addDebug("🔄 Processing screen share renegotiation offer");
        console.log("🔄 Screen share offer detected!");

        try {
          addDebug("🔄 Setting remote description from screen share offer...");
          const offer = new RTCSessionDescription(data.offer);
          await peerConnection.current.setRemoteDescription(offer);

          // Create answer with video reception enabled
          const answer = await peerConnection.current.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true, // Enable video reception
          });

          await peerConnection.current.setLocalDescription(answer);

          const targetUserId = isIncoming ? callData.callerId : data.callerId;

          socket.emit("voice_call_answer", {
            callId: data.callId,
            targetUserId: targetUserId,
            answer: answer,
            hasVideo: true, // Make sure to send this back
            isScreenShare: true,
          });

          addDebug("✅ Screen share renegotiation answer sent");
          console.log("✅ Sent answer for screen share with hasVideo=true");

          // Set the flag immediately since we know this is a screen share
          setIsRemoteSharingScreen(true);
        } catch (err) {
          console.error("❌ Error processing screen share offer:", err);
          addDebug(`❌ Error processing screen share offer: ${err.message}`);
        }

        return;
      }

      // Store initial offer for incoming calls
      if (isIncoming && callStatus === "ringing") {
        addDebug(
          "📥 Received initial offer - storing for manual acceptance...",
        );
        pendingOffer.current = data;
        addDebug("✅ Initial offer stored, waiting for user to accept");
      }
    } catch (err) {
      console.error("❌ Failed to handle offer:", err);
      const errorMsg = `❌ Failed to handle offer: ${err.message}`;
      addDebug(errorMsg);
      setError(errorMsg);
    }
  };

  const handleAnswer = async (data) => {
    try {
      if (!peerConnection.current) {
        addDebug("❌ No peer connection available");
        return;
      }

      addDebug(
        `📡 Current signaling state: ${peerConnection.current.signalingState}`,
      );
      console.log("📦 Answer data:", {
        hasVideo: data.hasVideo,
        isScreenShare: data.isScreenShare,
        callId: data.callId,
      });

      if (peerConnection.current.signalingState === "stable") {
        addDebug("✅ Already stable, ignoring duplicate answer");
        return;
      }

      addDebug("🔄 Setting remote description from answer...");
      const answer = new RTCSessionDescription(data.answer);
      await peerConnection.current.setRemoteDescription(answer);

      addDebug("✅ Remote description set successfully");

      await processPendingIceCandidates();

      setCallStatus("active");
      callStartTime.current = new Date();

      addDebug("✅ Call is now active");

      // If this answer includes video, set the flag
      if (data.hasVideo === true || data.isScreenShare === true) {
        addDebug("🎬 Answer indicates screen sharing");
        setIsRemoteSharingScreen(true);
        // Try to display any existing video track
        setTimeout(() => {
          const transceivers = peerConnection.current.getTransceivers();
          const videoTransceiver = transceivers.find(
            (t) =>
              t.receiver?.track?.kind === "video" ||
              t.sender?.track?.kind === "video",
          );
          if (videoTransceiver?.receiver?.track) {
            displayVideoTrack(videoTransceiver.receiver.track);
          }
        }, 500);
      }
    } catch (err) {
      console.error("❌ Error in handleAnswer:", err);
      const errorMsg = `❌ Error setting remote description: ${err.message}`;
      addDebug(errorMsg);

      if (peerConnection.current.iceConnectionState === "connected") {
        addDebug("✅ Connection already established");
        setCallStatus("active");
        callStartTime.current = new Date();
      }
    }
  };

  // Add this useEffect to periodically check for video tracks
  useEffect(() => {
    if (isRemoteSharingScreen && peerConnection.current) {
      const checkForVideoTrack = () => {
        const transceivers = peerConnection.current.getTransceivers();
        const videoTransceiver = transceivers.find(
          (t) => t.receiver?.track?.kind === "video",
        );

        if (videoTransceiver?.receiver?.track && !hasVideoTrack) {
          addDebug("🎬 Found video track in periodic check");
          displayVideoTrack(videoTransceiver.receiver.track);
        }
      };

      // Check every 2 seconds for video tracks
      const interval = setInterval(checkForVideoTrack, 2000);

      // Initial check
      checkForVideoTrack();

      return () => clearInterval(interval);
    }
  }, [isRemoteSharingScreen, hasVideoTrack]);

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        addDebug("🖥️ Starting screen sharing in voice call...");

        const screenShareStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
            displaySurface: "monitor",
            frameRate: { ideal: 15 },
            width: { ideal: 1024 },
            height: { ideal: 768 },
          },
          audio: false,
        });

        screenStream.current = screenShareStream;
        const videoTrack = screenShareStream.getVideoTracks()[0];

        if (videoTrack && peerConnection.current) {
          addDebug("📹 Adding screen share video track");

          // Check if we already have a video sender
          const senders = peerConnection.current.getSenders();
          const existingVideoSender = senders.find(
            (s) => s.track && s.track.kind === "video",
          );

          if (existingVideoSender) {
            // Replace existing track
            await existingVideoSender.replaceTrack(videoTrack);
            addDebug("✅ Replaced existing video track");
          } else {
            // Add new track
            const sender = peerConnection.current.addTrack(
              videoTrack,
              screenShareStream,
            );
            videoSender.current = sender;
            addDebug("✅ Added new video track");
          }

          // Update transceiver direction
          if (videoTransceiver.current) {
            videoTransceiver.current.direction = "sendonly";
            addDebug("🔄 Updated transceiver to sendonly");
          }

          // Renegotiate
          addDebug("🔄 Renegotiating for screen share...");
          const offer = await peerConnection.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false, // We're sending, not receiving
          });

          await peerConnection.current.setLocalDescription(offer);

          const targetUserId = isIncoming
            ? callData.callerId
            : callData.targetUserId;

          // CRITICAL: Send with explicit parameters
          socket.emit("voice_call_offer", {
            targetUserId,
            callId: callData.callId,
            callerId: isIncoming ? socket.userId : callData.callerId,
            offer: offer,
            hasVideo: true, // Explicitly true
            isScreenShare: true, // Explicitly true
            callerSocketId: socket._id,
          });

          addDebug(
            "✅ Screen share renegotiation offer sent with hasVideo=true",
          );

          // Notify via data channel
          if (
            dataChannel.current &&
            dataChannel.current.readyState === "open"
          ) {
            dataChannel.current.send(
              JSON.stringify({
                type: "screen_share_started",
                timestamp: Date.now(),
              }),
            );
            addDebug("📡 Notified remote via data channel");
          }

          // Notify via socket
          socket.emit("screen_share_started", {
            callId: callData.callId,
            targetUserId: targetUserId,
            timestamp: Date.now(),
            hasVideo: true,
            isVoiceCall: true,
            callerSocketId: socket._id,
          });

          screenShareStartTime.current = Date.now();

          videoTrack.onended = () => {
            addDebug("🖥️ Screen share ended by user");
            stopScreenShare();
          };

          setIsScreenSharing(true);
          addDebug("✅ Screen sharing started");
        }
      } else {
        await stopScreenShare();
      }
    } catch (err) {
      addDebug(`❌ Screen share error: ${err.message}`);
      if (err.name !== "NotAllowedError") {
        setError("Failed to share screen: " + err.message);
      }
    }
  };

  // const stopScreenShare = async () => {
  //   try {
  //     addDebug('🖥️ Stopping screen share...');

  //     if (screenStream.current) {
  //       screenStream.current.getTracks().forEach(track => {
  //         track.stop();
  //         addDebug(`⏹️ Stopped screen track: ${track.kind}`);
  //       });
  //       screenStream.current = null;
  //     }

  //     if (peerConnection.current) {
  //       // Remove video track if exists
  //       const senders = peerConnection.current.getSenders();
  //       const videoSender = senders.find(s => s.track && s.track.kind === 'video');

  //       if (videoSender) {
  //         await videoSender.replaceTrack(null);
  //         addDebug('✅ Removed video track');
  //       }

  //       if (videoTransceiver.current) {
  //         videoTransceiver.current.direction = 'inactive';
  //         addDebug('🔄 Updated transceiver to inactive');
  //       }

  //       // Renegotiate to stop screen share
  //       addDebug('🔄 Renegotiating to stop screen share...');
  //       const offer = await peerConnection.current.createOffer({
  //         offerToReceiveAudio: true,
  //         offerToReceiveVideo: false
  //       });

  //       await peerConnection.current.setLocalDescription(offer);

  //       const targetUserId = isIncoming ? callData.callerId : callData.targetUserId;

  //       socket.emit('voice_call_offer', {
  //         targetUserId,
  //         callId: callData.callId,
  //         callerId: isIncoming ? socket.userId : callData.callerId,
  //         offer: offer,
  //         hasVideo: false,
  //         isScreenShare: false,
  //         callerSocketId: socket.id
  //       });

  //       addDebug('✅ Screen share stop renegotiation offer sent');

  //       // Notify via data channel
  //       if (dataChannel.current && dataChannel.current.readyState === 'open') {
  //         dataChannel.current.send(JSON.stringify({
  //           type: 'screen_share_stopped',
  //           timestamp: Date.now()
  //         }));
  //       }

  //       // Notify via socket
  //       socket.emit('screen_share_stopped', {
  //         callId: callData.callId,
  //         targetUserId: targetUserId,
  //         timestamp: Date.now(),
  //         isVoiceCall: true,
  //         callerSocketId: socket.id
  //       });

  //       screenShareStartTime.current = null;
  //       setIsScreenSharing(false);
  //       addDebug('✅ Screen share stopped');
  //     }

  //   } catch (err) {
  //     addDebug(`❌ Error stopping screen share: ${err.message}`);
  //   }
  // };

  const stopScreenShare = async () => {
    try {
      addDebug("🖥️ Stopping screen share...");

      // Stop screen stream
      if (screenStream.current) {
        screenStream.current.getTracks().forEach((track) => track.stop());
        screenStream.current = null;
      }

      if (peerConnection.current) {
        // Remove video track
        const senders = peerConnection.current.getSenders();
        const videoSender = senders.find(
          (s) => s.track && s.track.kind === "video",
        );

        if (videoSender) {
          await videoSender.replaceTrack(null);
          addDebug("✅ Removed video track");
        }

        // Update transceiver direction
        if (videoTransceiver.current) {
          videoTransceiver.current.direction = "inactive";
          addDebug("🔄 Updated transceiver to inactive");
        }

        // Update state
        setIsScreenSharing(false);
        screenShareStartTime.current = null;

        // Notify via data channel
        if (dataChannel.current && dataChannel.current.readyState === "open") {
          dataChannel.current.send(
            JSON.stringify({
              type: "screen_share_stopped",
              timestamp: Date.now(),
            }),
          );
          addDebug("📡 Notified remote via data channel");
        }

        // Notify via socket
        const targetUserId = isIncoming
          ? callData.callerId
          : callData.targetUserId;
        socket.emit("screen_share_stopped", {
          callId: callData.callId,
          targetUserId: targetUserId,
          timestamp: Date.now(),
          isVoiceCall: true,
          callerSocketId: socket._id,
        });

        addDebug("✅ Screen share stopped");
      }
    } catch (err) {
      addDebug(`❌ Error stopping screen share: ${err.message}`);
    }
  };

  const acceptCall = async () => {
    addDebug("✅ Accepting call...");

    try {
      setError("");

      const stream = await getMedia();
      const pc = createPeerConnection(stream);

      if (pendingOffer.current) {
        addDebug("📥 Processing stored offer after acceptance...");

        const data = pendingOffer.current;

        if (pc.signalingState !== "stable") {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        addDebug("🔄 Setting remote description from offer...");
        const offer = new RTCSessionDescription(data.offer);
        await pc.setRemoteDescription(offer);

        await processPendingIceCandidates();

        addDebug("📤 Creating answer...");
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: data.hasVideo || false,
          voiceActivityDetection: true,
        });

        await pc.setLocalDescription(answer);
        addDebug(`📡 Local description set`);

        socket.emit("voice_call_answer", {
          callId: data.callId,
          targetUserId: data.callerId,
          answer: answer,
          hasVideo: data.hasVideo || false,
          isScreenShare: data.isScreenShare || false,
        });

        pendingOffer.current = null;
      }

      socket.emit("accept_call", {
        callId: callData.callId,
        targetUserId: callData.callerId,
      });

      setCallStatus("active");
      callStartTime.current = new Date();

      addDebug("✅ Call accepted and WebRTC established");

      if (onAcceptCall) {
        setTimeout(() => onAcceptCall(), 100);
      }
    } catch (err) {
      const errorMsg = `❌ Failed to accept call: ${err.message}`;
      addDebug(errorMsg);
      setError(errorMsg);
    }
  };

  const rejectCall = () => {
    addDebug("❌ Rejecting call...");
    socket.emit("reject_call", {
      callId: callData.callId,
      targetUserId: callData.callerId,
    });
    cleanup();
    if (onRejectCall) onRejectCall();
  };

  const endCall = () => {
    addDebug("📞 Ending call...");

    socket.emit("end_call", {
      callId: callData.callId,
      targetUserId: isIncoming ? callData.callerId : callData.targetUserId,
      duration: callTimer,
    });

    cleanup();
    if (onEndCall) onEndCall(callTimer);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        addDebug(`🎤 Microphone ${audioTrack.enabled ? "unmuted" : "muted"}`);
      }
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // INCOMING CALL UI (unchanged)
  if (isIncoming && callStatus === "ringing" && !isMinimized) {
    return (
      <div className="fixed top-6 right-6 z-50 animate-fade-in">
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl p-6 w-96 border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {callData.callerName || "Unknown Caller"}
                </h3>
                <p className="text-gray-400 text-sm flex items-center">
                  <Phone className="w-3 h-3 mr-1" />
                  Incoming Voice Call
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

  // Minimized incoming call (unchanged)
  if (isIncoming && callStatus === "ringing" && isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-gray-900 rounded-lg shadow-lg p-3 w-64 border border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center animate-pulse">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Incoming Call</p>
                <p className="text-gray-400 text-xs">{callData.callerName}</p>
              </div>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={acceptCall}
                className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                <Phone className="w-4 h-4 text-white" />
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

  // ACTIVE CALL UI with improved screen share display
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-black flex flex-col z-50">
      {/* Top Bar */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div
              className={`w-3 h-3 rounded-full ${callStatus === "active" ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}
            />
            <div>
              <h1 className="text-white font-semibold text-lg">
                {callData.callerName || callData.targetUserName || "Voice Call"}
              </h1>
              <div className="flex items-center space-x-2 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>{formatTime(callTimer)}</span>
                <span>•</span>
                <span className="capitalize">
                  {connectionState || "Connecting"}
                </span>
                {isRemoteSharingScreen && (
                  <>
                    <span>•</span>
                    <span className="text-blue-400 flex items-center">
                      <ScreenShare className="w-4 h-4 mr-1" />
                      Viewing Screen
                    </span>
                  </>
                )}
                {isScreenSharing && (
                  <>
                    <span>•</span>
                    <span className="text-green-400 flex items-center">
                      <ScreenShare className="w-4 h-4 mr-1" />
                      Sharing Screen
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row p-4 gap-6 max-w-6xl mx-auto w-full">
        {/* Left Side - Remote Participant */}
        <div className="flex-1 bg-gray-900/50 rounded-2xl border border-gray-800 p-6 flex flex-col">
          <div className="mb-4">
            <h2 className="text-white font-semibold text-lg mb-2">
              {isRemoteSharingScreen
                ? "Remote Screen Sharing"
                : "Remote Participant"}
            </h2>
            <div className="flex items-center space-x-2 text-gray-400 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${remoteStream ? "bg-green-500" : "bg-yellow-500"}`}
              />
              <span>{remoteStream ? "Audio Connected" : "Connecting..."}</span>
              {isRemoteSharingScreen && (
                <div className="flex items-center space-x-1 text-blue-400">
                  <ScreenShare className="w-3 h-3" />
                  <span>Screen Sharing Active</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-black/40 rounded-xl border border-gray-800 overflow-hidden relative flex items-center justify-center min-h-[400px]">
            {isRemoteSharingScreen ? (
              <div className="w-full h-full flex flex-col">
                <div className="p-4 bg-gray-900/80 border-b border-gray-800">
                  <div className="flex items-center space-x-2 text-blue-400">
                    <ScreenShare className="w-5 h-5" />
                    <span className="font-medium">Remote Screen Share</span>
                    {screenShareStartTime.current && (
                      <span className="text-gray-400 text-sm">
                        (Started{" "}
                        {Math.floor(
                          (Date.now() - screenShareStartTime.current) / 1000,
                        )}
                        s ago)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center bg-black p-4">
                  <video
                    ref={remoteVideoRef}
                    id="remote-video"
                    key="remote-video"
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain rounded-lg"
                    style={{
                      minHeight: "300px",
                      backgroundColor: "#000",
                      display: hasVideoTrack ? "block" : "none",
                    }}
                    onLoadedMetadata={() => addDebug("Video metadata loaded")}
                    onCanPlay={() => addDebug("Video can play")}
                    onPlay={() => addDebug("Video started playing")}
                  />
                  {!hasVideoTrack && (
                    <div className="text-center p-4">
                      <div className="animate-pulse">
                        <p className="text-gray-400 mb-2">
                          Waiting for video stream...
                        </p>
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                          <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce delay-200"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-500/30">
                  <User className="w-16 h-16 text-blue-400" />
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">
                  {callData.callerName ||
                    callData.targetUserName ||
                    "Remote User"}
                </h3>
                <p className="text-gray-400">
                  {callStatus === "active"
                    ? "Voice call connected"
                    : "Connecting..."}
                </p>
                {isScreenSharing && (
                  <p className="text-green-400 mt-4 flex items-center justify-center">
                    <ScreenShare className="w-5 h-5 mr-2" />
                    You are sharing your screen
                  </p>
                )}
                {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Local Controls */}
        <div className="lg:w-80 bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
          <h3 className="text-white font-semibold text-lg mb-6">
            Your Controls
          </h3>

          {/* Local Audio Preview */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-300">Microphone</span>
              <div
                className={`px-3 py-1 rounded-full text-sm ${isMuted ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}
              >
                {isMuted ? "Muted" : "Active"}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                  {isMuted ? (
                    <MicOff className="w-6 h-6 text-red-400" />
                  ) : (
                    <Mic className="w-6 h-6 text-green-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isMuted ? "bg-red-500" : "bg-green-500"} animate-pulse`}
                      style={{ width: isMuted ? "0%" : "70%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Screen Sharing Status */}
          {isScreenSharing && (
            <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <ScreenShare className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">
                    Sharing Your Screen
                  </p>
                  <p className="text-green-400/70 text-sm">
                    Remote can see your screen
                  </p>
                </div>
              </div>
            </div>
          )}

          {isRemoteSharingScreen && (
            <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <ScreenShare className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-blue-400 font-medium">
                    Viewing Screen Share
                  </p>
                  <p className="text-blue-400/70 text-sm">
                    Remote is sharing their screen
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Call Stats */}
          <div className="mb-6 bg-gray-800/30 rounded-xl p-4">
            <h4 className="text-gray-300 font-medium mb-3">Call Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Duration</span>
                <span className="text-white font-mono">
                  {formatTime(callTimer)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Status</span>
                <span
                  className={`${callStatus === "active" ? "text-green-400" : "text-yellow-400"}`}
                >
                  {callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Type</span>
                <span className="text-blue-400">Voice Call</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Screen Share</span>
                <span
                  className={`${isScreenSharing ? "text-green-400" : isRemoteSharingScreen ? "text-blue-400" : "text-gray-400"}`}
                >
                  {isScreenSharing
                    ? "You are sharing"
                    : isRemoteSharingScreen
                      ? "Viewing"
                      : "None"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Connection</span>
                <span
                  className={`${connectionState === "connected" ? "text-green-400" : "text-yellow-400"}`}
                >
                  {connectionState || "Connecting"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={toggleMute}
              className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all ${
                isMuted
                  ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                  : "bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50"
              }`}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
              <span className="text-xs font-medium">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all ${
                isScreenSharing
                  ? "bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30"
                  : "bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50"
              }`}
            >
              {isScreenSharing ? (
                <ScreenShareOff className="w-5 h-5" />
              ) : (
                <ScreenShare className="w-5 h-5" />
              )}
              <span className="text-xs font-medium">
                {isScreenSharing ? "Stop Share" : "Share Screen"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center space-x-4">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>

            {/* Screen Share Button */}
            <button
              onClick={toggleScreenShare}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isScreenSharing
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
              title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
            >
              {isScreenSharing ? (
                <ScreenShareOff className="w-6 h-6" />
              ) : (
                <ScreenShare className="w-6 h-6" />
              )}
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/25"
              title="End Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>

          {/* Status Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-3 mt-6">
            {localStream && (
              <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-sm font-medium">
                  Microphone Connected
                </span>
              </div>
            )}
            {isScreenSharing && (
              <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                <ScreenShare className="w-3 h-3 text-green-400" />
                <span className="text-green-400 text-sm font-medium">
                  Sharing Screen
                </span>
              </div>
            )}
            {isRemoteSharingScreen && (
              <div className="flex items-center space-x-2 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                <ScreenShare className="w-3 h-3 text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">
                  Viewing Screen Share
                </span>
              </div>
            )}
            {connectionState === "connected" && (
              <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-sm font-medium">
                  WebRTC Connected
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden audio elements */}
      <audio ref={localAudio} muted playsInline className="hidden" />
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

      {/* Debug Panel (for testing) */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 max-w-md max-h-64 overflow-auto">
          <h4 className="text-white font-semibold mb-2">Debug Log</h4>
          <div className="space-y-1">
            {debugLog.map((log, index) => (
              <div key={index} className="text-xs text-gray-300 font-mono">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 'use client';

// import { useState, useEffect, useRef } from 'react';
// import {
//   Mic,
//   MicOff,
//   ScreenShare,
//   ScreenShareOff,
//   Phone,
//   PhoneOff,
//   User,
//   Clock,
//   Minimize2
// } from 'lucide-react';

// export default function VoiceCall({
//   callData,
//   socket,
//   onEndCall,
//   onAcceptCall,
//   onRejectCall,
//   isIncoming = false,
//   isGroupCall = false
// }) {
//   const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
//   const [localStream, setLocalStream] = useState(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [isMuted, setIsMuted] = useState(false);
//   const [isScreenSharing, setIsScreenSharing] = useState(false);
//   const [error, setError] = useState('');
//   const [isRemoteSharingScreen, setIsRemoteSharingScreen] = useState(false);
//   const [callTimer, setCallTimer] = useState(0);
//   const [isMinimized, setIsMinimized] = useState(false);
//   const [connectionState, setConnectionState] = useState('');
//   const [debugLog, setDebugLog] = useState([]);
//   const [hasVideoTrack, setHasVideoTrack] = useState(false);

//   const peerConnection = useRef(null);
//   const localAudio = useRef(null);
//   const remoteAudio = useRef(null);
//   const remoteVideo = useRef(null);
//   const pendingIceCandidates = useRef([]);
//   const callStartTime = useRef(null);
//   const mediaStream = useRef(null);
//   const screenStream = useRef(null);
//   const audioSender = useRef(null);
//   const videoSender = useRef(null);
//   const dataChannel = useRef(null);
//   const timerInterval = useRef(null);
//   const pendingOffer = useRef(null);
//   const isNegotiating = useRef(false);
//   const videoTransceiver = useRef(null);
//   const retryCount = useRef(0);
//   const maxRetries = 3;
//   const socketListenersSet = useRef(false);
//   const remoteVideoRef = useRef(null);
//   const remoteVideoTrack = useRef(null);
//   const makingOffer = useRef(false);
//   const ignoreOffer = useRef(false);
//   const isSettingRemoteAnswerPending = useRef(false);

//   const addDebug = (message) => {
//     console.log('🔊 DEBUG:', message);
//     setDebugLog(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${message}`]);
//   };

//   const rtcConfig = {
//     iceServers: [
//       { urls: 'stun:stun.l.google.com:19302' },
//       {
//         urls: 'turn:173.249.60.84:3478',
//         username: 'briyan',
//         credential: 'MySecurePassword2024!'
//       }
//     ],
//     iceTransportPolicy: 'all',
//     bundlePolicy: 'max-bundle',
//     rtcpMuxPolicy: 'require',
//     sdpSemantics: 'unified-plan'
//   };

//   useEffect(() => {
//     addDebug('Component mounted - initializing voice call');

//     if (!isIncoming) {
//       initializeCall();
//     } else {
//       addDebug('Incoming call - waiting for manual acceptance');
//     }

//     return () => {
//       addDebug('Component unmounting - cleanup');
//       cleanup();
//     };
//   }, []);

//   useEffect(() => {
//     if (callStatus === 'active' && callStartTime.current) {
//       timerInterval.current = setInterval(() => {
//         const seconds = Math.floor((new Date() - callStartTime.current) / 1000);
//         setCallTimer(seconds);
//       }, 1000);
//     } else {
//       if (timerInterval.current) {
//         clearInterval(timerInterval.current);
//         timerInterval.current = null;
//       }
//     }

//     return () => {
//       if (timerInterval.current) {
//         clearInterval(timerInterval.current);
//         timerInterval.current = null;
//       }
//     };
//   }, [callStatus]);

//   useEffect(() => {
//     if (!socket || socketListenersSet.current) return;

//     addDebug('Setting up socket listeners');
//     socketListenersSet.current = true;

//     const handleVoiceOffer = async (data) => {
//       addDebug(`📞 Received VOICE OFFER from ${data.callerId}`);
//       addDebug(`Offer details: hasVideo=${data.hasVideo}, isScreenShare=${data.isScreenShare}`);

//       if (data.callId === callData.callId) {
//         await handleOffer(data);
//       }
//     };

//     const handleVoiceAnswer = async (data) => {
//       addDebug(`✅ Received VOICE ANSWER from ${data.targetUserId}`);
//       addDebug(`Answer details: hasVideo=${data.hasVideo}, isScreenShare=${data.isScreenShare}`);

//       if (data.callId === callData.callId && peerConnection.current) {
//         await handleAnswer(data);
//       }
//     };

//     const handleVoiceIceCandidate = (data) => {
//       addDebug('🧊 Received VOICE ICE candidate');
//       if (data.callId === callData.callId) {
//         handleIceCandidate(data.candidate);
//       }
//     };

//     const handleCallAccepted = (data) => {
//       if (data.callId === callData.callId) {
//         addDebug('🎉 Voice call accepted by remote user');
//         callStartTime.current = new Date();
//       }
//     };

//     const handleCallEnded = (data) => {
//       if (data.callId === callData.callId) {
//         addDebug('📞 Voice call ended by remote party');
//         setCallStatus('ended');
//         setTimeout(() => {
//           onEndCall(callTimer);
//         }, 1000);
//       }
//     };

//     const handleScreenShareStarted = (data) => {
//       if (data.callId === callData.callId) {
//         addDebug('🖥️ Remote started screen sharing via socket');
//         setIsRemoteSharingScreen(true);
//       }
//     };

//     const handleScreenShareStopped = (data) => {
//       if (data.callId === callData.callId) {
//         addDebug('🖥️ Remote stopped screen sharing via socket');
//         handleRemoteScreenShareEnded();
//       }
//     };

//     const handleCallRejected = (data) => {
//       if (data.callId === callData.callId) {
//         addDebug('❌ Call was rejected by remote party');
//         setCallStatus('rejected');
//         setTimeout(() => {
//           cleanup();
//           if (onEndCall) onEndCall(0);
//         }, 1000);
//       }
//     };

//     socket.on('voice_call_offer', handleVoiceOffer);
//     socket.on('voice_call_answer', handleVoiceAnswer);
//     socket.on('receive_voice_ice_candidate', handleVoiceIceCandidate);
//     socket.on('call_accepted', handleCallAccepted);
//     socket.on('call_ended', handleCallEnded);
//     socket.on('screen_share_started', handleScreenShareStarted);
//     socket.on('screen_share_stopped', handleScreenShareStopped);
//     socket.on('call_rejected', handleCallRejected);

//     return () => {
//       socket.off('voice_call_offer', handleVoiceOffer);
//       socket.off('voice_call_answer', handleVoiceAnswer);
//       socket.off('receive_voice_ice_candidate', handleVoiceIceCandidate);
//       socket.off('call_accepted', handleCallAccepted);
//       socket.off('call_ended', handleCallEnded);
//       socket.off('screen_share_started', handleScreenShareStarted);
//       socket.off('screen_share_stopped', handleScreenShareStopped);
//       socket.off('call_rejected', handleCallRejected);
//       socketListenersSet.current = false;
//     };
//   }, [socket, callData.callId]);

//   const displayVideoTrack = (track) => {
//     if (!track) {
//       addDebug('❌ No track to display');
//       return;
//     }

//     addDebug(`🎬 Displaying video track: ${track.id}, kind: ${track.kind}, label: ${track.label}`);

//     remoteVideoTrack.current = track;

//     if (track.readyState !== 'live') {
//       addDebug('⚠️ Track is not in live state');
//       return;
//     }

//     setHasVideoTrack(true);
//     const videoStream = new MediaStream([track]);

//     if (remoteVideoRef.current) {
//       remoteVideoRef.current.srcObject = videoStream;
//       remoteVideoRef.current.muted = true;
//       remoteVideoRef.current.playsInline = true;
//       remoteVideoRef.current.autoplay = true;

//       const playVideo = async () => {
//         try {
//           addDebug('▶️ Attempting to play video...');
//           await remoteVideoRef.current.play();
//           addDebug('🎉 VIDEO PLAYING SUCCESSFULLY!');
//           setIsRemoteSharingScreen(true);
//           retryCount.current = 0;
//         } catch (playError) {
//           addDebug(`❌ Video play failed: ${playError.message}`);
//           if (retryCount.current < maxRetries) {
//             retryCount.current++;
//             addDebug(`🔄 Retry attempt ${retryCount.current}/${maxRetries}`);
//             setTimeout(() => playVideo(), 1000 * retryCount.current);
//           }
//         }
//       };

//       playVideo();
//     } else {
//       addDebug('⚠️ Video element not available yet, retrying...');
//       setTimeout(() => displayVideoTrack(track), 100);
//     }

//     track.onended = () => {
//       addDebug('🖥️ Video track ended');
//       handleRemoteScreenShareEnded();
//     };
//   };

//   const handleRemoteScreenShareEnded = () => {
//     addDebug('🖥️ Remote screen share ended');
//     setIsRemoteSharingScreen(false);
//     setHasVideoTrack(false);

//     if (remoteVideoRef.current) {
//       remoteVideoRef.current.srcObject = null;
//     }

//     remoteVideoTrack.current = null;
//   };

//   const cleanup = () => {
//     addDebug('🧹 Cleaning up voice call resources...');

//     if (timerInterval.current) {
//       clearInterval(timerInterval.current);
//       timerInterval.current = null;
//     }

//     if (mediaStream.current) {
//       mediaStream.current.getTracks().forEach(track => {
//         track.stop();
//         addDebug(`⏹️ Stopped track: ${track.kind}`);
//       });
//       mediaStream.current = null;
//     }

//     if (screenStream.current) {
//       screenStream.current.getTracks().forEach(track => {
//         track.stop();
//         addDebug(`⏹️ Stopped screen share track: ${track.kind}`);
//       });
//       screenStream.current = null;
//     }

//     if (localStream) {
//       localStream.getTracks().forEach(track => track.stop());
//       setLocalStream(null);
//     }

//     if (remoteStream) {
//       remoteStream.getTracks().forEach(track => track.stop());
//       setRemoteStream(null);
//     }

//     if (peerConnection.current) {
//       peerConnection.current.close();
//       addDebug('🔒 Peer connection closed');
//       peerConnection.current = null;
//     }

//     if (dataChannel.current) {
//       dataChannel.current.close();
//       dataChannel.current = null;
//     }

//     pendingIceCandidates.current = [];
//     pendingOffer.current = null;
//     isNegotiating.current = false;
//     videoTransceiver.current = null;
//     retryCount.current = 0;
//     setHasVideoTrack(false);
//     remoteVideoTrack.current = null;
//     makingOffer.current = false;
//     ignoreOffer.current = false;
//     isSettingRemoteAnswerPending.current = false;

//     if (localAudio.current) {
//       localAudio.current.srcObject = null;
//     }
//     if (remoteAudio.current) {
//       remoteAudio.current.srcObject = null;
//     }
//     if (remoteVideoRef.current) {
//       remoteVideoRef.current.srcObject = null;
//     }

//     audioSender.current = null;
//     videoSender.current = null;
//     setIsScreenSharing(false);
//     setIsRemoteSharingScreen(false);
//     setCallTimer(0);
//     setConnectionState('');
//     socketListenersSet.current = false;
//   };

//   const handleIceCandidate = async (candidate) => {
//     addDebug("🧊 ICE candidate received");

//     if (!peerConnection.current) {
//       addDebug('⏳ No peer connection, storing ICE candidate');
//       pendingIceCandidates.current.push(candidate);
//       return;
//     }

//     if (!peerConnection.current.remoteDescription) {
//       addDebug('⏳ Remote description not set yet, storing ICE candidate');
//       pendingIceCandidates.current.push(candidate);
//       return;
//     }

//     try {
//       await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
//       addDebug('✅ ICE candidate added successfully');
//     } catch (err) {
//       addDebug(`❌ ICE candidate error: ${err.message}`);
//     }
//   };

//   const processPendingIceCandidates = async () => {
//     if (pendingIceCandidates.current.length === 0) return;

//     addDebug(`🔄 Processing ${pendingIceCandidates.current.length} pending ICE candidates`);

//     for (const candidate of pendingIceCandidates.current) {
//       try {
//         await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
//         addDebug('✅ Pending ICE candidate added');
//       } catch (err) {
//         addDebug(`❌ Pending ICE candidate error: ${err.message}`);
//       }
//     }

//     pendingIceCandidates.current = [];
//   };

//   const getMedia = async () => {
//     try {
//       addDebug('🎤 Requesting microphone access...');

//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true,
//         },
//         video: false
//       });

//       const audioTracks = stream.getAudioTracks();
//       if (audioTracks.length === 0) {
//         throw new Error('No audio tracks found');
//       }

//       addDebug(`🎵 Audio tracks acquired: ${audioTracks.length}`);

//       stream.getTracks().forEach((track, index) => {
//         addDebug(`🔊 Track ${index}: ${track.kind} - ${track.label}`);
//         track.enabled = true;
//       });

//       mediaStream.current = stream;
//       setLocalStream(stream);

//       if (localAudio.current) {
//         localAudio.current.srcObject = stream;
//         localAudio.current.muted = true;
//         localAudio.current.volume = 0;
//         try {
//           await localAudio.current.play();
//           addDebug('✅ Local audio monitoring started');
//         } catch (err) {
//           addDebug(`❌ Local audio play error: ${err.message}`);
//         }
//       }

//       return stream;
//     } catch (err) {
//       const errorMsg = `❌ Cannot access microphone: ${err.message}`;
//       addDebug(errorMsg);
//       setError(errorMsg);
//       throw err;
//     }
//   };

//   const createPeerConnection = (stream) => {
//     try {
//       const pc = new RTCPeerConnection(rtcConfig);

//       const audioTrack = stream.getAudioTracks()[0];
//       if (audioTrack) {
//         audioSender.current = pc.addTrack(audioTrack, stream);
//         addDebug('✅ Added audio track');
//       }

//       // Create video transceiver - initially recvonly to receive screen shares
//       const transceiver = pc.addTransceiver('video', {
//         direction: 'recvonly'
//       });
//       videoTransceiver.current = transceiver;
//       addDebug('📹 Added video transceiver (recvonly for receiving screen shares)');

//       // Create data channel for control messages
//       try {
//         dataChannel.current = pc.createDataChannel('screenShareControl', {
//           ordered: true,
//           maxRetransmits: 3
//         });

//         dataChannel.current.onopen = () => {
//           addDebug('📡 Data channel opened');
//         };

//         dataChannel.current.onmessage = (event) => {
//           try {
//             const data = JSON.parse(event.data);
//             addDebug(`📡 Data channel message: ${data.type}`);

//             if (data.type === 'screen_share_started') {
//               addDebug('🖥️ Remote started screen sharing via data channel');
//               setIsRemoteSharingScreen(true);
//             } else if (data.type === 'screen_share_stopped') {
//               addDebug('🖥️ Remote stopped screen sharing via data channel');
//               handleRemoteScreenShareEnded();
//             }
//           } catch (parseError) {
//             addDebug(`❌ Error parsing data channel message: ${parseError.message}`);
//           }
//         };
//       } catch (err) {
//         addDebug(`❌ Data channel creation failed: ${err.message}`);
//       }

//       pc.ondatachannel = (event) => {
//         const channel = event.channel;
//         addDebug(`📡 Incoming data channel: ${channel.label}`);

//         channel.onmessage = (event) => {
//           try {
//             const data = JSON.parse(event.data);
//             addDebug(`📡 Incoming data channel message: ${data.type}`);

//             if (data.type === 'screen_share_started') {
//               addDebug('🖥️ Remote started screen sharing');
//               setIsRemoteSharingScreen(true);
//             } else if (data.type === 'screen_share_stopped') {
//               addDebug('🖥️ Remote stopped screen sharing');
//               handleRemoteScreenShareEnded();
//             }
//           } catch (parseError) {
//             addDebug(`❌ Error parsing incoming data channel message: ${parseError.message}`);
//           }
//         };
//       };

//       pc.ontrack = (event) => {
//         addDebug('🎧 ONTRACK EVENT FIRED');
//         const track = event.track;
//         const streams = event.streams;

//         addDebug(`📹 Track kind: ${track.kind}, Streams: ${streams.length}, ReadyState: ${track.readyState}, Label: ${track.label}`);

//         if (track.kind === 'video') {
//           addDebug('🖥️ VIDEO TRACK DETECTED in ontrack');
//           displayVideoTrack(track);
//         } else if (track.kind === 'audio') {
//           addDebug('🔊 Setting up remote audio');
//           setRemoteStream(streams[0] || new MediaStream([track]));
//           setTimeout(() => {
//             setupRemoteAudio(streams[0] || new MediaStream([track]));
//           }, 100);
//         }
//       };

//       pc.onicecandidate = (event) => {
//         if (event.candidate) {
//           addDebug(`🧊 Sending ICE candidate`);
//           const targetUserId = isIncoming ? callData.callerId : callData.targetUserId;
//           socket.emit('send_voice_ice_candidate', {
//             callId: callData.callId,
//             targetUserId: targetUserId,
//             candidate: event.candidate
//           });
//         } else {
//           addDebug('✅ All ICE candidates gathered');
//         }
//       };

//       pc.onnegotiationneeded = async () => {
//         try {
//           addDebug('🔄 Negotiation needed');

//           // Prevent multiple simultaneous negotiations
//           if (makingOffer.current) {
//             addDebug('⏳ Already making offer, skipping');
//             return;
//           }

//           makingOffer.current = true;
//           addDebug('📤 Creating offer due to negotiation needed...');

//           const offer = await pc.createOffer({
//             offerToReceiveAudio: true,
//             offerToReceiveVideo: true
//           });

//           // Check if connection state changed during createOffer
//           if (pc.signalingState !== 'stable') {
//             addDebug('⚠️ Signaling state changed, aborting offer');
//             makingOffer.current = false;
//             return;
//           }

//           await pc.setLocalDescription(offer);
//           addDebug('📡 Local description set in negotiation');

//           const targetUserId = isIncoming ? callData.callerId : callData.targetUserId;

//           socket.emit('voice_call_offer', {
//             targetUserId,
//             callId: callData.callId,
//             callerId: isIncoming ? socket.userId : callData.callerId,
//             offer: offer,
//             hasVideo: isScreenSharing,
//             isScreenShare: isScreenSharing,
//             callerSocketId: socket.id
//           });

//           addDebug('✅ Negotiation offer sent');

//         } catch (err) {
//           addDebug(`❌ Negotiation error: ${err.message}`);
//         } finally {
//           makingOffer.current = false;
//         }
//       };

//       pc.onconnectionstatechange = () => {
//         const state = pc.connectionState;
//         setConnectionState(state);
//         addDebug(`🔗 Connection state: ${state}`);

//         switch (state) {
//           case 'connected':
//             addDebug('🎉 WebRTC CONNECTED!');
//             break;
//           case 'disconnected':
//             addDebug('⚠️ Connection disconnected');
//             setError('Connection lost - trying to reconnect...');
//             break;
//           case 'failed':
//             setError('Connection failed. Please try again.');
//             addDebug('❌ Connection failed');
//             break;
//           case 'closed':
//             addDebug('🔒 Connection closed');
//             break;
//         }
//       };

//       pc.oniceconnectionstatechange = () => {
//         const state = pc.iceConnectionState;
//         addDebug(`🧊 ICE connection state: ${state}`);
//       };

//       peerConnection.current = pc;
//       return pc;
//     } catch (err) {
//       addDebug(`❌ Error creating peer connection: ${err.message}`);
//       throw err;
//     }
//   };

//   const setupRemoteAudio = async (audioStream) => {
//     if (!remoteAudio.current) {
//       addDebug('❌ No remote audio element available');
//       return;
//     }

//     addDebug('🔊 Setting up remote audio playback...');

//     try {
//       remoteAudio.current.srcObject = audioStream;
//       remoteAudio.current.muted = false;
//       remoteAudio.current.volume = 1.0;
//       remoteAudio.current.playsInline = true;

//       addDebug('▶️ Attempting to play remote audio...');
//       await remoteAudio.current.play();
//       addDebug('🎉 REMOTE AUDIO PLAYING SUCCESSFULLY!');
//     } catch (error) {
//       addDebug(`❌ Error setting up remote audio: ${error.message}`);
//     }
//   };

//   const initializeCall = async () => {
//     try {
//       addDebug('🚀 Initializing call...');
//       setError('');

//       const stream = await getMedia();
//       const pc = createPeerConnection(stream);

//       if (!isIncoming) {
//         addDebug('📤 Creating offer as caller...');

//         const offer = await pc.createOffer({
//           offerToReceiveAudio: true,
//           offerToReceiveVideo: true,
//           voiceActivityDetection: true
//         });

//         addDebug('✅ Offer created');

//         await pc.setLocalDescription(offer);
//         addDebug(`📡 Local description set`);

//         const targetUserId = callData.targetUserId;
//         addDebug(`📤 Sending offer to user: ${targetUserId}`);

//         socket.emit('voice_call_offer', {
//           targetUserId: targetUserId,
//           callId: callData.callId,
//           callerId: callData.callerId,
//           offer: offer,
//           hasVideo: false,
//           isScreenShare: false,
//           callerSocketId: socket.id
//         });

//         addDebug('✅ Outgoing call initialization complete');
//       }
//     } catch (err) {
//       const errorMsg = `❌ Failed to initialize call: ${err.message}`;
//       addDebug(errorMsg);
//       setError(errorMsg);
//       endCall();
//     }
//   };

//   const handleOffer = async (data) => {
//     try {
//       addDebug('📥 Processing offer...');
//       addDebug(`Offer type: isScreenShare=${data.isScreenShare}, hasVideo=${data.hasVideo}`);

//       if (!peerConnection.current) {
//         addDebug('⏳ No peer connection yet');

//         // Store initial offer for incoming calls
//         if (isIncoming && callStatus === 'ringing') {
//           addDebug('📥 Received initial offer - storing for manual acceptance...');
//           pendingOffer.current = data;
//           addDebug('✅ Initial offer stored, waiting for user to accept');
//           return;
//         }
//         return;
//       }

//       const offerCollision =
//         (data.isScreenShare || data.hasVideo) &&
//         (peerConnection.current.signalingState !== 'stable' || makingOffer.current);

//       ignoreOffer.current = offerCollision;

//       if (ignoreOffer.current) {
//         addDebug('⚠️ Ignoring offer due to collision');
//         return;
//       }

//       addDebug('🔄 Setting remote description from offer...');
//       const offer = new RTCSessionDescription(data.offer);
//       await peerConnection.current.setRemoteDescription(offer);
//       addDebug('✅ Remote description set from offer');

//       // Create answer
//       const answer = await peerConnection.current.createAnswer({
//         offerToReceiveAudio: true,
//         offerToReceiveVideo: true
//       });

//       await peerConnection.current.setLocalDescription(answer);
//       addDebug('📡 Local description set (answer)');

//       const targetUserId = isIncoming ? callData.callerId : data.callerId;

//       socket.emit('voice_call_answer', {
//         callId: data.callId,
//         targetUserId: targetUserId,
//         answer: answer,
//         hasVideo: data.hasVideo || false,
//         isScreenShare: data.isScreenShare || false
//       });

//       addDebug('✅ Answer sent successfully');

//       // If this offer includes video, prepare to receive it
//       if (data.hasVideo || data.isScreenShare) {
//         addDebug('🎬 Offer includes video, setting flag');
//         setIsRemoteSharingScreen(true);
//       }

//     } catch (err) {
//       console.error('❌ Failed to handle offer:', err);
//       const errorMsg = `❌ Failed to handle offer: ${err.message}`;
//       addDebug(errorMsg);
//       setError(errorMsg);
//     }
//   };

//   const handleAnswer = async (data) => {
//     try {
//       if (!peerConnection.current) {
//         addDebug('❌ No peer connection available');
//         return;
//       }

//       addDebug(`📡 Current signaling state: ${peerConnection.current.signalingState}`);

//       if (peerConnection.current.signalingState === 'stable') {
//         addDebug('✅ Already stable, ignoring duplicate answer');
//         return;
//       }

//       // Prevent setting remote description if we're already doing it
//       if (isSettingRemoteAnswerPending.current) {
//         addDebug('⏳ Already setting remote answer, skipping duplicate');
//         return;
//       }

//       isSettingRemoteAnswerPending.current = true;

//       addDebug('🔄 Setting remote description from answer...');
//       const answer = new RTCSessionDescription(data.answer);
//       await peerConnection.current.setRemoteDescription(answer);

//       addDebug('✅ Remote description set successfully');
//       isSettingRemoteAnswerPending.current = false;

//       await processPendingIceCandidates();

//       setCallStatus('active');
//       if (!callStartTime.current) {
//         callStartTime.current = new Date();
//       }

//       addDebug('✅ Call is now active');

//       // If this answer includes video, check for video tracks
//       if (data.hasVideo === true || data.isScreenShare === true) {
//         addDebug('🎬 Answer indicates screen sharing');
//         setIsRemoteSharingScreen(true);
//       }

//     } catch (err) {
//       console.error('❌ Error in handleAnswer:', err);
//       isSettingRemoteAnswerPending.current = false;
//       const errorMsg = `❌ Error setting remote description: ${err.message}`;
//       addDebug(errorMsg);

//       if (peerConnection.current && peerConnection.current.iceConnectionState === 'connected') {
//         addDebug('✅ Connection already established despite error');
//         setCallStatus('active');
//         if (!callStartTime.current) {
//           callStartTime.current = new Date();
//         }
//       }
//     }
//   };

//   // Periodic check for video tracks when remote is sharing
//   useEffect(() => {
//     if (isRemoteSharingScreen && peerConnection.current && !hasVideoTrack) {
//       const checkForVideoTrack = () => {
//         if (!peerConnection.current) return;

//         const transceivers = peerConnection.current.getTransceivers();
//         const videoTransceiver = transceivers.find(t =>
//           t.receiver?.track?.kind === 'video'
//         );

//         if (videoTransceiver?.receiver?.track && videoTransceiver.receiver.track.readyState === 'live') {
//           addDebug('🎬 Found live video track in periodic check');
//           displayVideoTrack(videoTransceiver.receiver.track);
//         }
//       };

//       const interval = setInterval(checkForVideoTrack, 1000);
//       checkForVideoTrack(); // Initial check

//           return () => clearInterval(interval);
//   }
// }, [isRemoteSharingScreen, hasVideoTrack]);

//   const toggleScreenShare = async () => {
//     try {
//       if (!isScreenSharing) {
//         addDebug('🖥️ Starting screen sharing...');

//         const screenShareStream = await navigator.mediaDevices.getDisplayMedia({
//           video: {
//             cursor: 'always',
//             displaySurface: 'monitor',
//             frameRate: { ideal: 15 },
//             width: { ideal: 1920 },
//             height: { ideal: 1080 }
//           },
//           audio: false
//         });

//         screenStream.current = screenShareStream;
//         const videoTrack = screenShareStream.getVideoTracks()[0];

//         if (videoTrack && peerConnection.current) {
//           addDebug('📹 Adding screen share video track');

//           // Update transceiver to sendrecv so we can both send and receive video
//           if (videoTransceiver.current) {
//             videoTransceiver.current.direction = 'sendrecv';
//             await videoTransceiver.current.sender.replaceTrack(videoTrack);
//             addDebug('✅ Updated transceiver to sendrecv and replaced track');
//           } else {
//             // Fallback: add track if transceiver doesn't exist
//             videoSender.current = peerConnection.current.addTrack(videoTrack, screenShareStream);
//             addDebug('✅ Added new video track');
//           }

//           // Notify via data channel first
//           if (dataChannel.current && dataChannel.current.readyState === 'open') {
//             dataChannel.current.send(JSON.stringify({
//               type: 'screen_share_started',
//               timestamp: Date.now()
//             }));
//             addDebug('📡 Notified remote via data channel');
//           }

//           // Notify via socket
//           const targetUserId = isIncoming ? callData.callerId : callData.targetUserId;
//           socket.emit('screen_share_started', {
//             callId: callData.callId,
//             targetUserId: targetUserId,
//             timestamp: Date.now(),
//             hasVideo: true,
//             isVoiceCall: true,
//             callerSocketId: socket.id
//           });

//           setIsScreenSharing(true);

//           videoTrack.onended = () => {
//             addDebug('🖥️ Screen share ended by user');
//             stopScreenShare();
//           };

//           addDebug('✅ Screen sharing started - negotiation will happen automatically');
//         }

//       } else {
//         await stopScreenShare();
//       }
//     } catch (err) {
//       addDebug(`❌ Screen share error: ${err.message}`);
//       if (err.name !== 'NotAllowedError') {
//         setError('Failed to share screen: ' + err.message);
//       }
//     }
//   };

//   const stopScreenShare = async () => {
//     try {
//       addDebug('🖥️ Stopping screen share...');

//       // Stop screen stream
//       if (screenStream.current) {
//         screenStream.current.getTracks().forEach(track => {
//           track.stop();
//           addDebug(`⏹️ Stopped screen track: ${track.kind}`);
//         });
//         screenStream.current = null;
//       }

//       if (peerConnection.current && videoTransceiver.current) {
//         // Remove video track
//         await videoTransceiver.current.sender.replaceTrack(null);
//         addDebug('✅ Removed video track');

//         // Update transceiver back to recvonly
//         videoTransceiver.current.direction = 'recvonly';
//         addDebug('🔄 Updated transceiver back to recvonly');

//         // Notify via data channel
//         if (dataChannel.current && dataChannel.current.readyState === 'open') {
//           dataChannel.current.send(JSON.stringify({
//             type: 'screen_share_stopped',
//             timestamp: Date.now()
//           }));
//           addDebug('📡 Notified remote via data channel');
//         }

//         // Notify via socket
//         const targetUserId = isIncoming ? callData.callerId : callData.targetUserId;
//         socket.emit('screen_share_stopped', {
//           callId: callData.callId,
//           targetUserId: targetUserId,
//           timestamp: Date.now(),
//           isVoiceCall: true,
//           callerSocketId: socket.id
//         });

//         setIsScreenSharing(false);
//         addDebug('✅ Screen share stopped - negotiation will happen automatically');
//       }

//     } catch (err) {
//       addDebug(`❌ Error stopping screen share: ${err.message}`);
//     }
//   };

//   const acceptCall = async () => {
//     addDebug('✅ Accepting call...');

//     try {
//       setError('');

//       const stream = await getMedia();
//       const pc = createPeerConnection(stream);

//       if (pendingOffer.current) {
//         addDebug('📥 Processing stored offer after acceptance...');

//         const data = pendingOffer.current;

//         if (pc.signalingState !== 'stable') {
//           await new Promise(resolve => setTimeout(resolve, 100));
//         }

//         addDebug('🔄 Setting remote description from offer...');
//         const offer = new RTCSessionDescription(data.offer);
//         await pc.setRemoteDescription(offer);

//         await processPendingIceCandidates();

//         addDebug('📤 Creating answer...');
//         const answer = await pc.createAnswer({
//           offerToReceiveAudio: true,
//           offerToReceiveVideo: true,
//           voiceActivityDetection: true
//         });

//         await pc.setLocalDescription(answer);
//         addDebug(`📡 Local description set`);

//         socket.emit('voice_call_answer', {
//           callId: data.callId,
//           targetUserId: data.callerId,
//           answer: answer,
//           hasVideo: data.hasVideo || false,
//           isScreenShare: data.isScreenShare || false
//         });

//         pendingOffer.current = null;
//       }

//       socket.emit('accept_call', {
//         callId: callData.callId,
//         targetUserId: callData.callerId
//       });

//       setCallStatus('active');
//       callStartTime.current = new Date();

//       addDebug('✅ Call accepted and WebRTC established');

//       if (onAcceptCall) {
//         setTimeout(() => onAcceptCall(), 100);
//       }

//     } catch (err) {
//       const errorMsg = `❌ Failed to accept call: ${err.message}`;
//       addDebug(errorMsg);
//       setError(errorMsg);
//     }
//   };

//   const rejectCall = () => {
//     addDebug('❌ Rejecting call...');
//     socket.emit('reject_call', {
//       callId: callData.callId,
//       targetUserId: callData.callerId
//     });
//     cleanup();
//     if (onRejectCall) onRejectCall();
//   };

//   const endCall = () => {
//     addDebug('📞 Ending call...');

//     socket.emit('end_call', {
//       callId: callData.callId,
//       targetUserId: isIncoming ? callData.callerId : callData.targetUserId,
//       duration: callTimer
//     });

//     cleanup();
//     if (onEndCall) onEndCall(callTimer);
//   };

//   const toggleMute = () => {
//     if (localStream) {
//       const audioTrack = localStream.getAudioTracks()[0];
//       if (audioTrack) {
//         audioTrack.enabled = !audioTrack.enabled;
//         setIsMuted(!audioTrack.enabled);
//         addDebug(`🎤 Microphone ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
//       }
//     }
//   };

//   const formatTime = (seconds) => {
//     const hrs = Math.floor(seconds / 3600);
//     const mins = Math.floor((seconds % 3600) / 60);
//     const secs = seconds % 60;

//     if (hrs > 0) {
//       return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//     }
//     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//   };

//   // INCOMING CALL UI
//   if (isIncoming && callStatus === 'ringing' && !isMinimized) {
//     return (
//       <div className="fixed top-6 right-6 z-50 animate-fade-in">
//         <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl p-6 w-96 border border-gray-800">
//           <div className="flex items-center justify-between mb-6">
//             <div className="flex items-center space-x-3">
//               <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
//                 <User className="w-6 h-6 text-white" />
//               </div>
//               <div>
//                 <h3 className="text-white font-semibold text-lg">
//                   {callData.callerName || 'Unknown Caller'}
//                 </h3>
//                 <p className="text-gray-400 text-sm flex items-center">
//                   <Phone className="w-3 h-3 mr-1" />
//                   Incoming Voice Call
//                 </p>
//               </div>
//             </div>
//             <button
//               onClick={() => setIsMinimized(true)}
//               className="text-gray-400 hover:text-white transition-colors"
//             >
//               <Minimize2 className="w-5 h-5" />
//             </button>
//           </div>

//           <div className="flex space-x-3">
//             <button
//               onClick={rejectCall}
//               className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
//             >
//               <PhoneOff className="w-5 h-5 group-hover:rotate-90 transition-transform" />
//               <span>Decline</span>
//             </button>
//             <button
//               onClick={acceptCall}
//               className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
//             >
//               <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
//               <span>Accept</span>
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Minimized incoming call
//   if (isIncoming && callStatus === 'ringing' && isMinimized) {
//     return (
//       <div className="fixed bottom-6 right-6 z-50">
//         <div className="bg-gray-900 rounded-lg shadow-lg p-3 w-64 border border-gray-800">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center space-x-2">
//               <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center animate-pulse">
//                 <Phone className="w-4 h-4 text-white" />
//               </div>
//               <div>
//                 <p className="text-white text-sm font-medium">Incoming Call</p>
//                 <p className="text-gray-400 text-xs">{callData.callerName}</p>
//               </div>
//             </div>
//             <div className="flex space-x-1">
//               <button
//                 onClick={acceptCall}
//                 className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
//               >
//                 <Phone className="w-4 h-4 text-white" />
//               </button>
//               <button
//                 onClick={rejectCall}
//                 className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
//               >
//                 <PhoneOff className="w-4 h-4 text-white" />
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ACTIVE CALL UI
//   return (
//     <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-black flex flex-col z-50">
//       {/* Top Bar */}
//       <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-4">
//         <div className="max-w-6xl mx-auto flex items-center justify-between">
//           <div className="flex items-center space-x-4">
//             <div className={`w-3 h-3 rounded-full ${callStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
//             <div>
//               <h1 className="text-white font-semibold text-lg">
//                 {callData.callerName || callData.targetUserName || 'Voice Call'}
//               </h1>
//               <div className="flex items-center space-x-2 text-gray-400 text-sm">
//                 <Clock className="w-4 h-4" />
//                 <span>{formatTime(callTimer)}</span>
//                 <span>•</span>
//                 <span className="capitalize">{connectionState || 'Connecting'}</span>
//                 {isRemoteSharingScreen && (
//                   <>
//                     <span>•</span>
//                     <span className="text-blue-400 flex items-center">
//                       <ScreenShare className="w-4 h-4 mr-1" />
//                       Viewing Screen
//                     </span>
//                   </>
//                 )}
//                 {isScreenSharing && (
//                   <>
//                     <span>•</span>
//                     <span className="text-green-400 flex items-center">
//                       <ScreenShare className="w-4 h-4 mr-1" />
//                       Sharing Screen
//                     </span>
//                   </>
//                 )}
//               </div>
//             </div>
//           </div>

//           <button
//             onClick={() => setIsMinimized(true)}
//             className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
//           >
//             <Minimize2 className="w-5 h-5" />
//           </button>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="flex-1 flex flex-col lg:flex-row p-4 gap-6 max-w-6xl mx-auto w-full">
//         {/* Left Side - Remote Participant */}
//         <div className="flex-1 bg-gray-900/50 rounded-2xl border border-gray-800 p-6 flex flex-col">
//           <div className="mb-4">
//             <h2 className="text-white font-semibold text-lg mb-2">
//               {isRemoteSharingScreen ? 'Remote Screen Share' : 'Remote Participant'}
//             </h2>
//             <div className="flex items-center space-x-2 text-gray-400 text-sm">
//               <div className={`w-2 h-2 rounded-full ${remoteStream ? 'bg-green-500' : 'bg-yellow-500'}`} />
//               <span>{remoteStream ? 'Audio Connected' : 'Connecting...'}</span>
//               {isRemoteSharingScreen && (
//                 <div className="flex items-center space-x-1 text-blue-400">
//                   <ScreenShare className="w-3 h-3" />
//                   <span>Screen Active</span>
//                 </div>
//               )}
//             </div>
//           </div>

//           <div className="flex-1 bg-black/40 rounded-xl border border-gray-800 overflow-hidden relative flex items-center justify-center min-h-[400px]">
//             {isRemoteSharingScreen && hasVideoTrack ? (
//               <div className="w-full h-full flex flex-col">
//                 <div className="p-4 bg-gray-900/80 border-b border-gray-800">
//                   <div className="flex items-center space-x-2 text-blue-400">
//                     <ScreenShare className="w-5 h-5" />
//                     <span className="font-medium">Remote Screen Share</span>
//                   </div>
//                 </div>
//                 <div className="flex-1 flex items-center justify-center bg-black p-4">
//                   <video
//                     ref={remoteVideoRef}
//                     autoPlay
//                     playsInline
//                     muted
//                     className="w-full h-full object-contain rounded-lg"
//                     style={{
//                       minHeight: '300px',
//                       backgroundColor: '#000'
//                     }}
//                   />
//                 </div>
//               </div>
//             ) : (
//               <div className="text-center p-8">
//                 <div className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-500/30">
//                   <User className="w-16 h-16 text-blue-400" />
//                 </div>
//                 <h3 className="text-white text-xl font-semibold mb-2">
//                   {callData.callerName || callData.targetUserName || 'Remote User'}
//                 </h3>
//                 <p className="text-gray-400">
//                   {callStatus === 'active' ? 'Voice call connected' : 'Connecting...'}
//                 </p>
//                 {isScreenSharing && (
//                   <p className="text-green-400 mt-4 flex items-center justify-center">
//                     <ScreenShare className="w-5 h-5 mr-2" />
//                     You are sharing your screen
//                   </p>
//                 )}
//                 {isRemoteSharingScreen && !hasVideoTrack && (
//                   <div className="mt-4">
//                     <div className="animate-pulse">
//                       <p className="text-blue-400 mb-2">Waiting for video stream...</p>
//                       <div className="flex items-center justify-center space-x-2">
//                         <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
//                         <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
//                         <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
//                       </div>
//                     </div>
//                   </div>
//                 )}
//                 {error && (
//                   <p className="text-red-400 mt-4 text-sm">{error}</p>
//                 )}
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Right Side - Local Controls */}
//         <div className="lg:w-80 bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
//           <h3 className="text-white font-semibold text-lg mb-6">Your Controls</h3>

//           {/* Local Audio Preview */}
//           <div className="mb-8">
//             <div className="flex items-center justify-between mb-4">
//               <span className="text-gray-300">Microphone</span>
//               <div className={`px-3 py-1 rounded-full text-sm ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
//                 {isMuted ? 'Muted' : 'Active'}
//               </div>
//             </div>
//             <div className="bg-gray-800/50 rounded-xl p-4">
//               <div className="flex items-center justify-center space-x-3">
//                 <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
//                   {isMuted ? (
//                     <MicOff className="w-6 h-6 text-red-400" />
//                   ) : (
//                     <Mic className="w-6 h-6 text-green-400" />
//                   )}
//                 </div>
//                 <div className="flex-1">
//                   <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
//                     <div
//                       className={`h-full ${isMuted ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}
//                       style={{ width: isMuted ? '0%' : '70%' }}
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Screen Sharing Status */}
//           {isScreenSharing && (
//             <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
//               <div className="flex items-center space-x-3">
//                 <ScreenShare className="w-5 h-5 text-green-400" />
//                 <div>
//                   <p className="text-green-400 font-medium">Sharing Your Screen</p>
//                   <p className="text-green-400/70 text-sm">Remote can see your screen</p>
//                 </div>
//               </div>
//             </div>
//           )}

//           {isRemoteSharingScreen && (
//             <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
//               <div className="flex items-center space-x-3">
//                 <ScreenShare className="w-5 h-5 text-blue-400" />
//                 <div>
//                   <p className="text-blue-400 font-medium">Viewing Screen Share</p>
//                   <p className="text-blue-400/70 text-sm">Remote is sharing</p>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Call Stats */}
//           <div className="mb-6 bg-gray-800/30 rounded-xl p-4">
//             <h4 className="text-gray-300 font-medium mb-3">Call Information</h4>
//             <div className="space-y-2">
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">Duration</span>
//                 <span className="text-white font-mono">{formatTime(callTimer)}</span>
//               </div>
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">Status</span>
//                 <span className={`${callStatus === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
//                   {callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
//                 </span>
//               </div>
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">Connection</span>
//                 <span className={`${connectionState === 'connected' ? 'text-green-400' : 'text-yellow-400'}`}>
//                   {connectionState || 'Connecting'}
//                 </span>
//               </div>
//             </div>
//           </div>

//           {/* Quick Actions */}
//           <div className="grid grid-cols-2 gap-3">
//             <button
//               onClick={toggleMute}
//               className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all ${isMuted
//                 ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
//                 : 'bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50'
//                 }`}
//             >
//               {isMuted ? (
//                 <MicOff className="w-5 h-5" />
//               ) : (
//                 <Mic className="w-5 h-5" />
//               )}
//               <span className="text-xs font-medium">
//                 {isMuted ? 'Unmute' : 'Mute'}
//               </span>
//             </button>

//             <button
//               onClick={toggleScreenShare}
//               className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all ${isScreenSharing
//                 ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
//                 : 'bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50'
//                 }`}
//             >
//               {isScreenSharing ? (
//                 <ScreenShareOff className="w-5 h-5" />
//               ) : (
//                 <ScreenShare className="w-5 h-5" />
//               )}
//               <span className="text-xs font-medium">
//                 {isScreenSharing ? 'Stop Share' : 'Share'}
//               </span>
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Bottom Controls */}
//       <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 p-6">
//         <div className="max-w-4xl mx-auto">
//           <div className="flex justify-center items-center space-x-4">
//             <button
//               onClick={toggleMute}
//               className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted
//                 ? 'bg-red-500 text-white hover:bg-red-600'
//                 : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
//                 }`}
//             >
//               {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
//             </button>

//             <button
//               onClick={toggleScreenShare}
//               className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing
//                 ? 'bg-green-500 text-white hover:bg-green-600'
//                 : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
//                 }`}
//             >
//               {isScreenSharing ? <ScreenShareOff className="w-6 h-6" /> : <ScreenShare className="w-6 h-6" />}
//             </button>

//             <button
//               onClick={endCall}
//               className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all"
//             >
//               <PhoneOff className="w-7 h-7" />
//             </button>
//           </div>

//           <div className="flex flex-wrap justify-center items-center gap-3 mt-6">
//             {localStream && (
//               <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
//                 <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
//                 <span className="text-green-400 text-sm font-medium">Mic Connected</span>
//               </div>
//             )}
//             {isScreenSharing && (
//               <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
//                 <ScreenShare className="w-3 h-3 text-green-400" />
//                 <span className="text-green-400 text-sm font-medium">Sharing</span>
//               </div>
//             )}
//             {isRemoteSharingScreen && (
//               <div className="flex items-center space-x-2 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
//                 <ScreenShare className="w-3 h-3 text-blue-400" />
//                 <span className="text-blue-400 text-sm font-medium">Viewing</span>
//               </div>
//             )}
//             {connectionState === 'connected' && (
//               <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
//                 <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
//                 <span className="text-green-400 text-sm font-medium">Connected</span>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       <audio ref={localAudio} muted playsInline className="hidden" />
//       <audio ref={remoteAudio} autoPlay playsInline className="hidden" />
//     </div>
//   );
// };
