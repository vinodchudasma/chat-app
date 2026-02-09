import { useState, useEffect, useCallback, useRef } from "react";
import LoadingSpinner from "../LoadingSpinner";
import CodeSnippet from "../CodeSnippet";
import { ToastElement, successToast, errorToast } from "../toast";
import CallHistoryMessage from "../CallHistoryMessage";
import { isCallMessage, parseCallMessage } from "../../utils/messageUtils";
import AISuggestions from "./AISuggestions";
import VoiceMessageWithTranscription from "./VoiceMessageWithTranscription";
import MessageTranslation from "./MessageTranslation";

export default function MessageList({
  messages,
  loading,
  validatedChat,
  currentUserId,
  highlightedMessageId,
  editingMessage,
  editText,
  searchQuery,
  wallpaper,
  loadedImages,
  showMessageMenu,
  menuPosition,
  selectedMessage,
  onEditMessage,
  onSaveEdit,
  onCancelEdit,
  onMessageMenu,
  onRetryMessage,
  onImageLoad,
  onImageClick,
  onDownload,
  formatTime,
  formatFileSize,
  getFileIcon,
  messagesEndRef,
  renderMessageMenu,
  onSuggestionSelect,
  onAudioPlay = () => {},
  onAudioPause = () => {},
  onAudioEnd = () => {},
  hasMoreMessages = true,
  isLoadingMore = false,
  messagesContainerRef = null,
  onLoadOlderMessages = null,
  searchResults = [],
  isSearchingMode = false,
  validatedChatRef,
  groupMembers = [],
  setSelectedUserForProfile,
  setShowUserProfile,
  handleOpenUserProfile,
}) {
  // ========== STATE HOOKS ==========
  const [chatContext, setChatContext] = useState([]);
  const [lastMessageId, setLastMessageId] = useState(null);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [userLanguage, setUserLanguage] = useState("en");

  // ========== VARIABLES ==========
  const messagesToDisplay =
    searchQuery && searchResults.length > 0 && isSearchingMode
      ? searchResults
      : messages;

  // ========== EFFECT HOOKS ==========
  useEffect(() => {
    const context = messagesToDisplay.slice(-10).map((msg) => ({
      message: msg.message,
      sender: msg.sender_id === currentUserId ? "user" : "other",
      timestamp: msg.created_at,
    }));
    setChatContext(context);
  }, [messagesToDisplay, currentUserId, isSearchingMode, searchResults.length]);

  // Update last message ID when messages change
  useEffect(() => {
    if (messagesToDisplay.length > 0) {
      const lastMsg = messagesToDisplay[messagesToDisplay.length - 1];
      setLastMessageId(lastMsg._id);
    } else {
      setLastMessageId(null);
    }
  }, [messagesToDisplay]);

  // ========== CALLBACK HOOKS ==========
  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion) => {
      if (onSuggestionSelect) {
        onSuggestionSelect(suggestion);
      }
    },
    [onSuggestionSelect],
  );

  // Handle reply click - scroll to original message
  const handleReplyClick = useCallback((replyMessageId) => {
    if (!replyMessageId) return;

    // Find the element
    const messageElement = document.getElementById(`message-${replyMessageId}`);
    if (messageElement) {
      // highlight effect
      messageElement.classList.add(
        "highlighted-message",
        "bg-yellow-50",
        "border",
        "border-yellow-200",
        "rounded-lg",
      );

      // Scroll to the message
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Remove highlight after 3 seconds
      setTimeout(() => {
        messageElement.classList.remove(
          "highlighted-message",
          "bg-yellow-50",
          "border",
          "border-yellow-200",
          "rounded-lg",
        );
      }, 3000);
    } else {
      console.log("Message not found, might need to load more messages");
    }
  }, []);

  // ========== HELPER FUNCTIONS ==========
  const formatCallDuration = (seconds) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  //function for voice message duration formatting
  const formatVoiceDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper function to get reply preview text
  const getReplyPreviewText = (replyMessage) => {
    if (!replyMessage) return "Message";

    switch (replyMessage.message_type) {
      case "image":
        return "🖼 Image";
      case "video":
        return "🎥 Video";
      case "file":
        return `📎 ${replyMessage.file_name || "File"}`;
      case "code":
        return "💻 Code snippet";
      case "audio":
      case "voice":
        return "🎤 Voice message";
      case "rich_text":
        // Remove HTML tags for preview
        const textOnly = replyMessage.message?.replace(/<[^>]*>/g, "") || "";
        return textOnly.length > 50
          ? textOnly.substring(0, 50) + "..."
          : textOnly;
      case "text":
      default:
        if (replyMessage.message) {
          return typeof replyMessage.message === "string"
            ? replyMessage.message.length > 50
              ? replyMessage.message.substring(0, 50) + "..."
              : replyMessage.message
            : "Message";
        }
        return "Message";
    }
  };

  const renderLoadingMore = () => {
    if (!isLoadingMore || !hasMoreMessages || isSearchingMode) return null;

    return (
      <div className="flex justify-center py-4 sticky top-0 z-10 bg-white bg-opacity-80 backdrop-blur-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-sm text-gray-600">
          Loading older messages...
        </span>
      </div>
    );
  };

  // ========== RENDER FUNCTIONS ==========
  //function to render call messages
  const renderCallMessage = (message) => {
    let callData;

    try {
      // Handle different formats of call data
      if (typeof message.message === "string") {
        callData = JSON.parse(message.message);
      } else if (message.call_data) {
        callData = message.call_data;
      } else {
        callData = message;
      }

      const callType =
        callData.call_type === "video" ? "Video Call" : "Voice Call";
      const callDuration = callData.call_duration
        ? ` (${formatCallDuration(callData.call_duration)})`
        : "";

      let statusText = "";
      let statusColor = "";

      switch (callData.call_status) {
        case "initiated":
        case "started":
          statusText = "Call started";
          statusColor = "text-blue-600";
          break;
        case "active":
          statusText = "Call in progress";
          statusColor = "text-green-600";
          break;
        case "completed":
        case "ended":
          statusText = `Call ended${callDuration}`;
          statusColor = "text-green-600";
          break;
        case "rejected":
        case "declined":
          statusText = "Call declined";
          statusColor = "text-red-600";
          break;
        case "timeout":
          statusText = "Call timed out";
          statusColor = "text-orange-600";
          break;
        case "failed":
          statusText = "Call failed";
          statusColor = "text-red-600";
          break;
        case "missed":
          statusText = "Missed call";
          statusColor = "text-red-600";
          break;
        default:
          statusText = "Call";
          statusColor = "text-gray-600";
      }

      return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 max-w-md mx-auto">
          <div
            className={`p-2 rounded-full ${
              callData.call_type === "video" ? "bg-purple-100" : "bg-blue-100"
            }`}
          >
            <svg
              className={`w-5 h-5 ${
                callData.call_type === "video"
                  ? "text-purple-600"
                  : "text-blue-600"
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              {callData.call_type === "video" ? (
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              ) : (
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              )}
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{callType}</p>
            <p className={`text-sm ${statusColor}`}>{statusText}</p>
            <p className="text-xs text-gray-500">
              {formatTime(message.created_at)}
            </p>
          </div>
        </div>
      );
    } catch (error) {
      // Fallback rendering for malformed call messages
      return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 max-w-md mx-auto">
          <div className="p-2 rounded-full bg-gray-100">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Call</p>
            <p className="text-sm text-gray-600">Call history</p>
            <p className="text-xs text-gray-500">
              {formatTime(message.created_at)}
            </p>
          </div>
        </div>
      );
    }
  };

  const formatRichText = (text) => {
    if (!text) return "";

    // First escape any existing HTML to prevent XSS
    const escapeHtml = (unsafe) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    let safeText = escapeHtml(text);

    // Process markdown links FIRST before other formatting
    // Markdown links: [text](url)
    safeText = safeText.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (match, linkText, url) => {
        return `<a href="${url}" class="rich-text-link" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">${linkText}</a>`;
      },
    );

    // Then process other markdown formatting
    // Bold: **text**
    safeText = safeText.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic: *text* or _text_
    safeText = safeText.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    safeText = safeText.replace(/_([^_]+)_/g, "<em>$1</em>");

    // Underline: __text__
    safeText = safeText.replace(/__([^_]+)__/g, "<u>$1</u>");

    // Strikethrough: ~~text~~
    safeText = safeText.replace(/~~([^~]+)~~/g, "<del>$1</del>");

    // Inline code: `code`
    safeText = safeText.replace(
      /`([^`]+)`/g,
      '<code style="background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>',
    );

    // Auto-link URLs (only if not already in a markdown link)
    // This regex avoids already linked URLs
    safeText = safeText.replace(
      /(?:^|\s)(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
      (match, url) => {
        // Check if this URL is already inside an <a> tag
        if (!/<a[^>]*>.*?<\/a>/.test(match)) {
          return ` <a href="${url}" class="rich-text-link" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">${url}</a>`;
        }
        return match;
      },
    );

    // Line breaks - handle this last
    safeText = safeText.replace(/\n/g, "<br>");

    return safeText;
  };

  const groupMessagesByDate = () => {
    const groups = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    messagesToDisplay?.forEach((message) => {
      const timestamp = message.createdAt || message.created_at;
      if (!timestamp) return;

      try {
        const dateObj = new Date(timestamp);
        if (isNaN(dateObj.getTime())) return;

        const dateString = dateObj.toDateString();

        let displayDate;
        if (dateString === today) {
          displayDate = "Today";
        } else if (dateString === yesterday) {
          displayDate = "Yesterday";
        } else {
          displayDate = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }

        if (!groups[displayDate]) {
          groups[displayDate] = [];
        }
        groups[displayDate].push(message);
      } catch (error) {
        console.error("Error processing message date:", error);
      }
    });

    return groups;
  };

  const highlightText = (text, query) => {
    if (!query || !text) return text;

    try {
      const regex = new RegExp(
        `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );
      return text.replace(regex, '<mark class="bg-yellow-300">$1</mark>');
    } catch (error) {
      console.error("Error highlighting text:", error);
      return text;
    }
  };

  // Update the render function for read receipts
  const renderReadReceipt = (message) => {
    if (message.isSending) {
      return <span className="text-gray-400">🕐</span>;
    }

    if (message.failed) {
      return <span className="text-red-400">✕</span>;
    }

    if (validatedChatRef.current?.type === "private") {
      // Private chat: Single tick (delivered), Double tick (read)
      if (message.is_read) {
        return <span className="text-blue-400">✓✓</span>; // Double tick for read
      } else if (message.delivered_at) {
        return <span className="text-gray-400">✓</span>; // Single tick for delivered
      } else {
        return <span className="text-gray-300">✓</span>; // Light tick for sent
      }
    } else {
      // Group chat
      let readBy = message.read_by;

      // Normalize to array
      if (Array.isArray(readBy)) {
      } else if (typeof readBy === "string") {
        try {
          readBy = JSON.parse(readBy);
          if (!Array.isArray(readBy)) readBy = [readBy];
        } catch {
          readBy = readBy ? [readBy] : [];
        }
      } else if (typeof readBy === "number") {
        readBy = [readBy];
      } else {
        readBy = [];
      }

      const totalMembers = message.total_members_count || 0;
      const readCount = readBy.length;
      const hasRead = readBy.includes(currentUserId);

      if (readCount === totalMembers && totalMembers > 0) {
        return <span className="text-blue-400">✓✓</span>;
      } else if (readCount > 0) {
        return <span className="text-gray-400">✓</span>;
      } else {
        return <span className="text-gray-300">✓</span>;
      }
    }
  };

  // ========== MAIN RENDER FUNCTION ==========
  const renderMessage = (message, index) => {
    if (!message) return null;

    const generateUniqueKey = () => {
      if (message._id) {
        return `msg-${message._id}-${index}`;
      }
      if (message.tempId) {
        return `temp-${message.tempId}-${Date.now()}`;
      }
      return `msg-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    const renderMessageContent = () => {
      //if (message?.message_type === 'text' || message?.message_type === 'rich_text') {
      let messageText = message?.message || "";

      // Create a map to store processed mentions
      const processedMentions = new Map();
      let mentionData = [];

      // Check if mentions exist
      if (message?.mentions && message?.mention_data) {
        try {
          // Parse mention_data
          if (typeof message.mention_data === "string") {
            mentionData = JSON.parse(message.mention_data);
          } else if (Array.isArray(message.mention_data)) {
            mentionData = message.mention_data;
          }
        } catch (error) {
          console.error("Error parsing mention_data:", error);
          mentionData = [];
        }

        // Get mentions array
        let mentionsArray = [];
        if (typeof message.mentions === "string") {
          try {
            mentionsArray = JSON.parse(message.mentions);
          } catch (error) {
            console.error("Error parsing mentions:", error);
            mentionsArray = [];
          }
        } else if (Array.isArray(message.mentions)) {
          mentionsArray = message.mentions;
        }

        // Process each mention
        if (mentionData.length > 0 && mentionsArray.length > 0) {
          // Create a map for quick lookup
          const mentionMap = new Map();
          mentionData.forEach((mention) => {
            if (mention && mention._id && mention.name) {
              mentionMap.set(mention._id, mention);
            }
          });

          // We'll process mentions by inserting special placeholders
          mentionsArray.forEach((mentionId) => {
            const mention = mentionMap.get(mentionId);
            if (mention) {
              // Create a unique placeholder for this mention
              const placeholder = `__MENTION_${mention._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}__`;

              // Store the mention data with placeholder
              processedMentions.set(placeholder, mention);
            }
          });
        }
      }

      // For search highlighting
      if (searchQuery && searchQuery.trim()) {
        const searchPattern = new RegExp(
          `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
          "gi",
        );
        messageText = messageText.replace(
          searchPattern,
          '<mark class="bg-yellow-300">$1</mark>',
        );
      }

      // Convert message to HTML with clickable mentions
      const createMessageHtml = () => {
        let html = "";
        let currentIndex = 0;

        // If we have processed mentions, insert them
        if (processedMentions.size > 0) {
          // We'll return a div with spans for text and clickable mentions
          return `
          <div class="message-with-mentions">
            ${messageText}
            ${Array.from(processedMentions.entries())
              .map(
                ([placeholder, mention]) => `
              <span class="mention-highlight clickable-mention bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium mx-1 cursor-pointer hover:bg-blue-200 transition-colors" 
                    data-user-id="${mention._id}"
                    data-user-name="${mention.name}">
                @${mention.name}
              </span>
            `,
              )
              .join("")}
          </div>
        `;
        }

        // Escape HTML for security
        const escapedText = messageText
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

        // Replace newlines with <br>
        const textWithBreaks = escapedText.replace(/\n/g, "<br>");

        return `<div class="message-content">${textWithBreaks}</div>`;
      };

      return (
        <div
          className="message-content-container"
          dangerouslySetInnerHTML={{ __html: createMessageHtml() }}
          onClick={(e) => {
            // Handle mention clicks
            const mentionElement = e.target.closest(".clickable-mention");
            if (mentionElement) {
              e.preventDefault();
              e.stopPropagation();

              const userId = mentionElement.getAttribute("data-user-id");
              const userName = mentionElement.getAttribute("data-user-name");

              if (userId) {
                // Find the user in group members or chat participants
                const user =
                  groupMembers?.find((m) => m._id == userId) ||
                  validatedChat?.participants?.find((p) => p._id == userId);

                if (user) {
                  // Open user profile modal
                  setSelectedUserForProfile({
                    userId: userId,
                    userName: userName,
                    userData: user,
                  });
                  setShowUserProfile(true);
                } else {
                  // Try to fetch user data
                  handleOpenUserProfile(userId, userName);
                }
              }
            }
          }}
        />
      );
      // }

      return null;
    };

    // Helper function to process mentions in text
    const processMentionsInText = (text, mentions, mentionData) => {
      if (!text || !mentions || !mentionData) return text;

      let processedText = text;

      try {
        const mentionDataArray =
          typeof mentionData === "string"
            ? JSON.parse(mentionData)
            : mentionData;

        // Create a map of mention data
        const mentionMap = new Map();
        mentionDataArray.forEach((mention) => {
          if (mention && mention._id) {
            mentionMap.set(mention._id, mention);
          }
        });

        // Process each mention
        const mentionsArray =
          typeof mentions === "string" ? JSON.parse(mentions) : mentions;

        mentionsArray.forEach((mentionId) => {
          const mention = mentionMap.get(mentionId);
          if (mention) {
            const mentionText = mention.is_all_mention
              ? "@all"
              : `@${mention.name}`;
            const mentionRegex = new RegExp(`@${mention.name}\\b`, "gi");

            processedText = processedText.replace(
              mentionRegex,
              `<span class="mention-highlight clickable-mention bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-medium mx-1 cursor-pointer hover:bg-blue-200 transition-colors" 
                  data-user-id="${mention._id}"
                  data-user-name="${mention.name}"
                  data-is-all-mention="${mention.is_all_mention || false}">
            ${mentionText}
          </span>`,
            );
          }
        });
      } catch (error) {
        console.error("Error processing mentions:", error);
      }

      return processedText;
    };

    // const handleMentionClick = (e) => {
    //   const mentionElement = e.target.closest('.clickable-mention');
    //   if (mentionElement) {
    //     e.preventDefault();
    //     e.stopPropagation();

    //     const userId = mentionElement.getAttribute('data-user-id');
    //     const userName = mentionElement.getAttribute('data-user-name');
    //     const isAllMention = mentionElement.getAttribute('data-is-all-mention') === 'true';

    //     if (isAllMention) {
    //       // Show notification for @all mention
    //       successToast(`This message mentions everyone in the group`, 'info');
    //     } else if (userId) {
    //       // ========== EXISTING PROFILE OPENING LOGIC ==========

    //       // Find the user in group members or chat participants
    //       const user = groupMembers?.find(m => m.id == userId) ||
    //         validatedChat?.participants?.find(p => p.id == userId);

    //       if (user) {
    //         // Open user profile modal
    //         setSelectedUserForProfile({
    //           userId: userId,
    //           userName: userName,
    //           userData: user
    //         });
    //         setShowUserProfile(true);
    //       } else {
    //         // Try to fetch user data if not available locally
    //         handleOpenUserProfile(userId, userName);
    //       }

    //       // ========== END OF PROFILE OPENING LOGIC ==========
    //     }
    //   }
    // };

    const handleMentionClick = (e) => {
      // Don't process mentions in private chats
      if (validatedChat?.type === "private") {
        return; // Early return for private chats
      }

      const mentionElement = e.target.closest(".clickable-mention");
      if (mentionElement) {
        e.preventDefault();
        e.stopPropagation();

        const userId = mentionElement.getAttribute("data-user-id");
        const userName = mentionElement.getAttribute("data-user-name");
        const isAllMention =
          mentionElement.getAttribute("data-is-all-mention") === "true";

        if (isAllMention) {
          // Show notification for @all mention
          successToast(`This message mentions everyone in the group`, "info");
        } else if (userId) {
          // Find the user in group members or chat participants
          const user =
            groupMembers?.find((m) => m._id == userId) ||
            validatedChat?.participants?.find((p) => p._id == userId);

          if (user) {
            // Open user profile modal
            setSelectedUserForProfile({
              userId: userId,
              userName: userName,
              userData: user,
            });
            setShowUserProfile(true);
          } else {
            // Try to fetch user data if not available locally
            handleOpenUserProfile(userId, userName);
          }
        }
      }
    };

    const uniqueKey = generateUniqueKey();

    const isOwnMessage =
      parseInt(message.sender_id) === parseInt(currentUserId);
    const isDeletedMessage =
      message.is_deleted == true &&
      message.message_type === "deleted" &&
      message.deleted_for_everyone == false;
    const isDeletedMessageForEveryone = message.deleted_for_everyone;
    const isTextMessage = message.message_type === "text";
    const isImageMessage = message.message_type === "image";
    const isVideoMessage = message.message_type === "video";
    const isFileMessage = message.message_type === "file";
    const isCodeMessage = message.message_type === "code";
    const isAudioMessage = message.message_type === "audio";
    const isRichTextMessage = message.message_type === "rich_text";
    const isSystemMessage = message.message_type === "system";

    // Make sure isCallMessage is imported properly
    const isCallMessageType =
      message.message_type === "call" ||
      message.call_data !== undefined ||
      (typeof message.message === "string" &&
        message.message.includes("call_type"));

    const isSending = message.isSending;
    const failed = message.failed;
    const isHighlighted = highlightedMessageId === message._id;
    const isEditing = editingMessage && editingMessage._id === message._id;

    // Check if this is the absolute last message in the entire chat
    const isLastMessage = message._id === lastMessageId;

    const senderName = message.sender
      ? `${message.sender.first_name || ""} ${message.sender.last_name || ""}`?.trim()
      : "Unknown User";

    // Parse code snippet data
    let codeData = null;
    if (isCodeMessage) {
      try {
        codeData = JSON.parse(message.message);
      } catch (error) {
        codeData = {
          content: message.message,
          language: "text",
        };
      }
    }

    // Handle system messages (like user joined, left, added, etc.)
    if (isSystemMessage) {
      return (
        <div
          key={uniqueKey}
          id={`message-${message._id || message.tempId}`}
          className="message-container mb-3 flex justify-center"
        >
          <div className="system-message bg-yellow-50 bg-opacity-80 text-gray-700 text-xs px-3 py-1.5 rounded-lg shadow-sm max-w-md text-center">
            <span className="font-medium">{message.message}</span>
          </div>
        </div>
      );
    }

    // Handle call messages
    if (isCallMessageType) {
      return (
        <div
          key={uniqueKey}
          id={`message-${message._id || message.tempId}`}
          className="message-container mb-4 flex justify-center"
        >
          {renderCallMessage(message)}
        </div>
      );
    }

    const messageClasses = `
  message-container group relative mb-4 max-w-[70%] 
  ${isOwnMessage ? "ml-auto flex flex-col items-end" : "mr-auto flex flex-col items-start"}
  ${isHighlighted ? "highlighted-message bg-yellow-50 border border-yellow-200 rounded-lg p-2" : ""}
`;

    const bubbleClasses = `
    message-bubble rounded-2xl px-4 py-2 relative break-words ${
      isOwnMessage
        ? "bg-blue-500 text-white rounded-br-md"
        : "bg-gray-100 text-gray-900 rounded-bl-md"
    } ${
      isDeletedMessageForEveryone ? "italic text-gray-500 bg-gray-200" : ""
    } ${
      isSending ? "opacity-70" : failed ? "border border-red-300 bg-red-50" : ""
    }
  `;

    // Helper function to get file extension icon
    const getFileExtensionIcon = (fileType) => {
      if (!fileType) return "📄";

      const type = fileType.toLowerCase();
      if (type.includes("pdf")) return "PDF";
      if (type.includes("word") || type.includes("doc")) return "DOC";
      if (type.includes("excel") || type.includes("xls")) return "XLS";
      if (type.includes("powerpoint") || type.includes("ppt")) return "PPT";
      if (type.includes("zip") || type.includes("rar") || type.includes("7z"))
        return "ZIP";
      if (type.includes("image")) return "IMG";
      if (type.includes("video")) return "VID";
      if (type.includes("audio")) return "AUD";

      return fileType.substring(0, 3).toUpperCase();
    };

    return (
      <div
        key={uniqueKey}
        id={`message-${message._id || message.tempId}`}
        className={messageClasses}
      >
        {/* Sender name for group chats */}
        {validatedChat?.type === "group" && !isOwnMessage && (
          <div className="text-xs text-gray-500 mb-1 ml-4 font-medium">
            {senderName}
          </div>
        )}
        {!isDeletedMessage && (
          <div
            className={`flex items-start gap-2 ${
              isOwnMessage ? "blue" : "gray"
            }`}
          >
            {/* Message bubble */}
            <div className={bubbleClasses}>
              {message.is_forwarded &&
                !isDeletedMessage &&
                !isDeletedMessageForEveryone &&
                !isEditing && (
                  <div className="forwarded-indicator flex items-center gap-1 text-xs text-white-500 mb-1">
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
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                    <span className="italic opacity-75">forwarded</span>
                    {message.original_sender_name && (
                      <span className="font-medium">
                        from {message.original_sender_name}
                      </span>
                    )}
                  </div>
                )}

              {/* Reply preview */}
              {message.reply_to &&
                !isDeletedMessage &&
                !isDeletedMessageForEveryone &&
                !isEditing && (
                  <div
                    className={`reply-preview mb-2 p-2 rounded-lg border-l-4 cursor-pointer hover:opacity-90 transition-opacity ${
                      isOwnMessage
                        ? "border-blue-300 bg-blue-400 bg-opacity-30"
                        : "border-gray-300 bg-gray-50"
                    }`}
                    onClick={() => {
                      if (message.reply_to.message_id) {
                        handleReplyClick(message.reply_to.message_id);
                      } else if (message.reply_to._id) {
                        handleReplyClick(message.reply_to._id);
                      }
                    }}
                    title="Click to jump to original message"
                  >
                    <div className="flex items-center gap-2 text-xs font-medium opacity-75 mb-1">
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
                          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                      <span>
                        Replying to{" "}
                        {message.reply_to.sender_id === currentUserId
                          ? "yourself"
                          : senderName}
                      </span>
                    </div>
                    <div className="text-sm truncate pl-5">
                      {getReplyPreviewText(message.reply_to)}
                    </div>
                  </div>
                )}

              {isEditing ? (
                <div
                  className="edit-message-ui"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="text-xs text-gray-500 mb-2 font-medium">
                    Edit message
                  </div>
                  <textarea
                    value={editText}
                    onChange={(e) => {
                      // Don't stop propagation for onChange - it's needed
                      if (typeof onEditMessage === "function") {
                        onEditMessage(message, e.target.value); // Pass both message and value
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full p-2 border border-gray-300 rounded-lg resize-none text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof onSaveEdit === "function") {
                          onSaveEdit();
                        }
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof onCancelEdit === "function") {
                          onCancelEdit();
                        }
                      }
                    }}
                  />
                  <div
                    className="flex gap-2 mt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof onSaveEdit === "function") {
                          onSaveEdit();
                          onMessageMenu(message, e);
                        }
                      }}
                      disabled={!editText?.trim()}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-green-300 transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof onCancelEdit === "function") {
                          onCancelEdit();
                          onMessageMenu(message, e);
                        }
                      }}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal Message content */
                <>
                  {isDeletedMessageForEveryone ? (
                    <div className="flex items-center gap-2 text-gray-500 italic">
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
                      This message was deleted
                    </div>
                  ) : isAudioMessage ? (
                    <VoiceMessageWithTranscription
                      message={message}
                      isOwnMessage={isOwnMessage}
                      onAudioPlay={onAudioPlay}
                      onAudioPause={onAudioPause}
                      onAudioEnd={onAudioEnd}
                      formatVoiceDuration={formatVoiceDuration}
                    />
                  ) : isRichTextMessage ? (
                    <div className="rich-text-message">
                      <div
                        className="rich-text-content"
                        style={{
                          color: isOwnMessage ? "white" : "#1f2937",
                          textAlign: "left",
                          wordWrap: "break-word",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: formatRichText(message.message),
                        }}
                      />
                    </div>
                  ) : isImageMessage ? (
                    <div className="image-message">
                      <div
                        className={`relative rounded-xl overflow-hidden shadow-md ${isOwnMessage ? "border-2 border-blue-200" : "border-2 border-gray-200"}`}
                      >
                        <img
                          src={message.file_url}
                          alt={message.message || "Shared image"}
                          className="w-full h-auto cursor-pointer transition-transform duration-300 hover:scale-105"
                          style={{ maxWidth: "320px", maxHeight: "320px" }}
                          onClick={() => onImageClick(message.file_url)}
                          onLoad={() => onImageLoad(message._id)}
                        />
                        {/* Image overlay info */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                          <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M4 5h13v7h2V5c0-1.103-.897-2-2-2H4c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h8v-2H4V5z" />
                                <path d="M8 11l-3 4h11l-4-6-3 4z" />
                                <path d="M19 14h-2v3h-3v2h3v3h2v-3h3v-2h-3z" />
                              </svg>
                              <span className="text-sm font-medium">Image</span>
                            </div>
                            {message.file_size && (
                              <span className="text-xs opacity-90">
                                {formatFileSize(message.file_size)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Caption */}
                      {message.message && !searchQuery && (
                        <div
                          className={`mt-2 p-3 rounded-lg ${isOwnMessage ? "bg-blue-50" : "bg-gray-50"}`}
                        >
                          <p
                            className={`text-sm ${isOwnMessage ? "text-blue-900" : "text-gray-800"}`}
                          >
                            {message.message}
                          </p>
                        </div>
                      )}
                      {searchQuery && message.message && (
                        <div className="mt-2">
                          <div
                            className="message-content"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(
                                message.message,
                                searchQuery,
                              ),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : isVideoMessage ? (
                    <div className="video-message">
                      <div
                        className={`relative rounded-xl overflow-hidden shadow-md ${isOwnMessage ? "border-2 border-purple-200" : "border-2 border-gray-200"}`}
                      >
                        <video
                          controls
                          className="w-full h-auto rounded-lg"
                          style={{ maxWidth: "320px", maxHeight: "320px" }}
                          poster={message.thumbnail_url || undefined}
                        >
                          <source src={message.file_url} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        {/* Video info overlay */}
                        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                          <div className="flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M18 9.5V5c0-1.103-.897-2-2-2H4c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-4.5l4 4.5V5l-4 4.5z" />
                            </svg>
                            <span>Video</span>
                          </div>
                        </div>
                        {/* Bottom info */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                          {/* <div className="flex items-center justify-between text-white">
                             
                              {message.file_size && (
                                <span className="text-xs opacity-90">
                                  {formatFileSize(message.file_size)}
                                </span>
                              )}
                            </div> */}
                          {message.duration && (
                            <div className="text-xs opacity-90 mt-1">
                              Duration: {formatVoiceDuration(message.duration)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isFileMessage ? (
                    <div className="file-message">
                      <div
                        className={`relative rounded-xl overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer group ${isOwnMessage ? "border border-blue-200" : "border border-gray-200"}`}
                        onClick={() =>
                          onDownload(message.file_url, message.file_name)
                        }
                      >
                        <div
                          className={`p-4 flex items-center gap-4 ${isOwnMessage ? "bg-blue-50" : "bg-white"}`}
                        >
                          {/* File icon with background */}
                          <div
                            className={`relative flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${isOwnMessage ? "bg-blue-100" : "bg-gray-100"} group-hover:scale-105 transition-transform`}
                          >
                            <div className="text-3xl">
                              {getFileIcon(message.file_type)}
                            </div>
                            {/* <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs ${isOwnMessage ? 'bg-blue-500 text-white' : 'bg-gray-700 text-white'}`}>
                                {getFileExtensionIcon(message.file_type)}
                              </div> */}
                          </div>

                          {/* File info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              {/* <h4 className={`font-semibold text-sm truncate ${isOwnMessage ? 'text-blue-900' : 'text-gray-900'}`}>
                                  {message.file_name || 'Download file'}
                                </h4> */}
                              <svg
                                className={`w-4 h-4 flex-shrink-0 ml-2 ${isOwnMessage ? "text-blue-500" : "text-gray-500"} group-hover:translate-x-1 transition-transform`}
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
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              {/* {message.file_type && (
                                  <span className={`px-2 py-0.5 rounded-full ${isOwnMessage ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>
                                    {message.file_type.toUpperCase()}
                                  </span>
                                )} */}

                              {message.file_size && (
                                <span
                                  className={`font-medium ${isOwnMessage ? "text-blue-700" : "text-gray-600"}`}
                                >
                                  {formatFileSize(message.file_size)}
                                </span>
                              )}
                            </div>

                            {/* Progress bar for downloading files */}
                            {message.downloadProgress !== undefined && (
                              <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${message.downloadProgress}%`,
                                    }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Downloading... {message.downloadProgress}%
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Download button overlay on hover */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isOwnMessage ? "from-blue-600/50" : ""}`}
                        >
                          <div
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${isOwnMessage ? "bg-white text-blue-600" : "bg-white text-gray-700"}`}
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
                            <span className="font-semibold text-sm">
                              Download
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* File description/caption */}
                      {message.message && !searchQuery && (
                        <div
                          className={`mt-2 p-3 rounded-lg ${isOwnMessage ? "bg-blue-50" : "bg-gray-50"}`}
                        >
                          <p
                            className={`text-sm ${isOwnMessage ? "text-blue-900" : "text-gray-800"}`}
                          >
                            {message.message}
                          </p>
                        </div>
                      )}
                      {searchQuery && message.message && (
                        <div className="mt-2">
                          <div
                            className="message-content"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(
                                message.message,
                                searchQuery,
                              ),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : codeData ? (
                    <CodeSnippet
                      codeData={codeData}
                      successToast={successToast}
                    />
                  ) : (
                    // Regular text message - only show if not deleted
                    !isDeletedMessage && (
                      <div className="text-message">
                        {searchQuery && message.message ? (
                          <div
                            className="message-content"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(
                                message.message,
                                searchQuery,
                              ),
                            }}
                          />
                        ) : (
                          <>
                            {/* // <div className="message-content">
                          //   {message.message}
                          // </div> */}
                            {/* Render message content with mentions */}
                            {renderMessageContent()}
                          </>
                        )}
                      </div>
                    )
                  )}

                  {!isDeletedMessage && (
                    <div
                      className={`flex items-center gap-2 mt-1 text-xs ${
                        isOwnMessage ? "justify-end" : "justify-start"
                      } ${isOwnMessage ? "text-blue-100" : "text-gray-500"}`}
                    >
                      <span>
                        {formatTime(message.created_at || message.createdAt)}
                      </span>

                      {message.is_edited && (
                        <span className="italic opacity-75">edited</span>
                      )}

                      {isOwnMessage &&
                        !isDeletedMessage &&
                        !isDeletedMessageForEveryone && (
                          <>
                            {isSending ? (
                              <span className="opacity-70">Sending...</span>
                            ) : failed ? (
                              <button
                                onClick={() => onRetryMessage(message)}
                                className="text-red-300 hover:text-red-100 cursor-pointer"
                              >
                                Retry
                              </button>
                            ) : (
                              <>{renderReadReceipt(message)}</>
                            )}
                          </>
                        )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Message menu button */}
            {!isDeletedMessage &&
              !isDeletedMessageForEveryone &&
              !isEditing && (
                <button
                  onClick={(e) => onMessageMenu(message, e)}
                  className="message-menu-button opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-gray-200 cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 text-gray-500"
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
                  {/* Message menu */}
                  {renderMessageMenu &&
                    renderMessageMenu(message, menuPosition)}
                </button>
              )}
          </div>
        )}
        {!isOwnMessage && message.message_type === "text" && (
          <MessageTranslation
            message={message.message}
            originalLanguage={message.detectedLanguage}
            targetLanguage={userLanguage}
            autoTranslate={autoTranslate}
          />
        )}

        {/* Add AI Suggestions ONLY for the absolute last message from other users */}
        {!isOwnMessage &&
          !isDeletedMessage &&
          !isDeletedMessageForEveryone &&
          !isCallMessageType &&
          message.message_type === "text" &&
          message.message &&
          message.message?.trim().length > 3 &&
          !editingMessage &&
          !isEditing &&
          isLastMessage && (
            <AISuggestions
              message={message.message}
              messageId={message._id}
              chatContext={chatContext}
              onSuggestionSelect={handleSuggestionSelect}
              isOwnMessage={isOwnMessage}
            />
          )}
      </div>
    );
  };

  // ========== FINAL RENDER ==========
  const groupedMessages = groupMessagesByDate();

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto p-4 relative"
      style={
        wallpaper
          ? {
              backgroundImage: `url(${wallpaper})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : {}
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" />
        </div>
      ) : messagesToDisplay.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
              {searchQuery ? "No search results found" : "No Messages Yet"}
            </h3>
            <p className="text-gray-500">
              {searchQuery
                ? "Try a different search term"
                : "Send a message to start the conversation"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* a spacer at the top for better infinite scroll UX */}
          <div className="min-h-[20px]" />

          {hasMoreMessages && onLoadOlderMessages && !isSearchingMode && (
            <div className="flex justify-center py-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onLoadOlderMessages && !isLoadingMore) {
                    onLoadOlderMessages();
                  }
                }}
                disabled={isLoadingMore}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
              >
                {isLoadingMore ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    Loading...
                  </span>
                ) : (
                  "Load older messages"
                )}
              </button>
            </div>
          )}

          {/* Search results banner */}
          {searchQuery && searchResults.length > 0 && isSearchingMode && (
            <div className="sticky top-0 z-10 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 mx-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600"
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
                  <span className="text-sm font-medium text-blue-800">
                    Found {searchResults.length} results for "{searchQuery}"
                  </span>
                </div>
              </div>
            </div>
          )}

          {Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date} className="date-group">
              <div className="flex justify-center mb-4">
                <div className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                  {date}
                </div>
              </div>
              {dateMessages.map((message, index) =>
                renderMessage(message, index),
              )}
            </div>
          ))}

          {/* spacer at the bottom */}
          <div className="min-h-[20px]" />

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
