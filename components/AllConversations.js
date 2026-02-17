"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { chatAPI, groupAPI } from "../lib/api";
import LoadingSpinner from "./LoadingSpinner";
import { successToast, errorToast } from "./toast";
import UserProfileModal from "./UserProfileModal";
import GroupProfileModal from "./GroupProfileModal";

export default function AllConversations({
  onSelectChat,
  selectedChat,
  socket,
  currentUserId,
  onResetChatCount,
  onResetGroupCount,
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chats, setChats] = useState([]);

  // Invitation states
  const [invitations, setInvitations] = useState([]);

  // Search state like FriendsList.js
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Online status state - LIKE FRIENDSLIST.JS
  const [userOnlineStatus, setUserOnlineStatus] = useState({});

  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedConversationForAction, setSelectedConversationForAction] =
    useState(null);

  // Profile modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [showGroupProfileModal, setShowGroupProfileModal] = useState(false);
  const [selectedGroupProfile, setSelectedGroupProfile] = useState(null);

  // Action confirmation states
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Muted states
  const [mutedChats, setMutedChats] = useState(new Set());
  const [mutedGroups, setMutedGroups] = useState(new Set());
  const [typingStatus, setTypingStatus] = useState({});

  const menuRef = useRef(null);

  // Add typing state to each component
  const [typingUsers, setTypingUsers] = useState({});

  // Add socket listener for typing events
  useEffect(() => {
    if (!socket) return;

    // Listen for typing events
    const handleTypingEvent = (data) => {
      const chatId = data.chat_id || data.group_id;
      const userId = data.user_id;

      if (chatId && userId !== currentUserId) {
        setTypingUsers((prev) => ({
          ...prev,
          [chatId]: {
            isTyping: data.is_typing,
            userId: userId,
            timestamp: Date.now(),
          },
        }));

        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => {
            const typingData = prev[chatId];
            if (typingData && typingData.timestamp === Date.now() - 3000) {
              const newTyping = { ...prev };
              delete newTyping[chatId];
              return newTyping;
            }
            return prev;
          });
        }, 3000);
      }
    };

    // Listen for both private and group typing
    socket.on("user_typing", handleTypingEvent);
    socket.on("group_user_typing", handleTypingEvent);

    return () => {
      socket.off("user_typing", handleTypingEvent);
      socket.off("group_user_typing", handleTypingEvent);
    };
  }, [socket, currentUserId]);

  // Load muted states from localStorage
  useEffect(() => {
    const savedMutedChats = localStorage.getItem("mutedChats");
    const savedMutedGroups = localStorage.getItem("mutedGroups");

    if (savedMutedChats) {
      setMutedChats(new Set(JSON.parse(savedMutedChats)));
    }
    if (savedMutedGroups) {
      setMutedGroups(new Set(JSON.parse(savedMutedGroups)));
    }
  }, []);

  // Save muted states to localStorage
  useEffect(() => {
    localStorage.setItem("mutedChats", JSON.stringify(Array.from(mutedChats)));
    localStorage.setItem(
      "mutedGroups",
      JSON.stringify(Array.from(mutedGroups)),
    );
  }, [mutedChats, mutedGroups]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ========== ONLINE STATUS FUNCTIONS ==========
  // Helper function to check if a user is online
  const isUserOnline = (userId) => {
    if (userOnlineStatus[userId] !== undefined) {
      return userOnlineStatus[userId].isOnline || false;
    }
    const conversation = conversations.find(
      (c) => c.type === "private" && c.other_user?._id === userId,
    );
    return conversation?.other_user?.is_online || false;
  };

  // Get user status
  const getUserStatus = (userId) => {
    // First check real-time socket status
    if (userOnlineStatus[userId]) {
      return userOnlineStatus[userId];
    }

    // Fallback to conversation data
    const conversation = conversations.find(
      (c) => c.type === "private" && c.other_user?._id === userId,
    );
    if (conversation?.other_user) {
      return {
        isOnline: conversation.other_user.is_online || false,
        status: conversation.other_user.status || "offline",
        lastSeen: conversation.other_user.last_seen,
      };
    }

    // Default
    return {
      isOnline: false,
      status: "offline",
      lastSeen: null,
    };
  };

  // Get status text and color
  const getStatusInfo = (userId) => {
    const status = getUserStatus(userId);

    if (status.isOnline) {
      if (status.status === "away") {
        return {
          text: "Away",
          dotColor: "bg-yellow-500",
          borderColor: "border-yellow-200",
          textColor: "text-yellow-600",
        };
      }
      return {
        text: "Online",
        dotColor: "bg-green-500",
        borderColor: "border-green-200",
        textColor: "text-green-600",
      };
    }

    // Offline - calculate time since last seen
    if (status.lastSeen) {
      const lastSeenDate = new Date(status.lastSeen);
      const now = new Date();
      const diffInHours = Math.floor((now - lastSeenDate) / (1000 * 60 * 60));
      const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

      if (diffInMinutes < 1) {
        return {
          text: "Just now",
          dotColor: "bg-gray-400",
          borderColor: "border-gray-300",
          textColor: "text-gray-600",
        };
      } else if (diffInMinutes < 60) {
        return {
          text: `${diffInMinutes}m ago`,
          dotColor: "bg-gray-400",
          borderColor: "border-gray-300",
          textColor: "text-gray-600",
        };
      } else if (diffInHours < 2) {
        return {
          text: "1h ago",
          dotColor: "bg-gray-400",
          borderColor: "border-gray-300",
          textColor: "text-gray-600",
        };
      } else if (diffInHours < 24) {
        return {
          text: `${diffInHours}h ago`,
          dotColor: "bg-gray-400",
          borderColor: "border-gray-300",
          textColor: "text-gray-600",
        };
      } else {
        return {
          text: "Offline",
          dotColor: "bg-gray-400",
          borderColor: "border-gray-300",
          textColor: "text-gray-600",
        };
      }
    }

    return {
      text: "Offline",
      dotColor: "bg-gray-400",
      borderColor: "border-gray-300",
      textColor: "text-gray-600",
    };
  };
  // ========== END ONLINE STATUS FUNCTIONS ==========

  // Load all conversations
  const loadAllConversations = useCallback(async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Load private chats with fresh unread counts
      const chatsResponse = await chatAPI.getChats();
      const privateChats = await Promise.all(
        (chatsResponse.data || []).map(async (chat) => {
          try {
            // Get fresh unread count for each chat
            const unreadResponse = await chatAPI.getChatUnreadCount(chat._id);
            return {
              ...chat,
              type: "private",
              display_name: chat.other_user?.username || "Unknown User",
              last_message_at: chat.last_message_at || chat.created_at,
              unread_count: unreadResponse.data?.unread_count || 0,
              avatar: chat.other_user?.profile_image,
              other_user: chat.other_user || {},
            };
          } catch (error) {
            console.error(
              `Error fetching unread count for chat ${chat._id}:`,
              error,
            );
            return {
              ...chat,
              type: "private",
              display_name: chat.other_user?.username || "Unknown User",
              last_message_at: chat.last_message_at || chat.created_at,
              unread_count: chat.unread_count || 0,
              avatar: chat.other_user?.profile_image,
              other_user: chat.other_user || {},
            };
          }
        }),
      );

      // Load groups with fresh unread counts
      const groupsResponse = await groupAPI.getUserGroups();
      const groupChats = await Promise.all(
        (groupsResponse.data || []).map(async (group) => {
          try {
            const countResponse = await groupAPI.getGroupUnreadCount(group._id);
            return {
              ...group,
              type: "group",
              display_name: group.name,
              last_message_at: group.last_message_at || group.created_at,
              unread_count: countResponse.data?.unread_count || 0,
              avatar: "/group-avatar.png",
            };
          } catch (error) {
            console.error(
              `Error fetching count for group ${group._id}:`,
              error,
            );
            return {
              ...group,
              type: "group",
              display_name: group.name,
              last_message_at: group.last_message_at || group.created_at,
              unread_count: 0,
              avatar: "/group-avatar.png",
            };
          }
        }),
      );

      // Combine and sort by last message time (most recent first)
      const combined = [...privateChats, ...groupChats].sort((a, b) => {
        const timeA = new Date(a.last_message_at || 0);
        const timeB = new Date(b.last_message_at || 0);
        return timeB - timeA;
      });

      setConversations(combined);
      setFilteredConversations(combined);
    } catch (error) {
      console.error("Error loading conversations:", error);
      setError("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Load invitations
  const loadInvitations = useCallback(async () => {
    try {
      const response = await chatAPI.getPendingInvitations();

      // Filter out duplicates
      const uniqueInvitations = response.data.filter(
        (invitation, index, self) =>
          index ===
          self.findIndex(
            (inv) =>
              inv._id === invitation._id &&
              inv.user?._id === invitation.user?._id,
          ),
      );

      setInvitations(uniqueInvitations);
    } catch (error) {
      console.error("Error loading invitations:", error);
    }
  }, []);

  // Load conversations and invitations on mount
  useEffect(() => {
    if (currentUserId) {
      loadAllConversations();
      loadInvitations();
    }
  }, [currentUserId, loadAllConversations, loadInvitations]);

  // ========== REAL-TIME SOCKET UPDATES WITH UNREAD COUNTS, ONLINE STATUS, AND INVITATIONS ==========
  useEffect(() => {
    if (!socket || !currentUserId) return;

    // Track processed message IDs to prevent double counting
    const processedUnreadUpdates = new Set();

    // ========== INVITATION HANDLERS  ==========
    const handleNewInvitation = (invitation) => {
      console.log("🎁 New invitation received:", invitation);
      setInvitations((prev) => {
        const alreadyExists = prev.some(
          (inv) =>
            inv._id === invitation._id ||
            (inv.user_id?._id === invitation.from_user?._id &&
              inv.user?._id === invitation.user?._id),
        );

        if (alreadyExists) {
          return prev;
        }

        return [invitation, ...prev];
      });

      successToast(
        `New invitation from ${
          invitation.user_id?.username ||
          invitation.from_user?.name ||
          "someone"
        }`,
      );
    };

    const handleInvitationAccepted = (data) => {
      setInvitations((prev) =>
        prev.filter((inv) => inv._id !== data.invitation_id),
      );

      // Reload conversations to show the new chat
      loadAllConversations();
      successToast(
        `${data?.response?.data?.chat?.user?.username || "User"} accepted your invitation!`,
      );
    };

    const handleInvitationRejected = (data) => {
      setInvitations((prev) =>
        prev.filter((inv) => inv._id !== data.invitation_id),
      );
      errorToast(
        `${data?.response?.data?.chat?.user?.username || "User"} declined your invitation`,
      );
    };

    const handleChatAccepted = (data) => {
      // Reload conversations when chat is accepted
      loadAllConversations();
    };
    // ========== END INVITATION HANDLERS ==========

    const updateChatList = (message, chatId) => {
      setChats((prev) => {
        const chatIndex = prev.findIndex(
          (chat) => chat._id.toString() === chatId.toString(),
        );

        if (chatIndex === -1) {
          console.log("❌ Chat not found, reloading...");
          setTimeout(() => loadChats(), 100);
          return prev;
        }

        const updatedChats = [...prev];
        const chatToUpdate = { ...updatedChats[chatIndex] };

        // Update last message info for ALL message types
        chatToUpdate.last_message =
          message.message || getMessagePreviewFromMessage(message);
        chatToUpdate.last_message_type =
          message.message_type || chatToUpdate.last_message_type;
        chatToUpdate.last_message_at =
          message.created_at ||
          message.last_message_at ||
          new Date().toISOString();

        // Add file name if available
        if (message.file_name) {
          chatToUpdate.file_name = message.file_name;
        }

        // Move updated chat to the top
        updatedChats.splice(chatIndex, 1);
        updatedChats.unshift(chatToUpdate);

        return updatedChats;
      });
    };

    const handlePrivateMessage = (message) => {
      const chatId = message.chat_id;

      if (!chatId) return;

      const isOwnMessage = message.sender_id === currentUserId;
      const isSelected =
        selectedChat?.type === "private" &&
        selectedChat?._id === chatId.toString();

      // Check if it's a file message (image, video, file, audio)
      const isFileMessage = ["image", "video", "file", "audio"].includes(
        message.message_type,
      );

      console.log(
        `📊 Message type: ${message.message_type}, isFile: ${isFileMessage}, isOwn: ${isOwnMessage}, isSelected: ${isSelected}`,
      );

      // ✅ UPDATE MAIN conversations LIST (NOT just chats)
      const shouldIncrementUnread = !isOwnMessage && !isSelected;
      updateConversationList(message, chatId, "private", shouldIncrementUnread);

      // ⚠️ CRITICAL FIX: Only increment unread count locally if:
      // 1. Not our own message
      // 2. Chat is not currently selected
      // 3. Works for BOTH text and file messages
      if (shouldIncrementUnread) {
        console.log(`📈 Incrementing unread count for chat ${chatId}`);
      } else {
        console.log(
          `⏭️ Skipping unread increment: isOwn=${isOwnMessage}, isSelected=${isSelected}`,
        );
      }
    };

    // Handle group message
    const handleGroupMessage = (message) => {
      console.log("👥 Group message received:", message);
      const groupId = message.group_id;
      if (!groupId) return;

      const isOwnMessage =
        parseInt(message.sender_id) === parseInt(currentUserId);
      const isSelected =
        selectedChat?.type === "group" &&
        selectedChat?._id === groupId.toString();
      const isFileMessage = ["image", "video", "file", "audio"].includes(
        message.message_type,
      );

      // Update conversation for ALL message types including files
      updateConversationList(message, groupId, "group", false);
    };

    // Handle sidebar updates
    const handleUpdateSidebarChat = (data) => {
      console.log("🔄 Sidebar update received:", data);
      updateConversationList(
        data,
        data.chat_id,
        data.chat_type || "private",
        false,
      );
    };

    // ========== ONLINE STATUS LISTENERS  ==========
    const handleUserStatusChange = (data) => {
      console.log("👤 User status changed:", data);
      // Update the user online status
      setUserOnlineStatus((prev) => ({
        ...prev,
        [data.userId]: {
          isOnline: data.isOnline,
          status: data.status,
          lastSeen: data.lastSeen,
        },
      }));

      // Also update the conversations array to reflect status changes
      setConversations((prev) =>
        prev.map((conversation) => {
          if (
            conversation.type === "private" &&
            conversation.other_user?._id === data.userId
          ) {
            return {
              ...conversation,
              other_user: {
                ...conversation.other_user,
                is_online: data.isOnline,
                status: data.status,
                last_seen: data.lastSeen,
              },
            };
          }
          return conversation;
        }),
      );

      // Update filtered conversations too
      setFilteredConversations((prev) =>
        prev.map((conversation) => {
          if (
            conversation.type === "private" &&
            conversation.other_user?._id === data.userId
          ) {
            return {
              ...conversation,
              other_user: {
                ...conversation.other_user,
                is_online: data.isOnline,
                status: data.status,
                last_seen: data.lastSeen,
              },
            };
          }
          return conversation;
        }),
      );
    };

    // Listen for initial status sync
    const handleInitialStatusSync = (usersStatus) => {
      const newStatuses = {};

      usersStatus.forEach((userStatus) => {
        newStatuses[userStatus.userId] = {
          isOnline: userStatus.isOnline,
          status: userStatus.status,
          lastSeen: userStatus.lastSeen,
        };
      });

      setUserOnlineStatus(newStatuses);

      // Also update conversations
      setConversations((prev) =>
        prev.map((conversation) => {
          const userId = conversation.other_user?._id;
          if (userId && newStatuses[userId]) {
            return {
              ...conversation,
              other_user: {
                ...conversation.other_user,
                is_online: newStatuses[userId].isOnline,
                status: newStatuses[userId].status,
                last_seen: newStatuses[userId].lastSeen,
              },
            };
          }
          return conversation;
        }),
      );

      // Update filtered conversations too
      setFilteredConversations((prev) =>
        prev.map((conversation) => {
          const userId = conversation.other_user?._id;
          if (userId && newStatuses[userId]) {
            return {
              ...conversation,
              other_user: {
                ...conversation.other_user,
                is_online: newStatuses[userId].isOnline,
                status: newStatuses[userId].status,
                last_seen: newStatuses[userId].lastSeen,
              },
            };
          }
          return conversation;
        }),
      );
    };
    // ========== END ONLINE STATUS LISTENERS ==========

    // Handle chat unread count updates - USE THIS AS SINGLE SOURCE OF TRUTH
    const handleChatUnreadUpdated = (data) => {
      console.log("📊 Chat unread updated:", data);
      if (data.user_id.toString() !== currentUserId.toString()) return;

      const updateKey = `chat-${data.chat_id}-${data.unread_count}`;
      if (processedUnreadUpdates.has(updateKey)) return;
      processedUnreadUpdates.add(updateKey);

      // Use server's unread count as the single source of truth
      setConversations((prev) => {
        const updated = prev.map((conv) =>
          conv.type === "private" &&
          conv._id.toString() === data.chat_id.toString()
            ? {
                ...conv,
                unread_count: data.unread_count || 0,
                // Only update last message if it's newer
                ...(data.last_message_at &&
                  (!conv.last_message_at ||
                    new Date(data.last_message_at) >
                      new Date(conv.last_message_at)) && {
                    last_message: data.last_message || conv.last_message,
                    last_message_type:
                      data.last_message_type || conv.last_message_type,
                    last_message_at: data.last_message_at,
                  }),
              }
            : conv,
        );

        // Sort by last message time after update
        return updated.sort((a, b) => {
          const timeA = new Date(a.last_message_at || 0);
          const timeB = new Date(b.last_message_at || 0);
          return timeB - timeA;
        });
      });

      // Also update filtered conversations
      setFilteredConversations((prev) => {
        const updated = prev.map((conv) =>
          conv.type === "private" &&
          conv._id.toString() === data.chat_id.toString()
            ? {
                ...conv,
                unread_count: data.unread_count || 0,
                ...(data.last_message_at &&
                  (!conv.last_message_at ||
                    new Date(data.last_message_at) >
                      new Date(conv.last_message_at)) && {
                    last_message: data.last_message || conv.last_message,
                    last_message_type:
                      data.last_message_type || conv.last_message_type,
                    last_message_at: data.last_message_at,
                  }),
              }
            : conv,
        );

        return updated.sort((a, b) => {
          const timeA = new Date(a.last_message_at || 0);
          const timeB = new Date(b.last_message_at || 0);
          return timeB - timeA;
        });
      });

      // Clean up old processed keys after a while
      setTimeout(() => {
        processedUnreadUpdates.delete(updateKey);
      }, 5000);
    };

    // Handle group unread count updates - USE THIS AS SINGLE SOURCE OF TRUTH
    const handleGroupUnreadUpdated = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      const updateKey = `group-${data.group_id}-${data.unread_count}`;
      if (processedUnreadUpdates.has(updateKey)) return;
      processedUnreadUpdates.add(updateKey);

      // Use server's unread count as the single source of truth
      setConversations((prev) => {
        const updated = prev.map((conv) =>
          conv.type === "group" &&
          conv._id.toString() === data.group_id.toString()
            ? {
                ...conv,
                unread_count: data.unread_count || 0,
                // Only update last message if it's newer
                ...(data.last_message_at &&
                  (!conv.last_message_at ||
                    new Date(data.last_message_at) >
                      new Date(conv.last_message_at)) && {
                    last_message: data.last_message || conv.last_message,
                    last_message_type:
                      data.last_message_type || conv.last_message_type,
                    last_message_at: data.last_message_at,
                  }),
              }
            : conv,
        );

        // Sort by last message time after update
        return updated.sort((a, b) => {
          const timeA = new Date(a.last_message_at || 0);
          const timeB = new Date(b.last_message_at || 0);
          return timeB - timeA;
        });
      });

      // Also update filtered conversations
      setFilteredConversations((prev) => {
        const updated = prev.map((conv) =>
          conv.type === "group" &&
          conv._id.toString() === data.group_id.toString()
            ? {
                ...conv,
                unread_count: data.unread_count || 0,
                ...(data.last_message_at &&
                  (!conv.last_message_at ||
                    new Date(data.last_message_at) >
                      new Date(conv.last_message_at)) && {
                    last_message: data.last_message || conv.last_message,
                    last_message_type:
                      data.last_message_type || conv.last_message_type,
                    last_message_at: data.last_message_at,
                  }),
              }
            : conv,
        );

        return updated.sort((a, b) => {
          const timeA = new Date(a.last_message_at || 0);
          const timeB = new Date(b.last_message_at || 0);
          return timeB - timeA;
        });
      });

      // Clean up old processed keys after a while
      setTimeout(() => {
        processedUnreadUpdates.delete(updateKey);
      }, 5000);
    };

    // Handle when messages are marked as read
    const handleChatUnreadReset = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.type === "private" &&
          conv._id.toString() === data.chat_id.toString()
            ? { ...conv, unread_count: 0 }
            : conv,
        ),
      );

      setFilteredConversations((prev) =>
        prev.map((conv) =>
          conv.type === "private" &&
          conv._id.toString() === data.chat_id.toString()
            ? { ...conv, unread_count: 0 }
            : conv,
        ),
      );
    };

    // Handle when group messages are marked as read
    const handleGroupUnreadReset = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.type === "group" &&
          conv._id.toString() === data.group_id.toString()
            ? { ...conv, unread_count: 0 }
            : conv,
        ),
      );

      setFilteredConversations((prev) =>
        prev.map((conv) =>
          conv.type === "group" &&
          conv._id.toString() === data.group_id.toString()
            ? { ...conv, unread_count: 0 }
            : conv,
        ),
      );
    };

    // Handle chat removed by other user
    const handleChatRemoved = (data) => {
      setConversations((prev) =>
        prev.filter(
          (conv) =>
            !(
              conv.type === "private" &&
              conv._id.toString() === data.chat_id.toString()
            ),
        ),
      );

      setFilteredConversations((prev) =>
        prev.filter(
          (conv) =>
            !(
              conv.type === "private" &&
              conv._id.toString() === data.chat_id.toString()
            ),
        ),
      );

      // If this chat is currently selected, clear it
      if (
        selectedChat?.type === "private" &&
        selectedChat?._id === data.chat_id.toString()
      ) {
        onSelectChat(null);
      }

      errorToast(`${data.removed_by_name} removed the chat`);
    };

    // Handle chat cleared
    const handleChatCleared = (data) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.type === "private" &&
          conv._id.toString() === data.chat_id.toString()
            ? {
                ...conv,
                last_message: "Chat cleared",
                last_message_type: "system",
                last_message_at: new Date().toISOString(),
              }
            : conv,
        ),
      );

      setFilteredConversations((prev) =>
        prev.map((conv) =>
          conv.type === "private" &&
          conv._id.toString() === data.chat_id.toString()
            ? {
                ...conv,
                last_message: "Chat cleared",
                last_message_type: "system",
                last_message_at: new Date().toISOString(),
              }
            : conv,
        ),
      );
    };

    // Handle group invitation (new group created)
    const handleGroupInvitation = (data) => {
      // Reload conversations to show new group
      loadAllConversations();
    };

    // Handle group deletion
    const handleGroupDeleted = (data) => {
      setConversations((prev) =>
        prev.filter(
          (conv) =>
            !(
              conv.type === "group" &&
              conv._id.toString() === data.group_id.toString()
            ),
        ),
      );

      setFilteredConversations((prev) =>
        prev.filter(
          (conv) =>
            !(
              conv.type === "group" &&
              conv._id.toString() === data.group_id.toString()
            ),
        ),
      );

      // If this group is currently selected, clear it
      if (
        selectedChat?.type === "group" &&
        selectedChat?._id === data.group_id.toString()
      ) {
        onSelectChat(null);
      }

      errorToast(`Group "${data.group_name}" was deleted`);
    };

    const updateConversationList = (
      message,
      id,
      type,
      shouldIncrementUnread = false,
    ) => {
      // Don't increment unread count here - wait for server's unread_updated event
      // This prevents double counting

      setConversations((prev) => {
        const convIndex = prev.findIndex(
          (conv) => conv.type === type && conv._id.toString() === id.toString(),
        );

        if (convIndex === -1) {
          // Reload if conversation not found
          setTimeout(() => loadAllConversations(), 100);
          return prev;
        }

        const updatedConversations = [...prev];
        const convToUpdate = { ...updatedConversations[convIndex] };

        // Update last message info
        convToUpdate.last_message = message.message || message.last_message;
        convToUpdate.last_message_type =
          message.message_type || message.last_message_type;
        convToUpdate.last_message_at =
          message.created_at ||
          message.last_message_at ||
          new Date().toISOString();

        // ✅ Increment unread count only if specified (for other users' messages when chat not selected)
        if (shouldIncrementUnread) {
          convToUpdate.unread_count = (convToUpdate.unread_count || 0) + 1;
          console.log(
            `✅ Updated unread count to ${convToUpdate.unread_count} for ${type} ${id}`,
          );
        }

        // Move to top
        updatedConversations.splice(convIndex, 1);
        updatedConversations.unshift(convToUpdate);

        return updatedConversations;
      });

      // Also update filtered conversations (without incrementing unread)
      setFilteredConversations((prev) => {
        const convIndex = prev.findIndex(
          (conv) => conv.type === type && conv._id.toString() === id.toString(),
        );

        if (convIndex === -1) return prev;

        const updatedConversations = [...prev];
        const convToUpdate = { ...updatedConversations[convIndex] };

        convToUpdate.last_message = message.message || message.last_message;
        convToUpdate.last_message_type =
          message.message_type || message.last_message_type;
        convToUpdate.last_message_at =
          message.created_at ||
          message.last_message_at ||
          new Date().toISOString();

        // ✅ Also increment unread count in filtered list if needed
        if (shouldIncrementUnread) {
          convToUpdate.unread_count = (convToUpdate.unread_count || 0) + 1;
        }

        updatedConversations.splice(convIndex, 1);
        updatedConversations.unshift(convToUpdate);

        return updatedConversations;
      });
    };

    // Handle when a member is added to group
    const handleGroupMemberAdded = (data) => {
      console.log("Group member added data:", data);
      console.log(
        "Current user",
        data.group_id &&
          data.user_id &&
          data.user_id.toString() === currentUserId.toString(),
      );

      if (
        data.group_id &&
        data.user_id &&
        data.user_id.toString() === currentUserId.toString()
      ) {
        // If it's the current user being added, reload conversations
        loadAllConversations();
        successToast(`You were added to the group "${data.group_name}"`);
      }
    };

    // Handle when a member is removed from group
    const handleGroupMemberRemoved = (data) => {
      console.log("Group member removed data:", data);
      console.log(
        "Current user",
        data.group_id &&
          data.user_id &&
          data.user_id.toString() === currentUserId.toString(),
      );
      if (
        data.group_id &&
        data.user_id &&
        data.user_id.toString() === currentUserId.toString()
      ) {
        // If current user is removed, remove group from conversations
        setConversations((prev) =>
          prev.filter(
            (conv) =>
              !(
                conv.type === "group" &&
                conv._id.toString() === data.group_id.toString()
              ),
          ),
        );

        setFilteredConversations((prev) =>
          prev.filter(
            (conv) =>
              !(
                conv.type === "group" &&
                conv._id.toString() === data.group_id.toString()
              ),
          ),
        );

        // If this group is currently selected, clear it
        if (
          selectedChat?.type === "group" &&
          selectedChat?._id === data.group_id.toString()
        ) {
          onSelectChat(null);
        }

        errorToast(`You were removed from the group "${data.group_name}"`);
      }
    };

    // Handle group member count updates
    const handleGroupMemberUpdated = (data) => {
      if (data.group_id) {
        // Update member count for the group
        setConversations((prev) =>
          prev.map((conv) => {
            if (
              conv.type === "group" &&
              conv._id.toString() === data.group_id.toString()
            ) {
              return {
                ...conv,
                member_count: data.member_count || conv.member_count,
              };
            }
            return conv;
          }),
        );

        setFilteredConversations((prev) =>
          prev.map((conv) => {
            if (
              conv.type === "group" &&
              conv._id.toString() === data.group_id.toString()
            ) {
              return {
                ...conv,
                member_count: data.member_count || conv.member_count,
              };
            }
            return conv;
          }),
        );
      }
    };

    // Then in your socket.on setup:
    console.log("📡 Setting up socket listeners...");
    socket.on("group_member_added", handleGroupMemberAdded);
    socket.on("group_member_removed", handleGroupMemberRemoved);
    socket.on("group_member_updated", handleGroupMemberUpdated);

    // Set up all socket listeners
    socket.on("private_message", handlePrivateMessage);
    socket.on("group_message", handleGroupMessage);
    socket.on("update_sidebar_chat", handleUpdateSidebarChat);

    // Invitation listeners
    socket.on("invitation_sent", handleNewInvitation);
    socket.on("invitation_accepted", handleInvitationAccepted);
    socket.on("invitation_rejected", handleInvitationRejected);
    socket.on("chat_accepted", handleChatAccepted);

    // Online status listeners
    socket.on("user_status_change", handleUserStatusChange);
    socket.on("initial_status_sync", handleInitialStatusSync);

    // Unread count listeners
    socket.on("chat_unread_updated", handleChatUnreadUpdated);
    socket.on("group_unread_updated", handleGroupUnreadUpdated);
    socket.on("chat_unread_reset", handleChatUnreadReset);
    socket.on("group_unread_reset", handleGroupUnreadReset);
    socket.on("chat_removed", handleChatRemoved);
    socket.on("chat_cleared", handleChatCleared);

    // Group invitation listener
    socket.on("group_invitation_sent", handleGroupInvitation);
    socket.on("group_deleted", handleGroupDeleted);

    console.log("✅ All socket listeners registered successfully");
    console.log(
      "📊 Total listeners attached:",
      [
        "private_message",
        "group_message",
        "update_sidebar_chat",
        "invitation_sent",
        "invitation_accepted",
        "invitation_rejected",
        "chat_accepted",
        "user_status_change",
        "initial_status_sync",
        "chat_unread_updated",
        "group_unread_updated",
        "chat_unread_reset",
        "group_unread_reset",
        "chat_removed",
        "chat_cleared",
        "group_invitation_sent",
        "group_deleted",
        "group_member_added",
        "group_member_removed",
        "group_member_updated",
      ].length,
    );

    // Request initial status sync
    console.log(
      "🔌 Socket setup complete. Socket connected:",
      socket.connected,
    );

    if (socket.connected) {
      console.log("📡 Emitting request_initial_status");
      socket.emit("request_initial_status");
    } else {
      // Fallback: emit after small delay in case socket connects
      const timer = setTimeout(() => {
        if (socket.connected) {
          console.log("📡 Emitting request_initial_status (delayed)");
          socket.emit("request_initial_status");
        }
      }, 500);

      // Also listen for connection event
      socket.once("connect", () => {
        console.log("📡 Socket connected! Emitting request_initial_status");
        socket.emit("request_initial_status");
      });

      return () => clearTimeout(timer);
    }

    return () => {
      socket.off("private_message", handlePrivateMessage);
      socket.off("group_message", handleGroupMessage);
      socket.off("update_sidebar_chat", handleUpdateSidebarChat);

      // Invitation cleanup
      socket.off("invitation_sent", handleNewInvitation);
      socket.off("invitation_accepted", handleInvitationAccepted);
      socket.off("invitation_rejected", handleInvitationRejected);
      socket.off("chat_accepted", handleChatAccepted);

      // Online status cleanup
      socket.off("user_status_change", handleUserStatusChange);
      socket.off("initial_status_sync", handleInitialStatusSync);

      // Unread count cleanup
      socket.off("chat_unread_updated", handleChatUnreadUpdated);
      socket.off("group_unread_updated", handleGroupUnreadUpdated);
      socket.off("chat_unread_reset", handleChatUnreadReset);
      socket.off("group_unread_reset", handleGroupUnreadReset);
      socket.off("chat_removed", handleChatRemoved);
      socket.off("chat_cleared", handleChatCleared);

      // Group cleanup
      socket.off("group_invitation_sent", handleGroupInvitation);
      socket.off("group_deleted", handleGroupDeleted);
      socket.off("group_member_added", handleGroupMemberAdded);
      socket.off("group_member_removed", handleGroupMemberRemoved);
      socket.off("group_member_updated", handleGroupMemberUpdated);
    };
  }, [
    socket,
    currentUserId,
    loadAllConversations,
    selectedChat,
    onSelectChat,
    loadInvitations,
  ]);

  // ========== INVITATION FUNCTIONS  ==========
  const sendInvitation = async (email) => {
    try {
      setError("");
      const response = await chatAPI.sendInvitation(email);
      setSearchQuery("");
      setShowSearch(false);

      if (socket) {
        socket.emit("invitation_sent", {
          to_email: email,
          from_user_id: currentUserId,
          invitation_id: response.data._id,
        });
      }

      await loadInvitations();
      successToast("Invitation sent successfully!");
    } catch (error) {
      setError(error.response?.data?.message || "Failed to send invitation");
    }
  };

  const acceptInvitation = async (invitationId) => {
    try {
      const response = await chatAPI.acceptInvitation(invitationId);
      setInvitations((prev) => prev.filter((inv) => inv._id !== invitationId));
      await loadAllConversations(); // Reload to show the new chat

      if (socket) {
        socket.emit("invitation_accepted", {
          invitation_id: invitationId,
          user_id: currentUserId,
          response,
        });
      }

      successToast("Invitation accepted! Chat created successfully.");
    } catch (error) {
      console.error("Error accepting invitation:", error);
      errorToast(error.response?.data?.error || "Failed to accept invitation");
    }
  };

  const rejectInvitation = async (invitationId) => {
    try {
      const response = await chatAPI.rejectInvitation(invitationId);
      setInvitations((prev) => prev.filter((inv) => inv._id !== invitationId));

      if (socket) {
        socket.emit("invitation_rejected", {
          invitation_id: invitationId,
          user_id: currentUserId,
          response,
        });
      }

      successToast("Invitation rejected");
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      errorToast(error.response?.data?.error || "Failed to reject invitation");
    }
  };
  // ========== END INVITATION FUNCTIONS ==========

  // ========== SEARCH FUNCTIONALITY LIKE FRIENDSLIST.JS ==========
  // Handle search toggle
  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      // If hiding search, clear the search
      clearSearch();
    } else {
      // If showing search, focus the input
      setTimeout(() => {
        const searchInput = document.getElementById("allSearchInput");
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  };

  // Handle search input
  const handleSearch = (query) => {
    setSearchQuery(query);
    setIsSearching(query.length > 0);

    if (query.length === 0) {
      setFilteredConversations(conversations);
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered = conversations.filter((conv) => {
      const nameMatch = conv.display_name?.toLowerCase().includes(searchTerm);
      const lastMessageMatch = conv.last_message
        ?.toLowerCase()
        .includes(searchTerm);
      const descriptionMatch = conv.description
        ?.toLowerCase()
        .includes(searchTerm);

      return nameMatch || lastMessageMatch || descriptionMatch;
    });

    setFilteredConversations(filtered);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setFilteredConversations(conversations);
    setShowSearch(false); // Also hide the search input when clearing
  };

  // Handle conversation click
  const handleConversationClick = async (conversation) => {
    // Mark messages as read if there are unread messages
    if (conversation.unread_count > 0) {
      try {
        if (conversation.type === "private") {
          await chatAPI.markAsRead(conversation._id);
          if (onResetChatCount) onResetChatCount(conversation._id);
          if (socket) {
            socket.emit("messages_read", {
              chat_id: conversation._id,
              user_id: currentUserId,
            });
          }
        } else {
          await groupAPI.markGroupMessagesAsRead(conversation._id);
          if (onResetGroupCount) onResetGroupCount(conversation._id);
          if (socket) {
            socket.emit("group_messages_read", {
              group_id: conversation._id,
              user_id: currentUserId,
            });
          }
        }

        // Update local state
        updateUnreadCount(conversation._id, conversation.type, 0);
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    }

    // Select the conversation
    if (conversation.type === "private") {
      const isOnline = isUserOnline(conversation.other_user?._id);
      const statusInfo = getStatusInfo(conversation.other_user?._id);
      console.log("conversation", conversation);

      onSelectChat({
        type: "private",
        _id: conversation._id,
        name: conversation.display_name,
        avatar: conversation.avatar,
        receiverId: conversation.other_user?._id,
        other_user: conversation.other_user,
        status: isOnline ? "online" : "offline",
        last_seen: conversation.other_user?.last_seen,
        is_online: isOnline,
        status_info: statusInfo,
      });
    } else {
      onSelectChat({
        type: "group",
        _id: conversation._id,
        name: conversation.display_name,
        description: conversation.description,
        avatar: conversation.avatar || "/group-avatar.png",
        created_by: conversation.created_by,
        member_count: conversation.member_count,
      });
    }
  };

  // Menu functions
  const handleMenuToggle = (conversationId, conversationType, e) => {
    e.stopPropagation();
    const menuKey = `${conversationType}-${conversationId}`;
    setMenuOpen(menuOpen === menuKey ? null : menuKey);
    setSelectedConversationForAction({
      id: conversationId,
      type: conversationType,
    });
  };

  // View profile
  const handleViewProfile = (conversation) => {
    if (conversation.type === "private") {
      setSelectedUserProfile({
        userId: conversation.other_user?._id,
        chatData: conversation,
      });
      setShowProfileModal(true);
    } else {
      setSelectedGroupProfile({
        id: conversation._id,
        name: conversation.display_name,
        description: conversation.description,
        created_by: conversation.created_by,
        member_count: conversation.member_count,
        is_public: conversation.is_public,
        user_role: conversation.user_role,
      });
      setShowGroupProfileModal(true);
    }
    setMenuOpen(null);
  };

  // Toggle mute/unmute
  const handleToggleMute = (conversationId, conversationType) => {
    if (conversationType === "private") {
      const newMutedChats = new Set(mutedChats);
      if (newMutedChats.has(conversationId)) {
        newMutedChats.delete(conversationId);
        successToast("Notifications unmuted");
      } else {
        newMutedChats.add(conversationId);
        successToast("Notifications muted");
      }
      setMutedChats(newMutedChats);
    } else {
      const newMutedGroups = new Set(mutedGroups);
      if (newMutedGroups.has(conversationId)) {
        newMutedGroups.delete(conversationId);
        successToast("Group notifications unmuted");
      } else {
        newMutedGroups.add(conversationId);
        successToast("Group notifications muted");
      }
      setMutedGroups(newMutedGroups);
    }
    setMenuOpen(null);
  };

  // Clear chat
  const handleClearChat = async () => {
    try {
      if (!selectedConversationForAction) return;

      const { id, type } = selectedConversationForAction;

      if (type === "private") {
        await chatAPI.clearChat(id);
        successToast("Chat cleared successfully");
      } else {
        // For groups, you might want different logic
        errorToast("Cannot clear group chat");
      }

      // Update UI
      setConversations((prev) =>
        prev.map((conv) =>
          conv.type === type && conv._id === id
            ? {
                ...conv,
                last_message: "Chat cleared",
                last_message_type: "system",
                last_message_at: new Date().toISOString(),
                unread_count: 0,
              }
            : conv,
        ),
      );

      setFilteredConversations((prev) =>
        prev.map((conv) =>
          conv.type === type && conv._id === id
            ? {
                ...conv,
                last_message: "Chat cleared",
                last_message_type: "system",
                last_message_at: new Date().toISOString(),
                unread_count: 0,
              }
            : conv,
        ),
      );

      setShowClearConfirm(false);
      setMenuOpen(null);
      setSelectedConversationForAction(null);
    } catch (error) {
      console.error("Error clearing chat:", error);
      errorToast("Failed to clear chat");
    }
  };

  // Remove user/group
  const handleRemoveUser = async () => {
    try {
      if (!selectedConversationForAction) return;

      const { id: _id, type } = selectedConversationForAction;
      console.log(
        "selectedConversationForAction",
        selectedConversationForAction,
      );

      if (type === "private") {
        await chatAPI.deleteChat(_id);
        successToast("User removed successfully");

        // Remove from local state
        setConversations((prev) =>
          prev.filter((conv) => !(conv.type === "private" && conv._id === _id)),
        );

        setFilteredConversations((prev) =>
          prev.filter((conv) => !(conv.type === "private" && conv._id === _id)),
        );

        // If this chat is currently selected, clear it
        if (selectedChat?.type === "private" && selectedChat?._id === id) {
          onSelectChat(null);
        }
      } else {
        // For groups, you might want different logic
        errorToast("Cannot remove group from here");
      }

      setShowRemoveConfirm(false);
      setMenuOpen(null);
      setSelectedConversationForAction(null);
    } catch (error) {
      console.error("Error removing user:", error);
      errorToast("Failed to remove user");
    }
  };

  // Helper to update unread count
  const updateUnreadCount = (_id, type, count) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.type === type && conv._id === _id
          ? { ...conv, unread_count: count }
          : conv,
      ),
    );

    setFilteredConversations((prev) =>
      prev.map((conv) =>
        conv.type === type && conv._id === _id
          ? { ...conv, unread_count: count }
          : conv,
      ),
    );
  };

  // // Get message preview
  // const getMessagePreview = (conversation) => {
  //   if (!conversation.last_message) return 'Start a conversation';

  //   // Check for different message types
  //   switch (conversation.last_message_type) {
  //     case 'image':
  //       return '📷 Image';
  //     case 'file':
  //       return '📎 File';
  //     case 'video':
  //       return '🎥 Video';
  //     case 'audio':
  //       return '🎤 Voice Message';
  //     case 'code':
  //       return '💻 Code Snippet';
  //     case 'deleted':
  //       return '🗑️ Message deleted';
  //     case 'system':
  //       if (conversation.last_message === 'Chat cleared') return '🧹 Chat cleared';
  //       return '🔔 System notification';
  //     default:
  //       const text = conversation.last_message || '';
  //       if (text.length > 30) {
  //         return `${text.substring(0, 30)}...`;
  //       }
  //       return text;
  //   }
  // };

  const getMessagePreview = (conversationOrMessage) => {
    // Handle if it's a conversation object
    if (
      conversationOrMessage &&
      conversationOrMessage._id &&
      conversationOrMessage.last_message !== undefined
    ) {
      const message = {
        message_type: conversationOrMessage.last_message_type,
        message: conversationOrMessage.last_message,
        file_name: conversationOrMessage.file_name,
      };
      return getMessagePreviewFromMessage(message);
    }

    // Handle if it's a message object
    return getMessagePreviewFromMessage(conversationOrMessage);
  };

  const getMessagePreviewFromMessage = (message) => {
    if (!message) return "Start a conversation";

    // Handle different message types INCLUDING FILES
    switch (message.message_type) {
      case "image":
        return "📷 Image";
      case "file":
        return message.file_name
          ? `📎 ${message.file_name.substring(0, 20)}${message.file_name.length > 20 ? "..." : ""}`
          : "📎 File";
      case "video":
        return "🎥 Video";
      case "audio":
        if (message.file_name) {
          const fileName = message.file_name.toLowerCase();
          if (
            fileName.includes("voice") ||
            fileName.includes("audio") ||
            fileName.includes("recording") ||
            fileName.endsWith(".webm")
          ) {
            return "🎤 Voice Message";
          }
        }
        return "🎵 Audio Message";
      case "code":
        return "💻 Code Snippet";
      case "deleted":
        return "🗑️ Message deleted";
      case "system":
        if (message.message === "Chat cleared") {
          return "🧹 Chat cleared";
        }
        return "🔔 System notification";
      default:
        const text =
          message.message || message.last_message || "Start a conversation";
        if (text.length > 30) {
          return `${text.substring(0, 30)}...`;
        }
        return text;
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

      if (diffInDays === 0) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (diffInDays === 1) {
        return "Yesterday";
      } else if (diffInDays < 7) {
        return date.toLocaleDateString([], { weekday: "short" });
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
    } catch (error) {
      return "";
    }
  };

  // Format date for invitations
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();

    // If today
    if (date.toDateString() === now.toDateString()) {
      return "Today";
    }

    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    // Within this year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }

    // Older
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  // Refresh conversations
  const refreshConversations = () => {
    loadAllConversations();
    loadInvitations();
  };

  // Calculate unread counts
  const totalUnread = conversations.reduce(
    (sum, conv) => sum + (conv.unread_count || 0),
    0,
  );
  const unreadChats = conversations
    .filter((c) => c.type === "private")
    .reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const unreadGroups = conversations
    .filter((c) => c.type === "group")
    .reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="p-4" ref={menuRef}>
      {/* Header with refresh and search buttons - LIKE FRIENDSLIST.JS */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            All Conversations
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-600">
              {conversations.length} total
            </span>
            {totalUnread > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {totalUnread} unread
              </span>
            )}
            {invitations.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                {invitations.length} pending
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Search Icon Button - LIKE FRIENDSLIST.JS */}
          <button
            onClick={toggleSearch}
            className={`text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer ${
              showSearch ? "bg-blue-100 text-blue-600" : ""
            }`}
            title={showSearch ? "Hide search" : "Search conversations"}
          >
            {showSearch ? (
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            )}
          </button>

          {/* Refresh Icon Button */}
          <button
            onClick={refreshConversations}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="Refresh conversations"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Input (shown when search icon is clicked) - LIKE FRIENDSLIST.JS */}
      {showSearch && (
        <div className="mb-3">
          <div className="relative">
            <input
              id="allSearchInput"
              type="text"
              placeholder="Search conversations by name or message..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full p-2 pl-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
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
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          {isSearching && (
            <div className="text-xs text-gray-500 mt-1">
              Found {filteredConversations.length} conversation
              {filteredConversations.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Pending Invitations Section  */}
      {invitations.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 text-sm flex items-center">
              Pending Invitations
              <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-2.5 py-1 font-bold">
                {invitations.length}
              </span>
            </h3>
            <button
              onClick={refreshConversations}
              className="text-xs text-orange-600 hover:text-orange-800 font-medium cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {invitations.map((invitation) => {
            const uniqueKey = `invite-${invitation._id}-${
              invitation.user_id?._id || invitation.user?._id
            }`;

            return (
              <div
                key={uniqueKey}
                className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-3 shadow-sm"
              >
                <div className="flex flex-col space-y-3">
                  {/* User Info */}
                  <div className="flex items-start space-x-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={
                          invitation.user_id?.profile_image ||
                          "/default-avatar.png"
                        }
                        alt={invitation.user_id?.name}
                        className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                      />
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-3.5 h-3.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-gray-900 truncate">
                          {invitation.user_id?.username || "Unknown User"}
                        </p>
                        <span className="text-xs text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full font-medium">
                          New
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 truncate">
                        {invitation.user_id?.email || "No email"}
                      </p>

                      <div className="flex items-center mt-2">
                        <svg
                          className="w-4 h-4 text-orange-500 mr-1.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="text-xs text-orange-600 font-medium">
                          Waiting for your response
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons - LIKE FRIENDSLIST.JS */}
                  <div className="flex gap-2 pt-3 border-t border-orange-100">
                    <button
                      onClick={() => acceptInvitation(invitation._id)}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-green-600 hover:to-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Accept
                    </button>

                    <button
                      onClick={() => rejectInvitation(invitation._id)}
                      className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-red-600 hover:to-pink-700 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Reject
                    </button>
                  </div>

                  {/* Additional Info */}
                  {invitation.message && (
                    <div className="text-xs text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                      <p className="font-medium text-gray-700 mb-1">Message:</p>
                      <p className="line-clamp-2">{invitation.message}</p>
                    </div>
                  )}

                  {/* Time */}
                  <div className="text-xs text-gray-400 flex justify-between items-center">
                    <span>{formatDate(invitation.created_at)}</span>
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {formatTime(invitation.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unread Summary */}
      {totalUnread > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-sm font-medium text-gray-700">
                  {totalUnread} unread
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600">
                  {unreadChats} in chats
                </span>
                <span className="text-xs text-gray-600">
                  {unreadGroups} in groups
                </span>
              </div>
            </div>
            <button
              onClick={refreshConversations}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
            <p className="ml-2 text-gray-600">Loading conversations...</p>
          </div>
        ) : (isSearching ? filteredConversations : conversations).length ===
          0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-3"
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
            <p className="text-gray-500 text-sm">
              {isSearching ? "No conversations found" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(isSearching ? filteredConversations : conversations).map(
              (conversation) => {
                const menuKey = `${conversation.type}-${conversation._id}`;
                const isSelected =
                  selectedChat?.type === conversation.type &&
                  selectedChat?.is_onlineid === conversation._id;
                const isMuted =
                  conversation.type === "private"
                    ? mutedChats.has(conversation._id)
                    : mutedGroups.has(conversation._id);

                // For private chats, get online status
                let statusInfo = null;
                if (
                  conversation.type === "private" &&
                  conversation.other_user?._id
                ) {
                  statusInfo = getStatusInfo(conversation.other_user._id);
                }
                const isTyping = typingUsers[conversation._id]?.isTyping;
                const typingUserId = typingUsers[conversation._id]?.userId;

                return (
                  <div
                    key={menuKey}
                    onClick={() => handleConversationClick(conversation)}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 relative group ${
                      isSelected
                        ? "bg-green-50 border border-green-200 shadow-sm"
                        : conversation.unread_count > 0
                          ? "bg-blue-50 border border-blue-200 hover:bg-blue-100"
                          : "border border-transparent hover:bg-gray-50"
                    }`}
                  >
                    {/* Avatar with online status - LIKE FRIENDSLIST.JS */}
                    <div className="relative flex-shrink-0">
                      {conversation.type === "group" ? (
                        <div
                          className={`w-10 h-10 ${conversation.type === "group" ? "bg-gradient-to-br from-green-500 to-blue-600" : "bg-gradient-to-br from-blue-500 to-purple-600"} rounded-full flex items-center justify-center text-white font-semibold`}
                        >
                          {conversation.display_name.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="relative">
                          <img
                            src={conversation.avatar || "/default-avatar.png"}
                            alt={conversation.display_name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                          />
                          {/* Online status indicator - LIKE FRIENDSLIST.JS */}
                          {statusInfo && (
                            <div
                              className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${statusInfo.dotColor} ${
                                statusInfo.text === "Online" &&
                                statusInfo.dotColor === "bg-green-500"
                                  ? "animate-pulse"
                                  : ""
                              }`}
                            ></div>
                          )}
                        </div>
                      )}

                      {/* Unread badge */}
                      {conversation.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                          {conversation.unread_count > 99
                            ? "99+"
                            : conversation.unread_count}
                        </span>
                      )}

                      {/* Type indicator */}
                      {conversation.type === "group" && (
                        <div
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white ${
                            conversation.type === "group"
                              ? "bg-blue-500"
                              : "bg-green-500"
                          }`}
                        >
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

                    {/* Conversation info */}
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={`font-medium text-gray-900 truncate ${conversation.unread_count > 0 ? "font-semibold text-black" : ""}`}
                          >
                            {conversation.display_name}
                            {isMuted && (
                              <span className="ml-2 text-gray-400">
                                <svg
                                  className="w-4 h-4 inline"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                  />
                                </svg>
                              </span>
                            )}
                          </p>
                          {conversation.type === "group" &&
                            conversation.is_public && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                                Public
                              </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                          {conversation.last_message_at && (
                            <span
                              className={`text-xs whitespace-nowrap ${conversation.unread_count > 0 ? "text-green-600 font-medium" : "text-gray-500"}`}
                            >
                              {formatTime(conversation.last_message_at)}
                            </span>
                          )}
                          {/* 3-dot menu button */}
                          <button
                            onClick={(e) =>
                              handleMenuToggle(
                                conversation._id,
                                conversation.type,
                                e,
                              )
                            }
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
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
                                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        {isTyping ? (
                          <div className="typing-indicator">
                            <span className="typing-dots"></span>
                            <span className="typing-dots"></span>
                            <span className="typing-dots"></span>
                            Typing
                          </div>
                        ) : (
                          <p
                            className={`text-sm truncate flex-1 ${conversation.unread_count > 0 ? "text-black font-medium" : "text-gray-600"}`}
                          >
                            {getMessagePreview(conversation)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Dropdown Menu (Similar to FriendsList and GroupManager) */}
                    {menuOpen === menuKey && (
                      <div className="absolute right-0 top-10 z-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewProfile(conversation);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          View{" "}
                          {conversation.type === "group"
                            ? "Group Details"
                            : "Profile"}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMute(
                              conversation._id,
                              conversation.type,
                            );
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          {isMuted ? (
                            <>
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                />
                              </svg>
                              Unmute Notifications
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                />
                              </svg>
                              Mute Notifications
                            </>
                          )}
                        </button>

                        {conversation.type === "private" && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowClearConfirm(true);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Clear Chat
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRemoveConfirm(true);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                            >
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Remove User
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadAllConversations}
              className="mt-2 text-red-700 hover:text-red-900 text-sm font-medium cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Remove User Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-opacity-10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.284 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Remove User
                </h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to remove this user? This action cannot
                  be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRemoveConfirm(false);
                  setMenuOpen(null);
                  setSelectedConversationForAction(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveUser}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-opacity-10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Clear Chat
                </h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to clear all messages? This action
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  setMenuOpen(null);
                  setSelectedConversationForAction(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modals */}
      {showProfileModal && selectedUserProfile && (
        <UserProfileModal
          userId={selectedUserProfile.userId}
          chatData={selectedUserProfile.chatData}
          isOpen={showProfileModal}
          onClose={() => {
            setShowProfileModal(false);
            setSelectedUserProfile(null);
          }}
          onStartChat={(chatData) => {
            onSelectChat({
              type: "private",
              id: chatData.chat_id,
              name: chatData.other_user?.username,
              receiverId: chatData.other_user?._id,
            });
          }}
        />
      )}

      {showGroupProfileModal && selectedGroupProfile && (
        <GroupProfileModal
          groupId={selectedGroupProfile._id}
          isOpen={showGroupProfileModal}
          onClose={() => {
            setShowGroupProfileModal(false);
            setSelectedGroupProfile(null);
          }}
          groupData={selectedGroupProfile}
          currentUserId={currentUserId}
          socket={socket}
        />
      )}
    </div>
  );
}
