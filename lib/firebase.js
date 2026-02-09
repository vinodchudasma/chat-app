import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app;
let messaging = null;

// Safe initialization
const initializeFirebase = async () => {
  if (typeof window === 'undefined') {
    console.log('🌐 Firebase: Running on server, skipping initialization');
    return { app: null, messaging: null };
  }

  try {
    // Initialize Firebase App
    app = initializeApp(firebaseConfig);
    console.log(' Firebase App initialized');

    // Check if messaging is supported (this returns a Promise)
    const messagingSupported = await isSupported();

    if (messagingSupported) {
      messaging = getMessaging(app);
      console.log(' Firebase Messaging initialized');
    } else {
      console.warn('⚠️ Firebase Messaging not supported in this browser');
    }

    return { app, messaging };
  } catch (error) {
    console.error(' Firebase initialization error:', error);
    return { app: null, messaging: null };
  }
};

// Initialize immediately and export promise
const firebasePromise = initializeFirebase();

// Request permission and get token
export const requestForToken = async () => {
  // Wait for initialization to complete
  const { messaging: initializedMessaging } = await firebasePromise;

  if (!initializedMessaging) {
    console.log('Firebase Messaging is not supported or not initialized');
    return null;
  }

  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return null;
    }

    // Request notification permission
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      const currentToken = await getToken(initializedMessaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      });

      if (currentToken) {
        console.log('Current FCM token:', currentToken);
        return currentToken;
      } else {
        console.log('No registration token available.');
        return null;
      }
    } else {
      console.log('Notification permission not granted');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token:', err);
    return null;
  }
};

// Handle foreground messages
export const onMessageListener = () => {
  return new Promise(async (resolve) => {
    const { messaging: initializedMessaging } = await firebasePromise;

    if (!initializedMessaging) {
      resolve(null);
      return;
    }

    onMessage(initializedMessaging, (payload) => {
      console.log('Received foreground message:', payload);
      resolve(payload);
    });
  });
};

// Unregister service worker and token
export const unregisterServiceWorker = async () => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.unregister();
        console.log('Service Worker unregistered');
      }
    } catch (error) {
      console.error('Error unregistering service worker:', error);
    }
  }
};

// Export with safe access
export const getFirebaseMessaging = () => messaging;
export { app };