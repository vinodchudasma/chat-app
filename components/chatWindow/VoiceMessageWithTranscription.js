// // // import { useState, useEffect } from 'react';
// // // import { chatAPI, groupAPI } from '../../lib/api';

// // // export default function VoiceMessageWithTranscription({
// // //   message,
// // //   isOwnMessage,
// // //   onAudioPlay,
// // //   onAudioPause,
// // //   onAudioEnd,
// // //   formatVoiceDuration,
// // //   chatType = 'private' // 'private' or 'group'
// // // }) {
// // //   const [showTranscription, setShowTranscription] = useState(false);
// // //   const [transcription, setTranscription] = useState(null);
// // //   const [loading, setLoading] = useState(false);
// // //   const [error, setError] = useState(null);
// // //   const [targetLanguage, setTargetLanguage] = useState('en');

// // //   // Languages available for translation
// // //   const languages = [
// // //     { code: 'en', name: 'English' },
// // //     { code: 'es', name: 'Spanish' },
// // //     { code: 'fr', name: 'French' },
// // //     { code: 'de', name: 'German' },
// // //     { code: 'it', name: 'Italian' },
// // //     { code: 'pt', name: 'Portuguese' },
// // //     { code: 'ru', name: 'Russian' },
// // //     { code: 'ja', name: 'Japanese' },
// // //     { code: 'ko', name: 'Korean' },
// // //     { code: 'zh', name: 'Chinese' },
// // //     { code: 'ar', name: 'Arabic' },
// // //     { code: 'hi', name: 'Hindi' }
// // //   ];

// // //   // Load transcription when component mounts if available
// // //   useEffect(() => {
// // //     if (message.transcription_data) {
// // //       setTranscription(message.transcription_data);
// // //     }
// // //   }, [message]);

// // //   const handleTranscribe = async (language = 'en') => {
// // //     setLoading(true);
// // //     setError(null);

// // //     try {
// // //       const api = chatType === 'group' ? groupAPI : chatAPI;
// // //       const response = await api.transcribeVoiceMessage(message.id, { targetLanguage: language });

// // //       if (response.data.success) {
// // //         setTranscription({
// // //           transcription: response.data.transcription,
// // //           translatedText: response.data.translatedText,
// // //           language: response.data.language,
// // //           hasTranslation: response.data.hasTranslation
// // //         });
// // //         setShowTranscription(true);
// // //       } else {
// // //         setError('Transcription failed');
// // //       }
// // //     } catch (err) {
// // //       console.error('Transcription error:', err);
// // //       setError('Failed to transcribe voice message');
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   };

// // //   const handleTranslate = async (newLanguage) => {
// // //     setTargetLanguage(newLanguage);
// // //     await handleTranscribe(newLanguage);
// // //   };

// // //   const toggleTranscription = async () => {
// // //     if (!transcription && !loading) {
// // //       // First, check if transcription already exists
// // //       try {
// // //         const api = chatType === 'group' ? groupAPI : chatAPI;
// // //         const existingResponse = await api.getVoiceMessageTranscription(message.id);

// // //         if (existingResponse.data.success) {
// // //           setTranscription(existingResponse.data.transcription);
// // //           setShowTranscription(true);
// // //         } else {
// // //           // If no existing transcription, create one
// // //           await handleTranscribe(targetLanguage);
// // //         }
// // //       } catch (error) {
// // //         // If get fails, create new transcription
// // //         await handleTranscribe(targetLanguage);
// // //       }
// // //     } else {
// // //       setShowTranscription(!showTranscription);
// // //     }
// // //   };

// // //   return (
// // //     <div className="voice-message-with-transcription">
// // //       {/* Voice message player */}
// // //       <div className={`flex items-center gap-3 p-3 rounded-lg ${
// // //         isOwnMessage ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
// // //       }`}>
// // //         <div className="text-2xl">🎵</div>
// // //         <div className="flex-1">
// // //           <div className="font-medium text-sm">
// // //             Voice Message
// // //           </div>
// // //           <div className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
// // //             {formatVoiceDuration(message.duration || message.recording_duration || 0)}
// // //           </div>
// // //           <audio
// // //             controls
// // //             className="w-full mt-2"
// // //             src={message.file_url}
// // //             onPlay={() => onAudioPlay && onAudioPlay(message.id)}
// // //             onPause={() => onAudioPause && onAudioPause(message.id)}
// // //             onEnded={() => onAudioEnd && onAudioEnd(message.id)}
// // //             preload="metadata"
// // //           >
// // //             Your browser does not support the audio element.
// // //           </audio>
// // //         </div>
// // //       </div>

// // //       {/* Transcription section */}
// // //       <div className="mt-2">

