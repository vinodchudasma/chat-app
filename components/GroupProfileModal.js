"use client";

import { useState, useEffect } from "react";
import { groupAPI, userAPI } from "../lib/api";
import LoadingSpinner from "./LoadingSpinner";
import { successToast, errorToast } from "./toast";

export default function GroupProfileModal({
  groupId,
  isOpen,
  onClose,
  groupData,
  currentUserId,
  socket,
}) {
  const [groupDetails, setGroupDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && groupId) {
      loadGroupDetails();
    }
  }, [isOpen, groupId]);

  const loadGroupDetails = async () => {
    try {
      setLoading(true);
      setError("");

      console.log("groupData", groupData);

      const userRole =
        groupData?.created_by == currentUserId ? "admin" : "member";

      if (groupData) {
        setGroupDetails({
          id: groupData?._id,
          name: groupData?.name,
          description: groupData?.description,
          created_by: groupData?.created_by,
          created_at: groupData?.created_at,
          member_count: groupData?.member_count,
          is_public: groupData?.is_public,
          user_role: userRole,
        });
      }

      // Then fetch detailed info
      const response = await groupAPI.getGroupDetails(groupId);
      const groupInfo = response?.data;

      setGroupDetails({
        ...groupDetails,
        ...groupInfo,
        user_role: userRole,
      });

      // Get members
      if (groupInfo?.members) {
        const sortedMembers = [...groupInfo?.members].sort((a, b) => {
          // Admins first, then alphabetically by name
          if (a?.role === "admin" && b?.role !== "admin") return -1;
          if (a?.role !== "admin" && b?.role === "admin") return 1;
          return a?.user?.username?.localeCompare(b?.user?.username);
        });
        setMembers(sortedMembers);

        // Find creator
        const creatorMember = groupInfo?.members?.find(
          (member) => member?.user?._id === groupInfo?.created_by,
        );
        if (creatorMember) {
          setCreator(creatorMember.user);
        }
      }
    } catch (error) {
      console.error("Error loading group details:", error);
      setError("Failed to load group details");
    } finally {
      setLoading(false);
    }
  };

  // Member management functions
  const searchUsers = async (query) => {
    setMemberSearch(query);
    setMemberError("");

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await userAPI.searchUsersForGroup(query, groupId);

      // Filter out users who are already members
      const currentMemberIds = members.map((member) => member?.user?._id);
      const filteredResults = response.data.filter(
        (user) => !currentMemberIds.includes(user?._id),
      );

      setSearchResults(filteredResults);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
      setMemberError("Failed to search users");
    } finally {
      setSearchLoading(false);
    }
  };

  const inviteMember = async (userId, userName) => {
    try {
      setMemberError("");
      const response = await groupAPI.addMember(groupId, userId);

      // Emit socket event for real-time notification
      if (socket) {
        socket.emit("group_invitation_sent", {
          group_id: groupId,
          to_user_id: userId,
          from_user_id: currentUserId,
          invitation_id: response?.data?._id,
        });
      }

      // Show success message
      successToast(`Invitation sent to ${userName}!`);

      // Clear search results and input
      setSearchResults([]);
      setMemberSearch("");

      // Reload group details
      await loadGroupDetails();
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to send invitation";
      setMemberError(errorMessage);
      errorToast(errorMessage);
    }
  };

  const removeMember = async (userId, userName) => {
    if (
      confirm(`Are you sure you want to remove ${userName} from the group?`)
    ) {
      try {
        const response = await groupAPI.removeMember(groupId, userId);
        if (response.data.success) {
          successToast(`${userName} removed from group`);

          // Reload group details
          await loadGroupDetails();

          // If the removed member is the current user, close modal
          if (parseInt(userId) === parseInt(currentUserId)) {
            onClose();
          }
        }
      } catch (error) {
        const errorMessage =
          error.response?.data?.error || "Failed to remove member";
        errorToast(errorMessage);

        if (error.response?.data?.code === "ONLY_ADMIN") {
          errorToast(
            "You are the only admin. Assign another admin before removing yourself.",
          );
        }
      }
    }
  };

  const makeAdmin = async (userId, userName) => {
    if (confirm(`Make ${userName} a group admin?`)) {
      try {
        const response = await groupAPI.makeAdmin(groupId, userId);
        if (response.data.success) {
          successToast(`${userName} is now an admin`);
          await loadGroupDetails();
        }
      } catch (error) {
        const errorMessage =
          error.response?.data?.error || "Failed to make admin";
        errorToast(errorMessage);
      }
    }
  };

  const removeAdmin = async (userId, userName) => {
    if (confirm(`Remove ${userName} from admin role?`)) {
      try {
        const response = await groupAPI.removeAdmin(groupId, userId);
        if (response.data.success) {
          successToast(`${userName} is no longer an admin`);
          await loadGroupDetails();
        }
      } catch (error) {
        const errorMessage =
          error.response?.data?.error || "Failed to remove admin";
        errorToast(errorMessage);
      }
    }
  };

  const leaveGroup = async () => {
    if (confirm("Are you sure you want to leave this group?")) {
      try {
        const response = await groupAPI.leaveGroup(groupId);
        if (response.data.success) {
          successToast("You have left the group");
          onClose();
        }
      } catch (error) {
        const errorMessage =
          error.response?.data?.error || "Failed to leave group";
        if (error.response?.data?.code === "ONLY_ADMIN") {
          errorToast(
            "You are the only admin. Please assign another admin before leaving.",
          );
        } else {
          errorToast(errorMessage);
        }
      }
    }
  };

  const deleteGroup = async () => {
    if (
      confirm(
        "Are you sure you want to delete this group? This action cannot be undone and all messages will be lost.",
      )
    ) {
      try {
        const response = await groupAPI.deleteGroup(groupId);
        if (response.data.success) {
          successToast("Group deleted successfully");
          onClose();
        }
      } catch (error) {
        const errorMessage =
          error.response?.data?.error || "Failed to delete group";
        errorToast(errorMessage);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/groups/${groupId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    successToast("Group link copied to clipboard!");
  };

  const isCurrentUserAdmin = groupDetails?.user_role === "admin";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-opacity-10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Group Details</h2>
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
                onClick={loadGroupDetails}
                className="mt-3 text-blue-600 text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          ) : groupDetails ? (
            <div className="space-y-5">
              {/* Group Info */}
              <div className="text-center pb-4 border-b">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold mb-3">
                  {groupDetails.name?.charAt(0).toUpperCase() || "G"}
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-1">
                  {groupDetails.name}
                </h3>

                {groupDetails.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {groupDetails.description}
                  </p>
                )}

                <div className="flex items-center justify-center gap-2 text-xs">
                  <span
                    className={`px-2.5 py-1 rounded-full font-medium ${
                      groupDetails.is_public
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {groupDetails.is_public ? "Public" : "Private"}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                    {members.length} members
                  </span>
                  {isCurrentUserAdmin && (
                    <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">
                      Admin
                    </span>
                  )}
                </div>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
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
                  {copied ? "Copied!" : "Share Group"}
                </button>
              </div>

              {/* Creator Info */}
              {creator && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Created by
                  </p>
                  <div className="flex items-center gap-3">
                    <img
                      src={creator?.profile_image}
                      alt={creator?.username}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {creator?.first_name} {creator?.last_name}
                      </p>
                      <p className="font-medium text-sm text-gray-900 truncate">
                        @{creator?.username}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {creator?.email}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(groupDetails?.created_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* Members Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-sm text-gray-900">
                    Members ({members.length})
                  </h4>
                  {isCurrentUserAdmin && (
                    <button
                      onClick={() => setShowAddMember(!showAddMember)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {showAddMember ? "Cancel" : "+ Add"}
                    </button>
                  )}
                </div>

                {/* Add Member */}
                {showAddMember && isCurrentUserAdmin && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="relative mb-2">
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={memberSearch}
                        onChange={(e) => searchUsers(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {searchLoading && (
                        <div className="absolute right-3 top-2.5">
                          <LoadingSpinner size="small" />
                        </div>
                      )}
                    </div>

                    {memberError && (
                      <div className="text-red-600 text-xs mb-2">
                        {memberError}
                      </div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {searchResults.map((user) => (
                          <div
                            key={user?._id}
                            className="flex items-center justify-between p-2 bg-white border rounded-lg"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <img
                                src={user?.profile_image}
                                alt={user?.first_name}
                                className="w-8 h-8 rounded-full"
                              />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {user?.first_name} {user?.last_name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {user?.email}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                inviteMember(
                                  user?._id,
                                  `${user?.first_name} ${user?.last_name}`,
                                )
                              }
                              className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors flex-shrink-0"
                            >
                              Invite
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Members List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {members.map((member) => (
                    <div
                      key={member.user?._id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <img
                        src={member.user?.profile_image}
                        alt={member.user?.username}
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {member.user?.first_name} {member.user?.last_name}
                          </p>
                          {member.role === "admin" && (
                            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          @{member.user?.username}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {member.user?.email}
                        </p>
                      </div>

                      {isCurrentUserAdmin &&
                        member.user?._id !== currentUserId && (
                          <div className="flex gap-1 flex-shrink-0">
                            {member.role !== "admin" &&
                              member.status !== "pending" && (
                                <button
                                  onClick={() =>
                                    makeAdmin(
                                      member.user?._id,
                                      member.user?.first_name,
                                    )
                                  }
                                  className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
                                  title="Make Admin"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
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
                                </button>
                              )}
                            {member?.role === "admin" && (
                              <button
                                onClick={() =>
                                  removeAdmin(
                                    member.user?._id,
                                    member.user?.first_name,
                                  )
                                }
                                className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                                title="Remove Admin"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
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
                            )}
                            <button
                              onClick={() =>
                                removeMember(
                                  member?.user?._id,
                                  member?.user?.first_name,
                                )
                              }
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                              title="Remove"
                            >
                              <svg
                                className="w-3.5 h-3.5"
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
                            </button>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t space-y-2">
                {isCurrentUserAdmin ? (
                  <>
                    <button
                      onClick={deleteGroup}
                      className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                    >
                      Delete Group
                    </button>
                    <button
                      onClick={leaveGroup}
                      className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                    >
                      Leave Group
                    </button>
                  </>
                ) : (
                  <button
                    onClick={leaveGroup}
                    className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                  >
                    Leave Group
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
