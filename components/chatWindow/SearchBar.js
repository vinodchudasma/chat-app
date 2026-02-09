export default function SearchBar({
  showSearch,
  searchQuery,
  searchResults,
  currentSearchIndex,
  onSearch,
  onClearSearch,
  onNextResult,
  onPrevResult
}) {
  if (!showSearch) return null;

  return (
    <div className="search-container absolute top-16 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg z-40 w-96">
      <div className="p-4">
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search navigation */}
        {searchResults.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {searchResults.length} results • {currentSearchIndex + 1} of {searchResults.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onPrevResult}
                disabled={searchResults.length === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={onNextResult}
                disabled={searchResults.length === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}