// // //         <div className="flex items-center justify-between">
// // //           <button
// // //             onClick={toggleTranscription}
// // //             disabled={loading}
// // //             className={`flex items-center gap-2 text-xs px-3 py-1 rounded-full transition-colors cursor-pointer ${
// // //               isOwnMessage
// // //                 ? 'bg-blue-400 text-white hover:bg-blue-300'
// // //                 : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
// // //             } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
// // //           >
// // //             {loading ? (
// // //               <>
// // //                 <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
// // //                 Processing...
// // //               </>
// // //             ) : (
// // //               <>
// // //                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
// // //                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
// // //                 </svg>
// // //                 {showTranscription ? 'Hide Caption' : 'Show Caption'}
// // //               </>
// // //             )}
// // //           </button>

// // //           {transcription && (
// // //             <div className="flex items-center gap-2">
// // //               <span className="text-xs text-gray-500">Translate:</span>
// // //               <select
// // //                 value={targetLanguage}
// // //                 onChange={(e) => handleTranslate(e.target.value)}
// // //                 disabled={loading}
// // //                 className="text-xs border rounded px-2 py-1 bg-white cursor-pointer"
// // //               >
// // //                 {languages.map(lang => (
// // //                   <option key={lang.code} value={lang.code}>
// // //                     {lang.name}
// // //                   </option>
// // //                 ))}
// // //               </select>
// // //             </div>
// // //           )}
// // //         </div>

// // //         {error && (
// // //           <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
// // //             {error}
// // //           </div>
// // //         )}

// // //         {showTranscription && transcription && (
// // //           <div className="mt-3 p-3 bg-white bg-opacity-90 rounded-lg border border-gray-200">

// // //             <div className="mb-3">
// // //               <div className="text-xs font-medium text-gray-500 mb-1">
// // //                 Original Transcription
// // //               </div>
// // //               <div className="text-sm text-gray-800">
// // //                 {transcription.transcription}
// // //               </div>
// // //             </div>

// // //             {transcription.hasTranslation && transcription.translatedText && (
// // //               <div>
// // //                 <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-2">
// // //                   Translation
// // //                   <span className="px-1 bg-blue-100 text-blue-700 rounded text-xs">
// // //                     {languages.find(lang => lang.code === transcription.language)?.name}
// // //                   </span>
// // //                 </div>
// // //                 <div className="text-sm text-gray-800">
// // //                   {transcription.translatedText}
// // //                 </div>
// // //               </div>
// // //             )}

// // //             <div className="mt-2 pt-2 border-t border-gray-100">
// // //               <div className="text-xs text-gray-400">
// // //                 Transcribed in {languages.find(lang => lang.code === (transcription.language || 'en'))?.name}
// // //               </div>
// // //             </div>
// // //           </div>
// // //         )}

// // //         {message.transcription_data && !showTranscription && (
// // //           <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
// // //             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
// // //               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
// // //             </svg>
// // //             Caption available
// // //           </div>
// // //         )}
// // //       </div>
// // //     </div>
// // //   );
// // // }

// // import { useState, useEffect } from 'react';
// // import { chatAPI, groupAPI } from '../../lib/api';

// //  export default function VoiceMessageWithTranscription({
// //   message,
// //   isOwnMessage,
// //   onAudioPlay,
// //   onAudioPause,
// //   onAudioEnd,
// //   formatVoiceDuration,
// //   chatType = 'private'
// // }) {
// //   const [showTranscription, setShowTranscription] = useState(false);
// //   const [transcription, setTranscription] = useState(null);
// //   const [loading, setLoading] = useState(false);
// //   const [error, setError] = useState(null);
// //   const [targetLanguage, setTargetLanguage] = useState('en');
// //   const [isPlaying, setIsPlaying] = useState(false);

// //   const languages = [
// //     { code: 'en', name: 'English' },
// //     { code: 'es', name: 'Spanish' },
// //     { code: 'fr', name: 'French' },
// //     { code: 'de', name: 'German' },
// //     { code: 'it', name: 'Italian' },
// //     { code: 'pt', name: 'Portuguese' },
// //     { code: 'ru', name: 'Russian' },
// //     { code: 'ja', name: 'Japanese' },
// //     { code: 'ko', name: 'Korean' },
// //     { code: 'zh', name: 'Chinese' },
// //     { code: 'ar', name: 'Arabic' },
// //     { code: 'hi', name: 'Hindi' }
// //   ];

// //   useEffect(() => {
// //     if (message.transcription_data) {
// //       setTranscription(message.transcription_data);
// //     }
// //   }, [message]);

// //   const handleTranscribe = async (language = 'original') => {
// //     setLoading(true);
// //     setError(null);

// //     try {

