// import { useState, useRef } from 'react';

// export default function RichTextEditor({
//   showTextEditor,
//   richText,
//   onSetShowTextEditor,
//   onSetRichText,
//   onSendRichText,
//   sending
// }) {
//   const [activeFormats, setActiveFormats] = useState(new Set());
//   const textareaRef = useRef(null);

//   const formattingOptions = [
//     { 
//       name: 'bold', 
//       symbol: 'B', 
//       markup: '**', 
//       title: 'Bold',
//       class: 'font-bold'
//     },
//     { 
//       name: 'italic', 
//       symbol: 'I', 
//       markup: '*', 
//       title: 'Italic',
//       class: 'italic'
//     },
//     { 
//       name: 'underline', 
//       symbol: 'U', 
//       markup: '__', 
//       title: 'Underline',
//       class: 'underline'
//     },
//     { 
//       name: 'strikethrough', 
//       symbol: 'S', 
//       markup: '~~', 
//       title: 'Strikethrough',
//       class: 'line-through'
//     },
//     { 
//       name: 'code', 
//       symbol: '</>', 
//       markup: '`', 
//       title: 'Inline Code',
//       class: 'font-mono bg-gray-100 px-1 rounded'
//     }
//   ];

//   const listOptions = [
//     {
//       name: 'bullet',
//       symbol: '•',
//       markup: '- ',
//       title: 'Bullet List'
//     },
//     {
//       name: 'numbered',
//       symbol: '1.',
//       markup: '1. ',
//       title: 'Numbered List'
//     }
//   ];

//   const emojiCategories = [
//     {
//       name: 'Smileys & Emotion',
//       emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠']
//     },
//     {
//       name: 'Objects & Symbols',
//       emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭']
//     },
//     {
//       name: 'Activities',
//       emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🤹', '🎪', '🛹', '🛼', '🛷', '🥌', '🎯', '🎮', '🎰', '🎲', '🧩', '♠️', '♥️', '♦️', '♣️', '🃏', '🀄', '🎴', '🎭', '🖼️', '🎨', '🧵', '🪡', '🧶', '🪢', '👓', '🕶️', '🥽', '🥼', '🦺', '👔', '👕', '👖', '🧣', '🧤', '🧥', '🧦', '👗', '👘', '🥻', '🩱', '🩲', '🩳', '👙', '👚', '👛', '👜', '👝', '🎒', '🩴', '👞', '👟', '🥾', '🥿', '👠', '👡', '🩰', '👢', '👑', '👒', '🎩', '🎓', '🧢', '🪖', '💄', '💍', '💼']
//     }
//   ];

//   const applyFormatting = (format) => {
//     const textarea = textareaRef.current;
//     if (!textarea) return;

//     const start = textarea.selectionStart;
//     const end = textarea.selectionEnd;
//     const selectedText = richText.substring(start, end);
//     const formatMarkup = formattingOptions.find(f => f.name === format)?.markup;

//     if (!formatMarkup) return;

//     let formattedText = '';
    
//     if (selectedText) {
//       // Wrap selected text
//       formattedText = `${formatMarkup}${selectedText}${formatMarkup}`;
//     } else {
//       // Insert formatting markers
//       formattedText = `${formatMarkup}${formatMarkup}`;
//     }
    
//     const newText = richText.substring(0, start) + formattedText + richText.substring(end);
//     onSetRichText(newText);
    
//     // Update cursor position
//     setTimeout(() => {
//       textarea.focus();
//       if (selectedText) {
//         textarea.setSelectionRange(start + formatMarkup.length, start + formatMarkup.length + selectedText.length);
//       } else {
//         textarea.setSelectionRange(start + formatMarkup.length, start + formatMarkup.length);
//       }
//     }, 0);
//   };

//   const insertList = (listType) => {
//     const textarea = textareaRef.current;
//     if (!textarea) return;

//     const start = textarea.selectionStart;
//     const lines = richText.substring(0, start).split('\n');
//     const currentLine = lines[lines.length - 1];
    
