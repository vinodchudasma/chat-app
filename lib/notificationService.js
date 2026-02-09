class NotificationService {
  constructor() {
    this.settings = this.loadSettings();
  }

  loadSettings() {
    if (typeof window === 'undefined') return {};
    
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : {
      webNotifications: true,
      quietMode: false,
      messageSounds: true,
      desktopNotifications: true
    };
  }

  canShowNotification() {
    return this.settings.webNotifications && 
           this.settings.desktopNotifications &&
           'Notification' in window && 
           Notification.permission === 'granted';
  }

  showChatNotification(message, sender) {
    if (!this.canShowNotification()) return;

    const title = `New message from ${sender}`;
    const body = message.length > 100 ? message.substring(0, 100) + '...' : message;

    const notification = new Notification(title, {
      body,
      icon: '/public/file.svg',
      silent: this.settings.quietMode,
      tag: 'chat-message'
    });

    return notification;
  }
}

export const notificationService = new NotificationService();