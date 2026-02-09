import { useState, useEffect } from 'react';
import { aiAPI } from '../../lib/api';

export default function MessageTranslation({ 
  message, 
  originalLanguage, 
  targetLanguage = 'en',
  autoTranslate = false 
}) {
  const [translation, setTranslation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTranslation, setShowTranslation] = useState(autoTranslate);

  useEffect(() => {
    if (showTranslation && message && !translation && !loading) {
      translateMessage();
    }
  }, [showTranslation, message]);

  const translateMessage = async () => {
    if (!message) return;

    setLoading(true);
    setError(null);
    
    try {
      const response = await aiAPI.translateMessage({
        text: message,
        targetLanguage,
        sourceLanguage: originalLanguage
      });

      if (response.data.success) {
        setTranslation(response.data.translation);
      } else {
        setError('Translation failed');
      }
    } catch (err) {
      console.error('Translation error:', err);
      setError('Failed to translate message');
    } finally {
      setLoading(false);
    }
  };

  const handleTranslateClick = () => {
    if (!translation && !loading) {
      translateMessage();
    }
    setShowTranslation(!showTranslation);
  };

  if (!message) return null;

  return (
    // <div className="message-translation mt-2">
    //   {/* {!showTranslation ? (
    //     <button
    //       onClick={handleTranslateClick}
    //       className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-colors cursor-pointer"
    //     >
    //       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    //       </svg>
    //       Translate
    //     </button>
    //   ) : (
    //     <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
    //       <div className="flex items-center justify-between mb-2">
    //         <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
    //           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    //           </svg>
    //           Translation ({targetLanguage.toUpperCase()})
    //         </span>
    //         <button
    //           onClick={handleTranslateClick}
    //           className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
    //         >
    //           Hide
    //         </button>
    //       </div>
          
    //       {loading ? (
    //         <div className="text-sm text-gray-500">Translating...</div>
    //       ) : error ? (
    //         <div className="text-sm text-red-500">{error}</div>
    //       ) : translation ? (
    //         <div className="text-sm text-gray-700">
    //           {translation.translated}
    //         </div>
    //       ) : null}
    //     </div>
    //   )} */}
    // </div>
    <></>
  );
}