// //       const api = chatType === 'group' ? groupAPI : chatAPI;
// //       const response = await api.transcribeVoiceMessage(message.id, { targetLanguage: language === 'original' ? 'en' : language, skipTranslation: language === 'original' });

// //       if (response.data.success) {
// //         setTranscription({
// //           transcription: response.data.transcription,
// //           translatedText: language === 'original' ? null : response.data.translatedText,
// //           language: language === 'original' ? 'en' : response.data.language,
// //           hasTranslation: language !== 'original' && response.data.hasTranslation
// //         });
// //         setShowTranscription(true);
// //       } else {
// //         setError('Transcription failed');
// //       }
// //     } catch (err) {
// //       console.error('Transcription error:', err);
// //       setError('Failed to transcribe voice message');
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleTranslate = async (newLanguage) => {
// //     setTargetLanguage(newLanguage);
// //     await handleTranscribe(newLanguage);
// //   };

// //   const toggleTranscription = async () => {
// //     if (!transcription && !loading) {
// //       try {
// //         const existingResponse = await mockAPI.getVoiceMessageTranscription(message.id);

// //         if (existingResponse.data.success) {
// //           setTranscription(existingResponse.data.transcription);
// //           setShowTranscription(true);
// //         } else {
// //           // Get original transcription without translation
// //           await handleTranscribe('original');
// //         }
// //       } catch (error) {
// //         // Get original transcription without translation
// //         await handleTranscribe('original');
// //       }
// //     } else {
// //       setShowTranscription(!showTranscription);
// //     }
// //   };

// //   const handlePlayPause = (e) => {
// //     const audio = e.target;
// //     if (audio.paused) {
// //       setIsPlaying(true);
// //       onAudioPlay && onAudioPlay(message.id);
// //     } else {
// //       setIsPlaying(false);
// //       onAudioPause && onAudioPause(message.id);
// //     }
// //   };

// //   return (
// //     <div className={`max-w-md ${isOwnMessage ? 'ml-auto' : 'mr-auto'}`}>
// //       {/* Main Voice Message Card */}
// //       <div className={`rounded-2xl shadow-sm overflow-hidden ${
// //         isOwnMessage
// //           ? 'bg-gradient-to-br from-blue-500 to-blue-600'
// //           : 'bg-white border border-gray-200'
// //       }`}>

// //         {/* Voice Player Section */}
// //         <div className="p-4">
// //           <div className="flex items-center gap-3">
// //             {/* Waveform Icon */}
// //             <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
// //               isOwnMessage ? 'bg-white/20' : 'bg-blue-50'
// //             }`}>
// //               <svg
// //                 className={`w-6 h-6 ${isOwnMessage ? 'text-white' : 'text-blue-500'}`}
// //                 fill="currentColor"
// //                 viewBox="0 0 24 24"
// //               >
// //                 <path d="M12 3v18M8 6v12M16 6v12M4 9v6M20 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
// //               </svg>
// //             </div>

// //             {/* Voice Info */}
// //             <div className="flex-1 min-w-0">
// //               <div className={`flex items-center justify-between mb-1 ${
// //                 isOwnMessage ? 'text-white' : 'text-gray-900'
// //               }`}>
// //                 <span className="font-semibold text-sm">Voice Message</span>
// //                 <span className={`text-xs font-medium ${
// //                   isOwnMessage ? 'text-white/80' : 'text-gray-500'
// //                 }`}>
// //                   {formatVoiceDuration(message.duration || message.recording_duration || 0)}
// //                 </span>
// //               </div>

// //               {/* Custom Audio Player */}
// //               <div className={`flex items-center gap-2 p-2 rounded-lg ${
// //                 isOwnMessage ? 'bg-white/10' : 'bg-gray-50'
// //               }`}>
// //                 <audio
// //                   className="hidden"
// //                   id={`audio-${message.id}`}
// //                   src={message.file_url}
// //                   onPlay={handlePlayPause}
// //                   onPause={handlePlayPause}
// //                   onEnded={(e) => {
// //                     setIsPlaying(false);
// //                     onAudioEnd && onAudioEnd(message.id);
// //                   }}
// //                   preload="metadata"
// //                 />

// //                 <button
// //                   onClick={() => {
// //                     const audio = document.getElementById(`audio-${message.id}`);
// //                     if (audio.paused) {
// //                       audio.play();
// //                     } else {
// //                       audio.pause();
// //                     }
// //                   }}
// //                   className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
// //                     isOwnMessage
// //                       ? 'bg-white text-blue-500 hover:bg-white/90'
// //                       : 'bg-blue-500 text-white hover:bg-blue-600'
// //                   }`}
// //                 >
// //                   {isPlaying ? (
// //                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
// //                       <rect x="6" y="4" width="4" height="16" rx="1"/>
// //                       <rect x="14" y="4" width="4" height="16" rx="1"/>
// //                     </svg>
// //                   ) : (
// //                     <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
// //                       <path d="M8 5v14l11-7z"/>
// //                     </svg>
// //                   )}
// //                 </button>

// //                 {/* Waveform Visualization */}
// //                 <div className="flex-1 flex items-center gap-0.5 h-8">
// //                   {[...Array(30)].map((_, i) => (
// //                     <div
// //                       key={i}
// //                       className={`flex-1 rounded-full transition-all ${
// //                         isOwnMessage ? 'bg-white/40' : 'bg-gray-300'
// //                       }`}
// //                       style={{
// //                         height: `${Math.random() * 60 + 20}%`,
// //                         opacity: isPlaying && i % 3 === 0 ? 1 : 0.6
// //                       }}
// //                     />
// //                   ))}
// //                 </div>
// //               </div>
// //             </div>
// //           </div>
// //         </div>

// //         {/* Transcription Controls */}
// //         <div className={`px-4 pb-3 ${
// //           isOwnMessage ? 'bg-white/5' : 'bg-gray-50'
// //         }`}>
// //           <div className="flex items-center justify-between gap-2">
// //             <button
// //               onClick={toggleTranscription}
// //               disabled={loading}
// //               className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-all ${
// //                 isOwnMessage
// //                   ? 'bg-white/10 text-white hover:bg-white/20'
// //                   : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
// //               } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
// //             >
// //               {loading ? (
// //                 <>
// //                   <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
// //                   <span>Processing...</span>
// //                 </>
// //               ) : (
// //                 <>
// //                   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
// //                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
// //                   </svg>
// //                   <span>{showTranscription ? 'Hide' : 'Show'} Caption</span>
// //                 </>
// //               )}
// //             </button>

// //             {transcription && (
// //               <select
// //                 value={targetLanguage}
// //                 onChange={(e) => handleTranslate(e.target.value)}
// //                 disabled={loading}
// //                 className={`text-xs font-medium px-3 py-2 rounded-lg border transition-all cursor-pointer ${
// //                   isOwnMessage
// //                     ? 'bg-white/10 text-white border-white/20 hover:bg-white/20'
// //                     : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
// //                 }`}
// //               >
// //                 {languages.map(lang => (
// //                   <option key={lang.code} value={lang.code} className="text-gray-900">
// //                     {lang.name}
// //                   </option>
// //                 ))}
// //               </select>
// //             )}
// //           </div>

// //           {/* Caption Available Indicator */}
// //           {message.transcription_data && !showTranscription && !loading && (
// //             <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
// //               isOwnMessage ? 'text-white/70' : 'text-green-600'
// //             }`}>
// //               <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
// //                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
// //               </svg>
// //               Caption available
// //             </div>
// //           )}
// //         </div>
// //       </div>

// //       {/* Error Message */}
// //       {error && (
// //         <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
// //           <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
// //             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
// //           </svg>
// //           <span className="text-xs text-red-700">{error}</span>
// //         </div>
// //       )}

// //       {/* Transcription Display */}
// //       {showTranscription && transcription && (
// //         <div className={`mt-2 rounded-xl overflow-hidden border ${
// //           isOwnMessage ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
// //         }`}>
// //           <div className="p-4 space-y-3">
// //             {/* Original Transcription */}
// //             <div>
// //               <div className="flex items-center gap-2 mb-2">
// //                 <svg className={`w-4 h-4 ${isOwnMessage ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
// //                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
// //                 </svg>
// //                 <span className={`text-xs font-semibold uppercase tracking-wide ${
// //                   isOwnMessage ? 'text-blue-700' : 'text-gray-600'
// //                 }`}>
// //                   Original
// //                 </span>
// //               </div>
// //               <p className={`text-sm leading-relaxed ${
// //                 isOwnMessage ? 'text-blue-900' : 'text-gray-800'
// //               }`}>
// //                 {transcription.transcription}
// //               </p>
// //             </div>

// //             {/* Translation */}
// //             {transcription.hasTranslation && transcription.translatedText && (
// //               <>
// //                 <div className={`border-t ${isOwnMessage ? 'border-blue-200' : 'border-gray-200'}`} />
// //                 <div>
// //                   <div className="flex items-center gap-2 mb-2">
// //                     <svg className={`w-4 h-4 ${isOwnMessage ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
// //                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
// //                     </svg>
// //                     <span className={`text-xs font-semibold uppercase tracking-wide ${
// //                       isOwnMessage ? 'text-blue-700' : 'text-gray-600'
// //                     }`}>
// //                       Translation
// //                     </span>
// //                     <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
// //                       isOwnMessage ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'
// //                     }`}>
// //                       {languages.find(lang => lang.code === transcription.language)?.name}
// //                     </span>
// //                   </div>
// //                   <p className={`text-sm leading-relaxed ${
// //                     isOwnMessage ? 'text-blue-900' : 'text-gray-800'
// //                   }`}>
// //                     {transcription.translatedText}
// //                   </p>
// //                 </div>
// //               </>
// //             )}
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// import { useState, useEffect } from 'react';
// import { chatAPI, groupAPI } from '../../lib/api';

// export default function VoiceMessageWithTranscription({
//   message,
//   isOwnMessage,
//   onAudioPlay,
//   onAudioPause,
//   onAudioEnd,
//   formatVoiceDuration,
//   chatType = 'private'
// }) {
//   const [showTranscription, setShowTranscription] = useState(false);
//   const [transcription, setTranscription] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [targetLanguage, setTargetLanguage] = useState('en');
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [audioElement, setAudioElement] = useState(null);

//   const languages = [
//     { code: 'en', name: 'English' },
//     { code: 'es', name: 'Spanish' },
//     { code: 'fr', name: 'French' },
//     { code: 'de', name: 'German' },
//     { code: 'it', name: 'Italian' },
//     { code: 'pt', name: 'Portuguese' },
//     { code: 'ru', name: 'Russian' },
//     { code: 'ja', name: 'Japanese' },
//     { code: 'ko', name: 'Korean' },
//     { code: 'zh', name: 'Chinese' },
//     { code: 'ar', name: 'Arabic' },
//     { code: 'hi', name: 'Hindi' }
//   ];

//   useEffect(() => {
//     if (message.transcription_data) {
//       setTranscription(message.transcription_data);
//     }
//   }, [message]);

//   useEffect(() => {
//     const audio = document.getElementById(`audio-${message.id}`);
//     if (audio) {
//       setAudioElement(audio);
//     }
//   }, [message.id]);

//   const handleTranscribe = async (language = 'original') => {
//     setLoading(true);
//     setError(null);

//     try {
//       const api = chatType === 'group' ? groupAPI : chatAPI;
//       const response = await api.transcribeVoiceMessage(message.id, { targetLanguage: language === 'original' ? 'en' : language, skipTranslation: language === 'original' });

//       if (response.data.success) {
//         setTranscription({
//           transcription: response.data.transcription,
//           translatedText: language === 'original' ? null : response.data.translatedText,
//           language: language === 'original' ? 'en' : response.data.language,
//           hasTranslation: language !== 'original' && response.data.hasTranslation
//         });
//         setShowTranscription(true);
//       } else {
//         setError('Transcription failed');
//       }
//     } catch (err) {
//       console.error('Transcription error:', err);
//       setError('Failed to transcribe voice message');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleTranslate = async (newLanguage) => {
//     setTargetLanguage(newLanguage);
//     await handleTranscribe(newLanguage);
//   };

//   const toggleTranscription = async () => {
//     if (!transcription && !loading) {
//       await handleTranscribe('original');
//     } else {
//       setShowTranscription(!showTranscription);
//     }
//   };

//   const handlePlayPause = () => {
//     if (audioElement) {
//       if (audioElement.paused) {
//         audioElement.play();
//         setIsPlaying(true);
//         onAudioPlay && onAudioPlay(message.id);
//       } else {
//         audioElement.pause();
//         setIsPlaying(false);
//         onAudioPause && onAudioPause(message.id);
//       }
//     }
//   };

//   return (
//     <div className={`max-w-md ${isOwnMessage ? 'ml-auto' : 'mr-auto'}`}>
//       {/* Main Voice Message Card */}
//       <div className={`rounded-2xl shadow-sm overflow-hidden ${
//         isOwnMessage
//           ? 'bg-gradient-to-br from-blue-500 to-blue-600'
//           : 'bg-white border border-gray-200'
//       }`}>

//         {/* Voice Player Section */}
//         <div className="p-4">
//           <div className="flex items-center gap-3">
//             {/* Waveform Icon */}
//             <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
//               isOwnMessage ? 'bg-white/20' : 'bg-blue-50'
//             }`}>
//               <svg
//                 className={`w-6 h-6 ${isOwnMessage ? 'text-white' : 'text-blue-500'}`}
//                 fill="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path d="M12 3v18M8 6v12M16 6v12M4 9v6M20 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
//               </svg>
//             </div>

//             {/* Voice Info */}
//             <div className="flex-1 min-w-0">
//               <div className={`flex items-center justify-between mb-1 ${
//                 isOwnMessage ? 'text-white' : 'text-gray-900'
//               }`}>
//                 <span className="font-semibold text-sm">Voice Message</span>
//                 <span className={`text-xs font-medium ${
//                   isOwnMessage ? 'text-white/80' : 'text-gray-500'
//                 }`}>
//                   {formatVoiceDuration(message.duration || message.recording_duration || 0)}
//                 </span>
//               </div>

//               {/* Custom Audio Player */}
//               <div className={`flex items-center gap-2 p-2 rounded-lg ${
//                 isOwnMessage ? 'bg-white/10' : 'bg-gray-50'
//               }`}>
//                 <audio
//                   className="hidden"
//                   id={`audio-${message.id}`}
//                   src={message.file_url}
//                   onPlay={() => setIsPlaying(true)}
//                   onPause={() => setIsPlaying(false)}
//                   onEnded={() => {
//                     setIsPlaying(false);
//                     onAudioEnd && onAudioEnd(message.id);
//                   }}
//                   preload="metadata"
//                 />

//                 <button
//                   onClick={handlePlayPause}
//                   className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
//                     isOwnMessage
//                       ? 'bg-white text-blue-500 hover:bg-white/90'
//                       : 'bg-blue-500 text-white hover:bg-blue-600'
//                   }`}
//                 >
//                   {isPlaying ? (
//                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
//                       <rect x="6" y="4" width="4" height="16" rx="1"/>
//                       <rect x="14" y="4" width="4" height="16" rx="1"/>
//                     </svg>
//                   ) : (
//                     <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
//                       <path d="M8 5v14l11-7z"/>
//                     </svg>
//                   )}
//                 </button>

//                 {/* Waveform Visualization */}
//                 <div className="flex-1 flex items-center gap-0.5 h-8">
//                   {[...Array(30)].map((_, i) => (
//                     <div
//                       key={i}
//                       className={`flex-1 rounded-full transition-all ${
//                         isOwnMessage ? 'bg-white/40' : 'bg-gray-300'
//                       }`}
//                       style={{
//                         height: `${Math.random() * 60 + 20}%`,
//                         opacity: isPlaying && i % 3 === 0 ? 1 : 0.6
//                       }}
//                     />
//                   ))}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Transcription Controls */}
//         <div className={`px-4 pb-3 ${
//           isOwnMessage ? 'bg-white/5' : 'bg-gray-50'
//         }`}>
//           <div className="flex items-center justify-between gap-2">
//             <button
//               onClick={toggleTranscription}
//               disabled={loading}
//               className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-all ${
//                 isOwnMessage
//                   ? 'bg-white/10 text-white hover:bg-white/20'
//                   : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
//               } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
//             >
//               {loading ? (
//                 <>
//                   <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
//                   <span>Processing...</span>
//                 </>
//               ) : (
//                 <>
//                   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
//                   </svg>
//                   <span>{showTranscription ? 'Hide' : 'Show'} Caption</span>
//                 </>
//               )}
//             </button>

//             {transcription && (
//               <select
//                 value={targetLanguage}
//                 onChange={(e) => handleTranslate(e.target.value)}
//                 disabled={loading}
//                 className={`text-xs font-medium px-3 py-2 rounded-lg border transition-all cursor-pointer ${
//                   isOwnMessage
//                     ? 'bg-white/10 text-white border-white/20 hover:bg-white/20'
//                     : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
//                 }`}
//               >
//                 {languages.map(lang => (
//                   <option key={lang.code} value={lang.code} className="text-gray-900">
//                     {lang.name}
//                   </option>
//                 ))}
//               </select>
//             )}
//           </div>

//           {/* Caption Available Indicator */}
//           {message.transcription_data && !showTranscription && !loading && (
//             <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
//               isOwnMessage ? 'text-white/70' : 'text-green-600'
//             }`}>
//               <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
//               </svg>
//               Caption available
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Error Message */}
//       {error && (
//         <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
//           <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
//             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
//           </svg>
//           <span className="text-xs text-red-700">{error}</span>
//         </div>
//       )}

