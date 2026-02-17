// "use client";

// import React, { useRef, useEffect, useState } from "react";
// import MentionedUser from "./MentionedUser";
// import MentionSuggestions from "./MentionSuggestions";
// import AttachmentMenu from "./AttachmentMenu";
// import StickerMenu from "./StickerMenu";
// import TypingPredictions from "./TypingPredictions";
// import CodeSnippetDialog from "./CodeSnippetDialog";
// import { languages } from "@/utils/comman";

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
//   onRemoveFile,
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
//   handleInputChange,
//   chatType = "private",
//   translateTo = null,
//   onSetTranslateTo = () => {},
//   onTranslateMessage = null,
//   onClearTranslation = () => {},
// }) => {
//   const inputRef = useRef(null);
//   const translateButtonRef = useRef(null);
//   const translationTimerRef = useRef(null);

//   const [showTranslationDropdown, setShowTranslationDropdown] = useState(false);
//   const [translatedText, setTranslatedText] = useState("");
//   const [isTranslating, setIsTranslating] = useState(false);

//   useEffect(() => {
//     if (inputRef.current) {
//       inputRef.current.focus();
//     }
//   }, []);

//   // Close dropdown when clicking outside
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (
//         translateButtonRef.current &&
//         !translateButtonRef.current.contains(event.target) &&
//         !event.target.closest(".translate-dropdown")
//       ) {
//         setShowTranslationDropdown(false);
//       }
//     };

//     document.addEventListener("mousedown", handleClickOutside);
//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//     };
//   }, []);

//   // Cleanup timer on unmount
//   useEffect(() => {
//     return () => {
//       if (translationTimerRef.current) {
//         clearTimeout(translationTimerRef.current);
//       }
//     };
//   }, []);

//   // Languages for translation

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (
//       (!newMessage.trim() && selectedFiles.length === 0) ||
//       sending ||
//       !isConnected
//     )
//       return;

//     // Include translation info if set
//     if (translateTo && newMessage.trim()) {
//       onSendMessage(e, { translateTo });
//     } else {
//       onSendMessage(e);
//     }
//   };

//   const handlePredictionSelect = (prediction) => {
//     console.log("🎯 Prediction selected in MessageInput:", prediction);
//     const syntheticEvent = {
//       target: {
//         value: prediction,
//         name: "message",
//       },
//     };
//     onInputChange(syntheticEvent);
//   };

//   const handleLanguageSelect = async (languageCode) => {
//     setShowTranslationDropdown(false);

//     if (translateTo === languageCode) {
//       onClearTranslation();
//       setTranslatedText("");
//       return;
//     }

//     // Set the target language
//     onSetTranslateTo(languageCode);

//     // Auto-translate if there's text
//     if (newMessage.trim() && onTranslateMessage) {
//       await handleTranslate(newMessage, languageCode);
//     }
//   };

//   const handleTranslate = async (text, targetLanguage) => {
//     if (!text.trim() || !targetLanguage || !onTranslateMessage) return;

//     setIsTranslating(true);
//     try {
//       const result = await onTranslateMessage(text, targetLanguage);
//       if (result) {
//         setTranslatedText(result);
//       }
//     } catch (error) {
//       console.error("Translation error:", error);
//       setTranslatedText(
//         `${text} [Will translate to ${languages.find((l) => l.code === targetLanguage)?.name || targetLanguage}]`,
//       );
//     } finally {
//       setIsTranslating(false);
//     }
//   };

//   const handleClearTranslation = () => {
//     onClearTranslation();
//     setTranslatedText("");
//     setShowTranslationDropdown(false);
//   };

//   // Handle input change with translation
//   const handleInputChangeWithTranslation = (e) => {
//     onInputChange(e);

//     // Auto-translate when typing if language is selected
//     if (translateTo && e.target.value.trim() && onTranslateMessage) {
//       // Clear previous timer
//       if (translationTimerRef.current) {
//         clearTimeout(translationTimerRef.current);
//       }

//       // Debounce translation for better performance
//       translationTimerRef.current = setTimeout(() => {
//         handleTranslate(e.target.value, translateTo);
//       }, 1000);
//     }
//   };

//   const isGroupChat = chatType === "group";

//   return (
//     <div className="border-t border-gray-200 bg-white p-4">
//       {/* Translated Text Preview */}
//       {translatedText && (
//         <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
//           <div className="flex items-center gap-2 mb-2">
//             <svg
//               className="w-4 h-4 text-blue-600"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
//               />
//             </svg>
//             <span className="text-sm font-medium text-blue-800">
//               Translation Preview
//             </span>
//             <span className="ml-auto text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
//               {languages.find((l) => l.code === translateTo)?.name}
//             </span>
//           </div>
//           <p className="text-sm text-gray-800">{translatedText}</p>
//         </div>
//       )}

//       {/* Mentioned Users Display - ONLY FOR GROUP CHATS */}
//       {isGroupChat && mentionedUsers.length > 0 && (
//         <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
//           <div className="flex items-center justify-between mb-2">
//             <div className="text-sm font-medium text-blue-800 flex items-center gap-2">
//               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
//                 <path
//                   fillRule="evenodd"
//                   d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
//                   clipRule="evenodd"
//                 />
//               </svg>
//               Mentioning {mentionedUsers.length} member
//               {mentionedUsers.length > 1 ? "s" : ""}
//             </div>
//             <button
//               type="button"
//               onClick={() =>
//                 mentionedUsers?.forEach((user) => onRemoveMention(user._id))
//               }
//               className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
//             >
//               Clear all
//             </button>
//           </div>
//           <div className="flex flex-wrap gap-2">
//             {mentionedUsers.map((user) => (
//               <MentionedUser
//                 key={`mentioned-${user._id}`}
//                 user={user}
//                 onRemove={onRemoveMention}
//                 isRemovable={true}
//               />
//             ))}
//           </div>
//         </div>
//       )}

//       {selectedFiles.length > 0 && (
//         <div className="mb-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
//           <div className="flex items-center justify-between mb-3">
//             <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
//               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
//                 <path
//                   fillRule="evenodd"
//                   d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
//                   clipRule="evenodd"
//                 />
//               </svg>
//               {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}{" "}
//               selected
//             </div>
//             <button
//               onClick={removeAllSelectedFiles}
//               className="text-sm text-red-600 hover:text-red-800 cursor-pointer"
//             >
//               Remove all
//             </button>
//           </div>

//           {/* Add caption input for files */}
//           <div className="mb-3">
//             <div className="relative">
//               <input
//                 type="text"
//                 value={newMessage}
//                 onChange={handleInputChangeWithTranslation}
//                 placeholder="Add a caption..."
//                 className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 onKeyDown={(e) => {
//                   if (e.key === "Enter" && !e.shiftKey) {
//                     e.preventDefault();
//                     onSendMessage(e);
//                   }
//                 }}
//               />
//             </div>

//             {/* Show translation indicator for caption */}
//             {translateTo && newMessage.trim() && (
//               <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
//                 <svg
//                   className="w-3.5 h-3.5"
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M5 13l4 4L19 7"
//                   />
//                 </svg>
//                 <span>
//                   Caption will translate to{" "}
//                   {languages.find((l) => l.code === translateTo)?.name}
//                 </span>
//               </div>
//             )}
//           </div>

//           {/* Show file previews */}
//           <div className="grid grid-cols-3 gap-3">
//             {selectedFiles.map((file, index) => (
//               <div
//                 key={index}
//                 className="relative border border-gray-300 rounded-lg overflow-hidden group hover:border-blue-400 transition-colors"
//               >
//                 <div className="absolute top-2 left-2 z-10 bg-black/80 text-white text-xs px-2 py-1 rounded-full">
//                   {file.name.length > 10
//                     ? file.name.substring(0, 10) + "..."
//                     : file.name}
//                 </div>
//                 {file.type.startsWith("image/") ? (
//                   <img
//                     src={URL.createObjectURL(file)}
//                     alt={file.name}
//                     className="w-full h-28 object-cover"
//                   />
//                 ) : file.type.startsWith("video/") ? (
//                   <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
//                     <div className="text-center">
//                       <div className="text-3xl mb-1">🎥</div>
//                       <div className="text-xs text-gray-600 px-2">
//                         {file.name.length > 12
//                           ? file.name.substring(0, 12) + "..."
//                           : file.name}
//                       </div>
//                     </div>
//                   </div>
//                 ) : (
//                   <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center p-3">
//                     <div className="text-3xl mb-2">📎</div>
//                     <div className="text-xs text-gray-600 text-center px-2">
//                       {file.name.length > 12
//                         ? file.name.substring(0, 12) + "..."
//                         : file.name}
//                     </div>
//                   </div>
//                 )}
//                 <button
//                   onClick={() => onRemoveFile && onRemoveFile(index)}
//                   className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
//                   title="Remove file"
//                 >
//                   ✕
//                 </button>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* MENTION SUGGESTIONS POPUP - ONLY FOR GROUP CHATS */}
//       {isGroupChat && showMentionSuggestions && (
//         <MentionSuggestions
//           suggestions={mentionSuggestions}
//           selectedIndex={selectedMentionIndex}
//           onSelect={onMentionSelect}
//           position={mentionPosition}
//           isLoading={isLoadingMembers}
//           searchQuery={newMessage.split("@").pop() || ""}
//         />
//       )}

//       <form onSubmit={handleSubmit} className="flex items-end gap-3">
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
//           <div className="flex items-center bg-gradient-to-r from-gray-50 to-white border-2 border-gray-300 rounded-2xl px-5 py-3 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all shadow-sm">
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
//               onChange={handleInputChangeWithTranslation}
//               placeholder={`Type a message... ${isConnected ? "" : "(Connecting...)"}`}
//               className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-base w-full px-1"
//               disabled={sending || uploading || !isConnected}
//               onKeyDown={(e) => {
//                 if (e.key === "Enter" && !e.shiftKey) {
//                   e.preventDefault();
//                   handleSubmit(e);
//                 }
//                 // Only trigger mention suggestions for group chats
//                 if (isGroupChat && e.key === "@") {
//                   // Mention trigger logic will be handled by onInputChange
//                 }
//               }}
//             />

//             {/* TRANSLATION BUTTON - REPLACES CHARACTER COUNTER */}
//             <div className="relative ml-2" ref={translateButtonRef}>
//               <button
//                 type="button"
//                 onClick={() =>
//                   setShowTranslationDropdown(!showTranslationDropdown)
//                 }
//                 className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-xs transition-all ${
//                   translateTo
//                     ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"
//                     : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300"
//                 }`}
//                 title={
//                   translateTo
//                     ? `Translating to ${translateTo.toUpperCase()}`
//                     : "Translate message"
//                 }
//               >
//                 <svg
//                   className="w-3 h-3"
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
//                   />
//                 </svg>
//                 <span className="font-medium">
//                   {translateTo ? translateTo.toUpperCase() : ""}
//                 </span>
//                 <svg
//                   className={`w-3 h-3 transition-transform ${
//                     showTranslationDropdown ? "rotate-180" : ""
//                   }`}
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M19 9l-7 7-7-7"
//                   />
//                 </svg>
//               </button>

//               {/* TRANSLATION DROPDOWN - OPENS UPWARDS */}
//               {showTranslationDropdown && (
//                 <div className="absolute bottom-full mb-2 right-0 w-56 bg-white border border-gray-300 rounded-lg shadow-xl z-50 translate-dropdown">
//                   <div className="p-2">
//                     <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
//                       Select Language
//                     </div>
//                     <div className="max-h-64 overflow-y-auto">
//                       {languages.map((lang) => (
//                         <button
//                           key={lang.code}
//                           onClick={() => handleLanguageSelect(lang.code)}
//                           className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 ${
//                             translateTo === lang.code
//                               ? "bg-blue-50 text-blue-700"
//                               : "text-gray-700"
//                           }`}
//                         >
//                           <span className="font-medium">{lang.name}</span>
//                           <span className="text-xs text-gray-500">
//                             {lang.code.toUpperCase()}
//                           </span>
//                         </button>
//                       ))}
//                     </div>

//                     {translateTo && (
//                       <div className="mt-2 pt-2 border-t border-gray-200">
//                         <button
//                           onClick={handleClearTranslation}
//                           className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
//                         >
//                           <svg
//                             className="w-4 h-4"
//                             fill="none"
//                             stroke="currentColor"
//                             viewBox="0 0 24 24"
//                           >
//                             <path
//                               strokeLinecap="round"
//                               strokeLinejoin="round"
//                               strokeWidth={2}
//                               d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
//                             />
//                           </svg>
//                           Clear Translation
//                         </button>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Send Button */}
//         <button
//           type="submit"
//           disabled={
//             (!newMessage.trim() && selectedFiles.length === 0) ||
//             sending ||
//             uploading ||
//             !isConnected
//           }
//           className={`p-4 rounded-full transition-all hover:scale-105 shadow-lg ${
//             translateTo
//               ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
//               : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
//           } disabled:from-blue-300 disabled:to-blue-400 disabled:cursor-not-allowed cursor-pointer flex-shrink-0`}
//         >
//           {sending || uploading ? (
//             <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
//           ) : (
//             <svg
//               className="w-5 h-5"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
//               />
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

import React, { useRef, useEffect, useState } from "react";
import MentionedUser from "./MentionedUser";
import MentionSuggestions from "./MentionSuggestions";
import AttachmentMenu from "./AttachmentMenu";
import StickerMenu from "./StickerMenu";
import TypingPredictions from "./TypingPredictions";
import CodeSnippetDialog from "./CodeSnippetDialog";
import { languages } from "@/utils/comman";

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
  onRemoveFile,
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
  chatType = "private",
  translateTo = null,
  onSetTranslateTo = () => {},
  onTranslateMessage = null,
  onClearTranslation = () => {},
}) => {
  const inputRef = useRef(null);
  const translateButtonRef = useRef(null);
  const translationTimerRef = useRef(null);

  const [showTranslationDropdown, setShowTranslationDropdown] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        translateButtonRef.current &&
        !translateButtonRef.current.contains(event.target) &&
        !event.target.closest(".translate-dropdown")
      ) {
        setShowTranslationDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (translationTimerRef.current) {
        clearTimeout(translationTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      (!newMessage.trim() && selectedFiles.length === 0) ||
      sending ||
      !isConnected
    )
      return;

    // Include translation info if set
    if (translateTo && newMessage.trim()) {
      onSendMessage(e, { translateTo });
    } else {
      onSendMessage(e);
    }

    // Clear preview after sending
    setTranslatedText("");
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

  const handleLanguageSelect = async (languageCode) => {
    setShowTranslationDropdown(false);

    if (translateTo === languageCode) {
      onClearTranslation();
      setTranslatedText("");
      return;
    }

    // Set the target language
    onSetTranslateTo(languageCode);

    // Auto-translate if there's text
    if (newMessage.trim() && onTranslateMessage) {
      await handleTranslate(newMessage, languageCode);
    }
  };

  const handleTranslate = async (text, targetLanguage) => {
    if (!text.trim() || !targetLanguage || !onTranslateMessage) return;

    setIsTranslating(true);
    try {
      const result = await onTranslateMessage(text, targetLanguage);
      if (result) {
        setTranslatedText(result);
      }
    } catch (error) {
      console.error("Translation error:", error);
      setTranslatedText(
        `${text} [Will translate to ${languages.find((l) => l.code === targetLanguage)?.name || targetLanguage}]`,
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleClearTranslation = () => {
    onClearTranslation();
    setTranslatedText("");
    setShowTranslationDropdown(false);
  };

  // NEW FUNCTION: Handle click on translated text preview
  const handleTranslatedTextClick = () => {
    if (translatedText) {
      // Create synthetic event to update input value
      const syntheticEvent = {
        target: {
          value: translatedText,
          name: "message",
        },
      };
      onInputChange(syntheticEvent);

      // Focus the input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Move cursor to end of text
          inputRef.current.setSelectionRange(
            translatedText.length,
            translatedText.length,
          );
        }
      }, 10);
    }
  };

  // NEW FUNCTION: Handle remove preview
  const handleRemovePreview = (e) => {
    e.stopPropagation(); // Prevent triggering the parent click
    setTranslatedText("");
  };

  // Handle input change with translation
  const handleInputChangeWithTranslation = (e) => {
    onInputChange(e);

    // Auto-translate when typing if language is selected
    if (translateTo && e.target.value.trim() && onTranslateMessage) {
      // Clear previous timer
      if (translationTimerRef.current) {
        clearTimeout(translationTimerRef.current);
      }

      // Debounce translation for better performance
      translationTimerRef.current = setTimeout(() => {
        handleTranslate(e.target.value, translateTo);
      }, 1000);
    }
  };

  const isGroupChat = chatType === "group";

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      {/* Translated Text Preview - NOW CLICKABLE WITH CLOSE BUTTON */}
      {translatedText && (
        <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 relative group">
          {/* Close button */}
          <button
            onClick={handleRemovePreview}
            className="absolute -top-2 -right-2 bg-white rounded-full shadow-md border border-gray-200 w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-10"
            title="Remove translation preview"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Clickable content area */}
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleTranslatedTextClick}
            title="Click to use this translation"
          >
            {/* Top row */}

            {/* Text */}
            <p className="text-sm text-gray-800 leading-relaxed">
              {translatedText}
            </p>
          </div>
        </div>
      )}

      {/* Mentioned Users Display - ONLY FOR GROUP CHATS */}
      {isGroupChat && mentionedUsers.length > 0 && (
        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
              className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
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
        <div className="mb-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                  clipRule="evenodd"
                />
              </svg>
              {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}{" "}
              selected
            </div>
            <button
              onClick={removeAllSelectedFiles}
              className="text-sm text-red-600 hover:text-red-800 cursor-pointer"
            >
              Remove all
            </button>
          </div>

          {/* Add caption input for files */}
          <div className="mb-3">
            <div className="relative">
              <input
                type="text"
                value={newMessage}
                onChange={handleInputChangeWithTranslation}
                placeholder="Add a caption..."
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSendMessage(e);
                  }
                }}
              />
            </div>

            {/* Show translation indicator for caption */}
            {translateTo && newMessage.trim() && (
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
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
                <span>
                  Caption will translate to{" "}
                  {languages.find((l) => l.code === translateTo)?.name}
                </span>
              </div>
            )}
          </div>

          {/* Show file previews */}
          <div className="grid grid-cols-3 gap-3">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}-${Date.now()}`}
                className="relative border border-gray-300 rounded-lg overflow-hidden group hover:border-blue-400 transition-colors"
              >
                <div className="absolute top-2 left-2 z-10 bg-black/80 text-white text-xs px-2 py-1 rounded-full">
                  {file.name.length > 10
                    ? file.name.substring(0, 10) + "..."
                    : file.name}
                </div>
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-28 object-cover"
                  />
                ) : file.type.startsWith("video/") ? (
                  <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl mb-1">🎥</div>
                      <div className="text-xs text-gray-600 px-2">
                        {file.name.length > 12
                          ? file.name.substring(0, 12) + "..."
                          : file.name}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center p-3">
                    <div className="text-3xl mb-2">📎</div>
                    <div className="text-xs text-gray-600 text-center px-2">
                      {file.name.length > 12
                        ? file.name.substring(0, 12) + "..."
                        : file.name}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => onRemoveFile && onRemoveFile(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
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

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
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
          <div className="flex items-center bg-gradient-to-r from-gray-50 to-white border-2 border-gray-300 rounded-2xl px-5 py-3 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all shadow-sm">
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
              onChange={handleInputChangeWithTranslation}
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
                  // Mention trigger logic will be handled by onInputChange
                }
              }}
            />

            {/* TRANSLATION BUTTON */}
            <div className="relative ml-2" ref={translateButtonRef}>
              <button
                type="button"
                onClick={() =>
                  setShowTranslationDropdown(!showTranslationDropdown)
                }
                className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-xs transition-all ${
                  translateTo
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300"
                }`}
                title={
                  translateTo
                    ? `Translating to ${translateTo.toUpperCase()}`
                    : "Translate message"
                }
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
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
                <span className="font-medium">
                  {translateTo ? translateTo.toUpperCase() : ""}
                </span>
                <svg
                  className={`w-3 h-3 transition-transform ${
                    showTranslationDropdown ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* TRANSLATION DROPDOWN */}
              {showTranslationDropdown && (
                <div className="absolute bottom-full mb-2 right-0 w-56 bg-white border border-gray-300 rounded-lg shadow-xl z-50 translate-dropdown">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                      Select Language
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => handleLanguageSelect(lang.code)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 ${
                            translateTo === lang.code
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700"
                          }`}
                        >
                          <span className="font-medium">{lang.name}</span>
                          <span className="text-xs text-gray-500">
                            {lang.code.toUpperCase()}
                          </span>
                        </button>
                      ))}
                    </div>

                    {translateTo && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={handleClearTranslation}
                          className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
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
                          Clear Translation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
          className={`p-4 rounded-full transition-all hover:scale-105 shadow-lg ${
            translateTo
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
              : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
          } disabled:from-blue-300 disabled:to-blue-400 disabled:cursor-not-allowed cursor-pointer flex-shrink-0`}
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
