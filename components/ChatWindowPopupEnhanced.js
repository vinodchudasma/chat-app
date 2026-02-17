"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useAuth } from "@clerk/nextjs";
import { chatAPI, groupAPI, callAPI } from "../lib/api";
import { successToast, errorToast } from "./toast";
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
import VoiceCall from "./VoiceCall";
import VideoCall from "./VideoCall";
import GroupCall from "./GroupCall";

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
  console.log(chat, "message");

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

  console.log(validatedChatRef.current._id, " validatedChatRef.current._id");

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
      console.log("--------------4");

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

  // Call functions
  const startVoiceCall = async () => {
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
        await callAPI.endCall(activeCall.callId);
        setActiveCall(null);
      }

      if (incomingCall) {
        await callAPI.rejectCall(incomingCall.callId);
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
    if (
      (!newMessage?.trim() && selectedFiles.length === 0) ||
      !isConnected ||
      !validatedChatRef.current
    )
      return;

    if (selectedFiles.length > 0) {
      await sendFileMessages(selectedFiles);
    } else if (newMessage?.trim()) {
      await sendTextMessage(newMessage?.trim());
    }
  };

  const sendTextMessage = async (messageText) => {
    if (!currentUserId || !validatedChatRef.current) return;

    setSending(true);
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tempMessage = {
      tempId: tempId,
      message: messageText,
      sender_id: currentUserId,
      message_type: "text",
      created_at: new Date().toISOString(),
      isSending: true,
      sender: { id: currentUserId, first_name: "You", last_name: "" },
      reply_to: replyToMessage
        ? {
            id: replyToMessage._id,
            message: replyToMessage.message,
            message_type: replyToMessage.message_type,
            sender_id: replyToMessage.sender_id,
            sender: replyToMessage.sender,
          }
        : null,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    const currentReplyToMessage = replyToMessage;
    setReplyToMessage(null);
    stopTyping();

    try {
      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.sendMessage(validatedChatRef.current._id, {
          message: messageText,
          message_type: "text",
          reply_to_message_id: currentReplyToMessage?._id,
        });
      } else {
        response = await groupAPI.sendGroupMessage(
          validatedChatRef.current._id,
          {
            message: messageText,
            message_type: "text",
            reply_to_message_id: currentReplyToMessage?._id,
          },
        );
      }

      setMessages((prev) =>
        prev.map((msg) => (msg.tempId === tempId ? response.data : msg)),
      );
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

  const sendFileMessages = async (files) => {
    if (!currentUserId || !validatedChatRef.current) return;

    setUploading(true);

    const tempMessages = files.map((file) => ({
      tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: getFileMessageText({
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
      sender: { id: currentUserId, first_name: "You", last_name: "" },
      reply_to: replyToMessage,
    }));

    if (validatedChatRef.current.type === "private") {
      // setMessages((prev) => [...prev, tempMessage]);
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
        if (replyToMessage?._id)
          formData.append("reply_to_message_id", replyToMessage._id);

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

        const transformedMessage = transformFileMessageForDisplay(
          response.data,
        );
        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === tempMessage.tempId
              ? { ...transformedMessage, tempId: undefined }
              : msg,
          ),
        );
      }

      setSelectedFiles([]);
    } catch (error) {
      console.error("Error sending files:", error);
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
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (validatedChatRef.current?.type === "private" && socket) {
      const receiverId = getReceiverId();
      if (receiverId) socket.emit("typing_start", { receiver_id: receiverId });
    } else if (validatedChatRef.current?.type === "group" && socket) {
      socket.emit("typing_start", { group_id: validatedChatRef.current._id });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => stopTyping(), 1000);
  };

  const stopTyping = () => {
    if (validatedChatRef.current?.type === "private" && socket) {
      const receiverId = getReceiverId();
      if (receiverId) socket.emit("typing_stop", { receiver_id: receiverId });
    } else if (validatedChatRef.current?.type === "group" && socket) {
      socket.emit("typing_stop", { group_id: validatedChatRef.current._id });
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
    setSearchQuery("");
    setSearchResults([]);
    setCurrentSearchIndex(-1);
    setHighlightedMessageId(null);
    setIsSearchingMode(false);
    scrollToBottom();
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
        setMessages((prev) => [...prev, transformedMessage]);
        // setMessages((prev) => [...prev, tempMessage]);
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
      // setMessages((prev) => [...prev, tempMessage]);
      setMessages((prev) => [...prev, tempMessage]);
    }

    try {
      let response;
      if (validatedChatRef.current.type === "private") {
        response = await chatAPI.sendMessage(validatedChatRef.current.id, {
          message: JSON.stringify({
            content: codeSnippet.trim(),
            language: snippetLanguage,
          }),
          message_type: "code",
        });
      } else {
        response = await groupAPI.sendGroupMessage(
          validatedChatRef.current.id,
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
                  <span className="w-1 h-1 bg-blue-200 rounded-full"></span>
                  <span className="w-1 h-1 bg-blue-200 rounded-full"></span>
                  <span className="w-1 h-1 bg-blue-200 rounded-full"></span>
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
          {/* Conversation Summary */}
          <button
            onClick={() => setShowConversationSummary(!showConversationSummary)}
            className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
            title="Conversation Summary"
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
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

          {/* Expand to main window */}
          {onOpenInMainWindow && (
            <button
              onClick={() => onOpenInMainWindow(chat)}
              className="p-1.5 hover:bg-white/20 rounded transition-colors cursor-pointer"
              title="Open in main window"
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
                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
                />
              </svg>
            </button>
          )}

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
                onSearchComplete={(results, allMessages) => {
                  setSearchResults(results);
                  setAllMessagesForSearch(allMessages);
                }}
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
            />
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
    </div>
  );
};

export default ChatWindowPopup;
