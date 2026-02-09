'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  Users,
  Clock,
  User,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ringtoneService } from '@/lib/ringtone-service';

export default function GroupCall({
  callData,
  socket,
  currentUserId,
  onEndCall,
  onAcceptCall,
  onRejectCall,
  isIncoming = false
}) {
  const [participants, setParticipants] = useState([]); // Store participant IDs
  const [participantNames, setParticipantNames] = useState({}); // Store participant names by ID
  const [localStream, setLocalStream] = useState(null);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callData.type === 'video');
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [activeScreenSharer, setActiveScreenSharer] = useState(null);
  const [connectionStates, setConnectionStates] = useState({});
  const [participantStreams, setParticipantStreams] = useState({});
  const [callTimer, setCallTimer] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const peerConnections = useRef({});
  const mediaStreamRef = useRef(null);
  const screenShareRef = useRef(null);
  const localVideoRef = useRef(null);
  const screenShareVideoRef = useRef(null);
  const videoRefs = useRef({});
  const pendingOffers = useRef({});
  const pendingCandidates = useRef({});
  const isInitialized = useRef(false);
  const callStartTime = useRef(null);
  const timerInterval = useRef(null);

  // Timer effect
  useEffect(() => {
    if (callStatus === 'active' && callStartTime.current) {
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

  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize media
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000
          },
          video: callData.type === 'video' ? {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
            facingMode: 'user'
          } : false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaStreamRef.current = stream;
        setLocalStream(stream);

        if (localVideoRef.current && callData.type === 'video') {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
        }

        // Join call after media is ready
        if (!isIncoming || callStatus === 'active') {
          joinGroupCall();
        }

      } catch (error) {
        console.error(' Failed to get media:', error);
      }
    };

    if (!mediaStreamRef.current) {
      initializeMedia();
    }

    return () => {
      cleanup();
    };
  }, [callData.type, isIncoming]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !callData) return;

    const handleUserJoined = async (data) => {
      console.log("handleUserJoined data", data);
      
      if (data.userId === currentUserId) return;

      setParticipants(prev => {
        if (!prev.includes(data.userId)) {
          return [...prev, data.userId];
        }
        return prev;
      });

      // Store participant name
      if (data.userName) {
        setParticipantNames(prev => ({
          ...prev,
          [data.userId]: data.userName
        }));
      }

      // Create peer connection for each new participant
      if (mediaStreamRef.current) {
        await createPeerConnection(data.userId, true);
      }
    };

    const handleUserLeft = (data) => {
      removeParticipant(data.userId);
      closePeerConnection(data.userId);

      if (activeScreenSharer === data.userId) {
        setActiveScreenSharer(null);
      }
    };

    const handleGroupCallParticipants = (data) => {
      console.log("handleGroupCallParticipants data", data);
      
      const otherParticipants = data.participants.filter(
        id => id !== currentUserId
      );

      setParticipants(otherParticipants);

      // Create connections to all existing participants
      otherParticipants.forEach(userId => {
        setTimeout(async () => {
          if (mediaStreamRef.current) {
            await createPeerConnection(userId, true);
          }
        }, 500);
      });
    };

    // NEW: Handle participants with info
    const handleGroupCallParticipantsWithInfo = (data) => {
      console.log("handleGroupCallParticipantsWithInfo data", data);
      
      // Store participants and their names
      const otherParticipants = data.participants.filter(
        p => p.userId !== currentUserId
      );

      setParticipants(otherParticipants.map(p => p.userId));
      
      // Store participant names
      const names = {};
      otherParticipants.forEach(p => {
        if (p.userName) {
          names[p.userId] = p.userName;
        }
      });
      setParticipantNames(names);

      // Create connections
      otherParticipants.forEach(p => {
        setTimeout(async () => {
          if (mediaStreamRef.current) {
            await createPeerConnection(p.userId, true);
          }
        }, 500);
      });
    };

    const handleGroupCallOffer = async (data) => {
      if (isIncoming && callStatus === 'ringing') {
        if (!pendingOffers.current[data.callerId]) {
          pendingOffers.current[data.callerId] = [];
        }
        pendingOffers.current[data.callerId].push(data);
        return;
      }

      await handleIncomingOffer(data.callerId, data.offer, data.callerSocketId, data.isScreenShare);
    };

    const handleGroupCallAnswer = async (data) => {
      ringtoneService.stop();
      await handleIncomingAnswer(data.responderId, data.answer, data.isScreenShare);
    };

    const handleGroupCallIceCandidate = async (data) => {
      await handleIncomingIceCandidate(data.senderId, data.candidate);
    };

    const handleScreenShareStarted = (data) => {
      console.log('🖥️ Screen share started by:', data.userId);
      setActiveScreenSharer(data.userId);
      
      if (data.userId !== currentUserId && isSharingScreen) {
        console.log('⚠️ Someone else started sharing, stopping our share');
        stopScreenSharing();
      }
    };

    const handleScreenShareStopped = (data) => {
      console.log('🛑 Received screen share stopped event:', data);
      
      if (data.userId === activeScreenSharer || data.forceClear) {
        console.log(`✅ Clearing active screen sharer: ${activeScreenSharer}`);
        setActiveScreenSharer(null);
        
        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = null;
        }
        
        if (data.userId === currentUserId) {
          setIsSharingScreen(false);
          if (screenShareRef.current) {
            screenShareRef.current.getTracks().forEach(track => track.stop());
            screenShareRef.current = null;
            setScreenShareStream(null);
          }
        }
      }
    };

    // Add listeners
    socket.on('group_call_user_joined', handleUserJoined);
    socket.on('group_call_user_left', handleUserLeft);
    socket.on('group_call_participants', handleGroupCallParticipants);
    socket.on('group_call_participants_with_info', handleGroupCallParticipantsWithInfo);
    socket.on('receive_group_call_offer', handleGroupCallOffer);
    socket.on('receive_group_call_answer', handleGroupCallAnswer);
    socket.on('receive_group_call_ice_candidate', handleGroupCallIceCandidate);
    socket.on('group_call_screen_share_started', handleScreenShareStarted);
    socket.on('group_call_screen_share_stopped', handleScreenShareStopped);

    // Initialize call
    if (!isInitialized.current) {
      isInitialized.current = true;

      if (!isIncoming) {
        socket.emit('join_group_call', {
          callId: callData.callId,
          userId: currentUserId
        });

        socket.emit('initiate_group_call', {
          callId: callData.callId,
          groupId: callData.groupId,
          callerId: currentUserId,
          callType: callData.type,
          groupName: callData.groupName
        });

        setTimeout(() => {
          setCallStatus('calling');
        }, 1000);
      }
    }

    return () => {
      socket.off('group_call_user_joined', handleUserJoined);
      socket.off('group_call_user_left', handleUserLeft);
      socket.off('group_call_participants', handleGroupCallParticipants);
      socket.off('group_call_participants_with_info', handleGroupCallParticipantsWithInfo);
      socket.off('receive_group_call_offer', handleGroupCallOffer);
      socket.off('receive_group_call_answer', handleGroupCallAnswer);
      socket.off('receive_group_call_ice_candidate', handleGroupCallIceCandidate);
      socket.off('group_call_screen_share_started', handleScreenShareStarted);
      socket.off('group_call_screen_share_stopped', handleScreenShareStopped);
    };
  }, [socket, callData, currentUserId, isIncoming, callStatus]);

  // Get participant name - FIXED
  const getParticipantName = (userId) => {
    if (participantNames[userId]) {
      return participantNames[userId];
    }
    // If we don't have the name yet, return a formatted version
    return `User ${userId}`;
  };

  // All WebRTC functions remain exactly the same
  const createPeerConnection = async (userId, isInitiator = false) => {
    try {
      if (peerConnections.current[userId]) {

        return peerConnections.current[userId];
      }

      if (!mediaStreamRef.current) {

        return;
      }

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 10
      };

      const pc = new RTCPeerConnection(configuration);

      // Add audio track (always)
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, mediaStreamRef.current);
      }

      // Add video track if video call
      if (callData.type === 'video') {
        const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          pc.addTrack(videoTrack, mediaStreamRef.current);
        }
      }

      // Add screen share track if sharing
      if (screenShareRef.current && isSharingScreen) {
        const screenTracks = screenShareRef.current.getTracks();
        screenTracks.forEach(track => {
          pc.addTrack(track, screenShareRef.current);
        });
      }

      // Handle remote tracks
      pc.ontrack = (event) => {

        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          handleRemoteStream(userId, stream);

          // Check if this is a screen share stream
          if (event.track.kind === 'video' &&
            (event.track.label.includes('screen') ||
              event.track.label.includes('Screen') ||
              stream._id.includes('screen'))) {
            handleScreenShareStream(userId, stream);
          }
        }
      };

      // ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('group_call_ice_candidate', {
            callId: callData.callId,
            targetUserId: userId,
            candidate: event.candidate,
            senderId: currentUserId,
            callType: callData.type
          });
        }
      };

      // Connection state monitoring
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        updateConnectionState(userId, state);
      };

      pc.onconnectionstatechange = () => {
        console.log(`🔗 Connection state with ${userId}: ${pc.connectionState}`);
      };

      // Store the connection
      peerConnections.current[userId] = pc;

      // Create offer if initiator
      if (isInitiator) {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callData.type === 'video'
          });

          await pc.setLocalDescription(offer);

          socket.emit('group_call_offer', {
            callId: callData.callId,
            targetUserId: userId,
            offer: offer,
            callerId: currentUserId,
            callType: callData.type
          });


        } catch (error) {
          console.error(` Error creating offer for ${userId}:`, error);
        }
      }

      // Handle pending candidates
      if (pendingCandidates.current[userId]) {
        pendingCandidates.current[userId].forEach(candidate => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e =>
            console.error(`Error adding pending ICE candidate:`, e)
          );
        });
        delete pendingCandidates.current[userId];
      }

      return pc;

    } catch (error) {
      console.error(` Error creating peer connection to ${userId}:`, error);
      return null;
    }
  };

  const handleRemoteStream = (userId, stream) => {

    setParticipantStreams(prev => ({
      ...prev,
      [userId]: stream
    }));

    setTimeout(() => {
      const container = document.getElementById(`media-container-${userId}`);
      if (!container) return;

      // Remove existing media elements
      const existingMedia = container.querySelectorAll('video, audio');
      existingMedia.forEach(el => {
        el.srcObject = null;
        el.remove();
      });

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      if (hasVideo) {
        const video = document.createElement('video');
        video._id = `video-${userId}`;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = false;
        video.srcObject = stream;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.borderRadius = '8px';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';

        video.onloadedmetadata = () => {
          video.play().catch(e => console.log(`Video play error: ${e}`));
        };

        container.appendChild(video);
        videoRefs.current[userId] = video;

      } else if (hasAudio) {
        const audio = document.createElement('audio');
        audio._id = `audio-${userId}`;
        audio.autoplay = true;
        audio.srcObject = stream;
        audio.volume = 1.0;

        audio.onloadedmetadata = () => {
          audio.play().catch(e => console.log(`Audio play error: ${e}`));
        };

        container.appendChild(audio);
        videoRefs.current[userId] = audio;

      }
    }, 100);
  };

  const handleScreenShareStream = (userId, stream) => {


    if (screenShareVideoRef.current) {
      screenShareVideoRef.current.srcObject = stream;
      screenShareVideoRef.current.onloadedmetadata = () => {
        screenShareVideoRef.current.play().catch(e =>
          console.log('Screen share video play error:', e)
        );
      };
    }

    setActiveScreenSharer(userId);
  };

  const handleIncomingOffer = async (callerId, offer, callerSocketId, isScreenShare = false) => {
    try {

      // Close existing connection if it exists
      if (peerConnections.current[callerId]) {

        closePeerConnection(callerId);
      }

      if (!mediaStreamRef.current && !isScreenShare) {

        if (!pendingOffers.current[callerId]) {
          pendingOffers.current[callerId] = [];
        }
        pendingOffers.current[callerId].push({ offer, callerSocketId, isScreenShare });
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add local audio track
      if (mediaStreamRef.current && mediaStreamRef.current.getAudioTracks()[0]) {
        const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
        pc.addTrack(audioTrack, mediaStreamRef.current);
      }

      // Add local video track for video calls
      if (callData.type === 'video' && mediaStreamRef.current && mediaStreamRef.current.getVideoTracks()[0]) {
        const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
        pc.addTrack(videoTrack, mediaStreamRef.current);
      }

      pc.ontrack = (event) => {

        if (event.streams && event.streams[0]) {
          if (isScreenShare) {
            handleScreenShareStream(callerId, event.streams[0]);
          } else {
            handleRemoteStream(callerId, event.streams[0]);
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('group_call_ice_candidate', {
            callId: callData.callId,
            targetUserId: callerId,
            candidate: event.candidate,
            senderId: currentUserId,
            callType: callData.type
          });
        }
      };

      peerConnections.current[callerId] = pc;

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('group_call_answer', {
        callId: callData.callId,
        callerSocketId: callerSocketId,
        answer: answer,
        responderId: currentUserId,
        callType: callData.type,
        isScreenShare
      });

    } catch (error) {
      console.error(` Error handling offer from ${callerId}:`, error);
    }
  };

  const handleIncomingAnswer = async (responderId, answer, isScreenShare = false) => {
    try {
      const pc = peerConnections.current[responderId];

      if (!pc) {

        return;
      }

      if (pc.signalingState === 'stable') {

        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));

    } catch (error) {
      console.error(` Error handling answer from ${responderId}:`, error);
    }
  };

  const handleIncomingIceCandidate = async (senderId, candidate) => {
    try {
      const pc = peerConnections.current[senderId];

      if (!pc) {

        if (!pendingCandidates.current[senderId]) {
          pendingCandidates.current[senderId] = [];
        }
        pendingCandidates.current[senderId].push(candidate);
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));

      ringtoneService.stop();

    } catch (error) {
      console.error(` Error adding ICE candidate from ${senderId}:`, error);
    }
  };

  // Fix startScreenSharing function
const startScreenSharing = async () => {
  try {
    console.log('🖥️ Starting screen sharing...');
    
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor'
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    screenShareRef.current = screenStream;
    setScreenShareStream(screenStream);
    setIsSharingScreen(true);
    
    // Set ourselves as the active screen sharer immediately
    setActiveScreenSharer(currentUserId);
    
    console.log('✅ Screen share stream acquired');

    // Notify server and other participants
    socket.emit('group_call_start_screen_share', {
      callId: callData.callId,
      userId: currentUserId,
      hasAudio: screenStream.getAudioTracks().length > 0,
      hasVideo: true
    });

    console.log('📤 Notified server about screen share start');

    // Send screen share stream to all existing participants
    participants.forEach(userId => {
      const pc = peerConnections.current[userId];
      if (pc) {
        const screenTracks = screenStream.getTracks();
        screenTracks.forEach(track => {
          const sender = pc.getSenders().find(s =>
            s.track && s.track.kind === track.kind
          );
          if (sender && sender.track) {
            // Replace existing track of same kind
            sender.replaceTrack(track);
            console.log(`🔄 Replaced ${track.kind} track for user ${userId}`);
          } else {
            // Add new track if no sender exists for this kind
            pc.addTrack(track, screenStream);
            console.log(`➕ Added ${track.kind} track for user ${userId}`);
          }
        });

        // Renegotiate if needed
        const hasVideoSender = pc.getSenders().some(s => s.track && s.track.kind === 'video');
        if (callData.type !== 'video' && hasVideoSender) {
          console.log(`🔄 Renegotiating for voice call with video`);
          pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
              socket.emit('group_call_offer', {
                callId: callData.callId,
                targetUserId: userId,
                offer: pc.localDescription,
                callerId: currentUserId,
                callType: callData.type,
                isScreenShare: true
              });
            })
            .catch(err => console.error('Error renegotiating for screen share:', err));
        }
      }
    });

    // Handle when user stops screen sharing via browser controls
    screenStream.getVideoTracks()[0].onended = () => {
      console.log('🖥️ Screen share ended via browser controls');
      stopScreenSharing();
    };

    console.log('✅ Screen sharing started successfully');

  } catch (error) {
    console.error('❌ Failed to start screen sharing:', error);
    // Reset states on error
    setIsSharingScreen(false);
    setActiveScreenSharer(null);
  }
};

