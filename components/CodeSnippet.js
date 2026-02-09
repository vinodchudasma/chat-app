// import { useState } from 'react';

// const CodeSnippet = ({ codeData, successToast }) => {
//   const [isExpanded, setIsExpanded] = useState(false);
//   const isLongCode = codeData.content.length > 500;

//   return (
//     <div className="code-snippet-message mb-4">
//       <div className="code-header flex items-center justify-between bg-gray-800 text-white px-3 py-2 rounded-t-lg">
//         <span className="text-sm font-medium">
//           {codeData.language || 'code'}
//         </span>
//         <div className="flex items-center space-x-2">
//           {/* Download Button */}
//           <button
//             onClick={() => {
//               const blob = new Blob([codeData.content], { type: 'text/plain' });
//               const url = URL.createObjectURL(blob);
//               const a = document.createElement('a');
//               a.href = url;
//               a.download = `code-snippet.${codeData.language || 'txt'}`;
//               document.body.appendChild(a);
//               a.click();
//               document.body.removeChild(a);
//               URL.revokeObjectURL(url);
//               successToast('Code downloaded', 'success');
//             }}
//             className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer"
//           >
//             Download
//           </button>
          
//           {/* Expand/Collapse Button for long code */}
//           {isLongCode && (
//             <button
//               onClick={() => setIsExpanded(!isExpanded)}
//               className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer"
//             >
//               {isExpanded ? 'Collapse' : 'Expand'}
//             </button>
//           )}
          
//           {/* Copy Button */}
//           <button
//             onClick={() => {
//               navigator.clipboard.writeText(codeData.content);
//               successToast('Code copied to clipboard', 'success');
//             }}
//             className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer"
//           >
//             Copy
//           </button>
//         </div>
//       </div>
      
//       <div className={`bg-gray-900 text-gray-100 rounded-b-lg overflow-hidden ${
//         isLongCode && !isExpanded ? 'max-h-64' : ''
//       }`}>
//         <pre className={`p-3 overflow-x-auto text-sm ${
//           isLongCode && !isExpanded ? 'overflow-y-auto max-h-60' : ''
//         }`}>
//           <code>{codeData.content}</code>
//         </pre>
        
//         {/* Show more indicator for collapsed long code */}
//         {isLongCode && !isExpanded && (
//           <div className="bg-gray-800 text-center py-2 border-t border-gray-700">
//             <button
//               onClick={() => setIsExpanded(true)}
//               className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
//             >
//               ↓ Show full code ({codeData.content.length} characters)
//             </button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default CodeSnippet;


import { useState } from 'react';

const CodeSnippet = ({ codeData, successToast }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLongCode = codeData.content.length > 500;
  const lineCount = codeData.content.split('\n').length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeData.content);
      setCopied(true);
      successToast?.('Code copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([codeData.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-snippet.${codeData.language || 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    successToast?.('Code downloaded', 'success');
  };

  // Language icon mapping
  const getLanguageIcon = (lang) => {
    const icons = {
      javascript: '{ }',
      python: '🐍',
      java: '☕',
      cpp: 'C++',
      html: '</>',
      css: '🎨',
      react: '⚛️',
      typescript: 'TS'
    };
    return icons[lang?.toLowerCase()] || '📄';
  };

  return (
    <div className="code-snippet-container max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-t-xl border border-gray-700 border-b-0">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Language Info */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getLanguageIcon(codeData.language)}</span>
            <div>
              <div className="text-sm font-semibold text-white">
                {codeData.language || 'Plain Text'}
              </div>
              <div className="text-xs text-gray-400">
                {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {codeData.content.length} characters
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
              title="Download code"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Expand/Collapse Button */}
            {isLongCode && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isExpanded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
                <span className="hidden sm:inline">{isExpanded ? 'Collapse' : 'Expand'}</span>
              </button>
            )}

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:scale-105 active:scale-95 ${
                copied
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Code Content */}
      <div className="relative bg-gray-950 border border-gray-700 rounded-b-xl overflow-hidden">
        <div
          className={`relative ${
            isLongCode && !isExpanded ? 'max-h-96' : 'max-h-[600px]'
          } overflow-hidden`}
        >
          <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
            <code className="text-gray-100 font-mono">
              {codeData.content.split('\n').map((line, index) => (
                <div key={index} className="table-row">
                  <span className="table-cell pr-4 text-right select-none text-gray-500 text-xs">
                    {index + 1}
                  </span>
                  <span className="table-cell text-gray-100">{line || '\n'}</span>
                </div>
              ))}
            </code>
          </pre>

          {/* Gradient Fade for collapsed view */}
          {isLongCode && !isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />
          )}
        </div>

        {/* Expand Footer */}
        {isLongCode && !isExpanded && (
          <div className="border-t border-gray-700 bg-gray-900">
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full py-3 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Show complete code ({lineCount} lines)
            </button>
          </div>
        )}

        {/* Collapse Footer */}
        {isLongCode && isExpanded && (
          <div className="border-t border-gray-700 bg-gray-900">
            <button
              onClick={() => setIsExpanded(false)}
              className="w-full py-3 text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Collapse code
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


 export default CodeSnippet;