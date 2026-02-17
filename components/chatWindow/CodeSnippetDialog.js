import { X, Code2, Send } from "lucide-react";

export default function CodeSnippetDialog({
  showCodeSnippetMenu,
  codeSnippet,
  snippetLanguage,
  sending,
  onSetShowCodeSnippetMenu,
  onSetCodeSnippet,
  onSetSnippetLanguage,
  onSendCodeSnippet,
}) {
  if (!showCodeSnippetMenu) return null;

  // Safe validation
  const isCodeValid =
    codeSnippet &&
    typeof codeSnippet === "string" &&
    codeSnippet.trim().length > 0;

  const handleSend = () => {
    onSendCodeSnippet();
  };

  const handleCancel = () => {
    onSetShowCodeSnippetMenu(false);
    onSetCodeSnippet("");
    onSetSnippetLanguage("javascript");
  };

  return (
    <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl transform transition-all animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Code2 className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Send Code Snippet
            </h3>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Language Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Programming Language
            </label>
            <div className="relative">
              <select
                value={snippetLanguage || "javascript"}
                onChange={(e) => onSetSnippetLanguage(e.target.value)}
                className="w-full p-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 cursor-pointer appearance-none transition-all"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="php">PHP</option>
                <option value="sql">SQL</option>
                <option value="bash">Bash</option>
                <option value="json">JSON</option>
                <option value="typescript">TypeScript</option>
                <option value="rust">Rust</option>
                <option value="go">Go</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Code Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code <span className="text-gray-400">(required)</span>
            </label>
            <div className="relative">
              <textarea
                value={codeSnippet || ""}
                onChange={(e) => onSetCodeSnippet(e.target.value)}
                placeholder="// Paste your code here...
function example() {
  return 'Hello World';
}"
                className="w-full h-80 p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none bg-gray-50 text-gray-900 placeholder:text-gray-400 transition-all"
                spellCheck={false}
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-2 py-1 rounded">
                {codeSnippet?.length || 0} characters
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 bg-gray-50 rounded-b-2xl border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {!isCodeValid && <span>⚠️ Please enter some code to send</span>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 rounded-xl transition-all cursor-pointer border border-gray-300 shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!isCodeValid || sending}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Code
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
