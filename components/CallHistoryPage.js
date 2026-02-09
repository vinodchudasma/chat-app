"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { callAPI } from "../lib/api";
import { successToast, errorToast } from "./toast";

export default function CallHistoryPage() {
  const { userId } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [filter, setFilter] = useState("all"); // all, voice, video, missed
  const [currentUserId, setCurrentUserId] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasMore: false,
  });

  useEffect(() => {
    // Get current user ID from localStorage or auth
    const storedUserId = localStorage.getItem("currentUserId");
    if (storedUserId) {
      setCurrentUserId(parseInt(storedUserId));
    }
  }, [userId]);

  useEffect(() => {
    if (currentUserId) {
      // Reset pagination when filter changes
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        hasMore: false,
      });
      setCalls([]);
      loadCallHistory(1, true);
      loadStatistics();
    }
  }, [filter, currentUserId]);

  const loadCallHistory = async (page = 1, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const params = {
        page: page,
        limit: 50,
      };

      if (filter !== "all") {
        if (filter === "missed") {
          params.status = "missed";
        } else {
          params.type = filter;
        }
      }

      const response = await callAPI.getCallHistory(params);

      if (response.data.success) {
        const newCalls = response.data.calls || [];

        // Check if we got empty array (last page)
        if (newCalls.length === 0 && !reset) {
          setPagination((prev) => ({
            ...prev,
            hasMore: false,
          }));
          return;
        }

        if (reset) {
          setCalls(newCalls);
        } else {
          setCalls((prev) => [...prev, ...newCalls]);
        }

        setPagination({
          currentPage: response.data.currentPage || page,
          totalPages: response.data.totalPages || 1,
          totalCount: response.data.totalCount || newCalls.length,
          hasMore:
            (response.data.currentPage || page) <
              (response.data.totalPages || 1) && newCalls.length > 0,
        });
      }
    } catch (error) {
      console.error("Error loading call history:", error);
      if (reset) {
        errorToast("Failed to load call history", "error");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && pagination.hasMore) {
      loadCallHistory(pagination.currentPage + 1, false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await callAPI.getCallStatistics();
      if (response.data.success) {
        setStatistics(response.data);
      }
    } catch (error) {
      console.error("Error loading call statistics:", error);
    }
  };

  const deleteCall = async (callId) => {
    try {
      await callAPI.deleteCall(callId);
      successToast("Call deleted from history", "success");

      // Reload current page after deletion
      loadCallHistory(pagination.currentPage, true);
    } catch (error) {
      console.error("Error deleting call:", error);
      errorToast("Failed to delete call", "error");
    }
  };

  const clearAllHistory = async () => {
    if (
      !confirm(
        "Are you sure you want to clear all call history? This action cannot be undone.",
      )
    )
      return;

    try {
      await callAPI.clearCallHistory();
      successToast("Call history cleared", "success");
      // Reset everything
      setCalls([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        hasMore: false,
      });
      loadStatistics();
    } catch (error) {
      console.error("Error clearing call history:", error);
      errorToast("Failed to clear call history", "error");
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    const now = new Date();

    // For sidebar view, show shorter time format
    const time = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // If today, just show time
    if (date.toDateString() === now.toDateString()) {
      return time;
    }

    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${time}`;
    }

    // If within this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
      return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
    }

    // Otherwise show full date
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    if (!status) return "text-gray-600";
    switch (status.toLowerCase()) {
      case "completed":
        return "text-green-600";
      case "missed":
        return "text-red-600";
      case "rejected":
        return "text-orange-600";
      case "cancelled":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusText = (status) => {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Helper function to determine call direction and participant
  const getCallParticipantInfo = (call) => {
    if (!currentUserId || !call)
      return { direction: "unknown", participant: null };

    const isCaller = call.caller_id === currentUserId;
    const participant = isCaller ? call.receiver : call.caller;

    return {
      direction: isCaller ? "outgoing" : "incoming",
      participant: participant,
      isCaller: isCaller,
    };
  };

  // Get initials from name with null safety
  const getInitials = (firstName = "", lastName = "") => {
    const first = (firstName && firstName.charAt(0)) || "";
    const last = (lastName && lastName.charAt(0)) || "";
    const initials = (first + last).toUpperCase();
    return initials || "??";
  };

  // Safe access to call properties
  const getCallType = (call) => {
    return (call?.call_type || "voice").toLowerCase();
  };

  const getCallStatus = (call) => {
    return (call?.status || "unknown").toLowerCase();
  };

  const getCallDuration = (call) => {
    return call?.duration || 0;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - Compact for sidebar */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Call History</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Recent calls and statistics
            </p>
          </div>
          <button
            onClick={clearAllHistory}
            className="px-3 py-1.5 text-xs text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer font-medium"
          >
            Clear All
          </button>
        </div>

        {/* Statistics - Compact version */}
        {statistics && (
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {pagination.totalCount || statistics.totalCalls || calls.length}
              </p>
              <p className="text-xs text-gray-600 mt-1">Total Calls</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {statistics.completedCalls || 0}
              </p>
              <p className="text-xs text-gray-600 mt-1">Completed</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">
                {statistics.missedCalls || 0}
              </p>
              <p className="text-xs text-gray-600 mt-1">Missed</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {formatDuration(statistics.totalDuration || 0)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Duration</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters - Compact */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {[
            { key: "all", label: "All" },
            { key: "voice", label: "Voice" },
            { key: "video", label: "Video" },
            { key: "missed", label: "Missed" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                filter === key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Call List - Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {loading && calls.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-3 text-sm">Loading calls...</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              No calls found
            </h3>
            <p className="text-gray-500 text-xs">
              Your call history will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {calls.map((call, index) => {
                if (!call) return null; // Skip null calls

                const { direction, participant, isCaller } =
                  getCallParticipantInfo(call);
                const initials = getInitials(
                  participant?.first_name,
                  participant?.last_name,
                );
                const callType = getCallType(call);
                const callStatus = getCallStatus(call);
                const duration = getCallDuration(call);

                return (
                  <div
                    key={`${call._id || index}-${call.initiated_at || index}`}
                    className="p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with status */}
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                          {initials}
                        </div>
                        <div
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-xs ${
                            callType === "video"
                              ? "bg-purple-500"
                              : "bg-blue-500"
                          }`}
                        >
                          {callType === "video" ? "📹" : "📞"}
                        </div>
                      </div>

                      {/* Call details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {participant
                                ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim() ||
                                  "Unknown Contact"
                                : "Unknown Contact"}
                            </p>
                          </div>
                          {call._id && (
                            <button
                              onClick={() =>
                                deleteCall(call.call_id || call._id)
                              }
                              className="text-gray-400 hover:text-red-600 p-1 transition-colors cursor-pointer flex-shrink-0 ml-1"
                              title="Delete"
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
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${getStatusColor(callStatus)}`}
                          >
                            {getStatusText(callStatus)}
                          </span>
                          {direction !== "unknown" && (
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                direction === "outgoing"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {direction === "outgoing" ? "Out" : "In"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            {formatDate(call.initiated_at || call.created_at)}
                          </span>
                          {duration > 0 && (
                            <span className="font-medium">
                              {formatDuration(duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {pagination.hasMore && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-2.5 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Loading more calls...
                    </>
                  ) : (
                    <>
                      Load More Calls
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Showing {calls.length} of {pagination.totalCount}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Summary */}
      {calls.length > 0 && !loading && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>
                Showing {calls.length} of {pagination.totalCount}
              </span>
              {pagination.currentPage > 0 && pagination.totalPages > 1 && (
                <span className="px-2 py-0.5 bg-gray-200 rounded-full">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
              )}
            </div>
            <button
              onClick={() => loadCallHistory(1, true)}
              className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium flex items-center gap-1"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