//     let listMarkup = '';
//     if (listType === 'bullet') {
//       listMarkup = '- ';
//     } else if (listType === 'numbered') {
//       const lineNumber = lines.filter(line => line.trim().match(/^\d+\./)).length + 1;
//       listMarkup = `${lineNumber}. `;
//     }

//     const newText = richText.substring(0, start) + listMarkup + richText.substring(start);
//     onSetRichText(newText);
    
//     setTimeout(() => {
//       textarea.focus();
//       textarea.setSelectionRange(start + listMarkup.length, start + listMarkup.length);
//     }, 0);
//   };

//   const insertEmoji = (emoji) => {
//     const textarea = textareaRef.current;
//     if (!textarea) return;

//     const start = textarea.selectionStart;
//     const newText = richText.substring(0, start) + emoji + richText.substring(start);
//     onSetRichText(newText);
    
//     setTimeout(() => {
//       textarea.focus();
//       textarea.setSelectionRange(start + emoji.length, start + emoji.length);
//     }, 0);
//   };

//   const insertLink = () => {
//     const url = prompt('Enter URL:');
//     if (!url) return;

//     const text = prompt('Enter link text (optional):') || url;
//     const markdownLink = `[${text}](${url})`;

//     const textarea = textareaRef.current;
//     if (!textarea) return;

//     const start = textarea.selectionStart;
//     const end = textarea.selectionEnd;
//     const selectedText = richText.substring(start, end);
    
//     const linkText = selectedText ? `[${selectedText}](${url})` : markdownLink;
    
//     const newText = richText.substring(0, start) + linkText + richText.substring(end);
//     onSetRichText(newText);
//   };

//   const insertCodeBlock = () => {
//     const language = prompt('Enter programming language (optional):') || '';
//     const codeBlock = `\`\`\`${language}\n\n\`\`\``;

//     const textarea = textareaRef.current;
//     if (!textarea) return;

//     const start = textarea.selectionStart;
//     const newText = richText.substring(0, start) + codeBlock + richText.substring(start);
//     onSetRichText(newText);
    
//     setTimeout(() => {
//       textarea.focus();
//       const cursorPos = start + codeBlock.length - 4;
//       textarea.setSelectionRange(cursorPos, cursorPos);
//     }, 0);
//   };

//   const clearFormatting = () => {
//     // Remove markdown formatting
//     const cleanedText = richText
//       .replace(/\*\*(.*?)\*\*/g, '$1')
//       .replace(/\*(.*?)\*/g, '$1')
//       .replace(/__(.*?)__/g, '$1')
//       .replace(/~~(.*?)~~/g, '$1')
//       .replace(/`(.*?)`/g, '$1')
//       .replace(/\[(.*?)\]\(.*?\)/g, '$1');
    
//     onSetRichText(cleanedText);
//     setActiveFormats(new Set());
//   };

//   const formatRichText = (text) => {
//     if (!text) return '';

//     // First escape any existing HTML to prevent XSS
//     const escapeHtml = (unsafe) => {
//       return unsafe
//         .replace(/&/g, "&amp;")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;")
//         .replace(/"/g, "&quot;")
//         .replace(/'/g, "&#039;");
//     };

//     let safeText = escapeHtml(text);
    
//     // Convert markdown to HTML with enhanced formatting
//     // Bold: **text**
//     safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
//     // Italic: *text*
//     safeText = safeText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
//     // Underline: __text__
//     safeText = safeText.replace(/__(.*?)__/g, '<u>$1</u>');
    
//     // Strikethrough: ~~text~~
//     safeText = safeText.replace(/~~(.*?)~~/g, '<del>$1</del>');
    
//     // Inline code: `code`
//     safeText = safeText.replace(/`(.*?)`/g, '<code class="inline-code bg-gray-100 px-1 rounded font-mono text-sm">$1</code>');
    
//     // Line breaks
//     safeText = safeText.replace(/\n/g, '<br>');
    
//     // Markdown links: [text](url)
//     safeText = safeText.replace(
//       /\[([^\]]+)\]\(([^)]+)\)/g, 
//       '<a href="$2" class="text-blue-500 underline hover:text-blue-700 transition-colors" target="_blank" rel="noopener noreferrer">$1</a>'
//     );
    
