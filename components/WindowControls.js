'use client';

import { useEffect, useState } from 'react';

const WindowControls = () => {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(typeof window !== 'undefined' && window.electronAPI !== undefined);
  }, []);

  if (!isElectron) {
    return null; // Don't show window controls in browser
  }

  return (
    <div className="fixed top-0 right-0 z-50 flex h-8 items-center px-2">
      <div className="flex items-center space-x-1">
        <button
          onClick={() => window.electronAPI?.minimizeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-700/50"
          title="Minimize"
        >
          <span className="text-gray-300">−</span>
        </button>
        <button
          onClick={() => window.electronAPI?.maximizeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-700/50"
          title="Maximize"
        >
          <span className="text-gray-300 text-sm">□</span>
        </button>
        <button
          onClick={() => window.electronAPI?.closeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-500"
          title="Close"
        >
          <span className="text-gray-300">×</span>
        </button>
      </div>
    </div>
  );
};

export default WindowControls;