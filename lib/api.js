import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

// Get token from localStorage or Clerk session
const getToken = () => {
  if (typeof window !== "undefined") {
    // Try to get token from localStorage first
    const storedToken = localStorage.getItem("clerkToken");
    if (storedToken) {
      return storedToken;
    }

    // If using Clerk, you might need to get it from the session
    if (window.Clerk && window.Clerk.session) {
      return window.Clerk.session.getToken();
    }
  }
  return null;
};

// Add auth token to requests automatically
api.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("No token found for API request");
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // console.error('API Error:', error.response?.status, error.response?.data);

    if (error.response?.status === 401) {
      console.log("Authentication error, redirecting to login...");
      if (typeof window !== "undefined") {
        window.location.href = "/sign-in";
      }
    }
    return Promise.reject(error);
  },
);

// Manual token setter (for Clerk integration)
export const setAuthToken = (token) => {
  if (token) {
    // Store in localStorage for persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("clerkToken", token);
    }

    // Also set on the axios instance
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    // Remove token
    if (typeof window !== "undefined") {
      localStorage.removeItem("clerkToken");
    }
    delete api.defaults.headers.common["Authorization"];
  }
};

// Clear token (for logout)
export const clearAuthToken = () => {
  setAuthToken(null);
};

export const userAPI = {
  searchUsers: (query) => api.get(`/api/users/search?q=${query}`),
  searchUsersForGroup: (query, groupId) =>
    api.get(`/api/users/group/${groupId}/search?q=${query}`),
  getProfile: () => api.get("/api/users/profile"),
  updateProfile: (data) => api.put("/api/users/profile", data),
  getNotifications: () => api.get("/api/users/notifications"),
  markNotificationAsRead: (id) =>
    api.put(`/api/users/notifications/${id}/read`),
  updateFCMToken: (token) =>
    api.post("/api/users/fcm/register", { fcm_token: token }),
  logout: (fcmToken) => {
    return api.post("/api/users/logout", { fcm_token: fcmToken });
  },

  removeAllFCMTokens: () => {
    return api.post("/api/users/fcm/remove-all");
  },
  getUserProfile: (userId) => {
    return api.get(`/api/users/profile/${userId}`);
  },
};

