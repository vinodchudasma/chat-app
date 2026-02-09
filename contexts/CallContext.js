'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CallContext = createContext();

export function CallProvider({ children }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeTabId, setActiveTabId] = useState(null);
  const [ringtoneAudio, setRingtoneAudio] = useState(null);

  // Use BroadcastChannel for cross-tab communication
  useEffect(() => {
    const broadcastChannel = new BroadcastChannel('call_notifications');
    
    const handleMessage = (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'INCOMING_CALL':
          // Only show notification if we're not the active tab
          if (data.tabId !== activeTabId) {
            setIncomingCall(data.callData);
            playRingtone();
          }
          break;
          
        case 'CALL_ACCEPTED':
          if (data.callId === incomingCall?.callId) {
            stopRingtone();
            setIncomingCall(null);
          }
          break;
          
        case 'CALL_REJECTED':
          if (data.callId === incomingCall?.callId) {
            stopRingtone();
            setIncomingCall(null);
          }
          break;
          
        case 'TAB_FOCUS':
          setActiveTabId(data.tabId);
          break;
      }
    };
    
    broadcastChannel.addEventListener('message', handleMessage);
    
    // Generate unique tab ID
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setActiveTabId(tabId);
    
    // Notify other tabs we're active
    broadcastChannel.postMessage({
      type: 'TAB_FOCUS',
      data: { tabId }
    });
    
    // Track tab visibility
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        broadcastChannel.postMessage({
          type: 'TAB_FOCUS',
          data: { tabId }
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      broadcastChannel.removeEventListener('message', handleMessage);
      broadcastChannel.close();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopRingtone();
    };
  }, [activeTabId, incomingCall]);

  const playRingtone = useCallback(() => {
    if (ringtoneAudio) {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
    }
    
    try {
      const audio = new Audio('/sounds/ringtone.mp3');
      audio.loop = true;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Auto-play prevented:', error);
          // Fallback to system notification
        });
      }
      
      setRingtoneAudio(audio);
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  }, [ringtoneAudio]);

  const stopRingtone = useCallback(() => {
    if (ringtoneAudio) {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
      setRingtoneAudio(null);
    }
  }, [ringtoneAudio]);

  const showIncomingCall = useCallback((callData) => {
    const broadcastChannel = new BroadcastChannel('call_notifications');
    
    broadcastChannel.postMessage({
      type: 'INCOMING_CALL',
      data: {
        callData,
        tabId: activeTabId,
        timestamp: Date.now()
      }
    });
    
    // Also show locally if we're not the active tab
    if (document.hidden) {
      setIncomingCall(callData);
      playRingtone();
    }
  }, [activeTabId, playRingtone]);

  const acceptCall = useCallback(async (callData) => {
    const broadcastChannel = new BroadcastChannel('call_notifications');
    
    broadcastChannel.postMessage({
      type: 'CALL_ACCEPTED',
      data: {
        callId: callData.callId,
        timestamp: Date.now()
      }
    });
    
    stopRingtone();
    setIncomingCall(null);
    
    // Focus existing tab or open new one
    const chatUrl = callData.chatType === 'group' 
      ? `/chat/group/${callData.groupId}?call=${callData.callId}`
      : `/chat/private/${callData.chatId}?call=${callData.callId}`;
    
    await focusOrOpenTab(chatUrl);
  }, [stopRingtone]);

  const rejectCall = useCallback((callData) => {
    const broadcastChannel = new BroadcastChannel('call_notifications');
    
    broadcastChannel.postMessage({
      type: 'CALL_REJECTED',
      data: {
        callId: callData.callId,
        timestamp: Date.now()
      }
    });
    
    stopRingtone();
    setIncomingCall(null);
  }, [stopRingtone]);

  const focusOrOpenTab = async (url) => {
    // Try to find existing tab with your chat app
    const tabs = await getWindowTabs();
    
    // Look for tab with your app's URL pattern
    const existingTab = tabs.find(tab => 
      tab.url && tab.url.includes(window.location.origin)
    );
    
    if (existingTab) {
      // Focus the existing tab
      if (existingTab.focus) {
        existingTab.focus();
      }
      // Navigate to the call URL
      window.location.href = url;
    } else {
      // Open new tab/window
      window.open(url, '_blank');
    }
  };

  const getWindowTabs = () => {
    return new Promise((resolve) => {
      try {
        // Try Chrome extension API first
        if (chrome && chrome.tabs) {
          chrome.tabs.query({}, (tabs) => {
            resolve(tabs || []);
          });
        } else {
          resolve([]);
        }
      } catch (error) {
        // Fallback to simple window focus
        resolve([]);
      }
    });
  };

  return (
    <CallContext.Provider value={{
      incomingCall,
      showIncomingCall,
      acceptCall,
      rejectCall,
      playRingtone,
      stopRingtone
    }}>
      {children}
      {incomingCall && <CallNotificationManager call={incomingCall} />}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);