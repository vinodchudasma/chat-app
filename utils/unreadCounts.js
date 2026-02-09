export class UnreadCountManager {
  static getUnreadCount(type, id) {
    const key = type === 'chats' ? `unread_${id}` : `group_unread_${id}`;
    const count = localStorage.getItem(key);
    return count ? parseInt(count, 10) : 0;
  }

  static setUnreadCount(type, id, count) {
    const key = type === 'chats' ? `unread_${id}` : `group_unread_${id}`;
    if (count > 0) {
      localStorage.setItem(key, count.toString());
    } else {
      localStorage.removeItem(key);
    }
  }

  static incrementUnreadCount(type, id) {
    const current = this.getUnreadCount(type, id);
    const newCount = current + 1;
    this.setUnreadCount(type, id, newCount);
    return newCount;
  }

  static resetUnreadCount(type, id) {
    this.setUnreadCount(type, id, 0);
    return 0;
  }

  static getAllUnreadCounts() {
    const counts = { chats: {}, groups: {} };
    
    // Get all chat unread counts
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('unread_') && !key.startsWith('group_unread_')) {
        const chatId = key.replace('unread_', '');
        counts.chats[chatId] = parseInt(localStorage.getItem(key), 10);
      } else if (key.startsWith('group_unread_')) {
        const groupId = key.replace('group_unread_', '');
        counts.groups[groupId] = parseInt(localStorage.getItem(key), 10);
      }
    }
    
    return counts;
  }

  static getTotalUnreadCounts() {
    const counts = this.getAllUnreadCounts();
    const totalChats = Object.values(counts.chats).reduce((sum, count) => sum + count, 0);
    const totalGroups = Object.values(counts.groups).reduce((sum, count) => sum + count, 0);
    
    return {
      totalChats,
      totalGroups,
      total: totalChats + totalGroups
    };
  }
}