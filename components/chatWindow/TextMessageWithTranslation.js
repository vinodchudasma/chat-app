// In your main chat message component
import VoiceMessageWithTranscription from "./VoiceMessageWithTranscription";
import TextMessageWithTranslation from "./TextMessageWithTranslation";

function ChatMessage({ message, isOwnMessage, chatType }) {
  // Check message type
  const isVoiceMessage = message.type === "voice" || message.file_url;
  const isTextMessage = message.type === "text" || message.content;

  return (
    <div className="py-1">
      {isVoiceMessage ? (
        <VoiceMessageWithTranscription
          message={message}
          isOwnMessage={isOwnMessage}
          chatType={chatType}
          onAudioPlay={handleAudioPlay}
          onAudioPause={handleAudioPause}
          onAudioEnd={handleAudioEnd}
          formatVoiceDuration={formatDuration}
        />
      ) : isTextMessage ? (
        <TextMessageWithTranslation
          message={message}
          isOwnMessage={isOwnMessage}
          chatType={chatType}
        />
      ) : (
        // Original message display (for other types)
        <div className={`message ${isOwnMessage ? "own-message" : ""}`}>
          {message.content}
        </div>
      )}
    </div>
  );
}
