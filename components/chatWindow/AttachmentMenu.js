export default function AttachmentMenu({
  showAttachmentMenu,
  uploading,
  fileInputRef,
  attachmentMenuRef,
  onSetShowAttachmentMenu,
  onSetShowCodeSnippetMenu,
  onFileSelect,
  onSetShowVoiceRecorder,
  onSetShowTextEditor
}) {
  
  const handleVoiceMessageClick = () => {
    onSetShowVoiceRecorder(true);
    onSetShowAttachmentMenu(false);
  };

  const handleTextEditorClick = () => {
    onSetShowTextEditor(true);
    onSetShowAttachmentMenu(false);
  };

  const handleFileSelectClick = (acceptType) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptType;
      fileInputRef.current.click();
    }
    onSetShowAttachmentMenu(false);
  };

  return (
    <div className="relative" ref={attachmentMenuRef}>
      <button
        type="button"
        onClick={() => onSetShowAttachmentMenu(!showAttachmentMenu)}
        disabled={uploading}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>

      {showAttachmentMenu && (
        <div className="absolute bottom-full left-0 mb-2 bg-white shadow-xl rounded-lg border border-gray-200 z-40 min-w-48 overflow-hidden">
          <div className="py-1">
            {/* Photos & Videos */}
            <button
              onClick={() => handleFileSelectClick('image/*,video/*')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Photos & Videos
            </button>

            {/* Voice Message */}
            <button
              onClick={handleVoiceMessageClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
              </svg>
              Voice Message
            </button>

            {/* Text Editor */}
            <button
              onClick={handleTextEditorClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Text Editor
            </button>

            {/* Code Snippet */}
            <button
              onClick={() => {
                onSetShowAttachmentMenu(false);
                onSetShowCodeSnippetMenu(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Code Snippet
            </button>

            {/* Document */}
            <button
              onClick={() => handleFileSelectClick('*')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Document
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelect}
        multiple
        className="hidden"
      />
    </div>
  );
}