export const chatAPI = {
  sendInvitation: (friendEmail) =>
    api.post("/api/chats/invitations/send", { friendEmail }),
  getPendingInvitations: () => api.get("/api/chats/invitations/pending"),
  respondToInvitation: (invitationId, action) =>
    api.put(`/api/chats/invitations/${invitationId}/respond`, { action }),
  acceptInvitation: (id) =>
    api.put(`/api/chats/invitations/${id}/respond`, { action: "accept" }),
  rejectInvitation: (id) =>
    api.put(`/api/chats/invitations/${id}/respond`, { action: "reject" }),
  getChats: () => api.get("/api/chats"),
  getUserChatsWithCounts: () => api.get("/api/chats"),
  getChatMessages: (chatId, limit = 50, offset = 0) =>
    api.get(`/api/chats/${chatId}/messages?limit=${limit}&offset=${offset}`),

  // ADD THIS MISSING METHOD:
  sendMessage: (chatId, messageData) =>
    api.post(`/api/chats/${chatId}/messages`, messageData),
  sendFileMessage: (chatId, formData) =>
    api.post(`/api/chats/${chatId}/messages/file`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  markAsRead: (chatId) => api.post(`/api/messages/chats/${chatId}/mark-read`),

  editMessage: (messageId, data) =>
    api.put(`/api/messages/${messageId}/edit`, data),

  deleteMessageForMe: (messageId) =>
    api.delete(`/api/messages/${messageId}/for-me`),
  deleteMessageForEveryone: (messageId) =>
    api.delete(`/api/messages/${messageId}/for-everyone`),
  deleteChat: (chatId) => api.delete(`/api/chats/${chatId}`),
  clearChat: (chatId) => api.delete(`/api/chats/${chatId}/clear`),
  forwardMessage: (chatId, data) =>
    api.post(`/api/chats/${chatId}/messages/forward`, data),

  // Transcribe voice message
  transcribeVoiceMessage: (messageId, data) =>
    api.post(`/api/chats/messages/${messageId}/transcribe`, data),

  // Get voice message transcription
  getVoiceMessageTranscription: (messageId) =>
    api.get(`/api/chats/messages/${messageId}/transcription`),

  // Get unread message counts
  getUnreadCounts: (currentUserId) => {
    return api.get(`/api/users/${currentUserId}/unread-counts`);
  },

  incrementChatUnreadCount: (chatId, userId) =>
    api.post(`/api/chats/${chatId}/unread/increment`, { user_id: userId }),

  resetChatUnreadCount: (chatId, userId) =>
    api.post(`/api/chats/${chatId}/unread/reset`, { user_id: userId }),

  getUserTotalUnreadCounts: (userId) =>
    api.get(`/api/users/${userId}/unread-counts`),

  getMyUnreadCounts: () => api.get("/api/chats/unread-counts/me"),

  // getAllChatUnreadCounts: () => api.get('/api/chats/unread-counts/all'),

  getUserUnreadChatsCount: () => {
    return api.get("/api/chats/unread-counts");
  },

  getChatUnreadCount: (chatId) => {
    return api.get(`/api/chats/${chatId}/unread-count`);
  },

  getAllChatUnreadCounts: () => {
    return api.get("/api/chats/unread-counts");
  },
  // New functions
  removeUserFromChat: (chatId) =>
    api.delete(`/api/chats/${chatId}/remove-user`),

  clearChatMessages: (chatId) =>
    api.delete(`/api/chats/${chatId}/clear-messages`),

  toggleMuteNotifications: (chatId, mute) =>
    api.put(`/api/chats/${chatId}/toggle-mute`, { mute }),

  getMutedChats: () => api.get("/api/chats/muted"),

  markMessageAsRead: (messageId) =>
    api.post(`/api/messages/${messageId}/mark-read`),
  markChatMessagesAsRead: (chatId) =>
    api.post(`/api/chats/${chatId}/mark-read`),
};

export const groupAPI = {
  createGroup: (data) => api.post("/api/groups", data),
  getUserGroups: () => api.get("/api/groups"),
  getGroupDetails: (id) => api.get(`/api/groups/${id}`),
  addMember: (groupId, userId) =>
    api.post(`/api/groups/${groupId}/members`, { userId }),
  removeMember: (groupId, userId) =>
    api.delete(`/api/groups/${groupId}/members/${userId}`),
  getGroupMessages: (groupId, limit = 50, offset = 0) =>
    api.get(`/api/groups/${groupId}/messages?limit=${limit}&offset=${offset}`),
  sendGroupMessage: (groupId, data) =>
    api.post(`/api/groups/${groupId}/messages`, data),
  sendGroupFileMessage: (groupId, formData) =>
    api.post(`/api/groups/${groupId}/messages/file`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),

  editGroupMessage: (messageId, data) =>
    api.put(`/api/group-messages/${messageId}/edit`, data),

  markAsRead: (groupId) => api.post(`/api/groups/${groupId}/mark-read`),
  markGroupMessagesAsRead: (groupId) =>
    api.post(`/api/groups/${groupId}/mark-read`),

  // Get group members
  getGroupMembers: (groupId) => {
    return api.get(`/api/groups/${groupId}/members`);
  },

  // Search users for adding to group
  searchUsers: (query) => {
    return api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
  },

  // Add members to group
  addGroupMembers: (groupId, data) => {
    return api.post(`/api/groups/${groupId}/members`, data);
  },

  // Remove member from group
  removeGroupMember: (groupId, userId) => {
    return api.delete(`/api/groups/${groupId}/members/${userId}`);
  },

  // Update member role
  updateMemberRole: (groupId, userId, data) => {
    return api.put(`/api/groups/${groupId}/members/${userId}/role`, data);
  },

  // Get unread message counts
  getUnreadCounts: (groupId) => {
    return api.get(`/api/groups/${groupId}/unread-counts`);
  },

  // Send group file message
  sendGroupFileMessage: (groupId, formData) => {
    return api.post(`/api/groups/${groupId}/messages/file`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  deleteGroupMessageForMe: (messageId) =>
    api.delete(`/api/group-messages/${messageId}/for-me`),
  deleteGroupMessageForEveryone: (messageId) =>
    api.delete(`/api/group-messages/${messageId}/for-everyone`),
  removeMember: async (groupId, userId) => {
    return api.delete(`/api/groups/${groupId}/members/${userId}`);
  },

  leaveGroup: async (groupId) => {
    return api.post(`/api/groups/${groupId}/leave`);
  },
  deleteGroup: (groupId) => api.delete(`/api/groups/${groupId}`),
  forwardGroupMessage: (groupId, data) =>
    api.post(`/api/groups/${groupId}/messages/forward`, data),

  incrementGroupUnreadCount: (groupId, userId) =>
    api.post(`/api/groups/${groupId}/unread/increment`, { user_id: userId }),

  resetGroupUnreadCount: (groupId, userId) =>
    api.post(`/api/groups/${groupId}/unread/reset`, { user_id: userId }),

  // getUserTotalUnreadCounts: (userId) =>
  //   api.get(`/api/users/${userId}/group-unread-counts`),

  getUserUnreadGroupsCount: () => {
    return api.get("/api/groups/unread-counts");
  },

  getGroupUnreadCount: (groupId) => {
    return api.get(`/api/groups/${groupId}/unread-count`);
  },

  getAllGroupUnreadCounts: () => {
    return api.get("/api/groups/unread-counts");
  },

  getUserTotalUnreadCounts: () => {
    return api.get("/api/users/total-unread-counts");
  },
  getUserChatsWithCounts: () => api.get("/api/chats"),
  markGroupMessageAsRead: (messageId) =>
    api.post(`/api/group-messages/${messageId}/mark-read`),
  markAllGroupMessagesAsRead: (groupId) =>
    api.post(`/api/groups/${groupId}/mark-read`),
  getGroupMembers: (groupId) => api.get(`/api/groups/${groupId}/members`),
  // MENTION-RELATED APIs (NEW)

  // Search group members for mention suggestions
  searchGroupMembers: (groupId, query) => {
    return api.get(
      `/api/groups/${groupId}/members/search?query=${encodeURIComponent(query)}`,
    );
  },

  // Get all group members for mention suggestions
  getGroupMembersForMentions: (groupId) => {
    return api.get(`/api/groups/${groupId}/members/mention-suggestions`);
  },

  // Get unread mentions count
  getUnreadMentions: (groupId) => {
    return api.get(`/api/groups/${groupId}/mentions/unread`);
  },

  // Mark mentions as read
  markMentionsAsRead: (groupId) => {
    return api.post(`/api/groups/${groupId}/mentions/mark-read`);
  },

  // Get messages where user was mentioned
  getMentionedMessages: (groupId, limit = 20, offset = 0) => {
    return api.get(
      `/api/groups/${groupId}/mentions/messages?limit=${limit}&offset=${offset}`,
    );
  },

  // Get all mentions for user (across all groups)
  getAllMentions: (limit = 20, offset = 0) => {
    return api.get(`/api/mentions?limit=${limit}&offset=${offset}`);
  },

  // Get mention statistics
  getMentionStats: (groupId) => {
    return api.get(`/api/groups/${groupId}/mentions/stats`);
  },

  // Send message with mentions
  sendMessageWithMentions: (groupId, data) => {
    return api.post(`/api/groups/${groupId}/messages/with-mentions`, data);
  },
};

export const messageAPI = {
  sendPrivateMessage: (data) => api.post("/api/messages/private", data),
  sendGroupMessage: (data) => api.post("/api/messages/group", data),
};

// lib/api.js - Update your notificationAPI
export const notificationAPI = {
  // FCM Token management
  registerFCMToken: (token) =>
    api.post("/api/notifications/fcm/register", { fcm_token: token }),
  unregisterFCMToken: (token) =>
    api.post("/api/notifications/fcm/unregister", { fcm_token: token }),

  // Notification settings
  toggleNotifications: (enabled) =>
    api.put("/api/notifications/settings", { enabled }),
  getSettings: () => api.get("/api/notifications/settings"),

  // Test notifications
  sendTestNotification: () => api.post("/api/notifications/test"),

  // Notification management
  getNotifications: () => api.get("/api/notifications"),
  getUnreadCount: () => api.get("/api/notifications/unread-count"),
  markAsRead: (notificationId) =>
    api.put(`/api/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put("/api/notifications/read-all"),
  deleteNotification: (notificationId) =>
    api.delete(`/api/notifications/${notificationId}`),
  clearAll: () => api.delete("/api/notifications"),
};

export const callAPI = {
  // Call initiation and management
  initiateCall: (data) => api.post("/api/calls/initiate", data),
  acceptCall: (callId, data) => api.post(`/api/calls/${callId}/accept`, data),
  rejectCall: (callId, data) => api.post(`/api/calls/${callId}/reject`, data),
  endCall: (callId, data) => api.post(`/api/calls/${callId}/end`, data),
  cancelCall: (callId, data) => api.post(`/api/calls/${callId}/cancel`, data),

  // Group call routes
  initiateGroupCall: (data) => api.post("/api/calls/group/initiate", data),
  joinGroupCall: (callId) => api.post(`/api/calls/group/${callId}/join`),

  // Call history with better parameters
  getCallHistory: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.type) queryParams.append("type", params.type);
    if (params.status) queryParams.append("status", params.status);

    return api.get(`/api/calls/history?${queryParams.toString()}`);
  },

  getCallStatistics: () => api.get("/api/calls/statistics"),
  deleteCall: (callId) => api.delete(`/api/calls/history/${callId}`),
  clearCallHistory: () => api.delete("/api/calls/history"),

  // WebRTC signaling helpers
  getTurnCredentials: () => api.get("/api/webrtc/turn-credentials"),
};

export const aiAPI = {
  getMessageSuggestions: (data) => api.post("/api/ai/suggestions", data),
  getTypingPredictions: (data) => api.post("/api/ai/typing-predictions", data), // Fixed endpoint name
  translateMessage: (data) => api.post("/api/ai/translate", data),
  detectLanguage: (data) => api.post("/api/ai/detect-language", data),

  // Add this new method for typing predictions
  getTypingSuggestions: (data) => api.post("/api/ai/typing-suggestions", data),
};

export const moderationAPI = {
  moderateMessage: (data) => api.post("/api/ai/moderate", data),
  getModerationStats: () => api.get("/api/ai/stats"),
  getModerationLogs: (params) => api.get("/api/ai/logs", { params }),
};

export const semanticSearchAPI = {
  generateEmbeddings: (data) => api.post("/api/ai/embeddings/generate", data),
  semanticSearch: (data) => api.post("/api/ai/search/semantic", data),
  getConversationSummary: (data) => api.post("/api/ai/search/summary", data),
};

export default api;
