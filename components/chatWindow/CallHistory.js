"use client";

import { useState, useEffect } from "react";
import { callAPI } from "../lib/api";
import { successToast, errorToast } from "./toast";

export default function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Get current user ID from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem("currentUserId");
    if (storedUserId) {
      setCurrentUserId(parseInt(storedUserId));
    }
  }, []);

  const loadCallHistory = async () => {
    try {
      setLoading(true);
      const response = await callAPI.getCallHistory({
        page: 1,
        limit: 50,
      });

      if (response.data.success) {
        setCalls(response.data.calls || []);
      } else {
        console.error("Failed to load call history:", response.data);
        errorToast("Failed to load call history", "error");
      }
    } catch (error) {
      console.error(" Error loading call history:", error);
      errorToast("Failed to load call history", "error");
    } finally {
      setLoading(false);
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
      const response = await callAPI.deleteCall(callId);
      if (response.data.success) {
        successToast("Call deleted from history", "success");
        loadCallHistory();
      } else {
        errorToast("Failed to delete call", "error");
      }
    } catch (error) {
      console.error("Error deleting call:", error);
      errorToast("Failed to delete call", "error");
    }
  };

  useEffect(() => {
    loadCallHistory();
    loadStatistics();
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-50";
      case "rejected":
        return "text-red-600 bg-red-50";
      case "timeout":
        return "text-yellow-600 bg-yellow-50";
      case "failed":
        return "text-red-600 bg-red-50";
      case "active":
        return "text-blue-600 bg-blue-50";
      case "initiated":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getCallDirection = (call) => {
    if (!currentUserId || !call.caller_id) return "outgoing";
    return call.caller_id === currentUserId ? "outgoing" : "incoming";
  };

  const getParticipantName = (call) => {
    if (!currentUserId) return "Unknown";

    const isOutgoing = getCallDirection(call) === "outgoing";

    if (isOutgoing) {
      return call.receiver
        ? `${call.receiver.first_name || ""} ${call.receiver.last_name || ""}`.trim()
        : "Unknown User";
    } else {
      return call.caller
        ? `${call.caller.first_name || ""} ${call.caller.last_name || ""}`.trim()
        : "Unknown User";
    }
  };

  const getCallIcon = (callType, direction) => {
    if (callType === "video") {
      return direction === "outgoing" ? "🎥 ➡️" : "🎥 ⬅️";
    } else {
      return direction === "outgoing" ? "📞 ➡️" : "📞 ⬅️";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Call History</h2>
          <button
            onClick={loadCallHistory}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      {statistics && (
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-blue-600">
                {statistics.totalCalls || 0}
              </p>
              <p className="text-sm text-gray-600">Total Calls</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-green-600">
                {statistics.completedCalls || 0}
              </p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-purple-600">
                {formatDuration(statistics.totalDuration || 0)}
              </p>
              <p className="text-sm text-gray-600">Total Duration</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-yellow-600">
                {statistics.missedCalls || 0}
              </p>
              <p className="text-sm text-gray-600">Missed</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 overflow-y-auto max-h-[calc(100vh-300px)]">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading call history...</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-gray-600">No call history found</p>
            <p className="text-gray-400 text-sm mt-1">
              Your call history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => {
              const direction = getCallDirection(call);
              const participantName = getParticipantName(call);

              return (
                <div
                  key={call._id || call.call_id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl">
                        {getCallIcon(call.call_type, direction)}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full mt-1 ${getStatusColor(call.status)}`}
                      >
                        {direction}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-medium text-gray-900 truncate">
                          {participantName}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-gray-600">
                          {new Date(
                            call.initiated_at || call.created_at,
                          ).toLocaleDateString()}
                        </p>
                        <span className="text-gray-400">•</span>
                        <p className="text-sm text-gray-600">
                          {new Date(
                            call.initiated_at || call.created_at,
                          ).toLocaleTimeString()}
                        </p>
                        {call.duration > 0 && (
                          <>
                            <span className="text-gray-400">•</span>
                            <p className="text-sm text-gray-600">
                              {formatDuration(call.duration)}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(call.status)}`}
                        >
                          {call.status.charAt(0).toUpperCase() +
                            call.status.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">
                          {call.call_type} call
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteCall(call.call_id || call._id)}
                    className="text-gray-400 hover:text-red-600 p-2 transition-colors rounded-full hover:bg-red-50 cursor-pointer"
                    title="Delete call from history"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
