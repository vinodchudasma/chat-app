'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff, Video, X, Bell, AlertCircle } from 'lucide-react';

const CallNotificationManager = () => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isActiveTab, setIsActiveTab] = useState(true);
  const ringtoneRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const tabIdRef = useRef(Date.now() + '_' + Math.random().toString(36));
  const router = useRouter();

  // Initialize cross-tab communication
  useEffect(() => {
    // Create BroadcastChannel for tab communication
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannelRef.current = new BroadcastChannel('call_notifications');
      
      broadcastChannelRef.current.onmessage = (event) => {
        const { type, data, senderTabId } = event.data;
        
        // Skip messages from ourselves
        if (senderTabId === tabIdRef.current) return;
        
        
        switch (type) {
          case 'call_incoming':
            // Another tab received a call - show notification
            if (!document.hidden) {
              // This tab is visible - show notification
              handleIncomingCall(data);
            } else {
              // This tab is hidden - just store for later
              setIncomingCall(data);
            }
            break;
            
          case 'call_accepted':
            // Another tab accepted the call
            setIncomingCall(null);
            setShowNotification(false);
            stopRingtone();
            break;
            
          case 'call_rejected':
            // Another tab rejected the call
            setIncomingCall(null);
            setShowNotification(false);
            stopRingtone();
            break;
            
          case 'tab_status':
            // Another tab is now active
            if (data.isActive && data.tabId !== tabIdRef.current) {
              // Another tab became active, we should hide our notification
              setShowNotification(false);
              stopRingtone();
            }
            break;
        }
      };
    }

    // Also use localStorage events as fallback
    const handleStorageChange = (event) => {
      if (event.key === 'call_notification') {
        try {
          const callData = JSON.parse(event.newValue);
          if (callData && callData.callId) {
            // Check if this is from another tab
            if (callData.tabId !== tabIdRef.current) {
              handleIncomingCall(callData);
            }
          }
        } catch (error) {
          console.error('Error parsing storage event:', error);
        }
      }
      
      if (event.key === 'call_accepted' || event.key === 'call_rejected') {
        // Clear our notification if any tab accepted/rejected
        setIncomingCall(null);
        setShowNotification(false);
        stopRingtone();
        localStorage.removeItem('call_notification');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Track tab visibility
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsActiveTab(isVisible);
      
      // Notify other tabs about our status
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'tab_status',
          data: {
            tabId: tabIdRef.current,
            isActive: isVisible
          },
          senderTabId: tabIdRef.current
        });
      }
      
      // If tab becomes active and we have a pending call, show it
      if (isVisible && incomingCall && !showNotification) {
        setShowNotification(true);
        playRingtone();
      } else if (!isVisible && showNotification) {
        // Hide notification when tab loses focus (optional)
        setShowNotification(false);
        stopRingtone();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track user interaction for audio
    const handleUserInteraction = () => {
      setHasInteracted(true);
      // Remove listener after first interaction
      ['click', 'touchstart', 'keydown'].forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };

    ['click', 'touchstart', 'keydown'].forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });

    // Initialize audio
    try {
      const audio = new Audio('/ringtone.mp3');
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = 0.5;
      ringtoneRef.current = audio;
    } catch (error) {
      console.log('Audio init error:', error);
    }

    // Listen for incoming call events
    const handleIncomingCallEvent = (event) => {
      const callData = event.detail;
      
      if (!callData || !callData.callId) return;
      
      // Broadcast to other tabs
      broadcastToOtherTabs('call_incoming', callData);
      
      // Also store in localStorage for other tabs
      localStorage.setItem('call_notification', JSON.stringify({
        ...callData,
        tabId: tabIdRef.current,
        timestamp: Date.now()
      }));
      
      // Handle in this tab
      handleIncomingCall(callData);
    };

    window.addEventListener('incoming-call', handleIncomingCallEvent);

    // Cleanup
    return () => {
      window.removeEventListener('incoming-call', handleIncomingCallEvent);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopRingtone();
      
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  const broadcastToOtherTabs = (type, data) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type,
        data,
        senderTabId: tabIdRef.current
      });
    }
  };

  const handleIncomingCall = (callData) => {
    
    // Don't show duplicate notifications
    if (incomingCall?.callId === callData.callId) {
      console.log('Already showing this call, skipping');
      return;
    }
    
    // Check if another tab is already showing this call
    const lastCallTime = localStorage.getItem('last_call_shown');
    if (lastCallTime && Date.now() - parseInt(lastCallTime) < 1000) {
      console.log('Another tab just showed a call, skipping');
      return;
    }
    
    // Update state
    setIncomingCall(callData);
    setShowNotification(true);
    
    // Mark that we're showing this call
    localStorage.setItem('last_call_shown', Date.now().toString());
    
    // Try to play ringtone if tab is visible
    if (!document.hidden) {
      playRingtone();
    }
  };

  const playRingtone = async () => {
    if (!ringtoneRef.current || !hasInteracted) return false;
    
    try {
      await ringtoneRef.current.play();
      console.log('🔔 Ringtone playing');
      return true;
    } catch (error) {
      console.log('🔕 Ringtone blocked:', error.name);
      return false;
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const handleAccept = async () => {
    console.log(` Tab ${tabIdRef.current} accepting call`);
    
    if (!incomingCall) return;
    
    stopRingtone();
    setShowNotification(false);
    
    // Broadcast to other tabs that call was accepted
    broadcastToOtherTabs('call_accepted', incomingCall);
    localStorage.setItem('call_accepted', JSON.stringify(incomingCall));
    
    // Clear stored notification
    localStorage.removeItem('call_notification');
    localStorage.removeItem('last_call_shown');
    
    // Emit socket event
    if (window.socket) {
      const eventName = incomingCall.chatType === 'group'
        ? `group_${incomingCall.type}_call_accept`
        : `${incomingCall.type}_call_accept`;
      
      window.socket.emit(eventName, {
        callId: incomingCall.callId,
        targetUserId: incomingCall.callerId,
        ...(incomingCall.chatType === 'group' && { groupId: incomingCall.groupId })
      });
    }
    
    // Navigate or focus chat
    navigateToCall();
    
    // Clear state
    setTimeout(() => setIncomingCall(null), 500);
  };

  const handleDecline = async () => {
    
    stopRingtone();
    setShowNotification(false);
    
    if (!incomingCall) return;
    
    // Broadcast to other tabs
    broadcastToOtherTabs('call_rejected', incomingCall);
    localStorage.setItem('call_rejected', JSON.stringify(incomingCall));
    
    // Clear storage
    localStorage.removeItem('call_notification');
    localStorage.removeItem('last_call_shown');
    
    // Emit socket event
    if (window.socket) {
      const eventName = incomingCall.chatType === 'group'
        ? `group_${incomingCall.type}_call_reject`
        : `${incomingCall.type}_call_reject`;
      
      window.socket.emit(eventName, {
        callId: incomingCall.callId,
        targetUserId: incomingCall.callerId,
        ...(incomingCall.chatType === 'group' && { groupId: incomingCall.groupId })
      });
    }
    
    setTimeout(() => setIncomingCall(null), 500);
  };

  const navigateToCall = () => {
    if (!incomingCall) return;
    
    const currentPath = window.location.pathname;
    const isInChat = currentPath.includes('/chat/');
    
    if (isInChat) {
      // Already in chat - just focus the window
      window.focus();
      
      // If we're in a different chat, navigate to the call chat
      if (!currentPath.includes(`/chat/${incomingCall.chatType}/${incomingCall.chatId}`)) {
        router.push(`/chat/${incomingCall.chatType}/${incomingCall.chatId}`);
      }
    } else {
      // Not in chat - navigate to chat page
      router.push(`/chat/${incomingCall.chatType}/${incomingCall.chatId}`);
    }
  };

  // Don't show if:
  // 1. No call
  // 2. Tab is hidden (let the visible tab handle it)
  // 3. Another tab just showed a notification
  if (!showNotification || !incomingCall || document.hidden) {
    return null;
  }

  return (
    <IncomingCallNotification 
      call={incomingCall} 
      onAccept={handleAccept} 
      onDecline={handleDecline}
      canPlayAudio={hasInteracted}
      onPlayAudio={playRingtone}
      tabId={tabIdRef.current}
    />
  );
};

// Enhanced notification component with tab info
const IncomingCallNotification = ({ 
  call, 
  onAccept, 
  onDecline,
  canPlayAudio,
  onPlayAudio,
  tabId 
}) => {
  const [pulseAnimation, setPulseAnimation] = useState(true);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showTabWarning, setShowTabWarning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseAnimation(prev => !prev);
    }, 1000);

    // Check if multiple tabs are open
    if (typeof BroadcastChannel !== 'undefined') {
      const checkTabs = new BroadcastChannel('tab_check');
      checkTabs.postMessage({ type: 'ping', tabId });
      
      checkTabs.onmessage = (event) => {
        if (event.data.type === 'pong' && event.data.tabId !== tabId) {
          setShowTabWarning(true);
        }
      };
      
      setTimeout(() => checkTabs.close(), 1000);
    }

    // Try to play audio
    if (canPlayAudio && !audioPlaying) {
      onPlayAudio().then(success => {
        if (success) setAudioPlaying(true);
      });
    }

    return () => clearInterval(interval);
  }, [canPlayAudio, onPlayAudio, tabId]);

  const isVideoCall = call.type === 'video' || call.callType === 'video';
  const isGroupCall = call.chatType === 'group';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-gray-700">
        
        {/* Tab warning */}
        {showTabWarning && (
          <div className="bg-yellow-500/20 border-b border-yellow-500/30 p-3">
            <div className="flex items-center gap-2 text-yellow-300 text-sm">
              <AlertCircle size={16} />
              <span>Multiple tabs open. Answering here will close notification in other tabs.</span>
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="relative">
          <button
            onClick={onDecline}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10 p-2"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Caller Info */}
        <div className={`pt-12 pb-8 px-8 text-center ${showTabWarning ? 'pt-8' : 'pt-12'}`}>
          
          {/* Avatar */}
          <div className="relative inline-block mb-6">
            <div 
              className={`w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-5xl font-bold shadow-2xl transition-transform duration-500 ${pulseAnimation ? 'scale-105' : 'scale-100'}`}
            >
              {call.callerImage ? (
                <img 
                  src={call.callerImage} 
                  alt={call.callerName} 
                  className="w-full h-full rounded-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${call.callerName}&background=6366f1&color=fff&size=128`;
                  }}
                />
              ) : (
                <span>{call.callerName?.charAt(0)?.toUpperCase() || 'U'}</span>
              )}
            </div>
            
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full border-4 border-blue-400/30 animate-ping"></div>
            
            {/* Call type indicator */}
            <div className="absolute -bottom-2 -right-2 bg-gray-900 rounded-full p-2 border-2 border-gray-700">
              {isVideoCall ? (
                <Video size={20} className="text-green-400" />
              ) : (
                <Phone size={20} className="text-green-400" />
              )}
            </div>
          </div>

          {/* Caller Name */}
          <h2 className="text-3xl font-bold text-white mb-2">
            {call.callerName || 'Unknown Caller'}
          </h2>

          {/* Call Type */}
          <div className="flex items-center justify-center gap-2 text-gray-300 mb-2">
            <span className="text-lg">
              Incoming {isGroupCall ? 'Group ' : ''}{isVideoCall ? 'Video' : 'Voice'} Call
            </span>
          </div>

          {/* Group Name */}
          {isGroupCall && call.groupName && (
            <p className="text-gray-400 text-sm mt-1 mb-4">
              in {call.groupName}
            </p>
          )}

          {/* Audio status */}
          {!audioPlaying && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-center gap-2 text-yellow-300">
                <Bell size={16} />
                <span className="text-sm">Click anywhere to enable sound</span>
              </div>
            </div>
          )}

          {/* Ringing Indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`w-2 h-2 rounded-full ${pulseAnimation ? 'bg-green-500' : 'bg-green-300'}`}></div>
            <span className="text-gray-400 text-sm animate-pulse">Ringing...</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-8 pb-8 flex items-center justify-center gap-8">
          
          {/* Decline Button */}
          <button
            onClick={onDecline}
            className="group relative w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-red-500/50 flex items-center justify-center"
            aria-label="Decline call"
          >
            <PhoneOff size={32} className="text-white" />
            <span className="absolute -bottom-8 text-sm text-gray-300">Decline</span>
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="group relative w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-green-500/50 flex items-center justify-center animate-pulse"
            aria-label="Accept call"
          >
            {isVideoCall ? (
              <Video size={32} className="text-white" />
            ) : (
              <Phone size={32} className="text-white" />
            )}
            <span className="absolute -bottom-8 text-sm text-gray-300">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallNotificationManager;