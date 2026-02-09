"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  chatAPI,
  groupAPI,
  callAPI,
  semanticSearchAPI,
  moderationAPI,
} from "../lib/api";
import GroupManager from "./GroupManager";
import { successToast, errorToast } from "./toast";
import { aiAPI } from "../lib/api";
import { memo } from "react";

// Import new components
import ChatHeader from "./chatWindow/ChatHeader";
import MessageList from "./chatWindow/MessageList";
import MessageInput from "./chatWindow/MessageInput";
import SearchBar from "./chatWindow/SearchBar";
import DeleteDialog from "./chatWindow/DeleteDialog";
import ForwardDialog from "./chatWindow/ForwardDialog";
import ReplyPreview from "./chatWindow/ReplyPreview";
import SelectedFilesPreview from "./chatWindow/SelectedFilesPreview";
import VoiceRecorder from "./chatWindow/VoiceRecorder";
import RichTextEditor from "./chatWindow/RichTextEditor";
import ModerationWarning from "./chatWindow/ModerationWarning";
import ConversationSummary from "./chatWindow/ConversationSummary";
import SemanticSearchBar from "./chatWindow/SemanticSearchBar";
import UserProfileModal from "./UserProfileModal";
import { ringtoneService } from "../lib/ringtone-service";
import MentionSuggestions from "./chatWindow/MentionSuggestions";
import MentionedUser from "./chatWindow/MentionedUser";
import {
  parseMentions,
  extractMentionUsernames,
  formatMessageWithMentions,
} from "../utils/mentionParser";

