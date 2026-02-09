'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { userAPI, chatAPI } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';
import { successToast, errorToast } from "./toast";
import { isCallMessage, parseCallMessage } from '../utils/messageUtils';
import UserProfileModal from './UserProfileModal';

export default function FriendsList({ onSelectChat, selectedChat, socket, currentUserId, onUnreadCountChange }) {
  const [chats, setChats] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  // Chat search state
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState([]);
  const [isSearchingChats, setIsSearchingChats] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);

  // Menu and action states
  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedChatForAction, setSelectedChatForAction] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [mutedChats, setMutedChats] = useState(new Set());
  const menuRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userOnlineStatus, setUserOnlineStatus] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [typingStatus, setTypingStatus] = useState({});
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
        setTypingUsers(prev => ({
          ...prev,
          [chatId]: {
            isTyping: data.is_typing,
            userId: userId,
            timestamp: Date.now()
          }
        }));

        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
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
    socket.on('user_typing', handleTypingEvent);
    socket.on('group_user_typing', handleTypingEvent);

    return () => {
      socket.off('user_typing', handleTypingEvent);
      socket.off('group_user_typing', handleTypingEvent);
    };
  }, [socket, currentUserId]);


  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load muted chats from localStorage
  useEffect(() => {
    const savedMutedChats = localStorage.getItem('mutedChats');
    if (savedMutedChats) {
      setMutedChats(new Set(JSON.parse(savedMutedChats)));
    }
  }, []);

  // Save muted chats to localStorage
  useEffect(() => {
    localStorage.setItem('mutedChats', JSON.stringify(Array.from(mutedChats)));
  }, [mutedChats]);

  // Helper function to check if a user is online
  const isUserOnline = (userId) => {
    if (userOnlineStatus[userId] !== undefined) {
      return userOnlineStatus[userId].isOnline || false;
    }
    const chat = chats.find(c => c.other_user?._id === userId);
    return chat?.other_user?.is_online || false;
  };

  // Enhanced load chats with proper unread count handling
  const loadChats = useCallback(async () => {
    try {
      if (!currentUserId) return;

      setLoading(true);

      // Load all chats with unread counts from server
      const response = await chatAPI.getChats();

      // Sort by last message time
      const sortedChats = (response.data || []).sort((a, b) => {
        const timeA = new Date(a.last_message_at || a.created_at || 0);
        const timeB = new Date(b.last_message_at || b.created_at || 0);
        return timeB - timeA;
      });

      setChats(response.data);
      setError('');

    } catch (error) {
      console.error(' Error loading chats:', error);
      setError('Failed to load chats');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [currentUserId]);

  // Load invitations
  const loadInvitations = useCallback(async () => {
    try {
      const response = await chatAPI.getPendingInvitations();

      // Filter out duplicates
      const uniqueInvitations = response.data.filter((invitation, index, self) =>
        index === self.findIndex(inv =>
          inv._id === invitation._id &&
          inv.user?._id === invitation.user?._id
        )
      );

      setInvitations(uniqueInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (currentUserId) {
      loadChats();
      loadInvitations();
    }
  }, [currentUserId, loadChats, loadInvitations]);

  // Socket listeners for unread counts
  useEffect(() => {
    if (!socket || !currentUserId) return;

    // const handleChatUnreadUpdated = (data) => {
    //   if (data.user_id.toString() !== currentUserId.toString()) return;

    //   // Update the specific chat's unread count
    //   setChats(prev => {
    //     const updatedChats = prev.map(chat =>
    //       chat._id.toString() === data.chat_id.toString()
    //         ? { ...chat, unread_count: data.unread_count || 0 }
    //         : chat
    //     );

    //     // Sort by last message time after update
    //     return updatedChats.sort((a, b) => {
    //       const timeA = new Date(a.last_message_at || a.created_at || 0);
    //       const timeB = new Date(b.last_message_at || b.created_at || 0);
    //       return timeB - timeA;
    //     });
    //   });
    // };

    // In the chat_unread_updated handler, ensure it updates for all message types
    const handleChatUnreadUpdated = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      // Update the specific chat's unread count for ALL message types
      setChats(prev => {
        const updatedChats = prev.map(chat =>
          chat._id.toString() === data.chat_id.toString()
            ? {
              ...chat,
              unread_count: data.unread_count || 0,
              // Update last message if provided
              ...(data.last_message && {
                last_message: data.last_message,
                last_message_type: data.last_message_type,
                last_message_at: data.last_message_at || chat.last_message_at
              })
            }
            : chat
        );

        // Sort by last message time after update
        return updatedChats.sort((a, b) => {
          const timeA = new Date(a.last_message_at || a.created_at || 0);
          const timeB = new Date(b.last_message_at || b.created_at || 0);
          return timeB - timeA;
        });
      });
    };

    const handleChatUnreadReset = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      // Reset the specific chat's unread count to 0
      setChats(prev => prev.map(chat =>
        chat._id.toString() === data.chat_id.toString()
          ? { ...chat, unread_count: 0 }
          : chat
      ));
    };

    socket.on('chat_unread_updated', handleChatUnreadUpdated);
    socket.on('chat_unread_reset', handleChatUnreadReset);

    return () => {
      socket.off('chat_unread_updated', handleChatUnreadUpdated);
      socket.off('chat_unread_reset', handleChatUnreadReset);
    };
  }, [socket, currentUserId]);

  // Enhanced socket listener for real-time updates with chat removal and clearing
  useEffect(() => {
    if (!socket || !currentUserId) return;

    // const handlePrivateMessage = (message) => {
    //   console.log("message", message);

    //   const chatId = message.chat_id;
    //   if (!chatId) return;

    //   const isOwnMessage = parseInt(message.sender_id) === parseInt(currentUserId);
    //   const isSelected = selectedChat?.type === 'private' && selectedChat?._id === chatId.toString();

    //   // Update last message
    //   updateChatList(message, chatId);

    //   // Only increment unread if not our own message AND not currently selected
    //   if (!isOwnMessage && !isSelected) {
    //     // Increment unread count locally
    //     setChats(prev => prev.map(chat =>
    //       chat._id.toString() === chatId.toString()
    //         ? {
    //             ...chat,
    //             unread_count: (chat.unread_count || 0) + 1,
    //             last_message: getMessagePreview({
    //               message_type: message.message_type,
    //               message: message.message,
    //               file_name: message.file_name
    //             }),
    //             last_message_type: message.message_type,
    //             last_message_at: message.created_at || new Date().toISOString()
    //           }
    //         : chat
    //     ));
    //   }
    // };

    //     const handlePrivateMessage = (message) => {
    //   console.log("message", message);

    //   const chatId = message.chat_id;
    //   if (!chatId) return;

    //   const isOwnMessage = parseInt(message.sender_id) === parseInt(currentUserId);
    //   const isSelected = selectedChat?.type === 'private' && selectedChat?._id === chatId.toString();

    //   // Check if it's a file message (image, video, file, audio)
    //   const isFileMessage = ['image', 'video', 'file', 'audio'].includes(message.message_type);

    //   // Update last message preview for ALL message types
    //   updateChatList(message, chatId);

    //   // Increment unread count if:
    //   // 1. Not our own message
    //   // 2. Chat is not currently selected
    //   // 3. Works for BOTH text and file messages
    //   if (!isOwnMessage && !isSelected) {
    //     setChats(prev => prev.map(chat =>
    //       chat._id.toString() === chatId.toString()
    //         ? {
    //             ...chat,
    //             unread_count: (chat.unread_count || 0) + 1,
    //             last_message: message.message || chat.last_message,
    //             last_message_type: message.message_type || chat.last_message_type,
    //             last_message_at: message.created_at || chat.last_message_at || new Date().toISOString()
    //           }
    //         : chat
    //     ));
    //   }
    // };

    const handlePrivateMessage = (message) => {
      console.log("📨 Private message received:", message);

      const chatId = message.chat_id;
      if (!chatId) return;

      const isOwnMessage = parseInt(message.sender_id) === parseInt(currentUserId);
      const isSelected = selectedChat?.type === 'private' && selectedChat?._id === chatId.toString();

      // Check if it's a file message (image, video, file, audio)
      const isFileMessage = ['image', 'video', 'file', 'audio'].includes(message.message_type);

      console.log(`📊 Message type: ${message.message_type}, isFile: ${isFileMessage}, isOwn: ${isOwnMessage}, isSelected: ${isSelected}`);

      // Update last message preview for ALL message types including files
      updateChatList(message, chatId);

      // ⚠️ CRITICAL FIX: Only increment unread count locally if:
      // 1. Not our own message
      // 2. Chat is not currently selected
      // 3. Works for BOTH text and file messages
      if (!isOwnMessage && !isSelected) {
        console.log(`📈 Incrementing unread count for chat ${chatId}`);

        setChats(prev => prev.map(chat =>
          chat._id.toString() === chatId.toString()
            ? {
              ...chat,
              unread_count: (chat.unread_count || 0) + 1,
              last_message: getMessagePreviewFromMessage(message),
              last_message_type: message.message_type,
              last_message_at: message.created_at || new Date().toISOString(),
              ...(message.file_name && { file_name: message.file_name })
            }
            : chat
        ));
      } else {
        console.log(`⏭️ Skipping unread increment: isOwn=${isOwnMessage}, isSelected=${isSelected}`);
      }
    };

    const handleUpdateSidebarChat = (data) => {
      const chatId = data.chat_id;
      if (!chatId) return;

      updateChatList(data, chatId);
    };

    const handleChatsRefresh = () => {
      loadChats();
    };

    const handleInvitationRejected = (data) => {
      console.log('Invitation rejected data:', data);
      setInvitations(prev => prev.filter(inv => inv._id !== data.invitation_id));
      errorToast(`${data?.response?.data?.chat?.user?.username || 'User'} declined your invitation`);
    };

    const handleChatAccepted = (data) => {
      loadChats();
    };

    const handleInvitationAccepted = (data) => {
      setInvitations(prev => prev.filter(inv => inv._id !== data.invitation_id));
      loadChats();
      console.log("invitation accepted data", data);
      successToast(`${data?.response?.data?.chat?.user?.username || 'User'} accepted your invitation!`);
    };

    const handleNewInvitation = (invitation) => {
      setInvitations(prev => {
        const alreadyExists = prev.some(inv =>
          inv._id === invitation._id ||
          (inv.from_user?._id === invitation.from_user?._id && inv.user?._id === invitation.user?._id)
        );

        if (alreadyExists) {
          return prev;
        }

        return [invitation, ...prev];
      });

      successToast(`New invitation from ${invitation.from_user?.username || invitation.from_user?.name}`);
    };

    // Handle chat removal by other user
    const handleChatRemoved = (data) => {
      // Remove chat from local state
      setChats(prev => prev.filter(chat => chat._id.toString() !== data.chat_id.toString()));

      // If this chat is currently selected, clear it
      if (selectedChat?._id === data.chat_id.toString()) {
        onSelectChat(null);
      }

      errorToast(`${data.removed_by_name} removed the chat`);
    };

    // Handle chat cleared by other user
    const handleChatClearedByOther = (data) => {
      // Optional: Show a notification
      // infoToast(`${data.cleared_by} cleared their chat history`);
    };

    // Handle chat cleared notification
    const handleChatCleared = (data) => {
      // Update the chat in the list to show "Chat cleared"
      setChats(prev => prev.map(chat =>
        chat._id.toString() === data.chat_id.toString()
          ? {
            ...chat,
            last_message: 'Chat cleared',
            last_message_type: 'system',
            last_message_at: new Date().toISOString()
          }
          : chat
      ));
    };

    // const updateChatList = (message, chatId) => {
    //   const isOwnMessage = parseInt(message.sender_id) === parseInt(currentUserId);

    //   setChats(prev => {
    //     const chatIndex = prev.findIndex(chat => chat._id.toString() === chatId.toString());

    //     // If chat not found, reload all chats
    //     if (chatIndex === -1) {
    //       setTimeout(() => loadChats(), 100);
    //       return prev;
    //     }

    //     const updatedChats = [...prev];
    //     const chatToUpdate = { ...updatedChats[chatIndex] };

    //     // Update last message info
    //     chatToUpdate.last_message = getMessagePreview({
    //       message_type: message.message_type || message.last_message_type,
    //       message: message.message || message.last_message,
    //       file_name: message.file_name
    //     });

    //     chatToUpdate.last_message_type = message.message_type || message.last_message_type;
    //     chatToUpdate.last_message_at = message.created_at || message.last_message_at || new Date().toISOString();

    //     // Move updated chat to the top
    //     updatedChats.splice(chatIndex, 1);
    //     updatedChats.unshift(chatToUpdate);

    //     return updatedChats;
    //   });
    // };

    const updateChatList = (message, chatId) => {
      console.log("🔄 Updating chat list for:", chatId);

      setChats(prev => {
        const chatIndex = prev.findIndex(chat => chat._id.toString() === chatId.toString());

        if (chatIndex === -1) {
          console.log("❌ Chat not found, reloading...");
          setTimeout(() => loadChats(), 100);
          return prev;
        }

        const updatedChats = [...prev];
        const chatToUpdate = { ...updatedChats[chatIndex] };

        // Update last message info for ALL message types
        chatToUpdate.last_message = message.message || getMessagePreviewFromMessage(message);
        chatToUpdate.last_message_type = message.message_type || chatToUpdate.last_message_type;
        chatToUpdate.last_message_at = message.created_at || message.last_message_at || new Date().toISOString();

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

    // Set up all socket listeners
    socket.on('private_message', handlePrivateMessage);
    socket.on('update_sidebar_chat', handleUpdateSidebarChat);
    socket.on('request_chats_refresh', handleChatsRefresh);
    socket.on('chats_updated', handleChatsRefresh);

    socket.on('invitation_sent', handleNewInvitation);
    socket.on('invitation_accepted', handleInvitationAccepted);
    socket.on('invitation_rejected', handleInvitationRejected);
    socket.on('chat_accepted', handleChatAccepted);

    // Add chat removal and clearing listeners
    socket.on('chat_removed', handleChatRemoved);
    socket.on('chat_cleared_by_other', handleChatClearedByOther);
    socket.on('chat_cleared', handleChatCleared);

    return () => {
      socket.off('private_message', handlePrivateMessage);
      socket.off('update_sidebar_chat', handleUpdateSidebarChat);
      socket.off('request_chats_refresh', handleChatsRefresh);
      socket.off('chats_updated', handleChatsRefresh);

      socket.off('invitation_sent', handleNewInvitation);
      socket.off('invitation_accepted', handleInvitationAccepted);
      socket.off('invitation_rejected', handleInvitationRejected);
      socket.off('chat_accepted', handleChatAccepted);

      // Clean up chat removal and clearing listeners
      socket.off('chat_removed', handleChatRemoved);
      socket.off('chat_cleared_by_other', handleChatClearedByOther);
      socket.off('chat_cleared', handleChatCleared);
    };
  }, [socket, currentUserId, selectedChat, loadChats, onSelectChat]);

  // Listen for real-time status changes via socket
  useEffect(() => {
    if (!socket) return;

    const handleUserStatusChange = (data) => {
      // Update the user online status
      setUserOnlineStatus(prev => ({
        ...prev,
        [data.userId]: {
          isOnline: data.isOnline,
          status: data.status,
          lastSeen: data.lastSeen
        }
      }));

      // Also update the chats array to reflect status changes
      setChats(prev => prev.map(chat => {
        if (chat.other_user?._id === data.userId) {
          return {
            ...chat,
            other_user: {
              ...chat.other_user,
              is_online: data.isOnline,
              status: data.status,
              last_seen: data.lastSeen
            }
          };
        }
        return chat;
      }));
    };

    // Listen for initial status sync
    const handleInitialStatusSync = (usersStatus) => {
      const newStatuses = {};

      usersStatus.forEach(userStatus => {
        newStatuses[userStatus.userId] = {
          isOnline: userStatus.isOnline,
          status: userStatus.status,
          lastSeen: userStatus.lastSeen
        };
      });

      setUserOnlineStatus(newStatuses);

      // Also update chats
      setChats(prev => prev.map(chat => {
        const userId = chat.other_user?._id;
        if (userId && newStatuses[userId]) {
          return {
            ...chat,
            other_user: {
              ...chat.other_user,
              is_online: newStatuses[userId].isOnline,
              status: newStatuses[userId].status,
              last_seen: newStatuses[userId].lastSeen
            }
          };
        }
        return chat;
      }));
    };

    socket.on('user_status_change', handleUserStatusChange);
    socket.on('initial_status_sync', handleInitialStatusSync);

    // Request initial status sync
    if (socket.connected) {
      socket.emit('request_initial_status');
    }

    return () => {
      socket.off('user_status_change', handleUserStatusChange);
      socket.off('initial_status_sync', handleInitialStatusSync);
    };
  }, [socket]);

  // Function to search chats
  const handleChatSearch = (query) => {
    setChatSearchQuery(query);
    setIsSearchingChats(query.length > 0);

    if (query.length === 0) {
      setFilteredChats([]);
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered = chats.filter(chat => {
      const username = chat.other_user?.username?.toLowerCase() || '';
      const firstName = chat.other_user?.first_name?.toLowerCase() || '';
      const lastName = chat.other_user?.last_name?.toLowerCase() || '';
      const lastMessage = chat.last_message?.toLowerCase() || '';

      return (
        username.includes(searchTerm) ||
        firstName.includes(searchTerm) ||
        lastName.includes(searchTerm) ||
        lastMessage.includes(searchTerm)
      );
    });

    setFilteredChats(filtered);
  };

  // Function to clear chat search
  const clearChatSearch = () => {
    setChatSearchQuery('');
    setIsSearchingChats(false);
    setFilteredChats([]);
    setShowChatSearch(false);
  };

  // Function to toggle chat search
  const toggleChatSearch = () => {
    setShowChatSearch(!showChatSearch);
    if (showChatSearch) {
      clearChatSearch();
    } else {
      setTimeout(() => {
        const searchInput = document.getElementById('chatSearchInput');
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  };

  // Handle chat click
  const handleChatClick = async (chat) => {
    // Mark messages as read via API only if there are unread messages
    if (chat.unread_count > 0) {
      try {
        await chatAPI.markAsRead(chat._id);

        // Emit socket event to notify server (and other user)
        if (socket) {
          socket.emit('messages_read', {
            chat_id: chat._id,
            user_id: currentUserId
          });
        }
      } catch (error) {
        console.error(' Error marking messages as read:', error);
      }
    }

    // Select the chat
    const isOnline = isUserOnline(chat.other_user?._id);
    const statusInfo = getStatusInfo(chat.other_user?._id);

    onSelectChat({
      type: 'private',
      id: chat._id,
      name: `${chat.other_user?.username}`,
      avatar: chat.other_user?.profile_image,
      last_message: chat.last_message,
      last_message_at: chat.last_message_at,
      receiverId: chat.other_user?._id,
      status: isOnline ? 'online' : 'offline',
      last_seen: chat.other_user?.last_seen,
      is_online: isOnline,
      status_info: statusInfo
    });
  };


  const getMessagePreview = (chatOrMessage) => {
    console.log("getMessagePreview input:", chatOrMessage);

    // Handle chat object (from conversations list)
    if (chatOrMessage && chatOrMessage._id && chatOrMessage.last_message !== undefined) {
      const message = {
        message_type: chatOrMessage.last_message_type,
        message: chatOrMessage.last_message,
        file_name: chatOrMessage.file_name
      };
      return getMessagePreviewFromMessage(message);
    }

    // Handle message object (from socket events)
    return getMessagePreviewFromMessage(chatOrMessage);
  };

  const getMessagePreviewFromMessage = (message) => {
    if (!message) return 'Start a conversation';


    // Handle different message types INCLUDING FILES
    switch (message.message_type) {
      case 'image':
        return '📷 Image';
      case 'file':
        return message.file_name
          ? `📎 ${message.file_name.substring(0, 20)}${message.file_name.length > 20 ? '...' : ''}`
          : '📎 File';
      case 'video':
        return '🎥 Video';
      case 'audio':
        if (message.file_name) {
          const fileName = message.file_name.toLowerCase();
          if (fileName.includes('voice') || fileName.includes('audio') ||
            fileName.includes('recording') || fileName.endsWith('.webm')) {
            return '🎤 Voice Message';
          }
        }
        return '🎵 Audio Message';
      case 'code':
        return '💻 Code Snippet';
      case 'deleted':
        return '🗑️ Message deleted';
      case 'system':
        if (message.message === 'Chat cleared') {
          return '🧹 Chat cleared';
        }
        return '🔔 System notification';
      default:
        const text = message.message || message.last_message || 'Start a conversation';
        if (text.length > 30) {
          return `${text.substring(0, 30)}...`;
        }
        return text;
    }
  };



  const cleanMessagePreview = (text) => {
    if (!text) return '';

    let cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return truncateMessage(cleanText, 30);
  };

  const extractPlainTextFromRichText = (richText) => {
    if (!richText) return '📝 Rich Text';

    try {
      let plainText = richText
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (plainText.length > 0 && plainText !== ' ') {
        const preview = truncateMessage(plainText, 25);
        return preview ? `📝 ${preview}` : '📝 Rich Text';
      }

      return '📝 Rich Text';
    } catch (error) {
      console.error('Error extracting plain text from rich text:', error);
      return '📝 Rich Text';
    }
  };

  const formatCallDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const truncateMessage = (message, maxLength = 30) => {
    if (!message || typeof message !== 'string') return '';

    const cleanMessage = message
      .replace(/[{}"']/g, '')
      .replace(/\\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanMessage.length <= maxLength) return cleanMessage;

    return cleanMessage.substring(0, maxLength) + '...';
  };

  // Search functionality (for user search - existing)
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length > 2) {
      try {
        const response = await userAPI.searchUsers(query);
        setSearchResults(response.data);
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
  };

  const sendInvitation = async (email) => {
    try {
      setError('');
      const response = await chatAPI.sendInvitation(email);
      setSearchQuery('');
      setShowSearch(false);
      setSearchResults([]);

      if (socket) {
        socket.emit('invitation_sent', {
          to_email: email,
          from_user_id: currentUserId,
          invitation_id: response.data._id
        });
      }

      await loadInvitations();
      successToast('Invitation sent successfully!');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to send invitation');
    }
  };

  const acceptInvitation = async (invitationId) => {
    try {
      const response = await chatAPI.acceptInvitation(invitationId);
      setInvitations(prev => prev.filter(inv => inv._id !== invitationId));
      await loadChats();

      if (socket) {
        socket.emit('invitation_accepted', {
          invitation_id: invitationId,
          user_id: currentUserId,
          response
        });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      errorToast(error.response?.data?.error || 'Failed to accept invitation');
    }
  };

  const rejectInvitation = async (invitationId) => {
    try {
      const response = await chatAPI.rejectInvitation(invitationId);
      setInvitations(prev => prev.filter(inv => inv._id !== invitationId));

      if (socket) {
        socket.emit('invitation_rejected', {
          invitation_id: invitationId,
          user_id: currentUserId,
          response
        });
      }
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      errorToast(error.response?.data?.error || 'Failed to reject invitation');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

      if (diffInDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffInDays === 1) {
        return 'Yesterday';
      } else if (diffInDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      return '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();

    // If today
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }

    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Within this year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Older
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  // Helper function to get user status
  const getUserStatus = (userId) => {
    // First check real-time socket status
    if (userOnlineStatus[userId]) {
      return userOnlineStatus[userId];
    }

    // Fallback to chat data
    const chat = chats.find(c => c.other_user?._id === userId);
    if (chat?.other_user) {
      return {
        isOnline: chat.other_user.is_online || false,
        status: chat.other_user.status || 'offline',
        lastSeen: chat.other_user.last_seen
      };
    }

    // Default
    return {
      isOnline: false,
      status: 'offline',
      lastSeen: null
    };
  };

  // Get status text and color
  const getStatusInfo = (userId) => {
    const status = getUserStatus(userId);

    if (status.isOnline) {
      if (status.status === 'away') {
        return {
          text: 'Away',
          dotColor: 'bg-yellow-500',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-600'
        };
      }
      return {
        text: 'Online',
        dotColor: 'bg-green-500',
        borderColor: 'border-green-200',
        textColor: 'text-green-600'
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
          text: 'Just now',
          dotColor: 'bg-gray-400',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-600'
        };
      } else if (diffInMinutes < 60) {
        return {
          text: `${diffInMinutes}m ago`,
          dotColor: 'bg-gray-400',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-600'
        };
      } else if (diffInHours < 2) {
        return {
          text: '1h ago',
          dotColor: 'bg-gray-400',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-600'
        };
      } else if (diffInHours < 24) {
        return {
          text: `${diffInHours}h ago`,
          dotColor: 'bg-gray-400',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-600'
        };
      } else {
        return {
          text: 'Offline',
          dotColor: 'bg-gray-400',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-600'
        };
      }
    }

    return {
      text: 'Offline',
      dotColor: 'bg-gray-400',
      borderColor: 'border-gray-300',
      textColor: 'text-gray-600'
    };
  };

  // Refresh chats manually
  const refreshChats = () => {
    loadChats();
    loadInvitations();
  };

  // Menu functions
  const handleMenuToggle = (chatId, e) => {
    e.stopPropagation();
    setMenuOpen(menuOpen === chatId ? null : chatId);
    setSelectedChatForAction(chatId);
  };

  // Handle remove user
  const handleRemoveUser = async () => {
    try {
      if (!selectedChatForAction) return;

      // Call API to remove the chat/connection
      await chatAPI.deleteChat(selectedChatForAction);

      // Remove chat from local state
      setChats(prev => prev.filter(chat => chat._id !== selectedChatForAction));

      // If this chat is currently selected, clear it
      if (selectedChat?._id === selectedChatForAction) {
        onSelectChat(null);
      }

      successToast('User removed successfully');
      setShowRemoveConfirm(false);
      setMenuOpen(null);
      setSelectedChatForAction(null);
    } catch (error) {
      console.error('Error removing user:', error);
      errorToast('Failed to remove user');
    }
  };

  // Handle clear chat
  const handleClearChat = async () => {
    try {
      if (!selectedChatForAction) return;

      // Call API to clear chat messages
      await chatAPI.clearChat(selectedChatForAction);

      // Update local state immediately
      setChats(prev => prev.map(chat =>
        chat._id === selectedChatForAction
          ? {
            ...chat,
            last_message: 'Chat cleared',
            last_message_type: 'system',
            last_message_at: new Date().toISOString(),
            unread_count: 0 // Also reset unread count
          }
          : chat
      ));

      successToast('Chat cleared successfully');
      setShowClearConfirm(false);
      setMenuOpen(null);
      setSelectedChatForAction(null);

      // If this chat is currently selected, refresh messages
      if (selectedChat?._id === selectedChatForAction) {
        onSelectChat(null); // Deselect chat to show it's cleared
        setTimeout(() => onSelectChat(selectedChat), 100); // Reselect to refresh
      }

    } catch (error) {
      console.error('Error clearing chat:', error);
      errorToast('Failed to clear chat');
    }
  };

  // Handle mute/unmute notifications
  const handleToggleMute = (chatId) => {
    const newMutedChats = new Set(mutedChats);
    if (newMutedChats.has(chatId)) {
      newMutedChats.delete(chatId);
      successToast('Notifications unmuted');
    } else {
      newMutedChats.add(chatId);
      successToast('Notifications muted');
    }
    setMutedChats(newMutedChats);
    setMenuOpen(null);
  };

  // Handle view profile
  const handleViewProfile = (chat) => {
    if (chat?.other_user) {
      setSelectedUserProfile({
        userId: chat.other_user._id,
        chatData: chat
      });
      setShowProfileModal(true);
    }
    setMenuOpen(null);
  };

  const handleStartChatFromProfile = (chatData) => {
    // If we already have chat data (from existing chat), use it
    if (chatData._id && chatData.type === 'private') {
      // Check if this is a valid chat ID (chat ID, not user ID)
      const existingChat = chats.find(chat => chat._id === chatData._id);

      if (existingChat) {
        // Select the existing chat
        handleChatClick(existingChat);
      } else {
        // Might be a user ID, try to find chat by user ID
        const chatByUserId = chats.find(chat =>
          chat.other_user?._id === chatData._id
        );

        if (chatByUserId) {
          handleChatClick(chatByUserId);
        } else {
          // No existing chat, need to create one
          createNewChatWithUser(chatData);
        }
      }
    } else if (chatData.other_user?._id) {
      // We have user data, find or create chat
      const existingChat = chats.find(chat =>
        chat.other_user?._id === chatData.other_user._id
      );

      if (existingChat) {
        handleChatClick(existingChat);
      } else {
        createNewChatWithUser(chatData);
      }
    }
  };

  // Function to create new chat (if needed)
  const createNewChatWithUser = async (userData) => {
    try {
      // First, check if an invitation already exists
      const existingInvitation = invitations.find(inv =>
        inv.user?._id === userData._id || inv.from_user?._id === userData._id
      );

      if (existingInvitation) {
        // If pending invitation exists, show message
        errorToast('Chat invitation already pending');
        return;
      }

      // Send invitation
      const email = userData.email || userData.other_user?.email;
      if (email) {
        await sendInvitation(email);
      } else {
        errorToast('Cannot start chat: User email not available');
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      errorToast('Failed to start chat');
    }
  };

  // Calculate total unread
  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

  return (
    <div className="p-4" ref={menuRef}>
      {/* Header with refresh and search buttons - UPDATED LIKE GROUPMANAGER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Friends</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-600">
              {chats.length} chats
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
          {/* Search Icon Button - LIKE GROUPMANAGER */}
          <button
            onClick={toggleChatSearch}
            className={`text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer ${showChatSearch ? 'bg-blue-100 text-blue-600' : ''
              }`}
            title={showChatSearch ? "Hide search" : "Search chats"}
          >
            {showChatSearch ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>

          {/* Refresh Icon Button - LIKE GROUPMANAGER */}
          <button
            onClick={refreshChats}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="Refresh chats"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Search Input (shown when search icon is clicked) - LIKE GROUPMANAGER */}
      {showChatSearch && (
        <div className="mb-3">
          <div className="relative">
            <input
              id="chatSearchInput"
              type="text"
              placeholder="Search chats by name or message..."
              value={chatSearchQuery}
              onChange={(e) => handleChatSearch(e.target.value)}
              className="w-full p-2 pl-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {chatSearchQuery && (
              <button
                onClick={clearChatSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {isSearchingChats && (
            <div className="text-xs text-gray-500 mt-1">
              Found {filteredChats.length} chat{filteredChats.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Invite Friend Button - LIKE GROUPMANAGER'S CREATE GROUP BUTTON */}
      <button
        onClick={() => setShowSearch(!showSearch)}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2.5 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center mb-4 cursor-pointer shadow-sm hover:shadow"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Invite Friend
      </button>

      {showSearch && (
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            {/* <svg
              className="absolute left-3 top-3 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg> */}
          </div>

          {error && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Search Results - UPDATED DESIGN */}
      {searchResults.length > 0 && (
        <div className="mb-4 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">Search Results</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                {searchResults.length} found
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">People you can invite to chat</p>
          </div>

          <div className="divide-y divide-gray-100">
            {searchResults.map(user => (
              <div key={user._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* User Avatar - LIKE GROUPMANAGER */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={user.profile_image || '/default-avatar.png'}
                      alt={user.first_name}
                      className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                    />
                    {user.is_online && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="font-semibold text-gray-900 truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      {user.status && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {user.status}
                        </span>
                      )}
                    </div>

                    {user.username && (
                      <div className="flex items-center text-xs text-gray-500 mb-3">
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        @{user.username}
                      </div>
                    )}

                    {/* Action Button - LIKE GROUPMANAGER */}
                    <button
                      onClick={() => sendInvitation(user.email)}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-purple-700 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:shadow"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Send Invitation
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Results Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Showing {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setSearchResults([])}
                className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
              >
                Clear Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Invitations - UPDATED DESIGN */}
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
              onClick={refreshChats}
              className="text-xs text-orange-600 hover:text-orange-800 font-medium cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {invitations.map((invitation) => {
            const uniqueKey = `invite-${invitation._id}-${invitation.from_user?._id || invitation.user?._id}`;

            return (
              <div key={uniqueKey} className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-3 shadow-sm">
                <div className="flex flex-col space-y-3">
                  {/* User Info */}
                  <div className="flex items-start space-x-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={invitation.from_user?.profile_image || invitation.user?.profile_image || '/default-avatar.png'}
                        alt={invitation.from_user?.name || invitation.user?.first_name}
                        className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                      />
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-gray-900 truncate">
                          {invitation.from_user?.name ||
                            `${invitation.user?.first_name} ${invitation.user?.last_name || ''}`.trim() ||
                            invitation.user?.username ||
                            'Unknown User'}
                        </p>
                        <span className="text-xs text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full font-medium">
                          New
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 truncate">
                        {invitation.from_user?.email || invitation.user?.email || 'No email'}
                      </p>

                      <div className="flex items-center mt-2">
                        <svg className="w-4 h-4 text-orange-500 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-orange-600 font-medium">Waiting for your response</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons - LIKE GROUPMANAGER */}
                  <div className="flex gap-2 pt-3 border-t border-orange-100">
                    <button
                      onClick={() => acceptInvitation(invitation._id)}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-green-600 hover:to-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Accept
                    </button>

                    <button
                      onClick={() => rejectInvitation(invitation._id)}
                      className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-red-600 hover:to-pink-700 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

      {/* Enhanced Chats List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-700 text-sm">Your Chats</h3>
          <span className="text-xs text-gray-500">
            {chats.filter(chat => chat.unread_count > 0).length} unread
          </span>
        </div>

        {initialLoad ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
            <p className="ml-2 text-gray-600">Loading chats...</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        ) : (isSearchingChats ? filteredChats : chats).length === 0 && searchResults.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1m6-8h.01M12 8h.01" />
            </svg>
            <p className="text-gray-500 text-sm">
              {isSearchingChats ? 'No chats found' : 'No chats yet. Start by inviting someone!'}
            </p>
            {!isSearchingChats && (
              <button
                onClick={() => setShowSearch(true)}
                className="mt-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2.5 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all text-sm cursor-pointer shadow-sm hover:shadow"
              >
                Invite a Friend
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {(isSearchingChats ? filteredChats : chats).map(chat => {
              const unreadCount = chat.unread_count || 0;
              const isSelected = selectedChat?.type === 'private' && selectedChat?._id === chat._id;
              const otherUserId = chat.other_user?._id;
              const statusInfo = getStatusInfo(otherUserId);
              const userStatus = getUserStatus(otherUserId);
              const isOnline = userStatus.isOnline;
              const isMuted = mutedChats.has(chat._id);
              const isTyping = typingUsers[chat._id]?.isTyping;
              const typingUserId = typingUsers[chat._id]?.userId;
              return (
                <div
                  key={chat._id}
                  onClick={() => handleChatClick(chat)}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 relative group ${isSelected
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 shadow-sm'
                    : unreadCount > 0
                      ? 'bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 hover:from-blue-100 hover:to-sky-100'
                      : 'border border-transparent hover:bg-gray-50'
                    }`}
                >
                  {/* Avatar and status indicator - LIKE GROUPMANAGER */}
                  <div className="relative flex-shrink-0">
                    <div className="relative">
                      <img
                        src={chat.other_user?.profile_image || '/default-avatar.png'}
                        alt={chat.other_user?.username}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                      {/* Online status indicator */}
                      {statusInfo && (
                        <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${statusInfo.dotColor} ${statusInfo.text === 'Online' && statusInfo.dotColor === 'bg-green-500' ? 'animate-pulse' : ''
                          }`}></div>
                      )}
                    </div>

                    {/* Unread badge - LIKE GROUPMANAGER */}
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}

                    {/* Muted indicator - LIKE GROUPMANAGER */}
                    {isMuted && (
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center border-2 border-white">
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Chat info - LIKE GROUPMANAGER */}
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-gray-900 truncate ${unreadCount > 0 ? 'font-semibold text-black' : ''}`}>
                          {chat.other_user?.username || 'Unknown User'}
                          {isMuted && (
                            <span className="ml-2 text-gray-400">
                              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              </svg>
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {chat.last_message_at && (
                          <span className={`text-xs whitespace-nowrap ${unreadCount > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                            {formatTime(chat.last_message_at)}
                          </span>
                        )}
                        {/* 3-dot menu button - LIKE GROUPMANAGER */}
                        <button
                          onClick={(e) => handleMenuToggle(chat._id, e)}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <>
                        {/* <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'text-black font-medium' : 'text-gray-600'}`}>
                        {chat.last_message || 'Start a conversation'}
                      </p> */}
                        {isTyping ? (
                          <div className="typing-indicator">
                            <span className="typing-dots">
                            </span>
                            <span className="typing-dots">
                            </span>
                            <span className="typing-dots">
                            </span>
                            Typing
                          </div>
                        ) : (
                          <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'text-black font-medium' : 'text-gray-600'}`}>
                            {getMessagePreview(chat)}
                          </p>
                        )}
                      </>
                    </div>
                  </div>

                  {/* Dropdown Menu - LIKE GROUPMANAGER */}
                  {menuOpen === chat._id && (
                    <div className="absolute right-0 top-10 z-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewProfile(chat);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        View Profile
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMute(chat._id);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        {isMuted ? (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            Unmute Notifications
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            Mute Notifications
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowClearConfirm(true);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove User
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadChats}
              className="mt-2 text-red-700 hover:text-red-900 text-sm font-medium cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Remove User Confirmation Modal - UPDATED */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.284 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">Remove User</h3>
                  <p className="text-sm text-gray-500">Are you sure you want to remove this user? This action cannot be undone.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRemoveConfirm(false);
                    setMenuOpen(null);
                    setSelectedChatForAction(null);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-all cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveUser}
                  className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white py-3 rounded-lg hover:from-red-600 hover:to-pink-700 transition-all cursor-pointer font-medium shadow-sm hover:shadow"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal - UPDATED */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-900">Clear Chat</h3>
                  <p className="text-sm text-gray-500">Are you sure you want to clear all messages? This action cannot be undone.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowClearConfirm(false);
                    setMenuOpen(null);
                    setSelectedChatForAction(null);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-all cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearChat}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 text-white py-3 rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all cursor-pointer font-medium shadow-sm hover:shadow"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            handleStartChatFromProfile(chatData);
          }}
        />
      )}
    </div>
  );
}