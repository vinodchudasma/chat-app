"use client";

import { useState } from "react";
import { semanticSearchAPI } from "../../lib/api";
import { successToast, errorToast } from "../toast";

export default function ConversationSummary({ chat, currentUserId }) {
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateSummary = async () => {
    if (!chat) return;

    setLoading(true);
    try {
      const response = await semanticSearchAPI.getConversationSummary({
        chatId: chat._id,
        chatType: chat.type,
        messageCount: 50,
      });

      if (response.data.success) {
        setSummary(response.data);
        setShowSummary(true);
        successToast("Conversation summary generated", "success");
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      errorToast("Failed to generate summary", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!chat) return null;

  return (
    <>
      <button
        onClick={generateSummary}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {loading ? "Generating..." : "AI Summary"}
      </button>

      {showSummary && summary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Conversation Summary
                </h3>
                <button
                  onClick={() => setShowSummary(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
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

              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {summary.summary}
                  </p>
                </div>

                <div className="flex justify-between text-sm text-gray-500">
                  <span>{summary.message_count} messages analyzed</span>
                  <span>
                    {new Date(summary.time_range.start).toLocaleDateString()} -{" "}
                    {new Date(summary.time_range.end).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowSummary(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
