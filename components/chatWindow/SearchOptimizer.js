"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export default function SearchOptimizer({
  chat,
  searchQuery,
  onSearchComplete,
  isSearchingMode,
  setIsSearchingMode,
  chatAPI,
  groupAPI,
  currentUserId,
}) {
  const [isLoadingAllMessages, setIsLoadingAllMessages] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [loadedMessagesCount, setLoadedMessagesCount] = useState(0);

  // Use refs to track state
  const abortControllerRef = useRef(null);
  const isSearchingRef = useRef(false);
  const hasCompletedSearchRef = useRef(false);
  const searchQueryRef = useRef("");
  const chatIdRef = useRef(null);

  // Helper function to extract text from message
  const extractMessageText = (message) => {
    if (!message) return "";

    const messageType = message.message_type || "text";

    switch (messageType) {
      case "text":
        return message.message || "";

      case "rich_text":
        const richText = message.message || "";
        return richText.replace(/<[^>]*>/g, "");

      case "code":
        try {
          const codeData = JSON.parse(message.message || "{}");
          return codeData.content || "";
        } catch {
          return message.message || "";
        }

      case "call":
        try {
          const callData = JSON.parse(message.message || "{}");
          return `${callData.call_type || ""} ${callData.call_status || ""}`;
        } catch {
          return message.message || "";
        }

      case "audio":
        return (
          message.transcription_data || message.file_name || "Audio message"
        );

      case "image":
      case "video":
      case "file":
        return message.file_name || message.message || "";

      default:
        return message.message || "";
    }
  };

  // Function to load ALL messages for search - SINGLE EXECUTION
  const loadAllMessagesForSearch = useCallback(async () => {
    // Check if we should run
    const currentQuery = searchQuery.trim();
    const currentChatId = chat?._id;

    if (!currentChatId || !currentQuery) {
      return;
    }

    // Check if we're already searching for the same query in the same chat
    if (
      isSearchingRef.current &&
      searchQueryRef.current === currentQuery &&
      chatIdRef.current === currentChatId
    ) {
      return;
    }

    // Check if we already completed this search
    if (
      hasCompletedSearchRef.current &&
      searchQueryRef.current === currentQuery &&
      chatIdRef.current === currentChatId
    ) {
      return;
    }

    // Abort any existing search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Set refs
    isSearchingRef.current = true;
    hasCompletedSearchRef.current = false;
    searchQueryRef.current = currentQuery;
    chatIdRef.current = currentChatId;

    setIsLoadingAllMessages(true);
    setIsSearchingMode(true);
    setSearchProgress(0);
    setLoadedMessagesCount(0);

    try {
      let allMessages = [];
      let hasMore = true;
      let page = 1;
      const limit = 50;
      let totalMessages = 0;

      // First, get total count
      try {
        let initialResponse;
        if (chat.type === "private") {
          initialResponse = await chatAPI.getChatMessages(currentChatId, 1, 0);
        } else {
          initialResponse = await groupAPI.getGroupMessages(
            currentChatId,
            1,
            0,
          );
        }
        totalMessages = initialResponse.data.pagination?.total || 0;
      } catch (error) {
        console.error("Error getting total count:", error);
        totalMessages = 1000;
      }

      // Load all pages
      while (hasMore && !abortController.signal.aborted) {
        const offset = (page - 1) * limit;

        try {
          let response;
          if (chat.type === "private") {
            response = await chatAPI.getChatMessages(
              currentChatId,
              limit,
              offset,
              {
                signal: abortController.signal,
              },
            );
          } else {
            response = await groupAPI.getGroupMessages(
              currentChatId,
              limit,
              offset,
              {
                signal: abortController.signal,
              },
            );
          }

          const apiResponse = response.data;
          const messages = apiResponse.messages || [];

          // Process messages
          const processedMessages = messages.map((msg) => {
            let transformedMessage = transformFileMessageForDisplay(msg);
            const searchText = extractMessageText(transformedMessage);
            transformedMessage._searchText = searchText.toLowerCase();

            return {
              ...transformedMessage,
              _loadedForSearch: true,
              _page: page,
            };
          });

          allMessages = [...allMessages, ...processedMessages];
          setLoadedMessagesCount(allMessages.length);

          // Update progress
          if (totalMessages > 0) {
            const progress = Math.min(
              100,
              Math.round((allMessages.length / totalMessages) * 100),
            );
            setSearchProgress(progress);
          }

          // Check if we should continue - IMPORTANT FIX
          const hasMoreMessages = apiResponse.pagination?.hasMore;
          const receivedFullPage = messages.length === limit;

          hasMore = hasMoreMessages === true && receivedFullPage;

          if (!hasMore) {
            console.log(`⏹️ Stopping at page ${page}. Reason:`, {
              hasMoreMessages,
              receivedFullPage,
              messagesLength: messages.length,
              totalLoaded: allMessages.length,
            });
          }

          page++;

          // Small delay between pages
          if (hasMore && !abortController.signal.aborted) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        } catch (error) {
          if (error.name === "AbortError") {
            console.log("Search aborted");
            return;
          }
          console.error(` Error loading page ${page}:`, error);
          break;
        }
      }

      // Filter messages
      const lowerQuery = currentQuery.toLowerCase();
      const searchResults = allMessages.filter((message) => {
        if (message.is_deleted || message.deleted_for_everyone) return false;

        if (message._searchText && message._searchText.includes(lowerQuery))
          return true;
        if (
          message.message &&
          message.message.toLowerCase().includes(lowerQuery)
        )
          return true;
        if (
          message.file_name &&
          message.file_name.toLowerCase().includes(lowerQuery)
        )
          return true;

        return false;
      });

      // Mark search as completed
      hasCompletedSearchRef.current = true;

      // Pass results back to parent
      onSearchComplete(searchResults, allMessages);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error in search:", error);
      }
    } finally {
      setIsLoadingAllMessages(false);
      isSearchingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [
    chat,
    searchQuery,
    chatAPI,
    groupAPI,
    onSearchComplete,
    setIsSearchingMode,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Reset search state when chat changes
  useEffect(() => {
    if (chat?._id !== chatIdRef.current) {
      console.log("🔄 Chat changed, resetting search state");
      hasCompletedSearchRef.current = false;
      isSearchingRef.current = false;
      searchQueryRef.current = "";
      chatIdRef.current = null;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [chat?._id]);

  // Trigger search - SINGLE TRIGGER with strict conditions
  useEffect(() => {
    const currentQuery = searchQuery.trim();
    const currentChatId = chat?._id;

    if (!currentQuery || !currentChatId) {
      return;
    }

    // Don't search if we're already searching or already completed
    if (
      isSearchingRef.current ||
      (hasCompletedSearchRef.current &&
        searchQueryRef.current === currentQuery &&
        chatIdRef.current === currentChatId)
    ) {
      return;
    }

    const timer = setTimeout(() => {
      loadAllMessagesForSearch();
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery, chat?._id, loadAllMessagesForSearch]);

  // Transform function
  const transformFileMessageForDisplay = (message) => {
    if (message._transformed) return message;

    const messageType = message.message_type || "text";
    const baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    let transformed = { ...message };

    if (["audio", "image", "video", "file"].includes(messageType)) {
      if (message.file_url && message.file_url.startsWith("http")) {
        transformed.file_url = message.file_url;
      } else if (message.file_path) {
        transformed.file_url = `${baseUrl}/uploads/chat_files/${message.file_path.replace(/^uploads[\\/]/, "")}`;
      } else if (message.file_name || message.filename) {
        const filename = message.file_name || message.filename;
        transformed.file_url = `${baseUrl}/uploads/chat_files/${filename}`;
      }
    }

    transformed._transformed = true;
    transformed._id = message._id || message.message_id;
    transformed.message_type = messageType;
    transformed.timestamp =
      message.timestamp || message.created_at || new Date().toISOString();

    return transformed;
  };

  if (!isLoadingAllMessages) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-white border border-blue-200 rounded-lg shadow-lg z-50 px-6 py-4 min-w-80">
      <div className="flex items-center gap-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 mb-1">
            Searching "{searchQuery}"...
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${searchProgress}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-600 whitespace-nowrap">
              {loadedMessagesCount} loaded
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