const stopScreenSharing = async () => {
  console.log('🛑 STOPPING SCREEN SHARE - Debug Info:', {
    isSharingScreen,
    activeScreenSharer,
    currentUserId,
    hasScreenShareStream: !!screenShareRef.current
  });

  // Always clear active screen sharer if it's us
  if (activeScreenSharer === currentUserId) {
    console.log('✅ Clearing our screen share status');
    setActiveScreenSharer(null);
    setIsSharingScreen(false);
  }

  // Stop the screen share stream if it exists
  if (screenShareRef.current) {
    console.log('🛑 Stopping screen share tracks');
    screenShareRef.current.getTracks().forEach(track => {
      console.log(` Stopping track: ${track.kind} (${track.label})`);
      track.stop();
      track.enabled = false;
    });
    screenShareRef.current = null;
    setScreenShareStream(null);
  }

  // Clear the screen share video element
  if (screenShareVideoRef.current) {
    screenShareVideoRef.current.srcObject = null;
    console.log('✅ Cleared screen share video element');
  }

  // Notify server and other participants
  if (socket) {
    console.log('📤 Notifying server screen share stopped');
    socket.emit('group_call_stop_screen_share', {
      callId: callData.callId,
      userId: currentUserId,
      timestamp: Date.now()
    });
  }

  // For voice calls, we need to renegotiate connections without video
  if (callData.type === 'voice') {
    console.log('🔊 Voice call - renegotiating connections without video');
    
    participants.forEach(userId => {
      const pc = peerConnections.current[userId];
      if (pc) {
        // Remove any video senders
        const videoSender = pc.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (videoSender) {
          console.log(`🔄 Removing video sender for user ${userId}`);
          videoSender.replaceTrack(null);
          
          // Renegotiate the connection
          setTimeout(() => {
            pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: false // Don't receive video for voice call
            })
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
              if (socket) {
                socket.emit('group_call_offer', {
                  callId: callData.callId,
                  targetUserId: userId,
                  offer: pc.localDescription,
                  callerId: currentUserId,
                  callType: callData.type
                });
              }
            })
            .catch(err => console.error('Error renegotiating:', err));
          }, 100);
        }
      }
    });
  }

  console.log('✅ Screen sharing stopped completely');
};

  const joinGroupCall = () => {
    if (!socket) return;

    socket.emit('join_group_call', {
      callId: callData.callId,
      userId: currentUserId
    });

    socket.emit('get_group_call_participants', {
      callId: callData.callId
    });
  };

  const updateConnectionState = (userId, state) => {
    setConnectionStates(prev => ({
      ...prev,
      [userId]: state
    }));
  };

  const removeParticipant = (userId) => {
    setParticipants(prev => prev.filter(id => id !== userId));
    setParticipantStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[userId];
      return newStreams;
    });
    setParticipantNames(prev => {
      const newNames = { ...prev };
      delete newNames[userId];
      return newNames;
    });
  };

  const closePeerConnection = (userId) => {
    const pc = peerConnections.current[userId];
    if (pc) {
      pc.close();
      delete peerConnections.current[userId];
    }

    const video = videoRefs.current[userId];
    if (video) {
      video.srcObject = null;
      video.remove();
      delete videoRefs.current[userId];
    }

    if (pendingCandidates.current[userId]) {
      delete pendingCandidates.current[userId];
    }

    if (pendingOffers.current[userId]) {
      delete pendingOffers.current[userId];
    }

    updateConnectionState(userId, 'closed');
  };