//       {/* Transcription Display */}
//       {showTranscription && transcription && (
//         <div className={`mt-2 rounded-xl overflow-hidden border ${
//           isOwnMessage ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
//         }`}>
//           <div className="p-4 space-y-3">
//             {/* Original Transcription */}
//             <div>
//               <div className="flex items-center gap-2 mb-2">
//                 <svg className={`w-4 h-4 ${isOwnMessage ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
//                 </svg>
//                 <span className={`text-xs font-semibold uppercase tracking-wide ${
//                   isOwnMessage ? 'text-blue-700' : 'text-gray-600'
//                 }`}>
//                   Original
//                 </span>
//               </div>
//               <p className={`text-sm leading-relaxed ${
//                 isOwnMessage ? 'text-blue-900' : 'text-gray-800'
//               }`}>
//                 {transcription.transcription}
//               </p>
//             </div>

//             {/* Translation */}
//             {transcription.hasTranslation && transcription.translatedText && (
//               <>
//                 <div className={`border-t ${isOwnMessage ? 'border-blue-200' : 'border-gray-200'}`} />
//                 <div>
//                   <div className="flex items-center gap-2 mb-2">
//                     <svg className={`w-4 h-4 ${isOwnMessage ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
//                     </svg>
//                     <span className={`text-xs font-semibold uppercase tracking-wide ${
//                       isOwnMessage ? 'text-blue-700' : 'text-gray-600'
//                     }`}>
//                       Translation
//                     </span>
//                     <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
//                       isOwnMessage ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'
//                     }`}>
//                       {languages.find(lang => lang.code === transcription.language)?.name}
//                     </span>
//                   </div>
//                   <p className={`text-sm leading-relaxed ${
//                     isOwnMessage ? 'text-blue-900' : 'text-gray-800'
//                   }`}>
//                     {transcription.translatedText}
//                   </p>
//                 </div>
//               </>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

