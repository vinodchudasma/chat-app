"use client";

import { useState, useEffect } from "react";
import { moderationAPI } from "../lib/api";
import { successToast, errorToast } from "./toast";

export default function ModerationSettings() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("stats");

  useEffect(() => {
    loadModerationStats();
  }, []);

  const loadModerationStats = async () => {
    setLoading(true);
    try {
      const response = await moderationAPI.getModerationStats();
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error("Error loading moderation stats:", error);
      errorToast("Failed to load moderation statistics", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadModerationLogs = async () => {
    setLoading(true);
    try {
      const response = await moderationAPI.getModerationLogs();
      if (response.data.success) {
        setLogs(response.data.logs);
      }
    } catch (error) {
      console.error("Error loading moderation logs:", error);
      errorToast("Failed to load moderation logs", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "logs") {
      loadModerationLogs();
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => handleTabChange("stats")}
            className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "stats"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => handleTabChange("logs")}
            className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "logs"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Moderation History
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "stats" && stats && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Content Moderation Overview
              </h3>

              {/* Compliance Rate */}
              <div className="bg-green-50 p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Compliance Rate
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {stats.compliance_rate}%
                    </p>
                  </div>
                  <div className="text-green-600">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Total Messages
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total_messages}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Flagged Messages
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.flagged_messages}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Blocked Messages
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.blocked_messages}
                  </p>
                </div>
              </div>
            </div>

            {/* Guidelines */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                Community Guidelines
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Be respectful and kind to other users</li>
                <li>Avoid hate speech, harassment, or bullying</li>
                <li>Do not share violent or harmful content</li>
                <li>Respect everyone's privacy and boundaries</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Moderation History
            </h3>

            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="mt-2">No moderation events found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className={`p-3 border rounded-lg ${
                      log.blocked
                        ? "bg-red-50 border-red-200"
                        : log.flagged
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-1">
                          {log.message_text || "Message content not available"}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                          {log.blocked && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                              Blocked
                            </span>
                          )}
                          {log.flagged && !log.blocked && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                              Flagged
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
