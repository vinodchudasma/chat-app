// 'use client';

// import React, { useRef, useEffect } from 'react';
// import MentionedUser from './MentionedUser';
// import MentionSuggestions from './MentionSuggestions';
// import AttachmentMenu from './AttachmentMenu';
// import StickerMenu from './StickerMenu';
// import TypingPredictions from './TypingPredictions';
// import CodeSnippetDialog from './CodeSnippetDialog';

// const MessageInput = ({
//   newMessage,
//   selectedFiles,
//   sending,
//   uploading,
//   isConnected,
//   showAttachmentMenu,
//   showStickerMenu,
//   showCodeSnippetMenu,
//   codeSnippet,
//   snippetLanguage,
//   fileInputRef,
//   attachmentMenuRef,
//   stickerMenuRef,
//   onSendMessage,
//   onInputChange,
//   onSetShowAttachmentMenu,
//   onSetShowStickerMenu,
//   onSetShowCodeSnippetMenu,
//   onSetCodeSnippet,
//   onSetSnippetLanguage,
//   onSendCodeSnippet,
//   onFileSelect,
//   onAddSticker,
//   stickers,
//   onSetShowVoiceRecorder,
//   onSetShowTextEditor,
//   conversationContext,
//   typingPredictionsEnabled,
//   mentionedUsers = [],
//   onRemoveMention,
//   showMentionSuggestions = false,
//   mentionSuggestions = [],
//   selectedMentionIndex = 0,
//   onMentionSelect,
//   isLoadingMembers = false,
//   mentionPosition = { top: 0, left: 0 },
//   removeAllSelectedFiles,
//   handleInputChange
// }) => {
//   const inputRef = useRef(null);

//   useEffect(() => {
//     if (inputRef.current) {
//       inputRef.current.focus();
//     }
//   }, []);

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if ((!newMessage.trim() && selectedFiles.length === 0) || sending || !isConnected) return;
//     onSendMessage(e);
//   };

//   const handlePredictionSelect = (prediction) => {
//     console.log('🎯 Prediction selected in MessageInput:', prediction);
//     const syntheticEvent = {
//       target: {
//         value: prediction,
//         name: 'message'
//       }
//     };
//     onInputChange(syntheticEvent);
//   };

//   return (
//     <div className="border-t border-gray-200 bg-white p-4">
//       {/* Mentioned Users Display */}
//       {mentionedUsers.length > 0 && (
//         <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
//           <div className="flex items-center justify-between mb-2">
//             <div className="text-xs font-medium text-blue-800 flex items-center gap-1">
//               <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
//               </svg>
//               Mentioning {mentionedUsers.length} member{mentionedUsers.length > 1 ? 's' : ''}
//             </div>
//             <button
//               type="button"
//               onClick={() => mentionedUsers?.forEach(user => onRemoveMention(user.id))}
//               className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
//             >
//               Clear all
//             </button>
//           </div>
//           <div className="flex flex-wrap gap-1">
//             {mentionedUsers.map(user => (
//               <MentionedUser
//                 key={`mentioned-${user.id}`}
//                 user={user}
//                 onRemove={onRemoveMention}
//                 isRemovable={true}
//               />
//             ))}
//           </div>
//         </div>
//       )}

//       {selectedFiles.length > 0 && (
//   <div className="mb-3 p-3 bg-gray-50 rounded-lg">
//     <div className="flex items-center justify-between mb-2">
//       <div className="text-sm font-medium text-gray-700">
//         {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
//       </div>
//       <button
//         onClick={removeAllSelectedFiles}
//         className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
//       >
//         Remove all
//       </button>
//     </div>

//     {/* Add caption input for files */}
//     <div className="mb-2">
//       <input
//         type="text"
//         value={newMessage}
//         onChange={handleInputChange}
//         placeholder="Add a caption..."
//         className="w-full p-2 border border-gray-300 rounded text-sm"
//         onKeyDown={(e) => {
//           if (e.key === 'Enter' && !e.shiftKey) {
//             e.preventDefault();
//             onSendMessage(e);
//           }
//         }}
//       />
//     </div>

