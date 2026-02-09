import { useState, useEffect, useCallback } from 'react';
import { aiAPI } from '../../lib/api'; 

export default function TypingPredictions({ 
  currentText, 
  conversationContext, 
  onPredictionSelect,
  enabled = true 
}) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState(null);

  // Debounced prediction fetch
  useEffect(() => {
    if (!enabled || !currentText || currentText.trim().length < 2) {
      setPredictions([]);
      setSelectedIndex(-1);
      return;
    }

    const fetchPredictions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔮 Fetching typing predictions for:', currentText);
        
        const response = await aiAPI.getTypingSuggestions({
          currentText: currentText.trim(),
          conversationContext: conversationContext || [],
          maxSuggestions: 3,
          language: 'en'
        });

        console.log('🔮 Typing predictions response:', response.data);

        if (response.data.success && response.data.suggestions) {
          setPredictions(response.data.suggestions);
          setSelectedIndex(-1);
        } else {
          setPredictions([]);
        }
      } catch (error) {
        console.error(' Error fetching typing predictions:', error);
        setError('Failed to load suggestions');
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    };

    // Use debounce to avoid too many API calls
    const timeoutId = setTimeout(fetchPredictions, 500); // Increased to 500ms for better UX
    
    return () => clearTimeout(timeoutId);
  }, [currentText, conversationContext, enabled]);

  const handlePredictionClick = (prediction) => {
    console.log('🔮 Prediction selected:', prediction);
    if (onPredictionSelect) {
      onPredictionSelect(prediction);
    }
    setPredictions([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = useCallback((e) => {
    if (predictions.length === 0) return;

    // Tab to cycle through predictions
    if (e.key === 'Tab' && predictions.length > 0) {
      e.preventDefault();
      const newIndex = (selectedIndex + 1) % predictions.length;
      setSelectedIndex(newIndex);
    } 
    // Enter to select highlighted prediction
    else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handlePredictionClick(predictions[selectedIndex]);
    } 
    // Escape to dismiss predictions
    else if (e.key === 'Escape') {
      setPredictions([]);
      setSelectedIndex(-1);
    }
  }, [predictions, selectedIndex, handlePredictionClick]);

  // Add global key listener
  useEffect(() => {
    if (predictions.length > 0) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [predictions, handleKeyDown]);

  // Don't show if no predictions or disabled
  if (!enabled || predictions.length === 0 || loading) {
    return null;
  }

  return (
    <div className="typing-predictions absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
      <div className="p-2">
        <div className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Suggestions {loading && '(loading...)'}
        </div>
        
        {error && (
          <div className="text-xs text-red-500 mb-2">{error}</div>
        )}
        
        {predictions.map((prediction, index) => (
          <button
            key={index}
            onClick={() => handlePredictionClick(prediction)}
            className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-blue-50 transition-colors cursor-pointer ${
              index === selectedIndex ? 'bg-blue-50 border border-blue-200' : ''
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-blue-500 font-medium">→</span>
              <span className="text-gray-900">{prediction}</span>
            </div>
          </button>
        ))}
        
        <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <span>Tab to cycle • Enter to select • Esc to dismiss</span>
        </div>
      </div>
    </div>
  );
}