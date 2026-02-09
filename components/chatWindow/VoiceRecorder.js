

import { useState, useEffect, useRef } from 'react';

export default function VoiceRecorder({
  isRecording,
  recordingTime,
  audioBlob,
  onStartRecording,
  onStopRecording,
  onCancelRecording, // Make sure this prop is received
  onSendVoiceMessage,
  uploading
}) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
    } else {
      setAudioUrl(null);
    }
  }, [audioBlob]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSend = () => {
    onSendVoiceMessage(audioBlob, recordingTime);
  };

  // debug logging to check if cancel function is called
  const handleCancel = () => {
    console.log('Cancel button clicked');
    if (onCancelRecording) {
      onCancelRecording();
    } else {
      console.error('onCancelRecording prop is not provided');
    }
  };

  return (
    <div className="fixed inset-0 bg-opacity-10 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-96 max-w-full mx-4 border border-gray-200">
        <div className="p-6">
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Voice Message</h3>
            
            {/* Recording Animation */}
            {isRecording && (
              <div className="mb-6">
                <div className="flex justify-center space-x-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-2 bg-red-500 rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 24 + 8}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-red-500 font-semibold text-sm">Recording...</p>
                  <p className="text-3xl font-mono text-gray-800 font-bold">{formatTime(recordingTime)}</p>
                  <p className="text-xs text-gray-500">Click stop when finished</p>
                </div>
              </div>
            )}

            {/* Audio Preview */}
            {audioBlob && !isRecording && (
              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Voice Preview</span>
                    <span className="text-xs text-gray-500">{formatTime(recordingTime)}</span>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-4 mb-3">
                    <button
                      onClick={handlePlayPause}
                      disabled={uploading || !audioUrl}
                      className="p-4 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-blue-300 transition-all duration-200 cursor-pointer shadow-lg transform hover:scale-105"
                    >
                      {isPlaying ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                          style={{ 
                            width: audioRef.current && audioRef.current.duration ? 
                              `${(currentTime / audioRef.current.duration) * 100}%` : '0%' 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Audio Element */}
                  {audioUrl && (
                    <audio
                      ref={audioRef}
                      onEnded={handleAudioEnd}
                      onTimeUpdate={handleTimeUpdate}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      className="hidden"
                    >
                      <source src={audioUrl} type="audio/webm" />
                      Your browser doesn't support audio playback.
                    </audio>
                  )}
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-center space-x-4">
              {!isRecording && !audioBlob && (
                <button
                  onClick={onStartRecording}
                  className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all duration-200 cursor-pointer shadow-lg transform hover:scale-105"
                  title="Start Recording"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                </button>
              )}

              {isRecording && (
                <button
                  onClick={onStopRecording}
                  className="p-4 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-all duration-200 cursor-pointer shadow-lg transform hover:scale-105"
                  title="Stop Recording"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                </button>
              )}

              {audioBlob && !isRecording && (
                <button
                  onClick={handleSend}
                  disabled={uploading}
                  className="p-4 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-green-300 transition-all duration-200 cursor-pointer shadow-lg transform hover:scale-105"
                  title="Send Voice Message"
                >
                  {uploading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  )}
                </button>
              )}

              <button
                onClick={handleCancel} 
                className="p-3 bg-gray-300 text-gray-700 rounded-full hover:bg-gray-400 transition-all duration-200 cursor-pointer shadow-md transform hover:scale-105"
                title="Cancel"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            {/* Instructions */}
            <p className="text-sm text-gray-500 mt-4">
              {isRecording 
                ? 'Recording in progress...' 
                : audioBlob 
                  ? 'Preview your voice message before sending' 
                  : 'Click the microphone to start recording'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}