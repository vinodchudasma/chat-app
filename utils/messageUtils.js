// Check if message is a call history message
export const isCallMessage = (message) => {
  if (!message.message) return false;
  
  try {
    const parsed = JSON.parse(message.message);
    return parsed && 
           typeof parsed === 'object' &&
           parsed.call_id && 
           parsed.call_type && 
           parsed.call_status;
  } catch (error) {
    return false;
  }
};

// Parse call message data
export const parseCallMessage = (messageText) => {
  try {
    return JSON.parse(messageText);
  } catch (error) {
    console.error('Error parsing call message:', error);
    return null;
  }
};

// Format call duration for display
export const formatCallDuration = (seconds) => {
  if (!seconds || seconds === 0) return 'No duration';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};