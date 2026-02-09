'use client';

import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { tabFocusManager } from '../utils/tabFocus';

const IncomingCallNotification = ({ call, onAccept, onDecline }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [pulseAnimation, setPulseAnimation] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseAnimation(prev => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async () => {
    setIsVisible(false);
    
    // If we're in a background tab, focus/open the app first
    if (document.hidden) {
      const chatUrl = call.chatType === 'group' 
        ? `/chat/group/${call.groupId}?call=${call.callId}`
        : `/chat/private/${call.chatId}?call=${call.callId}`;
      
      // Focus existing tab or open new one
      await tabFocusManager.focusOrOpenApp(chatUrl);
      
      // Small delay to let the tab switch happen
      setTimeout(() => {
        onAccept();
      }, 500);
    } else {
      onAccept();
    }
  };

  const handleDecline = () => {
    setIsVisible(false);
    onDecline();
  };

  if (!isVisible) return null;

  const isVideoCall = call.type === 'video' || call.callType === 'video';
  const isGroupCall = call.chatType === 'group';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* ... your existing notification UI ... */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-gray-700">
        
        <div className="relative">
          <button
            onClick={handleDecline}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="pt-12 pb-8 px-8 text-center">
          {/* ... your existing UI ... */}
        </div>

        <div className="px-8 pb-8 flex items-center justify-center gap-8">
          <button
            onClick={handleDecline}
            className="group relative w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-red-500/50 flex items-center justify-center"
          >
            <PhoneOff size={32} className="text-white" />
            <span className="absolute -bottom-8 text-sm text-gray-300">Decline</span>
          </button>

          <button
            onClick={handleAccept}
            className="group relative w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-green-500/50 flex items-center justify-center animate-pulse"
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

export default IncomingCallNotification;