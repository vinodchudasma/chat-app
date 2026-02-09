import { useRef, useState, useEffect } from "react";
import VoiceCall from "./VoiceCall";
import VideoCall from "./VideoCall";
import ConversationSummary from "./ConversationSummary";
import GroupProfileModal from "../GroupProfileModal";
import GroupCall from "./GroupCall";

export default function ChatHeader({
  chat,
  isConnected,
  isTyping,
  typingUser,
  currentUserId,
  onSelectChat,
  setShowSearch,
  startVoiceCall,
  startVideoCall,
  setShowGroupManager,
  activeCall,
  incomingCall,
  socket,
  endCall,
  acceptCall,
  rejectCall,
  onProfileClick,
}) {
  const [userStatus, setUserStatus] = useState({
    isOnline: false,
    status: "offline",
    lastSeen: null,
  });

  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showGroupProfile, setShowGroupProfile] = useState(false);

  const validatedChatRef = useRef(null);
  const statusIntervalRef = useRef(null);

  // Handler for profile/group click
  const handleProfileClick = () => {
    if (chat?.type === "private" && (chat.other_user?._id || chat.receiverId)) {
      if (onProfileClick) {
        onProfileClick(chat);
      }
    } else if (chat?.type === "group") {
      // For groups, open group details
      setShowGroupProfile(true);
    }
  };

  const chatName =
    chat?.name ||
    chat?.other_user_name ||
    chat?.other_user?.name ||
    "Unknown Chat";

  // Fetch user status
  const fetchUserStatus = async () => {
    if (!chat?.other_user?._id && !chat?.receiverId) return;

    if (chat) {
      setUserStatus({
        isOnline: chat.is_online,
        status: chat.status || "offline",
        lastSeen: chat.last_seen,
      });
    }
  };

  // Listen for real-time status updates via socket
  useEffect(() => {
    if (!socket) return;

    const handleUserStatusChange = (data) => {
      const userId = chat?.other_user?._id || chat?.receiverId;

      if (data.userId === userId) {
        setUserStatus({
          isOnline: data.isOnline,
          status: data.status || "offline",
          lastSeen: data.lastSeen,
        });
      }
    };

    socket.on("user_status_change", handleUserStatusChange);

    return () => {
      socket.off("user_status_change", handleUserStatusChange);
    };
  }, [socket, chat]);

  // Initial status fetch and periodic updates
  useEffect(() => {
    if (!chat) return;

    // Fetch initial status
    fetchUserStatus();

    // Set up periodic status updates
    statusIntervalRef.current = setInterval(() => {
      fetchUserStatus();
    }, 30000); // Update every 30 seconds

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [chat]);

  // Determine status display based on lastSeen
  const getStatusDisplay = () => {
    const { isOnline, status, lastSeen } = userStatus;

    // If user is typing, show typing indicator
    if (isTyping && typingUser !== currentUserId) {
      return {
        text: "Typing...",
        color: "bg-blue-500",
        dotColor: "bg-blue-500 animate-pulse",
        showLastSeen: false,
      };
    }

    // If user is online, show online status
    if (isOnline) {
      return {
        text: "Online",
        color: "bg-green-500",
        dotColor: "bg-green-500",
        showLastSeen: false,
      };
    }

    // If user has set status to "away"
    if (status === "away") {
      return {
        text: "Away",
        color: "bg-yellow-500",
        dotColor: "bg-yellow-500",
        showLastSeen: false,
      };
    }

    // If offline, calculate time since last seen
    if (lastSeen) {
      const lastSeenDate = new Date(lastSeen);
      const now = new Date();
      const diffInHours = Math.floor((now - lastSeenDate) / (1000 * 60 * 60));
      const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

      if (diffInMinutes < 1) {
        return {
          text: "Just now",
          color: "bg-gray-400",
          dotColor: "bg-gray-400",
          showLastSeen: false,
        };
      } else if (diffInMinutes < 60) {
        return {
          text: `${diffInMinutes} minutes ago`,
          color: "bg-gray-400",
          dotColor: "bg-gray-400",
          showLastSeen: true,
        };
      } else if (diffInHours < 2) {
        return {
          text: "1 hour ago",
          color: "bg-gray-400",
          dotColor: "bg-gray-400",
          showLastSeen: true,
        };
      } else if (diffInHours < 24) {
        return {
          text: `${diffInHours} hours ago`,
          color: "bg-gray-400",
          dotColor: "bg-gray-400",
          showLastSeen: true,
        };
      } else {
        // More than 24 hours - show date
        const formattedDate = lastSeenDate.toLocaleDateString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return {
          text: formattedDate,
          color: "bg-gray-400",
          dotColor: "bg-gray-400",
          showLastSeen: true,
        };
      }
    }

    // Default offline
    return {
      text: "Offline",
      color: "bg-gray-400",
      dotColor: "bg-gray-400",
      showLastSeen: false,
    };
  };

  const statusDisplay = getStatusDisplay();

  // Prepare group data with user_role
  const prepareGroupData = () => {
    if (chat?.type === "group") {
      // If chat data already has user_role, use it
      if (chat.user_role) {
        return chat;
      }

      // Otherwise, we need to get the user role from somewhere
      // This depends on your data structure
      return {
        ...chat,
        user_role: chat.user_role || "member", // default to member if not available
      };
    }
    return null;
  };

  return (
    <div className="chat-header bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onSelectChat(null)}
          className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={handleProfileClick}
          title={chat?.type === "group" ? "View group details" : "View profile"}
        >
          <div className="relative">
            <div
              className={`w-10 h-10 ${chat?.type === "group" ? "bg-gradient-to-br from-green-500 to-blue-600" : "bg-gradient-to-br from-blue-500 to-purple-600"} rounded-full flex items-center justify-center text-white font-semibold`}
            >
              {chatName.charAt(0).toUpperCase()}
            </div>
            {chat?.type === "private" && (
              <div
                className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${statusDisplay.dotColor} ${
                  userStatus.isOnline ? "animate-pulse" : ""
                }`}
              ></div>
            )}
            {chat?.type === "group" && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full bg-blue-500 flex items-center justify-center">
                <svg
                  className="w-2 h-2 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
              {chatName}
            </h2>
            <div className="flex items-center gap-2">
              {chat?.type === "private" ? (
                <div className="flex items-center space-x-1">
                  <p className="text-sm text-gray-500">
                    {isTyping && typingUser !== currentUserId
                      ? "Typing..."
                      : statusDisplay.text === "Offline"
                        ? "Offline"
                        : statusDisplay.text === "Online"
                          ? "Online"
                          : `Last seen ${statusDisplay.text}`}
                  </p>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <p className="text-sm text-gray-500">
                    {isTyping && typingUser !== currentUserId
                      ? "Someone Typing..."
                      : ""}
                  </p>
                </div>
              )}

              {/* Show admin badge for group if user is admin */}
              {chat?.type === "group" && chat?.user_role === "admin" && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                  Admin
                </span>
              )}

              {/* Last seen information */}
              {/* {statusDisplay.showLastSeen && userStatus.lastSeen && (
                <span className="text-xs text-gray-400">
                  Last seen: {statusDisplay.text}
                </span>
              )} */}

              {/* Status indicator with colors */}
              {userStatus.status === "away" && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full border border-yellow-200">
                  Away
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ConversationSummary
          chat={validatedChatRef.current}
          currentUserId={currentUserId}
        />

        {/* Search button */}
        <button
          onClick={() => setShowSearch((prev) => !prev)}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          title="Search messages"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>

        {/* Call buttons - disable if user is not online */}

        <>
          <button
            onClick={startVoiceCall}
            className={`p-2 rounded-full transition-colors cursor-pointer hover:bg-gray-100 text-gray-600`}
            title={userStatus.isOnline ? "Voice call" : "User is offline"}
            //disabled={!userStatus.isOnline}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </button>

          <button
            onClick={startVideoCall}
            className={`p-2 rounded-full transition-colors cursor-pointer hover:bg-gray-100 text-gray-600`}
            title={userStatus.isOnline ? "Video call" : "User is offline"}
            // disabled={!userStatus.isOnline}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
        </>
      </div>

      {/* Call Components */}
      {activeCall &&
        (activeCall.chatType === "group" ? (
          <GroupCall
            key={activeCall.callId}
            callData={activeCall}
            socket={socket}
            currentUserId={currentUserId}
          />
        ) : activeCall.type === "voice" ? (
          <VoiceCall
            callData={activeCall}
            key={`voice-call-${activeCall.callId}`}
            socket={socket}
            onEndCall={endCall}
            isGroupCall={chat?.type === "group"}
          />
        ) : (
          <VideoCall
            callData={activeCall}
            key={`video-call-${activeCall.callId}`} //  Add key here too
            socket={socket}
            onEndCall={endCall}
            isGroupCall={chat?.type === "group"}
          />
        ))}

      {incomingCall &&
        !activeCall && //  Only show if no active call
        (incomingCall.chatType === "group" ? (
          <GroupCall
            key={incomingCall.callId}
            callData={incomingCall}
            socket={socket}
            currentUserId={currentUserId}
            isIncoming={true}
          />
        ) : incomingCall.type === "voice" ? (
          <VoiceCall
            callData={incomingCall}
            key={`voice-call-${incomingCall.callId}`}
            socket={socket}
            onEndCall={endCall}
            onAcceptCall={acceptCall}
            onRejectCall={rejectCall}
            isIncoming={true}
            isGroupCall={chat?.type === "group"}
          />
        ) : (
          <VideoCall
            callData={incomingCall}
            key={`video-call-${incomingCall.callId}`} //  Same key format
            socket={socket}
            onEndCall={endCall}
            onAcceptCall={acceptCall}
            onRejectCall={rejectCall}
            isIncoming={true}
            isGroupCall={chat?.type === "group"}
          />
        ))}

      {showGroupProfile && (
        <GroupProfileModal
          groupId={chat?._id}
          isOpen={showGroupProfile}
          onClose={() => setShowGroupProfile(false)}
          groupData={prepareGroupData()}
          currentUserId={currentUserId}
          socket={socket}
        />
      )}
    </div>
  );
}
