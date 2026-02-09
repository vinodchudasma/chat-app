class NotificationService {
  constructor() {
    this.permission = 'default';
    this.isEnabled = false;
    this.init();
  }

  init() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
      
      // Load saved settings
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.isEnabled = settings.webNotifications;
      }
    }
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  showNotification(title, options = {}) {
    if (!this.isEnabled || this.permission !== 'granted') {
      return false;
    }

    const notificationOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options
    };

    // Show notification
    const notification = new Notification(title, notificationOptions);

    // Handle click on notification
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  }

  // For chat messages
  notifyNewMessage(message, sender) {
    this.showNotification(`New message from ${sender}`, {
      body: message.length > 50 ? message.substring(0, 50) + '...' : message,
      tag: 'chat-message',
      requireInteraction: false
    });
  }

  // For system notifications
  notifySystem(message) {
    this.showNotification('Chat App', {
      body: message,
      tag: 'system'
    });
  }

  enable() {
    this.isEnabled = true;
    localStorage.setItem('notificationSettings', JSON.stringify({
      webNotifications: true,
      permission: this.permission
    }));
  }

  disable() {
    this.isEnabled = false;
    localStorage.setItem('notificationSettings', JSON.stringify({
      webNotifications: false,
      permission: this.permission
    }));
  }
}

export const notificationService = new NotificationService();