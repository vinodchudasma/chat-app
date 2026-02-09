// utils/tabFocus.js
export class TabFocusManager {
  constructor() {
    this.activeTabId = null;
    this.broadcastChannel = new BroadcastChannel('tab_focus');
    this.initialize();
  }

  initialize() {
    // Generate unique tab ID
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Listen for focus events
    window.addEventListener('focus', this.handleFocus);
    
    // Notify other tabs
    this.broadcastChannel.postMessage({
      type: 'TAB_ACTIVE',
      tabId: this.tabId,
      timestamp: Date.now()
    });
  }

  handleVisibilityChange = () => {
    if (!document.hidden) {
      this.broadcastChannel.postMessage({
        type: 'TAB_ACTIVE',
        tabId: this.tabId,
        timestamp: Date.now()
      });
    }
  };

  handleFocus = () => {
    this.broadcastChannel.postMessage({
      type: 'TAB_ACTIVE',
      tabId: this.tabId,
      timestamp: Date.now()
    });
  };

  // Check if we're the active tab
  isActiveTab() {
    return !document.hidden;
  }

  // Focus the app tab or open new one
  async focusOrOpenApp(url) {
    // Try to use the Window Placement API if available
    if ('getScreenDetails' in window) {
      try {
        const screens = await window.getScreenDetails();
        // Implementation for multi-screen
      } catch (error) {
        console.log('Screen Details API not available:', error);
      }
    }
    
    // Simple approach: check if we have any open windows
    if (window.opener) {
      // We were opened from another tab
      window.focus();
    } else {
      // Try to find existing window
      const existingWindow = window.open('', '_blank');
      if (existingWindow && !existingWindow.closed) {
        existingWindow.focus();
      } else {
        // Open new window
        window.open(url, '_blank');
      }
    }
  }

  cleanup() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleFocus);
    this.broadcastChannel.close();
  }
}

// Singleton instance
export const tabFocusManager = new TabFocusManager();