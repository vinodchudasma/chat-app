// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyC9oGzMhKUIZtxv81nZCiAMTe5_2PZbmwY",
  authDomain:  "chatapp-3f1d9.firebaseapp.com",
  projectId: "chatapp-3f1d9",
  storageBucket: "chatapp-3f1d9.firebasestorage.app",
  messagingSenderId: "40644436013",
  appId: "1:40644436013:web:b2b428a7a859130fac58a4",
};

firebase.initializeApp(firebaseConfig);

// Retrieve firebase messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('📨 Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationBody = payload.notification?.body || 'You have a new message';
  
  // Extract data for navigation
  const data = payload.data || {};
  console.log("data", data);
  
  const chatId = data.chat_id;
  const chatType = data.chat_type || 'private';
  const senderName = data.sender_name || 'User';
  const messageType = data.message_type || 'text';

  // Customize notification based on message type
  let icon = '/icon-192x192.png';
  let badge = '/badge-72x72.png';
  
  if (messageType === 'image') {
    icon = '/icon-image-192x192.png'; // You can create this
  } else if (messageType === 'file') {
    icon = '/icon-file-192x192.png'; // You can create this
  }

  const notificationOptions = {
    body: notificationBody,
    icon: icon,
    badge: badge,
    image: data.image_url, // For image preview if available
    data: {
      ...data,
      chat_id: chatId,
      chat_type: chatType,
      sender_name: senderName,
      timestamp: Date.now()
    },
    tag: `chat-${chatId}`, // Group notifications by chat
    requireInteraction: true, // Stay until user interacts
    actions: [
      {
        action: 'open',
        title: 'Open Chat',
        icon: '/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-192x192.png'
      }
    ],
    vibrate: [200, 100, 200], // Vibration pattern
    silent: false
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.data);
  
  event.notification.close();

  const data = event.notification.data;
  const chatId = data.chat_id;
  const chatType = data.chat_type || 'private';
  
  // Determine which action was clicked
  const action = event.action;

  if (action === 'dismiss') {
    // Just close the notification
    return;
  }

  // Default action: open the chat
  let url = '/';
  if (chatId) {
    if (chatType === 'private') {
      url = `/chat/private/${chatId}`;
    } else {
      url = `/chat/group/${chatId}`;
    }
  }

  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if there's already a window open with the chat
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          client.focus();
          // Send message to the client to refresh or navigate
          client.postMessage({
            type: 'NAVIGATE_TO_CHAT',
            chat_id: chatId,
            chat_type: chatType
          });
          return;
        }
      }
      
      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('🔔 Notification closed:', event.notification.data);
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('🔄 Push subscription changed');
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'
    }).then((subscription) => {
      console.log(' Renewed subscription:', subscription);
      // Send new subscription to your server
      return fetch('/api/push/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });
    })
  );
});