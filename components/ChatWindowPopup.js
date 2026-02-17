"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  chatAPI,
  groupAPI,
  callAPI,
  semanticSearchAPI,
  moderationAPI,
} from "../lib/api";
import { successToast, errorToast } from "./toast";
import { aiAPI } from "../lib/api";
import { ringtoneService } from "../lib/ringtone-service";

// Import chat window components
import MessageList from "./chatWindow/MessageList";
import MessageInput from "./chatWindow/MessageInput";
import DeleteDialog from "./chatWindow/DeleteDialog";
import ForwardDialog from "./chatWindow/ForwardDialog";
import ReplyPreview from "./chatWindow/ReplyPreview";
import SelectedFilesPreview from "./chatWindow/SelectedFilesPreview";
import VoiceRecorder from "./chatWindow/VoiceRecorder";
import RichTextEditor from "./chatWindow/RichTextEditor";
import ModerationWarning from "./chatWindow/ModerationWarning";
import SemanticSearchBar from "./chatWindow/SemanticSearchBar";
import VoiceCall from "./chatWindow/VoiceCall";
import VideoCall from "./chatWindow/VideoCall";
import GroupCall from "./chatWindow/GroupCall";
import UserProfileModal from "./UserProfileModal";
import GroupProfileModal from "./GroupProfileModal";

