'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

export default function NotificationSettings() {
  const { userId } = useAuth();
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    checkNotificationSupport();
  }, []);

  const checkNotificationSupport = () => {
    if (!('Notification' in window)) {
      setIsSupported(false);
      return;
    }
    
    setPermission(Notification.permission);
    setIsSupported(true);
  };

  const requestPermission = async () => {
    if (!isSupported) return;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        // Re-initialize notifications
        if (window.requestNotificationPermission) {
          await window.requestNotificationPermission();
        }
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const openBrowserSettings = () => {
    // This can't directly open notification settings, but we can guide users
    alert('To enable notifications:\n\nChrome: Settings → Privacy and Security → Site Settings → Notifications\nFirefox: Options → Privacy & Security → Permissions → Notifications\nSafari: Preferences → Websites → Notifications');
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">Notifications Not Supported</h3>
        <p className="text-yellow-700">Your browser does not support web notifications.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Browser Notifications</h4>
            <p className="text-sm text-gray-600">
              {permission === 'granted' ? 'Enabled' : 
               permission === 'denied' ? 'Blocked' : 'Not set'}
            </p>
          </div>
          
          {permission === 'default' && (
            <button
              onClick={requestPermission}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors cursor-pointer"
            >
              Enable Notifications
            </button>
          )}
          
          {permission === 'denied' && (
            <button
              onClick={openBrowserSettings}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Enable in Browser
            </button>
          )}
          
          {permission === 'granted' && (
            <span className="text-green-600 font-medium"> Enabled</span>
          )}
        </div>

        {permission === 'denied' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">
              Notifications are blocked. Please enable them in your browser settings to receive message alerts.
            </p>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-2">Notification Types</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>New Messages</span>
              <span className="text-green-600">✓ Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Group Invitations</span>
              <span className="text-green-600">✓ Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Friend Requests</span>
              <span className="text-green-600">✓ Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}