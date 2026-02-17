"use client";

import { useState, useEffect, useCallback, forwardRef, useRef } from "react";
import { chatAPI, groupAPI, userAPI } from "../lib/api";
import { successToast, errorToast } from "./toast";
import LoadingSpinner from "./LoadingSpinner";
import UserProfileModal from "./UserProfileModal";
import GroupProfileModal from "./GroupProfileModal";

const PopupNotificationPanel = forwardRef(
  (
    {
      socket,
      currentUserId,
      onSelectChat,
      onOpenMiniChat,
      onOpenInNewTab,
      isOpen,
      onClose,
    },
    ref,
  ) => {
    const [allChats, setAllChats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("all");
    const [unreadCounts, setUnreadCounts] = useState({ chats: 0, groups: 0 });
    const [searchQuery, setSearchQuery] = useState("");
    console.log(allChats, "allChats");

    // Menu states
    const [menuOpen, setMenuOpen] = useState(null);
    const [selectedChatForAction, setSelectedChatForAction] = useState(null);
    const [showInviteFriend, setShowInviteFriend] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);

    // Invite friend search states
    const [friendSearchQuery, setFriendSearchQuery] = useState("");
    const [friendSearchResults, setFriendSearchResults] = useState([]);
    const [inviteError, setInviteError] = useState("");

    // Create group states
    const [newGroup, setNewGroup] = useState({
      name: "",
      description: "",
      is_public: false,
    });
    const [groupError, setGroupError] = useState("");

    // Profile modal states
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedUserProfile, setSelectedUserProfile] = useState(null);
    const [showGroupProfileModal, setShowGroupProfileModal] = useState(false);
    const [selectedGroupProfile, setSelectedGroupProfile] = useState(null);

    const [mentionSuggestions, setMentionSuggestions] = useState([]);
    const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
    const [mentionSearchQuery, setMentionSearchQuery] = useState("");
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const [mentionedUsers, setMentionedUsers] = useState([]);
    const [groupMembers, setGroupMembers] = useState([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [typingUsers, setTypingUsers] = useState({});
    const [groupTypingUsers, setGroupTypingUsers] = useState({});

    // ✅ Internal ref for click detection
    const panelRef = useRef(null);
    const menuRef = useRef(null);

    // Online status tracking
    const [userOnlineStatus, setUserOnlineStatus] = useState({});

    // ✅ Handle clicks outside the panel
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event) => {
        if (panelRef.current && !panelRef.current.contains(event.target)) {
          const isPopupClick = event.target.closest(
            '[data-popup-window="true"]',
          );
          const isNotificationIcon = event.target.closest(
            '[data-notification-icon="true"]',
          );

          if (!isPopupClick && !isNotificationIcon) {
            onClose();
          }
        }
      };

      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen, onClose]);

    // Click outside to close menu
    useEffect(() => {
      const handleClickOutsideMenu = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setMenuOpen(null);
        }
      };

      document.addEventListener("mousedown", handleClickOutsideMenu);
      return () => {
        document.removeEventListener("mousedown", handleClickOutsideMenu);
      };
    }, []);

    // ========== LOAD CONVERSATIONS ==========
    const loadAllConversations = useCallback(async () => {
      if (!currentUserId) return;

      try {
        setLoading(true);

        // Load private chats with unread counts
        const chatsResponse = await chatAPI.getChats();
        console.log("Raw chats API response:", chatsResponse.data);

        const privateChats = (chatsResponse.data || []).map((chat) => ({
          ...chat,
          type: "private",
          display_name: chat.other_user?.username || "Unknown User",
          last_message_at: chat.last_message_at || chat.created_at,
          unread_count: chat.unread_count || 0,
          avatar: chat.other_user?.profile_image,
          other_user: chat.other_user || {},
        }));

        // Load groups with unread counts
        const groupsResponse = await groupAPI.getUserGroups();
        const groupChats = (groupsResponse.data || []).map((group) => ({
          ...group,
          type: "group",
          display_name: group.name,
          last_message_at: group.last_message_at || group.created_at,
          unread_count: group.unread_count || 0,
          avatar: "/group-avatar.png",
          member_count: group.member_count || 0,
        }));

        // Combine and sort by last message time
        const combined = [...privateChats, ...groupChats].sort((a, b) => {
          const timeA = new Date(a.last_message_at || 0);
          const timeB = new Date(b.last_message_at || 0);
          return timeB - timeA;
        });

        setAllChats(combined);

        // Calculate unread counts
        const totalUnreadChats = privateChats.reduce(
          (sum, chat) => sum + (chat.unread_count || 0),
          0,
        );
        const totalUnreadGroups = groupChats.reduce(
          (sum, group) => sum + (group.unread_count || 0),
          0,
        );

        setUnreadCounts({
          chats: totalUnreadChats,
          groups: totalUnreadGroups,
        });
      } catch (error) {
        console.error("Error loading conversations:", error);
        errorToast("Failed to load conversations");
      } finally {
        setLoading(false);
      }
    }, [currentUserId]);

    // ========== SOCKET LISTENERS FOR ONLINE STATUS ==========
    useEffect(() => {
      if (!socket) return;

      const handleUserStatusChange = (data) => {
        // Update the user online status
        setUserOnlineStatus((prev) => ({
          ...prev,
          [data.userId]: {
            isOnline: data.isOnline,
            status: data.status,
            lastSeen: data.lastSeen,
          },
        }));

        // Also update the chats array to reflect status changes
        setAllChats((prev) =>
          prev.map((chat) => {
            if (
              chat.type === "private" &&
              chat.other_user?._id === data.userId
            ) {
              return {
                ...chat,
                other_user: {
                  ...chat.other_user,
                  is_online: data.isOnline,
                  status: data.status,
                  last_seen: data.lastSeen,
                },
              };
            }
            return chat;
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

        // Also update chats
        setAllChats((prev) =>
          prev.map((chat) => {
            const userId = chat.other_user?._id;
            if (chat.type === "private" && userId && newStatuses[userId]) {
              return {
                ...chat,
                other_user: {
                  ...chat.other_user,
                  is_online: newStatuses[userId].isOnline,
                  status: newStatuses[userId].status,
                  last_seen: newStatuses[userId].lastSeen,
                },
              };
            }
            return chat;
          }),
        );
      };

      socket.on("user_status_change", handleUserStatusChange);
      socket.on("initial_status_sync", handleInitialStatusSync);

      // Request initial status sync
      if (socket.connected) {
        socket.emit("request_initial_status");
      }

      return () => {
        socket.off("user_status_change", handleUserStatusChange);
        socket.off("initial_status_sync", handleInitialStatusSync);
      };
    }, [socket]);

    // Helper function to get user status for a chat
    const getUserStatus = (userId) => {
      // First check real-time socket status
      if (userOnlineStatus[userId]) {
        return userOnlineStatus[userId];
      }

      // Fallback to chat data
      const chat = allChats.find(
        (c) => c.type === "private" && c.other_user?._id === userId,
      );
      if (chat?.other_user) {
        return {
          isOnline: chat.other_user.is_online || false,
          status: chat.other_user.status || "offline",
          lastSeen: chat.other_user.last_seen,
        };
      }

      // Default
      return {
        isOnline: false,
        status: "offline",
        lastSeen: null,
      };
    };

    // Get status info for display
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

      // Offline
      return {
        text: "Offline",
        dotColor: "bg-gray-400",
        borderColor: "border-gray-300",
        textColor: "text-gray-600",
      };
    };

    // ========== SOCKET LISTENERS FOR REAL-TIME UPDATES ==========
    useEffect(() => {
      if (!socket || !currentUserId || !isOpen) return;

      // Handle private message
      const handlePrivateMessage = (message) => {
        const chatId = message.chat_id;
        if (!chatId) return;

        updateChatList(message, chatId, "private", true);
      };

      // Handle group message
      const handleGroupMessage = (message) => {
        const groupId = message.group_id;
        if (!groupId) return;

        updateChatList(message, groupId, "group", true);
      };

      // Handle sidebar chat update
      const handleUpdateSidebarChat = (data) => {
        const chatId = data.chat_id;
        if (!chatId) return;

        updateChatList(data, chatId, data.chat_type || "private", false);
      };

      // Handle unread count updates from server
      const handleUnreadCountUpdate = (data) => {
        if (data.user_id.toString() !== currentUserId.toString()) return;

        // Update total unread counts from server
        if (data.total_unread_chats !== undefined) {
          setUnreadCounts((prev) => ({
            ...prev,
            chats: data.total_unread_chats,
          }));
        }

        if (data.total_unread_groups !== undefined) {
          setUnreadCounts((prev) => ({
            ...prev,
            groups: data.total_unread_groups,
          }));
        }
      };

      // Update chat list function
      const updateChatList = (message, id, type, isNewMessage = false) => {
        setAllChats((prev) => {
          const chatIndex = prev.findIndex(
            (chat) =>
              chat.type === type && chat._id.toString() === id.toString(),
          );

          // If chat not found, reload all chats
          if (chatIndex === -1) {
            setTimeout(() => loadAllConversations(), 100);
            return prev;
          }

          const updatedChats = [...prev];
          const chatToUpdate = { ...updatedChats[chatIndex] };

          // Update last message info
          const messageContent = getMessagePreview({
            message_type: message.message_type || message.last_message_type,
            message: message.message || message.last_message,
            file_name: message.file_name,
          });

          chatToUpdate.last_message = messageContent;
          chatToUpdate.last_message_type =
            message.message_type || message.last_message_type;
          chatToUpdate.last_message_at =
            message.created_at ||
            message.last_message_at ||
            new Date().toISOString();

          // If it's a new message (not from current user), increment unread count
          // const isOwnMessage = message.sender_id._id === currentUserId;
          const isOwnMessage =
            message.is_own_message || message.sender_id._id == currentUserId;
          if (isNewMessage && !isOwnMessage) {
            chatToUpdate.unread_count = (chatToUpdate.unread_count || 0) + 1;

            // Update unread counts for the filter
            setUnreadCounts((prev) => ({
              chats: type === "private" ? prev.chats + 1 : prev.chats,
              groups: type === "group" ? prev.groups + 1 : prev.groups,
            }));
          }

          // Move updated chat to the top
          updatedChats.splice(chatIndex, 1);
          updatedChats.unshift(chatToUpdate);

          return updatedChats;
        });
      };

      // Handle when messages are marked as read
      const handleMessagesRead = (data) => {
        if (data.user_id.toString() !== currentUserId.toString()) return;

        setAllChats((prev) => {
          const updatedChats = prev.map((chat) =>
            chat.type === "private" &&
            chat._id.toString() === data.chat_id.toString()
              ? { ...chat, unread_count: 0 }
              : chat,
          );

          // Recalculate unread counts
          const totalUnreadChats = updatedChats
            .filter((chat) => chat.type === "private")
            .reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

          const totalUnreadGroups = updatedChats
            .filter((chat) => chat.type === "group")
            .reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

          setUnreadCounts({
            chats: totalUnreadChats,
            groups: totalUnreadGroups,
          });

          return updatedChats;
        });
      };

      const handleGroupMessagesRead = (data) => {
        if (data.user_id.toString() !== currentUserId.toString()) return;

        setAllChats((prev) => {
          const updatedChats = prev.map((chat) =>
            chat.type === "group" &&
            chat._id.toString() === data.group_id.toString()
              ? { ...chat, unread_count: 0 }
              : chat,
          );

          // Recalculate unread counts
          const totalUnreadChats = updatedChats
            .filter((chat) => chat.type === "private")
            .reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

          const totalUnreadGroups = updatedChats
            .filter((chat) => chat.type === "group")
            .reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

          setUnreadCounts({
            chats: totalUnreadChats,
            groups: totalUnreadGroups,
          });

          return updatedChats;
        });
      };

      // Set up socket listeners
      socket.on("private_message", handlePrivateMessage);
      socket.on("group_message", handleGroupMessage);
      socket.on("update_sidebar_chat", handleUpdateSidebarChat);
      socket.on("update_unread_counts", handleUnreadCountUpdate);
      socket.on("messages_read", handleMessagesRead);
      socket.on("group_messages_read", handleGroupMessagesRead);

      return () => {
        socket.off("private_message", handlePrivateMessage);
        socket.off("group_message", handleGroupMessage);
        socket.off("update_sidebar_chat", handleUpdateSidebarChat);
        socket.off("update_unread_counts", handleUnreadCountUpdate);
        socket.off("messages_read", handleMessagesRead);
        socket.off("group_messages_read", handleGroupMessagesRead);
      };
    }, [socket, currentUserId, isOpen, loadAllConversations]);

    // ========== SOCKET LISTENERS FOR TYPING INDICATORS ==========
    useEffect(() => {
      if (!socket) return;

      // Handle private chat typing
      const handlePrivateTyping = (data) => {
        if (data.is_typing) {
          // User started typing
          setTypingUsers((prev) => ({
            ...prev,
            [data.chat_id]: {
              isTyping: true,
              userId: data.user_id,
              timestamp: Date.now(),
            },
          }));
        } else {
          // User stopped typing
          setTypingUsers((prev) => {
            const newTyping = { ...prev };
            delete newTyping[data.chat_id];
            return newTyping;
          });
        }
      };

      // Handle group chat typing
      const handleGroupTyping = (data) => {
        if (data.is_typing) {
          // User started typing
          setGroupTypingUsers((prev) => ({
            ...prev,
            [data.group_id]: {
              isTyping: true,
              userId: data.user_id,
              timestamp: Date.now(),
            },
          }));
        } else {
          // User stopped typing
          setGroupTypingUsers((prev) => {
            const newTyping = { ...prev };
            delete newTyping[data.group_id];
            return newTyping;
          });
        }
      };

      // For backward compatibility
      const handleLegacyTyping = (data) => {
        if (data.chat_id) {
          // Assume it's private chat
          handlePrivateTyping(data);
        } else if (data.group_id) {
          // Assume it's group chat
          handleGroupTyping({
            ...data,
            group_id: data.group_id,
          });
        }
      };

      // Set up socket listeners
      socket.on("user_typing", handlePrivateTyping);
      socket.on("group_user_typing", handleGroupTyping);
      socket.on("typing", handleLegacyTyping);

      return () => {
        socket.off("user_typing", handlePrivateTyping);
        socket.off("group_user_typing", handleGroupTyping);
        socket.off("typing", handleLegacyTyping);
      };
    }, [socket]);

    // Auto-clear expired typing indicators
    useEffect(() => {
      if (!isOpen) return;

      const interval = setInterval(() => {
        const now = Date.now();

        // Clear expired private typing indicators
        setTypingUsers((prev) => {
          const newTyping = { ...prev };
          Object.keys(newTyping).forEach((chatId) => {
            if (
              newTyping[chatId]?.timestamp &&
              now - newTyping[chatId].timestamp > 3000
            ) {
              delete newTyping[chatId];
            }
          });
          return newTyping;
        });

        // Clear expired group typing indicators
        setGroupTypingUsers((prev) => {
          const newTyping = { ...prev };
          Object.keys(newTyping).forEach((groupId) => {
            if (
              newTyping[groupId]?.timestamp &&
              now - newTyping[groupId].timestamp > 3000
            ) {
              delete newTyping[groupId];
            }
          });
          return newTyping;
        });
      }, 1000);

      return () => clearInterval(interval);
    }, [isOpen]);

    // Load conversations when panel opens
    useEffect(() => {
      if (isOpen && currentUserId) {
        loadAllConversations();
      }
    }, [isOpen, currentUserId, loadAllConversations]);

    const handleInputChange = (e) => {
      const value = e.target.value;
      setNewMessage(value);

      // Check for @ mention
      if (validatedChatRef.current?.type === "group" && value.includes("@")) {
        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf("@");

        if (lastAtIndex > -1) {
          const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
          const hasSpaceAfterAt = textAfterAt.includes(" ");
          const query = textAfterAt.trim();

          if (!hasSpaceAfterAt && query.length > 0) {
            setMentionSearchQuery(query);

            // Calculate position for mention suggestions
            const inputElement = e.target;
            const rect = inputElement.getBoundingClientRect();

            // Get cursor position within input
            const tempSpan = document.createElement("span");
            tempSpan.style.visibility = "hidden";
            tempSpan.style.whiteSpace = "pre";
            tempSpan.style.font = window.getComputedStyle(inputElement).font;
            tempSpan.textContent = textBeforeCursor;

            document.body.appendChild(tempSpan);
            const textWidth = tempSpan.getBoundingClientRect().width;
            document.body.removeChild(tempSpan);

            // Calculate position relative to viewport
            const inputLeft = rect.left;
            const inputTop = rect.top;
            const inputScrollTop =
              window.scrollY || document.documentElement.scrollTop;
            const inputScrollLeft =
              window.scrollX || document.documentElement.scrollLeft;

            setMentionPosition({
              top: inputTop + inputScrollTop - 320, // Position above input
              left: inputLeft + inputScrollLeft + textWidth - 150, // Align with cursor
            });

            // Search for members
            searchMentions(query);
            setShowMentionSuggestions(true);
            setSelectedMentionIndex(0);
          } else if (textAfterAt.length === 0 && !hasSpaceAfterAt) {
            // Show all members when just @ is typed
            const filteredMembers = groupMembers.filter(
              (member) =>
                !mentionedUsers.some(
                  (mentioned) => mentioned._id === member._id,
                ),
            );
            setMentionSuggestions(filteredMembers.slice(0, 10));
            setShowMentionSuggestions(true);

            // Calculate position
            const inputElement = e.target;
            const rect = inputElement.getBoundingClientRect();
            const inputScrollTop =
              window.scrollY || document.documentElement.scrollTop;
            const inputScrollLeft =
              window.scrollX || document.documentElement.scrollLeft;

            setMentionPosition({
              top: rect.top + inputScrollTop - 320,
              left: rect.left + inputScrollLeft,
            });
          } else {
            setShowMentionSuggestions(false);
          }
        } else {
          setShowMentionSuggestions(false);
        }
      }

      // TYPING INDICATOR FIXED
      if (socket && validatedChatRef.current && currentUserId) {
        const receiverId = getReceiverId();

        if (value.trim().length > 0) {
          // User started typing

          if (validatedChatRef.current.type === "private" && receiverId) {
            socket.emit("typing_start", {
              receiver_id: receiverId,
              chat_id: validatedChatRef.current._id,
              user_id: currentUserId,
              is_typing: true,
            });
          } else if (validatedChatRef.current.type === "group") {
            socket.emit("typing_start_group", {
              group_id: validatedChatRef.current._id,
              user_id: currentUserId,
              is_typing: true,
            });
          }

          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          // Set timeout to stop typing indicator after 2 seconds of inactivity
          typingTimeoutRef.current = setTimeout(() => {
            console.log("⏰ Stopping typing indicator");
            stopTyping();
          }, 2000);
        } else {
          // Input is empty, stop typing immediately
          console.log("🛑 Input empty, stopping typing");
          stopTyping();
        }
      }
    };

    const stopTyping = () => {
      if (socket && validatedChatRef.current && currentUserId) {
        const receiverId = getReceiverId();

        if (validatedChatRef.current.type === "private" && receiverId) {
          console.log(
            "✋ Stopping typing in private chat:",
            validatedChatRef.current._id,
          );
          socket.emit("typing_stop", {
            receiver_id: receiverId,
            chat_id: validatedChatRef.current._id,
            user_id: currentUserId,
            is_typing: false,
          });
        } else if (validatedChatRef.current.type === "group") {
          console.log(
            "✋ Stopping typing in group:",
            validatedChatRef.current._id,
          );
          socket.emit("typing_stop_group", {
            group_id: validatedChatRef.current._id,
            user_id: currentUserId,
            is_typing: false,
          });
        }

        // Clear local state
        setIsTyping(false);
        setTypingUser(null);

        // Clear timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    };

    // ========== CONVERSATION CLICK HANDLER ==========
    const handleConversationClick = async (chat, e) => {
      const isNewTabClick = e.target.closest('[data-action="new-tab"]');
      const isExpandClick = e.target.closest('[data-action="expand"]');
      const isMenuClick = e.target.closest(".conversation-menu-button");

      if (isMenuClick) {
        e.stopPropagation();
        handleMenuToggle(chat._id, chat.type, e);
        return;
      }

      // Mark messages as read when clicking on conversation
      if (chat.unread_count > 0) {
        try {
          if (chat.type === "private") {
            await chatAPI.markAsRead(chat._id);
            if (socket) {
              socket.emit("messages_read", {
                chat_id: chat._id,
                user_id: currentUserId,
              });
            }
          } else {
            await groupAPI.markGroupMessagesAsRead(chat._id);
            if (socket) {
              socket.emit("group_messages_read", {
                group_id: chat._id,
                user_id: currentUserId,
              });
            }
          }

          // Update local state immediately
          setAllChats((prev) =>
            prev.map((c) =>
              c.type === chat.type && c._id === chat._id
                ? { ...c, unread_count: 0 }
                : c,
            ),
          );

          // Update unread counts
          setUnreadCounts((prev) => ({
            chats:
              chat.type === "private"
                ? prev.chats - chat.unread_count
                : prev.chats,
            groups:
              chat.type === "group"
                ? prev.groups - chat.unread_count
                : prev.groups,
          }));
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      }

      if (isNewTabClick) {
        e.stopPropagation();
        if (onOpenInNewTab) onOpenInNewTab(chat);
        return;
      }

      if (isExpandClick) {
        e.stopPropagation();
        if (onSelectChat) {
          onSelectChat({
            type: chat.type,
            id: chat._id,
            name: chat.display_name,
            avatar: chat.avatar,
            ...(chat.type === "private" && {
              receiverId: chat.other_user?._id,
              other_user: chat.other_user,
            }),
            ...(chat.type === "group" && {
              description: chat.description,
              member_count: chat.member_count,
            }),
          });
        }
        if (onClose) onClose();
        return;
      }

      // Open in popup chat
      if (onOpenMiniChat) {
        const popupChat = {
          id: chat._id,
          type: chat.type,
          name: chat.display_name,
          display_name: chat.display_name,
          avatar:
            chat.avatar ||
            (chat.type === "group"
              ? "/group-avatar.png"
              : "/default-avatar.png"),
          ...(chat.type === "private" && {
            receiverId: chat.other_user?._id,
            other_user: chat.other_user,
            is_online: chat.other_user?.is_online || false,
          }),
          ...(chat.type === "group" && {
            description: chat.description,
            member_count: chat.member_count,
            is_public: chat.is_public,
          }),
        };
        onOpenMiniChat(popupChat);
      }
    };

    // ========== MENU FUNCTIONS ==========
    const handleMenuToggle = (chatId, chatType, e) => {
      e.stopPropagation();
      const menuKey = `${chatType}-${chatId}`;
      setMenuOpen(menuOpen === menuKey ? null : menuKey);
      setSelectedChatForAction({ id: chatId, type: chatType });
    };

    const handleViewProfile = (chat) => {
      if (chat.type === "private") {
        setSelectedUserProfile({
          userId: chat.other_user?._id,
          chatData: chat,
        });
        setShowProfileModal(true);
      } else {
        setSelectedGroupProfile({
          id: chat._id,
          name: chat.display_name,
          description: chat.description,
          created_by: chat.created_by,
          member_count: chat.member_count,
          is_public: chat.is_public,
        });
        setShowGroupProfileModal(true);
      }
      setMenuOpen(null);
    };

    // ========== INVITE FRIEND FUNCTIONALITY ==========
    const handleFriendSearch = async (query) => {
      setFriendSearchQuery(query);
      if (query.length > 2) {
        try {
          const response = await userAPI.searchUsers(query);
          setFriendSearchResults(response.data);
        } catch (error) {
          console.error("Error searching users:", error);
          setFriendSearchResults([]);
        }
      } else {
        setFriendSearchResults([]);
      }
    };

    const sendInvitation = async (email) => {
      try {
        setInviteError("");
        const response = await chatAPI.sendInvitation(email);

        if (socket) {
          socket.emit("invitation_sent", {
            to_email: email,
            from_user_id: currentUserId,
            invitation_id: response.data._id,
          });
        }

        setFriendSearchQuery("");
        setFriendSearchResults([]);
        successToast("Invitation sent successfully!");
      } catch (error) {
        setInviteError(
          error.response?.data?.message || "Failed to send invitation",
        );
      }
    };

    const clearFriendSearch = () => {
      setFriendSearchQuery("");
      setFriendSearchResults([]);
      setInviteError("");
    };

    // ========== CREATE GROUP FUNCTIONALITY ==========
    const handleCreateGroup = async () => {
      if (!newGroup.name.trim()) {
        setGroupError("Please enter a group name");
        return;
      }

      try {
        setGroupError("");
        const response = await groupAPI.createGroup(newGroup);

        // Reload conversations to show the new group
        loadAllConversations();

        successToast("Group created successfully!");
        setNewGroup({ name: "", description: "", is_public: false });
        setShowCreateGroup(false);
      } catch (error) {
        setGroupError(error.response?.data?.error || "Failed to create group");
      }
    };

    // ========== HELPER FUNCTIONS ==========
    // const getMessagePreview = (message) => {
    //   if (!message || !message.last_message_type) return 'Start a conversation';

    //   switch (message.last_message_type) {
    //     case 'image': return '📷 Image';
    //     case 'file': return `📎 ${message.file_name || 'File'}`;
    //     case 'video': return '🎥 Video';
    //     case 'audio': return '🎤 Voice Message';
    //     case 'call':
    //       try {
    //         if (message.last_message && typeof message.last_message === 'string') {
    //           const callData = JSON.parse(message.last_message);
    //           const callType = callData.call_type === 'video' ? 'Video Call' : 'Voice Call';
    //           switch (callData.call_status) {
    //             case 'completed':
    //             case 'ended':
    //               return `📞 ${callType} (${formatCallDuration(callData.call_duration)})`;
    //             case 'missed':
    //               return `📞 Missed ${callType}`;
    //             case 'rejected':
    //             case 'declined':
    //               return `📞 Declined ${callType}`;
    //             case 'cancelled':
    //               return `📞 Cancelled ${callType}`;
    //             default:
    //               return `📞 ${callType}`;
    //           }
    //         }
    //         return '📞 Call';
    //       } catch {
    //         return '📞 Call';
    //       }
    //     case 'code': return '💻 Code Snippet';
    //     case 'deleted': return '🗑️ Message deleted';
    //     case 'system':
    //       if (message.last_message === 'Chat cleared') return '🧹 Chat cleared';
    //       return '🔔 System notification';
    //     default:
    //       const text = message.last_message || '';
    //       if (text.length > 40) {
    //         return `${text.substring(0, 40)}...`;
    //       }
    //       return text;
    //   }
    // };
    // ========== HELPER FUNCTIONS ==========
    const getMessagePreview = (messageOrChat) => {
      // If it's a full conversation object (from allChats)
      if (
        messageOrChat &&
        messageOrChat._id &&
        messageOrChat.last_message !== undefined
      ) {
        const message = {
          message_type: messageOrChat.last_message_type,
          message: messageOrChat.last_message,
          file_name: messageOrChat.file_name,
        };
        return getMessagePreviewFromMessage(message);
      }

      // If it's a message object from socket events
      return getMessagePreviewFromMessage(messageOrChat);
    };

    const getMessagePreviewFromMessage = (message) => {
      if (!message) return "Start a conversation";

      // First check if it's a call message
      if (
        message.message_type === "call" ||
        message.last_message_type === "call"
      ) {
        try {
          if (message.message && typeof message.message === "string") {
            const callData = JSON.parse(message.message);
            const callType =
              callData.call_type === "video" ? "Video Call" : "Voice Call";
            switch (callData.call_status) {
              case "completed":
              case "ended":
                return `📞 ${callType} (${formatCallDuration(callData.call_duration)})`;
              case "missed":
                return `📞 Missed ${callType}`;
              case "rejected":
              case "declined":
                return `📞 Declined ${callType}`;
              case "cancelled":
                return `📞 Cancelled ${callType}`;
              default:
                return `📞 ${callType}`;
            }
          }
          return "📞 Call";
        } catch {
          return "📞 Call";
        }
      }

      // Handle different message types INCLUDING FILES
      const messageType = message.message_type || message.last_message_type;

      switch (messageType) {
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
          if (
            message.message === "Chat cleared" ||
            message.last_message === "Chat cleared"
          ) {
            return "🧹 Chat cleared";
          }
          return "🔔 System notification";
        default:
          // For text messages
          const text =
            message.message || message.last_message || "Start a conversation";
          if (text.length > 40) {
            return `${text.substring(0, 40)}...`;
          }
          return text;
      }
    };

    const formatCallDuration = (seconds) => {
      if (!seconds || seconds === 0) return "0s";
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const formatTime = (timestamp) => {
      if (!timestamp) return "";
      try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

        if (diffInHours < 1) {
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        } else if (date.toDateString() === now.toDateString()) {
          return "Today";
        } else if (diffInHours < 24) {
          return "Yesterday";
        } else {
          return date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
          });
        }
      } catch (error) {
        return "";
      }
    };

    // Add this helper function after your other helper functions
    const getTypingInfo = (chat) => {
      if (chat.type === "private") {
        const typingData = typingUsers[chat._id];

        // Check if typing data exists and it's not the current user
        if (
          typingData &&
          typingData.isTyping &&
          typingData.userId &&
          parseInt(typingData.userId) !== parseInt(currentUserId)
        ) {
          // Get the typing user's name from chat data
          const chatUser = allChats.find(
            (c) => c.type === "private" && c._id === chat._id,
          )?.other_user;

          if (chatUser) {
            return {
              isTyping: true,
              userName: chatUser.username || chatUser.first_name,
              message: "is typing...",
            };
          }

          return {
            isTyping: true,
            message: "Typing...",
          };
        }

        // Clear typing if it expired (older than 3 seconds)
        if (typingData && typingData.timestamp) {
          const isExpired = Date.now() - typingData.timestamp > 3000;
          if (isExpired) {
            // Clean up expired typing indicator
            setTypingUsers((prev) => {
              const newTyping = { ...prev };
              delete newTyping[chat._id];
              return newTyping;
            });
          }
        }
      } else if (chat.type === "group") {
        const typingData = groupTypingUsers[chat._id];

        // Check if typing data exists and it's not the current user
        if (
          typingData &&
          typingData.isTyping &&
          typingData.userId &&
          parseInt(typingData.userId) !== parseInt(currentUserId)
        ) {
          // For groups, we could fetch the typing user's name
          // For now, just show generic typing indicator
          return {
            isTyping: true,
            message: "Someone is typing...",
          };
        }

        // Clear typing if it expired
        if (typingData && typingData.timestamp) {
          const isExpired = Date.now() - typingData.timestamp > 3000;
          if (isExpired) {
            setGroupTypingUsers((prev) => {
              const newTyping = { ...prev };
              delete newTyping[chat._id];
              return newTyping;
            });
          }
        }
      }

      return { isTyping: false };
    };

    const filteredConversations = allChats.filter((chat) => {
      console.log(chat, "chat");

      if (filter === "unread" && chat.unread_count === 0) return false;
      if (filter === "chats" && chat.type !== "private") return false;
      if (filter === "groups" && chat.type !== "group") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = chat.display_name?.toLowerCase().includes(query);
        const messageMatch = chat.last_message?.toLowerCase().includes(query);
        return nameMatch || messageMatch;
      }

      return true;
    });

    if (!isOpen) return null;

    return (
      <div
        ref={panelRef}
        className="fixed bottom-20 right-6 z-[1000] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[600px] flex flex-col">
          <div
            className={`
          bg-white rounded-2xl shadow-2xl border-2 border-purple-200
          flex flex-col overflow-hidden h-full
          transform transition-all duration-300 ease-out
          ${isOpen ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-95"}
        `}
          >
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">All Conversations</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="w-2 h-2 bg-blue-200 rounded-full"></span>
                      <span className="text-blue-100">
                        {allChats.length} total
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="w-2 h-2 bg-red-300 rounded-full"></span>
                      <span className="text-blue-100">
                        {unreadCounts.chats + unreadCounts.groups} unread
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Invite Friend Button */}
                  <button
                    onClick={() => {
                      setShowInviteFriend(!showInviteFriend);
                      setShowCreateGroup(false);
                    }}
                    className={`text-xs px-3 py-1 rounded-full hover:bg-white/30 cursor-pointer transition-colors flex items-center gap-1 ${showInviteFriend ? "bg-white text-blue-600" : "bg-white/20 text-white"}`}
                    title="Invite Friend"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                    Invite
                  </button>

                  {/* Create Group Button */}
                  <button
                    onClick={() => {
                      setShowCreateGroup(!showCreateGroup);
                      setShowInviteFriend(false);
                    }}
                    className={`text-xs px-3 py-1 rounded-full hover:bg-white/30 cursor-pointer transition-colors flex items-center gap-1 ${showCreateGroup ? "bg-white text-blue-600" : "bg-white/20 text-white"}`}
                    title="Create Group"
                  >
                    <svg
                      className="w-3 h-3"
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
                    Group
                  </button>

                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Invite Friend Form */}
              {showInviteFriend && (
                <div className="mt-3 bg-white/10 p-3 rounded-lg">
                  <div className="relative mb-2">
                    <input
                      type="text"
                      placeholder="Search by email or name..."
                      value={friendSearchQuery}
                      onChange={(e) => handleFriendSearch(e.target.value)}
                      className="w-full bg-white/20 text-white placeholder-white/60 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-white/40"
                      autoFocus
                    />
                    {friendSearchQuery && (
                      <button
                        onClick={clearFriendSearch}
                        className="absolute right-3 top-2.5 text-white/60 hover:text-white"
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

                  {inviteError && (
                    <div className="text-red-200 text-xs mb-2 p-2 bg-red-500/20 rounded">
                      {inviteError}
                    </div>
                  )}

                  {/* Search Results */}
                  {friendSearchResults.length > 0 && (
                    <div className="mt-2 bg-white/10 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {friendSearchResults.map((user) => (
                        <div
                          key={user._id}
                          className="flex items-center justify-between p-3 border-b border-white/10 last:border-b-0 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center">
                            <img
                              src={user.profile_image || "/default-avatar.png"}
                              alt={user.first_name}
                              className="w-8 h-8 rounded-full mr-3 border-2 border-white/30"
                            />
                            <div>
                              <p className="font-medium text-sm text-white">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs text-white/80">
                                {user.email}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => sendInvitation(user.email)}
                            className="bg-green-500 text-white px-3 py-1.5 rounded text-sm hover:bg-green-600 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <svg
                              className="w-3 h-3"
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
                            Invite
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {friendSearchQuery.length >= 2 &&
                    friendSearchResults.length === 0 && (
                      <div className="text-center py-3 text-white/60 text-sm">
                        No users found matching "{friendSearchQuery}"
                      </div>
                    )}
                </div>
              )}

              {/* Create Group Form */}
              {showCreateGroup && (
                <div className="mt-3 bg-white/10 p-3 rounded-lg">
                  <input
                    type="text"
                    placeholder="Group name..."
                    value={newGroup.name}
                    onChange={(e) =>
                      setNewGroup({ ...newGroup, name: e.target.value })
                    }
                    className="w-full bg-white/20 text-white placeholder-white/60 rounded px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-white/40"
                    autoFocus
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={newGroup.description}
                    onChange={(e) =>
                      setNewGroup({ ...newGroup, description: e.target.value })
                    }
                    className="w-full bg-white/20 text-white placeholder-white/60 rounded px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-white/40"
                    rows="2"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateGroup}
                      className="flex-1 bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 transition-colors cursor-pointer"
                    >
                      Create Group
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateGroup(false);
                        setNewGroup({
                          name: "",
                          description: "",
                          is_public: false,
                        });
                        setGroupError("");
                      }}
                      className="flex-1 bg-gray-500 text-white px-3 py-2 rounded text-sm hover:bg-gray-600 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  {groupError && (
                    <div className="text-red-200 text-xs mt-2 p-2 bg-red-500/20 rounded">
                      {groupError}
                    </div>
                  )}
                </div>
              )}

              {/* Search Bar for conversations */}
              <div className="relative mt-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full bg-white/20 text-white placeholder-white/60 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-white/40 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
                <svg
                  className="w-5 h-5 absolute right-3 top-2.5 text-white/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 1114 0 7 7 0 01-14 0z"
                  />
                </svg>
              </div>

              {/* Filter Tabs */}
              <div className="flex border-b border-white/20 mt-3 -mx-4 px-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilter("all");
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition-colors relative cursor-pointer ${
                    filter === "all"
                      ? "text-white border-b-2 border-white"
                      : "text-blue-100 hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilter("unread");
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition-colors relative cursor-pointer ${
                    filter === "unread"
                      ? "text-white border-b-2 border-white"
                      : "text-blue-100 hover:text-white"
                  }`}
                >
                  Unread
                  {unreadCounts.chats + unreadCounts.groups > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCounts.chats + unreadCounts.groups > 99
                        ? "99+"
                        : unreadCounts.chats + unreadCounts.groups}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilter("chats");
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition-colors relative cursor-pointer ${
                    filter === "chats"
                      ? "text-white border-b-2 border-white"
                      : "text-blue-100 hover:text-white"
                  }`}
                >
                  Chats
                  {unreadCounts.chats > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCounts.chats > 99 ? "99+" : unreadCounts.chats}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilter("groups");
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition-colors relative cursor-pointer ${
                    filter === "groups"
                      ? "text-white border-b-2 border-white"
                      : "text-blue-100 hover:text-white"
                  }`}
                >
                  Groups
                  {unreadCounts.groups > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCounts.groups > 99 ? "99+" : unreadCounts.groups}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto bg-white">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                  <p className="ml-2 text-gray-600">Loading conversations...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
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
                    {searchQuery
                      ? "No conversations found"
                      : filter === "unread"
                        ? "No unread messages"
                        : "No conversations found"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100" ref={menuRef}>
                  {filteredConversations.map((chat) => {
                    const menuKey = `${chat.type}-${chat._id}`;

                    // Get status info for private chats
                    let statusInfo = null;
                    if (chat.type === "private" && chat.other_user?._id) {
                      statusInfo = getStatusInfo(chat.other_user._id);
                    }

                    // Get typing info
                    const typingInfo = getTypingInfo(chat);

                    return (
                      <div
                        key={`${chat.type}-${chat._id}`}
                        className={`p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group relative ${
                          chat.unread_count > 0 ? "bg-blue-50" : ""
                        }`}
                        onClick={(e) => handleConversationClick(chat, e)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative flex-shrink-0">
                            {/* Avatar with status indicator */}
                            {chat.type === "group" ? (
                              <div
                                className={`w-11 h-11 ${chat?.type === "group" ? "bg-gradient-to-br from-green-500 to-blue-600" : "bg-gradient-to-br from-blue-500 to-purple-600"} rounded-full flex items-center justify-center text-white font-semibold`}
                              >
                                {chat.display_name.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="relative">
                                <img
                                  src={chat.avatar || "/default-avatar.png"}
                                  alt={chat.display_name}
                                  className="w-11 h-11 rounded-full border-2 border-white shadow-sm"
                                />
                                {chat.type === "private" && statusInfo && (
                                  <div
                                    className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${statusInfo.dotColor} ${
                                      statusInfo.text === "Online" &&
                                      statusInfo.dotColor === "bg-green-500"
                                        ? "animate-pulse"
                                        : ""
                                    }`}
                                    title={statusInfo.text}
                                  ></div>
                                )}
                              </div>
                            )}

                            {/* Group indicator */}
                            {chat.type === "group" && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                                <svg
                                  className="w-2 h-2 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                </svg>
                              </div>
                            )}

                            {/* Unread count badge */}
                            {chat.unread_count > 0 && !typingInfo.isTyping && (
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
                                <span className="text-xs text-white font-bold">
                                  {chat.unread_count > 99
                                    ? "99+"
                                    : chat.unread_count}
                                </span>
                              </div>
                            )}

                            {/* Typing indicator badge */}
                            {typingInfo.isTyping && (
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                                <span className="text-xs text-white font-bold">
                                  ...
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate text-sm">
                                  {chat.display_name}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {formatTime(chat.last_message_at)}
                                </span>
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    className="conversation-menu-button text-gray-400 hover:text-blue-600 p-1 cursor-pointer"
                                    title="More options"
                                    onClick={(e) =>
                                      handleMenuToggle(chat._id, chat.type, e)
                                    }
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
                                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {typingInfo.isTyping ? (
                              <div className="typing-indicator">
                                <span className="typing-dots"></span>
                                <span className="typing-dots"></span>
                                <span className="typing-dots"></span>
                                Typing
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600 truncate">
                                {getMessagePreview(chat)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Dropdown Menu */}
                        {menuOpen === menuKey && (
                          <div className="absolute right-3 top-10 z-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewProfile(chat);
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
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                              View {chat.type === "group" ? "Group" : "Profile"}
                            </button>

                            <button
                              data-action="expand"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectChat({
                                  type: chat.type,
                                  id: chat._id,
                                  name: chat.display_name,
                                  avatar: chat.avatar,
                                  ...(chat.type === "private" && {
                                    receiverId: chat.other_user?._id,
                                    other_user: chat.other_user,
                                  }),
                                  ...(chat.type === "group" && {
                                    description: chat.description,
                                    member_count: chat.member_count,
                                  }),
                                });
                                if (onClose) onClose();
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
                                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
                                />
                              </svg>
                              Open in main window
                            </button>

                            <button
                              data-action="new-tab"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenInNewTab) onOpenInNewTab(chat);
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
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                              Open in new tab
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 px-4 py-2">
              <div className="flex justify-between items-center text-xs text-gray-600">
                <span>
                  Showing {filteredConversations.length} of {allChats.length}
                </span>
                <button
                  onClick={onClose}
                  className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  Close Panel
                </button>
              </div>
            </div>
          </div>
        </div>

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
              if (onClose) onClose();
            }}
          />
        )}

        {showGroupProfileModal && selectedGroupProfile && (
          <GroupProfileModal
            groupId={selectedGroupProfile.id}
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
  },
);

PopupNotificationPanel.displayName = "PopupNotificationPanel";

export default PopupNotificationPanel;
