"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { groupAPI } from "../lib/api";
import LoadingSpinner from "./LoadingSpinner";

export default function GroupChatWindow({ chat, socket, isConnected }) {
  console.log(chat, "chat33");

  const { userId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [groupDetails, setGroupDetails] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (chat) {
      setCurrentUserId(chat.currentUserId);
      loadMessages();
      loadGroupDetails();

      // Join group room
      if (socket) {
        socket.emit("join_group", chat._id);
      }

      // Set up message listeners
      if (socket) {
        socket.on("group_message", handleNewMessage);
      }

      return () => {
        if (socket) {
          socket.off("group_message", handleNewMessage);
          socket.emit("leave_group", chat._id);
        }
      };
    }
  }, [chat, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!chat) return;

    try {
      setLoading(true);
      const response = await groupAPI.getGroupMessages(chat._id);
      setMessages(response.data);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetails = async () => {
    if (!chat) return;

    try {
      const response = await groupAPI.getGroupDetails(chat._id);
      setGroupDetails(response.data);
    } catch (error) {
      console.error("Error loading group details:", error);
    }
  };

  const handleNewMessage = (message) => {
    if (message.group_id === chat._id) {
      setMessages((prev) => {
        const messageExists = prev.some(
          (msg) =>
            msg._id === message._id ||
            (msg.tempId && msg.tempId === message.tempId),
        );

        if (!messageExists) {
          return [...prev, message];
        }
        return prev;
      });
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected || !socket || !currentUserId) return;

    setSending(true);
    const messageToSend = newMessage.trim();

    // Create temporary message
    const tempMessage = {
      tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: messageToSend,
      sender_id: currentUserId,
      group_id: chat._id,
      message_type: "text",
      created_at: new Date().toISOString(),
      isSending: true,
      sender: {
        id: currentUserId,
        first_name: "You",
        last_name: "",
      },
    };

    // Add temporary message immediately
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    try {
      // Save to database
      const response = await groupAPI.sendGroupMessage(chat._id, {
        message: messageToSend,
        message_type: "text",
      });

      // Replace temporary message with real one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempMessage.tempId
            ? { ...response.data, tempId: undefined }
            : msg,
        ),
      );

      // Emit socket event
      socket.emit("group_message", {
        group_id: chat._id,
        message: messageToSend,
        message_id: response.data._id,
        sender_id: currentUserId,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // Mark message as failed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempMessage.tempId
            ? { ...msg, isSending: false, failed: true }
            : msg,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const isUserActiveMember = () => {
    if (!groupDetails?.members) return false;
    const userMember = groupDetails.members.find(
      (member) => parseInt(member.user._id) === parseInt(currentUserId),
    );
    return userMember && userMember.status === "accepted";
  };

  if (!chat) {
    return null;
  }

  const userCanSendMessages = isUserActiveMember();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header with Member Toggle */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <svg
                className="w-5 h-5 text-green-600"
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
            <div>
              <h2 className="font-semibold text-lg text-gray-900">
                {chat.name}
              </h2>
              <p className="text-sm text-gray-600">
                {groupDetails?.members?.filter((m) => m.status === "accepted")
                  .length || 0}{" "}
                members
                {chat.user_role === "admin" && " • You are admin"}
                {!userCanSendMessages && " • Pending approval"}
              </p>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="text-green-600 hover:text-green-800 text-sm bg-green-50 px-3 py-1 rounded transition-colors cursor-pointer"
            >
              {showMembers ? "Hide Members" : "Show Members"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages Area */}
        <div
          className={`flex-1 overflow-y-auto p-4 bg-gray-50 ${showMembers ? "w-2/3" : "w-full"}`}
        >
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <LoadingSpinner />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300"
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
              <p>
                No messages yet.{" "}
                {userCanSendMessages
                  ? "Start the conversation!"
                  : "You need to be accepted to participate."}
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwnMessage =
                parseInt(message.sender_id) === parseInt(currentUserId);

              return (
                <div
                  key={message._id || index}
                  className={`flex mb-3 ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex ${isOwnMessage ? "flex-row-reverse" : "flex-row"} items-end max-w-xs lg:max-w-md`}
                  >
                    {/* Avatar for received messages */}
                    {!isOwnMessage && (
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-2 mb-1 flex-shrink-0">
                        {message.sender?.profile_image ? (
                          <img
                            src={message.sender.profile_image}
                            alt={message.sender.first_name}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <svg
                            className="w-4 h-4 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        )}
                      </div>
                    )}

                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwnMessage
                          ? "bg-green-500 text-white rounded-br-md"
                          : "bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-200"
                      } ${message.isSending ? "opacity-70" : ""} ${
                        message.failed
                          ? "border-2 border-red-300 bg-red-50"
                          : ""
                      }`}
                    >
                      {/* Show sender name for group chats */}
                      {!isOwnMessage && (
                        <p className="text-xs font-semibold text-green-600 mb-1">
                          {message.sender?.first_name}{" "}
                          {message.sender?.last_name}
                        </p>
                      )}

                      <p className="break-words text-sm">{message.message}</p>

                      <div
                        className={`flex items-center justify-end mt-1 ${isOwnMessage ? "text-green-100" : "text-gray-500"}`}
                      >
                        <span className="text-xs">
                          {formatTime(message.created_at || message.createdAt)}
                        </span>
                        {isOwnMessage && message.isSending && (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin ml-1"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Members Sidebar */}
        {showMembers && (
          <div className="w-1/3 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-4">
                Group Members
              </h3>

              {groupDetails?.members ? (
                <div className="space-y-3">
                  {groupDetails.members.map((member) => (
                    <div
                      key={member.user._id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center">
                        <img
                          src={
                            member.user.profile_image || "/default-avatar.png"
                          }
                          alt={member.user.first_name}
                          className="w-8 h-8 rounded-full mr-3"
                        />
                        <div>
                          <p className="text-sm font-medium">
                            {member.user.first_name} {member.user.last_name}
                            {parseInt(member.user._id) ===
                              parseInt(currentUserId) && " (You)"}
                          </p>
                          <p className="text-xs text-gray-600">
                            {member.user.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          member.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : member.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : member.role === "admin"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-green-100 text-green-800"
                        }`}
                      >
                        {member.role === "admin"
                          ? "Admin"
                          : member.status === "pending"
                            ? "Pending"
                            : member.status === "rejected"
                              ? "Rejected"
                              : "Member"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <LoadingSpinner />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Message Input */}
      {userCanSendMessages ? (
        <form
          onSubmit={sendMessage}
          className="p-4 border-t border-gray-200 bg-white"
        >
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={!isConnected || sending}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || !isConnected || sending}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center cursor-pointer"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
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
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </div>

          {!isConnected && (
            <div className="text-red-600 text-sm mt-2 text-center">
              Connection lost. Trying to reconnect...
            </div>
          )}
        </form>
      ) : (
        <div className="p-4 border-t border-gray-200 bg-yellow-50 text-yellow-800 text-center">
          <p className="text-sm">
            You need to be accepted by an admin to send messages in this group.
          </p>
        </div>
      )}
    </div>
  );
}
