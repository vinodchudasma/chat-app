// components/PopupChat.js
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { chatAPI, groupAPI } from "../lib/api";
import { successToast, errorToast } from "./toast";
import LoadingSpinner from "./LoadingSpinner";
import ChatHeader from "./chatWindow/ChatHeader";
import MessageList from "./chatWindow/MessageList";
import MessageInput from "./chatWindow/MessageInput";

export default function PopupChat({
  chat,
  socket,
  currentUserId,
  onClose,
  onOpenFullChat,
  position = { x: 100, y: 100 },
  initialSize = { width: 380, height: 500 },
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [popupPosition, setPopupPosition] = useState(position);
  const [popupSize, setPopupSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const popupRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!chat) return;

    try {
      setLoading(true);
      let response;

      if (chat.type === "private") {
        response = await chatAPI.getChatMessages(chat._id, 20, 0);
      } else {
        response = await groupAPI.getGroupMessages(chat._id, 20, 0);
      }

      const apiMessages = response.data.messages || [];
      const transformedMessages = apiMessages.map(transformMessageForDisplay);

      // Sort by timestamp (oldest first)
      setMessages(
        transformedMessages.sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at),
        ),
      );

      // Mark as read
      await markMessagesAsRead();
    } catch (error) {
      console.error("Error loading messages:", error);
      errorToast("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [chat]);

  // Transform message for display
  const transformMessageForDisplay = (message) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    if (["image", "video", "file", "audio"].includes(message.message_type)) {
      let fileUrl = null;

      if (message.file_url && message.file_url.startsWith("http")) {
        fileUrl = message.file_url;
      } else if (message.file_path) {
        fileUrl = `${baseUrl}/uploads/chat_files/${message.file_path.replace(/^uploads[\\/]/, "")}`;
      } else if (message.file_name) {
        fileUrl = `${baseUrl}/uploads/chat_files/${message.file_name}`;
      }

      return {
        ...message,
        id: message._id || message.message_id,
        file_url: fileUrl,
        _transformed: true,
      };
    }

    return {
      ...message,
      id: message._id || message.message_id,
      _transformed: true,
    };
  };

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!chat || !currentUserId) return;

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

      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Initial load
  useEffect(() => {
    if (chat) {
      loadMessages();
      markMessagesAsRead();
    }
  }, [chat, currentUserId, loadMessages]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !chat) return;

    const handleNewMessage = (message) => {
      const isForThisChat =
        chat.type === "private"
          ? message.chat_id === chat._id
          : message.group_id === chat._id;

      if (!isForThisChat) return;

      if (parseInt(message.sender_id) === parseInt(currentUserId)) return;

      const transformedMessage = transformMessageForDisplay(message);
      setMessages((prev) => [...prev, transformedMessage]);
      setUnreadCount((prev) => prev + 1);

      // Auto-scroll to bottom
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    };

    const handleTyping = (data) => {
      if (data.user_id !== currentUserId) {
        setTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 3000);
      }
    };

    socket.on("private_message", handleNewMessage);
    socket.on("group_message", handleNewMessage);
    socket.on("group_audio_message", handleNewMessage);
    socket.on("user_typing", handleTyping);

    return () => {
      socket.off("private_message", handleNewMessage);
      socket.off("group_message", handleNewMessage);
      socket.on("group_audio_message", handleNewMessage);
      socket.off("user_typing", handleTyping);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, chat, currentUserId]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chat) return;

    setSending(true);
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tempMessage = {
      tempId,
      message: newMessage.trim(),
      sender_id: currentUserId,
      message_type: "text",
      created_at: new Date().toISOString(),
      isSending: true,
      sender: {
        id: currentUserId,
        first_name: "You",
        last_name: "",
      },
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    try {
      let response;

      if (chat.type === "private") {
        response = await chatAPI.sendMessage(chat._id, {
          message: newMessage.trim(),
          message_type: "text",
        });
      } else {
        response = await groupAPI.sendGroupMessage(chat._id, {
          message: newMessage.trim(),
          message_type: "text",
        });
      }

      // Replace temp message with real one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId ? { ...response.data, isSending: false } : msg,
        ),
      );

      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId
            ? { ...msg, isSending: false, failed: true }
            : msg,
        ),
      );
      errorToast("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Drag functionality
  const handleMouseDown = (e) => {
    if (e.target.closest(".no-drag, input, textarea, button, a")) return;

    setIsDragging(true);
    const rect = popupRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = useCallback(
    (e) => {
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
    },
    [isDragging, dragOffset],
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Resize functionality
  const handleResizeMouseDown = (direction, e) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: popupSize.width,
      height: popupSize.height,
    };
  };

  const handleResizeMouseMove = useCallback(
    (e) => {
      if (!isResizing) return;

      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;

      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      // Apply resize based on direction
      switch (resizeDirection) {
        case "right":
          newWidth = Math.max(
            300,
            Math.min(800, resizeStartRef.current.width + deltaX),
          );
          break;
        case "bottom":
          newHeight = Math.max(
            300,
            Math.min(800, resizeStartRef.current.height + deltaY),
          );
          break;
        case "bottom-right":
          newWidth = Math.max(
            300,
            Math.min(800, resizeStartRef.current.width + deltaX),
          );
          newHeight = Math.max(
            300,
            Math.min(800, resizeStartRef.current.height + deltaY),
          );
          break;
        default:
          break;
      }

      setPopupSize({ width: newWidth, height: newHeight });
    },
    [isResizing, resizeDirection],
  );

  const handleResizeMouseUp = () => {
    setIsResizing(false);
    setResizeDirection(null);
  };

  // Add/remove global event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener(
        "mousemove",
        isDragging ? handleMouseMove : handleResizeMouseMove,
      );
      document.addEventListener(
        "mouseup",
        isDragging ? handleMouseUp : handleResizeMouseUp,
      );
      document.body.style.cursor = isDragging
        ? "grabbing"
        : resizeDirection === "right"
          ? "ew-resize"
          : resizeDirection === "bottom"
            ? "ns-resize"
            : "nwse-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousemove", handleResizeMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseup", handleResizeMouseUp);
      document.body.style.cursor = "";
    };
  }, [isDragging, isResizing, handleMouseMove, handleResizeMouseMove]);

  // Handle input changes
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (chat?.type === "private" && socket) {
      const receiverId = chat.other_user?._id || chat.receiverId;
      if (receiverId) {
        socket.emit("typing_start", { receiver_id: receiverId });
      }
    } else if (chat?.type === "group" && socket) {
      socket.emit("typing_start", { group_id: chat._id });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (chat?.type === "private" && socket) {
        const receiverId = chat.other_user?._id || chat.receiverId;
        if (receiverId) {
          socket.emit("typing_stop", { receiver_id: receiverId });
        }
      } else if (chat?.type === "group" && socket) {
        socket.emit("typing_stop", { group_id: chat._id });
      }
    }, 1000);
  };

  if (!chat) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-[1002] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      style={{
        left: `${popupPosition.x}px`,
        top: `${popupPosition.y}px`,
        width: `${popupSize.width}px`,
        height: `${popupSize.height}px`,
        cursor: isDragging ? "grabbing" : "default",
        minWidth: "300px",
        minHeight: "300px",
        maxWidth: "800px",
        maxHeight: "800px",
      }}
    >
      {/* Header - Draggable area */}
      <div
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 cursor-move select-none relative"
        onMouseDown={handleMouseDown}
      >
        {/* Connection indicator */}
        <div className="absolute top-1 right-1 flex items-center">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
          <span className="text-xs text-white/80">Live</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={
                chat.avatar ||
                (chat.type === "group"
                  ? "/group-avatar.png"
                  : "/default-avatar.png")
              }
              alt={chat.name}
              className="w-8 h-8 rounded-full border-2 border-white"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm truncate">{chat.name}</h3>
                {chat.type === "group" && (
                  <span className="text-xs bg-blue-500/20 px-1.5 py-0.5 rounded-full">
                    Group
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {typing && (
                  <span className="text-xs text-blue-200 animate-pulse">
                    Typing...
                  </span>
                )}
                {!typing && chat.type === "private" && chat.is_online && (
                  <span className="text-xs text-green-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
                    Online
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}

            {/* Time display */}
            <div className="text-xs text-white/70 mr-2">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>

            <button
              onClick={() => onOpenFullChat && onOpenFullChat(chat)}
              className="text-white hover:text-blue-200 p-1 cursor-pointer"
              title="Open in full chat"
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
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>

            <button
              onClick={onClose}
              className="text-white hover:text-red-200 p-1 cursor-pointer"
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
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="small" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-3"
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
            <p className="text-gray-500 text-sm">No messages yet</p>
            <p className="text-gray-400 text-xs">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message._id || message.tempId}
                className={`flex ${parseInt(message.sender_id) === parseInt(currentUserId) ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl p-2 ${
                    parseInt(message.sender_id) === parseInt(currentUserId)
                      ? "bg-blue-100 text-blue-900 rounded-tr-none"
                      : "bg-gray-200 text-gray-900 rounded-tl-none"
                  } ${message.isSending ? "opacity-70" : ""} ${
                    message.failed ? "bg-red-100 border border-red-300" : ""
                  }`}
                >
                  {message.isSending && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                      <span>Sending...</span>
                    </div>
                  )}

                  {message.failed && (
                    <div className="text-xs text-red-600 mb-1">
                      Failed to send
                    </div>
                  )}

                  {message.message_type === "image" && message.file_url ? (
                    <div>
                      <img
                        src={message.file_url}
                        alt="Image"
                        className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onClick={() => window.open(message.file_url, "_blank")}
                      />
                      <p className="text-xs text-gray-600 mt-1">Image</p>
                    </div>
                  ) : message.message_type === "file" ? (
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="text-sm">
                        {message.file_name || "File"}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm break-words">{message.message}</p>
                  )}

                  <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
                    <span>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {parseInt(message.sender_id) === parseInt(currentUserId) &&
                      message.read_by &&
                      message.read_by.length > 0 && (
                        <span className="text-green-500">✓✓</span>
                      )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3 bg-white no-drag">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm no-drag"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={`px-4 py-2 rounded-lg font-medium text-sm no-drag cursor-pointer ${
              !newMessage.trim() || sending
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {sending ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              </span>
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>

      {/* Resize Handles */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-300/30"
        onMouseDown={(e) => handleResizeMouseDown("right", e)}
      />
      <div
        className="absolute left-0 right-0 bottom-0 h-1 cursor-ns-resize hover:bg-blue-300/30"
        onMouseDown={(e) => handleResizeMouseDown("bottom", e)}
      />
      <div
        className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize hover:bg-blue-300/30"
        onMouseDown={(e) => handleResizeMouseDown("bottom-right", e)}
      />
    </div>
  );
}
