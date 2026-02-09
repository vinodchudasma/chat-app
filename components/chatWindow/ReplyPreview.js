export default function ReplyPreview({
  replyToMessage,
  currentUserId,
  onCancelReply
}) {
  if (!replyToMessage) return null;

  // Get sender name
  const getSenderName = () => {
    if (!replyToMessage.sender) return 'Unknown';
    
    if (replyToMessage.sender_id === currentUserId) {
      return 'yourself';
    }
    
    const firstName = replyToMessage.sender.first_name || '';
    const lastName = replyToMessage.sender.last_name || '';
    return `${firstName} ${lastName}`?.trim() || 'Unknown';
  };

  // Helper function to get preview text
  const getMessagePreview = () => {
    if (!replyToMessage) return '';
    
    switch (replyToMessage.message_type) {
      case 'text':
        return replyToMessage.message || 'Text message';
      case 'rich_text':
        // Remove HTML tags for preview
        const textOnly = replyToMessage.message?.replace(/<[^>]*>/g, '') || '';
        return textOnly.length > 50 ? textOnly.substring(0, 50) + '...' : textOnly;
      case 'image':
        return '🖼 Image';
      case 'video':
        return '🎥 Video';
      case 'file':
        return `📎 ${replyToMessage.file_name || 'File'}`;
      case 'code':
        return '💻 Code snippet';
      case 'audio':
      case 'voice':
        return '🎤 Voice message';
      default:
        if (replyToMessage.message) {
          return typeof replyToMessage.message === 'string' 
            ? replyToMessage.message.substring(0, 50) + (replyToMessage.message.length > 50 ? '...' : '')
            : 'Message';
        }
        return 'Message';
    }
  };

  return (
    <div className="reply-preview bg-gray-50 border-t border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center text-xs font-medium text-gray-500 mb-1">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>Replying to {getSenderName()}</span>
          </div>
          <div className="text-sm text-gray-700 truncate pl-5">
            {getMessagePreview()}
          </div>
        </div>
        <button
          onClick={onCancelReply}
          className="text-gray-400 hover:text-gray-600 cursor-pointer ml-2 p-1"
          aria-label="Cancel reply"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}