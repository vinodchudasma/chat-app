// components/chatWindow/MentionSuggestions.jsx
import React, { useEffect, useRef } from "react";

const MentionSuggestions = ({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  isLoading,
  searchQuery,
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Ensure suggestions are visible
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [suggestions]);

  if (!suggestions || suggestions.length === 0 || !position) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed bg-white shadow-2xl rounded-lg border border-gray-200 z-[10000] w-64 max-h-80 overflow-y-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="py-2">
        <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-gray-100">
          Mention Group Members
          {searchQuery && (
            <span className="text-gray-400 ml-1">
              ({suggestions.length} results)
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="px-3 py-4 text-center">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm text-gray-500">Loading...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-3 py-3 text-sm text-gray-500 text-center">
            No members found
          </div>
        ) : (
          suggestions.map((user, index) => (
            <div
              key={`mention-suggestion-${user._id}-${index}`}
              className={`px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                index === selectedIndex ? "bg-blue-50" : ""
              }`}
              onClick={() => onSelect(user)}
            >
              <div className="flex-shrink-0">
                {user.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt={user.first_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-sm">
                      {user.first_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  @{user.username || user.first_name?.toLowerCase()}
                </div>
              </div>

              <div className="flex-shrink-0">
                {index === selectedIndex && (
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
          ))
        )}

        <div className="px-3 py-2 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            Press{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">↑↓</kbd> to
            navigate,{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd>{" "}
            to select,{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd>{" "}
            to dismiss
          </div>
        </div>
      </div>
    </div>
  );
};

export default MentionSuggestions;
