"use client";

import { useState, useEffect } from "react";
import { userAPI } from "../lib/api";

const LoadingSpinner = ({ size = "medium" }) => (
  <div
    className={`${size === "small" ? "w-4 h-4" : "w-8 h-8"} border-2 border-blue-600 border-t-transparent rounded-full animate-spin`}
  ></div>
);

export default function UserProfileModal({
  userId,
  isOpen,
  onClose,
  chatData,
  onStartChat,
}) {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile();
    }
  }, [isOpen, userId]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError("");

      if (chatData && chatData.other_user) {
        setUserProfile({
          id: chatData.other_user._id,
          username: chatData.other_user.username,
          first_name: chatData.other_user.first_name,
          last_name: chatData.other_user.last_name,
          profile_image: chatData.other_user.profile_image,
          email: chatData.other_user.email || "",
          bio: chatData.other_user.bio || "",
          is_online: chatData.other_user.is_online,
          last_seen: chatData.other_user.last_seen,
          status: chatData.other_user.status || "offline",
        });
        setLoading(false);
        return;
      }

      const response = await userAPI.getUserProfile(userId);
      setUserProfile(response.data);
    } catch (error) {
      console.error("Error loading user profile:", error);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleMessageClick = () => {
    if (userProfile) {
      onClose();

      if (onStartChat) {
        if (chatData) {
          onStartChat(chatData);
        } else {
          const chatObject = {
            type: "private",
            id: userProfile._id,
            name:
              `${userProfile.first_name} ${userProfile.last_name}`.trim() ||
              userProfile.username,
            other_user: {
              id: userProfile._id,
              username: userProfile.username,
              first_name: userProfile.first_name,
              last_name: userProfile.last_name,
              profile_image: userProfile.profile_image,
              is_online: userProfile.is_online,
            },
            receiverId: userProfile._id,
          };
          onStartChat(chatObject);
        }
      }
    }
  };

  const handleShare = () => {
    const profileUrl = `${window.location.origin}/profile/${userProfile.username}`;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLastSeen = (lastSeenDate) => {
    if (!lastSeenDate) return "";
    const date = new Date(lastSeenDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-opacity-10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={loadUserProfile}
                className="mt-3 text-blue-600 text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          ) : userProfile ? (
            <div className="space-y-5">
              {/* Profile Header */}
              <div className="text-center pb-4 border-b">
                <div className="relative inline-block mb-3">
                  <img
                    src={userProfile.profile_image || "/default-avatar.png"}
                    alt={userProfile.username}
                    className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
                  />
                  <div
                    className={`absolute bottom-1 right-1 w-5 h-5 border-2 border-white rounded-full ${
                      userProfile.is_online ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-1">
                  {userProfile.first_name} {userProfile.last_name}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  @{userProfile.username}
                </p>

                {/* Status */}
                <div className="inline-flex items-center gap-2 text-xs mb-3">
                  <span
                    className={`px-2.5 py-1 rounded-full font-medium ${
                      userProfile.is_online
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                        userProfile.is_online ? "bg-green-500" : "bg-gray-400"
                      }`}
                    ></span>
                    {userProfile.is_online
                      ? "Online"
                      : formatLastSeen(userProfile.last_seen)}
                  </span>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleMessageClick}
                    className="flex-1 max-w-[140px] bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
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
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    Message
                  </button>

                  <button
                    onClick={handleShare}
                    className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm flex items-center gap-2"
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
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    {copied ? "Copied!" : "Share"}
                  </button>
                </div>
              </div>

              {/* Profile Information */}
              <div className="space-y-3">
                {/* Email */}
                {userProfile.email && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">
                          Email
                        </p>
                        <p className="text-sm text-gray-900 break-all">
                          {userProfile.email}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bio */}
                {userProfile.bio && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">
                          About
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {userProfile.bio}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity Status */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 mb-0.5">
                        Status
                      </p>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            userProfile.is_online
                              ? "bg-green-500"
                              : "bg-gray-400"
                          }`}
                        ></div>
                        <p className="text-sm text-gray-700">
                          {userProfile.is_online
                            ? "Active now"
                            : `Last seen ${formatLastSeen(userProfile.last_seen)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No profile data available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && userProfile && (
          <div className="px-6 py-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="w-full bg-white text-gray-700 py-2.5 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm border border-gray-200"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
