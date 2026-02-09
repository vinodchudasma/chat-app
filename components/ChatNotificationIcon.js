'use client';

import { useState, useEffect } from 'react';

export default function ChatNotificationIcon({
  onClick,
  showBadge = true,
  totalUnread = 0,
  isOpen = false
}) {
  const [isHovering, setIsHovering] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [count, setCount] = useState(totalUnread);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (totalUnread > count) {
      setIsAnimating(true);
      setPulse(true);
      setTimeout(() => {
        setIsAnimating(false);
        setPulse(false);
      }, 1000);
    }
    setCount(totalUnread);
  }, [totalUnread, count]);

  return (
    <div
      data-notification-icon="true" // ✅ ADD THIS ATTRIBUTE
      className={`relative transition-all duration-300 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
    >
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={`
          relative w-16 h-16 
          bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500
          text-white rounded-full shadow-2xl 
          hover:shadow-3xl hover:scale-110 
          active:scale-95 
          transition-all duration-300 
          flex items-center justify-center 
          cursor-pointer
          ring-4 ring-white/30
          ${isAnimating ? 'animate-bounce' : ''}
          ${isHovering ? 'ring-8 ring-purple-300/40' : ''}
          ${pulse ? 'animate-pulse' : ''}
        `}
        title={count > 0 ? `${count} unread messages` : 'View conversations'}
        aria-label={count > 0 ? `${count} unread messages` : 'View conversations'}
      >
        {/* Animated background glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300"></div>

        {/* Chat Icon */}
        <svg
          className={`w-8 h-8 relative z-10 transition-transform duration-300 ${isHovering ? 'scale-110' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>

        {/* Unread badge */}
        {showBadge && count > 0 && (
          <span
            className={`
              absolute -top-2 -right-2 
              bg-red-500 text-white text-xs font-bold 
              rounded-full min-w-7 h-7
              flex items-center justify-center 
              shadow-lg border-3 border-white
              transition-all duration-300
              ${isAnimating ? 'animate-bounce scale-125' : 'animate-pulse'}
              ${count > 9 ? 'px-2' : 'w-7'}
              ${count > 99 ? 'text-[10px] px-1.5' : ''}
            `}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}

        {/* Sparkle effects on hover */}
        {isHovering && (
          <>
            <span className="absolute -top-1 -left-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping"></span>
            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-300 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></span>
            <span className="absolute top-0 -right-2 w-2 h-2 bg-pink-300 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></span>
          </>
        )}

        {/* New message indicator ring */}
        {count > 0 && !isHovering && (
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75"></span>
        )}
      </button>

      {/* Tooltip */}
      {isHovering && (
        <div className="absolute bottom-full right-0 mb-3 animate-fadeIn z-50">
          <div className="bg-gray-900 text-white text-sm py-2 px-4 rounded-xl shadow-2xl whitespace-nowrap">
            <div className="flex flex-col items-center">
              <span className="font-semibold">
                {count > 0 ? `${count} unread message${count > 1 ? 's' : ''}` : 'All conversations'}
              </span>
              <span className="text-xs text-gray-300 mt-1">
                Click to {isOpen ? 'close' : 'open'}
              </span>
            </div>
            <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
          </div>
        </div>
      )}

      {/* Notification waves animation */}
      {/* {count > 0 && (
        <>
          <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-40" style={{ animationDuration: '2s' }}></div>
          <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}></div>
        </>
      )} */}
    </div>
  );
}