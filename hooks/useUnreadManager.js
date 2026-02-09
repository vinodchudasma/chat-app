import { useState, useEffect, useCallback } from "react";

export const useUnreadManager = (socket, currentUserId, selectedChat) => {
  const [unreadCounts, setUnreadCounts] = useState({});

  // Persistence functions
  const persistUnreadCount = useCallback((chatId, count, type = "private") => {
    try {
      const key = `${type}_unread_${chatId}`;
      localStorage.setItem(key, count.toString());
    } catch (error) {
      console.error("Error persisting unread count:", error);
    }
  }, []);

  const getPersistedUnreadCount = useCallback((chatId, type = "private") => {
    try {
      const key = `${type}_unread_${chatId}`;
      const stored = localStorage.getItem(key);
      return stored ? parseInt(stored, 10) : 0;
    } catch (error) {
      console.error("Error getting persisted unread count:", error);
      return 0;
    }
  }, []);

  const clearPersistedUnreadCount = useCallback((chatId, type = "private") => {
    try {
      const key = `${type}_unread_${chatId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Error clearing persisted unread count:", error);
    }
  }, []);

  // Increment unread count
  const incrementUnreadCount = useCallback(
    (chatId, type = "private") => {
      if (!chatId) return;

      setUnreadCounts((prev) => {
        const currentCount =
          prev[chatId] || getPersistedUnreadCount(chatId, type);
        const newCount = currentCount + 1;

        // Persist the new count
        persistUnreadCount(chatId, newCount, type);

        return {
          ...prev,
          [chatId]: newCount,
        };
      });
    },
    [getPersistedUnreadCount, persistUnreadCount],
  );

  // Reset unread count
  const resetUnreadCount = useCallback(
    (chatId, type = "private") => {
      if (!chatId) return;

      setUnreadCounts((prev) => {
        if (prev[chatId] > 0) {
          // Clear persisted count
          clearPersistedUnreadCount(chatId, type);
          return {
            ...prev,
            [chatId]: 0,
          };
        }
        return prev;
      });
    },
    [clearPersistedUnreadCount],
  );

  // Initialize from persistence on mount
  useEffect(() => {
    // You can load initial unread counts from your API here
    // For now, we'll rely on the persistence system
  }, []);

  // Reset unread count when chat is selected
  useEffect(() => {
    if (selectedChat && currentUserId) {
      const chatId = selectedChat._id.toString();
      const type = selectedChat.type;

      resetUnreadCount(chatId, type);
    }
  }, [selectedChat, currentUserId, resetUnreadCount]);

  // Socket listener for private messages
  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handlePrivateMessage = (message) => {
      const chatId = message.chat_id;
      const isOwnMessage =
        parseInt(message.sender_id) === parseInt(currentUserId);
      const isChatSelected = selectedChat?._id === chatId.toString();

      if (!isOwnMessage && !isChatSelected) {
        incrementUnreadCount(chatId, "private");
      }
    };

    socket.on("private_message", handlePrivateMessage);

    return () => {
      socket.off("private_message", handlePrivateMessage);
    };
  }, [socket, currentUserId, selectedChat, incrementUnreadCount]);

  return {
    unreadCounts,
    incrementUnreadCount,
    resetUnreadCount,
    getUnreadCount: (chatId) =>
      unreadCounts[chatId] || getPersistedUnreadCount(chatId),
  };
};
