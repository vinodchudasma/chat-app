"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { setAuthToken, userAPI, chatAPI, groupAPI } from "../lib/api";
import { useSocket } from "../hooks/useSocket";
import FriendsList from "./FriendsList";
import GroupManager from "./GroupManager";
import ChatWindow from "./ChatWindow";
import VoiceCall from "./chatWindow/VoiceCall";
import VideoCall from "./chatWindow/VideoCall";
import LoadingSpinner from "./LoadingSpinner";
import { ToastElement } from "./toast";
import CallHistoryPage from "./CallHistoryPage";
import { ringtoneService } from "@/lib/ringtone-service";
import GroupCall from "./chatWindow/GroupCall";
import PopupNotificationPanel from "./PopupNotificationPanel";
import ChatNotificationIcon from "./ChatNotificationIcon";
import ChatWindowPopup from "./ChatWindowPopup";
import AllConversations from "./AllConversations";

export default function ChatDashboard() {
  const { getToken, userId, isLoaded } = useAuth();
  const { socket, isConnected, connectionError, lastHeartbeat, reconnect } =
    useSocket();
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const mountedRef = useRef(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Global call state
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [ringingAudio, setRingingAudio] = useState(null);

  // Server-side unread counts
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [unreadGroupsCount, setUnreadGroupsCount] = useState(0);

  const [mounted, setMounted] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [miniChats, setMiniChats] = useState([]); // Array of open mini chats
  const [nextPopupPosition, setNextPopupPosition] = useState({ x: 50, y: 50 });
  const notificationPanelRef = useRef(null);

  // Calculate position for a specific index
  const calculatePosition = (index, totalChats, panelOpen) => {
    const chatWidth = 380;
    const chatHeight = 500;
    const spacing = 20;
    const notificationPanelWidth = panelOpen ? 420 : 0;
    const bottomMargin = 100;

    // Calculate from right to left
    // rightmost chat is at index 0, leftmost at index (totalChats - 1)
    const rightOffset = notificationPanelWidth + 24 + spacing; // panel width + right margin + spacing

    return {
      x:
        window.innerWidth -
        rightOffset -
        (index + 1) * chatWidth -
        index * spacing,
      y: window.innerHeight - chatHeight - bottomMargin,
    };
  };

  // Open mini chat - Maximum 3 popups, FIFO (First In First Out)
  const openMiniChat = (chat) => {
    setMiniChats((prev) => {
      // Check if already open
      const existingIndex = prev.findIndex(
        (c) => c._id === chat._id && c.type === chat.type,
      );
      if (existingIndex !== -1) {
        console.log("Chat already open - bringing to front");
        // Move existing chat to end (rightmost position)
        const updatedChats = [...prev];
        const [existingChat] = updatedChats.splice(existingIndex, 1);
        updatedChats.push(existingChat);

        // Recalculate all positions
        return updatedChats.map((c, idx) => ({
          ...c,
          position: calculatePosition(
            idx,
            updatedChats.length,
            showNotificationPanel,
          ),
        }));
      }

      let updatedChats = [...prev];

      // MAX 3 POPUPS - If 3 are open, close the FIRST (oldest, leftmost) one
      if (updatedChats.length >= 3) {
        console.log(
          `Closing oldest chat: ${updatedChats[0].display_name || updatedChats[0].name}`,
        );
        updatedChats.shift(); // Remove first (oldest, leftmost)
      }

      // Add new chat at the END (rightmost position)
      updatedChats.push(chat);

      // Calculate positions for all chats
      return updatedChats.map((c, idx) => ({
        ...c,
        position: calculatePosition(
          idx,
          updatedChats.length,
          showNotificationPanel,
        ),
      }));
    });
  };

  // Recalculate positions when panel state changes
  useEffect(() => {
    if (miniChats.length === 0) return;

    setMiniChats((prev) =>
      prev.map((chat, idx) => ({
        ...chat,
        position: calculatePosition(idx, prev.length, showNotificationPanel),
      })),
    );
  }, [showNotificationPanel]);

  // Close mini chat and rearrange remaining ones
  const closeMiniChat = (chatId, chatType) => {
    setMiniChats((prev) => {
      const filtered = prev.filter(
        (c) => !(c._id === chatId && c.type === chatType),
      );

      // Recalculate positions for remaining chats
      return filtered.map((chat, idx) => ({
        ...chat,
        position: calculatePosition(
          idx,
          filtered.length,
          showNotificationPanel,
        ),
      }));
    });
  };

  // Open in main window (your existing function)
  const openInMainWindow = (chat) => {
    console.log("Opening in main window:", chat);
    // Your existing logic to open chat in main area
  };

  // Open in new tab
  const handleOpenInNewTab = (chat) => {
    const url = `/chat/${chat.type}/${chat._id}`;
    window.open(url, "_blank");
  };

  // Function to bring popup to front
  const bringPopupToFront = (chatId, chatType) => {
    setMiniChats((prev) => {
      const index = prev.findIndex(
        (c) => c._id === chatId && c.type === chatType,
      );
      if (index === -1) return prev;

      const updated = [...prev];
      const [chat] = updated.splice(index, 1);
      // Update z-index to be highest
      chat.zIndex = 1000 + updated.length + 1;
      updated.push(chat);
      return updated;
    });
  };

  // // Function to open in main window (close popup and open in main area)
  // const openInMainWindow = (chat) => {
  //   // Close the popup
  //   closeMiniChat(chat.id, chat.type);

  //   // Open in main window
  //   setSelectedChat({
  //     type: chat.type,
  //     id: chat.id,
  //     name: chat.name || chat.display_name,
  //     avatar: chat.avatar,
  //     ...(chat.type === 'private' && {
  //       other_user: chat.other_user,
  //       receiverId: chat.other_user?.id
  //     }),
  //     ...(chat.type === 'group' && {
  //       description: chat.description,
  //       member_count: chat.member_count,
  //       is_public: chat.is_public
  //     })
  //   });
  // };

  // // Handle opening in new tab
  // const handleOpenInNewTab = (chat) => {
  //   const chatType = chat.type === 'private' ? 'chat' : 'group';
  //   const url = `${window.location.origin}/chat/${chatType}/${chat.id}`;

  //   window.open(url, '_blank');

  //   // Mark as read if private chat with unread messages
  //   if (chat.type === 'private' && chat.unread_count > 0 && socket) {
  //     socket.emit('messages_read', {
  //       chat_id: chat.id,
  //       user_id: currentUserId
  //     });
  //   }
  // };

  // Reset popup positions when all are closed
  useEffect(() => {
    if (miniChats.length === 0) {
      setNextPopupPosition({ x: 50, y: 50 });
    }
  }, [miniChats.length]);

  // Load initial counts from server
  const loadUnreadCounts = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const response = await chatAPI.getUserTotalUnreadCounts(currentUserId);
      const data = response.data;

      setUnreadChatsCount(data.total_unread_chats || 0);
      setUnreadGroupsCount(data.total_unread_groups || 0);
    } catch (error) {
      console.error("Error loading unread counts:", error);
    }
  }, [currentUserId]);

  // Monitor connection status
  useEffect(() => {
    if (!mountedRef.current) return;

    if (isConnected) {
      setConnectionStatus("connected");
      console.log("Socket connected in ChatDashboard");
    } else {
      setConnectionStatus("disconnected");
      console.log("Socket disconnected in ChatDashboard");
    }
  }, [isConnected]);

  // Auto-reconnect on error
  useEffect(() => {
    if (!mountedRef.current) return;

    if (connectionError && !isConnected) {
      const timer = setTimeout(() => {
        reconnect();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [connectionError, isConnected, reconnect]);

  // Add heartbeat monitor
  useEffect(() => {
    if (!mountedRef.current || !lastHeartbeat) return;

    const checkHeartbeat = setInterval(() => {
      const timeSinceHeartbeat = Date.now() - lastHeartbeat;
      if (timeSinceHeartbeat > 120000 && isConnected) {
        // 2 minutes
        console.log(" No recent heartbeat, connection might be stale");
      }
    }, 60000);

    return () => {
      if (checkHeartbeat) clearInterval(checkHeartbeat);
    };
  }, [lastHeartbeat, isConnected]);

  // Socket listener for count updates
  useEffect(() => {
    if (!socket || !currentUserId || !mounted) return;

    // Listen for unread count updates
    const handleUpdateUnreadCounts = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      // Update both counts - this should only happen when a real message arrives
      if (data.total_unread_chats !== undefined) {
        setUnreadChatsCount(data.total_unread_chats);
      }

      if (data.total_unread_groups !== undefined) {
        setUnreadGroupsCount(data.total_unread_groups);
      }
    };

    // Load initial counts on mount ONLY
    const loadInitialCounts = async () => {
      try {
        const response = await chatAPI.getUserTotalUnreadCounts(currentUserId);
        const data = response.data;

        if (mounted) {
          setUnreadChatsCount(data.total_unread_chats || 0);
          setUnreadGroupsCount(data.total_unread_groups || 0);
        }
      } catch (error) {
        console.error("Error loading initial unread counts:", error);
      }
    };

    loadInitialCounts();

    // Listen for chat-specific updates
    const handleChatUnreadUpdated = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;
    };

    // Listen for group-specific updates
    const handleGroupUnreadUpdated = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;
    };

    // Listen for chat reset
    const handleChatUnreadReset = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      // If we reset a chat, update total chats count via API
      if (activeTab === "chats") {
        loadUnreadCounts();
      }
    };

    // Listen for group reset
    const handleGroupUnreadReset = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      // If we reset a group, update total groups count via API
      if (activeTab === "groups") {
        loadUnreadCounts();
      }
    };

    // Add all listeners
    socket.on("update_unread_counts", handleUpdateUnreadCounts);
    socket.on("chat_unread_updated", handleChatUnreadUpdated);
    socket.on("group_unread_updated", handleGroupUnreadUpdated);
    socket.on("chat_unread_reset", handleChatUnreadReset);
    socket.on("group_unread_reset", handleGroupUnreadReset);

    return () => {
      socket.off("update_unread_counts", handleUpdateUnreadCounts);
      socket.off("chat_unread_updated", handleChatUnreadUpdated);
      socket.off("group_unread_updated", handleGroupUnreadUpdated);
      socket.off("chat_unread_reset", handleChatUnreadReset);
      socket.off("group_unread_reset", handleGroupUnreadReset);
    };
  }, [socket, currentUserId, mounted]);

  // Tab change handler
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Set mounted status
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Safe state update function
  const safeSetState = (setter, value) => {
    if (mounted) {
      setTimeout(() => {
        if (mounted) setter(value);
      }, 0);
    }
  };

  // Fetch current user profile
  const fetchCurrentUser = useCallback(
    async (token) => {
      try {
        if (currentUserId) {
          setIsLoadingUser(false);
          return;
        }

        setIsLoadingUser(true);
        const responseUser = await userAPI.getProfile();

        if (mounted && responseUser?.data?._id) {
          const newUserId = responseUser.data._id?.toString();
          // Only update if different
          if (newUserId !== currentUserId) {
            safeSetState(setCurrentUserId, newUserId);
            localStorage.setItem("currentUserId", newUserId);
          }
        } else if (mounted) {
          console.error(" Failed to fetch user data");
          localStorage.removeItem("currentUserId");
        }
      } catch (error) {
        console.error(" Error fetching user:", error);
        if (mounted) {
          localStorage.removeItem("currentUserId");
        }
      } finally {
        if (mounted) {
          setIsLoadingUser(false);
        }
      }
    },
    [currentUserId, mounted],
  );

  // Load user on mount
  useEffect(() => {
    if (!mounted) return;

    const loadUser = async () => {
      if (isLoaded && userId) {
        try {
          const token = await getToken();
          setAuthToken(token);
          await fetchCurrentUser(token);
        } catch (error) {
          console.error("Error loading user:", error);
          if (mounted) {
            setIsLoadingUser(false);
          }
        }
      }
    };

    loadUser();
  }, [isLoaded, userId, getToken, fetchCurrentUser, mounted]);

  // Call handlers
  useEffect(() => {
    if (!socket || !mounted) return;

    let isSubscribed = true;

    const handleVoiceCallInitiate = (data) => {
      if (!isSubscribed) return;

      safeSetState(setIncomingCall, {
        ...data,
        type: "voice",
        chatType: data.chatType || "private",
      });

      // Play incoming ringtone
      ringtoneService.play("incoming");
    };

    const handleVideoCallInitiate = (data) => {
      if (!isSubscribed) return;

      safeSetState(setIncomingCall, {
        ...data,
        type: "video",
        chatType: data.chatType || "private",
      });

      // Play incoming ringtone
      ringtoneService.play("incoming");
    };

    // Add for group calls too
    const handleGroupVoiceCallInitiate = (data) => {
      if (!isSubscribed) return;

      if (data.callerId === currentUserId) {
        return;
      }

      safeSetState(setIncomingCall, {
        ...data,
        type: "voice",
        chatType: "group",
        isGroupCall: true,
        receivedAt: new Date().toISOString(),
      });

      // Play incoming ringtone
      ringtoneService.play("incoming");
    };

    const handleGroupVideoCallInitiate = (data) => {
      if (!isSubscribed) return;

      if (data.callerId === currentUserId) {
        return;
      }

      safeSetState(setIncomingCall, {
        ...data,
        type: "video",
        chatType: "group",
        isGroupCall: true,
        receivedAt: new Date().toISOString(),
      });

      // Play incoming ringtone
      ringtoneService.play("incoming");
    };

    // Update handleCallEnded to stop ringtone
    const handleCallEnded = (data) => {
      if (!mountedRef.current) return;

      // Stop ringtone
      ringtoneService.stop();

      // Clear all call states
      safeSetState(setActiveCall, null);
      safeSetState(setIncomingCall, null);

      // Also clear localStorage
      localStorage.removeItem("activeCall");
      localStorage.removeItem("incomingCall");

      // Emit to all chat windows
      if (socket) {
        socket.emit("call_ended_global", data);
      }
    };

    const handleCallEvent = (data, type, isGroup = false) => {
      // Always dispatch the event
      const event = new CustomEvent("incoming-call", {
        detail: {
          ...data,
          type: type,
          chatType: isGroup ? "group" : "private",
          globalEvent: true,
          timestamp: Date.now(),
        },
      });

      window.dispatchEvent(event);

      // Also broadcast via localStorage for other tabs
      localStorage.setItem(
        "global_call_event",
        JSON.stringify({
          ...data,
          type: type,
          chatType: isGroup ? "group" : "private",
          timestamp: Date.now(),
        }),
      );

      // Also update state for this tab
      safeSetState(setIncomingCall, {
        ...data,
        type: type,
        chatType: isGroup ? "group" : "private",
      });
    };

    // Listen for storage events from other tabs
    const handleStorageEvent = (event) => {
      if (event.key === "global_call_event") {
        try {
          const callData = JSON.parse(event.newValue);
          if (callData && !document.hidden) {
            // This tab is visible, show notification
            const localEvent = new CustomEvent("incoming-call", {
              detail: callData,
            });
            window.dispatchEvent(localEvent);
          }
        } catch (error) {
          console.error("Error parsing storage event:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageEvent);

    // Private call listeners
    socket.on("voice_call_initiate", handleVoiceCallInitiate);
    socket.on("video_call_initiate", handleVideoCallInitiate);

    // Group call listeners
    socket.on("group_voice_call_initiate", handleGroupVoiceCallInitiate);
    socket.on("group_video_call_initiate", handleGroupVideoCallInitiate);

    // Call ended listeners
    socket.on("voice_call_ended", handleCallEnded);
    socket.on("video_call_ended", handleCallEnded);
    socket.on("group_voice_call_ended", handleCallEnded);
    socket.on("group_video_call_ended", handleCallEnded);
    socket.on("call_ended", handleCallEnded);
    socket.on("call_rejected", handleCallEnded);

    return () => {
      isSubscribed = false;

      socket.off("call_ended", handleCallEnded);
      socket.off("call_rejected", handleCallEnded);

      // Private call cleanup
      socket.off("voice_call_initiate", handleVoiceCallInitiate);
      socket.off("video_call_initiate", handleVideoCallInitiate);

      // Group call cleanup
      socket.off("group_voice_call_initiate", handleGroupVoiceCallInitiate);
      socket.off("group_video_call_initiate", handleGroupVideoCallInitiate);

      // Call ended cleanup
      socket.off("voice_call_ended", handleCallEnded);
      socket.off("video_call_ended", handleCallEnded);
      socket.off("group_voice_call_ended", handleCallEnded);
      socket.off("group_video_call_ended", handleCallEnded);

      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [socket, mounted]);

  // Handle incoming calls (keep existing)
  useEffect(() => {
    if (!mounted) return;

    let audio = null;

    if (incomingCall && !ringingAudio) {
      try {
        // Try to play audio, but don't fail if file doesn't exist
        audio = new Audio("../sounds/incoming-call.mp3");
        audio.loop = true;

        const playAudio = async () => {
          try {
            await audio.play();
            if (mounted) {
              safeSetState(setRingingAudio, audio);
            }
          } catch (error) {
            console.log("Audio play failed, continuing without sound:", error);
            // Continue without sound
          }
        };

        playAudio();
      } catch (error) {
        console.log("Audio initialization failed:", error);
      }
    } else if (!incomingCall && ringingAudio) {
      ringingAudio.pause();
      ringingAudio.currentTime = 0;
      safeSetState(setRingingAudio, null);
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [incomingCall, ringingAudio, mounted]);

  // Add this effect to join group rooms when a group chat is selected
  useEffect(() => {
    if (!socket || !selectedChat) return;

    // Join the group room when a group chat is selected
    if (selectedChat.type === "group") {
      socket.emit("join_group", {
        groupId: selectedChat._id,
      });
    }

    // Cleanup when component unmounts or chat changes
    return () => {
      if (selectedChat && selectedChat.type === "group") {
        socket.emit("leave_group", {
          groupId: selectedChat._id,
        });
      }
    };
  }, [socket, selectedChat]);

  useEffect(() => {
    if (!socket || !mounted) return;

    let isSubscribed = true;

    //  FIXED: Handle group voice call ended
    const handleGroupVoiceCallEnded = (data) => {
      if (!isSubscribed) return;

      // Only clear if this is the active call
      if (activeCall?.callId === data.callId) {
        safeSetState(setActiveCall, null);
        localStorage.removeItem("activeCall");
      }

      if (incomingCall?.callId === data.callId) {
        safeSetState(setIncomingCall, null);
        localStorage.removeItem("incomingCall");
      }

      ringtoneService.stop();
    };

    //  FIXED: Handle group video call ended
    const handleGroupVideoCallEnded = (data) => {
      if (!isSubscribed) return;

      // Only clear if this is the active call
      if (activeCall?.callId === data.callId) {
        safeSetState(setActiveCall, null);
        localStorage.removeItem("activeCall");
      }

      if (incomingCall?.callId === data.callId) {
        safeSetState(setIncomingCall, null);
        localStorage.removeItem("incomingCall");
      }

      ringtoneService.stop();
    };

    //  NEW: Handle force ended (when not enough participants)
    const handleGroupCallForceEnded = (data) => {
      if (!isSubscribed) return;

      // Clear call state
      if (activeCall?.callId === data.callId) {
        safeSetState(setActiveCall, null);
        localStorage.removeItem("activeCall");
      }

      if (incomingCall?.callId === data.callId) {
        safeSetState(setIncomingCall, null);
        localStorage.removeItem("incomingCall");
      }

      ringtoneService.stop();
    };

    //  FIXED: Handle when a specific user rejects (NOT the whole call)
    const handleGroupCallUserRejected = (data) => {
      if (!isSubscribed) return;
    };

    //  Handle group call timeout
    const handleGroupCallTimeout = (data) => {
      if (!isSubscribed) return;

      if (activeCall?.callId === data.callId) {
        safeSetState(setActiveCall, null);
        localStorage.removeItem("activeCall");
      }

      if (incomingCall?.callId === data.callId) {
        safeSetState(setIncomingCall, null);
        localStorage.removeItem("incomingCall");
      }

      ringtoneService.stop();
    };

    //  Register all group call event listeners
    socket.on("group_voice_call_ended", handleGroupVoiceCallEnded);
    socket.on("group_video_call_ended", handleGroupVideoCallEnded);
    socket.on("group_call_force_ended", handleGroupCallForceEnded);
    socket.on("group_call_user_rejected", handleGroupCallUserRejected);
    socket.on("group_call_timeout", handleGroupCallTimeout);

    return () => {
      isSubscribed = false;

      socket.off("group_voice_call_ended", handleGroupVoiceCallEnded);
      socket.off("group_video_call_ended", handleGroupVideoCallEnded);
      socket.off("group_call_force_ended", handleGroupCallForceEnded);
      socket.off("group_call_user_rejected", handleGroupCallUserRejected);
      socket.off("group_call_timeout", handleGroupCallTimeout);
    };
  }, [socket, mounted, activeCall, incomingCall]);

  const handleAcceptCall = () => {
    if (!mounted || !incomingCall) return;

    safeSetState(setActiveCall, incomingCall);
    safeSetState(setIncomingCall, null);
    ringtoneService.stop();

    if (socket) {
      if (incomingCall.chatType === "group") {
        // For group calls, also join the group call
        socket.emit("join_group_call", {
          callId: incomingCall.callId,
          userId: currentUserId,
        });

        // Request participants
        socket.emit("get_group_call_participants", {
          callId: incomingCall.callId,
        });
      } else {
        // Private call logic
        const eventName =
          incomingCall.chatType === "group"
            ? `group_${incomingCall.type}_call_accept`
            : `${incomingCall.type}_call_accept`;

        socket.emit(eventName, {
          callId: incomingCall.callId,
          targetUserId: incomingCall.callerId,
          ...(incomingCall.chatType === "group" && {
            groupId: incomingCall.groupId,
          }),
        });
      }
    }
  };

  const handleRejectCall = () => {
    if (!mounted || !incomingCall) return;
    ringtoneService.stop();
    if (socket) {
      if (incomingCall.isGroupCall) {
        socket.emit("group_call_rejected", {
          callId: incomingCall.callId,
          groupId: incomingCall.groupId,
          userId: currentUserId,
        });
      } else {
        // Existing private call rejection
        const eventName =
          incomingCall.chatType === "group"
            ? `group_${incomingCall.type}_call_reject`
            : `${incomingCall.type}_call_reject`;

        socket.emit(eventName, {
          callId: incomingCall.callId,
          targetUserId: incomingCall.callerId,
          ...(incomingCall.chatType === "group" && {
            groupId: incomingCall.groupId,
          }),
        });
      }
    }

    safeSetState(setIncomingCall, null);
    localStorage.removeItem("incomingCall");
  };

  const handleEndCall = (duration = 0) => {
    if (!mounted || !activeCall) return;

    ringtoneService.stop();
    if (socket) {
      // Determine the appropriate event based on call type
      const eventName =
        activeCall.chatType === "group"
          ? `group_${activeCall.type}_call_end`
          : `${activeCall.type}_call_end`;

      socket.emit(eventName, {
        callId: activeCall.callId,
        targetUserId: activeCall.callerId || activeCall.targetUserId,
        ...(activeCall.chatType === "group" && { groupId: activeCall.groupId }),
      });
    }

    safeSetState(setActiveCall, null);
    safeSetState(setIncomingCall, null);
    localStorage.removeItem("activeCall");
    localStorage.removeItem("incomingCall");
  };

  // Function to reset chat count (called when entering a chat)
  const resetChatCount = useCallback(
    async (chatId) => {
      if (!currentUserId) return;

      try {
        await chatAPI.resetChatUnreadCount(chatId, currentUserId);
      } catch (error) {
        console.error("Error resetting chat count:", error);
      }
    },
    [currentUserId],
  );

  // Function to reset group count (called when entering a group)
  const resetGroupCount = useCallback(
    async (groupId) => {
      if (!currentUserId) return;

      try {
        await groupAPI.resetGroupUnreadCount(groupId, currentUserId);
      } catch (error) {
        console.error("Error resetting group count:", error);
      }
    },
    [currentUserId],
  );

  // Show loading while fetching user data
  if (!isLoaded || isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" />
        <p className="ml-4 text-gray-600">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <ToastElement />

      {/* Blur overlay when panel is open */}
      {showNotificationPanel && (
        <div
          className="fixed inset-0 z-[999]"
          style={{ pointerEvents: "none" }} // ✅ Changed to 'none' - backdrop doesn't intercept clicks
        />
      )}

      {incomingCall &&
        !activeCall &&
        (incomingCall.chatType === "group" ? (
          <GroupCall
            key={incomingCall.callId}
            callData={incomingCall}
            socket={socket}
            currentUserId={currentUserId}
            onEndCall={handleEndCall}
            onAcceptCall={handleAcceptCall}
            onRejectCall={handleRejectCall}
            isIncoming={true}
          />
        ) : incomingCall.type === "voice" ? (
          <VoiceCall
            key={incomingCall.callId}
            callData={incomingCall}
            socket={socket}
            onEndCall={handleEndCall}
            onAcceptCall={handleAcceptCall}
            onRejectCall={handleRejectCall}
            isIncoming={true}
          />
        ) : (
          <VideoCall
            key={incomingCall.callId}
            callData={incomingCall}
            socket={socket}
            onEndCall={handleEndCall}
            onAcceptCall={handleAcceptCall}
            onRejectCall={handleRejectCall}
            isIncoming={true}
          />
        ))}

      {activeCall &&
        (activeCall.chatType === "group" ? (
          <GroupCall
            key={activeCall.callId}
            callData={activeCall}
            socket={socket}
            currentUserId={currentUserId}
            onEndCall={handleEndCall}
          />
        ) : activeCall.type === "voice" ? (
          <VoiceCall
            key={activeCall.callId}
            callData={activeCall}
            socket={socket}
            onEndCall={handleEndCall}
          />
        ) : (
          <VideoCall
            key={activeCall.callId}
            callData={activeCall}
            socket={socket}
            onEndCall={handleEndCall}
          />
        ))}

      <div
        className={`flex flex-1 ${showNotificationPanel ? "blur-sm pointer-events-none" : ""}`}
      >
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Chat App</h1>
                <div className="flex items-center mt-1">
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${
                      isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <p className="text-sm text-gray-600">
                    {isConnected ? "Connected" : "Disconnected"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>

          {/* Navigation Tabs with Unread Badges */}
          <div className="flex border-b border-gray-200 relative">
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer relative ${
                activeTab === "all"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => handleTabChange("all")}
            >
              All
              {unreadChatsCount + unreadGroupsCount > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadChatsCount + unreadGroupsCount > 99
                    ? "99+"
                    : unreadChatsCount + unreadGroupsCount}
                </span>
              )}
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer relative ${
                activeTab === "chats"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => handleTabChange("chats")}
            >
              Chats
              {unreadChatsCount > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadChatsCount > 99 ? "99+" : unreadChatsCount}
                </span>
              )}
            </button>

            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer relative ${
                activeTab === "groups"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => handleTabChange("groups")}
            >
              Groups
              {unreadGroupsCount > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadGroupsCount > 99 ? "99+" : unreadGroupsCount}
                </span>
              )}
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer relative ${
                activeTab === "call-history"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => handleTabChange("call-history")}
            >
              Call History
            </button>
          </div>

          {/* Content based on active tab */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "all" && (
              <AllConversations
                onSelectChat={setSelectedChat}
                selectedChat={selectedChat}
                socket={socket}
                currentUserId={currentUserId}
                onResetChatCount={resetChatCount}
                onResetGroupCount={resetGroupCount}
              />
            )}
            {activeTab === "chats" && (
              <FriendsList
                onSelectChat={setSelectedChat}
                selectedChat={selectedChat}
                socket={socket}
                currentUserId={currentUserId}
                onResetChatCount={resetChatCount}
              />
            )}
            {activeTab === "groups" && (
              <GroupManager
                onSelectChat={setSelectedChat}
                selectedChat={selectedChat}
                socket={socket}
                currentUserId={currentUserId}
                onResetGroupCount={resetGroupCount}
              />
            )}
            {activeTab === "call-history" && <CallHistoryPage />}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              socket={socket}
              isConnected={isConnected}
              currentUserId={currentUserId}
              onStartCall={(callData) => {
                if (callData === null) {
                  // Clear all call states
                  setActiveCall(null);
                  setIncomingCall(null);
                  localStorage.removeItem("activeCall");
                  localStorage.removeItem("incomingCall");
                } else {
                  setActiveCall(callData);
                }
              }}
              activeCallFromParent={activeCall || incomingCall}
              onResetChatCount={resetChatCount}
              onResetGroupCount={resetGroupCount}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-600 mb-2">
                  Welcome to Chat App
                </h2>
                <p className="text-gray-500 max-w-md">
                  {activeTab === "chats"
                    ? "Select a chat from the list to start messaging, or invite a friend to begin a new conversation."
                    : "Select a group to start group chatting, or create a new group to get started."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Chat Notification Icon at Bottom Right */}
      <div
        className={`fixed bottom-38 right-6 z-[2000] transition-transform duration-300 ${showNotificationPanel ? "scale-0" : "scale-100"}`}
      >
        <ChatNotificationIcon
          totalUnread={unreadChatsCount + unreadGroupsCount}
          onClick={() => setShowNotificationPanel(!showNotificationPanel)}
          isOpen={showNotificationPanel}
          showBadge={true}
          socket={socket}
        />
      </div>

      {/* ✅ Notification Panel - Now handles its own outside clicks */}
      <PopupNotificationPanel
        ref={notificationPanelRef}
        socket={socket}
        currentUserId={currentUserId}
        onSelectChat={(chat) => {
          // When opening in main window, reset counts
          if (chat.type === "private") {
            resetChatCount(chat._id);
          } else {
            resetGroupCount(chat._id);
          }
          setSelectedChat(chat);
          setShowNotificationPanel(false);
        }}
        onOpenMiniChat={openMiniChat}
        onOpenInNewTab={handleOpenInNewTab}
        isOpen={showNotificationPanel}
        onClose={() => setShowNotificationPanel(false)}
      />

      {/* Mini Chat Windows - Higher z-index than panel */}
      {miniChats.map((chat, index) => (
        <ChatWindowPopup
          key={`${chat.type}-${chat._id}`}
          chat={chat}
          socket={socket}
          isConnected={true}
          currentUserId={currentUserId}
          onClose={() => closeMiniChat(chat._id, chat.type)}
          onOpenInMainWindow={(chat) => {
            openInMainWindow(chat);
            closeMiniChat(chat._id, chat.type);
          }}
          position={chat.position}
          zIndex={1500 + index}
        />
      ))}
    </div>
  );
}
