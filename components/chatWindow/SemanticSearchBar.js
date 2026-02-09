'use client';

import { useState, useEffect } from 'react';
import SearchOptimizer from './SearchOptimizer';

export default function SemanticSearchBar({
  showSearch,
  searchQuery,
  searchResults,
  currentSearchIndex,
  onSearch,
  onClearSearch,
  onNextResult,
  onPrevResult,
  onSemanticSearch,
  searchMode,
  onSearchModeChange,
  isSearching,
  chat,
  setIsSearchingMode,
  onSearchComplete,
  chatAPI,
  groupAPI,
  currentUserId,
  isSearchingMode
}) {
  if (!showSearch) return null;

  return (
    <>
      {/* Search Optimizer Component - Only show when in search mode with query */}
      {isSearchingMode && searchQuery.trim() && chat && (
        <SearchOptimizer
          chat={chat}
          searchQuery={searchQuery}
          onSearchComplete={onSearchComplete}
          isSearchingMode={isSearchingMode}
          setIsSearchingMode={setIsSearchingMode}
          chatAPI={chatAPI}
          groupAPI={groupAPI}
          currentUserId={currentUserId}
        />
      )}

      <div className="search-container absolute top-16 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg z-40 w-96">
        <div className="p-4">
          {/* Search Mode Toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Search Mode:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => onSearchModeChange('text')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors cursor-pointer ${
                    searchMode === 'text' 
                      ? 'bg-white shadow-sm text-blue-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={() => onSearchModeChange('semantic')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors cursor-pointer ${
                    searchMode === 'semantic' 
                      ? 'bg-white shadow-sm text-blue-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Semantic
                </button>
              </div>
            </div>
            
            <button
              onClick={() => {
                onClearSearch();
                
                if (isSearchingMode) {
                  setIsSearchingMode(false);
                }
              }}
              className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mb-3">
            <input
              type="text"
              placeholder={
                searchMode === 'semantic' 
                  ? "Search using natural language..." 
                  : "Search messages..."
              }
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && searchMode === 'semantic') {
                  onSemanticSearch(searchQuery);
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Search Results Info */}
          {searchResults.length > 0 && (
            <div className="flex items-center justify-between text-sm mb-3 p-2 bg-blue-50 rounded">
              <span className="text-blue-700 font-medium">
                {searchResults.length} results
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onPrevResult}
                  className="p-1 rounded hover:bg-blue-100 cursor-pointer"
                  title="Previous result"
                >
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={onNextResult}
                  className="p-1 rounded hover:bg-blue-100 cursor-pointer"
                  title="Next result"
                >
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Semantic Search Button - Only for semantic mode */}
          {searchMode === 'semantic' && searchQuery && !isSearching && (
            <button
              onClick={() => onSemanticSearch(searchQuery)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center cursor-pointer"
            >
              AI Search
            </button>
          )}
        </div>
      </div>
    </>
  );
}