//     {/* Show mentioned users */}
//     {mentionedUsers.length > 0 && (
//       <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-100">
//         <div className="flex items-center justify-between mb-1">
//           <div className="text-xs font-medium text-blue-800">
//             Mentioning {mentionedUsers.length} user{mentionedUsers.length > 1 ? 's' : ''}
//           </div>
//           <button
//             onClick={() => mentionedUsers.forEach(user => onRemoveMention(user.id))}
//             className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
//           >
//             Clear
//           </button>
//         </div>
//         <div className="flex flex-wrap gap-1">
//           {mentionedUsers.map(user => (
//             <div
//               key={`file-mention-${user.id}`}
//               className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
//             >
//               <span>{user.is_all_mention ? '@all' : `@${user.first_name}`}</span>
//               <button
//                 onClick={() => onRemoveMention(user.id)}
//                 className="text-blue-600 hover:text-blue-800 cursor-pointer"
//               >
//                 ✕
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>
//     )}

//     {/* Show file previews */}
//     <div className="grid grid-cols-3 gap-2">
//       {selectedFiles.map((file, index) => (
//         <div key={index} className="relative">
//           {file.type.startsWith('image/') ? (
//             <img
//               src={URL.createObjectURL(file)}
//               alt={file.name}
//               className="w-full h-24 object-cover rounded"
//             />
//           ) : file.type.startsWith('video/') ? (
//             <div className="w-full h-24 bg-gray-200 rounded flex items-center justify-center">
//               <span className="text-gray-500">🎥 {file.name}</span>
//             </div>
//           ) : (
//             <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center">
//               <span className="text-gray-500">📎 {file.name}</span>
//             </div>
//           )}
//           <button
//             onClick={() => onRemoveFile(index)}
//             className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs cursor-pointer"
//           >
//             ✕
//           </button>
//         </div>
//       ))}
//     </div>
//   </div>
// )}

//       {/* MENTION SUGGESTIONS POPUP */}
//       {showMentionSuggestions && (
//         <MentionSuggestions
//           suggestions={mentionSuggestions}
//           selectedIndex={selectedMentionIndex}
//           onSelect={onMentionSelect}
//           position={mentionPosition}
//           isLoading={isLoadingMembers}
//           searchQuery={newMessage.split('@').pop() || ''}
//         />
//       )}

//       <form onSubmit={handleSubmit} className="flex items-end gap-2">
//         {/* Attachment Button */}
//         <AttachmentMenu
//           showAttachmentMenu={showAttachmentMenu}
//           uploading={uploading}
//           fileInputRef={fileInputRef}
//           attachmentMenuRef={attachmentMenuRef}
//           onSetShowAttachmentMenu={onSetShowAttachmentMenu}
//           onSetShowCodeSnippetMenu={onSetShowCodeSnippetMenu}
//           onFileSelect={onFileSelect}
//           onSetShowVoiceRecorder={onSetShowVoiceRecorder}
//           onSetShowTextEditor={onSetShowTextEditor}
//         />

//         {/* Sticker Button */}
//         <StickerMenu
//           showStickerMenu={showStickerMenu}
//           stickerMenuRef={stickerMenuRef}
//           onSetShowStickerMenu={onSetShowStickerMenu}
//           onAddSticker={onAddSticker}
//           stickers={stickers}
//         />

//         {/* Message Input Container */}
//         <div className="flex-1 relative">
//           <div className="flex items-center bg-gray-50 border border-gray-300 rounded-full px-4 py-2 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
//             {/* Typing Predictions */}
//             <TypingPredictions
//               currentText={newMessage}
//               conversationContext={conversationContext || []}
//               onPredictionSelect={handlePredictionSelect}
//               enabled={typingPredictionsEnabled}
//             />

//             {/* Main Input */}
//             <input
//               ref={inputRef}
//               type="text"
//               value={newMessage}
//               onChange={onInputChange}
//               placeholder={`Type a message... ${isConnected ? '' : '(Connecting...)'}`}
//               className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-base w-full px-1"
//               disabled={sending || uploading || !isConnected}
//               onKeyDown={(e) => {
//                 if (e.key === 'Enter' && !e.shiftKey) {
//                   e.preventDefault();
//                   handleSubmit(e);
//                 }
//               }}
//             />
//           </div>
//         </div>

