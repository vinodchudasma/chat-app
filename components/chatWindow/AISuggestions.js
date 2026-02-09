import { useState, useEffect, useRef } from 'react';
import { aiAPI } from '../../lib/api';

export default function AISuggestions({ 
  message, 
  messageId, 
  chatContext = [],
  onSuggestionSelect,
  isOwnMessage = false 
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Refs to prevent duplicate API calls
  const previousMessageRef = useRef('');
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    console.log('🤖 AISuggestions triggered:', {
      message: message?.substring(0, 50),
      messageId,
      isOwnMessage,
      hasFetched: hasFetchedRef.current
    });

    // Reset when message changes
    if (message !== previousMessageRef.current) {
      hasFetchedRef.current = false;
      previousMessageRef.current = message;
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [message]);

  useEffect(() => {
    // Only fetch for non-own messages with content
    if (isOwnMessage || !message || message.trim().length < 2) {
      console.log('🤖 Skipping AI suggestions: own message or no content');
      setShowSuggestions(false);
      return;
    }

    // Prevent duplicate calls
    if (hasFetchedRef.current) {
      console.log('🤖 Skipping AI suggestions: already fetched');
      return;
    }

    const fetchSuggestions = async () => {
      console.log('🤖 Fetching AI suggestions for message:', message.substring(0, 50));
      
      hasFetchedRef.current = true;
      setLoading(true);
      setError(null);
      
      try {
        const response = await aiAPI.getMessageSuggestions({
          message,
          message_id: messageId,
          chat_context: chatContext
        });
        
        console.log('🤖 AI suggestions received:', response.data.suggestions);
        setSuggestions(response.data.suggestions || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Error fetching AI suggestions:', err);
        setError('Failed to load suggestions');
        // Still show fallback suggestions
        setSuggestions(["Okay", "Thanks!", "Got it"]);
        setShowSuggestions(true);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call
    const timer = setTimeout(fetchSuggestions, 1000);
    
    return () => clearTimeout(timer);
  }, [message, messageId, isOwnMessage]);

  const handleSuggestionClick = (suggestion) => {
    console.log('🤖 Suggestion clicked:', suggestion);
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
    setShowSuggestions(false);
  };

  // Don't show suggestions if there are none or loading/error states
  if (!showSuggestions || suggestions.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="ai-suggestions-loading">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          Generating suggestions...
        </div>
      </div>
    );
  }

  return (
    <div className="ai-suggestions mt-2 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(suggestion)}
            className="ai-suggestion-button px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50"
            disabled={loading}
          >
            {suggestion}
          </button>
        ))}
      </div>
      
      {error && (
        <div className="text-xs text-red-500 mt-1">
          {error}
        </div>
      )}
    </div>
  );
}