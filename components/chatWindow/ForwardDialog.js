"use client";

import { useState, useEffect, useRef } from "react";
import Portal from "./Portal";

export default function ForwardDialog({
  showForwardDialog,
  selectedMessage,
  selectedForwardChat,
  availableChats,
  forwarding,
  onClose,
  onSetSelectedForwardChat,
  onForward,
  onMessageMenu,
}) {
  const [localSelectedChat, setLocalSelectedChat] = useState(null);
  const dialogRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // Handle animation state
  useEffect(() => {
    if (showForwardDialog) {
      // Small delay to ensure DOM is ready before showing animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
      setLocalSelectedChat(selectedForwardChat);
    } else {
      setIsVisible(false);
      setLocalSelectedChat(null);
    }
  }, [showForwardDialog, selectedForwardChat]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (showForwardDialog) {
      document.body.style.overflow = "hidden";
      // Prevent scrolling on the body
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "unset";
      document.body.style.position = "static";
      document.body.style.width = "auto";
    }

    return () => {
      document.body.style.overflow = "unset";
      document.body.style.position = "static";
      document.body.style.width = "auto";
    };
  }, [showForwardDialog]);

  // Handle chat selection
  const handleChatSelect = (chat) => {
    setLocalSelectedChat(chat);
    onSetSelectedForwardChat(chat);
  };

  // Handle forward
  const handleForward = () => {
    if (localSelectedChat) {
      onForward();
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === "Escape" && showForwardDialog) {
        onClose();
      }
    };

    if (showForwardDialog) {
      document.addEventListener("keydown", handleEscapeKey);
      return () => document.removeEventListener("keydown", handleEscapeKey);
    }
  }, [showForwardDialog, onClose]);

  if (!showForwardDialog || !selectedMessage) return null;

  // Group chats by type
  const privateChats = availableChats.filter((chat) => chat.type === "private");
  const groupChats = availableChats.filter((chat) => chat.type === "group");

  const renderChatItem = (chat) => (
    <div
      key={`${chat.type}-${chat._id}`}
      onClick={() => handleChatSelect(chat)}
      className={`p-3 rounded-lg cursor-pointer transition-all duration-150 select-none ${
        localSelectedChat?._id === chat._id &&
        localSelectedChat?.type === chat.type
          ? "bg-blue-50 border border-blue-200 scale-[0.99]"
          : "hover:bg-gray-50 active:scale-[0.98]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              chat.type === "private"
                ? "bg-gradient-to-br from-green-500 to-blue-600"
                : "bg-gradient-to-br from-purple-500 to-pink-600"
            }`}
          >
            {chat.display_name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              chat.type === "private" ? "bg-green-500" : "bg-purple-500"
            }`}
          >
            {chat.type === "private" ? (
              <svg
                className="w-2 h-2 text-white mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-2 h-2 text-white mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">
            {chat.display_name || "Unnamed Chat"}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                chat.type === "private" ? "bg-green-500" : "bg-purple-500"
              }`}
            ></span>
            {chat.type === "private" ? "Private Chat" : "Group Chat"}
          </div>
        </div>

        {localSelectedChat?._id === chat._id &&
          localSelectedChat?.type === chat.type && (
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
      </div>
    </div>
  );

  return (
    <Portal>
      {/* Backdrop with smooth animation */}
      <div
        className={`fixed inset-0 bg-opacity-10 backdrop-blur-sm transition-all duration-200 flex items-center justify-center z-50 p-4 ${
          isVisible ? "bg-opacity-50" : "bg-opacity-0"
        }`}
        onClick={handleBackdropClick}
        style={{
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      >
        {/* Dialog container with smoother animation */}
        <div
          ref={dialogRef}
          className={`bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col transition-all duration-200 transform ${
            isVisible
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-4"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Forward Message
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-full hover:bg-gray-100 active:scale-95"
                disabled={forwarding}
              >
                <svg
                  className="w-6 h-6"
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

            <p className="text-gray-600 text-sm mb-4">
              Select a chat to forward this message to:
            </p>

            {/* Message preview */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1 font-medium">
                Forwarding:
              </div>
              <div className="text-sm text-gray-700 truncate flex items-center gap-2">
                {selectedMessage.message_type === "image" ? (
                  <>🖼️ Image: {selectedMessage.file_name || "Image"}</>
                ) : selectedMessage.message_type === "video" ? (
                  <>🎥 Video: {selectedMessage.file_name || "Video"}</>
                ) : selectedMessage.message_type === "file" ? (
                  <>📎 File: {selectedMessage.file_name || "File"}</>
                ) : selectedMessage.message_type === "code" ? (
                  <>💻 Code Snippet</>
                ) : selectedMessage.message_type === "audio" ? (
                  <>🎵 Voice Message</>
                ) : selectedMessage.message_type === "rich_text" ? (
                  <>📝 Formatted Message</>
                ) : (
                  selectedMessage.message || "Message"
                )}
              </div>
              {selectedMessage.sender && (
                <div className="text-xs text-gray-500 mt-2">
                  From:{" "}
                  <span className="font-medium">
                    {selectedMessage.sender.first_name}{" "}
                    {selectedMessage.sender.last_name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Chat list with sections */}
          <div className="flex-1 overflow-y-auto p-4">
            {availableChats.length === 0 ? (
              <div className="p-8 text-center">
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">
                  No chats available for forwarding
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Start new conversations to see them here
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Private Chats Section */}
                {privateChats.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <h4 className="text-sm font-medium text-gray-700">
                        Private Chats
                      </h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {privateChats.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {privateChats.map(renderChatItem)}
                    </div>
                  </div>
                )}

                {/* Group Chats Section */}
                {groupChats.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <h4 className="text-sm font-medium text-gray-700">
                        Group Chats
                      </h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {groupChats.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {groupChats.map(renderChatItem)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  onClose();
                  onMessageMenu();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={forwarding}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleForward();
                  onMessageMenu();
                }}
                disabled={!localSelectedChat || forwarding}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer flex items-center gap-2"
              >
                {forwarding ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Forwarding...
                  </>
                ) : (
                  "Forward Message"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