//     // Auto-link URLs (only if not already in a markdown link)
//     safeText = safeText.replace(
//       /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
//       (url) => {
//         // Check if this URL is already inside an anchor tag
//         if (!safeText.includes(`href="${url}"`)) {
//           return `<a href="${url}" class="text-blue-500 underline hover:text-blue-700 transition-colors" target="_blank" rel="noopener noreferrer">${url}</a>`;
//         }
//         return url;
//       }
//     );

//     return safeText;
//   };

//   const getPlainTextPreview = (text) => {
//     if (!text) return 'Preview will appear here...';
    
//     // Remove markdown formatting for a clean preview
//     return text
//       .replace(/\*\*(.*?)\*\*/g, '$1')
//       .replace(/\*(.*?)\*/g, '$1')
//       .replace(/__(.*?)__/g, '$1')
//       .replace(/~~(.*?)~~/g, '$1')
//       .replace(/`(.*?)`/g, '$1')
//       .replace(/\[(.*?)\]\(.*?\)/g, '$1')
//       .replace(/(https?:\/\/[^\s]+)/g, '$1');
//   };

//   // Enhanced send function that ensures rich_text message type
//   const handleSendRichText = () => {
//     if (!richText.trim()) return;
    
//     // Call the parent send function with rich_text type
//     onSendRichText(richText.trim(), 'rich_text');
//   };

//   if (!showTextEditor) return null;

//   return (
//     <div className="fixed inset-0 bg-opacity-10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col shadow-xl">
//         {/* Header */}
//         <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
//           <h3 className="text-lg font-semibold text-gray-800">Enhanced Text Editor</h3>
//           <button
//             onClick={() => onSetShowTextEditor(false)}
//             className="p-2 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
//           >
//             <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//             </svg>
//           </button>
//         </div>

//         {/* Formatting Toolbar */}
//         <div className="flex flex-wrap items-center p-3 border-b bg-white space-x-1">
//           {/* Text Formatting */}
//           <div className="flex items-center space-x-1 mr-4">
//             {formattingOptions.map(format => (
//               <button
//                 key={format.name}
//                 onClick={() => applyFormatting(format.name)}
//                 className={`p-2 rounded hover:bg-gray-200 cursor-pointer text-sm font-medium ${
//                   activeFormats.has(format.name) ? 'bg-gray-300 text-gray-800' : 'text-gray-700'
//                 }`}
//                 title={format.title}
//               >
//                 {format.symbol}
//               </button>
//             ))}
//           </div>

//           {/* Lists */}
//           <div className="flex items-center space-x-1 mr-4 border-l border-gray-300 pl-4">
//             {listOptions.map(list => (
//               <button
//                 key={list.name}
//                 onClick={() => insertList(list.name)}
//                 className="p-2 rounded hover:bg-gray-200 cursor-pointer text-sm text-gray-700"
//                 title={list.title}
//               >
//                 {list.symbol}
//               </button>
//             ))}
//           </div>

//           {/* Additional Tools */}
//           <div className="flex items-center space-x-1 border-l border-gray-300 pl-4">
//             <button
//               onClick={insertLink}
//               className="p-2 rounded hover:bg-gray-200 cursor-pointer text-sm text-gray-700"
//               title="Insert Link"
//             >
//               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
//               </svg>
//             </button>

//             <button
//               onClick={insertCodeBlock}
//               className="p-2 rounded hover:bg-gray-200 cursor-pointer text-sm text-gray-700"
//               title="Insert Code Block"
//             >
//               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
//               </svg>
//             </button>

//             <button
//               onClick={clearFormatting}
//               className="p-2 rounded hover:bg-gray-200 cursor-pointer text-sm text-gray-700"
//               title="Clear Formatting"
//             >
//               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
//               </svg>
//             </button>
//           </div>
//         </div>

//         {/* Text Area */}
//         <div className="flex-1 p-4 min-h-[300px]">
//           <textarea
//             ref={textareaRef}
//             value={richText}
//             onChange={(e) => onSetRichText(e.target.value)}
//             placeholder="Type your message here... You can use **bold**, *italic*, __underline__, ~~strikethrough~~, `code`, [links](url), and lists."
//             className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-sans text-gray-800 leading-relaxed"
//             style={{ minHeight: '200px' }}
//           />
//         </div>

