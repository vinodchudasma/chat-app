import React from 'react';
import { Phone, Video, Clock, Check, X } from 'lucide-react';

const CallHistoryMessage = ({ callData, isOwnMessage }) => {
  const {
    call_id,
    call_type,
    call_status,
    duration,
    timestamp
  } = callData;

  const getCallIcon = () => {
    return call_type === 'video' ? 
      <Video size={16} /> : 
      <Phone size={16} />;
  };

  const getCallStatus = () => {
    switch (call_status) {
      case 'initiated':
        return { text: 'Call initiated', color: 'text-blue-500' };
      case 'answered':
        return { text: 'Call answered', color: 'text-green-500' };
      case 'completed':
        return { text: 'Call completed', color: 'text-green-500' };
      case 'missed':
        return { text: 'Missed call', color: 'text-red-500' };
      case 'rejected':
        return { text: 'Call declined', color: 'text-red-500' };
      case 'failed':
        return { text: 'Call failed', color: 'text-orange-500' };
      default:
        return { text: 'Call', color: 'text-gray-500' };
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const statusInfo = getCallStatus();

  return (
    <div className={`call-message p-3 rounded-lg max-w-xs ${
      isOwnMessage 
        ? 'bg-blue-500 text-white' 
        : 'bg-gray-100 text-gray-900'
    }`}>
      {/* Call Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`${isOwnMessage ? 'text-white' : 'text-blue-500'}`}>
            {getCallIcon()}
          </div>
          <span className={`text-sm font-medium ${
            isOwnMessage ? 'text-white' : statusInfo.color
          }`}>
            {statusInfo.text}
          </span>
        </div>
        
        {/* Status icon based on call outcome */}
        <div className={`text-xs ${
          isOwnMessage ? 'text-blue-200' : 'text-gray-500'
        }`}>
          {call_status === 'completed' || call_status === 'answered' ? (
            <Check size={14} />
          ) : call_status === 'missed' || call_status === 'rejected' ? (
            <X size={14} />
          ) : (
            <Clock size={14} />
          )}
        </div>
      </div>

      {/* Call Details */}
      <div className={`space-y-1 text-sm ${
        isOwnMessage ? 'text-blue-100' : 'text-gray-600'
      }`}>
        {/* Call Type */}
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="font-medium capitalize">
            {call_type} call
          </span>
        </div>

        {/* Duration */}
        {duration > 0 && (
          <div className="flex justify-between">
            <span>Duration:</span>
            <span className="font-medium">
              {formatDuration(duration)}
            </span>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex justify-between">
          <span>Time:</span>
          <span className="font-medium">
            {formatTimestamp(timestamp)}
          </span>
        </div>

        {/* Call ID (truncated for display) */}
        <div className="flex justify-between">
          <span>Call ID:</span>
          <span className="font-mono text-xs truncate max-w-[120px]">
            {call_id.split('_')[1]} {/* Show only the timestamp part */}
          </span>
        </div>
      </div>

      {/* Call Actions (if needed) */}
      {(call_status === 'missed' || call_status === 'failed') && (
        <button className={`mt-2 w-full py-1 px-2 rounded text-xs font-medium cursor-pointer ${
          isOwnMessage 
            ? 'bg-white text-blue-500 hover:bg-gray-100' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        } transition-colors`}>
          Call Back
        </button>
      )}
    </div>
  );
};

export default CallHistoryMessage;