export default function ChatWindow({
  chat,
  socket,
  isConnected,
  onSelectChat,
  onResetChatCount,
  onResetGroupCount,
  ...props
}) {
  const { userId } = useAuth();

  // State management
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showStickerMenu, setShowStickerMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [wallpaper, setWallpaper] = useState(null);
  const [showGroupManager, setShowGroupManager] = useState(false);
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
  const [ringingAudio, setRingingAudio] = useState(null);
  const [isSearchingMode, setIsSearchingMode] = useState(false);
  const [isSearchCancelled, setIsSearchCancelled] = useState(false);

  // Search related state
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // AI Search state
  const [searchMode, setSearchMode] = useState("text"); // 'text' or 'semantic'
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);

  // Edit message state
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");

  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [richText, setRichText] = useState("");
  const [voiceMessages, setVoiceMessages] = useState(new Map());
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Moderation state
  const [showModerationWarning, setShowModerationWarning] = useState(false);
  const [moderationWarningData, setModerationWarningData] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);

  const [aiSettings, setAiSettings] = useState({
    typingPredictions: true,
    autoTranslate: false,
    targetLanguage: "en",
  });
  const [conversationContext, setConversationContext] = useState([]);

  const [userLanguage, setUserLanguage] = useState("en");
  const [autoTranslate, setAutoTranslate] = useState(false);

  const [isLoadingAllForSearch, setIsLoadingAllForSearch] = useState(false);
  const [allMessagesForSearch, setAllMessagesForSearch] = useState([]);

  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const stickerMenuRef = useRef(null);
  const messageMenuClickOutsideRef = useRef(null);
  const processedMessageIds = useRef(new Set());
  const validatedChatRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [loadedImages, setLoadedImages] = useState(new Set());

  const [showCodeSnippetMenu, setShowCodeSnippetMenu] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [snippetLanguage, setSnippetLanguage] = useState("javascript");

  const [currentUser, setCurrentUser] = useState({ name: "User" });
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState(null);

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

  const MemoizedForwardDialog = memo(ForwardDialog);

  useEffect(() => {
    if (validatedChatRef.current?.type === "group" && !isLoadingMembers) {
      loadGroupMembers();
    }
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

  //useEffect for better timing
  useEffect(() => {
    if (
      messages.length > 0 &&
      !loading &&
      !isLoadingMore &&
      !isSearchingMode &&
      !isScrollingRef.current
    ) {
      // Only scroll on initial load (page 1) and when it's a fresh load
      if (page === 1) {
        // Small delay to ensure DOM is fully rendered
        const scrollTimer = setTimeout(() => {
          const container = messagesContainerRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 300);

        return () => clearTimeout(scrollTimer);
      }
    }
  }, [messages, loading, isLoadingMore, page, isSearchingMode]);

  const handleChatHeaderProfileClick = (chat) => {
    if (chat?.type === "private") {
      setSelectedUserForProfile({
        userId: chat.other_user?._id || chat.receiverId,
        chatData: chat,
      });
      setShowUserProfile(true);
    }
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
    validatedChatRef.current,
    hasMoreMessages,
    isLoadingMore,
    page,
    chatAPI,
    groupAPI,
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

  useEffect(() => {
    // Reset search mode when chat changes
    if (
      validatedChatRef.current &&
      validatedChatRef.current._id !== chatIdRef.current
    ) {
      setSearchQuery("");
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      setHighlightedMessageId(null);
      setIsSearchingMode(false);
      setIsLoadingAllForSearch(false);
      searchCompletionRef.current = false;
    }
  }, [validatedChatRef.current?._id]);

  useEffect(() => {
    const savedLanguage = localStorage.getItem("userLanguage") || "en";
    const savedAutoTranslate = localStorage.getItem("autoTranslate") === "true";
    setUserLanguage(savedLanguage);
    setAutoTranslate(savedAutoTranslate);
  }, []);

  // Save when preferences change
  useEffect(() => {
    localStorage.setItem("userLanguage", userLanguage);
    localStorage.setItem("autoTranslate", autoTranslate.toString());
  }, [userLanguage, autoTranslate]);

  // Update conversation context when messages change
  useEffect(() => {
    const context = messages.slice(-10).map((msg) => ({
      message: msg.message,
      sender: msg.sender_id === currentUserId ? "user" : "other",
      timestamp: msg.created_at,
    }));
    setConversationContext(context);
  }, [messages, currentUserId]);

  // Load AI settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("aiChatSettings");
    if (savedSettings) {
      setAiSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Core chat validation
  useEffect(() => {
    if (chat && Object.keys(chat).length > 0) {
      validatedChatRef.current = chat;
    } else {
      console.error("Invalid chat object received:", chat);
      validatedChatRef.current = null;
    }
  }, [chat]);

  useEffect(() => {
    if (incomingCall && !ringingAudio) {
      const audio = new Audio("/sounds/ringtone.mp3");
      audio.loop = true;
      audio.play().catch((e) => console.log("Audio play failed:", e));
      setRingingAudio(audio);
    } else if (!incomingCall && ringingAudio) {
      ringingAudio.pause();
      ringingAudio.currentTime = 0;
      setRingingAudio(null);
    }
  }, [incomingCall]);

  // Load current user ID
  useEffect(() => {
    if (chat) {
      const storedUserId = localStorage.getItem("currentUserId");
      const userIdFromChat = chat.currentUserId || chat.userId;
      const finalUserId = userIdFromChat || storedUserId || 1;
      setCurrentUserId(finalUserId);

      if (!storedUserId && finalUserId) {
        localStorage.setItem("currentUserId", finalUserId.toString());
      }
    }
  }, [chat, userId]);

  // Load messages when chat changes
  useEffect(() => {
    if (validatedChatRef.current) {
      loadMessages();
      processedMessageIds.current.clear();
    }
  }, [validatedChatRef.current]);

  useEffect(() => {
    if (validatedChatRef.current && currentUserId && socket) {
      // Mark all messages as read when chat is opened
      markMessagesAsRead();
    }
  }, [validatedChatRef.current, currentUserId]);

  useEffect(() => {
    if (isConnected && validatedChatRef.current && currentUserId) {
      markMessagesAsRead();
    }
  }, [isConnected]);

  const markMessagesAsRead = async () => {
    if (!validatedChatRef.current || !currentUserId) return;

    try {
      const chatId = validatedChatRef.current._id;

      if (validatedChatRef.current.type === "private") {
        // Mark private chat messages as read
        await chatAPI.markAsRead(chatId);

        // Emit socket event to notify other user
        if (socket) {
          socket.emit("messages_read", {
            chat_id: chatId,
            user_id: currentUserId,
          });
        }

        // Update parent dashboard
        if (props.onResetChatCount) {
          props.onResetChatCount(chatId);
        }
      } else {
        // Mark group messages as read
        await groupAPI.markGroupMessagesAsRead(chatId);

        // Emit socket event to notify group
        if (socket) {
          socket.emit("group_messages_read", {
            group_id: chatId,
            user_id: currentUserId,
          });
        }

        // Update parent dashboard
        if (props.onResetGroupCount) {
          props.onResetGroupCount(chatId);
        }
      }
    } catch (error) {
      console.error(" Error marking messages as read:", error);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      // Clean up timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !validatedChatRef.current) return;

    // In the useEffect for socket listeners, update the message handling:
    const handlePrivateMessage = (message) => {
      // Check if this message is for the current chat
      if (message.chat_id !== validatedChatRef.current?._id) {
        return;
      }

      // Skip if already processed - use a more robust check
      const messageKey = `private-${message._id}-${message.chat_id}-${message.created_at}`;
      if (message._id && processedMessageIds.current.has(messageKey)) {
        return;
      }

      // Skip own messages
      if (parseInt(message.sender_id) === parseInt(currentUserId)) {
        return;
      }

      // Mark as processed
      processedMessageIds.current.add(messageKey);

      const transformedMessage = transformFileMessageForDisplay(message);
      handleNewMessage(transformedMessage);
    };

    // Update the handleNewMessage function to better handle duplicates:
    const handleNewMessage = async (message) => {
      if (!validatedChatRef.current || !message) {
        return;
      }

      // Enhanced duplicate checking
      const messageId = message._id || message.message_id;
      const tempId = message.tempId;

      // Create unique key based on content
      const uniqueKey = messageId
        ? `${validatedChatRef.current.type}-${message.message_type}-${messageId}`
        : tempId
          ? `${validatedChatRef.current.type}-temp-${tempId}`
          : `${validatedChatRef.current.type}-${message.message_type}-${message.file_url || ""}-${message.created_at}`;

      if (processedMessageIds.current.has(uniqueKey)) {
        return;
      }

      processedMessageIds.current.add(uniqueKey);

      // Also check if message already exists in state by file_url for file messages
      if (message.file_url) {
        const alreadyExists = messages.some(
          (msg) =>
            msg.file_url === message.file_url &&
            Math.abs(new Date(msg.created_at) - new Date(message.created_at)) <
              1000,
        );

        if (alreadyExists) {
          return;
        }
      }

      let transformedMessage = transformFileMessageForDisplay(message);

      // Language detection for text messages
      if (
        transformedMessage.message_type === "text" &&
        transformedMessage.message &&
        transformedMessage.message?.trim().length > 0
      ) {
        try {
          transformedMessage =
            await detectAndSetMessageLanguage(transformedMessage);
        } catch (error) {
          console.error("Language detection failed:", error);
          transformedMessage.detectedLanguage = "auto";
        }
      } else {
        transformedMessage.detectedLanguage = "auto";
      }

      setMessages((prev) => {
        // Final check for duplicates in state
        const alreadyInState = prev.some((msg) => {
          // Check by ID
          if (messageId && msg._id === messageId) return true;

          // Check by tempId
          if (tempId && msg.tempId === tempId) return true;

          // For file messages, check file_url and timestamp
          if (
            msg.message_type === transformedMessage.message_type &&
            msg.file_url === transformedMessage.file_url &&
            Math.abs(
              new Date(msg.created_at) -
                new Date(transformedMessage.created_at),
            ) < 1000
          ) {
            return true;
          }

          return false;
        });

        if (alreadyInState) {
          return prev;
        }

        return [...prev, { ...transformedMessage, _socketReceived: true }];
      });
    };

    const handleGroupMessage = (message) => {
      // Check if message is for current group
      if (
        validatedChatRef.current?.type === "group" &&
        parseInt(validatedChatRef.current._id) === parseInt(message.group_id)
      ) {
        // Skip if it's from current user AND skip_self is true
        if (
          message.skip_self &&
          parseInt(message.sender_id) === parseInt(currentUserId)
        ) {
          return;
        }

        // Check if already exists by ID
        if (
          message._id &&
          processedMessageIds.current.has(`msg-${message._id}`)
        ) {
          return;
        }

        // Mark as processed
        if (message._id) {
          processedMessageIds.current.add(`msg-${message._id}`);
        }

        const transformedMessage = transformFileMessageForDisplay(message);

        // For code messages, ensure proper parsing
        if (transformedMessage.message_type === "code") {
          try {
            if (typeof transformedMessage.message === "string") {
              const parsed = JSON.parse(transformedMessage.message);
              transformedMessage.code_data = parsed;
            }
          } catch (error) {
            console.error("Error parsing code message:", error);
          }
        }

        setMessages((prev) => {
          // For code messages, we need to be more careful about matching
          if (
            parseInt(transformedMessage.sender_id) === parseInt(currentUserId)
          ) {
            // For our own messages, look for temp message to replace

            // First try: Match by tempId (if we have one)
            if (transformedMessage.tempId) {
              const existingByTempId = prev.findIndex(
                (msg) => msg.tempId === transformedMessage.tempId,
              );

              if (existingByTempId !== -1) {
                const newMessages = [...prev];
                newMessages[existingByTempId] = {
                  ...transformedMessage,
                  isSending: false,
                  failed: false,
                };
                return newMessages;
              }
            }

            // Second try: For code messages, compare content
            if (transformedMessage.message_type === "code") {
              const existingByContent = prev.findIndex(
                (msg) =>
                  msg.message_type === "code" &&
                  msg.message === transformedMessage.message &&
                  msg.sender_id === currentUserId &&
                  (!msg._id || msg._id.toString().startsWith("temp-")),
              );

              if (existingByContent !== -1) {
                const newMessages = [...prev];
                newMessages[existingByContent] = {
                  ...transformedMessage,
                  isSending: false,
                  failed: false,
                };
                return newMessages;
              }
            }

            // Third try: Generic matching for other message types
            const existingTempIndex = prev.findIndex(
              (msg) =>
                (!msg._id || msg._id.toString().startsWith("temp-")) &&
                msg.sender_id === currentUserId &&
                msg.message_type === transformedMessage.message_type &&
                Math.abs(
                  new Date(msg.created_at) -
                    new Date(transformedMessage.created_at),
                ) < 15000,
            );

            if (existingTempIndex !== -1) {
              const newMessages = [...prev];
              newMessages[existingTempIndex] = {
                ...transformedMessage,
                isSending: false,
                failed: false,
              };
              return newMessages;
            }
          }

          // For messages from others or if no temp found
          const existingIndex = prev.findIndex(
            (msg) =>
              msg._id === transformedMessage._id ||
              (msg.tempId && msg.tempId === transformedMessage.tempId),
          );

          if (existingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[existingIndex] = {
              ...transformedMessage,
              isSending: false,
            };
            return newMessages;
          }

          return [...prev, { ...transformedMessage }];
        });
      }
    };

    const handleAudioMessage = (message) => {
      // Determine if it's for current chat
      const isForCurrentChat =
        validatedChatRef.current?.type === "group"
          ? parseInt(message.group_id) ===
            parseInt(validatedChatRef.current._id)
          : parseInt(message.chat_id) ===
            parseInt(validatedChatRef.current?._id);

      if (!isForCurrentChat) return;

      // Skip if already processed
      if (message._id && processedMessageIds.has(`audio-${message._id}`)) {
        return;
      }

      if (
        message.skip_self &&
        parseInt(message.sender_id) === parseInt(currentUserId)
      ) {
        return;
      }

      // Mark as processed
      if (message._id) processedMessageIds.add(`audio-${message._id}`);

      const transformedMessage = transformFileMessageForDisplay(message);
      handleNewMessage(transformedMessage);
    };

    // const handleTyping = (data) => {
    //   console.log('Typing event received:', data);
    //   console.log('Current user ID:', currentUserId);

    //   if (data.user_id !== currentUserId) {
    //     setIsTyping(data.is_typing);
    //     setTypingUser(data.user_id);

    //     if (data.is_typing) {
    //       if (typingTimeoutRef.current) {
    //         clearTimeout(typingTimeoutRef.current);
    //       }
    //       typingTimeoutRef.current = setTimeout(() => {
    //         setIsTyping(false);
    //         setTypingUser(null);
    //       }, 3000);
    //     }
    //   }
    // };

    const CallHistoryMessage = ({ message }) => {
      if (message.message_type !== "call") return null;

      const callData =
        message.call_data ||
        (typeof message.message === "string"
          ? JSON.parse(message.message)
          : message.message);

      const { call_type, call_status, duration } = callData;

      const getCallIcon = () => {
        if (call_type === "video") return "🎥";
        return "📞";
      };

      const getCallText = () => {
        const typeText = call_type === "video" ? "Video call" : "Voice call";

        switch (call_status) {
          case "initiated":
          case "started":
            return `${typeText} started`;
          case "accepted":
            return `${typeText} accepted`;
          case "rejected":
            return `${typeText} declined`;
          case "completed":
          case "ended":
            return `${typeText} ended • ${formatTime(duration)}`;
          case "missed":
          case "timeout":
            return `Missed ${typeText.toLowerCase()}`;
          case "failed":
            return `${typeText} failed`;
          default:
            return `${typeText} • ${call_status}`;
        }
      };

      const formatTime = (seconds) => {
        if (!seconds) return "";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
      };

      return (
        <div className="flex items-center justify-center my-2">
          <div className="bg-gray-100 px-4 py-2 rounded-full text-sm text-gray-600 flex items-center gap-2">
            <span>{getCallIcon()}</span>
            <span>{getCallText()}</span>
          </div>
        </div>
      );
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
      if (parseInt(validatedChatRef.current._id) === parseInt(data.group_id)) {
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

    // Group call initiation handler
    const handleGroupCallInitiate = (data) => {
      if (
        validatedChatRef.current.type === "group" &&
        validatedChatRef.current._id === data.groupId
      ) {
        setIncomingCall(data);
      }
    };

    // Voice call initiation handler
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

    // Video call initiation handler
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

    const handleMessageRead = (data) => {
      if (data.chat_id === validatedChatRef.current?._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.message_id && msg.sender_id === currentUserId
              ? {
                  ...msg,
                  is_read: true,
                  read_by: [...(msg.read_by || []), data.read_by],
                }
              : msg,
          ),
        );
      }
    };

    const handleTypingPrivate = (data) => {
      console.log("🔔 Private typing event received:", data);

      if (
        validatedChatRef.current?.type === "private" &&
        validatedChatRef.current._id === data.chat_id &&
        data.user_id !== currentUserId
      ) {
        console.log("👤 Setting typing for private chat:", data);
        setIsTyping(data.is_typing);
        setTypingUser(data.user_id);

        if (data.is_typing) {
          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          // Auto-clear after 3 seconds
          typingTimeoutRef.current = setTimeout(() => {
            console.log("⏰ Clearing typing indicator (timeout)");
            setIsTyping(false);
            setTypingUser(null);
          }, 3000);
        } else {
          // Immediately clear when typing stops
          setIsTyping(false);
          setTypingUser(null);
        }
      }
    };

    const handleTypingGroup = (data) => {
      console.log("🔔 Group typing event received:", data);

      if (
        validatedChatRef.current?.type === "group" &&
        validatedChatRef.current._id === data.group_id &&
        data.user_id !== currentUserId
      ) {
        console.log("👥 Setting typing for group:", data);
        setIsTyping(data.is_typing);
        setTypingUser(data.user_id);

        if (data.is_typing) {
          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          // Auto-clear after 3 seconds
          typingTimeoutRef.current = setTimeout(() => {
            console.log("⏰ Clearing group typing indicator (timeout)");
            setIsTyping(false);
            setTypingUser(null);
          }, 3000);
        } else {
          // Immediately clear when typing stops
          setIsTyping(false);
          setTypingUser(null);
        }
      }
    };

    // Update socket listeners:
    socket.on("user_typing", handleTypingPrivate);
    socket.on("group_user_typing", handleTypingGroup);

    // Also update the typing event for backward compatibility:
    const handleTyping = (data) => {
      console.log("🔔 Legacy typing event:", data);

      // Handle both private and group with fallback
      if (data.chat_id) {
        handleTypingPrivate(data);
      } else if (data.group_id) {
        handleTypingGroup({
          ...data,
          group_id: data.group_id || data.chat_id,
        });
      }
    };

    socket.on("typing", handleTyping);

    // Update socket listeners in the useEffect:
    socket.on("group_audio_message", handleAudioMessage);
    socket.on("group_message", handleGroupMessage);

    // Set up socket listeners - AUDIO FIRST
    socket.on("audio_message", handleAudioMessage);

    socket.on("message_read", handleMessageRead);

    // Set up socket listeners
    socket.on("private_message", handlePrivateMessage);
    // socket.on('group_message', handleGroupMessage);
    socket.on("user_typing", handleTyping);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("group_message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("group_message_edited", handleGroupMessageEdited);
    socket.on("group_voice_call_initiate", handleGroupCallInitiate);
    socket.on("group_video_call_initiate", handleGroupCallInitiate);
    socket.on("voice_call_initiate", handleVoiceCallInitiate);
    socket.on("video_call_initiate", handleVideoCallInitiate);

    // Debug: Log all socket events
    socket.onAny((event, data) => {
      if (event.includes("call")) {
        console.log("🔍 Socket event:", event, data);
      }
      if (event.includes("accept") || event.includes("reject")) {
        ringtoneService.stop();
      }
      if (event.includes("reject")) {
        rejectCall();
      }
    });

    // Join appropriate rooms
    if (validatedChatRef.current.type === "group") {
      socket.emit("join_groups", [validatedChatRef.current._id]);
    } else {
      socket.emit("join_private_chat", validatedChatRef.current._id);
    }

    // Cleanup function
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
      socket.off("audio_message", handleAudioMessage);
      socket.off("group_audio_message", handleAudioMessage);
      socket.off("message_read", handleMessageRead);
      socket.off("user_typing", handleTypingPrivate);
      socket.off("group_user_typing", handleTypingGroup);
      socket.off("typing", handleTyping);

      if (validatedChatRef.current?.type === "group") {
        socket.emit("leave_groups", [validatedChatRef.current._id]);
      } else {
        socket.emit("leave_private_chat", validatedChatRef.current?._id);
      }
    };
  }, [socket, validatedChatRef.current, currentUserId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      setShowScrollToBottom(!isNearBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    localStorage.setItem("aiChatSettings", JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    if (!socket || !validatedChatRef.current || !currentUserId) return;

    const handleMessagesRead = (data) => {
      if (
        data.chat_id === validatedChatRef.current?._id &&
        data.user_id !== currentUserId
      ) {
        // Mark messages as read in the UI
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender_id === currentUserId &&
            !msg.read_by?.includes(data.user_id)
              ? {
                  ...msg,
                  read_by: [...(msg.read_by || []), data.user_id],
                }
              : msg,
          ),
        );
      }
    };

    const handleGroupMessagesRead = (data) => {
      if (
        data.group_id === validatedChatRef.current?._id &&
        data.user_id !== currentUserId
      ) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender_id === currentUserId &&
            !msg.read_by?.includes(data.user_id)
              ? {
                  ...msg,
                  read_by: [...(msg.read_by || []), data.user_id],
                }
              : msg,
          ),
        );
      }
    };

    const handleMessagesReadBatch = (data) => {
      // Check if this is for the current chat
      if (data.chat_id === validatedChatRef.current?._id) {
        // Update all the messages that were read
        setMessages((prev) =>
          prev.map((msg) =>
            data.message_ids.includes(msg._id)
              ? {
                  ...msg,
                  is_read: true,
                  read_by: [...(msg.read_by || []), data.read_by],
                }
              : msg,
          ),
        );
      }
    };

    // Listen for group messages read by user (for ✓✓ indicator)
    const handleGroupMessagesReadByUser = (data) => {
      if (
        data.group_id === validatedChatRef.current?._id &&
        validatedChatRef.current.type === "group"
      ) {
        // Update messages that were read
        if (data.message_ids && Array.isArray(data.message_ids)) {
          setMessages((prev) =>
            prev.map((msg) =>
              data.message_ids.includes(msg._id) &&
              msg.sender_id === currentUserId // Only update our own messages
                ? {
                    ...msg,
                    read_by: [...(msg.read_by || []), data.user_id],
                  }
                : msg,
            ),
          );
        }
      }
    };

    // Listen for broadcast notifications
    const handleGroupMessagesReadBroadcast = (data) => {
      if (
        data.group_id === validatedChatRef.current?._id &&
        validatedChatRef.current.type === "group" &&
        data.user_id !== currentUserId
      ) {
        console.log(
          `User ${data.user_id} read ${data.message_count} messages in this group`,
        );
        // You could update UI here if needed
      }
    };

    socket.on("messages_read", handleMessagesRead);
    socket.on("group_messages_read", handleGroupMessagesRead);
    socket.on("messages_read_batch", handleMessagesReadBatch);
    socket.on("group_messages_read_by_user", handleGroupMessagesReadByUser);
    socket.on(
      "group_messages_read_by_user_notification",
      handleGroupMessagesReadBroadcast,
    );

    return () => {
      socket.off("messages_read", handleMessagesRead);
      socket.off("group_messages_read", handleGroupMessagesRead);
      socket.off("messages_read_batch", handleMessagesReadBatch);
      socket.off("group_messages_read_by_user", handleGroupMessagesReadByUser);
      socket.off(
        "group_messages_read_by_user_notification",
        handleGroupMessagesReadBroadcast,
      );
    };
  }, [socket, currentUserId, validatedChatRef.current]);

  const handleSemanticSearch = async (query) => {
    if (!query?.trim() || !validatedChatRef.current) return;

    setIsSemanticSearching(true);
    try {
      const response = await semanticSearchAPI.semanticSearch({
        query: query?.trim(),
        chatId: validatedChatRef.current._id,
        chatType: validatedChatRef.current.type,
        limit: 20,
        similarityThreshold: 0.7,
      });

      if (response.data.success) {
        setSearchResults(response.data.results);
        setCurrentSearchIndex(-1);

        if (response.data.results.length > 0) {
          handleNextSearchResult();
        }
      }
    } catch (error) {
      console.error("Semantic search error:", error);
      errorToast("Semantic search failed", "error");
    } finally {
      setIsSemanticSearching(false);
    }
  };

  const sendCodeSnippet = async () => {
    // Enhanced validation with detailed logging
    if (!codeSnippet) {
      errorToast("Please enter some code", "error");
      return;
    }

    if (typeof codeSnippet !== "string") {
      errorToast("Invalid code format", "error");
      return;
    }

    if (codeSnippet?.trim().length === 0) {
      errorToast("Please enter some code", "error");
      return;
    }

    if (!currentUserId) {
      errorToast("Please wait while we load your user information", "error");
      return;
    }

    if (!validatedChatRef.current) {
      errorToast("No active chat selected", "error");
      return;
    }

    if (sending) {
      return;
    }

    setSending(true);

    try {
      const codeData = {
        content: codeSnippet?.trim(),
        language: snippetLanguage || "javascript",
        timestamp: Date.now(),
      };

      // Create a unique temp ID for this message
      const tempId = `code_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create the temp message for local state FIRST
      const tempMessage = {
        id: tempId, // Use tempId as ID initially
        tempId: tempId,
        message: JSON.stringify(codeData),
        message_type: "code",
        sender_id: currentUserId,
        sender: {
          id: currentUserId,
          first_name: "You",
          last_name: "",
        },
        created_at: new Date().toISOString(),
        isSending: true, // Mark as sending
        failed: false,
        // Include chat/group info for proper routing
        chat_id:
          validatedChatRef.current.type === "private"
            ? validatedChatRef.current._id
            : null,
        group_id:
          validatedChatRef.current.type === "group"
            ? validatedChatRef.current._id
            : null,
      };

      if (validatedChatRef.current.type === "private") {
        // Add temp message to local state IMMEDIATELY
        setMessages((prev) => {
          return [...prev, tempMessage];
        });
      }

      let response;
      if (validatedChatRef.current.type === "group") {
        response = await groupAPI.sendGroupMessage(
          validatedChatRef.current._id,
          {
            message: JSON.stringify(codeData),
            message_type: "code",
            tempId: tempId, // Send tempId to server so it can echo it back
          },
        );
      } else {
        response = await chatAPI.sendMessage(validatedChatRef.current._id, {
          message: JSON.stringify(codeData),
          message_type: "code",
          tempId: tempId, // Send tempId to server so it can echo it back
        });
      }

      // Update the temp message with the real ID from server
      if (response.data?._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === tempId
              ? {
                  ...response.data,
                  isSending: false, // Remove sending status
                  tempId: tempId, // Keep tempId for reference
                  sender: {
                    // Ensure sender info is preserved
                    id: currentUserId,
                    first_name: "You",
                    last_name: "",
                  },
                }
              : msg,
          ),
        );
      }

      // Reset form
      setShowCodeSnippetMenu(false);
      setCodeSnippet("");
      setSnippetLanguage("javascript");

      successToast("Code snippet sent", "success");
    } catch (error) {
      console.error("DEBUG: Error sending code snippet:", error);
      console.error(
        "DEBUG: Error details:",
        error.response?.data || error.message,
      );

      // Mark the message as failed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId
            ? { ...msg, isSending: false, failed: true }
            : msg,
        ),
      );

      errorToast("Failed to send code snippet", "error");
    } finally {
      setSending(false);
    }
  };

  const handleNewMessage = async (message) => {
    if (!validatedChatRef.current || !message) {
      return;
    }

    // Enhanced duplicate checking
    const messageId = message._id || message.message_id;
    const tempId = message.tempId;

    // Create unique key based on message type and source
    const uniqueKey = messageId
      ? `${validatedChatRef.current.type}-${message.message_type}-${messageId}`
      : tempId
        ? `${validatedChatRef.current.type}-temp-${tempId}`
        : null;

    if (uniqueKey && processedMessageIds.current.has(uniqueKey)) {
      return;
    }

    if (uniqueKey) {
      processedMessageIds.current.add(uniqueKey);
    }

    let transformedMessage = transformFileMessageForDisplay(message);

    // Language detection for text messages
    if (
      transformedMessage.message_type === "text" &&
      transformedMessage.message &&
      transformedMessage.message?.trim().length > 0
    ) {
      try {
        transformedMessage =
          await detectAndSetMessageLanguage(transformedMessage);
      } catch (error) {
        console.error("Language detection failed:", error);
        transformedMessage.detectedLanguage = "auto";
      }
    } else {
      transformedMessage.detectedLanguage = "auto";
    }

    setMessages((prev) => {
      // Check if message already exists in state
      const alreadyExists = prev.some((msg) => {
        if (messageId && msg._id === messageId) return true;
        if (tempId && msg.tempId === tempId) return true;

        // For file messages, check file_url and timestamp
        if (
          msg.message_type === transformedMessage.message_type &&
          msg.file_url === transformedMessage.file_url &&
          Math.abs(
            new Date(msg.created_at) - new Date(transformedMessage.created_at),
          ) < 1000
        ) {
          return true;
        }

        return false;
      });

      if (alreadyExists) {
        return prev;
      }

      return [...prev, { ...transformedMessage, _socketReceived: true }];
    });
  };

  const detectAndSetMessageLanguage = async (message) => {
    try {
      // Only detect language for messages longer than 3 characters
      // if (message.message && message.message.trim().length > 3) {
      //   const response = await aiAPI.detectLanguage({
      //     text: message.message
      //   });
      //   if (response.data.success) {
      //     return {
      //       ...message,
      //       detectedLanguage: response.data.detectedLanguage,
      //       languageConfidence: response.data.confidence
      //     };
      //   }
      // }
    } catch (error) {
      console.error("Language detection API error:", error);
      // If API fails, try simple client-side detection as fallback
      const simpleDetection = simpleDetectLanguage(message.message);
      if (simpleDetection) {
        return {
          ...message,
          detectedLanguage: simpleDetection,
          languageConfidence: 0.7,
        };
      }
    }

    // Return original message if detection fails
    return {
      ...message,
      detectedLanguage: "auto",
      languageConfidence: 0,
    };
  };

  // Simple client-side language detection fallback
  const simpleDetectLanguage = (text) => {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    // Common words in different languages
    const patterns = {
      en: /\b(the|and|is|in|to|of|a|an)\b/gi,
      es: /\b(el|la|y|es|en|de|un|una)\b/gi,
      fr: /\b(le|la|et|est|dans|de|un|une)\b/gi,
      de: /\b(der|die|und|ist|in|zu|ein|eine)\b/gi,
      it: /\b(il|la|e|è|in|di|un|una)\b/gi,
      pt: /\b(o|a|e|é|em|de|um|uma)\b/gi,
    };

    let maxCount = 0;
    let detectedLang = "en"; // Default to English

    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = lowerText.match(pattern);
      const count = matches ? matches.length : 0;
      if (count > maxCount) {
        maxCount = count;
        detectedLang = lang;
      }
    }

    return maxCount > 0 ? detectedLang : null;
  };

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

  const loadMessages = async () => {
    if (!validatedChatRef.current || isLoadingRef.current) return;

    try {
      // Cancel any existing requests
      if (loadMessagesAbortControllerRef.current) {
        loadMessagesAbortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      loadMessagesAbortControllerRef.current = abortController;
      isLoadingRef.current = true;

      setLoading(true);
      // Reset pagination state - IMPORTANT: Reset to 0 for initial load
      setPage(0);
      setHasMoreMessages(true);
      setMessages([]);
      processedMessageIds.current.clear();

      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.getChatMessages(
          validatedChatRef.current._id,
          50,
          0, // Start from 0
          { signal: abortController.signal },
        );
      } else {
        response = await groupAPI.getGroupMessages(
          validatedChatRef.current._id,
          50,
          0, // Start from 0
          { signal: abortController.signal },
        );
      }

      const apiResponse = response.data;
      const newMessages = apiResponse.messages || [];

      // Check if there are more messages to load
      if (!apiResponse.pagination?.hasMore || newMessages.length < 50) {
        setHasMoreMessages(false);
      }

      // Process messages with language detection
      const processedMessages = await Promise.all(
        newMessages.map(async (message) => {
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
                "Language detection failed for message:",
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

      // IMPORTANT: Keep messages in reverse order (oldest to newest)
      const chronologicalMessages = [...processedMessages].reverse();

      setMessages(chronologicalMessages);
      setPage(1); // Set page to 1 after initial load

      //  small delay before scrolling
      setTimeout(() => {
        if (!isSearchingMode) {
          scrollToBottom(true);
        }
      }, 300);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      console.error("Error loading messages:", error);
      errorToast("Failed to load messages", "error");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      loadMessagesAbortControllerRef.current = null;
    }
  };

  const transformFileMessageForDisplay = (message) => {
    if (message._transformed) return message;

    const messageType = message.message_type || "text";
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    // Handle all file-based messages with consistent logic
    if (["image", "video", "file", "audio"].includes(messageType)) {
      let finalFileUrl = null;

      if (message.file_url && message.file_url.startsWith("http")) {
        finalFileUrl = message.file_url;
      } else if (message.file_path) {
        finalFileUrl = `${baseUrl}/uploads/chat_files/${message.file_path.replace(/^uploads[\\/]/, "")}`;
      } else if (message.file_name || message.filename) {
        const filename = message.file_name || message.filename;
        finalFileUrl = `${baseUrl}/uploads/chat_files/${filename}`;
      } else if (message.message && message.message.startsWith("uploads/")) {
        finalFileUrl = `${baseUrl}/uploads/chat_files/${message.message}`;
      }

      const transformed = {
        ...message,
        id: message._id || message.message_id,
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
        duration: message.duration || message.recording_duration || 0,
        _transformed: true,
        timestamp:
          message.timestamp || message.created_at || new Date().toISOString(),
      };

      // Special handling for audio
      if (messageType === "audio") {
        transformed._isAudioMessage = true;
      }

      return transformed;
    }

    // Handle rich text and code messages
    if (messageType === "rich_text" || messageType === "code") {
      return {
        ...message,
        id: message._id || message.message_id,
        message_type: messageType,
        message: message.message || "",
        _transformed: true,
        timestamp:
          message.timestamp || message.created_at || new Date().toISOString(),
      };
    }

    // Handle call messages
    if (messageType === "call") {
      return {
        ...message,
        id: message._id || message.message_id,
        message_type: "call",
        _transformed: true,
        timestamp:
          message.timestamp || message.created_at || new Date().toISOString(),
      };
    }

    // Handle deleted messages
    if (message.is_deleted && message.message_type === "deleted") {
      return {
        ...message,
        id: message._id || message.message_id,
        message_type: "deleted",
        message: "This message was deleted",
        file_url: null,
        file_name: null,
        _transformed: true,
        timestamp:
          message.timestamp || message.created_at || new Date().toISOString(),
      };
    }

    // Default text message
    return {
      ...message,
      id: message._id || message.message_id,
      message_type: messageType,
      _transformed: true,
      timestamp:
        message.timestamp || message.created_at || new Date().toISOString(),
    };
  };

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

  const updateSidebarOnMessageSend = (message, chatType) => {
    if (!socket || !validatedChatRef.current) return;

    const chatData = {
      chat_id: validatedChatRef.current._id,
      last_message: message.message,
      last_message_type: message.message_type,
      last_message_at: message.created_at || new Date().toISOString(),
      sender_id: message.sender_id,
      // Include file info for file messages
      ...(message.message_type !== "text" && {
        file_url: message.file_url,
        file_name: message.file_name,
      }),
    };

    // Emit event to update sidebar
    socket.emit("message_sent_update_sidebar", chatData);

    // Also emit to other participants
    if (chatType === "private") {
      const receiverId = getReceiverId();
      if (receiverId) {
        socket.emit("private_message_sent_update", {
          ...chatData,
          receiver_id: receiverId,
        });
      }
    } else if (chatType === "group") {
      socket.emit("group_message_sent_update", {
        ...chatData,
        group_id: validatedChatRef.current._id,
      });
    }
  };

  // moderation check function
  const checkMessageModeration = async (messageText) => {
    try {
      const response = await moderationAPI.moderateMessage({
        text: messageText,
        chatType: validatedChatRef.current?.type,
        userId: currentUserId,
      });

      return response.data.moderation;
    } catch (error) {
      console.error("Moderation check failed:", error);
      // If moderation fails, allow the message (fail open)
      return { safe: true, should_block: false, flagged: false };
    }
  };

  // Handle moderation warning actions
  const handleModerationConfirm = () => {
    if (pendingMessage) {
      proceedWithMessageSending(pendingMessage);
    }
    setShowModerationWarning(false);
    setPendingMessage(null);
    setModerationWarningData(null);
  };

  const handleModerationCancel = () => {
    setShowModerationWarning(false);
    setPendingMessage(null);
    setModerationWarningData(null);
  };

  const sendTextMessage = async (messageText) => {
    if (!currentUserId || !validatedChatRef.current) return;

    // Check moderation
    const moderationResult = await checkMessageModeration(messageText);

    if (moderationResult.should_block) {
      setModerationWarningData({
        reasons: moderationResult.reasons,
        warningLevel: moderationResult.warning_level,
        messageContent: messageText,
      });
      setShowModerationWarning(true);
      return;
    }

    if (moderationResult.flagged && !moderationResult.should_block) {
      setPendingMessage(messageText);
      setModerationWarningData({
        reasons: moderationResult.reasons,
        warningLevel: moderationResult.warning_level,
        messageContent: messageText,
      });
      setShowModerationWarning(true);
      return;
    }

    await proceedWithMessageSending(messageText);
  };

  const proceedWithMessageSending = async (messageText) => {
    if (!currentUserId || !validatedChatRef.current) return;

    setSending(true);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Extract mentions from mentionedUsers state
    const mentionIds = mentionedUsers.map((user) => user._id);
    const mentionData = mentionedUsers.map((user) => ({
      id: user._id,
      name: `${user.first_name} ${user.last_name || ""}`.trim(),
      username: user.username || user.first_name,
      profile_image: user.profile_image,
    }));

    // IMPORTANT: Clean the message text - remove the @ mentions since they're stored separately
    let cleanedMessage = messageText;
    mentionedUsers.forEach((user) => {
      // Remove @username from message text
      const mentionPattern = new RegExp(`@${user.first_name}\\s?`, "g");
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
      isSending: true,
      sender: {
        id: currentUserId,
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

    // Add temp message immediately
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    const currentReplyToMessage = replyToMessage;
    setReplyToMessage(null);
    setMentionedUsers([]); // Clear mentioned users after sending
    setShowMentionSuggestions(false);
    stopTyping();

    try {
      let response;

      if (validatedChatRef.current.type === "private") {
        // Private chat
        response = await chatAPI.sendMessage(validatedChatRef.current._id, {
          message: messageText,
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
            message: messageText,
            message_type: "text",
            reply_to_message_id: currentReplyToMessage?._id,
            mentions: mentionIds,
            mention_data: mentionData,
          },
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
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

  const getReceiverId = () => {
    if (!validatedChatRef.current) return null;

    if (validatedChatRef.current.type === "private") {
      const possibleReceiverIds = [
        validatedChatRef.current.other_user_id,
        validatedChatRef.current.other_user?._id,
        validatedChatRef.current.receiver_id,
        validatedChatRef.current.receiverId,
        validatedChatRef.current.participant_id,
        validatedChatRef.current.participant?._id,
      ];

      const receiverId = possibleReceiverIds.find(
        (id) => id !== undefined && id !== null && id !== "",
      );

      return receiverId ? parseInt(receiverId) : null;
    }

    // For groups, we don't have a single receiver
    return null;
  };

  // File handling
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const oversizedFiles = files.filter((file) => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      errorToast(
        "Some files are too large. Please select files smaller than 10MB each.",
        "error",
      );
      return;
    }

    const filesToAdd = files.slice(0, 10);
    setSelectedFiles((prev) => [...prev, ...filesToAdd]);
    setShowAttachmentMenu(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
        message: caption || "",
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

    setMessages((prev) => [...prev, ...tempMessages]);
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
    }

    // TYPING INDICATOR FIXED
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

  // Add keyboard navigation for mention suggestions
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

  const handleOpenUserProfile = async (userId, userName) => {
    try {
      // Try to fetch user data if not already available
      let userData = null;

      // Check group members first
      if (validatedChatRef.current?.type === "group") {
        userData = groupMembers.find((m) => m._id == userId);
      } else if (validatedChatRef.current?.type === "private") {
        // For private chats, check other user
        const otherUser = validatedChatRef.current.other_user;
        if (otherUser && otherUser._id == userId) {
          userData = otherUser;
        }
      }

      // If not found, try to fetch from API
      if (!userData) {
        // You'll need to implement an API call to fetch user by ID
        const response = await userAPI.getUserById(userId);
        userData = response.data.user;
      }

      setSelectedUserForProfile({
        userId: userId,
        userName: userName,
        userData: userData,
      });
      setShowUserProfile(true);
    } catch (error) {
      console.error("Error opening user profile:", error);
      errorToast("Could not load user profile", "error");
    }
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

  // Message actions
  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditText(message.message);
    //closeMessageMenu();
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
          message: editText?.trim(),
        });
      } else {
        response = await groupAPI.editGroupMessage(editingMessage._id, {
          message: editText?.trim(),
        });
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === editingMessage._id
            ? {
                ...msg,
                message: editText?.trim(),
                is_edited: true,
                updated_at: new Date().toISOString(),
              }
            : msg,
        ),
      );

      setEditingMessage(null);
      setEditText("");
      successToast("Message edited successfully", "success");

      if (socket) {
        const eventData = {
          message_id: editingMessage._id,
          message: editText?.trim(),
          is_edited: true,
          updated_at: new Date().toISOString(),
        };

        if (validatedChatRef.current.type === "private") {
          socket.emit("message_edited", eventData);
        } else {
          socket.emit("group_message_edited", eventData);
        }
      }
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
      setSelectedMessage(null);
      setDeleteType("");

      let response;

      if (validatedChatRef.current.type === "group") {
        if (deleteType === "for-me") {
          response = await groupAPI.deleteGroupMessageForMe(message._id);
          setMessages((prev) => prev.filter((msg) => msg._id !== message._id));
        } else {
          response = await groupAPI.deleteGroupMessageForEveryone(message._id);

          // Update local state
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === message._id
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

          // CRITICAL: Emit socket event for group delete
          if (socket) {
            socket.emit("group_message_deleted", {
              message_id: message._id,
              group_id: validatedChatRef.current._id,
              deleted_for_everyone: true,
              deleted_by: currentUserId,
            });
          }
        }
      } else {
        // PRIVATE CHAT
        if (deleteType === "for-me") {
          response = await chatAPI.deleteMessageForMe(message._id);
          setMessages((prev) => prev.filter((msg) => msg._id !== message._id));
        } else {
          response = await chatAPI.deleteMessageForEveryone(message._id);

          // Update local state
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === message._id
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

          // Emit socket event for private chat
          if (socket) {
            const receiverId = getReceiverId();
            if (receiverId) {
              socket.emit("message_deleted", {
                message_id: message._id,
                chat_id: validatedChatRef.current._id,
                deleted_for_everyone: true,
                deleted_by: currentUserId,
              });
            }
          }
        }
      }

      successToast(
        deleteType === "for-everyone"
          ? "Message deleted for everyone"
          : "Message deleted for you",
        "success",
      );
    } catch (error) {
      console.error(" Delete error:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to delete message";
      errorToast(`Delete failed: ${errorMessage}`, "error");
    }
  };

  const handleReplyToMessage = (message) => {
    setReplyToMessage(message);
    closeMessageMenu();
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) input.focus();
    }, 100);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  // Search functionality
  const handleSearch = async (query) => {
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setSearchQuery(query);

    if (!query?.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      setHighlightedMessageId(null);
      setIsSearchingMode(false);
      setIsLoadingAllForSearch(false);

      // Reset search completion flag
      if (searchCompletionRef.current) {
        searchCompletionRef.current = false;
      }

      return;
    }

    setIsSearchingMode(true);
  };

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

  // Add effect to reset search completion when search query changes
  useEffect(() => {
    // Reset completion flag when search query changes
    searchCompletionRef.current = false;
  }, [searchQuery]);

  // Add effect to reset search completion when chat changes
  useEffect(() => {
    if (validatedChatRef.current) {
      searchCompletionRef.current = false;
    }
  }, [validatedChatRef.current]);

  const handleNextSearchResult = () => {
    if (searchResults.length === 0) return;

    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);

    const message = searchResults[nextIndex];
    setHighlightedMessageId(message._id);

    const messageElement = document.getElementById(`message-${message._id}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      messageElement.classList.add("highlight-pulse");
      setTimeout(() => {
        messageElement.classList.remove("highlight-pulse");
      }, 2000);
    }
  };

  const handlePrevSearchResult = () => {
    if (searchResults.length === 0) return;

    const prevIndex =
      (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);

    const message = searchResults[prevIndex];
    setHighlightedMessageId(message._id);

    const messageElement = document.getElementById(`message-${message._id}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      messageElement.classList.add("highlight-pulse");
      setTimeout(() => {
        messageElement.classList.remove("highlight-pulse");
      }, 2000);
    }
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

  // Forward functionality
  // Enhanced version with better error handling
  const loadAvailableChats = async () => {
    try {
      setAvailableChats([]); // Clear previous results

      const [chatsResponse, groupsResponse] = await Promise.all([
        chatAPI.getChats().catch((error) => {
          console.error("Error fetching private chats:", error);
          return { data: [] };
        }),
        groupAPI.getUserGroups().catch((error) => {
          console.error("Error fetching groups:", error);
          return { data: [] };
        }),
      ]);

      // Process private chats with better fallbacks
      const privateChats = (chatsResponse?.data || []).map((chat) => {
        const displayName = chat.other_user?.first_name
          ? `${chat.other_user.first_name} ${chat.other_user.last_name || ""}`?.trim()
          : chat.other_user?.username
            ? chat.other_user.username
            : chat.name || "Private Chat";

        return {
          ...chat,
          type: "private",
          display_name: displayName,
          id:
            chat._id?.toString() || `private_${chat.chat_id || Math.random()}`,
        };
      });

      // Process group chats with better fallbacks
      const groupChats = (groupsResponse?.data || []).map((group) => ({
        ...group,
        type: "group",
        display_name: group.name || "Group Chat",
        id: group._id?.toString() || `group_${group.group_id || Math.random()}`,
      }));

      const allChats = [...privateChats, ...groupChats];

      // Filter out current chat more reliably
      const filteredChats = allChats.filter((chat) => {
        const isCurrentChat =
          chat._id === validatedChatRef.current?._id?.toString() &&
          chat.type === validatedChatRef.current?.type;
        return !isCurrentChat;
      });

      setAvailableChats(filteredChats);

      if (filteredChats.length === 0) {
        console.warn("No chats available for forwarding");
      }
    } catch (error) {
      console.error("Error loading chats for forwarding:", error);
      errorToast("Failed to load available chats", "error");
    }
  };

  const openForwardDialog = useCallback((message) => {
    setSelectedMessage(message);
    loadAvailableChats();
    setShowForwardDialog(true);
  }, []);

  const handleSetSelectedForwardChat = useCallback((chat) => {
    // Use functional update to prevent re-renders
    setSelectedForwardChat((prev) => {
      if (prev?._id === chat._id && prev?.type === chat.type) {
        return prev; // Return same reference if no change
      }
      return chat;
    });
  }, []);

  const handleCloseForwardDialog = useCallback(() => {
    setShowForwardDialog(false);
    setSelectedMessage(null);
    setSelectedForwardChat(null);
  }, []);

  const handleForwardMessage = async () => {
    if (!selectedForwardChat || !selectedMessage) return;

    setForwarding(true);
    try {
      const forwardData = {
        message: selectedMessage.message,
        message_type: selectedMessage.message_type,
        is_forwarded: true,
        original_message_id: selectedMessage._id,
        original_sender_name: selectedMessage.sender
          ? `${selectedMessage.sender.first_name || ""} ${selectedMessage.sender.last_name || ""}`?.trim()
          : "Unknown User",
      };

      if (selectedMessage.message_type !== "text") {
        forwardData.file_name = selectedMessage.file_name;
        forwardData.file_url = selectedMessage.file_url;
        forwardData.file_type = selectedMessage.file_type;
        forwardData.file_size = selectedMessage.file_size;
      }

      let response;
      if (selectedForwardChat.type === "private") {
        response = await chatAPI.sendMessage(
          selectedForwardChat._id,
          forwardData,
        );
      } else {
        response = await groupAPI.sendGroupMessage(
          selectedForwardChat._id,
          forwardData,
        );
      }

      setShowForwardDialog(false);
      setSelectedMessage(null);
      setSelectedForwardChat(null);
      successToast("Message forwarded successfully", "success");

      if (
        selectedForwardChat._id === validatedChatRef.current?._id &&
        selectedForwardChat.type === validatedChatRef.current?.type
      ) {
        const forwardedMessage = {
          ...response.data,
          is_forwarded: true,
          original_sender_name: forwardData.original_sender_name,
        };
        setMessages((prev) => [...prev, forwardedMessage]);
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      errorToast("Failed to forward message", "error");
    } finally {
      setForwarding(false);
    }
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

    // Check if clicking the same message that's already open
    if (showMessageMenu === message._id) {
      closeMessageMenu();
      return;
    }

    // Get click position RELATIVE TO VIEWPORT (not document)
    const clickX = event.clientX;
    const clickY = event.clientY;

    // Simple positioning - menu appears at click position
    const menuPosition = {
      top: clickY, // Use clientY (viewport relative)
      left: clickX - 150, // Position to left of click
    };

    setSelectedMessage(message);
    setShowMessageMenu(message._id);
    //setMenuPosition(menuPosition);

    // Set a flag to indicate we're in edit mode
    if (editingMessage?._id === message._id) {
      // Don't close if we're editing this message
      return;
    }

    setTimeout(() => {
      const handleClickOutside = (e) => {
        // Don't close if clicking inside edit UI
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
      parseInt(message.sender_id) === parseInt(currentUserId);
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
        {message.message_type === "call" && (
          <CallHistoryMessage message={message} />
        )}
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
                e.stopPropagation(); // CRITICAL: Stop propagation
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
              onClick={() => openForwardDialog(message)}
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

  // Add this function in ChatWindow.js
  const scrollToMessage = (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const scrollToBottom = (instant = false) => {
    const container = messagesContainerRef.current;
    if (container) {
      if (instant) {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return "📎";
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType.startsWith("video/")) return "🎥";
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("word") || fileType.includes("document")) return "📝";
    if (fileType.includes("sheet") || fileType.includes("excel")) return "📊";
    if (fileType.includes("zip") || fileType.includes("rar")) return "📦";
    if (fileType.includes("audio")) return "🎵";
    return "📎";
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

  const handleImageLoad = (messageId) => {
    setLoadedImages((prev) => new Set(prev).add(messageId));
  };

  const handleImageClick = (imageUrl) => {
    window.open(imageUrl, "_blank");
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAllSelectedFiles = () => {
    setSelectedFiles([]);
  };

  const retryMessage = async (tempMessage) => {
    try {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempMessage.tempId
            ? { ...msg, isSending: true, failed: false }
            : msg,
        ),
      );

      let response;
      if (
        tempMessage.message_type === "file" ||
        tempMessage.message_type === "image"
      ) {
        errorToast("Please resend the file.", "error");
        return;
      }

      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.sendMessage(validatedChatRef.current._id, {
          message: tempMessage.message,
          message_type: tempMessage.message_type || "text",
        });
      } else {
        response = await groupAPI.sendGroupMessage(
          validatedChatRef.current._id,
          {
            message: tempMessage.message,
            message_type: tempMessage.message_type || "text",
          },
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempMessage.tempId
            ? { ...response.data, tempId: undefined }
            : msg,
        ),
      );
    } catch (error) {
      console.error("Failed to retry message:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempMessage.tempId
            ? { ...msg, isSending: false, failed: true }
            : msg,
        ),
      );
    }
  };

  // Sticker functionality
  const stickers = [
    // Smileys & Emotion
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
    "😘",
    "😗",
    "😙",
    "😚",
    "😋",
    "😛",
    "😝",
    "😜",
    "🤪",
    "🤨",
    "🧐",
    "🤓",
    "😎",
    "🤩",
    "🥳",
    "😏",
    "😒",
    "😞",
    "😔",
    "😟",
    "😕",
    "🙁",
    "☹️",
    "😣",
    "😖",
    "😫",
    "😩",
    "🥺",
    "😢",
    "😭",
    "😤",
    "😠",
    "😡",
    "🤬",
    "🤯",
    "😳",
    "🥵",
    "🥶",
    "😱",
    "😨",
    "😰",
    "😥",
    "😓",
    "🤗",
    "🤔",
    "🤭",
    "🤫",
    "🤥",
    "😶",
    "😐",
    "😑",
    "😬",
    "🙄",
    "😯",
    "😦",
    "😧",
    "😮",
    "😲",
    "🥱",
    "😴",
    "🤤",
    "😪",
    "😵",
    "🤐",
    "🥴",
    "🤢",
    "🤮",
    "🤧",
    "😷",
    "🤒",
    "🤕",
    "🤑",
    "🤠",
    "😈",
    "👿",
    "👹",
    "👺",
    "🤡",
    "💩",
    "👻",
    "💀",
    "☠️",
    "👽",
    "👾",
    "🤖",
    "🎃",
    "😺",
    "😸",
    "😹",
    "😻",
    "😼",
    "😽",
    "🙀",
    "😿",
    "😾",

    // Hands & Body
    "👋",
    "🤚",
    "🖐️",
    "✋",
    "🖖",
    "👌",
    "🤌",
    "🤏",
    "✌️",
    "🤞",
    "🤟",
    "🤘",
    "🤙",
    "👈",
    "👉",
    "👆",
    "🖕",
    "👇",
    "☝️",
    "👍",
    "👎",
    "👊",
    "✊",
    "🤛",
    "🤜",
    "👏",
    "🙌",
    "👐",
    "🤲",
    "🤝",
    "🙏",
    "✍️",
    "💅",
    "🤳",
    "💪",
    "🦾",
    "🦿",
    "🦵",
    "🦶",
    "👂",
    "🦻",
    "👃",
    "🧠",
    "🦷",
    "🦴",
    "👀",
    "👁️",
    "👅",
    "👄",
    "💋",
    "🩸",

    // Hearts & Symbols
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "🤎",
    "💔",
    "❤️‍🔥",
    "❤️‍🩹",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
    "💘",
    "💝",
    "💟",
    "☮️",
    "✝️",
    "☪️",
    "🕉️",
    "☸️",
    "✡️",
    "🔯",
    "🕎",
    "☯️",
    "☦️",
    "🛐",
    "⛎",
    "♈",
    "♉",
    "♊",
    "♋",
    "♌",
    "♍",
    "♎",
    "♏",
    "♐",
    "♑",
    "♒",
    "♓",
    "🆔",
    "⚛️",
    "🉑",
    "☢️",
    "☣️",
    "📴",
    "📳",
    "🈶",
    "🈚",
    "🈸",
    "🈺",
    "🈷️",
    "✴️",
    "🆚",
    "💮",
    "🉐",
    "㊙️",
    "㊗️",
    "🈴",
    "🈵",
    "🈹",
    "🈲",
    "🅰️",
    "🅱️",
    "🆎",
    "🆑",
    "🅾️",
    "🆘",
    "",
    "⭕",
    "🛑",
    "⛔",
    "📛",
    "🚫",
    "💯",
    "💢",
    "♨️",
    "🚷",
    "🚯",
    "🚳",
    "🚱",
    "🔞",
    "📵",
    "🚭",

    // Animals & Nature
    "🐶",
    "🐺",
    "🐱",
    "🐭",
    "🐹",
    "🐰",
    "🐸",
    "🐯",
    "🐨",
    "🐻",
    "🐷",
    "🐽",
    "🐮",
    "🐗",
    "🐵",
    "🐒",
    "🐴",
    "🐑",
    "🐘",
    "🐼",
    "🐧",
    "🐦",
    "🐤",
    "🐥",
    "🐣",
    "🐔",
    "🐍",
    "🐢",
    "🐛",
    "🐝",
    "🐜",
    "🐞",
    "🐌",
    "🐙",
    "🐚",
    "🐠",
    "🐟",
    "🐬",
    "🐳",
    "🐎",
    "🐲",
    "🐡",
    "🐫",
    "🐩",
    "🐾",
    "💐",
    "🌸",
    "🌷",
    "🍀",
    "🌹",
    "🌻",
    "🌺",
    "🍁",
    "🍃",
    "🍂",
    "🌿",
    "🌾",
    "🍄",
    "🌵",
    "🌴",
    "🌰",
    "🌱",
    "🌼",
    "🌑",
    "🌓",
    "🌔",
    "🌕",
    "🌛",
    "🌙",
    "🌏",
    "🌋",
    "🌌",
    "🌠",
    "⛅",
    "⛄",
    "🌀",
    "🌁",
    "🌈",
    "🌊",

    // Food & Drink
    "🍵",
    "🍶",
    "🍺",
    "🍻",
    "🍸",
    "🍹",
    "🍷",
    "🍴",
    "🍕",
    "🍔",
    "🍟",
    "🍗",
    "🍖",
    "🍝",
    "🍛",
    "🍤",
    "🍱",
    "🍣",
    "🍥",
    "🍙",
    "🍘",
    "🍚",
    "🍜",
    "🍲",
    "🍢",
    "🍡",
    "🍳",
    "🍞",
    "🍩",
    "🍮",
    "🍦",
    "🍨",
    "🍧",
    "🎂",
    "🍰",
    "🍪",
    "🍫",
    "🍬",
    "🍭",
    "🍯",
    "🍎",
    "🍏",
    "🍊",
    "🍒",
    "🍇",
    "🍉",
    "🍓",
    "🍑",
    "🍈",
    "🍌",
    "🍍",
    "🍠",
    "🍆",
    "🍅",
    "🌽",

    // Objects
    "🎍",
    "🎎",
    "🎒",
    "🎓",
    "🎏",
    "🎆",
    "🎇",
    "🎐",
    "🎑",
    "🎃",
    "🎄",
    "🎁",
    "🎋",
    "🎉",
    "🎊",
    "🎈",
    "🎌",
    "🔮",
    "🎥",
    "📷",
    "📹",
    "📼",
    "💿",
    "📀",
    "💽",
    "💾",
    "💻",
    "📱",
    "📞",
    "📟",
    "📠",
    "📡",
    "📺",
    "📻",
    "🔊",
    "🔔",
    "📢",
    "📣",
    "⏳",
    "⌛",
    "⏰",
    "⌚",
    "🔓",
    "🔒",
    "🔏",
    "🔐",
    "🔑",
    "🔎",
    "💡",
    "🔦",
    "🔌",
    "🔋",
    "🔍",
    "🛀",
    "🚽",
    "🔧",
    "🔩",
    "🔨",
    "🚪",
    "🚬",
    "💣",
    "🔫",
    "🔪",
    "💊",
    "💉",
    "💰",
    "💴",
    "💵",
    "💳",
    "💸",
    "📲",
    "📧",
    "📥",
    "📤",
    "📩",
    "📨",
    "📫",
    "📪",
    "📮",
    "📦",
    "📝",
    "📄",
    "📃",
    "📑",
    "📊",
    "📈",
    "📉",
    "📜",
    "📋",
    "📅",
    "📆",
    "📇",
    "📁",
    "📂",
    "📌",
    "📎",
    "📏",
    "📐",
    "📕",
    "📗",
    "📘",
    "📙",
    "📓",
    "📔",
    "📒",
    "📚",
    "📖",
    "🔖",
    "📰",
    "🎨",
    "🎬",
    "🎤",
    "🎧",
    "🎼",
    "🎵",
    "🎶",
    "🎹",
    "🎻",
    "🎺",
    "🎷",
    "🎸",
    "👾",
    "🎮",
    "🃏",
    "🎴",
    "🀄",
    "🎲",
    "🎯",
    "🏈",
    "🏀",
    "⚽",
    "⚾",
    "🎾",
    "🎱",
    "🎳",
    "⛳",
    "🏁",
    "🏆",
    "🎿",
    "🏂",
    "🏊",
    "🏄",
    "🎣",

    // Travel & Places
    "🏠",
    "🏡",
    "🏫",
    "🏢",
    "🏣",
    "🏥",
    "🏦",
    "🏪",
    "🏩",
    "🏨",
    "💒",
    "⛪",
    "🏬",
    "🌇",
    "🌆",
    "🏯",
    "🏰",
    "⛺",
    "🏭",
    "🗼",
    "🗾",
    "🗻",
    "🌄",
    "🌅",
    "🌃",
    "🗽",
    "🌉",
    "🎠",
    "🎡",
    "⛲",
    "🎢",
    "🚢",
    "⛵",
    "🚤",
    "🚀",
    "💺",
    "🚉",
    "🚄",
    "🚅",
    "🚇",
    "🚃",
    "🚌",
    "🚙",
    "🚗",
    "🚕",
    "🚚",
    "🚨",
    "🚓",
    "🚒",
    "🚑",
    "🚲",
    "💈",
    "🚏",
    "🎫",
    "🚥",
    "🚧",
    "🔰",
    "⛽",
    "🏮",
    "🎰",
    "🗿",
    "🎪",
    "🎭",
    "📍",
    "🚩",

    // Geometry
    "✔️",
    "✖️",
    "➕",
    "➖",
    "➗",
    "💲",
    "💱",
    "©️",
    "®️",
    "™️",
    "🔘",
    "⚪",
    "⚫",
    "🔴",
    "🔵",
    "🔸",
    "🔹",
    "🔶",
    "🔷",
    "🔺",
    "🔻",
    "🔼",
    "🔽",
    "◾",
    "◽",
    "⬛",
    "⬜",
    "◼️",
    "◻️",
    "▪️",
    "▫️",
    "🔳",
    "🔲",
  ];

  const addStickerToMessage = (sticker) => {
    setNewMessage((prev) => prev + sticker);
    setShowStickerMenu(false);
  };

  const startVoiceCall = () => startCall(false);
  const startVideoCall = () => startCall(true);

  const startCall = async (isVideoCall = false) => {
    if (!validatedChatRef.current || !socket || !isConnected) {
      errorToast("Cannot start call. Please check your connection.", "error");
      return;
    }

    try {
      const callType = isVideoCall ? "video" : "voice";
      const chatType = validatedChatRef.current.type;

      // Play outgoing ringtone immediately when starting a call
      ringtoneService.play("outgoing");

      // DON'T generate call ID here - let backend do it
      let callData;
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      if (chatType === "private") {
        const receiverId = getReceiverId();

        if (!receiverId) {
          errorToast("Cannot start call. User not found.", "error");
          return;
        }

        callData = {
          callId,
          type: callType,
          callerId: currentUserId,
          callerName: currentUser.name || "You",
          targetUserId: receiverId,
          targetUserName:
            validatedChatRef.current.other_user?.first_name || "User",
          chatId: validatedChatRef.current._id,
          chatType: "private",
        };

        // Use API to initiate private call
        const response = await callAPI.initiateCall({
          targetUserId: receiverId,
          call_type: callType,
          chat_id: validatedChatRef.current._id,
        });

        if (response.data.success) {
          setActiveCall(response.data.callData);
        } else {
          throw new Error("Failed to start call");
        }
      } else if (chatType === "group") {
        // Group call logic
        const groupId = validatedChatRef.current._id;

        // Use API to initiate group call - backend will generate call ID
        const response = await callAPI.initiateGroupCall({
          group_id: groupId,
          call_type: callType,
          chat_id: validatedChatRef.current._id,
        });

        if (response.data.success) {
          // Use the callData returned from server
          const serverCallData = response.data.callData;

          // Set active call with server's data
          setActiveCall(serverCallData);

          socket.emit(`group_${callType}_call_initiate`, {
            callId: serverCallData.callId, // Use server's callId
            groupId: serverCallData.groupId,
            callerId: serverCallData.callerId,
            callerName: serverCallData.callerName,
            groupName: serverCallData.groupName,
            type: serverCallData.type,
            chatType: "group",
          });

          // Add group call started message
          addCallMessage(serverCallData, "started");
        } else {
          throw new Error("Failed to start group call");
        }
      }
    } catch (error) {
      console.error("Error starting call:", error);
      errorToast("Failed to start call", "error");
      setActiveCall(null);
      ringtoneService.stop(); // Stop ringtone on error
    }
  };

  const endCall = async () => {
    try {
      // Stop ringtone
      ringtoneService.stop();

      if (activeCall) {
        // Use API to end call
        await callAPI.endCall(activeCall.callId, {
          chat_id: validatedChatRef.current._id,
        });

        // Notify parent dashboard about call ending
        if (props.onStartCall) {
          props.onStartCall(null); // Clear the call in parent
        }

        setActiveCall(null);

        // Stop ringtone
        ringtoneService.stop();
      }

      if (incomingCall) {
        // Use API to reject incoming call
        await callAPI.rejectCall(incomingCall.callId, {
          chat_id: validatedChatRef.current._id,
        });

        setIncomingCall(null);

        // Stop ringtone
        ringtoneService.stop();
      }

      // Add call ended message to chat
      if (validatedChatRef.current && (activeCall || incomingCall)) {
        const endedCall = activeCall || incomingCall;
        addCallMessage(endedCall, "ended", 0);
      }
    } catch (error) {
      console.error(" Error ending call in ChatWindow:", error);
      // Force cleanup
      setActiveCall(null);
      setIncomingCall(null);

      // Stop ringtone
      ringtoneService.stop();
    }
  };

  // Also, update the acceptCall function to properly sync with parent:
  const acceptCall = async () => {
    if (incomingCall) {
      try {
        ringtoneService.stop();

        // Use API to accept call
        const response = await callAPI.acceptCall(incomingCall.callId, {
          chat_id: validatedChatRef.current._id,
        });

        if (response.data.success) {
          // Notify parent dashboard about accepting call
          if (props.onStartCall) {
            props.onStartCall(incomingCall); // Set active call in parent
          }

          setActiveCall(incomingCall);
          setIncomingCall(null);

          // Stop ringtone
          ringtoneService.stop();
        } else {
          throw new Error("Failed to accept call");
        }
      } catch (error) {
        console.error("Error accepting call in ChatWindow:", error);
        errorToast("Failed to accept call", "error");
        setIncomingCall(null);

        // Stop ringtone
        ringtoneService.stop();
      }
    }
  };

  // Enhanced reject call function
  const rejectCall = () => {
    if (incomingCall) {
      try {
        // Use API to reject call
        callAPI
          .rejectCall(incomingCall.callId, {
            chat_id: validatedChatRef.current._id,
          })
          .catch(console.error);

        setIncomingCall(null);
        // Stop ringtone
        ringtoneService.stop();
      } catch (error) {
        console.error("Error rejecting call:", error);
        setIncomingCall(null);
        // Stop ringtone
        ringtoneService.stop();
      }
    }
  };

  useEffect(() => {
    // Listen for call state updates from parent dashboard
    if (props.activeCallFromParent !== undefined) {
      if (!props.activeCallFromParent) {
        // Parent cleared the call, so we should too
        if (activeCall || incomingCall) {
          setActiveCall(null);
          setIncomingCall(null);

          // Stop ringtone
          ringtoneService.stop();

          // Add call ended message
          if (validatedChatRef.current) {
            addCallMessage(activeCall || incomingCall, "ended", 0);
          }
        }
      }
    }
  }, [props.activeCallFromParent]);

  // Add call status listener
  useEffect(() => {
    if (!socket) return;

    const handleCallEnded = (data) => {
      // Cleanup both active and incoming calls
      if (activeCall && activeCall.callId === data.callId) {
        setActiveCall(null);
      }

      if (incomingCall && incomingCall.callId === data.callId) {
        setIncomingCall(null);
      }
    };

    const handleGroupCallEnded = (data) => {
      // Clear local call states
      if (
        activeCall?.callId === data.callId ||
        incomingCall?.callId === data.callId
      ) {
        setActiveCall(null);
        setIncomingCall(null);
      }

      // Notify parent if needed
      if (props.onStartCall) {
        props.onStartCall(null);
      }

      // Add call ended message
      if (validatedChatRef.current) {
        addCallMessage(data, "ended", 0);
      }
    };

    socket.on("voice_call_ended", handleCallEnded);
    socket.on("video_call_ended", handleCallEnded);
    socket.on("group_voice_call_ended", handleGroupCallEnded);
    socket.on("group_video_call_ended", handleGroupCallEnded);

    return () => {
      socket.off("voice_call_ended", handleCallEnded);
      socket.off("video_call_ended", handleCallEnded);
      socket.off("group_voice_call_ended", handleGroupCallEnded);
      socket.off("group_video_call_ended", handleGroupCallEnded);
    };
  }, [socket, activeCall, incomingCall]);

  // Add this function to handle call ended messages
  const addCallMessage = (callData, callStatus, duration = 0) => {
    if (!validatedChatRef.current) return;

    const callMessage = {
      id: `call_${Date.now()}`,
      message_type: "call",
      call_type: callData.type || "voice",
      call_status: callStatus,
      call_duration: duration,
      sender_id: currentUserId,
      created_at: new Date().toISOString(),
      is_call: true,
      // Add group info for group calls
      ...(callData.chatType === "group" && {
        group_id: callData.groupId,
        group_name: callData.groupName,
      }),
    };

    setMessages((prev) => [...prev, callMessage]);
  };

  const startRecording = async () => {
    try {
      // Try to get a more compatible audio format
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Try different MIME types in order of compatibility
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/mp4;codecs=mp4a",
        "audio/webm",
        "audio/mpeg",
        "",
      ];

      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        setAudioBlob(audioBlob);

        // Clean up
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);

      if (error.name === "NotAllowedError") {
        errorToast(
          "Microphone access was denied. Please allow microphone access to record voice messages.",
          "error",
        );
      } else if (error.name === "NotFoundError") {
        errorToast(
          "No microphone found. Please check your audio devices.",
          "error",
        );
      } else {
        errorToast("Failed to access microphone", "error");
      }
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
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowVoiceRecorder(false);
      clearInterval(recordingIntervalRef.current);
      setAudioBlob(null);

      // Clean up stream
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
    }
  };

  const sendVoiceMessage = async (audioBlob, duration) => {
    if (!audioBlob || !validatedChatRef.current || !currentUserId) return;

    setUploading(true);

    // Define tempId here so it's available in the catch block
    let tempId;

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, `voice_message_${Date.now()}.webm`);
      formData.append("message_type", "audio");
      formData.append("duration", duration.toString());

      let response;

      // Create temp message
      tempId = `temp_audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tempAudioMessage = {
        tempId: tempId,
        message: "Voice message",
        sender_id: currentUserId,
        message_type: "audio",
        file_name: `voice_message_${Date.now()}.webm`,
        file_url: URL.createObjectURL(audioBlob),
        duration: duration,
        created_at: new Date().toISOString(),
        isSending: true,
        sender: {
          id: currentUserId,
          first_name: "You",
          last_name: "",
        },
      };

      // Add temp audio message immediately
      setMessages((prev) => [...prev, tempAudioMessage]);

      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.sendFileMessage(
          validatedChatRef.current._id,
          formData,
        );

        const realMessage = {
          ...response.data,
          duration: duration,
          message_type: "audio",
        };

        const transformedMessage = transformFileMessageForDisplay(realMessage);

        // Replace temp with real message
        setMessages((prev) =>
          prev.map((msg) => (msg.tempId === tempId ? transformedMessage : msg)),
        );

        // Private chat: emit to receiver
        const receiverId = getReceiverId();
        if (receiverId && socket) {
          socket.emit("audio_message", {
            ...transformedMessage,
            skip_self: true,
          });
        }
      } else {
        // GROUP CHAT
        response = await groupAPI.sendGroupFileMessage(
          validatedChatRef.current._id,
          formData,
        );

        const realMessage = {
          ...response.data,
          duration: duration,
          message_type: "audio",
        };

        const transformedMessage = transformFileMessageForDisplay(realMessage);

        // Replace temp with real message
        setMessages((prev) =>
          prev.map((msg) => (msg.tempId === tempId ? transformedMessage : msg)),
        );
      }

      setShowVoiceRecorder(false);
      setAudioBlob(null);
      setRecordingTime(0);

      //successToast('Voice message sent', 'success');

      // Update sidebar
      const finalMessage = transformFileMessageForDisplay(
        response.data || realMessage,
      );
      updateSidebarOnMessageSend(finalMessage, validatedChatRef.current.type);
    } catch (error) {
      console.error(" Error sending voice message:", error);
      console.error(" Error details:", error.response?.data || error.message);

      // Mark temp message as failed - FIXED: tempId is now defined
      if (tempId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === tempId
              ? { ...msg, isSending: false, failed: true }
              : msg,
          ),
        );
      }

      // Show more detailed error
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.details ||
        "Failed to send voice message";
      errorToast(errorMsg, "error");
    } finally {
      setUploading(false);
    }
  };

  // Preload audio messages for better performance
  const preloadAudioMessage = async (message) => {
    if (message.message_type === "audio" && message.file_url) {
      try {
        const audio = new Audio();
        audio.src = message.file_url;
        audio.preload = "metadata";

        audio.onloadedmetadata = () => {
          console.log("Audio preloaded:", message._id);
        };
      } catch (error) {
        console.error("Error preloading audio:", error);
      }
    }
  };

  // In the handleRichTextSend function, ensure proper data structure:
  const handleRichTextSend = async (
    richTextContent,
    messageType = "rich_text",
  ) => {
    if (!richTextContent?.trim()) return;

    try {
      setSending(true);

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

      // Ensure the message is properly transformed
      const transformedMessage = transformFileMessageForDisplay({
        ...response.data,
        message_type: "rich_text", // Force rich_text type
      });

      if (validatedChatRef.current.type === "private") {
        setMessages((prev) => [...prev, transformedMessage]);
      }

      setShowTextEditor(false);
      setRichText("");

      //   successToast('Message sent', 'success');

      // Update sidebar
      updateSidebarOnMessageSend(
        transformedMessage,
        validatedChatRef.current.type,
      );
    } catch (error) {
      console.error("Error sending rich text message:", error);
      errorToast("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    // Set the selected suggestion as the new message
    setNewMessage(suggestion);

    // Auto-focus the input field
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) {
        input.focus();
        // Move cursor to end of text
        input.setSelectionRange(suggestion.length, suggestion.length);
      }
    }, 100);
  };

  const SearchResultsNavigator = () => {
    if (!isSearchingMode || searchResults.length === 0) return null;

    return (
      <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 px-4 py-2">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            {currentSearchIndex + 1} of {searchResults.length} matches
          </span>
          <div className="flex gap-2">
            <button
              onClick={handlePrevSearchResult}
              className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              disabled={searchResults.length <= 1}
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={handleNextSearchResult}
              className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              disabled={searchResults.length <= 1}
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            <button
              onClick={handleClearSearch}
              className="p-2 rounded-full hover:bg-gray-100 cursor-pointer"
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
      </div>
    );
  };

  if (!validatedChatRef.current) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Chat Selected
          </h3>
          <p className="text-gray-500">
            Select a chat from the sidebar to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-white">
      {/* Chat Header */}
      <ChatHeader
        chat={validatedChatRef.current}
        isConnected={isConnected}
        isTyping={isTyping}
        typingUser={typingUser}
        currentUserId={currentUserId}
        onSelectChat={onSelectChat}
        setShowSearch={setShowSearch}
        startVoiceCall={startVoiceCall}
        startVideoCall={startVideoCall}
        setShowGroupManager={setShowGroupManager}
        activeCall={activeCall}
        incomingCall={incomingCall}
        socket={socket}
        endCall={endCall}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
        onProfileClick={handleChatHeaderProfileClick}
      />

      <SemanticSearchBar
        showSearch={showSearch}
        searchQuery={searchQuery}
        searchResults={searchResults}
        currentSearchIndex={currentSearchIndex}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onNextResult={handleNextSearchResult}
        onPrevResult={handlePrevSearchResult}
        onSemanticSearch={handleSemanticSearch}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        isSearching={isSemanticSearching}
        chat={validatedChatRef.current}
        setIsSearchingMode={setIsSearchingMode}
        onSearchComplete={handleSearchComplete}
        chatAPI={chatAPI}
        groupAPI={groupAPI}
        currentUserId={currentUserId}
        isSearchingMode={isSearchingMode}
      />

      {/* Messages Area */}
      <MessageList
        messages={messages}
        loading={loading}
        validatedChat={validatedChatRef.current}
        currentUserId={currentUserId}
        highlightedMessageId={highlightedMessageId}
        editingMessage={editingMessage}
        editText={editText}
        searchQuery={searchQuery}
        wallpaper={wallpaper}
        loadedImages={loadedImages}
        showMessageMenu={showMessageMenu}
        menuPosition={menuPosition}
        selectedMessage={selectedMessage}
        onEditMessage={(message, text) => {
          // This should update the editText state
          setEditText(text);
        }}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onMessageMenu={handleMessageMenu}
        onRetryMessage={retryMessage}
        onImageLoad={handleImageLoad}
        onImageClick={handleImageClick}
        onDownload={handleDownload}
        formatTime={formatTime}
        formatFileSize={formatFileSize}
        getFileIcon={getFileIcon}
        messagesEndRef={messagesEndRef}
        renderMessageMenu={renderMessageMenu}
        onSuggestionSelect={handleSuggestionSelect}
        hasMoreMessages={hasMoreMessages}
        isLoadingMore={isLoadingMore}
        messagesContainerRef={messagesContainerRef}
        onLoadOlderMessages={loadOlderMessages}
        searchResults={searchResults}
        isSearchingMode={isSearchingMode}
        validatedChatRef={validatedChatRef}
        groupMembers={groupMembers}
        setSelectedUserForProfile={setSelectedUserForProfile}
        setShowUserProfile={setShowUserProfile}
        handleOpenUserProfile={handleOpenUserProfile}
      />

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
        conversationContext={conversationContext}
        typingPredictionsEnabled={aiSettings.typingPredictions}
        // Add mention props
        mentionedUsers={mentionedUsers}
        onRemoveMention={handleRemoveMention}
        showMentionSuggestions={showMentionSuggestions}
        mentionSuggestions={mentionSuggestions}
        selectedMentionIndex={selectedMentionIndex}
        onMentionSelect={handleMentionSelect}
        isLoadingMembers={isLoadingMembers}
        mentionPosition={mentionPosition}
        removeAllSelectedFiles={removeAllSelectedFiles}
        handleInputChange={handleInputChange}
        chatType={validatedChatRef.current?.type}
      />

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
      <RichTextEditor
        showTextEditor={showTextEditor}
        richText={richText}
        onSetShowTextEditor={setShowTextEditor}
        onSetRichText={setRichText}
        onSendRichText={handleRichTextSend}
        sending={sending}
      />

      {/* Reply Preview */}
      <ReplyPreview
        replyToMessage={replyToMessage}
        currentUserId={currentUserId}
        onCancelReply={handleCancelReply}
      />

      {/* Selected Files Preview */}
      <SelectedFilesPreview
        selectedFiles={selectedFiles}
        onRemoveFile={removeSelectedFile}
        onRemoveAllFiles={removeAllSelectedFiles}
      />

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

      <MemoizedForwardDialog
        showForwardDialog={showForwardDialog}
        selectedMessage={selectedMessage}
        selectedForwardChat={selectedForwardChat}
        availableChats={availableChats}
        forwarding={forwarding}
        onClose={handleCloseForwardDialog}
        onSetSelectedForwardChat={handleSetSelectedForwardChat}
        onForward={handleForwardMessage}
        onMessageMenu={closeMessageMenu}
      />

      <ModerationWarning
        show={showModerationWarning}
        reasons={moderationWarningData?.reasons || []}
        warningLevel={moderationWarningData?.warningLevel}
        messageContent={moderationWarningData?.messageContent}
        onConfirmSend={handleModerationConfirm}
        onCancel={handleModerationCancel}
      />

      <SearchResultsNavigator />

      {/* Group Manager Modal */}
      {showGroupManager && (
        <div className="fixed inset-0 bg-white bg-opacity-10 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full border border-gray-200">
            <GroupManager
              group={validatedChatRef.current}
              onClose={() => setShowGroupManager(false)}
              onGroupUpdate={(updatedGroup) => {
                validatedChatRef.current = updatedGroup;
                successToast("Group updated successfully", "success");
              }}
            />
          </div>
        </div>
      )}

      {showScrollToBottom && (
        <button
          onClick={() => scrollToBottom()}
          className="fixed bottom-24 right-6 bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-10 cursor-pointer"
          title="Scroll to bottom"
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
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      )}

      {isSearchingMode && (
        <div className="bg-yellow-50 border-b border-yellow-200 py-2 px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-yellow-800">
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
            <span>
              Search Mode Active - Showing {searchResults.length} results
            </span>
            <button
              onClick={handleClearSearch}
              className="ml-4 text-xs bg-yellow-100 hover:bg-yellow-200 px-2 py-1 rounded cursor-pointer"
            >
              Exit Search
            </button>
          </div>
        </div>
      )}

      {showUserProfile && selectedUserForProfile && (
        <UserProfileModal
          userId={selectedUserForProfile.userId}
          chatData={validatedChatRef.current}
          isOpen={showUserProfile}
          onClose={() => {
            setShowUserProfile(false);
            setSelectedUserForProfile(null);
          }}
          onStartChat={(chatData) => {
            setTimeout(() => {
              scrollToBottom();
            }, 100);
          }}
        />
      )}
    </div>
  );
}