//         {/* Emoji Picker */}
//         <div className="border-t">
//           <div className="p-3 bg-gray-50">
//             <h4 className="text-sm font-medium mb-2 text-gray-700">Emojis</h4>
//             <div className="space-y-3 max-h-32 overflow-y-auto">
//               {emojiCategories.map(category => (
//                 <div key={category.name}>
//                   <p className="text-xs font-medium text-gray-500 mb-1">{category.name}</p>
//                   <div className="flex flex-wrap gap-1">
//                     {category.emojis.slice(0, 15).map(emoji => (
//                       <button
//                         key={emoji}
//                         onClick={() => insertEmoji(emoji)}
//                         className="p-1 hover:bg-gray-200 rounded cursor-pointer text-sm transition-colors"
//                       >
//                         {emoji}
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* Preview */}
//         <div className="p-4 border-t bg-gray-50">
//           <div className="flex items-center justify-between mb-2">
//             <h4 className="text-sm font-medium text-gray-700">Preview:</h4>
//             <div className="text-xs text-gray-500">
//               {richText.length} characters
//             </div>
//           </div>
//           <div className="bg-white p-4 rounded border min-h-20 max-h-40 overflow-y-auto">
//             {richText ? (
//               <div className="space-y-2">
//                 {/* HTML Preview */}
//                 <div 
//                   className="rich-text-preview"
//                   style={{
//                     lineHeight: '1.5',
//                     fontSize: '0.875rem',
//                     color: '#374151'
//                   }}
//                   dangerouslySetInnerHTML={{ 
//                     __html: formatRichText(richText) 
//                   }}
//                 />
//               </div>
//             ) : (
//               <p className="text-gray-400 italic">Preview will appear here...</p>
//             )}
//           </div>
          
//           {/* Formatting Help */}
//           <div className="mt-3 text-xs text-gray-500">
//             <p><strong>Tip:</strong> Use **bold**, *italic*, __underline__, ~~strikethrough~~, `code`, and [links](url)</p>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="flex justify-between items-center p-4 border-t bg-white rounded-b-lg">
//           <div className="text-sm text-gray-500">
//             Supports: <strong>Bold</strong>, <em>Italic</em>, <u>Underline</u>, <del>Strikethrough</del>, <code>Code</code>, Links, Lists
//           </div>
          
//           <div className="flex space-x-3">
//             <button
//               onClick={() => onSetShowTextEditor(false)}
//               className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer font-medium"
//             >
//               Cancel
//             </button>
//             <button
//               onClick={handleSendRichText}
//               disabled={!richText.trim() || sending}
//               className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors cursor-pointer font-medium"
//             >
//               {sending ? (
//                 <div className="flex items-center space-x-2">
//                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                   <span>Sending...</span>
//                 </div>
//               ) : (
//                 'Send Message'
//               )}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

import { useState, useRef } from 'react';
import { 
  X, 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Code, 
  Link, 
  List, 
  ListOrdered, 
  FileCode, 
  Eraser, 
  Send,
  Smile,
  Eye,
  Type
} from 'lucide-react';