const cleanup = () => {
  console.log('🧹 Cleaning up group call...');
  
  // Stop screen sharing if active
  if (isSharingScreen) {
    console.log('🖥️ Stopping screen share during cleanup');
    stopScreenSharing();
  }

  // Close all peer connections
  Object.keys(peerConnections.current).forEach(userId => {
    console.log(`🔌 Closing connection to ${userId}`);
    closePeerConnection(userId);
  });
  peerConnections.current = {};

  // Stop local media streams
  if (mediaStreamRef.current) {
    console.log('🎤 Stopping local media stream');
    mediaStreamRef.current.getTracks().forEach(track => {
      track.stop();
    });
    mediaStreamRef.current = null;
    setLocalStream(null);
  }

  // Stop screen share stream
  if (screenShareRef.current) {
    console.log('🖥️ Stopping screen share stream');
    screenShareRef.current.getTracks().forEach(track => track.stop());
    screenShareRef.current = null;
    setScreenShareStream(null);
  }

  // Clear video elements
  Object.keys(videoRefs.current).forEach(userId => {
    const video = videoRefs.current[userId];
    if (video) {
      video.srcObject = null;
      video.remove();
    }
  });
  videoRefs.current = {};

  // Clear refs and state
  pendingCandidates.current = {};
  pendingOffers.current = {};

  setParticipants([]);
  setParticipantStreams({});
  setConnectionStates({});
  setActiveScreenSharer(null);
  setCallTimer(0);
  callStartTime.current = null;
  
  console.log('✅ Cleanup complete');
};

  const acceptCall = async () => {
    setCallStatus('active');
    callStartTime.current = new Date();

    Object.keys(pendingOffers.current).forEach(callerId => {
      const offers = pendingOffers.current[callerId];
      offers.forEach(async (offerData) => {
        await handleIncomingOffer(callerId, offerData.offer, offerData.callerSocketId, offerData.isScreenShare);
      });
    });
    pendingOffers.current = {};

    joinGroupCall();

    if (onAcceptCall) {
      onAcceptCall();
    }
  };

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (mediaStreamRef.current && callData.type === 'video') {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s =>
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
      }
    }
  };

  // Update handleEndCall function
  const handleEndCall = () => {
    console.log('📞 Handle End Call - Debug Info:');
    console.log('Current User ID:', currentUserId);
    console.log('Call Data:', callData);
    console.log('Participants:', participants);
    console.log('Total Participants:', participants.length + 1);
    
    const totalParticipants = participants.length + 1;
    const isOnlyParticipant = participants.length === 0;
    const isTwoParticipants = participants.length === 1;
    
    console.log('Total Participants:', totalParticipants);
    console.log('Is Only Participant:', isOnlyParticipant);
    console.log('Is Two Participants:', isTwoParticipants);
    
    if (socket) {
      const eventName = callData.type === 'video' ? 'group_video_call_end' : 'group_voice_call_end';
      
      let shouldEndForEveryone = false;
      
      if (isTwoParticipants) {
        shouldEndForEveryone = true;
        console.log('🚨 Only 2 participants - ending call for everyone');
      } else if (currentUserId === callData.callerId) {
        shouldEndForEveryone = true;
        console.log('👑 We are the caller - ending call for everyone');
      } else if (isOnlyParticipant) {
        shouldEndForEveryone = true;
        console.log('🚨 No other participants - ending call');
      }
      
      console.log('Should end for everyone:', shouldEndForEveryone);
      
      socket.emit(eventName, {
        callId: callData.callId,
        groupId: callData.groupId,
        userId: currentUserId,
        isCaller: currentUserId === callData.callerId,
        shouldEndForEveryone: shouldEndForEveryone
      });

      socket.emit('leave_group_call', {
        callId: callData.callId,
        userId: currentUserId,
        forceEnd: shouldEndForEveryone
      });
    }

    cleanup();
    
    if (onEndCall) {
      console.log('Calling onEndCall callback');
      onEndCall();
    }
  };

    // INCOMING CALL UI
  if (isIncoming && callStatus === 'ringing' && !isMinimized) {
    return (
      <div className="fixed top-6 right-6 z-50 animate-fade-in">
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl p-6 w-96 border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {callData.groupName || 'Group Call'}
                </h3>
                <p className="text-gray-400 text-sm flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  Incoming {callData.type === 'video' ? 'Video' : 'Voice'} Group Call
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
                {callData.type === 'video' && localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-gray-400">Group Preview</p>
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-sm text-center">
                {callData.type === 'video' ? 'Your preview' : 'Group audio call'}
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onRejectCall || endCall}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
            >
              <PhoneOff className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              <span>Decline</span>
            </button>
            <button
              onClick={acceptCall}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
            >
              <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Join Group</span>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between text-gray-400 text-sm">
              <span>Call Type</span>
              <span className="text-white">
                {callData.type === 'video' ? '🎥 Video' : '🔊 Voice'} Group Call
              </span>
            </div>
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
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">
                  Incoming {callData.type === 'video' ? 'Video' : 'Voice'}
                </p>
                <p className="text-gray-400 text-xs">Group Call</p>
              </div>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={acceptCall}
                className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                <Users className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={onRejectCall || endCall}
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

  // Update the participant display in the return statement
  // ACTIVE GROUP CALL UI
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-black flex flex-col z-50">
      {/* Top Bar */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${callStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <div>
              <h1 className="text-white font-semibold text-lg">
                {callData.groupName || 'Group Call'}
              </h1>
              <div className="flex items-center space-x-2 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>{formatTime(callTimer)}</span>
                <span>•</span>
                <span>{participants.length + 1} participants</span>
                <span>•</span>
                <span>{callData.type === 'video' ? '🎥 Video' : '🔊 Voice'}</span>
                {activeScreenSharer && (
                  <>
                    <span>•</span>
                    <span className="text-blue-400 flex items-center">
                      <ScreenShare className="w-4 h-4 mr-1" />
                      Screen Sharing
                    </span>
                  </>
                )}
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
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Screen Share Display */}
          {activeScreenSharer && (
            <div className="mb-6 bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden animate-fade-in">
              <div className="p-4 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ScreenShare className="w-5 h-5 text-blue-400" />
                  <span className="text-white font-medium">
                    {getParticipantName(activeScreenSharer)} is sharing screen
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {activeScreenSharer === currentUserId && (
                    <button
                      onClick={stopScreenSharing}
                      className="text-red-400 hover:text-red-300 text-sm font-medium px-3 py-1 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      Stop Sharing
                    </button>
                  )}
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="p-4 bg-black">
                <div className="relative">
                  {/* Video or Audio indicator */}
                  {callData.type === 'video' ? (
                    <video
                      ref={screenShareVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-96 object-contain rounded-lg bg-black"
                      onError={(e) => console.error('Screen share video error:', e)}
                    />
                  ) : (
                    <div className="w-full h-96 flex flex-col items-center justify-center bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-lg">
                      <ScreenShare className="w-20 h-20 text-blue-400 mb-4" />
                      <p className="text-blue-400 font-medium text-lg mb-2">Screen Sharing Active</p>
                      <p className="text-gray-400">
                        {getParticipantName(activeScreenSharer)} is sharing their screen
                      </p>
                      <div className="mt-4 flex items-center space-x-2 text-gray-500 text-sm">
                        <ScreenShare className="w-4 h-4" />
                        <span>Voice call - Screen content not visible</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Participants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Local User */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden h-64">
              <div className="p-3 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${localStream ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-white font-medium">You</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {isMuted && (
                      <div className="bg-red-500/20 px-2 py-1 rounded text-xs text-red-400">
                        Muted
                      </div>
                    )}
                    {isSharingScreen && (
                      <div className="bg-blue-500/20 px-2 py-1 rounded text-xs text-blue-400">
                        Sharing
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 h-full flex flex-col">
                {callData.type === 'video' ? (
                  <div className="relative flex-1 bg-black rounded-lg overflow-hidden">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!isVideoEnabled && (
                      <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
                        <VideoOff className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-lg p-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-white font-medium">You</span>
                    <div className="flex items-center space-x-2 mt-2">
                      {isMuted ? (
                        <MicOff className="w-4 h-4 text-red-400" />
                      ) : (
                        <Mic className="w-4 h-4 text-green-400" />
                      )}
                      {isSharingScreen && (
                        <ScreenShare className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Remote Participants */}
            {participants.map(userId => (
              <div key={userId} className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden h-64">
                <div className="p-3 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${participantStreams[userId] ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className="text-white font-medium truncate">
                        {getParticipantName(userId)}
                      </span>
                    </div>
                    {activeScreenSharer === userId && (
                      <div className="flex items-center space-x-1 bg-blue-500/20 px-2 py-1 rounded text-xs text-blue-400 animate-pulse">
                        <ScreenShare className="w-3 h-3" />
                        <span>Sharing</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 h-full flex flex-col">
                  <div
                    id={`media-container-${userId}`}
                    className={`relative flex-1 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-lg overflow-hidden flex items-center justify-center`}
                  >
                    {callData.type === 'video' ? (
                      !participantStreams[userId] && (
                        <div className="text-center p-4">
                          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
                            <User className="w-6 h-6 text-gray-400" />
                          </div>
                          <p className="text-gray-400 text-sm">
                            {connectionStates[userId] === 'connected' ? 'Connected' : 'Connecting...'}
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="text-center p-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${connectionStates[userId] === 'connected' ? 'bg-green-500/20 border border-green-500/30' :
                          connectionStates[userId] === 'connecting' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                            'bg-gray-700'
                          }`}>
                          <User className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-gray-300 font-medium mb-1">{getParticipantName(userId)}</p>
                        <p className="text-gray-400 text-xs">
                          {participantStreams[userId] ?
                            (connectionStates[userId] === 'connected' ? 'Speaking' : 'Connected') :
                            (connectionStates[userId] || 'Connecting...')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Call Info */}
            <div className="lg:w-64 bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
              <h3 className="text-white font-semibold text-lg mb-4">Call Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Duration</span>
                  <span className="text-white font-mono">{formatTime(callTimer)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Participants</span>
                  <span className="text-white">{participants.length + 1}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Type</span>
                  <span className={`${callData.type === 'video' ? 'text-blue-400' : 'text-green-400'}`}>
                    {callData.type === 'video' ? '🎥 Video Group' : '🔊 Voice Group'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status</span>
                  <span className={`${callStatus === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {callStatus === 'active' ? 'Active' : 'Connecting...'}
                  </span>
                </div>
              </div>

              {/* Active Screen Share Indicator */}
              {activeScreenSharer && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center space-x-3">
                    <ScreenShare className="w-5 h-5 text-blue-400 animate-pulse" />
                    <div>
                      <p className="text-blue-400 font-medium">Active Screen Share</p>
                      <p className="text-blue-400/70 text-sm">
                        {getParticipantName(activeScreenSharer)} is sharing
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex-1">
              <div className="flex justify-center items-center space-x-6">
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <MicOff className="w-6 h-6" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>

                {callData.type === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoEnabled
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                    title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isVideoEnabled ? (
                      <Video className="w-6 h-6" />
                    ) : (
                      <VideoOff className="w-6 h-6" />
                    )}
                  </button>
                )}

                <button
                  onClick={isSharingScreen ? stopScreenSharing : startScreenSharing}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isSharingScreen
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  title={isSharingScreen ? 'Stop sharing screen' : 'Share screen'}
                >
                  {isSharingScreen ? (
                    <ScreenShareOff className="w-6 h-6" />
                  ) : (
                    <ScreenShare className="w-6 h-6" />
                  )}
                </button>

                <button
                  onClick={handleEndCall}
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/25"
                  title="Leave group call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// // 'use client';

// // import { useState, useEffect, useRef } from 'react';
// // import {
// //   Mic,
// //   MicOff,
// //   Video,
// //   VideoOff,
// //   ScreenShare,
// //   ScreenShareOff,
// //   PhoneOff,
// //   Users,
// //   Clock,
// //   User,
// //   Maximize2,
// //   Minimize2
// // } from 'lucide-react';
// // import { ringtoneService } from '@/lib/ringtone-service';

// // export default function GroupCall({
// //   callData,
// //   socket,
// //   currentUserId,
// //   onEndCall,
// //   onAcceptCall,
// //   onRejectCall,
// //   isIncoming = false
// // }) {
// //   const [participants, setParticipants] = useState([]);
// //   const [participantNames, setParticipantNames] = useState({});
// //   const [localStream, setLocalStream] = useState(null);
// //   const [screenShareStream, setScreenShareStream] = useState(null);
// //   const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
// //   const [isMuted, setIsMuted] = useState(false);
// //   const [isVideoEnabled, setIsVideoEnabled] = useState(callData.type === 'video');
// //   const [isSharingScreen, setIsSharingScreen] = useState(false);
// //   const [activeScreenSharer, setActiveScreenSharer] = useState(null);
// //   const [connectionStates, setConnectionStates] = useState({});
// //   const [participantStreams, setParticipantStreams] = useState({});
// //   const [callTimer, setCallTimer] = useState(0);
// //   const [isMinimized, setIsMinimized] = useState(false);
// //   const [screenShareView, setScreenShareView] = useState('big');
// //   const [screenShareStatus, setScreenShareStatus] = useState('idle');

// //   const peerConnections = useRef({});
// //   const mediaStreamRef = useRef(null);
// //   const screenShareRef = useRef(null);
// //   const localVideoRef = useRef(null);
// //   const screenShareVideoRef = useRef(null);
// //   const videoRefs = useRef({});
// //   const pendingOffers = useRef({});
// //   const pendingCandidates = useRef({});
// //   const isInitialized = useRef(false);
// //   const callStartTime = useRef(null);
// //   const timerInterval = useRef(null);
// //   const screenShareConnection = useRef(null);

// //   // Timer effect
// //   useEffect(() => {
// //     if (callStatus === 'active' && callStartTime.current) {
// //       timerInterval.current = setInterval(() => {
// //         const seconds = Math.floor((new Date() - callStartTime.current) / 1000);
// //         setCallTimer(seconds);
// //       }, 1000);
// //     } else {
// //       if (timerInterval.current) {
// //         clearInterval(timerInterval.current);
// //         timerInterval.current = null;
// //       }
// //     }

// //     return () => {
// //       if (timerInterval.current) {
// //         clearInterval(timerInterval.current);
// //         timerInterval.current = null;
// //       }
// //     };
// //   }, [callStatus]);

// //   const formatTime = (seconds) => {
// //     if (!seconds) return '00:00';
// //     const mins = Math.floor(seconds / 60);
// //     const secs = seconds % 60;
// //     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
// //   };

// //   // Initialize media
// //   useEffect(() => {
// //     const initializeMedia = async () => {
// //       try {
// //         const constraints = {
// //           audio: {
// //             echoCancellation: true,
// //             noiseSuppression: true,
// //             autoGainControl: true,
// //             channelCount: 1,
// //             sampleRate: 48000
// //           },
// //           video: callData.type === 'video' ? {
// //             width: { ideal: 640 },
// //             height: { ideal: 480 },
// //             frameRate: { ideal: 30 },
// //             facingMode: 'user'
// //           } : false
// //         };

// //         const stream = await navigator.mediaDevices.getUserMedia(constraints);
// //         mediaStreamRef.current = stream;
// //         setLocalStream(stream);

// //         if (localVideoRef.current && callData.type === 'video') {
// //           localVideoRef.current.srcObject = stream;
// //           localVideoRef.current.muted = true;
// //         }

// //         if (!isIncoming || callStatus === 'active') {
// //           joinGroupCall();
// //         }

// //       } catch (error) {
// //         console.error('Failed to get media:', error);
// //       }
// //     };

// //     if (!mediaStreamRef.current) {
// //       initializeMedia();
// //     }

// //     return () => {
// //       cleanup();
// //     };
// //   }, [callData.type, isIncoming]);

// //   // Socket listeners
// //   useEffect(() => {
// //     if (!socket || !callData) return;

// //     const handleUserJoined = async (data) => {
// //       if (data.userId === currentUserId) return;

// //       setParticipants(prev => {
// //         if (!prev.includes(data.userId)) {
// //           return [...prev, data.userId];
// //         }
// //         return prev;
// //       });

// //       if (data.userName) {
// //         setParticipantNames(prev => ({
// //           ...prev,
// //           [data.userId]: data.userName
// //         }));
// //       }

// //       if (mediaStreamRef.current) {
// //         await createPeerConnection(data.userId, true);
// //       }
// //     };

// //     const handleUserLeft = (data) => {
// //       removeParticipant(data.userId);
// //       closePeerConnection(data.userId);

// //       if (activeScreenSharer === data.userId) {
// //         setActiveScreenSharer(null);
// //         setScreenShareView('big');
// //       }
// //     };

// //     const handleGroupCallParticipants = (data) => {
// //       const otherParticipants = data.participants.filter(
// //         id => id !== currentUserId
// //       );

// //       setParticipants(otherParticipants);

// //       otherParticipants.forEach(userId => {
// //         setTimeout(async () => {
// //           if (mediaStreamRef.current) {
// //             await createPeerConnection(userId, true);
// //           }
// //         }, 500);
// //       });
// //     };

// //     const handleGroupCallParticipantsWithInfo = (data) => {
// //       const otherParticipants = data.participants.filter(
// //         p => p.userId !== currentUserId
// //       );

// //       setParticipants(otherParticipants.map(p => p.userId));
      
// //       const names = {};
// //       otherParticipants.forEach(p => {
// //         if (p.userName) {
// //           names[p.userId] = p.userName;
// //         }
// //       });
// //       setParticipantNames(names);

// //       otherParticipants.forEach(p => {
// //         setTimeout(async () => {
// //           if (mediaStreamRef.current) {
// //             await createPeerConnection(p.userId, true);
// //           }
// //         }, 500);
// //       });
// //     };

// //     const handleGroupCallOffer = async (data) => {
// //       console.log('📞 Received group call offer:', {
// //         callerId: data.callerId,
// //         isScreenShare: data.isScreenShare,
// //         hasVideo: data.offer.sdp.includes('m=video')
// //       });

// //       if (isIncoming && callStatus === 'ringing') {
// //         if (!pendingOffers.current[data.callerId]) {
// //           pendingOffers.current[data.callerId] = [];
// //         }
// //         pendingOffers.current[data.callerId].push(data);
// //         return;
// //       }

// //       await handleIncomingOffer(data.callerId, data.offer, data.callerSocketId, data.isScreenShare);
// //     };

// //     const handleGroupCallAnswer = async (data) => {
// //       ringtoneService.stop();
// //       await handleIncomingAnswer(data.responderId, data.answer, data.isScreenShare);
// //     };

// //     const handleGroupCallIceCandidate = async (data) => {
// //       await handleIncomingIceCandidate(data.senderId, data.candidate);
// //     };

// //     const handleScreenShareStarted = async (data) => {
// //       console.log('🖥️ Screen share started by:', data.userId);
// //       console.log('Screen share event data:', data);
      
// //       if (data.userId !== currentUserId) {
// //         setActiveScreenSharer(data.userId);
// //         setScreenShareStatus('waiting');
        
// //         // Request screen share offer from the sharer
// //         socket.emit('request_screen_share_offer', {
// //           callId: callData.callId,
// //           requesterId: currentUserId,
// //           sharerId: data.userId
// //         });
        
// //         console.log('📤 Requested screen share offer from:', data.userId);
// //       }
// //     };

// //     const handleScreenShareStopped = (data) => {
// //       console.log('🛑 Screen share stopped by:', data.userId);
      
// //       if (data.userId === activeScreenSharer || data.forceClear) {
// //         setActiveScreenSharer(null);
// //         setScreenShareView('big');
// //         setScreenShareStatus('idle');
        
// //         if (screenShareVideoRef.current) {
// //           screenShareVideoRef.current.srcObject = null;
// //         }
        
// //         if (data.userId === currentUserId) {
// //           setIsSharingScreen(false);
// //           if (screenShareRef.current) {
// //             screenShareRef.current.getTracks().forEach(track => track.stop());
// //             screenShareRef.current = null;
// //             setScreenShareStream(null);
// //           }
// //         }
        
// //         // Close screen share connection
// //         if (screenShareConnection.current) {
// //           screenShareConnection.current.close();
// //           screenShareConnection.current = null;
// //         }
// //       }
// //     };

// //     // New handler for screen share offer
// //     const handleScreenShareOffer = async (data) => {
// //       console.log('🎯 Received screen share offer:', {
// //         sharerId: data.sharerId,
// //         offer: data.offer
// //       });
      
// //       if (data.sharerId === currentUserId) return;
      
// //       await handleScreenShareIncomingOffer(data.sharerId, data.offer);
// //     };

// //     // Add listeners
// //     socket.on('group_call_user_joined', handleUserJoined);
// //     socket.on('group_call_user_left', handleUserLeft);
// //     socket.on('group_call_participants', handleGroupCallParticipants);
// //     socket.on('group_call_participants_with_info', handleGroupCallParticipantsWithInfo);
// //     socket.on('receive_group_call_offer', handleGroupCallOffer);
// //     socket.on('receive_group_call_answer', handleGroupCallAnswer);
// //     socket.on('receive_group_call_ice_candidate', handleGroupCallIceCandidate);
// //     socket.on('group_call_screen_share_started', handleScreenShareStarted);
// //     socket.on('group_call_screen_share_stopped', handleScreenShareStopped);
// //     socket.on('screen_share_offer', handleScreenShareOffer);

// //     if (!isInitialized.current) {
// //       isInitialized.current = true;

// //       if (!isIncoming) {
// //         socket.emit('join_group_call', {
// //           callId: callData.callId,
// //           userId: currentUserId
// //         });

// //         socket.emit('initiate_group_call', {
// //           callId: callData.callId,
// //           groupId: callData.groupId,
// //           callerId: currentUserId,
// //           callType: callData.type,
// //           groupName: callData.groupName
// //         });

// //         setTimeout(() => {
// //           setCallStatus('calling');
// //         }, 1000);
// //       }
// //     }

// //     return () => {
// //       socket.off('group_call_user_joined', handleUserJoined);
// //       socket.off('group_call_user_left', handleUserLeft);
// //       socket.off('group_call_participants', handleGroupCallParticipants);
// //       socket.off('group_call_participants_with_info', handleGroupCallParticipantsWithInfo);
// //       socket.off('receive_group_call_offer', handleGroupCallOffer);
// //       socket.off('receive_group_call_answer', handleGroupCallAnswer);
// //       socket.off('receive_group_call_ice_candidate', handleGroupCallIceCandidate);
// //       socket.off('group_call_screen_share_started', handleScreenShareStarted);
// //       socket.off('group_call_screen_share_stopped', handleScreenShareStopped);
// //       socket.off('screen_share_offer', handleScreenShareOffer);
// //     };
// //   }, [socket, callData, currentUserId, isIncoming, callStatus]);

// //   const getParticipantName = (userId) => {
// //     if (participantNames[userId]) {
// //       return participantNames[userId];
// //     }
// //     return `User ${userId}`;
// //   };

// //   const createPeerConnection = async (userId, isInitiator = false) => {
// //     try {
// //       if (peerConnections.current[userId]) {
// //         return peerConnections.current[userId];
// //       }

// //       if (!mediaStreamRef.current) {
// //         return;
// //       }

// //       const configuration = {
// //         iceServers: [
// //           { urls: 'stun:stun.l.google.com:19302' },
// //           { urls: 'stun:stun1.l.google.com:19302' },
// //           { urls: 'stun:stun2.l.google.com:19302' },
// //           { urls: 'stun:stun3.l.google.com:19302' },
// //           { urls: 'stun:stun4.l.google.com:19302' }
// //         ],
// //         iceTransportPolicy: 'all',
// //         bundlePolicy: 'max-bundle',
// //         rtcpMuxPolicy: 'require',
// //         iceCandidatePoolSize: 10
// //       };

// //       const pc = new RTCPeerConnection(configuration);

// //       // Add audio track
// //       const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
// //       if (audioTrack) {
// //         pc.addTrack(audioTrack, mediaStreamRef.current);
// //       }

// //       // Add video track if video call
// //       if (callData.type === 'video') {
// //         const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
// //         if (videoTrack) {
// //           pc.addTrack(videoTrack, mediaStreamRef.current);
// //         }
// //       }

// //       // Add screen share track if we're sharing
// //       if (screenShareRef.current && isSharingScreen) {
// //         const screenTracks = screenShareRef.current.getTracks();
// //         screenTracks.forEach(track => {
// //           pc.addTrack(track, screenShareRef.current);
// //         });
// //       }

// //       // Handle remote tracks
// //       pc.ontrack = (event) => {
// //         console.log(`🎥 Received track from ${userId}:`, {
// //           trackKind: event.track.kind,
// //           trackLabel: event.track.label,
// //           streamId: event.streams[0]?.id,
// //           streams: event.streams.length
// //         });

// //         if (event.streams && event.streams[0]) {
// //           const stream = event.streams[0];
          
// //           // Check if this is a screen share stream
// //           const isScreenShare = event.track.kind === 'video' &&
// //             (event.track.label.includes('screen') ||
// //              event.track.label.includes('Screen') ||
// //              stream.id.includes('screen'));

// //           console.log(`Is screen share: ${isScreenShare}`, {
// //             label: event.track.label,
// //             streamId: stream.id
// //           });

// //           if (isScreenShare) {
// //             console.log(`🖥️ Screen share stream received from ${userId}`);
// //             handleScreenShareStream(userId, stream);
// //           } else {
// //             handleRemoteStream(userId, stream);
// //           }
// //         }
// //       };

// //       // ICE candidate handling
// //       pc.onicecandidate = (event) => {
// //         if (event.candidate && socket) {
// //           socket.emit('group_call_ice_candidate', {
// //             callId: callData.callId,
// //             targetUserId: userId,
// //             candidate: event.candidate,
// //             senderId: currentUserId,
// //             callType: callData.type
// //           });
// //         }
// //       };

// //       // Connection state monitoring
// //       pc.oniceconnectionstatechange = () => {
// //         const state = pc.iceConnectionState;
// //         updateConnectionState(userId, state);
// //       };

// //       peerConnections.current[userId] = pc;

// //       // Create offer if initiator
// //       if (isInitiator) {
// //         try {
// //           const offer = await pc.createOffer({
// //             offerToReceiveAudio: true,
// //             offerToReceiveVideo: callData.type === 'video' || isSharingScreen // Always receive video for screen share
// //           });

// //           await pc.setLocalDescription(offer);

// //           socket.emit('group_call_offer', {
// //             callId: callData.callId,
// //             targetUserId: userId,
// //             offer: offer,
// //             callerId: currentUserId,
// //             callType: callData.type,
// //             isScreenShare: isSharingScreen
// //           });

// //         } catch (error) {
// //           console.error(`Error creating offer for ${userId}:`, error);
// //         }
// //       }

// //       // Handle pending candidates
// //       if (pendingCandidates.current[userId]) {
// //         pendingCandidates.current[userId].forEach(candidate => {
// //           pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e =>
// //             console.error(`Error adding pending ICE candidate:`, e)
// //           );
// //         });
// //         delete pendingCandidates.current[userId];
// //       }

// //       return pc;

// //     } catch (error) {
// //       console.error(`Error creating peer connection to ${userId}:`, error);
// //       return null;
// //     }
// //   };

// //   const handleRemoteStream = (userId, stream) => {
// //     console.log(`📹 Remote stream from ${userId}:`, {
// //       audioTracks: stream.getAudioTracks().length,
// //       videoTracks: stream.getVideoTracks().length,
// //       streamId: stream.id
// //     });

// //     setParticipantStreams(prev => ({
// //       ...prev,
// //       [userId]: stream
// //     }));

// //     setTimeout(() => {
// //       const container = document.getElementById(`media-container-${userId}`);
// //       if (!container) return;

// //       const existingMedia = container.querySelectorAll('video, audio');
// //       existingMedia.forEach(el => {
// //         el.srcObject = null;
// //         el.remove();
// //       });

// //       const hasVideo = stream.getVideoTracks().length > 0;
// //       const hasAudio = stream.getAudioTracks().length > 0;

// //       if (hasVideo) {
// //         const video = document.createElement('video');
// //         video.id = `video-${userId}`;
// //         video.autoplay = true;
// //         video.playsInline = true;
// //         video.muted = false;
// //         video.srcObject = stream;
// //         video.style.width = '100%';
// //         video.style.height = '100%';
// //         video.style.objectFit = 'cover';
// //         video.style.borderRadius = '8px';

// //         video.onloadedmetadata = () => {
// //           video.play().catch(e => console.log(`Video play error: ${e}`));
// //         };

// //         container.appendChild(video);
// //         videoRefs.current[userId] = video;

// //       } else if (hasAudio) {
// //         const audio = document.createElement('audio');
// //         audio.id = `audio-${userId}`;
// //         audio.autoplay = true;
// //         audio.srcObject = stream;
// //         audio.volume = 1.0;

// //         audio.onloadedmetadata = () => {
// //           audio.play().catch(e => console.log(`Audio play error: ${e}`));
// //         };

// //         container.appendChild(audio);
// //         videoRefs.current[userId] = audio;
// //       }
// //     }, 100);
// //   };

// //   const handleScreenShareStream = (userId, stream) => {
// //     console.log(`🎬 Setting screen share stream from ${userId}:`, stream);
    
// //     setActiveScreenSharer(userId);
// //     setScreenShareStatus('active');
    
// //     if (screenShareVideoRef.current) {
// //       console.log('🎯 Setting screen share video element source');
// //       screenShareVideoRef.current.srcObject = stream;
      
// //       screenShareVideoRef.current.onloadedmetadata = () => {
// //         console.log('✅ Screen share video metadata loaded');
// //         screenShareVideoRef.current.play().catch(e => {
// //           console.log('❌ Screen share video play error:', e);
// //         });
// //       };
      
// //       screenShareVideoRef.current.onplaying = () => {
// //         console.log('▶️ Screen share video started playing');
// //         setScreenShareStatus('playing');
// //       };
      
// //       screenShareVideoRef.current.onerror = (e) => {
// //         console.error('❌ Screen share video error:', e);
// //         setScreenShareStatus('error');
// //       };
// //     } else {
// //       console.log('❌ Screen share video ref not available');
// //     }
// //   };

// //   const handleScreenShareIncomingOffer = async (sharerId, offer) => {
// //     console.log('🖥️ Handling screen share incoming offer from:', sharerId);
    
// //     try {
// //       // Close existing screen share connection if any
// //       if (screenShareConnection.current) {
// //         screenShareConnection.current.close();
// //       }

// //       const configuration = {
// //         iceServers: [
// //           { urls: 'stun:stun.l.google.com:19302' },
// //           { urls: 'stun:stun1.l.google.com:19302' }
// //         ]
// //       };

// //       const pc = new RTCPeerConnection(configuration);
// //       screenShareConnection.current = pc;

// //       // Add audio track from our mic
// //       if (mediaStreamRef.current && mediaStreamRef.current.getAudioTracks()[0]) {
// //         const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
// //         pc.addTrack(audioTrack, mediaStreamRef.current);
// //       }

// //       pc.ontrack = (event) => {
// //         console.log('🖥️ Screen share track received:', {
// //           trackKind: event.track.kind,
// //           trackLabel: event.track.label,
// //           streamId: event.streams[0]?.id
// //         });

// //         if (event.streams && event.streams[0]) {
// //           console.log('✅ Screen share stream available');
// //           handleScreenShareStream(sharerId, event.streams[0]);
// //         }
// //       };

// //       pc.onicecandidate = (event) => {
// //         if (event.candidate && socket) {
// //           socket.emit('screen_share_ice_candidate', {
// //             callId: callData.callId,
// //             targetUserId: sharerId,
// //             candidate: event.candidate,
// //             senderId: currentUserId
// //           });
// //         }
// //       };

// //       await pc.setRemoteDescription(new RTCSessionDescription(offer));
// //       const answer = await pc.createAnswer({
// //         offerToReceiveAudio: true,
// //         offerToReceiveVideo: true
// //       });
// //       await pc.setLocalDescription(answer);

// //       socket.emit('screen_share_answer', {
// //         callId: callData.callId,
// //         sharerId: sharerId,
// //         answer: answer,
// //         responderId: currentUserId
// //       });

// //       console.log('✅ Screen share answer sent');

// //     } catch (error) {
// //       console.error('❌ Error handling screen share offer:', error);
// //       setScreenShareStatus('error');
// //     }
// //   };

// //   const handleIncomingOffer = async (callerId, offer, callerSocketId, isScreenShare = false) => {
// //     console.log('📥 Handling incoming offer:', {
// //       callerId,
// //       isScreenShare,
// //       offerType: offer.type
// //     });

// //     try {
// //       if (isScreenShare) {
// //         console.log('🖥️ This is a screen share offer');
// //         await handleScreenShareIncomingOffer(callerId, offer);
// //         return;
// //       }

// //       // Regular call offer
// //       if (peerConnections.current[callerId]) {
// //         console.log('📞 Existing connection found, closing...');
// //         closePeerConnection(callerId);
// //       }

// //       if (!mediaStreamRef.current) {
// //         if (!pendingOffers.current[callerId]) {
// //           pendingOffers.current[callerId] = [];
// //         }
// //         pendingOffers.current[callerId].push({ offer, callerSocketId, isScreenShare });
// //         return;
// //       }

// //       const pc = new RTCPeerConnection({
// //         iceServers: [
// //           { urls: 'stun:stun.l.google.com:19302' },
// //           { urls: 'stun:stun1.l.google.com:19302' }
// //         ]
// //       });

// //       // Add local tracks
// //       if (mediaStreamRef.current && mediaStreamRef.current.getAudioTracks()[0]) {
// //         const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
// //         pc.addTrack(audioTrack, mediaStreamRef.current);
// //       }

// //       if (callData.type === 'video' && mediaStreamRef.current && mediaStreamRef.current.getVideoTracks()[0]) {
// //         const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
// //         pc.addTrack(videoTrack, mediaStreamRef.current);
// //       }

// //       pc.ontrack = (event) => {
// //         console.log('📥 Track received in incoming offer handler:', {
// //           trackKind: event.track.kind,
// //           trackLabel: event.track.label
// //         });

// //         if (event.streams && event.streams[0]) {
// //           handleRemoteStream(callerId, event.streams[0]);
// //         }
// //       };

// //       pc.onicecandidate = (event) => {
// //         if (event.candidate && socket) {
// //           socket.emit('group_call_ice_candidate', {
// //             callId: callData.callId,
// //             targetUserId: callerId,
// //             candidate: event.candidate,
// //             senderId: currentUserId,
// //             callType: callData.type
// //           });
// //         }
// //       };

// //       peerConnections.current[callerId] = pc;

// //       await pc.setRemoteDescription(new RTCSessionDescription(offer));
// //       const answer = await pc.createAnswer();
// //       await pc.setLocalDescription(answer);

// //       socket.emit('group_call_answer', {
// //         callId: callData.callId,
// //         callerSocketId: callerSocketId,
// //         answer: answer,
// //         responderId: currentUserId,
// //         callType: callData.type,
// //         isScreenShare
// //       });

// //     } catch (error) {
// //       console.error(`Error handling offer from ${callerId}:`, error);
// //     }
// //   };

// //   const handleIncomingAnswer = async (responderId, answer, isScreenShare = false) => {
// //     try {
// //       console.log('📤 Handling incoming answer:', {
// //         responderId,
// //         isScreenShare,
// //         answerType: answer.type
// //       });

// //       if (isScreenShare && screenShareConnection.current) {
// //         const pc = screenShareConnection.current;
// //         if (pc.signalingState !== 'stable') {
// //           await pc.setRemoteDescription(new RTCSessionDescription(answer));
// //           console.log('✅ Screen share answer processed');
// //         }
// //         return;
// //       }

// //       const pc = peerConnections.current[responderId];

// //       if (!pc) {
// //         console.log('❌ No peer connection found for:', responderId);
// //         return;
// //       }

// //       if (pc.signalingState === 'stable') {
// //         console.log('✅ Connection already stable');
// //         return;
// //       }

// //       await pc.setRemoteDescription(new RTCSessionDescription(answer));
// //       console.log('✅ Answer processed successfully');

// //     } catch (error) {
// //       console.error(`Error handling answer from ${responderId}:`, error);
// //     }
// //   };

// //   const handleIncomingIceCandidate = async (senderId, candidate) => {
// //     try {
// //       console.log('🧊 Handling ICE candidate from:', senderId);
      
// //       // Check if it's for screen share
// //       if (screenShareConnection.current && senderId === activeScreenSharer) {
// //         const pc = screenShareConnection.current;
// //         await pc.addIceCandidate(new RTCIceCandidate(candidate));
// //         console.log('✅ Screen share ICE candidate added');
// //         return;
// //       }

// //       const pc = peerConnections.current[senderId];

// //       if (!pc) {
// //         console.log('⚠️ No peer connection, caching candidate');
// //         if (!pendingCandidates.current[senderId]) {
// //           pendingCandidates.current[senderId] = [];
// //         }
// //         pendingCandidates.current[senderId].push(candidate);
// //         return;
// //       }

// //       await pc.addIceCandidate(new RTCIceCandidate(candidate));
// //       ringtoneService.stop();

// //     } catch (error) {
// //       console.error(`Error adding ICE candidate from ${senderId}:`, error);
// //     }
// //   };

// //   const startScreenSharing = async () => {
// //     try {
// //       console.log('🖥️ Starting screen sharing...');
      
// //       const screenStream = await navigator.mediaDevices.getDisplayMedia({
// //         video: {
// //           cursor: 'always',
// //           displaySurface: 'monitor',
// //           width: { ideal: 1920 },
// //           height: { ideal: 1080 },
// //           frameRate: { ideal: 30 }
// //         },
// //         audio: true
// //       });

// //       console.log('✅ Screen share stream acquired:', {
// //         videoTracks: screenStream.getVideoTracks().length,
// //         audioTracks: screenStream.getAudioTracks().length,
// //         streamId: screenStream.id
// //       });

// //       screenShareRef.current = screenStream;
// //       setScreenShareStream(screenStream);
// //       setIsSharingScreen(true);
// //       setActiveScreenSharer(currentUserId);
// //       setScreenShareStatus('active');
      
// //       // Show our own screen share
// //       if (screenShareVideoRef.current) {
// //         screenShareVideoRef.current.srcObject = screenStream;
// //         screenShareVideoRef.current.onloadedmetadata = () => {
// //           screenShareVideoRef.current.play().catch(e =>
// //             console.log('Self screen share play error:', e)
// //           );
// //         };
// //       }

// //       // Notify server
// //       socket.emit('group_call_start_screen_share', {
// //         callId: callData.callId,
// //         userId: currentUserId,
// //         hasAudio: screenStream.getAudioTracks().length > 0,
// //         hasVideo: true
// //       });

// //       console.log('📤 Notified server about screen share start');

// //       // Create new offers for all participants with screen share
// //       participants.forEach(userId => {
// //         setTimeout(async () => {
// //           try {
// //             // Create a new offer with screen share
// //             const pc = peerConnections.current[userId];
// //             if (!pc) return;

// //             // Add screen share tracks to existing connection
// //             const screenTracks = screenStream.getTracks();
// //             screenTracks.forEach(track => {
// //               const existingSender = pc.getSenders().find(s => 
// //                 s.track && s.track.kind === track.kind
// //               );
// //               if (existingSender) {
// //                 existingSender.replaceTrack(track);
// //               } else {
// //                 pc.addTrack(track, screenStream);
// //               }
// //             });

// //             // Create new offer
// //             const offer = await pc.createOffer({
// //               offerToReceiveAudio: true,
// //               offerToReceiveVideo: true
// //             });
// //             await pc.setLocalDescription(offer);
            
// //             socket.emit('group_call_offer', {
// //               callId: callData.callId,
// //               targetUserId: userId,
// //               offer: pc.localDescription,
// //               callerId: currentUserId,
// //               callType: callData.type,
// //               isScreenShare: true
// //             });
            
// //             console.log(`📤 Sent screen share offer to ${userId}`);
            
// //           } catch (error) {
// //             console.error(`Error sending screen share to ${userId}:`, error);
// //           }
// //         }, 1000);
// //       });

// //       // Handle browser stop
// //       screenStream.getVideoTracks()[0].onended = () => {
// //         console.log('🖥️ Screen share ended via browser');
// //         stopScreenSharing();
// //       };

// //       console.log('✅ Screen sharing started successfully');

// //     } catch (error) {
// //       console.error('❌ Failed to start screen sharing:', error);
// //       setIsSharingScreen(false);
// //       setActiveScreenSharer(null);
// //       setScreenShareStatus('idle');
// //     }
// //   };

// //   const stopScreenSharing = async () => {
// //     console.log('🛑 Stopping screen sharing...');

// //     // Stop our own screen share
// //     if (screenShareRef.current) {
// //       screenShareRef.current.getTracks().forEach(track => {
// //         track.stop();
// //         track.enabled = false;
// //       });
// //       screenShareRef.current = null;
// //       setScreenShareStream(null);
// //     }

// //     // Clear video element
// //     if (screenShareVideoRef.current) {
// //       screenShareVideoRef.current.srcObject = null;
// //     }

// //     // Update state
// //     setIsSharingScreen(false);
    
// //     if (activeScreenSharer === currentUserId) {
// //       setActiveScreenSharer(null);
// //       setScreenShareView('big');
// //       setScreenShareStatus('idle');
// //     }

// //     // Notify server
// //     if (socket) {
// //       socket.emit('group_call_stop_screen_share', {
// //         callId: callData.callId,
// //         userId: currentUserId,
// //         timestamp: Date.now()
// //       });
// //     }

// //     // Remove screen share tracks from all connections
// //     participants.forEach(userId => {
// //       const pc = peerConnections.current[userId];
// //       if (pc) {
// //         const videoSenders = pc.getSenders().filter(s => 
// //           s.track && s.track.kind === 'video' && s.track.label.includes('screen')
// //         );
        
// //         videoSenders.forEach(sender => {
// //           sender.replaceTrack(null);
// //         });

// //         // Renegotiate without screen share
// //         setTimeout(async () => {
// //           try {
// //             const offer = await pc.createOffer({
// //               offerToReceiveAudio: true,
// //               offerToReceiveVideo: callData.type === 'video'
// //             });
// //             await pc.setLocalDescription(offer);
            
// //             socket.emit('group_call_offer', {
// //               callId: callData.callId,
// //               targetUserId: userId,
// //               offer: pc.localDescription,
// //               callerId: currentUserId,
// //               callType: callData.type
// //             });
// //           } catch (error) {
// //             console.error(`Error renegotiating after screen share stop:`, error);
// //           }
// //         }, 500);
// //       }
// //     });

// //     console.log('✅ Screen sharing stopped');
// //   };

// //   const joinGroupCall = () => {
// //     if (!socket) return;

// //     socket.emit('join_group_call', {
// //       callId: callData.callId,
// //       userId: currentUserId
// //     });

// //     socket.emit('get_group_call_participants', {
// //       callId: callData.callId
// //     });
// //   };

// //   const updateConnectionState = (userId, state) => {
// //     setConnectionStates(prev => ({
// //       ...prev,
// //       [userId]: state
// //     }));
// //   };

// //   const removeParticipant = (userId) => {
// //     setParticipants(prev => prev.filter(id => id !== userId));
// //     setParticipantStreams(prev => {
// //       const newStreams = { ...prev };
// //       delete newStreams[userId];
// //       return newStreams;
// //     });
// //     setParticipantNames(prev => {
// //       const newNames = { ...prev };
// //       delete newNames[userId];
// //       return newNames;
// //     });
// //   };

// //   const closePeerConnection = (userId) => {
// //     const pc = peerConnections.current[userId];
// //     if (pc) {
// //       pc.close();
// //       delete peerConnections.current[userId];
// //     }

// //     const video = videoRefs.current[userId];
// //     if (video) {
// //       video.srcObject = null;
// //       video.remove();
// //       delete videoRefs.current[userId];
// //     }

// //     if (pendingCandidates.current[userId]) {
// //       delete pendingCandidates.current[userId];
// //     }

// //     if (pendingOffers.current[userId]) {
// //       delete pendingOffers.current[userId];
// //     }

// //     updateConnectionState(userId, 'closed');
// //   };

// //   const cleanup = () => {
// //     console.log('🧹 Cleaning up group call...');
    
// //     if (isSharingScreen) {
// //       stopScreenSharing();
// //     }

// //     Object.keys(peerConnections.current).forEach(userId => {
// //       closePeerConnection(userId);
// //     });
// //     peerConnections.current = {};

// //     if (screenShareConnection.current) {
// //       screenShareConnection.current.close();
// //       screenShareConnection.current = null;
// //     }

// //     if (mediaStreamRef.current) {
// //       mediaStreamRef.current.getTracks().forEach(track => {
// //         track.stop();
// //       });
// //       mediaStreamRef.current = null;
// //       setLocalStream(null);
// //     }

// //     if (screenShareRef.current) {
// //       screenShareRef.current.getTracks().forEach(track => track.stop());
// //       screenShareRef.current = null;
// //       setScreenShareStream(null);
// //     }

// //     Object.keys(videoRefs.current).forEach(userId => {
// //       const video = videoRefs.current[userId];
// //       if (video) {
// //         video.srcObject = null;
// //         video.remove();
// //       }
// //     });
// //     videoRefs.current = {};

// //     pendingCandidates.current = {};
// //     pendingOffers.current = {};

// //     setParticipants([]);
// //     setParticipantStreams({});
// //     setConnectionStates({});
// //     setActiveScreenSharer(null);
// //     setScreenShareView('big');
// //     setScreenShareStatus('idle');
// //     setCallTimer(0);
// //     callStartTime.current = null;
    
// //     console.log('✅ Cleanup complete');
// //   };

// //   const acceptCall = async () => {
// //     setCallStatus('active');
// //     callStartTime.current = new Date();

// //     Object.keys(pendingOffers.current).forEach(callerId => {
// //       const offers = pendingOffers.current[callerId];
// //       offers.forEach(async (offerData) => {
// //         await handleIncomingOffer(callerId, offerData.offer, offerData.callerSocketId, offerData.isScreenShare);
// //       });
// //     });
// //     pendingOffers.current = {};

// //     joinGroupCall();

// //     if (onAcceptCall) {
// //       onAcceptCall();
// //     }
// //   };

// //   const toggleMute = () => {
// //     if (mediaStreamRef.current) {
// //       const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
// //       if (audioTrack) {
// //         audioTrack.enabled = !audioTrack.enabled;
// //         setIsMuted(!audioTrack.enabled);
// //       }
// //     }
// //   };

// //   const toggleVideo = () => {
// //     if (mediaStreamRef.current && callData.type === 'video') {
// //       const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
// //       if (videoTrack) {
// //         videoTrack.enabled = !videoTrack.enabled;
// //         setIsVideoEnabled(videoTrack.enabled);

// //         Object.values(peerConnections.current).forEach(pc => {
// //           const sender = pc.getSenders().find(s =>
// //             s.track && s.track.kind === 'video'
// //           );
// //           if (sender) {
// //             sender.replaceTrack(videoTrack);
// //           }
// //         });
// //       }
// //     }
// //   };

// //   const toggleScreenShareView = () => {
// //     setScreenShareView(prev => prev === 'big' ? 'small' : 'big');
// //   };

// //   const handleEndCall = () => {
// //     console.log('📞 Ending call...');
    
// //     if (socket) {
// //       const eventName = callData.type === 'video' ? 'group_video_call_end' : 'group_voice_call_end';
      
// //       let shouldEndForEveryone = false;
      
// //       if (participants.length === 1) {
// //         shouldEndForEveryone = true;
// //       } else if (currentUserId === callData.callerId) {
// //         shouldEndForEveryone = true;
// //       } else if (participants.length === 0) {
// //         shouldEndForEveryone = true;
// //       }
      
// //       socket.emit(eventName, {
// //         callId: callData.callId,
// //         groupId: callData.groupId,
// //         userId: currentUserId,
// //         isCaller: currentUserId === callData.callerId,
// //         shouldEndForEveryone: shouldEndForEveryone
// //       });

// //       socket.emit('leave_group_call', {
// //         callId: callData.callId,
// //         userId: currentUserId,
// //         forceEnd: shouldEndForEveryone
// //       });
// //     }

// //     cleanup();
    
// //     if (onEndCall) {
// //       onEndCall();
// //     }
// //   };

// //   // INCOMING CALL UI (same as before)
// //   if (isIncoming && callStatus === 'ringing' && !isMinimized) {
// //     return (
// //       <div className="fixed top-6 right-6 z-50 animate-fade-in">
// //         <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl p-6 w-96 border border-gray-800">
// //           <div className="flex items-center justify-between mb-6">
// //             <div className="flex items-center space-x-3">
// //               <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
// //                 <Users className="w-6 h-6 text-white" />
// //               </div>
// //               <div>
// //                 <h3 className="text-white font-semibold text-lg">
// //                   {callData.groupName || 'Group Call'}
// //                 </h3>
// //                 <p className="text-gray-400 text-sm flex items-center">
// //                   <Users className="w-3 h-3 mr-1" />
// //                   Incoming {callData.type === 'video' ? 'Video' : 'Voice'} Group Call
// //                 </p>
// //               </div>
// //             </div>
// //             <button
// //               onClick={() => setIsMinimized(true)}
// //               className="text-gray-400 hover:text-white transition-colors"
// //             >
// //               <Minimize2 className="w-5 h-5" />
// //             </button>
// //           </div>

// //           <div className="mb-6">
// //             <div className="bg-gray-800/50 rounded-xl p-4">
// //               <div className="aspect-video bg-black rounded-lg overflow-hidden mb-3">
// //                 {callData.type === 'video' && localStream ? (
// //                   <video
// //                     ref={localVideoRef}
// //                     autoPlay
// //                     playsInline
// //                     muted
// //                     className="w-full h-full object-cover"
// //                   />
// //                 ) : (
// //                   <div className="w-full h-full flex flex-col items-center justify-center">
// //                     <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3">
// //                       <Users className="w-8 h-8 text-white" />
// //                     </div>
// //                     <p className="text-gray-400">Group Preview</p>
// //                   </div>
// //                 )}
// //               </div>
// //               <p className="text-gray-400 text-sm text-center">
// //                 {callData.type === 'video' ? 'Your preview' : 'Group audio call'}
// //               </p>
// //             </div>
// //           </div>

// //           <div className="flex space-x-3">
// //             <button
// //               onClick={onRejectCall || handleEndCall}
// //               className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
// //             >
// //               <PhoneOff className="w-5 h-5 group-hover:rotate-90 transition-transform" />
// //               <span>Decline</span>
// //             </button>
// //             <button
// //               onClick={acceptCall}
// //               className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
// //             >
// //               <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
// //               <span>Join Group</span>
// //             </button>
// //           </div>

// //           <div className="mt-4 pt-4 border-t border-gray-800">
// //             <div className="flex items-center justify-between text-gray-400 text-sm">
// //               <span>Call Type</span>
// //               <span className="text-white">
// //                 {callData.type === 'video' ? '🎥 Video' : '🔊 Voice'} Group Call
// //               </span>
// //             </div>
// //           </div>
// //         </div>
// //       </div>
// //     );
// //   }

// //   // Minimized incoming call
// //   if (isIncoming && callStatus === 'ringing' && isMinimized) {
// //     return (
// //       <div className="fixed bottom-6 right-6 z-50">
// //         <div className="bg-gray-900 rounded-lg shadow-lg p-3 w-64 border border-gray-800">
// //           <div className="flex items-center justify-between">
// //             <div className="flex items-center space-x-2">
// //               <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center animate-pulse">
// //                 <Users className="w-4 h-4 text-white" />
// //               </div>
// //               <div>
// //                 <p className="text-white text-sm font-medium">
// //                   Incoming {callData.type === 'video' ? 'Video' : 'Voice'}
// //                 </p>
// //                 <p className="text-gray-400 text-xs">Group Call</p>
// //               </div>
// //             </div>
// //             <div className="flex space-x-1">
// //               <button
// //                 onClick={acceptCall}
// //                 className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
// //               >
// //                 <Users className="w-4 h-4 text-white" />
// //               </button>
// //               <button
// //                 onClick={onRejectCall || handleEndCall}
// //                 className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
// //               >
// //                 <PhoneOff className="w-4 h-4 text-white" />
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       </div>
// //     );
// //   }

// //   // ACTIVE GROUP CALL UI
// //   return (
// //     <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-black flex flex-col z-50">
// //       {/* Top Bar */}
// //       <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-4">
// //         <div className="max-w-6xl mx-auto flex items-center justify-between">
// //           <div className="flex items-center space-x-4">
// //             <div className={`w-3 h-3 rounded-full ${callStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
// //             <div>
// //               <h1 className="text-white font-semibold text-lg">
// //                 {callData.groupName || 'Group Call'}
// //               </h1>
// //               <div className="flex items-center space-x-2 text-gray-400 text-sm">
// //                 <Clock className="w-4 h-4" />
// //                 <span>{formatTime(callTimer)}</span>
// //                 <span>•</span>
// //                 <span>{participants.length + 1} participants</span>
// //                 <span>•</span>
// //                 <span>{callData.type === 'video' ? '🎥 Video' : '🔊 Voice'}</span>
// //                 {activeScreenSharer && (
// //                   <>
// //                     <span>•</span>
// //                     <span className="text-blue-400 flex items-center">
// //                       <ScreenShare className="w-4 h-4 mr-1" />
// //                       {getParticipantName(activeScreenSharer)} is sharing screen
// //                     </span>
// //                   </>
// //                 )}
// //               </div>
// //             </div>
// //           </div>

// //           <div className="flex items-center space-x-2">
// //             <button
// //               onClick={() => setIsMinimized(true)}
// //               className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
// //             >
// //               <Minimize2 className="w-5 h-5" />
// //             </button>
// //           </div>
// //         </div>
// //       </div>

// //       {/* Main Content - FIXED SCREEN SHARE SECTION */}
// //       <div className="flex-1 p-4 overflow-auto">
// //         <div className="max-w-6xl mx-auto">
// //           {/* Big Screen Share Display */}
// //           {activeScreenSharer && screenShareView === 'big' && (
// //             <div className="mb-6 bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden animate-fade-in">
// //               <div className="p-4 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between">
// //                 <div className="flex items-center space-x-3">
// //                   <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
// //                     <ScreenShare className="w-5 h-5 text-white" />
// //                   </div>
// //                   <div>
// //                     <h3 className="text-white font-semibold">
// //                       {getParticipantName(activeScreenSharer)} is sharing screen
// //                     </h3>
// //                     <p className="text-gray-400 text-sm">
// //                       {callData.type === 'video' ? '🎥 Video Call' : '🔊 Voice Call'}
// //                     </p>
// //                   </div>
// //                 </div>
// //                 <div className="flex items-center space-x-3">
// //                   <button
// //                     onClick={toggleScreenShareView}
// //                     className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
// //                     title="Switch to small view"
// //                   >
// //                     <Minimize2 className="w-5 h-5" />
// //                   </button>
// //                   {activeScreenSharer === currentUserId && (
// //                     <button
// //                       onClick={stopScreenSharing}
// //                       className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
// //                     >
// //                       <ScreenShareOff className="w-4 h-4" />
// //                       <span>Stop Sharing</span>
// //                     </button>
// //                   )}
// //                 </div>
// //               </div>
              
// //               <div className="p-4 bg-black">
// //                 <div className="relative bg-black rounded-xl overflow-hidden h-[500px] flex items-center justify-center">
// //                   {/* Screen Share Video */}
// //                   <video
// //                     ref={screenShareVideoRef}
// //                     autoPlay
// //                     playsInline
// //                     className="w-full h-full object-contain"
// //                     style={{
// //                       backgroundColor: 'black'
// //                     }}
// //                     onError={(e) => console.error('Screen share video error:', e)}
// //                   />
                  
// //                   {/* Loading/Status Overlay */}
// //                   {(screenShareStatus === 'waiting' || screenShareStatus === 'idle') && (
// //                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-900/20 to-purple-900/20">
// //                       <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
// //                         <ScreenShare className="w-10 h-10 text-white" />
// //                       </div>
// //                       <p className="text-blue-400 font-medium text-lg mb-2">
// //                         {screenShareStatus === 'waiting' ? 'Waiting for screen share...' : 'Screen Sharing'}
// //                       </p>
// //                       <p className="text-gray-400 text-center max-w-md">
// //                         {getParticipantName(activeScreenSharer)} is sharing their screen
// //                       </p>
// //                       <div className="mt-4 flex items-center space-x-2 text-gray-500 text-sm">
// //                         <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
// //                         <span>{screenShareStatus === 'waiting' ? 'Connecting...' : 'Ready'}</span>
// //                       </div>
// //                     </div>
// //                   )}
                  
// //                   {screenShareStatus === 'error' && (
// //                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-red-900/20 to-red-900/10">
// //                       <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mb-4">
// //                         <ScreenShareOff className="w-10 h-10 text-white" />
// //                       </div>
// //                       <p className="text-red-400 font-medium text-lg mb-2">Screen Share Error</p>
// //                       <p className="text-gray-400 text-center max-w-md">
// //                         Failed to load screen share from {getParticipantName(activeScreenSharer)}
// //                       </p>
// //                     </div>
// //                   )}
// //                 </div>
                
// //                 {/* Show sharer's camera for video calls */}
// //                 {callData.type === 'video' && activeScreenSharer !== currentUserId && (
// //                   <div className="mt-4 relative">
// //                     <div className="absolute -top-2 left-4 bg-gray-900 px-3 py-1 rounded-t-lg text-sm text-gray-300 border border-gray-800 border-b-0">
// //                       {getParticipantName(activeScreenSharer)}'s camera
// //                     </div>
// //                     <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-2">
// //                       <div className="aspect-video bg-black rounded overflow-hidden">
// //                         <div
// //                           id={`media-container-${activeScreenSharer}`}
// //                           className="w-full h-full flex items-center justify-center"
// //                         >
// //                           {!participantStreams[activeScreenSharer] && (
// //                             <div className="text-center p-4">
// //                               <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
// //                                 <User className="w-6 h-6 text-gray-400" />
// //                               </div>
// //                               <p className="text-gray-400 text-sm">Camera view</p>
// //                             </div>
// //                           )}
// //                         </div>
// //                       </div>
// //                     </div>
// //                   </div>
// //                 )}
// //               </div>
// //             </div>
// //           )}

// //           {/* Small Screen Share Display */}
// //           {activeScreenSharer && screenShareView === 'small' && (
// //             <div className="mb-6">
// //               <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
// //                 <div className="p-3 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between">
// //                   <div className="flex items-center space-x-2">
// //                     <ScreenShare className="w-4 h-4 text-blue-400" />
// //                     <span className="text-white font-medium">
// //                       {getParticipantName(activeScreenSharer)} is sharing
// //                     </span>
// //                   </div>
// //                   <div className="flex items-center space-x-2">
// //                     <button
// //                       onClick={toggleScreenShareView}
// //                       className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded"
// //                       title="Maximize screen share"
// //                     >
// //                       <Maximize2 className="w-4 h-4" />
// //                     </button>
// //                     {activeScreenSharer === currentUserId && (
// //                       <button
// //                         onClick={stopScreenSharing}
// //                         className="text-red-400 hover:text-red-300 text-xs font-medium px-2 py-1 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors"
// //                       >
// //                         Stop
// //                       </button>
// //                     )}
// //                   </div>
// //                 </div>
// //                 <div className="p-2 bg-black">
// //                   <div className="aspect-video bg-black rounded overflow-hidden">
// //                     <video
// //                       ref={screenShareVideoRef}
// //                       autoPlay
// //                       playsInline
// //                       className="w-full h-full object-contain"
// //                     />
// //                     {screenShareStatus === 'waiting' && (
// //                       <div className="absolute inset-0 flex items-center justify-center bg-black/80">
// //                         <div className="text-center">
// //                           <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
// //                           <p className="text-blue-400 text-sm">Loading...</p>
// //                         </div>
// //                       </div>
// //                     )}
// //                   </div>
// //                 </div>
// //               </div>
// //             </div>
// //           )}

// //           {/* Participants Grid */}
// //           <div className={`grid gap-4 ${
// //             activeScreenSharer && screenShareView === 'big' 
// //               ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
// //               : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
// //           }`}>
// //             {/* Local User */}
// //             <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden h-64">
// //               <div className="p-3 border-b border-gray-800">
// //                 <div className="flex items-center justify-between">
// //                   <div className="flex items-center space-x-2">
// //                     <div className={`w-2 h-2 rounded-full ${localStream ? 'bg-green-500' : 'bg-yellow-500'}`} />
// //                     <span className="text-white font-medium">You</span>
// //                   </div>
// //                   <div className="flex items-center space-x-1">
// //                     {isMuted && (
// //                       <div className="bg-red-500/20 px-2 py-1 rounded text-xs text-red-400">
// //                         Muted
// //                       </div>
// //                     )}
// //                     {isSharingScreen && (
// //                       <div className="bg-blue-500/20 px-2 py-1 rounded text-xs text-blue-400 animate-pulse">
// //                         Sharing
// //                       </div>
// //                     )}
// //                   </div>
// //                 </div>
// //               </div>

// //               <div className="p-3 h-full flex flex-col">
// //                 {callData.type === 'video' ? (
// //                   <div className="relative flex-1 bg-black rounded-lg overflow-hidden">
// //                     <video
// //                       ref={localVideoRef}
// //                       autoPlay
// //                       playsInline
// //                       muted
// //                       className="w-full h-full object-cover"
// //                     />
// //                     {!isVideoEnabled && (
// //                       <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
// //                         <VideoOff className="w-8 h-8 text-gray-600" />
// //                       </div>
// //                     )}
// //                   </div>
// //                 ) : (
// //                   <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-lg p-4">
// //                     <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-3">
// //                       <User className="w-8 h-8 text-white" />
// //                     </div>
// //                     <span className="text-white font-medium">You</span>
// //                     <div className="flex items-center space-x-2 mt-2">
// //                       {isMuted ? (
// //                         <MicOff className="w-4 h-4 text-red-400" />
// //                       ) : (
// //                         <Mic className="w-4 h-4 text-green-400" />
// //                       )}
// //                       {isSharingScreen && (
// //                         <ScreenShare className="w-4 h-4 text-blue-400 animate-pulse" />
// //                       )}
// //                     </div>
// //                   </div>
// //                 )}
// //               </div>
// //             </div>

// //             {/* Remote Participants */}
// //             {participants
// //               .filter(userId => !(activeScreenSharer === userId && screenShareView === 'big' && callData.type === 'video'))
// //               .map(userId => (
// //               <div key={userId} className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden h-64">
// //                 <div className="p-3 border-b border-gray-800">
// //                   <div className="flex items-center justify-between">
// //                     <div className="flex items-center space-x-2">
// //                       <div className={`w-2 h-2 rounded-full ${participantStreams[userId] ? 'bg-green-500' : 'bg-yellow-500'}`} />
// //                       <span className="text-white font-medium truncate">
// //                         {getParticipantName(userId)}
// //                       </span>
// //                     </div>
// //                     {activeScreenSharer === userId && (
// //                       <div className="flex items-center space-x-1 bg-blue-500/20 px-2 py-1 rounded text-xs text-blue-400 animate-pulse">
// //                         <ScreenShare className="w-3 h-3" />
// //                         <span>Sharing</span>
// //                       </div>
// //                     )}
// //                   </div>
// //                 </div>

// //                 <div className="p-3 h-full flex flex-col">
// //                   <div
// //                     id={`media-container-${userId}`}
// //                     className={`relative flex-1 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-lg overflow-hidden flex items-center justify-center`}
// //                   >
// //                     {callData.type === 'video' ? (
// //                       !participantStreams[userId] && (
// //                         <div className="text-center p-4">
// //                           <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
// //                             <User className="w-6 h-6 text-gray-400" />
// //                           </div>
// //                           <p className="text-gray-400 text-sm">
// //                             {connectionStates[userId] === 'connected' ? 'Connected' : 'Connecting...'}
// //                           </p>
// //                         </div>
// //                       )
// //                     ) : (
// //                       <div className="text-center p-4">
// //                         <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
// //                           connectionStates[userId] === 'connected' ? 'bg-green-500/20 border border-green-500/30' :
// //                           connectionStates[userId] === 'connecting' ? 'bg-yellow-500/20 border border-yellow-500/30' :
// //                           'bg-gray-700'
// //                         }`}>
// //                           <User className="w-6 h-6 text-gray-300" />
// //                         </div>
// //                         <p className="text-gray-300 font-medium mb-1">{getParticipantName(userId)}</p>
// //                         <p className="text-gray-400 text-xs">
// //                           {participantStreams[userId] ?
// //                             (connectionStates[userId] === 'connected' ? 'Speaking' : 'Connected') :
// //                             (connectionStates[userId] || 'Connecting...')}
// //                         </p>
// //                       </div>
// //                     )}
// //                   </div>
// //                 </div>
// //               </div>
// //             ))}
// //           </div>
// //         </div>
// //       </div>

// //       {/* Controls Panel */}
// //       <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 p-4">
// //         <div className="max-w-6xl mx-auto">
// //           <div className="flex flex-col lg:flex-row gap-6">
// //             {/* Left: Call Info */}
// //             <div className="lg:w-64 bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
// //               <h3 className="text-white font-semibold text-lg mb-4">Call Information</h3>
// //               <div className="space-y-3">
// //                 <div className="flex justify-between items-center">
// //                   <span className="text-gray-400">Duration</span>
// //                   <span className="text-white font-mono">{formatTime(callTimer)}</span>
// //                 </div>
// //                 <div className="flex justify-between items-center">
// //                   <span className="text-gray-400">Participants</span>
// //                   <span className="text-white">{participants.length + 1}</span>
// //                 </div>
// //                 <div className="flex justify-between items-center">
// //                   <span className="text-gray-400">Type</span>
// //                   <span className={`${callData.type === 'video' ? 'text-blue-400' : 'text-green-400'}`}>
// //                     {callData.type === 'video' ? '🎥 Video Group' : '🔊 Voice Group'}
// //                   </span>
// //                 </div>
// //                 <div className="flex justify-between items-center">
// //                   <span className="text-gray-400">Status</span>
// //                   <span className={`${callStatus === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
// //                     {callStatus === 'active' ? 'Active' : 'Connecting...'}
// //                   </span>
// //                 </div>
// //                 {activeScreenSharer && (
// //                   <div className="pt-3 border-t border-gray-800">
// //                     <div className="flex items-center space-x-2">
// //                       <ScreenShare className="w-4 h-4 text-blue-400 animate-pulse" />
// //                       <div>
// //                         <p className="text-blue-400 text-sm font-medium">Screen Sharing</p>
// //                         <p className="text-blue-400/70 text-xs">
// //                           by {getParticipantName(activeScreenSharer)}
// //                         </p>
// //                         <p className="text-gray-500 text-xs mt-1">
// //                           Status: {screenShareStatus}
// //                         </p>
// //                       </div>
// //                     </div>
// //                   </div>
// //                 )}
// //               </div>
// //             </div>

// //             {/* Right: Controls */}
// //             <div className="flex-1">
// //               <div className="flex justify-center items-center space-x-6">
// //                 <button
// //                   onClick={toggleMute}
// //                   className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
// //                     isMuted
// //                     ? 'bg-red-500 text-white hover:bg-red-600'
// //                     : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
// //                   }`}
// //                   title={isMuted ? 'Unmute' : 'Mute'}
// //                 >
// //                   {isMuted ? (
// //                     <MicOff className="w-6 h-6" />
// //                   ) : (
// //                     <Mic className="w-6 h-6" />
// //                   )}
// //                 </button>

// //                 {callData.type === 'video' && (
// //                   <button
// //                     onClick={toggleVideo}
// //                     className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
// //                       isVideoEnabled
// //                       ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
// //                       : 'bg-red-500 text-white hover:bg-red-600'
// //                     }`}
// //                     title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
// //                   >
// //                     {isVideoEnabled ? (
// //                       <Video className="w-6 h-6" />
// //                     ) : (
// //                       <VideoOff className="w-6 h-6" />
// //                     )}
// //                   </button>
// //                 )}

// //                 <button
// //                   onClick={isSharingScreen ? stopScreenSharing : startScreenSharing}
// //                   className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
// //                     isSharingScreen
// //                     ? 'bg-blue-500 text-white hover:bg-blue-600 animate-pulse'
// //                     : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
// //                   }`}
// //                   title={isSharingScreen ? 'Stop sharing screen' : 'Share screen'}
// //                 >
// //                   {isSharingScreen ? (
// //                     <ScreenShareOff className="w-6 h-6" />
// //                   ) : (
// //                     <ScreenShare className="w-6 h-6" />
// //                   )}
// //                 </button>

// //                 {activeScreenSharer && screenShareView === 'big' && (
// //                   <button
// //                     onClick={toggleScreenShareView}
// //                     className="w-14 h-14 rounded-full flex items-center justify-center bg-purple-500 text-white hover:bg-purple-600 transition-all"
// //                     title="Switch to small view"
// //                   >
// //                     <Minimize2 className="w-6 h-6" />
// //                   </button>
// //                 )}

// //                 {activeScreenSharer && screenShareView === 'small' && (
// //                   <button
// //                     onClick={toggleScreenShareView}
// //                     className="w-14 h-14 rounded-full flex items-center justify-center bg-purple-500 text-white hover:bg-purple-600 transition-all"
// //                     title="Maximize screen share"
// //                   >
// //                     <Maximize2 className="w-6 h-6" />
// //                   </button>
// //                 )}

// //                 <button
// //                   onClick={handleEndCall}
// //                   className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/25"
// //                   title="Leave group call"
// //                 >
// //                   <PhoneOff className="w-7 h-7" />
// //                 </button>
// //               </div>
// //             </div>
// //           </div>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// 'use client';

// import { useState, useEffect, useRef } from 'react';
// import {
//   Mic,
//   MicOff,
//   Video,
//   VideoOff,
//   ScreenShare,
//   ScreenShareOff,
//   PhoneOff,
//   Users,
//   Clock,
//   User,
//   Maximize2,
//   Minimize2
// } from 'lucide-react';
// import { ringtoneService } from '@/lib/ringtone-service';

// export default function GroupCall({
//   callData,
//   socket,
//   currentUserId,
//   onEndCall,
//   onAcceptCall,
//   onRejectCall,
//   isIncoming = false
// }) {
//   const [participants, setParticipants] = useState([]);
//   const [participantNames, setParticipantNames] = useState({});
//   const [localStream, setLocalStream] = useState(null);
//   const [screenShareStream, setScreenShareStream] = useState(null);
//   const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
//   const [isMuted, setIsMuted] = useState(false);
//   const [isVideoEnabled, setIsVideoEnabled] = useState(callData.type === 'video');
//   const [isSharingScreen, setIsSharingScreen] = useState(false);
//   const [activeScreenSharer, setActiveScreenSharer] = useState(null);
//   const [connectionStates, setConnectionStates] = useState({});
//   const [participantStreams, setParticipantStreams] = useState({});
//   const [callTimer, setCallTimer] = useState(0);
//   const [isMinimized, setIsMinimized] = useState(false);
//   const [screenShareView, setScreenShareView] = useState('big');

//   const peerConnections = useRef({});
//   const mediaStreamRef = useRef(null);
//   const screenShareRef = useRef(null);
//   const localVideoRef = useRef(null);
//   const screenShareVideoRef = useRef(null);
//   const videoRefs = useRef({});
//   const pendingOffers = useRef({});
//   const pendingCandidates = useRef({});
//   const isInitialized = useRef(false);
//   const callStartTime = useRef(null);
//   const timerInterval = useRef(null);

//   // Timer effect
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

//   const formatTime = (seconds) => {
//     if (!seconds) return '00:00';
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//   };

//   // Initialize media
//   useEffect(() => {
//     const initializeMedia = async () => {
//       try {
//         const constraints = {
//           audio: {
//             echoCancellation: true,
//             noiseSuppression: true,
//             autoGainControl: true,
//             channelCount: 1,
//             sampleRate: 48000
//           },
//           video: callData.type === 'video' ? {
//             width: { ideal: 640 },
//             height: { ideal: 480 },
//             frameRate: { ideal: 30 },
//             facingMode: 'user'
//           } : false
//         };

//         const stream = await navigator.mediaDevices.getUserMedia(constraints);
//         mediaStreamRef.current = stream;
//         setLocalStream(stream);

//         if (localVideoRef.current && callData.type === 'video') {
//           localVideoRef.current.srcObject = stream;
//           localVideoRef.current.muted = true;
//         }

//         if (!isIncoming || callStatus === 'active') {
//           joinGroupCall();
//         }

//       } catch (error) {
//         console.error('Failed to get media:', error);
//       }
//     };

//     if (!mediaStreamRef.current) {
//       initializeMedia();
//     }

//     return () => {
//       cleanup();
//     };
//   }, [callData.type, isIncoming]);

//   // Socket listeners
//   useEffect(() => {
//     if (!socket || !callData) return;

//     const handleUserJoined = async (data) => {
//       if (data.userId === currentUserId) return;

//       setParticipants(prev => {
//         if (!prev.includes(data.userId)) {
//           return [...prev, data.userId];
//         }
//         return prev;
//       });

//       if (data.userName) {
//         setParticipantNames(prev => ({
//           ...prev,
//           [data.userId]: data.userName
//         }));
//       }

//       if (mediaStreamRef.current) {
//         await createPeerConnection(data.userId, true);
//       }
//     };

//     const handleUserLeft = (data) => {
//       removeParticipant(data.userId);
//       closePeerConnection(data.userId);

//       if (activeScreenSharer === data.userId) {
//         setActiveScreenSharer(null);
//         setScreenShareView('big');
//       }
//     };

//     const handleGroupCallParticipants = (data) => {
//       const otherParticipants = data.participants.filter(
//         id => id !== currentUserId
//       );

//       setParticipants(otherParticipants);

//       otherParticipants.forEach(userId => {
//         setTimeout(async () => {
//           if (mediaStreamRef.current) {
//             await createPeerConnection(userId, true);
//           }
//         }, 500);
//       });
//     };

//     const handleGroupCallParticipantsWithInfo = (data) => {
//       const otherParticipants = data.participants.filter(
//         p => p.userId !== currentUserId
//       );

//       setParticipants(otherParticipants.map(p => p.userId));
      
//       const names = {};
//       otherParticipants.forEach(p => {
//         if (p.userName) {
//           names[p.userId] = p.userName;
//         }
//       });
//       setParticipantNames(names);

//       otherParticipants.forEach(p => {
//         setTimeout(async () => {
//           if (mediaStreamRef.current) {
//             await createPeerConnection(p.userId, true);
//           }
//         }, 500);
//       });
//     };

//     const handleGroupCallOffer = async (data) => {
//       console.log('📞 Received group call offer:', {
//         callerId: data.callerId,
//         isScreenShare: data.isScreenShare,
//         callType: data.callType,
//         offerType: data.offer.type
//       });

//       if (isIncoming && callStatus === 'ringing') {
//         if (!pendingOffers.current[data.callerId]) {
//           pendingOffers.current[data.callerId] = [];
//         }
//         pendingOffers.current[data.callerId].push(data);
//         return;
//       }

//       await handleIncomingOffer(data.callerId, data.offer, data.callerSocketId, data.isScreenShare);
//     };

//     const handleGroupCallAnswer = async (data) => {
//       ringtoneService.stop();
//       await handleIncomingAnswer(data.responderId, data.answer, data.isScreenShare);
//     };

//     const handleGroupCallIceCandidate = async (data) => {
//       await handleIncomingIceCandidate(data.senderId, data.candidate);
//     };

//     const handleScreenShareStarted = async (data) => {
//       console.log('🖥️ Screen share started by:', data.userId);
//       console.log('Screen share data:', data);
      
//       // If someone else started sharing, stop ours if we're sharing
//       if (data.userId !== currentUserId && isSharingScreen) {
//         console.log('⚠️ Someone else started sharing, stopping our share');
//         await stopScreenSharing();
//       }
      
//       // Set active screen sharer
//       setActiveScreenSharer(data.userId);
      
//       // If we're the one who started sharing, show our own screen immediately
//       if (data.userId === currentUserId) {
//         console.log('✅ We started sharing - showing our own screen');
//         return;
//       }
      
//       // For others sharing, we need to wait for the WebRTC offer
//       console.log(`⏳ Waiting for screen share from ${data.userId}`);
//     };

//     const handleScreenShareStopped = (data) => {
//       console.log('🛑 Screen share stopped by:', data.userId);
      
//       if (data.userId === activeScreenSharer) {
//         console.log(`✅ Clearing active screen sharer: ${activeScreenSharer}`);
//         setActiveScreenSharer(null);
//         setScreenShareView('big');
        
//         if (screenShareVideoRef.current) {
//           screenShareVideoRef.current.srcObject = null;
//         }
        
//         if (data.userId === currentUserId) {
//           setIsSharingScreen(false);
//           if (screenShareRef.current) {
//             screenShareRef.current.getTracks().forEach(track => track.stop());
//             screenShareRef.current = null;
//             setScreenShareStream(null);
//           }
//         }
//       }
//     };

//     // Add listeners
//     socket.on('group_call_user_joined', handleUserJoined);
//     socket.on('group_call_user_left', handleUserLeft);
//     socket.on('group_call_participants', handleGroupCallParticipants);
//     socket.on('group_call_participants_with_info', handleGroupCallParticipantsWithInfo);
//     socket.on('receive_group_call_offer', handleGroupCallOffer);
//     socket.on('receive_group_call_answer', handleGroupCallAnswer);
//     socket.on('receive_group_call_ice_candidate', handleGroupCallIceCandidate);
//     socket.on('group_call_screen_share_started', handleScreenShareStarted);
//     socket.on('group_call_screen_share_stopped', handleScreenShareStopped);

//     if (!isInitialized.current) {
//       isInitialized.current = true;

//       if (!isIncoming) {
//         socket.emit('join_group_call', {
//           callId: callData.callId,
//           userId: currentUserId
//         });

//         socket.emit('initiate_group_call', {
//           callId: callData.callId,
//           groupId: callData.groupId,
//           callerId: currentUserId,
//           callType: callData.type,
//           groupName: callData.groupName
//         });

//         setTimeout(() => {
//           setCallStatus('calling');
//         }, 1000);
//       }
//     }

//     return () => {
//       socket.off('group_call_user_joined', handleUserJoined);
//       socket.off('group_call_user_left', handleUserLeft);
//       socket.off('group_call_participants', handleGroupCallParticipants);
//       socket.off('group_call_participants_with_info', handleGroupCallParticipantsWithInfo);
//       socket.off('receive_group_call_offer', handleGroupCallOffer);
//       socket.off('receive_group_call_answer', handleGroupCallAnswer);
//       socket.off('receive_group_call_ice_candidate', handleGroupCallIceCandidate);
//       socket.off('group_call_screen_share_started', handleScreenShareStarted);
//       socket.off('group_call_screen_share_stopped', handleScreenShareStopped);
//     };
//   }, [socket, callData, currentUserId, isIncoming, callStatus, isSharingScreen, activeScreenSharer]);

//   const getParticipantName = (userId) => {
//     if (participantNames[userId]) {
//       return participantNames[userId];
//     }
//     return `User ${userId}`;
//   };

//   const createPeerConnection = async (userId, isInitiator = false) => {
//     try {
//       if (peerConnections.current[userId]) {
//         return peerConnections.current[userId];
//       }

//       if (!mediaStreamRef.current) {
//         return;
//       }

//       const configuration = {
//         iceServers: [
//           { urls: 'stun:stun.l.google.com:19302' },
//           { urls: 'stun:stun1.l.google.com:19302' },
//           { urls: 'stun:stun2.l.google.com:19302' },
//           { urls: 'stun:stun3.l.google.com:19302' },
//           { urls: 'stun:stun4.l.google.com:19302' }
//         ],
//         iceTransportPolicy: 'all',
//         bundlePolicy: 'max-bundle',
//         rtcpMuxPolicy: 'require',
//         iceCandidatePoolSize: 10
//       };

//       const pc = new RTCPeerConnection(configuration);

//       // Add audio track (always)
//       if (mediaStreamRef.current && mediaStreamRef.current.getAudioTracks()[0]) {
//         const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
//         pc.addTrack(audioTrack, mediaStreamRef.current);
//       }

//       // Add video track if video call
//       if (callData.type === 'video' && mediaStreamRef.current && mediaStreamRef.current.getVideoTracks()[0]) {
//         const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
//         pc.addTrack(videoTrack, mediaStreamRef.current);
//       }

//       // Add screen share track if we're sharing
//       if (screenShareRef.current && isSharingScreen) {
//         const screenTracks = screenShareRef.current.getTracks();
//         screenTracks.forEach(track => {
//           pc.addTrack(track, screenShareRef.current);
//         });
//       }

//       // Handle remote tracks
//       pc.ontrack = (event) => {
//         console.log(`🎥 Received track from ${userId}:`, {
//           trackKind: event.track.kind,
//           trackLabel: event.track.label,
//           streams: event.streams.length
//         });

//         if (event.streams && event.streams[0]) {
//           const stream = event.streams[0];
          
//           // Check if this is a screen share stream
//           const isScreenShareTrack = event.track.kind === 'video' &&
//             (event.track.label.includes('screen') ||
//              event.track.label.includes('Screen') ||
//              stream.id.includes('screen'));

//           console.log(`Is screen share track: ${isScreenShareTrack}`, {
//             label: event.track.label
//           });

//           if (isScreenShareTrack) {
//             console.log(`🖥️ Screen share stream received from ${userId}`);
//             handleScreenShareStream(userId, stream);
//           } else {
//             handleRemoteStream(userId, stream);
//           }
//         }
//       };

//       // ICE candidate handling
//       pc.onicecandidate = (event) => {
//         if (event.candidate && socket) {
//           socket.emit('group_call_ice_candidate', {
//             callId: callData.callId,
//             targetUserId: userId,
//             candidate: event.candidate,
//             senderId: currentUserId,
//             callType: callData.type
//           });
//         }
//       };

//       // Connection state monitoring
//       pc.oniceconnectionstatechange = () => {
//         const state = pc.iceConnectionState;
//         updateConnectionState(userId, state);
//       };

//       peerConnections.current[userId] = pc;

//       // Create offer if initiator
//       if (isInitiator) {
//         try {
//           const offer = await pc.createOffer({
//             offerToReceiveAudio: true,
//             offerToReceiveVideo: callData.type === 'video' || isSharingScreen // Always receive video for screen share capability
//           });

//           await pc.setLocalDescription(offer);

//           socket.emit('group_call_offer', {
//             callId: callData.callId,
//             targetUserId: userId,
//             offer: offer,
//             callerId: currentUserId,
//             callType: callData.type,
//             isScreenShare: isSharingScreen // Send if we're sharing screen
//           });

//           console.log(`📤 Sent offer to ${userId} (isScreenShare: ${isSharingScreen})`);

//         } catch (error) {
//           console.error(`Error creating offer for ${userId}:`, error);
//         }
//       }

//       // Handle pending candidates
//       if (pendingCandidates.current[userId]) {
//         pendingCandidates.current[userId].forEach(candidate => {
//           pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e =>
//             console.error(`Error adding pending ICE candidate:`, e)
//           );
//         });
//         delete pendingCandidates.current[userId];
//       }

//       return pc;

//     } catch (error) {
//       console.error(`Error creating peer connection to ${userId}:`, error);
//       return null;
//     }
//   };

//   const handleRemoteStream = (userId, stream) => {
//     console.log(`📹 Remote stream from ${userId}:`, {
//       audioTracks: stream.getAudioTracks().length,
//       videoTracks: stream.getVideoTracks().length
//     });

//     setParticipantStreams(prev => ({
//       ...prev,
//       [userId]: stream
//     }));

//     setTimeout(() => {
//       const container = document.getElementById(`media-container-${userId}`);
//       if (!container) return;

//       const existingMedia = container.querySelectorAll('video, audio');
//       existingMedia.forEach(el => {
//         el.srcObject = null;
//         el.remove();
//       });

//       const hasVideo = stream.getVideoTracks().length > 0;
//       const hasAudio = stream.getAudioTracks().length > 0;

//       if (hasVideo) {
//         const video = document.createElement('video');
//         video.id = `video-${userId}`;
//         video.autoplay = true;
//         video.playsInline = true;
//         video.muted = false;
//         video.srcObject = stream;
//         video.style.width = '100%';
//         video.style.height = '100%';
//         video.style.objectFit = 'cover';
//         video.style.borderRadius = '8px';

//         video.onloadedmetadata = () => {
//           video.play().catch(e => console.log(`Video play error: ${e}`));
//         };

//         container.appendChild(video);
//         videoRefs.current[userId] = video;

//       } else if (hasAudio) {
//         const audio = document.createElement('audio');
//         audio.id = `audio-${userId}`;
//         audio.autoplay = true;
//         audio.srcObject = stream;
//         audio.volume = 1.0;

//         audio.onloadedmetadata = () => {
//           audio.play().catch(e => console.log(`Audio play error: ${e}`));
//         };

//         container.appendChild(audio);
//         videoRefs.current[userId] = audio;
//       }
//     }, 100);
//   };

//   const handleScreenShareStream = (userId, stream) => {
//     console.log(`🎬 Setting screen share stream from ${userId}:`, stream);
    
//     setActiveScreenSharer(userId);
    
//     if (screenShareVideoRef.current) {
//       console.log('🎯 Setting screen share video element source');
//       screenShareVideoRef.current.srcObject = stream;
      
//       screenShareVideoRef.current.onloadedmetadata = () => {
//         console.log('✅ Screen share video metadata loaded');
//         screenShareVideoRef.current.play().catch(e => {
//           console.log('❌ Screen share video play error:', e);
//         });
//       };
      
//       screenShareVideoRef.current.onplaying = () => {
//         console.log('▶️ Screen share video started playing');
//       };
      
//       screenShareVideoRef.current.onerror = (e) => {
//         console.error('❌ Screen share video error:', e);
//       };
//     } else {
//       console.log('❌ Screen share video ref not available');
//     }
//   };

//   const handleIncomingOffer = async (callerId, offer, callerSocketId, isScreenShare = false) => {
//     console.log('📥 Handling incoming offer:', {
//       callerId,
//       isScreenShare,
//       offerType: offer.type,
//       isActiveScreenSharer: activeScreenSharer === callerId
//     });

//     try {
//       // Close existing connection if it exists
//       if (peerConnections.current[callerId]) {
//         console.log('📞 Existing connection found, closing...');
//         closePeerConnection(callerId);
//       }

//       if (!mediaStreamRef.current && !isScreenShare) {
//         if (!pendingOffers.current[callerId]) {
//           pendingOffers.current[callerId] = [];
//         }
//         pendingOffers.current[callerId].push({ offer, callerSocketId, isScreenShare });
//         return;
//       }

//       // Create new peer connection
//       const pc = await createPeerConnection(callerId, false);
//       if (!pc) {
//         console.log('❌ Failed to create peer connection');
//         return;
//       }

//       await pc.setRemoteDescription(new RTCSessionDescription(offer));
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);

//       socket.emit('group_call_answer', {
//         callId: callData.callId,
//         callerSocketId: callerSocketId,
//         answer: answer,
//         responderId: currentUserId,
//         callType: callData.type,
//         isScreenShare
//       });

//       console.log('✅ Sent answer back');

//     } catch (error) {
//       console.error(`Error handling offer from ${callerId}:`, error);
//     }
//   };

//   const handleIncomingAnswer = async (responderId, answer, isScreenShare = false) => {
//     try {
//       console.log('📤 Handling incoming answer:', {
//         responderId,
//         isScreenShare,
//         answerType: answer.type
//       });

//       const pc = peerConnections.current[responderId];

//       if (!pc) {
//         console.log('❌ No peer connection found for:', responderId);
//         return;
//       }

//       if (pc.signalingState === 'stable') {
//         console.log('✅ Connection already stable');
//         return;
//       }

//       await pc.setRemoteDescription(new RTCSessionDescription(answer));
//       console.log('✅ Answer processed successfully');

//     } catch (error) {
//       console.error(`Error handling answer from ${responderId}:`, error);
//     }
//   };

//   const handleIncomingIceCandidate = async (senderId, candidate) => {
//     try {
//       console.log('🧊 Handling ICE candidate from:', senderId);
      
//       const pc = peerConnections.current[senderId];

//       if (!pc) {
//         console.log('⚠️ No peer connection, caching candidate');
//         if (!pendingCandidates.current[senderId]) {
//           pendingCandidates.current[senderId] = [];
//         }
//         pendingCandidates.current[senderId].push(candidate);
//         return;
//       }

//       await pc.addIceCandidate(new RTCIceCandidate(candidate));
//       ringtoneService.stop();

//     } catch (error) {
//       console.error(`Error adding ICE candidate from ${senderId}:`, error);
//     }
//   };

//   const startScreenSharing = async () => {
//     try {
//       console.log('🖥️ Starting screen sharing...');
      
//       const screenStream = await navigator.mediaDevices.getDisplayMedia({
//         video: {
//           cursor: 'always',
//           displaySurface: 'monitor',
//           width: { ideal: 1920 },
//           height: { ideal: 1080 },
//           frameRate: { ideal: 30 }
//         },
//         audio: true
//       });

//       console.log('✅ Screen share stream acquired:', {
//         videoTracks: screenStream.getVideoTracks().length,
//         audioTracks: screenStream.getAudioTracks().length
//       });

//       screenShareRef.current = screenStream;
//       setScreenShareStream(screenStream);
//       setIsSharingScreen(true);
      
//       // Set ourselves as active screen sharer immediately
//       setActiveScreenSharer(currentUserId);
      
//       // Show our own screen share preview immediately
//       if (screenShareVideoRef.current) {
//         screenShareVideoRef.current.srcObject = screenStream;
//         screenShareVideoRef.current.onloadedmetadata = () => {
//           screenShareVideoRef.current.play().catch(e =>
//             console.log('Self screen share play error:', e)
//           );
//         };
//       }

//       // Notify server that we started screen sharing
//       socket.emit('group_call_start_screen_share', {
//         callId: callData.callId,
//         userId: currentUserId,
//         hasAudio: screenStream.getAudioTracks().length > 0,
//         hasVideo: true
//       });

//       console.log('📤 Notified server about screen share start');

//       // Send screen share to all existing participants
//       participants.forEach(userId => {
//         setTimeout(async () => {
//           try {
//             // Close existing connection and create new one with screen share
//             if (peerConnections.current[userId]) {
//               closePeerConnection(userId);
//             }

//             // Create new connection with screen share
//             const pc = await createPeerConnection(userId, true);
//             if (pc) {
//               console.log(`✅ Created new connection with screen share for ${userId}`);
//             }
            
//           } catch (error) {
//             console.error(`Error sending screen share to ${userId}:`, error);
//           }
//         }, 500);
//       });

//       // Handle when user stops screen sharing via browser controls
//       screenStream.getVideoTracks()[0].onended = () => {
//         console.log('🖥️ Screen share ended via browser controls');
//         stopScreenSharing();
//       };

//       console.log('✅ Screen sharing started successfully');

//     } catch (error) {
//       console.error('❌ Failed to start screen sharing:', error);
//       setIsSharingScreen(false);
//       setActiveScreenSharer(null);
//     }
//   };

//   const stopScreenSharing = async () => {
//     console.log('🛑 Stopping screen sharing...');

//     // Stop our own screen share
//     if (screenShareRef.current) {
//       screenShareRef.current.getTracks().forEach(track => {
//         track.stop();
//         track.enabled = false;
//       });
//       screenShareRef.current = null;
//       setScreenShareStream(null);
//     }

//     // Clear video element
//     if (screenShareVideoRef.current) {
//       screenShareVideoRef.current.srcObject = null;
//     }

//     // Update state
//     setIsSharingScreen(false);
    
//     if (activeScreenSharer === currentUserId) {
//       setActiveScreenSharer(null);
//       setScreenShareView('big');
//     }

//     // Notify server
//     if (socket) {
//       socket.emit('group_call_stop_screen_share', {
//         callId: callData.callId,
//         userId: currentUserId,
//         timestamp: Date.now()
//       });
//     }

//     // Remove screen share tracks from all connections
//     participants.forEach(userId => {
//       const pc = peerConnections.current[userId];
//       if (pc) {
//         // Find and remove screen share video track
//         const videoSenders = pc.getSenders().filter(s => 
//           s.track && s.track.kind === 'video' && s.track.label.includes('screen')
//         );
        
//         videoSenders.forEach(sender => {
//           sender.replaceTrack(null);
//         });

//         // For voice calls, we might need to renegotiate without video
//         if (callData.type === 'voice') {
//           setTimeout(async () => {
//             try {
//               const offer = await pc.createOffer({
//                 offerToReceiveAudio: true,
//                 offerToReceiveVideo: false // Don't receive video for voice call
//               });
//               await pc.setLocalDescription(offer);
              
//               socket.emit('group_call_offer', {
//                 callId: callData.callId,
//                 targetUserId: userId,
//                 offer: pc.localDescription,
//                 callerId: currentUserId,
//                 callType: callData.type
//               });
//             } catch (error) {
//               console.error(`Error renegotiating after screen share stop:`, error);
//             }
//           }, 500);
//         }
//       }
//     });

//     console.log('✅ Screen sharing stopped');
//   };

//   const joinGroupCall = () => {
//     if (!socket) return;

//     socket.emit('join_group_call', {
//       callId: callData.callId,
//       userId: currentUserId
//     });

//     socket.emit('get_group_call_participants', {
//       callId: callData.callId
//     });
//   };

//   const updateConnectionState = (userId, state) => {
//     setConnectionStates(prev => ({
//       ...prev,
//       [userId]: state
//     }));
//   };

//   const removeParticipant = (userId) => {
//     setParticipants(prev => prev.filter(id => id !== userId));
//     setParticipantStreams(prev => {
//       const newStreams = { ...prev };
//       delete newStreams[userId];
//       return newStreams;
//     });
//     setParticipantNames(prev => {
//       const newNames = { ...prev };
//       delete newNames[userId];
//       return newNames;
//     });
//   };

//   const closePeerConnection = (userId) => {
//     const pc = peerConnections.current[userId];
//     if (pc) {
//       pc.close();
//       delete peerConnections.current[userId];
//     }

//     const video = videoRefs.current[userId];
//     if (video) {
//       video.srcObject = null;
//       video.remove();
//       delete videoRefs.current[userId];
//     }

//     if (pendingCandidates.current[userId]) {
//       delete pendingCandidates.current[userId];
//     }

//     if (pendingOffers.current[userId]) {
//       delete pendingOffers.current[userId];
//     }

//     updateConnectionState(userId, 'closed');
//   };

//   const cleanup = () => {
//     console.log('🧹 Cleaning up group call...');
    
//     if (isSharingScreen) {
//       stopScreenSharing();
//     }

//     Object.keys(peerConnections.current).forEach(userId => {
//       closePeerConnection(userId);
//     });
//     peerConnections.current = {};

//     if (mediaStreamRef.current) {
//       mediaStreamRef.current.getTracks().forEach(track => {
//         track.stop();
//       });
//       mediaStreamRef.current = null;
//       setLocalStream(null);
//     }

//     if (screenShareRef.current) {
//       screenShareRef.current.getTracks().forEach(track => track.stop());
//       screenShareRef.current = null;
//       setScreenShareStream(null);
//     }

//     Object.keys(videoRefs.current).forEach(userId => {
//       const video = videoRefs.current[userId];
//       if (video) {
//         video.srcObject = null;
//         video.remove();
//       }
//     });
//     videoRefs.current = {};

//     pendingCandidates.current = {};
//     pendingOffers.current = {};

//     setParticipants([]);
//     setParticipantStreams({});
//     setConnectionStates({});
//     setActiveScreenSharer(null);
//     setScreenShareView('big');
//     setCallTimer(0);
//     callStartTime.current = null;
    
//     console.log('✅ Cleanup complete');
//   };

//   const acceptCall = async () => {
//     setCallStatus('active');
//     callStartTime.current = new Date();

//     Object.keys(pendingOffers.current).forEach(callerId => {
//       const offers = pendingOffers.current[callerId];
//       offers.forEach(async (offerData) => {
//         await handleIncomingOffer(callerId, offerData.offer, offerData.callerSocketId, offerData.isScreenShare);
//       });
//     });
//     pendingOffers.current = {};

//     joinGroupCall();

//     if (onAcceptCall) {
//       onAcceptCall();
//     }
//   };

//   const toggleMute = () => {
//     if (mediaStreamRef.current) {
//       const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
//       if (audioTrack) {
//         audioTrack.enabled = !audioTrack.enabled;
//         setIsMuted(!audioTrack.enabled);
//       }
//     }
//   };

//   const toggleVideo = () => {
//     if (mediaStreamRef.current && callData.type === 'video') {
//       const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
//       if (videoTrack) {
//         videoTrack.enabled = !videoTrack.enabled;
//         setIsVideoEnabled(videoTrack.enabled);

//         Object.values(peerConnections.current).forEach(pc => {
//           const sender = pc.getSenders().find(s =>
//             s.track && s.track.kind === 'video'
//           );
//           if (sender) {
//             sender.replaceTrack(videoTrack);
//           }
//         });
//       }
//     }
//   };

//   const toggleScreenShareView = () => {
//     setScreenShareView(prev => prev === 'big' ? 'small' : 'big');
//   };

//   const handleEndCall = () => {
//     console.log('📞 Ending call...');
    
//     if (socket) {
//       const eventName = callData.type === 'video' ? 'group_video_call_end' : 'group_voice_call_end';
      
//       let shouldEndForEveryone = false;
      
//       if (participants.length === 1) {
//         shouldEndForEveryone = true;
//       } else if (currentUserId === callData.callerId) {
//         shouldEndForEveryone = true;
//       } else if (participants.length === 0) {
//         shouldEndForEveryone = true;
//       }
      
//       socket.emit(eventName, {
//         callId: callData.callId,
//         groupId: callData.groupId,
//         userId: currentUserId,
//         isCaller: currentUserId === callData.callerId,
//         shouldEndForEveryone: shouldEndForEveryone
//       });

//       socket.emit('leave_group_call', {
//         callId: callData.callId,
//         userId: currentUserId,
//         forceEnd: shouldEndForEveryone
//       });
//     }

//     cleanup();
    
//     if (onEndCall) {
//       onEndCall();
//     }
//   };

//   // INCOMING CALL UI (same as before)
//   if (isIncoming && callStatus === 'ringing' && !isMinimized) {
//     return (
//       <div className="fixed top-6 right-6 z-50 animate-fade-in">
//         <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl p-6 w-96 border border-gray-800">
//           <div className="flex items-center justify-between mb-6">
//             <div className="flex items-center space-x-3">
//               <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
//                 <Users className="w-6 h-6 text-white" />
//               </div>
//               <div>
//                 <h3 className="text-white font-semibold text-lg">
//                   {callData.groupName || 'Group Call'}
//                 </h3>
//                 <p className="text-gray-400 text-sm flex items-center">
//                   <Users className="w-3 h-3 mr-1" />
//                   Incoming {callData.type === 'video' ? 'Video' : 'Voice'} Group Call
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

//           <div className="mb-6">
//             <div className="bg-gray-800/50 rounded-xl p-4">
//               <div className="aspect-video bg-black rounded-lg overflow-hidden mb-3">
//                 {callData.type === 'video' && localStream ? (
//                   <video
//                     ref={localVideoRef}
//                     autoPlay
//                     playsInline
//                     muted
//                     className="w-full h-full object-cover"
//                   />
//                 ) : (
//                   <div className="w-full h-full flex flex-col items-center justify-center">
//                     <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3">
//                       <Users className="w-8 h-8 text-white" />
//                     </div>
//                     <p className="text-gray-400">Group Preview</p>
//                   </div>
//                 )}
//               </div>
//               <p className="text-gray-400 text-sm text-center">
//                 {callData.type === 'video' ? 'Your preview' : 'Group audio call'}
//               </p>
//             </div>
//           </div>

//           <div className="flex space-x-3">
//             <button
//               onClick={onRejectCall || handleEndCall}
//               className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
//             >
//               <PhoneOff className="w-5 h-5 group-hover:rotate-90 transition-transform" />
//               <span>Decline</span>
//             </button>
//             <button
//               onClick={acceptCall}
//               className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group"
//             >
//               <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
//               <span>Join Group</span>
//             </button>
//           </div>

//           <div className="mt-4 pt-4 border-t border-gray-800">
//             <div className="flex items-center justify-between text-gray-400 text-sm">
//               <span>Call Type</span>
//               <span className="text-white">
//                 {callData.type === 'video' ? '🎥 Video' : '🔊 Voice'} Group Call
//               </span>
//             </div>
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
//               <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center animate-pulse">
//                 <Users className="w-4 h-4 text-white" />
//               </div>
//               <div>
//                 <p className="text-white text-sm font-medium">
//                   Incoming {callData.type === 'video' ? 'Video' : 'Voice'}
//                 </p>
//                 <p className="text-gray-400 text-xs">Group Call</p>
//               </div>
//             </div>
//             <div className="flex space-x-1">
//               <button
//                 onClick={acceptCall}
//                 className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
//               >
//                 <Users className="w-4 h-4 text-white" />
//               </button>
//               <button
//                 onClick={onRejectCall || handleEndCall}
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

//   // ACTIVE GROUP CALL UI
//   return (
//     <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-black flex flex-col z-50">
//       {/* Top Bar */}
//       <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-4">
//         <div className="max-w-6xl mx-auto flex items-center justify-between">
//           <div className="flex items-center space-x-4">
//             <div className={`w-3 h-3 rounded-full ${callStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
//             <div>
//               <h1 className="text-white font-semibold text-lg">
//                 {callData.groupName || 'Group Call'}
//               </h1>
//               <div className="flex items-center space-x-2 text-gray-400 text-sm">
//                 <Clock className="w-4 h-4" />
//                 <span>{formatTime(callTimer)}</span>
//                 <span>•</span>
//                 <span>{participants.length + 1} participants</span>
//                 <span>•</span>
//                 <span>{callData.type === 'video' ? '🎥 Video' : '🔊 Voice'}</span>
//                 {activeScreenSharer && (
//                   <>
//                     <span>•</span>
//                     <span className="text-blue-400 flex items-center">
//                       <ScreenShare className="w-4 h-4 mr-1" />
//                       {getParticipantName(activeScreenSharer)} is sharing screen
//                     </span>
//                   </>
//                 )}
//               </div>
//             </div>
//           </div>

//           <div className="flex items-center space-x-2">
//             <button
//               onClick={() => setIsMinimized(true)}
//               className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
//             >
//               <Minimize2 className="w-5 h-5" />
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="flex-1 p-4 overflow-auto">
//         <div className="max-w-6xl mx-auto">
//           {/* Big Screen Share Display */}
//           {activeScreenSharer && screenShareView === 'big' && (
//             <div className="mb-6 bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden animate-fade-in">
//               <div className="p-4 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between">
//                 <div className="flex items-center space-x-3">
//                   <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
//                     <ScreenShare className="w-5 h-5 text-white" />
//                   </div>
//                   <div>
//                     <h3 className="text-white font-semibold">
//                       {getParticipantName(activeScreenSharer)} is sharing screen
//                     </h3>
//                     <p className="text-gray-400 text-sm">
//                       {callData.type === 'video' ? '🎥 Video Call' : '🔊 Voice Call'}
//                     </p>
//                   </div>
//                 </div>
//                 <div className="flex items-center space-x-3">
//                   <button
//                     onClick={toggleScreenShareView}
//                     className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
//                     title="Switch to small view"
//                   >
//                     <Minimize2 className="w-5 h-5" />
//                   </button>
//                   {activeScreenSharer === currentUserId && (
//                     <button
//                       onClick={stopScreenSharing}
//                       className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
//                     >
//                       <ScreenShareOff className="w-4 h-4" />
//                       <span>Stop Sharing</span>
//                     </button>
//                   )}
//                 </div>
//               </div>
              
//               <div className="p-4 bg-black">
//                 <div className="relative bg-black rounded-xl overflow-hidden h-[500px] flex items-center justify-center">
//                   {/* Screen Share Video */}
//                   <video
//                     ref={screenShareVideoRef}
//                     autoPlay
//                     playsInline
//                     className="w-full h-full object-contain"
//                     style={{ backgroundColor: 'black' }}
//                     onError={(e) => console.error('Screen share video error:', e)}
//                   />
                  
//                   {/* Loading/Status Overlay - Show only if we're waiting for screen share from others */}
//                   {activeScreenSharer !== currentUserId && !screenShareVideoRef.current?.srcObject && (
//                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-900/20 to-purple-900/20">
//                       <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
//                         <ScreenShare className="w-10 h-10 text-white" />
//                       </div>
//                       <p className="text-blue-400 font-medium text-lg mb-2">
//                         Waiting for screen share...
//                       </p>
//                       <p className="text-gray-400 text-center max-w-md">
//                         {getParticipantName(activeScreenSharer)} is sharing their screen
//                       </p>
//                       <div className="mt-4 flex items-center space-x-2 text-gray-500 text-sm">
//                         <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
//                         <span>Connecting...</span>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Small Screen Share Display */}
//           {activeScreenSharer && screenShareView === 'small' && (
//             <div className="mb-6">
//               <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
//                 <div className="p-3 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between">
//                   <div className="flex items-center space-x-2">
//                     <ScreenShare className="w-4 h-4 text-blue-400" />
//                     <span className="text-white font-medium">
//                       {getParticipantName(activeScreenSharer)} is sharing
//                     </span>
//                   </div>
//                   <div className="flex items-center space-x-2">
//                     <button
//                       onClick={toggleScreenShareView}
//                       className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded"
//                       title="Maximize screen share"
//                     >
//                       <Maximize2 className="w-4 h-4" />
//                     </button>
//                     {activeScreenSharer === currentUserId && (
//                       <button
//                         onClick={stopScreenSharing}
//                         className="text-red-400 hover:text-red-300 text-xs font-medium px-2 py-1 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors"
//                       >
//                         Stop
//                       </button>
//                     )}
//                   </div>
//                 </div>
//                 <div className="p-2 bg-black">
//                   <div className="aspect-video bg-black rounded overflow-hidden">
//                     <video
//                       ref={screenShareVideoRef}
//                       autoPlay
//                       playsInline
//                       className="w-full h-full object-contain"
//                     />
//                     {activeScreenSharer !== currentUserId && !screenShareVideoRef.current?.srcObject && (
//                       <div className="absolute inset-0 flex items-center justify-center bg-black/80">
//                         <div className="text-center">
//                           <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
//                           <p className="text-blue-400 text-sm">Loading...</p>
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Participants Grid */}
//           <div className={`grid gap-4 ${
//             activeScreenSharer && screenShareView === 'big' 
//               ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
//               : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
//           }`}>
//             {/* Local User */}
//             <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden h-64">
//               <div className="p-3 border-b border-gray-800">
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center space-x-2">
//                     <div className={`w-2 h-2 rounded-full ${localStream ? 'bg-green-500' : 'bg-yellow-500'}`} />
//                     <span className="text-white font-medium">You</span>
//                   </div>
//                   <div className="flex items-center space-x-1">
//                     {isMuted && (
//                       <div className="bg-red-500/20 px-2 py-1 rounded text-xs text-red-400">
//                         Muted
//                       </div>
//                     )}
//                     {isSharingScreen && (
//                       <div className="bg-blue-500/20 px-2 py-1 rounded text-xs text-blue-400 animate-pulse">
//                         Sharing
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </div>

//               <div className="p-3 h-full flex flex-col">
//                 {callData.type === 'video' ? (
//                   <div className="relative flex-1 bg-black rounded-lg overflow-hidden">
//                     <video
//                       ref={localVideoRef}
//                       autoPlay
//                       playsInline
//                       muted
//                       className="w-full h-full object-cover"
//                     />
//                     {!isVideoEnabled && (
//                       <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
//                         <VideoOff className="w-8 h-8 text-gray-600" />
//                       </div>
//                     )}
//                   </div>
//                 ) : (
//                   <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-lg p-4">
//                     <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-3">
//                       <User className="w-8 h-8 text-white" />
//                     </div>
//                     <span className="text-white font-medium">You</span>
//                     <div className="flex items-center space-x-2 mt-2">
//                       {isMuted ? (
//                         <MicOff className="w-4 h-4 text-red-400" />
//                       ) : (
//                         <Mic className="w-4 h-4 text-green-400" />
//                       )}
//                       {isSharingScreen && (
//                         <ScreenShare className="w-4 h-4 text-blue-400 animate-pulse" />
//                       )}
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </div>

//             {/* Remote Participants */}
//             {participants
//               .filter(userId => !(activeScreenSharer === userId && screenShareView === 'big' && callData.type === 'video'))
//               .map(userId => (
//               <div key={userId} className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden h-64">
//                 <div className="p-3 border-b border-gray-800">
//                   <div className="flex items-center justify-between">
//                     <div className="flex items-center space-x-2">
//                       <div className={`w-2 h-2 rounded-full ${participantStreams[userId] ? 'bg-green-500' : 'bg-yellow-500'}`} />
//                       <span className="text-white font-medium truncate">
//                         {getParticipantName(userId)}
//                       </span>
//                     </div>
//                     {activeScreenSharer === userId && (
//                       <div className="flex items-center space-x-1 bg-blue-500/20 px-2 py-1 rounded text-xs text-blue-400 animate-pulse">
//                         <ScreenShare className="w-3 h-3" />
//                         <span>Sharing</span>
//                       </div>
//                     )}
//                   </div>
//                 </div>

//                 <div className="p-3 h-full flex flex-col">
//                   <div
//                     id={`media-container-${userId}`}
//                     className={`relative flex-1 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-lg overflow-hidden flex items-center justify-center`}
//                   >
//                     {callData.type === 'video' ? (
//                       !participantStreams[userId] && (
//                         <div className="text-center p-4">
//                           <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
//                             <User className="w-6 h-6 text-gray-400" />
//                           </div>
//                           <p className="text-gray-400 text-sm">
//                             {connectionStates[userId] === 'connected' ? 'Connected' : 'Connecting...'}
//                           </p>
//                         </div>
//                       )
//                     ) : (
//                       <div className="text-center p-4">
//                         <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
//                           connectionStates[userId] === 'connected' ? 'bg-green-500/20 border border-green-500/30' :
//                           connectionStates[userId] === 'connecting' ? 'bg-yellow-500/20 border border-yellow-500/30' :
//                           'bg-gray-700'
//                         }`}>
//                           <User className="w-6 h-6 text-gray-300" />
//                         </div>
//                         <p className="text-gray-300 font-medium mb-1">{getParticipantName(userId)}</p>
//                         <p className="text-gray-400 text-xs">
//                           {participantStreams[userId] ?
//                             (connectionStates[userId] === 'connected' ? 'Speaking' : 'Connected') :
//                             (connectionStates[userId] || 'Connecting...')}
//                         </p>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>

//       {/* Controls Panel */}
//       <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 p-4">
//         <div className="max-w-6xl mx-auto">
//           <div className="flex flex-col lg:flex-row gap-6">
//             {/* Left: Call Info */}
//             <div className="lg:w-64 bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
//               <h3 className="text-white font-semibold text-lg mb-4">Call Information</h3>
//               <div className="space-y-3">
//                 <div className="flex justify-between items-center">
//                   <span className="text-gray-400">Duration</span>
//                   <span className="text-white font-mono">{formatTime(callTimer)}</span>
//                 </div>
//                 <div className="flex justify-between items-center">
//                   <span className="text-gray-400">Participants</span>
//                   <span className="text-white">{participants.length + 1}</span>
//                 </div>
//                 <div className="flex justify-between items-center">
//                   <span className="text-gray-400">Type</span>
//                   <span className={`${callData.type === 'video' ? 'text-blue-400' : 'text-green-400'}`}>
//                     {callData.type === 'video' ? '🎥 Video Group' : '🔊 Voice Group'}
//                   </span>
//                 </div>
//                 <div className="flex justify-between items-center">
//                   <span className="text-gray-400">Status</span>
//                   <span className={`${callStatus === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
//                     {callStatus === 'active' ? 'Active' : 'Connecting...'}
//                   </span>
//                 </div>
//                 {activeScreenSharer && (
//                   <div className="pt-3 border-t border-gray-800">
//                     <div className="flex items-center space-x-2">
//                       <ScreenShare className="w-4 h-4 text-blue-400 animate-pulse" />
//                       <div>
//                         <p className="text-blue-400 text-sm font-medium">Screen Sharing</p>
//                         <p className="text-blue-400/70 text-xs">
//                           by {getParticipantName(activeScreenSharer)}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </div>

//             {/* Right: Controls */}
//             <div className="flex-1">
//               <div className="flex justify-center items-center space-x-6">
//                 <button
//                   onClick={toggleMute}
//                   className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
//                     isMuted
//                     ? 'bg-red-500 text-white hover:bg-red-600'
//                     : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
//                   }`}
//                   title={isMuted ? 'Unmute' : 'Mute'}
//                 >
//                   {isMuted ? (
//                     <MicOff className="w-6 h-6" />
//                   ) : (
//                     <Mic className="w-6 h-6" />
//                   )}
//                 </button>

//                 {callData.type === 'video' && (
//                   <button
//                     onClick={toggleVideo}
//                     className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
//                       isVideoEnabled
//                       ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
//                       : 'bg-red-500 text-white hover:bg-red-600'
//                     }`}
//                     title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
//                   >
//                     {isVideoEnabled ? (
//                       <Video className="w-6 h-6" />
//                     ) : (
//                       <VideoOff className="w-6 h-6" />
//                     )}
//                   </button>
//                 )}

//                 <button
//                   onClick={isSharingScreen ? stopScreenSharing : startScreenSharing}
//                   className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
//                     isSharingScreen
//                     ? 'bg-blue-500 text-white hover:bg-blue-600 animate-pulse'
//                     : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
//                   }`}
//                   title={isSharingScreen ? 'Stop sharing screen' : 'Share screen'}
//                 >
//                   {isSharingScreen ? (
//                     <ScreenShareOff className="w-6 h-6" />
//                   ) : (
//                     <ScreenShare className="w-6 h-6" />
//                   )}
//                 </button>

//                 {activeScreenSharer && screenShareView === 'big' && (
//                   <button
//                     onClick={toggleScreenShareView}
//                     className="w-14 h-14 rounded-full flex items-center justify-center bg-purple-500 text-white hover:bg-purple-600 transition-all"
//                     title="Switch to small view"
//                   >
//                     <Minimize2 className="w-6 h-6" />
//                   </button>
//                 )}

//                 {activeScreenSharer && screenShareView === 'small' && (
//                   <button
//                     onClick={toggleScreenShareView}
//                     className="w-14 h-14 rounded-full flex items-center justify-center bg-purple-500 text-white hover:bg-purple-600 transition-all"
//                     title="Maximize screen share"
//                   >
//                     <Maximize2 className="w-6 h-6" />
//                   </button>
//                 )}

//                 <button
//                   onClick={handleEndCall}
//                   className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/25"
//                   title="Leave group call"
//                 >
//                   <PhoneOff className="w-7 h-7" />
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }