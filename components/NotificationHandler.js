'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { requestForToken, onMessageListener } from '../lib/firebase';
import { userAPI } from '../lib/api';

export default function NotificationHandler() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const notificationPermissionRef = useRef(null);

  useEffect(() => {
    if (isLoaded && userId) {
      initializeNotifications();
      setupMessageListener();
    }
  }, [isLoaded, userId]);

  const initializeNotifications = async () => {
    try {


      if (!('Notification' in window)) {

        return;
      }

      if (!('serviceWorker' in navigator)) {

        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      } catch (error) {
        console.error(' Service Worker registration failed:', error);
        return;
      }

      const permission = await Notification.requestPermission();
      notificationPermissionRef.current = permission;



      if (permission === 'granted') {

        const token = await requestForToken();

        if (token) {

          await userAPI.updateFCMToken(token);

        }
      }
    } catch (error) {
      console.error(' Error initializing notifications:', error);
    }
  };

  const setupMessageListener = () => {
    onMessageListener()
      .then((payload) => {
        if (payload) {


          //  NEW: Handle call notifications differently
          const data = payload.data || {};

          if (data.type === 'call' || data.type === 'group_call' ||
            data.action === 'incoming_call' || data.action === 'incoming_group_call') {
            // Show custom call UI instead of browser notification
            showCallNotification(payload);
          } else {
            // Regular message notification
            showForegroundNotification(payload);
          }
        }
      })
      .catch((error) => {
        console.error(' Error in message listener:', error);
      });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {


        if (event.data && event.data.type === 'NAVIGATE_TO_CHAT') {
          handleNavigation(event.data);
        }
      });
    }
  };

  const showCallNotification = (payload) => {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};



    const callData = {
      callId: data.callId,
      callerId: data.callerId,
      callerName: data.callerName,
      callerImage: data.callerImage || null,
      type: data.callType || data.type,
      chatType: data.type === 'group_call' ? 'group' : 'private',
      groupName: data.groupName,
      groupId: data.groupId,
      chatId: data.chatId,
      targetUserId: data.targetUserId,
      timestamp: new Date().toISOString()
    };

    // Dispatch event
    const event = new CustomEvent('incoming-call', { detail: callData });
    window.dispatchEvent(event);

    // Also show browser notification for background tabs
    if (document.hidden) {
      showForegroundNotification(payload);
    }
  };

  // Helper function to play ringtone
  const playRingtone = () => {
    try {
      const audio = new Audio('/ringtone.mp3');
      audio.loop = true;
      audio.play().catch(err => console.log('Ringtone play error:', err));

      // Store audio reference globally to stop it later
      window.currentRingtone = audio;
    } catch (error) {
      console.log('Could not play ringtone:', error);
    }
  };

  const showForegroundNotification = (payload) => {
    if (!payload) {
      console.log(' No payload provided for notification');
      return;
    }

    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    if (!title || !body) {
      console.log(' Invalid notification payload - missing title or body:', payload);
      return;
    }

    if (Notification.permission !== 'granted') {
      console.log(' Notification permission not granted');
      return;
    }

    const chatId = data.chat_id;
    const chatType = data.chat_type || 'private';
    const messageType = data.custom_message_type || data.message_type || 'text';

    let icon = '/icon-192x192.png';
    if (messageType === 'image') {
      icon = '/icon-image-192x192.png';
    } else if (messageType === 'file') {
      icon = '/icon-file-192x192.png';
    }

    const notificationOptions = {
      body: body,
      icon: icon,
      badge: '/badge-72x72.png',
      image: data.image_url,
      data: {
        ...data,
        chat_id: chatId,
        chat_type: chatType,
        timestamp: Date.now()
      },
      tag: `chat-${chatId}`,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      silent: false
    };

    try {
      const notification = new Notification(title, notificationOptions);

      notification.onclick = (event) => {
        event.preventDefault();
        notification.close();
        handleNotificationClick(data);
      };

      setTimeout(() => {
        if (notification.close) {
          notification.close();
        }
      }, 7000);

      const handleVisibilityChange = () => {
        if (!document.hidden && chatId) {
          const currentPath = window.location.pathname;
          if (currentPath.includes(`/chat/${chatType}/${chatId}`)) {
            notification.close();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      notification.onclose = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };

    } catch (error) {
      console.error(' Error creating notification:', error);

      if (data.type === 'important') {
        alert(`${title}: ${body}`);
      }
    }
  };

  const handleNotificationClick = (data) => {
    const chatId = data.chat_id;
    const chatType = data.chat_type || 'private';

    window.focus();

    if (chatId) {
      if (chatType === 'private') {
        router.push(`/chat/private/${chatId}`);
      } else {
        router.push(`/chat/group/${chatId}`);
      }
    } else {
      router.push('/');
    }

    if (window.socket && chatId) {
      window.socket.emit('mark_messages_read', {
        chat_id: chatId,
        user_id: userId
      });
    }
  };

  const handleNavigation = (data) => {
    const { chat_id, chat_type } = data;

    if (chat_id) {
      if (chat_type === 'private') {
        router.push(`/chat/private/${chat_id}`);
      } else {
        router.push(`/chat/group/${chat_id}`);
      }
    }
  };

  const requestPermission = async () => {
    try {
      if (window.isSecureContext === false) {
        console.error(' Notifications require HTTPS or localhost');
        return 'denied';
      }

      const permission = await Notification.requestPermission();
      notificationPermissionRef.current = permission;

      if (permission === 'granted') {
        console.log(' Notification permission granted by user');
        await initializeNotifications();
      } else {
        console.log(' Notification permission denied by user');
      }

      return permission;
    } catch (error) {
      console.error(' Error requesting notification permission:', error);
      return 'denied';
    }
  };

  const getNotificationStatus = () => {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.requestNotificationPermission = requestPermission;
      window.getNotificationStatus = getNotificationStatus;
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete window.requestNotificationPermission;
        delete window.getNotificationStatus;
      }
    };
  }, []);

  return null;
}