//         {/* Send Button */}
//         <button
//           type="submit"
//           disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading || !isConnected}
//           className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
//         >
//           {sending || uploading ? (
//             <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
//           ) : (
//             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
//             </svg>
//           )}
//         </button>
//       </form>

//       {/* Code Snippet Dialog */}
//       <CodeSnippetDialog
//         showCodeSnippetMenu={showCodeSnippetMenu}
//         codeSnippet={codeSnippet}
//         snippetLanguage={snippetLanguage}
//         sending={sending}
//         onSetShowCodeSnippetMenu={onSetShowCodeSnippetMenu}
//         onSetCodeSnippet={onSetCodeSnippet}
//         onSetSnippetLanguage={onSetSnippetLanguage}
//         onSendCodeSnippet={onSendCodeSnippet}
//       />
//     </div>
//   );
// };

// export default MessageInput;

"use client";

import React, { useRef, useEffect } from "react";
import MentionedUser from "./MentionedUser";
import MentionSuggestions from "./MentionSuggestions";
import AttachmentMenu from "./AttachmentMenu";
import StickerMenu from "./StickerMenu";
import TypingPredictions from "./TypingPredictions";
import CodeSnippetDialog from "./CodeSnippetDialog";

const MessageInput = ({
  newMessage,
  selectedFiles,
  sending,
  uploading,
  isConnected,
  showAttachmentMenu,
  showStickerMenu,
  showCodeSnippetMenu,
  codeSnippet,
  snippetLanguage,
  fileInputRef,
  attachmentMenuRef,
  stickerMenuRef,
  onSendMessage,
  onInputChange,
  onSetShowAttachmentMenu,
  onSetShowStickerMenu,
  onSetShowCodeSnippetMenu,
  onSetCodeSnippet,
  onSetSnippetLanguage,
  onSendCodeSnippet,
  onFileSelect,
  onAddSticker,
  stickers,
  onSetShowVoiceRecorder,
  onSetShowTextEditor,
  conversationContext,
  typingPredictionsEnabled,
  mentionedUsers = [],
  onRemoveMention,
  showMentionSuggestions = false,
  mentionSuggestions = [],
  selectedMentionIndex = 0,
  onMentionSelect,
  isLoadingMembers = false,
  mentionPosition = { top: 0, left: 0 },
  removeAllSelectedFiles,
  handleInputChange,
  // Add chat type prop to conditionally show mentions
  chatType = "private", // 'private' or 'group'
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      (!newMessage.trim() && selectedFiles.length === 0) ||
      sending ||
      !isConnected
    )
      return;
    onSendMessage(e);
  };

  const handlePredictionSelect = (prediction) => {
    console.log("🎯 Prediction selected in MessageInput:", prediction);
    const syntheticEvent = {
      target: {
        value: prediction,
        name: "message",
      },
    };
    onInputChange(syntheticEvent);
  };

  const isGroupChat = chatType === "group";

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      {/* Mentioned Users Display - ONLY FOR GROUP CHATS */}
      {isGroupChat && mentionedUsers.length > 0 && (
        <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-blue-800 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Mentioning {mentionedUsers.length} member
              {mentionedUsers.length > 1 ? "s" : ""}
            </div>
            <button
              type="button"
              onClick={() =>
                mentionedUsers?.forEach((user) => onRemoveMention(user._id))
              }
              className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {mentionedUsers.map((user) => (
              <MentionedUser
                key={`mentioned-${user._id}`}
                user={user}
                onRemove={onRemoveMention}
                isRemovable={true}
              />
            ))}
          </div>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-700">
              {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}{" "}
              selected
            </div>
            <button
              onClick={removeAllSelectedFiles}
              className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
            >
              Remove all
            </button>
          </div>

          {/* Add caption input for files */}
          <div className="mb-3">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Add a caption..."
              className="w-full p-2 border border-gray-300 rounded text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage(e);
                }
              }}
            />
          </div>

          {/* Show mentioned users - ONLY FOR GROUP CHATS */}
          {isGroupChat && mentionedUsers.length > 0 && (
            <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-100">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-medium text-blue-800">
                  Mentioning {mentionedUsers.length} user
                  {mentionedUsers.length > 1 ? "s" : ""}
                </div>
                <button
                  onClick={() =>
                    mentionedUsers.forEach((user) => onRemoveMention(user._id))
                  }
                  className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {mentionedUsers.map((user) => (
                  <div
                    key={`file-mention-${user._id}`}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                  >
                    <span>
                      {user.is_all_mention ? "@all" : `@${user.first_name}`}
                    </span>
                    <button
                      onClick={() => onRemoveMention(user._id)}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show file previews - REMOVED THE DUPLICATE HEADER HERE */}
          <div className="grid grid-cols-3 gap-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="relative border rounded overflow-hidden"
              >
                <div className="absolute top-1 left-1 z-10 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                  {file.name.length > 10
                    ? file.name.substring(0, 10) + "..."
                    : file.name}
                </div>
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-24 object-cover"
                  />
                ) : file.type.startsWith("video/") ? (
                  <div className="w-full h-24 bg-gray-200 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl mb-1">🎥</div>
                      <div className="text-xs text-gray-600 px-2">
                        {file.name.length > 12
                          ? file.name.substring(0, 12) + "..."
                          : file.name}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-24 bg-gray-100 flex flex-col items-center justify-center p-2">
                    <div className="text-2xl mb-1">📎</div>
                    <div className="text-xs text-gray-600 text-center">
                      {file.name.length > 12
                        ? file.name.substring(0, 12) + "..."
                        : file.name}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => onRemoveFile(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs cursor-pointer hover:bg-red-600 transition-colors"
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MENTION SUGGESTIONS POPUP - ONLY FOR GROUP CHATS */}
      {isGroupChat && showMentionSuggestions && (
        <MentionSuggestions
          suggestions={mentionSuggestions}
          selectedIndex={selectedMentionIndex}
          onSelect={onMentionSelect}
          position={mentionPosition}
          isLoading={isLoadingMembers}
          searchQuery={newMessage.split("@").pop() || ""}
        />
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Attachment Button */}
        <AttachmentMenu
          showAttachmentMenu={showAttachmentMenu}
          uploading={uploading}
          fileInputRef={fileInputRef}
          attachmentMenuRef={attachmentMenuRef}
          onSetShowAttachmentMenu={onSetShowAttachmentMenu}
          onSetShowCodeSnippetMenu={onSetShowCodeSnippetMenu}
          onFileSelect={onFileSelect}
          onSetShowVoiceRecorder={onSetShowVoiceRecorder}
          onSetShowTextEditor={onSetShowTextEditor}
        />

        {/* Sticker Button */}
        <StickerMenu
          showStickerMenu={showStickerMenu}
          stickerMenuRef={stickerMenuRef}
          onSetShowStickerMenu={onSetShowStickerMenu}
          onAddSticker={onAddSticker}
          stickers={stickers}
        />

        {/* Message Input Container */}
        <div className="flex-1 relative">
          <div className="flex items-center bg-gray-50 border border-gray-300 rounded-full px-4 py-2 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
            {/* Typing Predictions */}
            <TypingPredictions
              currentText={newMessage}
              conversationContext={conversationContext || []}
              onPredictionSelect={handlePredictionSelect}
              enabled={typingPredictionsEnabled}
            />

            {/* Main Input */}
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={onInputChange}
              placeholder={`Type a message... ${isConnected ? "" : "(Connecting...)"}`}
              className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-base w-full px-1"
              disabled={sending || uploading || !isConnected}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
                // Only trigger mention suggestions for group chats
                if (isGroupChat && e.key === "@") {
                  // Your mention trigger logic here
                }
              }}
            />
          </div>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={
            (!newMessage.trim() && selectedFiles.length === 0) ||
            sending ||
            uploading ||
            !isConnected
          }
          className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
        >
          {sending || uploading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
      </form>

      {/* Code Snippet Dialog */}
      <CodeSnippetDialog
        showCodeSnippetMenu={showCodeSnippetMenu}
        codeSnippet={codeSnippet}
        snippetLanguage={snippetLanguage}
        sending={sending}
        onSetShowCodeSnippetMenu={onSetShowCodeSnippetMenu}
        onSetCodeSnippet={onSetCodeSnippet}
        onSetSnippetLanguage={onSetSnippetLanguage}
        onSendCodeSnippet={onSendCodeSnippet}
      />
    </div>
  );
};

export default MessageInput;
