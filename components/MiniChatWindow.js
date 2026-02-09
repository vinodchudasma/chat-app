"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { chatAPI, groupAPI } from "../lib/api";

export default function MiniChatWindow({
  chat,
  socket,
  currentUserId,
  onClose,
  position = { x: 0, y: 0 },
  panelPosition = { x: 0, y: 0, width: 288 }, // Position of the notification panel
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // Calculate position (right beside the panel)
  const calculatedPosition = {
    x: panelPosition.x - 320, // Position to the left of the panel
    y: panelPosition.y,
  };

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!chat) return;

    try {
      setLoading(true);
      let response;

      if (chat.type === "private") {
        response = await chatAPI.getChatMessages(chat._id, 15, 0);
      } else {
        response = await groupAPI.getGroupMessages(chat._id, 15, 0);
      }

      const apiMessages = response.data.messages || [];
      const transformed = apiMessages.map(transformMessage);
      setMessages(
        transformed.sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at),
        ),
      );

      // Mark as read
      await markAsRead();
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  }, [chat]);

  // Transform message
  const transformMessage = (msg) => ({
    ...msg,
    id: msg._id || msg.message_id,
    _transformed: true,
  });

  // Mark as read
  const markAsRead = async () => {
    if (!chat || !currentUserId) return;

    try {
      if (chat.type === "private") {
        await chatAPI.markAsRead(chat._id);
      } else {
        await groupAPI.markGroupMessagesAsRead(chat._id);
      }
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

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

      const transformed = transformMessage(message);
      setMessages((prev) => [...prev, transformed]);
      setUnreadCount((prev) => prev + 1);
      scrollToBottom();
    };

    socket.on("private_message", handleNewMessage);
    socket.on("group_message", handleNewMessage);

    return () => {
      socket.off("private_message", handleNewMessage);
      socket.off("group_message", handleNewMessage);
    };
  }, [socket, chat, currentUserId]);

  // Scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chat) return;

    setSending(true);
    const tempId = `temp_${Date.now()}`;

    const tempMessage = {
      tempId,
      message: newMessage.trim(),
      sender_id: currentUserId,
      created_at: new Date().toISOString(),
      isSending: true,
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
    } finally {
      setSending(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (chat) {
      loadMessages();
      markAsRead();
    }
  }, [chat, loadMessages]);

  if (!chat) return null;

  return (
    <div
      className="fixed z-[1002] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      style={{
        right: `${calculatedPosition.x}px`,
        top: `${calculatedPosition.y}px`,
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3">
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
              <h3 className="font-bold text-sm truncate">{chat.name}</h3>
              <p className="text-xs text-green-200 truncate">
                {chat.type === "private"
                  ? "Direct message"
                  : `${chat.member_count || 0} members`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-green-200 hover:text-white p-1 cursor-pointer"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 bg-gray-50 max-h-64">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6">
            <svg
              className="w-10 h-10 text-gray-300 mx-auto mb-2"
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
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg._id || msg.tempId}
                className={`flex ${parseInt(msg.sender_id) === parseInt(currentUserId) ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-2 text-sm ${
                    parseInt(msg.sender_id) === parseInt(currentUserId)
                      ? "bg-blue-100 text-blue-900 rounded-tr-none"
                      : "bg-gray-200 text-gray-900 rounded-tl-none"
                  }`}
                >
                  {msg.message}
                  <div className="text-[10px] text-gray-500 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-2 bg-white">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
              !newMessage.trim() || sending
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