export default function RichTextEditor({
  showTextEditor,
  richText,
  onSetShowTextEditor,
  onSetRichText,
  onSendRichText,
  sending
}) {
  const [activeFormats, setActiveFormats] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  const formattingOptions = [
    { 
      name: 'bold', 
      icon: Bold,
      markup: '**', 
      title: 'Bold (Ctrl/Cmd + B)',
      class: 'font-bold'
    },
    { 
      name: 'italic', 
      icon: Italic,
      markup: '*', 
      title: 'Italic (Ctrl/Cmd + I)',
      class: 'italic'
    },
    { 
      name: 'underline', 
      icon: Underline,
      markup: '__', 
      title: 'Underline',
      class: 'underline'
    },
    { 
      name: 'strikethrough', 
      icon: Strikethrough,
      markup: '~~', 
      title: 'Strikethrough',
      class: 'line-through'
    },
    { 
      name: 'code', 
      icon: Code,
      markup: '`', 
      title: 'Inline Code',
      class: 'font-mono bg-gray-100 px-1 rounded'
    }
  ];

  const emojiCategories = [
    {
      name: 'Smileys',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳']
    },
    {
      name: 'Gestures',
      emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀']
    },
    {
      name: 'Hearts',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
    },
    {
      name: 'Objects',
      emojis: ['⭐', '✨', '💫', '🔥', '💧', '🌊', '⚡', '☀️', '🌙', '🌈', '☁️', '❄️', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🎮', '🎯', '🎲', '🎵', '🎸', '📱', '💻', '⌚']
    }
  ];

  const applyFormatting = (format) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = richText.substring(start, end);
    const formatMarkup = formattingOptions.find(f => f.name === format)?.markup;

    if (!formatMarkup) return;

    let formattedText = '';
    
    if (selectedText) {
      formattedText = `${formatMarkup}${selectedText}${formatMarkup}`;
    } else {
      formattedText = `${formatMarkup}${formatMarkup}`;
    }
    
    const newText = richText.substring(0, start) + formattedText + richText.substring(end);
    onSetRichText(newText);
    
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + formatMarkup.length, start + formatMarkup.length + selectedText.length);
      } else {
        textarea.setSelectionRange(start + formatMarkup.length, start + formatMarkup.length);
      }
    }, 0);
  };

  const insertList = (listType) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = richText.substring(0, start).split('\n');
    
    let listMarkup = '';
    if (listType === 'bullet') {
      listMarkup = '\n- ';
    } else if (listType === 'numbered') {
      const lineNumber = lines.filter(line => line.trim().match(/^\d+\./)).length + 1;
      listMarkup = `\n${lineNumber}. `;
    }

    const newText = richText.substring(0, start) + listMarkup + richText.substring(start);
    onSetRichText(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + listMarkup.length, start + listMarkup.length);
    }, 0);
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newText = richText.substring(0, start) + emoji + richText.substring(start);
    onSetRichText(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (!url) return;

    const text = prompt('Enter link text (optional):') || url;
    const markdownLink = `[${text}](${url})`;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = richText.substring(start, end);
    
    const linkText = selectedText ? `[${selectedText}](${url})` : markdownLink;
    
    const newText = richText.substring(0, start) + linkText + richText.substring(end);
    onSetRichText(newText);
  };

  const insertCodeBlock = () => {
    const language = prompt('Enter programming language (optional):') || '';
    const codeBlock = `\n\`\`\`${language}\n\n\`\`\`\n`;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newText = richText.substring(0, start) + codeBlock + richText.substring(start);
    onSetRichText(newText);
    
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + codeBlock.length - 5;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const clearFormatting = () => {
    const cleanedText = richText
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1');
    
    onSetRichText(cleanedText);
    setActiveFormats(new Set());
  };

  const formatRichText = (text) => {
    if (!text) return '';

    const escapeHtml = (unsafe) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    let safeText = escapeHtml(text);
    
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
    safeText = safeText.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    safeText = safeText.replace(/__(.*?)__/g, '<u class="underline decoration-2">$1</u>');
    safeText = safeText.replace(/~~(.*?)~~/g, '<del class="line-through text-gray-500">$1</del>');
    safeText = safeText.replace(/`(.*?)`/g, '<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono text-sm">$1</code>');
    safeText = safeText.replace(/\n/g, '<br>');
    safeText = safeText.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" class="text-blue-600 underline hover:text-blue-700 transition-colors" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    safeText = safeText.replace(
      /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
      (url) => {
        if (!safeText.includes(`href="${url}"`)) {
          return `<a href="${url}" class="text-blue-600 underline hover:text-blue-700 transition-colors" target="_blank" rel="noopener noreferrer">${url}</a>`;
        }
        return url;
      }
    );

    return safeText;
  };

  const handleSendRichText = () => {
    if (!richText.trim()) return;
    onSendRichText(richText.trim(), 'rich_text');
  };

  const handleClose = () => {
    onSetShowTextEditor(false);
    setShowEmojiPicker(false);
  };

  if (!showTextEditor) return null;

  return (
    <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl transform transition-all animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Type className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Rich Text Editor</h3>
              <p className="text-sm text-gray-500">Format your message with style</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close editor"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
          {/* Text Formatting */}
          <div className="flex items-center gap-1 pr-3 border-r border-gray-300">
            {formattingOptions.map(format => {
              const Icon = format.icon;
              return (
                <button
                  key={format.name}
                  onClick={() => applyFormatting(format.name)}
                  className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer text-gray-700 hover:text-gray-900"
                  title={format.title}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1 pr-3 border-r border-gray-300">
            <button
              onClick={() => insertList('bullet')}
              className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer text-gray-700 hover:text-gray-900"
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertList('numbered')}
              className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer text-gray-700 hover:text-gray-900"
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
          </div>

          {/* Additional Tools */}
          <div className="flex items-center gap-1 pr-3 border-r border-gray-300">
            <button
              onClick={insertLink}
              className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer text-gray-700 hover:text-gray-900"
              title="Insert Link"
            >
              <Link className="w-4 h-4" />
            </button>
            <button
              onClick={insertCodeBlock}
              className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer text-gray-700 hover:text-gray-900"
              title="Insert Code Block"
            >
              <FileCode className="w-4 h-4" />
            </button>
          </div>

          {/* Emoji & Clear */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer ${
                showEmojiPicker ? 'bg-white shadow-sm text-purple-600' : 'text-gray-700 hover:text-gray-900'
              }`}
              title="Emoji Picker"
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              onClick={clearFormatting}
              className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer text-gray-700 hover:text-gray-900"
              title="Clear Formatting"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {/* Character Count */}
          <div className="ml-auto text-xs text-gray-500 bg-white px-3 py-1.5 rounded-lg shadow-sm">
            {richText.length} characters
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Text Area */}
          <div className="flex-1 p-6">
            <textarea
              ref={textareaRef}
              value={richText}
              onChange={(e) => onSetRichText(e.target.value)}
              placeholder="Start typing your message here...

You can use:
• **bold** for bold text
• *italic* for italic text
• __underline__ for underlined text
• ~~strikethrough~~ for crossed text
• `code` for inline code
• [link text](url) for links"
              className="w-full h-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-sans text-gray-800 leading-relaxed bg-gray-50 placeholder:text-gray-400"
            />
          </div>

          {/* Preview Panel */}
          <div className="w-96 border-l border-gray-200 bg-gray-50 p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-gray-500" />
              <h4 className="text-sm font-semibold text-gray-700">Live Preview</h4>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200 min-h-[200px] shadow-sm">
              {richText ? (
                <div 
                  className="prose prose-sm max-w-none"
                  style={{
                    lineHeight: '1.6',
                    fontSize: '0.875rem',
                    color: '#374151'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: formatRichText(richText) 
                  }}
                />
              ) : (
                <p className="text-gray-400 italic text-sm">Your formatted message will appear here...</p>
              )}
            </div>

            {/* Formatting Guide */}
            <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
              <h5 className="text-xs font-semibold text-purple-900 mb-2">Quick Guide</h5>
              <div className="space-y-1 text-xs text-purple-700">
                <p>**text** → <strong>bold</strong></p>
                <p>*text* → <em>italic</em></p>
                <p>__text__ → <u>underline</u></p>
                <p>~~text~~ → <del>strikethrough</del></p>
                <p>`code` → <code className="bg-purple-100 px-1 rounded">code</code></p>
              </div>
            </div>
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="border-t border-gray-200 bg-white p-4 max-h-64 overflow-y-auto">
            <div className="space-y-4">
              {emojiCategories.map(category => (
                <div key={category.name}>
                  <p className="text-xs font-semibold text-gray-700 mb-2">{category.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {category.emojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer text-lg transition-all hover:scale-110"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 bg-gray-50 rounded-b-2xl border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Tip:</span> Select text and click formatting buttons
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 rounded-xl transition-all cursor-pointer border border-gray-300 shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSendRichText}
              disabled={!richText.trim() || sending}
              className="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}