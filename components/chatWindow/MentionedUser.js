import React from "react";

const MentionedUser = ({ user, onRemove, isRemovable = false }) => {
  const displayName = user.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user.username || "User";

  return (
    <div className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-sm mx-1 my-0.5">
      <span className="font-medium">@{displayName}</span>

      {isRemovable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(user._id);
          }}
          className="ml-1.5 text-blue-600 hover:text-blue-800 cursor-pointer"
          aria-label={`Remove ${displayName}`}
        >
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default MentionedUser;
