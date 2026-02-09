// components/SmallPopupNotificationPanel.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { chatAPI, groupAPI } from "../lib/api";
import LoadingSpinner from "./LoadingSpinner";

export default function SmallPopupNotificationPanel({
  socket,
  currentUserId,
  onOpenMiniChat,
  onOpenInNewTab,
  isOpen,
  onClose,
  position = { x: 0, y: 0 },
}) {
  const [allChats, setAllChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ total: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all"); // 'all', 'unread', 'chats', 'groups'

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Load private chats
      const chatsResponse = await chatAPI.getChats();
      const privateChats = (chatsResponse.data || []).map((chat) => ({
        ...chat,
        type: "private",
        display_name: chat.other_user?.username || "Unknown User",
        last_message_at: chat.last_message_at || chat.created_at,
        unread_count: chat.unread_count || 0,
        avatar: chat.other_user?.profile_image,
      }));

      // Load groups
      const groupsResponse = await groupAPI.getUserGroups();
      const groupChats = (groupsResponse.data || []).map((group) => ({
        ...group,
        type: "group",
        display_name: group.name,
        last_message_at: group.last_message_at || group.created_at,
        unread_count: group.unread_count || 0,
        avatar: "/group-avatar.png",
      }));

      // Combine and sort
      const combined = [...privateChats, ...groupChats].sort((a, b) => {
        const timeA = new Date(a.last_message_at || 0);
        const timeB = new Date(b.last_message_at || 0);
        return timeB - timeA;
      });

      setAllChats(combined);

      // Calculate unread counts
      const totalUnread = combined.reduce(
        (sum, chat) => sum + (chat.unread_count || 0),
        0,
      );
      setUnreadCounts({ total: totalUnread });
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Initial load
  useEffect(() => {
    if (isOpen && currentUserId) {
      loadConversations();
    }
  }, [isOpen, currentUserId, loadConversations]);

  // Socket updates
  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleUpdate = () => {
      loadConversations();
    };

    socket.on("private_message", handleUpdate);
    socket.on("group_message", handleUpdate);
    socket.on("update_sidebar_chat", handleUpdate);

    return () => {
      socket.off("private_message", handleUpdate);
      socket.off("group_message", handleUpdate);
      socket.off("update_sidebar_chat", handleUpdate);
    };
  }, [socket, currentUserId, loadConversations]);

  // Filter chats
  const filteredChats = allChats.filter((chat) => {
    if (!searchQuery) {
      if (filter === "unread") return chat.unread_count > 0;
      if (filter === "chats") return chat.type === "private";
      if (filter === "groups") return chat.type === "group";
      return true;
    }

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      chat.display_name?.toLowerCase().includes(query) ||
      chat.last_message?.toLowerCase().includes(query);

    if (filter === "unread") return matchesSearch && chat.unread_count > 0;
    if (filter === "chats") return matchesSearch && chat.type === "private";
    if (filter === "groups") return matchesSearch && chat.type === "group";
    return matchesSearch;
  });

  // Get message preview
  const getMessagePreview = (chat) => {
    if (!chat.last_message) return "No messages";

    switch (chat.last_message_type) {
      case "image":
        return "📷 Image";
      case "file":
        return "📎 File";
      case "video":
        return "🎥 Video";
      case "audio":
        return "🎤 Voice";
      case "call":
        return "📞 Call";
      default:
        return chat.last_message.length > 25
          ? `${chat.last_message.substring(0, 25)}...`
          : chat.last_message;
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));

      if (diffHours < 1) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (date.toDateString() === now.toDateString()) {
        return "Today";
      } else if (diffHours < 24) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
    } catch (error) {
      return "";
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed z-[1001] w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      style={{
        right: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Messages</h3>
            <p className="text-xs text-blue-200">
              {unreadCounts.total > 0
                ? `${unreadCounts.total} unread`
                : "All caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadConversations}
              className="text-blue-200 hover:text-white p-1 cursor-pointer"
              title="Refresh"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-blue-200 hover:text-white p-1 cursor-pointer"
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

      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 pl-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 py-2 text-xs font-medium relative cursor-pointer ${
            filter === "all"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`flex-1 py-2 text-xs font-medium relative cursor-pointer ${
            filter === "unread"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Unread
          {unreadCounts.total > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCounts.total > 9 ? "9+" : unreadCounts.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter("chats")}
          className={`flex-1 py-2 text-xs font-medium cursor-pointer ${
            filter === "chats"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Chats
        </button>
        <button
          onClick={() => setFilter("groups")}
          className={`flex-1 py-2 text-xs font-medium cursor-pointer ${
            filter === "groups"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Groups
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto max-h-80">
        {loading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="small" />
          </div>
        ) : filteredChats.length === 0 ? (
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
            <p className="text-gray-500 text-xs">
              {searchQuery ? "No matches found" : "No conversations"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredChats.map((chat) => (
              <div
                key={`${chat.type}-${chat._id}`}
                className="p-2 hover:bg-gray-50 cursor-pointer group"
                onClick={() => onOpenMiniChat(chat)}
              >
                <div className="flex items-start gap-2">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={
                        chat.avatar ||
                        (chat.type === "group"
                          ? "/group-avatar.png"
                          : "/default-avatar.png")
                      }
                      alt={chat.display_name}
                      className="w-8 h-8 rounded-full border border-gray-300"
                    />
                    {chat.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                        {chat.unread_count > 9 ? "9+" : chat.unread_count}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {chat.display_name}
                      </h4>
                      <span className="text-[10px] text-gray-500 whitespace-nowrap ml-1">
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {getMessagePreview(chat)}
                    </p>
                    {chat.type === "group" && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-gray-500">
                          {chat.member_count || 0} members
                        </span>
                        {chat.is_public && (
                          <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">
                            Public
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-2 bg-gray-50">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>{filteredChats.length} conversations</span>
          <button
            onClick={() => {
              // Open all in main window
              onClose();
            }}
            className="text-blue-600 hover:text-blue-800 text-xs cursor-pointer"
          >
            View all
          </button>
        </div>
      </div>
    </div>
  );
}