import { useState, useEffect } from "react";
import { chatAPI, groupAPI } from "../../lib/api";

export default function VoiceMessageWithTranscription({
  message,
  isOwnMessage,
  onAudioPlay,
  onAudioPause,
  onAudioEnd,
  formatVoiceDuration,
  chatType = "private",
}) {
  const [showTranscription, setShowTranscription] = useState(false);
  const [transcription, setTranscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);

  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "zh", name: "Chinese" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
  ];

  // Initialize transcription from message data
  useEffect(() => {
    if (message.transcription_data) {
      try {
        // Check if transcription_data is a string that needs parsing
        const transcriptionData =
          typeof message.transcription_data === "string"
            ? JSON.parse(message.transcription_data)
            : message.transcription_data;

        setTranscription({
          transcription:
            transcriptionData.transcription || transcriptionData.text || "",
          translatedText:
            transcriptionData.translatedText ||
            transcriptionData.translation ||
            null,
          language: transcriptionData.language || "en",
          hasTranslation:
            !!transcriptionData.translatedText ||
            !!transcriptionData.translation,
        });

        // Auto-show transcription if it exists
        // if (transcriptionData.transcription) {
        //   setShowTranscription(true);
        // }
      } catch (err) {
        console.error("Error parsing transcription data:", err);
        // Set default transcription if parsing fails
        if (typeof message.transcription_data === "string") {
          setTranscription({
            transcription: message.transcription_data,
            translatedText: null,
            language: "en",
            hasTranslation: false,
          });
        }
      }
    }
  }, [message]);

  useEffect(() => {
    const audio = document.getElementById(`audio-${message._id}`);
    if (audio) {
      setAudioElement(audio);
    }
  }, [message._id]);

  const handleTranscribe = async (language = "original") => {
    setLoading(true);
    setError(null);

    try {
      const api = chatType === "group" ? groupAPI : chatAPI;
      const response = await api.transcribeVoiceMessage(message._id, {
        targetLanguage: language === "original" ? "en" : language,
        skipTranslation: language === "original",
      });

      if (response.data.success) {
        setTranscription({
          transcription:
            response.data.transcription || response.data.text || "",
          translatedText:
            language === "original"
              ? null
              : response.data.translatedText || response.data.translation,
          language:
            language === "original" ? "en" : response.data.language || language,
          hasTranslation:
            language !== "original" &&
            (!!response.data.translatedText || !!response.data.translation),
        });
        setShowTranscription(true);
      } else {
        setError("Transcription failed");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      setError("Failed to transcribe voice message");
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async (newLanguage) => {
    setTargetLanguage(newLanguage);
    await handleTranscribe(newLanguage);
  };

  const toggleTranscription = async () => {
    if (!showTranscription) {
      // Show transcription if it exists
      if (transcription?.transcription) {
        setShowTranscription(true);
      } else if (!loading) {
        // Otherwise fetch it
        await handleTranscribe("original");
      }
    } else {
      // Hide transcription
      setShowTranscription(false);
    }
  };

  const handlePlayPause = () => {
    if (audioElement) {
      if (audioElement.paused) {
        audioElement.play();
        setIsPlaying(true);
        onAudioPlay && onAudioPlay(message._id);
      } else {
        audioElement.pause();
        setIsPlaying(false);
        onAudioPause && onAudioPause(message._id);
      }
    }
  };

  return (
    <div className={`max-w-md ${isOwnMessage ? "ml-auto" : "mr-auto"}`}>
      {/* Main Voice Message Card */}
      <div
        className={`rounded-2xl shadow-sm overflow-hidden ${
          isOwnMessage
            ? "bg-gradient-to-br from-blue-500 to-blue-600"
            : "bg-white border border-gray-200"
        }`}
      >
        {/* Voice Player Section */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            {/* Waveform Icon */}
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                isOwnMessage ? "bg-white/20" : "bg-blue-50"
              }`}
            >
              <svg
                className={`w-6 h-6 ${isOwnMessage ? "text-white" : "text-blue-500"}`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 3v18M8 6v12M16 6v12M4 9v6M20 9v6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Voice Info */}
            <div className="flex-1 min-w-0">
              <div
                className={`flex items-center justify-between mb-1 ${
                  isOwnMessage ? "text-white" : "text-gray-900"
                }`}
              >
                <span className="font-semibold text-sm">Voice Message</span>
                <span
                  className={`text-xs font-medium ${
                    isOwnMessage ? "text-white/80" : "text-gray-500"
                  }`}
                >
                  {formatVoiceDuration(
                    message.duration || message.recording_duration || 0,
                  )}
                </span>
              </div>

              {/* Custom Audio Player */}
              <div
                className={`flex items-center gap-2 p-2 rounded-lg ${
                  isOwnMessage ? "bg-white/10" : "bg-gray-50"
                }`}
              >
                <audio
                  className="hidden"
                  id={`audio-${message._id}`}
                  src={message.file_url}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    setIsPlaying(false);
                    onAudioEnd && onAudioEnd(message._id);
                  }}
                  preload="metadata"
                />

                <button
                  onClick={handlePlayPause}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isOwnMessage
                      ? "bg-white text-blue-500 hover:bg-white/90"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  {isPlaying ? (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 ml-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Waveform Visualization */}
                <div className="flex-1 flex items-center gap-0.5 h-8">
                  {[...Array(30)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-all ${
                        isOwnMessage ? "bg-white/40" : "bg-gray-300"
                      }`}
                      style={{
                        height: `${Math.random() * 60 + 20}%`,
                        opacity: isPlaying && i % 3 === 0 ? 1 : 0.6,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transcription Controls */}
        <div
          className={`px-4 pb-3 ${isOwnMessage ? "bg-white/5" : "bg-gray-50"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={toggleTranscription}
              disabled={loading}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-all ${
                isOwnMessage
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  <span>{showTranscription ? "Hide" : "Show"} Caption</span>
                </>
              )}
            </button>

            {transcription && showTranscription && (
              <select
                value={targetLanguage}
                onChange={(e) => handleTranslate(e.target.value)}
                disabled={loading}
                className={`text-xs font-medium px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                  isOwnMessage
                    ? "bg-white/10 text-white border-white/20 hover:bg-white/20"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <option value="original" className="text-gray-900">
                  Original
                </option>
                {languages.map((lang) => (
                  <option
                    key={lang.code}
                    value={lang.code}
                    className="text-gray-900"
                  >
                    {lang.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Caption Available Indicator */}
          {transcription?.transcription && !showTranscription && !loading && (
            <div
              className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                isOwnMessage ? "text-white/70" : "text-green-600"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Caption available
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <svg
            className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}

      {/* Transcription Display */}
      {showTranscription && transcription?.transcription && (
        <div
          className={`mt-2 rounded-xl overflow-hidden border ${
            isOwnMessage
              ? "border-blue-200 bg-blue-50"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="p-4 space-y-3">
            {/* Original Transcription */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className={`w-4 h-4 ${isOwnMessage ? "text-blue-600" : "text-gray-600"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isOwnMessage ? "text-blue-700" : "text-gray-600"
                  }`}
                >
                  Original
                </span>
                <span
                  className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                    isOwnMessage
                      ? "bg-blue-200 text-blue-800"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {languages.find(
                    (lang) => lang.code === transcription.language,
                  )?.name || "Unknown"}
                </span>
              </div>
              <p
                className={`text-sm leading-relaxed ${
                  isOwnMessage ? "text-blue-900" : "text-gray-800"
                }`}
              >
                {transcription.transcription}
              </p>
            </div>

            {/* Translation */}
            {transcription.hasTranslation && transcription.translatedText && (
              <>
                <div
                  className={`border-t ${isOwnMessage ? "border-blue-200" : "border-gray-200"}`}
                />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className={`w-4 h-4 ${isOwnMessage ? "text-blue-600" : "text-gray-600"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                      />
                    </svg>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        isOwnMessage ? "text-blue-700" : "text-gray-600"
                      }`}
                    >
                      Translation
                    </span>
                    <span
                      className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                        isOwnMessage
                          ? "bg-blue-200 text-blue-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {languages.find((lang) => lang.code === targetLanguage)
                        ?.name || targetLanguage.toUpperCase()}
                    </span>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      isOwnMessage ? "text-blue-900" : "text-gray-800"
                    }`}
                  >
                    {transcription.translatedText}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