const ChatWindowPopup = ({
  chat,
  socket,
  isConnected,
  onClose,
  onOpenInMainWindow,
  position = { x: 50, y: 50 },
  currentUserId: propCurrentUserId,
  onResetChatCount,
  onResetGroupCount,
  zIndex = 1050,
  isPopup = true,
  onSelectChat,
}) => {
  const { userId } = useAuth();

  // All ChatWindow states
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(propCurrentUserId || null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Mention states
  const [groupMembers, setGroupMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");

  // Popup specific states
  const [popupPosition, setPopupPosition] = useState(position);
  const [popupSize] = useState({ width: 380, height: 500 }); // FIXED SIZE
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [currentZIndex, setCurrentZIndex] = useState(zIndex);

  // ChatWindow functionality states
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showStickerMenu, setShowStickerMenu] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteType, setDeleteType] = useState("");
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableChats, setAvailableChats] = useState([]);
  const [selectedForwardChat, setSelectedForwardChat] = useState(null);
  const [forwarding, setForwarding] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isSearchingMode, setIsSearchingMode] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [searchMode, setSearchMode] = useState("text");
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [richText, setRichText] = useState("");
  const [showModerationWarning, setShowModerationWarning] = useState(false);
  const [moderationWarningData, setModerationWarningData] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [showCodeSnippetMenu, setShowCodeSnippetMenu] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [snippetLanguage, setSnippetLanguage] = useState("javascript");
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [userStatus, setUserStatus] = useState({ isOnline: false });
  const [showConversationSummary, setShowConversationSummary] = useState(false);
  const [isLoadingAllForSearch, setIsLoadingAllForSearch] = useState(false);
  const [allMessagesForSearch, setAllMessagesForSearch] = useState([]);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(null);
  const [showGroupProfileModal, setShowGroupProfileModal] = useState(false);
  const [showGroupProfile, setShowGroupProfile] = useState(null);

  // Refs
  const popupRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const stickerMenuRef = useRef(null);
  const messageMenuClickOutsideRef = useRef(null);
  const processedMessageIds = useRef(new Set());
  const validatedChatRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef(null);
  const isLoadingMoreRef = useRef(false);
  const isLoadingRef = useRef(false);
  const loadMessagesAbortControllerRef = useRef(null);
  const searchCompletionRef = useRef(false);
  const chatIdRef = useRef(null);

  const throttle = (func, limit) => {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  };

  // ========== MENTION FUNCTIONS ==========

  // Load group members for mentions
  useEffect(() => {
    if (validatedChatRef.current?.type === "group" && !isLoadingMembers) {
      loadGroupMembers();
    }
  }, [validatedChatRef.current]);

  // Auto-clear typing on cleanup or chat change
  useEffect(() => {
    return () => {
      // Stop typing when component unmounts
      stopTyping();

      // Clear timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [validatedChatRef.current]);

  const loadGroupMembers = async () => {
    if (!validatedChatRef.current?._id) return;

    try {
      setIsLoadingMembers(true);
      const response = await groupAPI.getGroupMembersForMentions(
        validatedChatRef.current._id,
      );
      if (response.data.success) {
        // Add "@all" option to members list
        const members = response.data.members;
        const allOption = {
          id: "all",
          name: "@all",
          username: "all",
          first_name: "all",
          last_name: "",
          profile_image: null,
          is_all_mention: true,
        };

        setGroupMembers([allOption, ...members]);
      }
    } catch (error) {
      console.error("Error loading group members:", error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Search for mentions
  const searchMentions = async (query) => {
    if (!validatedChatRef.current?._id) return;

    try {
      // Always show @all as first option if query starts with "@a"
      if (query.toLowerCase().startsWith("@a")) {
        const allOption = {
          id: "all",
          name: "@all",
          username: "all",
          first_name: "all",
          last_name: "",
          profile_image: null,
          is_all_mention: true,
        };

        setMentionSuggestions([allOption]);
        return;
      }

      // If query is empty, show first 10 members with @all
      if (!query || query.trim() === "") {
        const filteredMembers = groupMembers
          .filter(
            (member) =>
              !mentionedUsers.some(
                (mentioned) =>
                  mentioned._id === member._id ||
                  (member.is_all_mention &&
                    mentionedUsers.some((u) => u.is_all_mention)),
              ),
          )
          .slice(0, 10);

        setMentionSuggestions(filteredMembers);
        return;
      }

      // Use local filtering including @all
      const localResults = groupMembers
        .filter((member) => {
          const fullName =
            `${member.first_name || ""} ${member.last_name || ""}`.toLowerCase();
          const username = member.username?.toLowerCase() || "";
          const searchTerm = query.toLowerCase();

          // Check if member is already mentioned
          const isAlreadyMentioned = mentionedUsers.some(
            (mentioned) =>
              mentioned._id === member._id ||
              (member.is_all_mention &&
                mentionedUsers.some((u) => u.is_all_mention)),
          );

          // Special handling for @all
          if (member.is_all_mention) {
            return (
              !isAlreadyMentioned &&
              ("@all".includes(searchTerm) || "all".includes(searchTerm))
            );
          }

          return (
            !isAlreadyMentioned &&
            (fullName.includes(searchTerm) ||
              username.includes(searchTerm) ||
              member.first_name?.toLowerCase().includes(searchTerm) ||
              member.last_name?.toLowerCase().includes(searchTerm))
          );
        })
        .slice(0, 10);

      if (localResults.length > 0) {
        setMentionSuggestions(localResults);
      } else {
        // Fallback to API search for regular members
        const response = await groupAPI.searchGroupMembers(
          validatedChatRef.current._id,
          query,
        );
        if (response.data.success) {
          const filteredMembers = response.data.members.filter(
            (member) =>
              !mentionedUsers.some((mentioned) => mentioned._id === member._id),
          );

          // Add @all option if relevant
          const allOption = {
            id: "all",
            name: "@all",
            username: "all",
            first_name: "all",
            last_name: "",
            profile_image: null,
            is_all_mention: true,
          };

          setMentionSuggestions([allOption, ...filteredMembers.slice(0, 9)]);
        }
      }
    } catch (error) {
      console.error("Error searching mentions:", error);
      setMentionSuggestions([]);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (user) => {
    if (!user) return;

    const lastAtIndex = newMessage.lastIndexOf("@");
    if (lastAtIndex === -1) return;

    // Get text before @
    const textBeforeAt = newMessage.substring(0, lastAtIndex);

    // Special handling for @all
    if (user.is_all_mention) {
      // Check if @all is already mentioned
      const isAllAlreadyMentioned = mentionedUsers.some(
        (u) => u.is_all_mention,
      );
      if (!isAllAlreadyMentioned) {
        // Add @all to mentioned users
        setMentionedUsers((prev) => [...prev, user]);

        // Remove any individual mentions when @all is selected
        setMentionedUsers((prev) => prev.filter((u) => u.is_all_mention));
      }
    } else {
      // Check if @all is already mentioned - if yes, remove it first
      const hasAllMention = mentionedUsers.some((u) => u.is_all_mention);
      if (hasAllMention) {
        setMentionedUsers((prev) => prev.filter((u) => !u.is_all_mention));
      }

      // Add individual user to mentioned users list if not already there
      if (!mentionedUsers.some((u) => u._id === user._id)) {
        setMentionedUsers((prev) => [...prev, user]);
      }
    }

    // We don't add @name to the message text anymore
    // Just keep the text before @
    setNewMessage(textBeforeAt.trim() + " ");

    // Close suggestions
    setShowMentionSuggestions(false);
    setMentionSuggestions([]);

    // Focus back on input
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) {
        input.focus();
        input.setSelectionRange(
          textBeforeAt.length + 1,
          textBeforeAt.length + 1,
        );
      }
    }, 10);
  };

  // Remove mentioned user
  const handleRemoveMention = (userId) => {
    setMentionedUsers((prev) => prev.filter((user) => user._id !== userId));

    // Also remove from message text
    const userToRemove = mentionedUsers.find((user) => user._id === userId);
    if (userToRemove) {
      const mentionRegex = new RegExp(`@${userToRemove.first_name}\\s?`, "g");
      const cleanedText = newMessage.replace(mentionRegex, "");
      setNewMessage(cleanedText);
    }
  };

  // Helper function to get cursor position
  const getCursorPosition = (inputElement) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return { left: 0, top: 0 };

    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(inputElement);
    range.setEnd(selection.focusNode, selection.focusOffset);

    const rect = range.getBoundingClientRect();
    return {
      left: rect.left - inputElement.getBoundingClientRect().left,
      top: rect.top - inputElement.getBoundingClientRect().top,
    };
  };

  // ========== END MENTION FUNCTIONS ==========

  const detectAndSetMessageLanguage = async (message) => {
    // Your language detection logic
    return { ...message, detectedLanguage: "auto" };
  };

  // Wrap loadOlderMessages in useCallback
  const loadOlderMessages = useCallback(async () => {
    // IMPORTANT: Don't load older messages if in search mode
    if (
      !validatedChatRef.current ||
      !hasMoreMessages ||
      isLoadingMoreRef.current ||
      isLoadingRef.current ||
      isSearchingMode
    ) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    // IMPORTANT: Set scrolling flag to true BEFORE loading
    isScrollingRef.current = true;

    try {
      const offset = page * 50;

      // Get current scroll position BEFORE loading
      const container = messagesContainerRef.current;
      const scrollTopBefore = container?.scrollTop || 0;
      const scrollHeightBefore = container?.scrollHeight || 0;

      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.getChatMessages(
          validatedChatRef.current._id,
          50,
          offset,
        );
      } else {
        response = await groupAPI.getGroupMessages(
          validatedChatRef.current._id,
          50,
          offset,
        );
      }

      const apiResponse = response.data;
      const olderMessages = apiResponse.messages || [];

      if (olderMessages.length === 0 || !apiResponse.pagination?.hasMore) {
        setHasMoreMessages(false);
        return;
      }

      // Process older messages
      const processedOlderMessages = await Promise.all(
        olderMessages.map(async (message) => {
          let transformedMessage = transformFileMessageForDisplay(message);

          if (
            transformedMessage.message_type === "text" &&
            transformedMessage.message &&
            transformedMessage.message?.trim().length > 0
          ) {
            try {
              transformedMessage =
                await detectAndSetMessageLanguage(transformedMessage);
            } catch (error) {
              console.error(
                "Language detection failed for older message:",
                message._id,
                error,
              );
              transformedMessage.detectedLanguage = "auto";
            }
          } else {
            transformedMessage.detectedLanguage = "auto";
          }

          return transformedMessage;
        }),
      );

      // Add unique IDs
      processedOlderMessages.forEach((msg) => {
        const messageId =
          msg._id ||
          (msg.message_type === "call"
            ? `call_${msg.call_id}`
            : `msg_${msg.created_at}_${msg.sender_id}_${msg.message?.substring(0, 10)}`);

        if (messageId) {
          processedMessageIds.current.add(`msg-${messageId}`);
        }
      });

      // Update messages - IMPORTANT: Prepend older messages at the beginning
      setMessages((prev) => [...processedOlderMessages, ...prev]);
      setPage((prev) => prev + 1);

      // RESTORE SCROLL POSITION - Keep user at the same visual position
      setTimeout(() => {
        if (container) {
          const scrollHeightAfter = container.scrollHeight;
          const scrollTopAfter =
            scrollTopBefore + (scrollHeightAfter - scrollHeightBefore);

          container.scrollTop = scrollTopAfter;

          // Reset scrolling flag after restoration
          setTimeout(() => {
            isScrollingRef.current = false;
          }, 100);
        }
      }, 100);
    } catch (error) {
      console.error(" Error loading older messages:", error);
      isScrollingRef.current = false;
    } finally {
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [
    validatedChatRef.current?._id,
    validatedChatRef.current?.type,
    hasMoreMessages,
    isLoadingMore,
    page,
    isSearchingMode,
  ]);

  //scroll event handler for infinite scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || isSearchingMode || isLoadingMore) return; // Skip if searching or loading

    // scroll handler logic
    const handleScroll = throttle(() => {
      const container = messagesContainerRef.current;
      if (!container || isSearchingMode || isLoadingMore) return;

      const { scrollTop, scrollHeight, clientHeight } = container;

      // Show/hide "Scroll to bottom" button
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollToBottom(!isNearBottom);

      // Clear any existing timer
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }

      // Set a timer to detect when scrolling stops
      scrollTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false;

        // Load older messages when near top and not already loading
        const scrollThreshold = 100; // Pixels from top
        if (
          scrollTop < scrollThreshold &&
          hasMoreMessages &&
          !isLoadingMore &&
          !isScrollingRef.current &&
          !isSearchingMode
        ) {
          isScrollingRef.current = true; // Set flag to prevent duplicate loads
          loadOlderMessages();
        }
      }, 200);
    }, 150);

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, [loadOlderMessages, hasMoreMessages, isLoadingMore, isSearchingMode]);

  // Popup-specific functions
  const bringToFront = () => {
    const newZIndex = Math.max(2000, (Date.now() % 10000) + 2000);
    setCurrentZIndex(newZIndex);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (!isMinimized) {
      bringToFront();
    }
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    bringToFront();

    if (isMaximized) {
      // Restore to original size and position
      setPopupPosition(position);
    } else {
      // Maximize to full viewport
      setPopupPosition({ x: 0, y: 0 });
    }
  };

  // Drag functionality
  const handleMouseDown = (e) => {
    if (e.target.closest(".no-drag")) return;
    if (isMaximized) return;

    bringToFront();
    setIsDragging(true);
    const rect = popupRef.current.getBoundingClientRect();
    const dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep within viewport bounds
      const maxX = window.innerWidth - popupRef.current.offsetWidth;
      const maxY = window.innerHeight - popupRef.current.offsetHeight;

      setPopupPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Update position when prop changes
  useEffect(() => {
    if (position && !isDragging && !isMaximized) {
      setPopupPosition(position);
    }
  }, [position.x, position.y, isDragging, isMaximized]);

  // Update user status
  useEffect(() => {
    if (chat) {
      setUserStatus({
        isOnline: chat.is_online || false,
        status: chat.status || "offline",
        lastSeen: chat.last_seen,
      });
    }
  }, [chat]);

  // Core chat functions
  useEffect(() => {
    if (chat && Object.keys(chat).length > 0) {
      validatedChatRef.current = chat;
      chatIdRef.current = chat._id;
    } else {
      validatedChatRef.current = null;
      chatIdRef.current = null;
    }
  }, [chat]);

  useEffect(() => {
    if (chat) {
      const storedUserId = localStorage.getItem("currentUserId");
      const userIdFromChat = chat.currentUserId || chat.userId;
      const finalUserId = userIdFromChat || storedUserId || userId;
      setCurrentUserId(finalUserId);

      if (!storedUserId && finalUserId) {
        localStorage.setItem("currentUserId", finalUserId.toString());
      }
    }
  }, [chat, userId]);

  const loadMessages = useCallback(async () => {
    if (!validatedChatRef.current || isLoadingRef.current) return;

    try {
      if (loadMessagesAbortControllerRef.current) {
        loadMessagesAbortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      loadMessagesAbortControllerRef.current = abortController;
      isLoadingRef.current = true;

      setLoading(true);
      setPage(0);
      setHasMoreMessages(true);
      setMessages([]);
      processedMessageIds.current.clear();

      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.getChatMessages(
          validatedChatRef.current._id,
          50,
          0,
          { signal: abortController.signal },
        );
      } else {
        response = await groupAPI.getGroupMessages(
          validatedChatRef.current._id,
          50,
          0,
          { signal: abortController.signal },
        );
      }

      const apiResponse = response.data;
      const newMessages = apiResponse.messages || [];

      if (!apiResponse.pagination?.hasMore || newMessages.length < 50) {
        setHasMoreMessages(false);
      }

      // Process messages
      const processedMessages = newMessages.map((message) =>
        transformFileMessageForDisplay(message),
      );
      const chronologicalMessages = [...processedMessages].reverse();
      setMessages(chronologicalMessages);
      setPage(1);

      setTimeout(() => {
        if (!isSearchingMode) {
          scrollToBottom(true);
        }
      }, 300);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Error loading messages:", error);
      errorToast("Failed to load messages", "error");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      loadMessagesAbortControllerRef.current = null;
    }
  }, [validatedChatRef.current, isSearchingMode]);

  // Initial load
  useEffect(() => {
    if (validatedChatRef.current) {
      loadMessages();
      processedMessageIds.current.clear();
    }
  }, [validatedChatRef.current]);

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!validatedChatRef.current || !currentUserId) return;

    try {
      const chatId = validatedChatRef.current._id;

      if (validatedChatRef.current.type === "private") {
        await chatAPI.markAsRead(chatId);
        if (socket) {
          socket.emit("messages_read", {
            chat_id: chatId,
            user_id: currentUserId,
          });
        }
        if (onResetChatCount) {
          onResetChatCount(chatId);
        }
      } else {
        await groupAPI.markGroupMessagesAsRead(chatId);
        if (socket) {
          socket.emit("group_messages_read", {
            group_id: chatId,
            user_id: currentUserId,
          });
        }
        if (onResetGroupCount) {
          onResetGroupCount(chatId);
        }
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  useEffect(() => {
    if (validatedChatRef.current && currentUserId && socket) {
      markMessagesAsRead();
    }
  }, [validatedChatRef.current, currentUserId]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !validatedChatRef.current) return;

    const handlePrivateMessage = (message) => {
      if (message.chat_id !== validatedChatRef.current?._id) return;

      const messageKey = `private-${message._id}-${message.chat_id}-${message.created_at}`;
      if (message._id && processedMessageIds.current.has(messageKey)) return;
      if (parseInt(message.sender_id) === parseInt(currentUserId)) return;

      processedMessageIds.current.add(messageKey);
      const transformedMessage = transformFileMessageForDisplay(message);
      handleNewMessage(transformedMessage);
    };

    const handleGroupMessage = (message) => {
      if (
        validatedChatRef.current?.type === "group" &&
        parseInt(validatedChatRef.current._id) === parseInt(message.group_id)
      ) {
        if (
          message.skip_self &&
          parseInt(message.sender_id) === parseInt(currentUserId)
        )
          return;
        if (
          message._id &&
          processedMessageIds.current.has(`msg-${message._id}`)
        )
          return;

        if (message._id) processedMessageIds.current.add(`msg-${message._id}`);

        const transformedMessage = transformFileMessageForDisplay(message);
        setMessages((prev) => {
          if (transformedMessage.sender_id === currentUserId) {
            const tempIndex = prev.findIndex(
              (msg) =>
                (!msg._id || msg._id.toString().startsWith("temp-")) &&
                msg.sender_id === currentUserId &&
                msg.message_type === transformedMessage.message_type &&
                Math.abs(
                  new Date(msg.created_at) -
                    new Date(transformedMessage.created_at),
                ) < 15000,
            );

            if (tempIndex !== -1) {
              const newMessages = [...prev];
              newMessages[tempIndex] = {
                ...transformedMessage,
                isSending: false,
                failed: false,
              };
              return newMessages;
            }
          }

          return [...prev, { ...transformedMessage }];
        });
      }
    };

    const handleTyping = (data) => {
      if (data.user_id !== currentUserId) {
        setIsTyping(data.is_typing);
        setTypingUser(data.user_id);

        if (data.is_typing) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            setTypingUser(null);
          }, 3000);
        }
      }
    };

    const handleMessageDeleted = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id
            ? {
                ...msg,
                is_deleted: false,
                deleted_for_everyone: true,
                message: "This message was deleted",
                message_type: "deleted",
                file_url: null,
                file_name: null,
              }
            : msg,
        ),
      );
    };

    const handleMessageEdited = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.message_id
            ? {
                ...msg,
                message: data.message,
                is_edited: true,
                edited_at: data.edited_at,
              }
            : msg,
        ),
      );
    };

    const handleGroupMessageEdited = (data) => {
      if (validatedChatRef.current._id === data.group_id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.message_id
              ? {
                  ...msg,
                  message: data.message,
                  is_edited: true,
                  edited_at: data.edited_at,
                }
              : msg,
          ),
        );
      }
    };

    // Call handlers
    const handleGroupCallInitiate = (data) => {
      if (
        validatedChatRef.current.type === "group" &&
        validatedChatRef.current._id === data.groupId
      ) {
        setIncomingCall(data);
      }
    };

    const handleVoiceCallInitiate = (data) => {
      if (
        validatedChatRef.current.type === "private" &&
        getReceiverId() === data.callerId
      ) {
        setIncomingCall(data);
      } else if (
        validatedChatRef.current.type === "group" &&
        data.groupId === validatedChatRef.current._id
      ) {
        setIncomingCall(data);
      }
    };

    const handleVideoCallInitiate = (data) => {
      if (
        validatedChatRef.current.type === "private" &&
        getReceiverId() === data.callerId
      ) {
        setIncomingCall(data);
      } else if (
        validatedChatRef.current.type === "group" &&
        data.groupId === validatedChatRef.current._id
      ) {
        setIncomingCall(data);
      }
    };

    const handleCallEnded = (data) => {
      if (activeCall && activeCall.callId === data.callId) {
        setActiveCall(null);
      }
      if (incomingCall && incomingCall.callId === data.callId) {
        setIncomingCall(null);
      }
    };

    const handleGroupCallEnded = (data) => {
      if (
        activeCall?.callId === data.callId ||
        incomingCall?.callId === data.callId
      ) {
        setActiveCall(null);
        setIncomingCall(null);
      }
    };

    // Typing handlers
    const handlePrivateTyping = (data) => {
      if (
        validatedChatRef.current?.type === "private" &&
        validatedChatRef.current._id === data.chat_id &&
        data.user_id !== currentUserId
      ) {
        setIsTyping(data.is_typing);
        setTypingUser(data.user_id);

        if (data.is_typing) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            setTypingUser(null);
          }, 3000);
        } else {
          setIsTyping(false);
          setTypingUser(null);
        }
      }
    };

    const handleGroupTyping = (data) => {
      console.log("🔔 ChatWindowPopup: Group typing event:", data);

      if (
        validatedChatRef.current?.type === "group" &&
        validatedChatRef.current._id === data.group_id &&
        data.user_id !== currentUserId
      ) {
        setIsTyping(data.is_typing);
        setTypingUser(data.user_id);

        if (data.is_typing) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            setTypingUser(null);
          }, 3000);
        } else {
          setIsTyping(false);
          setTypingUser(null);
        }
      }
    };

    socket.on("user_typing", handlePrivateTyping);
    socket.on("group_user_typing", handleGroupTyping);
    socket.on("typing", handleTyping);

    // Set up socket listeners
    socket.on("private_message", handlePrivateMessage);
    socket.on("group_message", handleGroupMessage);
    socket.on("user_typing", handleTyping);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("group_message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("group_message_edited", handleGroupMessageEdited);
    socket.on("group_voice_call_initiate", handleGroupCallInitiate);
    socket.on("group_video_call_initiate", handleGroupCallInitiate);
    socket.on("voice_call_initiate", handleVoiceCallInitiate);
    socket.on("video_call_initiate", handleVideoCallInitiate);
    socket.on("voice_call_ended", handleCallEnded);
    socket.on("video_call_ended", handleCallEnded);
    socket.on("group_voice_call_ended", handleGroupCallEnded);
    socket.on("group_video_call_ended", handleGroupCallEnded);

    // Join appropriate rooms
    if (validatedChatRef.current.type === "group") {
      socket.emit("join_groups", [validatedChatRef.current._id]);
    } else {
      socket.emit("join_private_chat", validatedChatRef.current._id);
    }

    return () => {
      socket.off("private_message", handlePrivateMessage);
      socket.off("group_message", handleGroupMessage);
      socket.off("user_typing", handleTyping);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("group_message_deleted", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
      socket.off("group_message_edited", handleGroupMessageEdited);
      socket.off("group_voice_call_initiate", handleGroupCallInitiate);
      socket.off("group_video_call_initiate", handleGroupCallInitiate);
      socket.off("voice_call_initiate", handleVoiceCallInitiate);
      socket.off("video_call_initiate", handleVideoCallInitiate);
      socket.off("voice_call_ended", handleCallEnded);
      socket.off("video_call_ended", handleCallEnded);
      socket.off("group_voice_call_ended", handleGroupCallEnded);
      socket.off("group_video_call_ended", handleGroupCallEnded);
      socket.off("user_typing", handlePrivateTyping);
      socket.off("group_user_typing", handleGroupTyping);
      socket.off("typing", handleTyping);

      if (validatedChatRef.current?.type === "group") {
        socket.emit("leave_groups", [validatedChatRef.current._id]);
      } else {
        socket.emit("leave_private_chat", validatedChatRef.current?._id);
      }
    };
  }, [
    socket,
    validatedChatRef.current,
    currentUserId,
    activeCall,
    incomingCall,
  ]);

  // ========== UPDATED INPUT HANDLER WITH MENTIONS ==========
  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    // Check for @ mention
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
            !mentionedUsers.some((mentioned) => mentioned._id === member._id),
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

    // TYPING INDICATOR - FIXED VERSION
    if (socket && validatedChatRef.current && currentUserId) {
      const receiverId = getReceiverId();

      if (value.trim().length > 0) {
        // User started typing
        console.log(
          "✍️ User started typing in chat:",
          validatedChatRef.current._id,
        );

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

  // Keyboard navigation for mention suggestions
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showMentionSuggestions) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev < mentionSuggestions.length - 1 ? prev + 1 : 0,
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev > 0 ? prev - 1 : mentionSuggestions.length - 1,
          );
          break;

        case "Enter":
          e.preventDefault();
          if (mentionSuggestions.length > 0 && selectedMentionIndex >= 0) {
            handleMentionSelect(mentionSuggestions[selectedMentionIndex]);
          }
          break;

        case "Escape":
          e.preventDefault();
          setShowMentionSuggestions(false);
          break;

        case "Tab":
          if (mentionSuggestions.length > 0) {
            e.preventDefault();
            handleMentionSelect(mentionSuggestions[selectedMentionIndex]);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMentionSuggestions, mentionSuggestions, selectedMentionIndex]);

  // ========== UPDATED SEND TEXT MESSAGE WITH MENTIONS ==========
  const sendTextMessage = async (messageText) => {
    if (!currentUserId || !validatedChatRef.current) return;

    setSending(true);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Extract mentions from mentionedUsers state
    const mentionIds = mentionedUsers.map((user) => user._id);
    const mentionData = mentionedUsers.map((user) => ({
      id: user._id,
      name: `${user.first_name} ${user.username || ""}`.trim(),
      username: user.username || user.first_name,
      profile_image: user.profile_image,
    }));

    // IMPORTANT: Clean the message text - remove the @ mentions since they're stored separately
    let cleanedMessage = messageText;
    mentionedUsers.forEach((user) => {
      // Remove @username from message text
      const mentionPattern = new RegExp(`@${user.username}\\s?`, "g");
      cleanedMessage = cleanedMessage.replace(mentionPattern, "");
    });

    // Trim extra spaces
    cleanedMessage = cleanedMessage.trim();

    const tempMessage = {
      tempId: tempId,
      message: cleanedMessage, // Use cleaned message WITHOUT @ mentions
      sender_id: currentUserId,
      message_type: "text",
      created_at: new Date().toISOString(),
      // isSending: true,
      sender_id: {
        _id: currentUserId,
        first_name: "You",
        last_name: "",
      },
      reply_to: replyToMessage
        ? {
            id: replyToMessage._id,
            message: replyToMessage.message,
            message_type: replyToMessage.message_type,
            sender_id: replyToMessage.sender_id,
            sender: replyToMessage.sender,
          }
        : null,
      mentions: mentionIds,
      mention_data: mentionData,
    };

    if (validatedChatRef.current.type === "private") {
      setMessages((prev) => [...prev, tempMessage]);
    }
    // Add temp message immediately
    setNewMessage("");
    const currentReplyToMessage = replyToMessage;
    setReplyToMessage(null);
    setMentionedUsers([]); // Clear mentioned users after sending
    setShowMentionSuggestions(false);
    stopTyping();

    try {
      let response;

      if (validatedChatRef.current.type === "private") {
        // Private chat - send via API
        response = await chatAPI.sendMessage(validatedChatRef.current._id, {
          message: cleanedMessage,
          message_type: "text",
          reply_to_message_id: currentReplyToMessage?._id,
        });

        const realMessage = {
          ...response.data,
          tempId: undefined,
          reply_to: currentReplyToMessage
            ? {
                id: currentReplyToMessage._id,
                message: currentReplyToMessage.message,
                message_type: currentReplyToMessage.message_type,
                sender_id: currentReplyToMessage.sender_id,
                sender: currentReplyToMessage.sender,
              }
            : null,
        };

        // Replace temp with real message
        setMessages((prev) =>
          prev.map((msg) => (msg.tempId === tempId ? realMessage : msg)),
        );
      } else {
        // GROUP CHAT with mentions
        response = await groupAPI.sendGroupMessage(
          validatedChatRef.current._id,
          {
            message: cleanedMessage,
            message_type: "text",
            reply_to_message_id: currentReplyToMessage?._id,
            mentions: mentionIds,
            mention_data: mentionData,
          },
        );
      }
    } catch (error) {
      console.error(" Error sending message:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId
            ? { ...msg, isSending: false, failed: true }
            : msg,
        ),
      );
      errorToast("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  // Call functions
  const startVoiceCall = async () => {
    console.log(
      "Starting voice call...",
      validatedChatRef.current,
      socket,
      isConnected,
    );

    if (!validatedChatRef.current || !socket || !isConnected) {
      errorToast("Cannot start call. Please check your connection.", "error");
      return;
    }

    try {
      const chatType = validatedChatRef.current.type;
      ringtoneService.play("outgoing");

      if (chatType === "private") {
        const receiverId = getReceiverId();
        if (!receiverId) {
          errorToast("Cannot start call. User not found.", "error");
          return;
        }

        const response = await callAPI.initiateCall({
          targetUserId: receiverId,
          call_type: "voice",
          chat_id: validatedChatRef.current._id,
        });

        if (response.data.success) {
          setActiveCall(response.data.callData);
        }
      } else if (chatType === "group") {
        const response = await callAPI.initiateGroupCall({
          group_id: validatedChatRef.current._id,
          call_type: "voice",
          chat_id: validatedChatRef.current._id,
        });

        if (response.data.success) {
          const serverCallData = response.data.callData;
          setActiveCall(serverCallData);

          socket.emit("group_voice_call_initiate", {
            callId: serverCallData.callId,
            groupId: serverCallData.groupId,
            callerId: serverCallData.callerId,
            callerName: serverCallData.callerName,
            groupName: serverCallData.groupName,
            type: serverCallData.type,
            chatType: "group",
          });
        }
      }
    } catch (error) {
      console.error("Error starting call:", error);
      errorToast("Failed to start call", "error");
      setActiveCall(null);
      ringtoneService.stop();
    }
  };

  const startVideoCall = async () => {
    if (!validatedChatRef.current || !socket || !isConnected) {
      errorToast("Cannot start call. Please check your connection.", "error");
      return;
    }

    try {
      const chatType = validatedChatRef.current.type;
      ringtoneService.play("outgoing");

      if (chatType === "private") {
        const receiverId = getReceiverId();
        if (!receiverId) {
          errorToast("Cannot start call. User not found.", "error");
          return;
        }

        const response = await callAPI.initiateCall({
          targetUserId: receiverId,
          call_type: "video",
          chat_id: validatedChatRef.current._id,
        });

        if (response.data.success) {
          setActiveCall(response.data.callData);
        }
      } else if (chatType === "group") {
        const response = await callAPI.initiateGroupCall({
          group_id: validatedChatRef.current._id,
          call_type: "video",
          chat_id: validatedChatRef.current._id,
        });

        if (response.data.success) {
          const serverCallData = response.data.callData;
          setActiveCall(serverCallData);

          socket.emit("group_video_call_initiate", {
            callId: serverCallData.callId,
            groupId: serverCallData.groupId,
            callerId: serverCallData.callerId,
            callerName: serverCallData.callerName,
            groupName: serverCallData.groupName,
            type: serverCallData.type,
            chatType: "group",
          });
        }
      }
    } catch (error) {
      console.error("Error starting call:", error);
      errorToast("Failed to start call", "error");
      setActiveCall(null);
      ringtoneService.stop();
    }
  };

  const endCall = async () => {
    try {
      ringtoneService.stop();

      if (activeCall) {
        await callAPI.endCall(activeCall.callId, {
          chat_id: validatedChatRef.current._id,
        });
        setActiveCall(null);
      }

      if (incomingCall) {
        await callAPI.rejectCall(incomingCall.callId, {
          chat_id: validatedChatRef.current._id,
        });
        setIncomingCall(null);
      }

      ringtoneService.stop();
    } catch (error) {
      console.error("Error ending call:", error);
      setActiveCall(null);
      setIncomingCall(null);
      ringtoneService.stop();
    }
  };

  const acceptCall = async () => {
    if (incomingCall) {
      try {
        ringtoneService.stop();
        const response = await callAPI.acceptCall(incomingCall.callId, {
          chat_id: validatedChatRef.current._id,
        });

        if (response.data.success) {
          setActiveCall(incomingCall);
          setIncomingCall(null);
          ringtoneService.stop();
        }
      } catch (error) {
        console.error("Error accepting call:", error);
        errorToast("Failed to accept call", "error");
        setIncomingCall(null);
        ringtoneService.stop();
      }
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      try {
        callAPI
          .rejectCall(incomingCall.callId, {
            chat_id: validatedChatRef.current._id,
          })
          .catch(console.error);
        setIncomingCall(null);
        ringtoneService.stop();
      } catch (error) {
        console.error("Error rejecting call:", error);
        setIncomingCall(null);
        ringtoneService.stop();
      }
    }
  };

  const getReceiverId = () => {
    if (
      !validatedChatRef.current ||
      validatedChatRef.current.type !== "private"
    )
      return null;

    const possibleIds = [
      validatedChatRef.current.other_user_id,
      validatedChatRef.current.other_user?._id,
      validatedChatRef.current.receiver_id,
      validatedChatRef.current.receiverId,
      validatedChatRef.current.participant_id,
      validatedChatRef.current.participant?._id,
    ];

    const receiverId = possibleIds.find(
      (id) => id !== undefined && id !== null && id !== "",
    );
    return receiverId ? parseInt(receiverId) : null;
  };

  const handleNewMessage = (message) => {
    setMessages((prev) => [...prev, message]);
    setTimeout(() => scrollToBottom(), 100);
  };

  // Message transformation functions
  const transformFileMessageForDisplay = (message) => {
    if (message._transformed) return message;

    const messageType = message.message_type || "text";
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    if (["image", "video", "file", "audio"].includes(messageType)) {
      let finalFileUrl = null;

      if (message.file_url && message.file_url.startsWith("http")) {
        finalFileUrl = message.file_url;
      } else if (message.file_path) {
        finalFileUrl = `${baseUrl}/uploads/chat_files/${message.file_path.replace(/^uploads[\\/]/, "")}`;
      } else if (message.file_name || message.filename) {
        const filename = message.file_name || message.filename;
        finalFileUrl = `${baseUrl}/uploads/chat_files/${filename}`;
      }

      return {
        ...message,
        _id: message._id || message.message_id,
        message_type: messageType,
        file_url: finalFileUrl,
        message:
          message.message ||
          (messageType === "image"
            ? "🖼 Image"
            : messageType === "video"
              ? "🎥 Video"
              : messageType === "audio"
                ? "🎤 Voice Message"
                : "📎 File"),
        _transformed: true,
        timestamp:
          message.timestamp || message.created_at || new Date().toISOString(),
      };
    }

    return {
      ...message,
      id: message._id || message.message_id,
      message_type: messageType,
      _transformed: true,
      timestamp:
        message.timestamp || message.created_at || new Date().toISOString(),
    };
  };

  // Message sending
  const sendMessage = async (e) => {
    e.preventDefault();

    if (!isConnected || !validatedChatRef.current) return;

    // Check if we have files to send
    if (selectedFiles.length > 0) {
      // Send files with caption (newMessage)
      await sendFileMessages(selectedFiles, newMessage.trim());
    } else if (newMessage?.trim()) {
      // Send text message with mentions
      await sendTextMessage(newMessage?.trim());
    }
  };

  const sendFileMessages = async (files, caption = "") => {
    if (!currentUserId || !validatedChatRef.current) return;

    setUploading(true);

    const tempMessages = files.map((file) => {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Prepare mention data for temp message
      const mentionIds = mentionedUsers.map((user) => user._id);
      const mentionData = mentionedUsers.map((user) => ({
        id: user._id,
        name: user.is_all_mention
          ? "@all"
          : `${user.first_name} ${user.last_name || ""}`.trim(),
        username: user.username || user.first_name,
        profile_image: user.profile_image,
        is_all_mention: user.is_all_mention || false,
      }));

      return {
        tempId: tempId,
        message:
          caption ||
          getFileMessageText({
            message_type: getFileMessageType(file),
            file_name: file.name,
          }),
        sender_id: currentUserId,
        message_type: getFileMessageType(file),
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
        file_url: URL.createObjectURL(file),
        created_at: new Date().toISOString(),
        isSending: true,
        sender: {
          id: currentUserId,
          first_name: "You",
          last_name: "",
        },
        reply_to: replyToMessage,
        mentions: mentionIds,
        mention_data: mentionData,
        caption: caption, // Store caption separately
      };
    });

    if (validatedChatRef.current.type === "private") {
      setMessages((prev) => [...prev, ...tempMessages]);
    }
    setReplyToMessage(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempMessage = tempMessages[i];

        const formData = new FormData();
        formData.append("file", file);
        formData.append("message_type", getFileMessageType(file));
        formData.append("message", tempMessage.message); // Send caption

        if (replyToMessage?._id) {
          formData.append("reply_to_message_id", replyToMessage._id);
        }

        // Add mentions to form data
        if (tempMessage.mentions && tempMessage.mentions.length > 0) {
          formData.append("mentions", JSON.stringify(tempMessage.mentions));
          formData.append(
            "mention_data",
            JSON.stringify(tempMessage.mention_data),
          );
        }

        let response;
        if (validatedChatRef.current.type === "private") {
          // For private chats, send via chatAPI
          formData.append("chat_id", validatedChatRef.current._id);
          response = await chatAPI.sendFileMessage(
            validatedChatRef.current._id,
            formData,
          );
        } else {
          // For group chats, send via groupAPI
          response = await groupAPI.sendGroupFileMessage(
            validatedChatRef.current._id,
            formData,
          );
        }

        const transformedMessage = transformFileMessageForDisplay(
          response.data,
        );

        // Add mention data to transformed message
        transformedMessage.mentions = tempMessage.mentions;
        transformedMessage.mention_data = tempMessage.mention_data;
        transformedMessage.caption = tempMessage.caption;

        // Update messages
        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === tempMessage.tempId
              ? { ...transformedMessage, tempId: undefined }
              : msg,
          ),
        );
      }

      // Clear mentioned users after sending
      setMentionedUsers([]);
      setSelectedFiles([]);
      setNewMessage(""); // Clear any caption text
      successToast("File sent with mentions", "success");
    } catch (error) {
      console.error(" Error sending file messages:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          tempMessages.some((temp) => temp.tempId === msg.tempId)
            ? { ...msg, isSending: false, failed: true }
            : msg,
        ),
      );
      errorToast("Failed to send files", "error");
    } finally {
      setUploading(false);
    }
  };

  const getFileMessageType = (file) => {
    if (!file || !file.type) return "file";
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    return "file";
  };

  const getFileMessageText = (message) => {
    if (!message) return "";
    switch (message.message_type) {
      case "image":
        return message.file_name ? `🖼 ${message.file_name}` : "🖼 Image";
      case "video":
        return message.file_name ? `🎥 ${message.file_name}` : "🎥 Video";
      case "file":
        return message.file_name ? `📎 ${message.file_name}` : "📎 File";
      default:
        return message.message || "";
    }
  };

  // Typing handlers
  const stopTyping = () => {
    console.log("🛑 Calling stopTyping function");

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

  // File handling
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const oversizedFiles = files.filter((file) => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      errorToast("Files must be smaller than 10MB", "error");
      return;
    }

    const filesToAdd = files.slice(0, 10);
    setSelectedFiles((prev) => [...prev, ...filesToAdd]);
    setShowAttachmentMenu(false);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Message actions
  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditText(message.message);
    closeMessageMenu();
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText("");
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.editMessage(editingMessage._id, {
          message: editText.trim(),
        });
      } else {
        response = await groupAPI.editGroupMessage(editingMessage._id, {
          message: editText.trim(),
        });
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === editingMessage._id
            ? {
                ...msg,
                message: editText.trim(),
                is_edited: true,
                updated_at: new Date().toISOString(),
              }
            : msg,
        ),
      );

      setEditingMessage(null);
      setEditText("");
      successToast("Message edited", "success");
    } catch (error) {
      console.error("Error editing message:", error);
      errorToast("Failed to edit message", "error");
    }
  };

  const handleDeleteConfirmation = (message, deleteType) => {
    setSelectedMessage(message);
    setDeleteType(deleteType);
    setShowDeleteDialog(true);
  };

  const handleDeleteMessage = async (message, deleteType) => {
    try {
      setShowDeleteDialog(false);

      let response;
      if (validatedChatRef.current.type === "group") {
        if (deleteType === "for-me") {
          response = await groupAPI.deleteGroupMessageForMe(message._id);
          setMessages((prev) => prev.filter((msg) => msg._id !== message._id));
        } else {
          response = await groupAPI.deleteGroupMessageForEveryone(message._id);
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === message._id
                ? {
                    ...msg,
                    is_deleted: false,
                    deleted_for_everyone: true,
                    message: "Message deleted",
                    message_type: "deleted",
                  }
                : msg,
            ),
          );
        }
      } else {
        if (deleteType === "for-me") {
          response = await chatAPI.deleteMessageForMe(message._id);
          setMessages((prev) => prev.filter((msg) => msg._id !== message._id));
        } else {
          response = await chatAPI.deleteMessageForEveryone(message._id);
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === message._id
                ? {
                    ...msg,
                    is_deleted: false,
                    deleted_for_everyone: true,
                    message: "Message deleted",
                    message_type: "deleted",
                  }
                : msg,
            ),
          );
        }
      }

      successToast(
        deleteType === "for-everyone"
          ? "Deleted for everyone"
          : "Deleted for you",
        "success",
      );
    } catch (error) {
      console.error("Delete error:", error);
      errorToast("Failed to delete", "error");
    } finally {
      setSelectedMessage(null);
      setDeleteType("");
    }
  };

  const handleReplyToMessage = (message) => {
    setReplyToMessage(message);
    closeMessageMenu();
  };

  const handleCancelReply = () => setReplyToMessage(null);

  // Search functionality
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      setHighlightedMessageId(null);
      setIsSearchingMode(false);
      return;
    }
    setIsSearchingMode(true);
    // Filter messages locally for demo
    const results = messages.filter((msg) =>
      msg.message?.toLowerCase().includes(query.toLowerCase()),
    );
    setSearchResults(results);
  };

  const handleClearSearch = () => {
    // Clear all search-related states
    setSearchQuery("");
    setSearchResults([]);
    setCurrentSearchIndex(-1);
    setHighlightedMessageId(null);
    setShowSearch(false);
    setIsSearchingMode(false); // CRITICAL: Reset search mode

    // Reset search completion ref
    searchCompletionRef.current = false;

    // Reset any search-related flags
    setIsLoadingAllForSearch(false);

    // Reset to show all messages (triggers re-render)
    setMessages((prev) => [...prev]); // Force re-render

    // Scroll to bottom after clearing search
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  const handleNextSearchResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    const message = searchResults[nextIndex];
    setHighlightedMessageId(message._id);
    scrollToMessage(message._id);
  };

  const handlePrevSearchResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex =
      (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    const message = searchResults[prevIndex];
    setHighlightedMessageId(message._id);
    scrollToMessage(message._id);
  };

  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element)
      element.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToBottom = (instant = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (instant) {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  };

  const handleDownload = (fileUrl, fileName) => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Message menu
  const closeMessageMenu = () => {
    setShowMessageMenu(null);
    setSelectedMessage(null);

    if (messageMenuClickOutsideRef.current) {
      document.removeEventListener("click", messageMenuClickOutsideRef.current);
      messageMenuClickOutsideRef.current = null;
    }
  };

  const handleMessageMenu = (message, event) => {
    event.preventDefault();
    event.stopPropagation();

    if (showMessageMenu === message._id) {
      closeMessageMenu();
      return;
    }

    setSelectedMessage(message);
    setShowMessageMenu(message._id);

    setTimeout(() => {
      const handleClickOutside = (e) => {
        const isEditUI = e.target.closest(".edit-message-ui");
        const isMessageMenu = e.target.closest(".message-menu-container");
        const isMenuButton = e.target.closest(".message-menu-button");

        if (!isEditUI && !isMessageMenu && !isMenuButton) {
          closeMessageMenu();
        }
      };

      document.addEventListener("click", handleClickOutside);
      messageMenuClickOutsideRef.current = handleClickOutside;
    }, 10);
  };

  const renderMessageMenu = (message, position) => {
    if (showMessageMenu !== message._id) return null;

    const isOwnMessage =
      message.is_own_message || message.sender_id._id == currentUserId;
    const isTextMessage = message.message_type === "text";
    const isDeletedMessage =
      message.is_deleted || message.message_type === "deleted";

    return (
      <div
        className="fixed bg-white shadow-2xl rounded-lg border border-gray-200 z-[99999] min-w-48 overflow-hidden"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-1">
          {isTextMessage && !isDeletedMessage && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(message.message);
                closeMessageMenu();
                successToast("Message copied to clipboard", "success");
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors cursor-pointer"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy text
            </button>
          )}

          {isOwnMessage && isTextMessage && !isDeletedMessage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditMessage(message);
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors cursor-pointer"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
          )}

          {!isDeletedMessage && (
            <button
              onClick={() => handleReplyToMessage(message)}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors cursor-pointer"
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
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              Reply
            </button>
          )}

          {!isDeletedMessage && (
            <button
              onClick={() => {}}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors cursor-pointer"
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
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              Forward
            </button>
          )}

          {isOwnMessage && !isDeletedMessage && (
            <>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={() => handleDeleteConfirmation(message, "for-me")}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors cursor-pointer"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete for Me
              </button>
              <button
                onClick={() =>
                  handleDeleteConfirmation(message, "for-everyone")
                }
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors cursor-pointer"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete for Everyone
              </button>
            </>
          )}

          {!isOwnMessage && !isDeletedMessage && (
            <>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={() => handleDeleteConfirmation(message, "for-me")}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors cursor-pointer"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete for Me
              </button>
            </>
          )}

          {(message.message_type === "file" ||
            message.message_type === "image" ||
            message.message_type === "video") &&
            message.file_url && (
              <button
                onClick={() =>
                  handleDownload(
                    message.file_url,
                    message.file_name || "download",
                  )
                }
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors cursor-pointer"
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download
              </button>
            )}
        </div>
      </div>
    );
  };

  const handleRichTextSend = async (
    richTextContent,
    messageType = "rich_text",
  ) => {
    if (!richTextContent?.trim() || !validatedChatRef.current) return;

    setSending(true);

    // ✅ CREATE A TEMP MESSAGE FOR IMMEDIATE FEEDBACK
    const tempId = `rich_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tempMessage = {
      tempId: tempId,
      message: richTextContent,
      sender_id: currentUserId,
      message_type: "rich_text",
      created_at: new Date().toISOString(),
      isSending: true,
      sender: {
        _id: currentUserId,
        first_name: "You",
        last_name: "",
      },
    };

    // ✅ ADD TEMP MESSAGE TO UI IMMEDIATELY
    if (validatedChatRef.current.type === "private") {
      // setMessages((prev) => [...prev, tempMessage]);
      setMessages((prev) => [...prev, tempMessage]);
    }

    try {
      const messageData = {
        message: richTextContent,
        message_type: messageType,
      };

      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.sendMessage(
          validatedChatRef.current._id,
          messageData,
        );
      } else {
        response = await groupAPI.sendGroupMessage(
          validatedChatRef.current._id,
          messageData,
        );
      }

      // Transform the response
      const transformedMessage = transformFileMessageForDisplay({
        ...response.data,
        message_type: "rich_text",
      });

      // ✅ REPLACE TEMP MESSAGE WITH REAL MESSAGE
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId
            ? { ...transformedMessage, isSending: false }
            : msg,
        ),
      );

      setShowTextEditor(false);
      setRichText("");

      successToast("Message sent", "success");
    } catch (error) {
      console.error("Error sending rich text message:", error);

      // ✅ MARK TEMP MESSAGE AS FAILED
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId
            ? { ...msg, isSending: false, failed: true }
            : msg,
        ),
      );

      errorToast("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };
  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Recording error:", error);
      errorToast("Failed to access microphone", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    setShowVoiceRecorder(false);
    if (isRecording) {
      stopRecording();
    }
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const sendVoiceMessage = async (audioBlob, duration) => {
    if (!audioBlob || !validatedChatRef.current || !currentUserId) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, `voice_${Date.now()}.webm`);
      formData.append("message_type", "audio");
      formData.append("duration", duration.toString());

      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.sendFileMessage(
          validatedChatRef.current._id,
          formData,
        );
      } else {
        response = await groupAPI.sendGroupFileMessage(
          validatedChatRef.current._id,
          formData,
        );
      }

      const transformedMessage = transformFileMessageForDisplay(response.data);
      if (validatedChatRef.current.type === "private") {
        // setMessages((prev) => [...prev, tempMessage]);
        setMessages((prev) => [...prev, transformedMessage]);
      }

      setShowVoiceRecorder(false);
      setAudioBlob(null);
      setRecordingTime(0);

      successToast("Voice message sent", "success");
    } catch (error) {
      console.error("Voice message error:", error);
      errorToast("Failed to send voice message", "error");
    } finally {
      setUploading(false);
    }
  };

  // Stickers
  const stickers = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😉",
    "😌",
    "😍",
    "🥰",
  ];

  const addStickerToMessage = (sticker) => {
    setNewMessage((prev) => prev + sticker);
    setShowStickerMenu(false);
  };

  // Code snippet
  const sendCodeSnippet = async () => {
    if (!codeSnippet.trim()) {
      errorToast("Please enter code", "error");
      return;
    }

    setSending(true);
    const tempId = `code_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tempMessage = {
      tempId,
      message: JSON.stringify({
        content: codeSnippet.trim(),
        language: snippetLanguage,
        timestamp: Date.now(),
      }),
      message_type: "code",
      sender_id: currentUserId,
      sender: { id: currentUserId, first_name: "You", last_name: "" },
      created_at: new Date().toISOString(),
      isSending: true,
    };
    if (validatedChatRef.current.type === "private") {
      setMessages((prev) => [...prev, tempMessage]);
    }

    try {
      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.sendMessage(validatedChatRef.current._id, {
          message: JSON.stringify({
            content: codeSnippet.trim(),
            language: snippetLanguage,
          }),
          message_type: "code",
        });
      } else {
        response = await groupAPI.sendGroupMessage(
          validatedChatRef.current._id,
          {
            message: JSON.stringify({
              content: codeSnippet.trim(),
              language: snippetLanguage,
            }),
            message_type: "code",
          },
        );
      }

      setMessages((prev) =>
        prev.map((msg) => (msg.tempId === tempId ? response.data : msg)),
      );

      setShowCodeSnippetMenu(false);
      setCodeSnippet("");
      setSnippetLanguage("javascript");
      successToast("Code sent", "success");
    } catch (error) {
      console.error("Code error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId
            ? { ...msg, isSending: false, failed: true }
            : msg,
        ),
      );
      errorToast("Failed to send code", "error");
    } finally {
      setSending(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
      ringtoneService.stop();
    };
  }, []);

  // Update handleSearchComplete to handle cancellation:
  const handleSearchComplete = (searchResults, allLoadedMessages) => {
    // Mark search as completed
    searchCompletionRef.current = true;

    setSearchResults(searchResults);
    setAllMessagesForSearch(allLoadedMessages);
    setCurrentSearchIndex(-1);
    setIsLoadingAllForSearch(false);

    if (searchResults.length > 0) {
      handleNextSearchResult();
    } else {
      errorToast(`No messages found for "${searchQuery}"`, "info");
    }
  };

  if (!chat) return null;

  // Calculate popup dimensions based on state
  const popupWidth = isMaximized ? "100vw" : `${popupSize.width}px`;
  const popupHeight = isMaximized
    ? "100vh"
    : isMinimized
      ? "60px"
      : `${popupSize.height}px`;

  const chatName = chat?.name || chat?.display_name || "Unknown Chat";

  return (
    <div
      ref={popupRef}
      data-popup-window="true"
      className="fixed bg-white rounded-lg shadow-xl border border-gray-300 overflow-hidden flex flex-col"
      style={{
        left: `${popupPosition.x}px`,
        top: `${popupPosition.y}px`,
        width: popupWidth,
        height: popupHeight,
        minWidth: isMaximized ? "100vw" : "380px",
        maxWidth: isMaximized ? "100vw" : "380px",
        minHeight: isMaximized ? "100vh" : isMinimized ? "60px" : "500px",
        maxHeight: isMaximized ? "100vh" : "600px",
        zIndex: currentZIndex,
        transition: isDragging || isMaximized ? "none" : "all 0.2s ease-in-out",
        pointerEvents: "auto",
      }}
      onClick={bringToFront}
    >
      {/* Header - Draggable area */}
      <div
        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 cursor-move select-none border-b border-blue-800 flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="relative">
            <div
              className={`w-10 h-10 ${chat?.type === "group" ? "bg-gradient-to-br from-green-500 to-blue-600" : "bg-gradient-to-br from-blue-500 to-purple-600"} rounded-full flex items-center justify-center text-white font-semibold`}
            >
              {chatName.charAt(0).toUpperCase()}
            </div>
            {chat?.type === "private" && userStatus.isOnline && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            )}
            {chat?.type === "group" && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
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

          {/* Chat info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{chatName}</h3>
              {chat.type === "group" && (
                <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  Group
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-100">
              {isTyping ? (
                <span className="flex items-center gap-1 animate-pulse">
                  Typing...
                </span>
              ) : chat.type === "private" && userStatus.isOnline ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
                  Online
                </span>
              ) : (
                <span>
                  {chat.type === "private"
                    ? "Offline"
                    : `${chat.member_count || 0} members`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-1 ml-2 no-drag">
          <button
            onClick={() => {
              // For private chats: open user profile
              if (chat.type === "private") {
                setShowUserProfile({
                  userId: chat.other_user?._id || chat.receiverId,
                  chatData: chat,
                });
                setShowUserProfileModal(true);
              } else {
                // For group chats: open group profile
                setShowGroupProfile({
                  id: chat._id,
                  name: chat.name,
                  description: chat.description,
                  member_count: chat.member_count,
                });
                setShowGroupProfileModal(true);
              }
            }}
            className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
            title={chat.type === "private" ? "View Profile" : "Group Info"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {chat.type === "private" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
          </button>

          {/* Call buttons */}
          <button
            onClick={startVoiceCall}
            className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
            title="Voice call"
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
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </button>

          <button
            onClick={startVideoCall}
            className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
            title="Video call"
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
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>

          {/* Search */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
            title="Search"
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>

          {/* Maximize/Restore */}
          <button
            onClick={toggleMaximize}
            className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMaximized ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
                />
              )}
            </svg>
          </button>

          {/* Minimize */}
          <button
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
            title={isMinimized ? "Restore" : "Minimize"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMinimized ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              )}
            </svg>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-500/30 rounded transition-colors cursor-pointer"
            title="Close"
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
        </div>
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
            key={`video-call-${activeCall.callId}`}
            socket={socket}
            onEndCall={endCall}
            isGroupCall={chat?.type === "group"}
          />
        ))}

      {incomingCall &&
        !activeCall &&
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
            key={`video-call-${incomingCall.callId}`}
            socket={socket}
            onEndCall={endCall}
            onAcceptCall={acceptCall}
            onRejectCall={rejectCall}
            isIncoming={true}
            isGroupCall={chat?.type === "group"}
          />
        ))}

      {/* Conversation Summary */}
      {showConversationSummary && (
        <div className="bg-blue-50 border-b border-blue-200 p-3">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-blue-800">
              Conversation Summary
            </h4>
            <button
              onClick={() => setShowConversationSummary(false)}
              className="text-blue-600 hover:text-blue-800 cursor-pointer"
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
          </div>
          <div className="text-xs text-blue-700">
            <p>Total messages: {messages.length}</p>
            <p>
              Last active:{" "}
              {messages.length > 0
                ? new Date(
                    messages[messages.length - 1].created_at,
                  ).toLocaleTimeString()
                : "No messages"}
            </p>
          </div>
        </div>
      )}

      {/* Minimized view */}
      {isMinimized ? (
        <div className="flex-1 bg-gradient-to-r from-gray-50 to-gray-100 p-3 flex items-center justify-center">
          <p className="text-sm text-gray-500">
            Chat minimized - Click restore to view
          </p>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          {showSearch && (
            <div className="border-b border-gray-200 p-3 bg-white">
              <SemanticSearchBar
                showSearch={showSearch}
                searchQuery={searchQuery}
                searchResults={searchResults}
                currentSearchIndex={currentSearchIndex}
                onSearch={handleSearch}
                onClearSearch={handleClearSearch}
                onNextResult={handleNextSearchResult}
                onPrevResult={handlePrevSearchResult}
                onSemanticSearch={handleSearch}
                searchMode={searchMode}
                onSearchModeChange={setSearchMode}
                isSearching={isSemanticSearching}
                chat={chat}
                setIsSearchingMode={setIsSearchingMode}
                onSearchComplete={handleSearchComplete}
                chatAPI={chatAPI}
                groupAPI={groupAPI}
                currentUserId={currentUserId}
                isSearchingMode={isSearchingMode}
              />
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white"
            style={{
              height: `calc(${isMaximized ? "100vh" : popupHeight} - ${showSearch ? "200px" : "140px"})`,
            }}
          >
            <MessageList
              messages={messages}
              loading={loading}
              validatedChat={chat}
              currentUserId={currentUserId}
              highlightedMessageId={highlightedMessageId}
              editingMessage={editingMessage}
              editText={editText}
              searchQuery={searchQuery}
              loadedImages={new Set()}
              showMessageMenu={showMessageMenu}
              menuPosition={{ top: 0, left: 0 }}
              selectedMessage={selectedMessage}
              onEditMessage={handleEditMessage}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onMessageMenu={handleMessageMenu}
              onRetryMessage={(msg) => {
                // Retry logic
                if (msg.message_type === "text") {
                  sendTextMessage(msg.message);
                }
              }}
              onImageLoad={() => {}}
              onImageClick={(url) => window.open(url, "_blank")}
              onDownload={handleDownload}
              formatTime={(timestamp) =>
                new Date(timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
              formatFileSize={(bytes) => {
                if (bytes === 0) return "0 Bytes";
                const k = 1024;
                const sizes = ["Bytes", "KB", "MB", "GB"];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return (
                  parseFloat((bytes / Math.pow(k, i)).toFixed(2)) +
                  " " +
                  sizes[i]
                );
              }}
              getFileIcon={(fileType) => {
                if (!fileType) return "📎";
                if (fileType.startsWith("image/")) return "🖼️";
                if (fileType.startsWith("video/")) return "🎥";
                if (fileType.includes("pdf")) return "📄";
                return "📎";
              }}
              messagesEndRef={messagesEndRef}
              renderMessageMenu={renderMessageMenu}
              hasMoreMessages={hasMoreMessages}
              isLoadingMore={isLoadingMore}
              messagesContainerRef={messagesContainerRef}
              onLoadOlderMessages={() => {}}
              searchResults={searchResults}
              isSearchingMode={isSearchingMode}
              validatedChatRef={validatedChatRef}
              isPopup={true}
            />
          </div>

          {/* Reply Preview */}
          {replyToMessage && (
            <ReplyPreview
              replyToMessage={replyToMessage}
              currentUserId={currentUserId}
              onCancelReply={handleCancelReply}
            />
          )}

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <SelectedFilesPreview
              selectedFiles={selectedFiles}
              onRemoveFile={(index) =>
                setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
              }
              onRemoveAllFiles={() => setSelectedFiles([])}
              newMessage={newMessage}
              handleInputChange={handleInputChange}
            />
          )}

          {/* Mention Suggestions Popup */}
          {showMentionSuggestions && (
            <div
              className="absolute bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto"
              style={{
                top: `${mentionPosition.top}px`,
                left: `${mentionPosition.left}px`,
                width: "200px",
              }}
            >
              {isLoadingMembers ? (
                <div className="p-3 text-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-xs text-gray-500 mt-1">
                    Loading members...
                  </p>
                </div>
              ) : mentionSuggestions.length === 0 ? (
                <div className="p-3 text-center">
                  <p className="text-sm text-gray-500">No members found</p>
                </div>
              ) : (
                <div className="py-1">
                  {mentionSuggestions.map((member, index) => (
                    <button
                      key={member._id}
                      onClick={() => handleMentionSelect(member)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 transition-colors cursor-pointer ${index === selectedMentionIndex ? "bg-blue-50" : ""}`}
                    >
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-600">
                        {member.first_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 truncate">
                        <div className="font-medium">
                          {member.first_name} {member.last_name || ""}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          @{member.username || member.first_name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mentioned Users Display */}
          {mentionedUsers.length > 0 && (
            <div className="border-t border-gray-200 p-2 bg-blue-50">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-medium text-blue-800 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Mentioning {mentionedUsers.length} member
                  {mentionedUsers.length > 1 ? "s" : ""}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    mentionedUsers?.forEach((user) =>
                      handleRemoveMention(user._id),
                    )
                  }
                  className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {mentionedUsers.map((user) => (
                  <div
                    key={`mentioned-${user._id}`}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                  >
                    <span>@{user.first_name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMention(user._id)}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Input Area */}
          <MessageInput
            newMessage={newMessage}
            selectedFiles={selectedFiles}
            sending={sending}
            uploading={uploading}
            isConnected={isConnected}
            showAttachmentMenu={showAttachmentMenu}
            showStickerMenu={showStickerMenu}
            showCodeSnippetMenu={showCodeSnippetMenu}
            codeSnippet={codeSnippet}
            snippetLanguage={snippetLanguage}
            fileInputRef={fileInputRef}
            attachmentMenuRef={attachmentMenuRef}
            stickerMenuRef={stickerMenuRef}
            onSendMessage={sendMessage}
            onInputChange={handleInputChange}
            onSetShowAttachmentMenu={setShowAttachmentMenu}
            onSetShowStickerMenu={setShowStickerMenu}
            onSetShowCodeSnippetMenu={setShowCodeSnippetMenu}
            onSetCodeSnippet={setCodeSnippet}
            onSetSnippetLanguage={setSnippetLanguage}
            onSendCodeSnippet={sendCodeSnippet}
            onFileSelect={handleFileSelect}
            onAddSticker={addStickerToMessage}
            stickers={stickers}
            onSetShowVoiceRecorder={setShowVoiceRecorder}
            onSetShowTextEditor={setShowTextEditor}
            conversationContext={[]}
            typingPredictionsEnabled={false}
            isPopup={true}
            // Add mention props
            mentionedUsers={mentionedUsers}
            onRemoveMention={handleRemoveMention}
            showMentionSuggestions={showMentionSuggestions}
            mentionSuggestions={mentionSuggestions}
            selectedMentionIndex={selectedMentionIndex}
            onMentionSelect={handleMentionSelect}
            isLoadingMembers={isLoadingMembers}
            mentionPosition={mentionPosition}
          />
        </>
      )}

      {/* Voice Recorder Dialog */}
      {showVoiceRecorder && (
        <VoiceRecorder
          isRecording={isRecording}
          recordingTime={recordingTime}
          audioBlob={audioBlob}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          onSendVoiceMessage={sendVoiceMessage}
          uploading={uploading}
        />
      )}

      {/* Rich Text Editor Dialog */}
      {showTextEditor && (
        <RichTextEditor
          showTextEditor={showTextEditor}
          richText={richText}
          onSetShowTextEditor={setShowTextEditor}
          onSetRichText={setRichText}
          onSendRichText={(content) => {
            // Handle rich text sending
            handleRichTextSend(content);
            setShowTextEditor(false);
            setRichText("");
          }}
          sending={sending}
        />
      )}

      {/* Sticker Menu */}
      {showStickerMenu && (
        <div className="absolute bottom-16 left-3 bg-white border border-gray-300 rounded-lg shadow-xl p-3 z-50 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-6 gap-2">
            {stickers.map((sticker, index) => (
              <button
                key={index}
                onClick={() => addStickerToMessage(sticker)}
                className="text-2xl hover:bg-gray-100 rounded p-1 cursor-pointer"
              >
                {sticker}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Menu */}
      {showMessageMenu &&
        selectedMessage &&
        renderMessageMenu(selectedMessage, { top: 100, left: 100 })}

      {/* Dialogs */}
      <DeleteDialog
        showDeleteDialog={showDeleteDialog}
        selectedMessage={selectedMessage}
        deleteType={deleteType}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedMessage(null);
          setDeleteType("");
        }}
        onDelete={handleDeleteMessage}
      />

      <ForwardDialog
        showForwardDialog={showForwardDialog}
        selectedMessage={selectedMessage}
        selectedForwardChat={selectedForwardChat}
        availableChats={availableChats}
        forwarding={forwarding}
        onClose={() => {
          setShowForwardDialog(false);
          setSelectedMessage(null);
          setSelectedForwardChat(null);
        }}
        onSetSelectedForwardChat={setSelectedForwardChat}
        onForward={async () => {
          setShowForwardDialog(false);
          successToast("Message forwarded", "success");
        }}
        onMessageMenu={closeMessageMenu}
      />

      <ModerationWarning
        show={showModerationWarning}
        reasons={moderationWarningData?.reasons || []}
        warningLevel={moderationWarningData?.warningLevel}
        messageContent={moderationWarningData?.messageContent}
        onConfirmSend={() => {
          if (pendingMessage) {
            sendTextMessage(pendingMessage);
          }
          setShowModerationWarning(false);
        }}
        onCancel={() => setShowModerationWarning(false)}
      />

      {/* Scroll to bottom button */}
      {showScrollToBottom && !isMinimized && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-20 right-3 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-10 cursor-pointer"
          title="Scroll to bottom"
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
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      )}

      {/* Search results indicator */}
      {isSearchingMode && searchResults.length > 0 && (
        <div className="absolute top-16 right-3 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
          {currentSearchIndex + 1}/{searchResults.length}
        </div>
      )}

      {/* User Profile Modal */}
      {showUserProfileModal && showUserProfile && (
        <UserProfileModal
          userId={showUserProfile.userId}
          chatData={showUserProfile.chatData}
          isOpen={showUserProfileModal}
          onClose={() => {
            setShowUserProfileModal(false);
            setShowUserProfile(null);
          }}
          onStartChat={(chatData) => {
            // If clicking "Message" in profile, it should already be this chat
            setShowUserProfileModal(false);
            setShowUserProfile(null);
          }}
        />
      )}

      {/* Group Profile Modal */}
      {showGroupProfileModal && showGroupProfile && (
        <GroupProfileModal
          groupId={showGroupProfile._id}
          isOpen={showGroupProfileModal}
          onClose={() => {
            setShowGroupProfileModal(false);
            setShowGroupProfile(null);
          }}
          groupData={showGroupProfile}
          currentUserId={currentUserId}
          socket={socket}
        />
      )}
    </div>
  );
};

export default ChatWindowPopup;
