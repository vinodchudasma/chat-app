'use client';

import { useState, useEffect, useRef } from 'react';
import { groupAPI, userAPI } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';
import { successToast, errorToast } from "./toast";
import GroupProfileModal from './GroupProfileModal';

export default function GroupManager({ onSelectChat, selectedChat, socket, currentUserId, onResetGroupCount }) {
  const [groups, setGroups] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', is_public: false });
  const [showAddMember, setShowAddMember] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [groupDetails, setGroupDetails] = useState({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  const [showGroupSearch, setShowGroupSearch] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);

  // Menu states
  const [groupMenuOpen, setGroupMenuOpen] = useState(null);
  const [selectedGroupForAction, setSelectedGroupForAction] = useState(null);
  const [mutedGroups, setMutedGroups] = useState(new Set());
  const [showGroupProfile, setShowGroupProfile] = useState(false);
  const [selectedGroupForProfile, setSelectedGroupForProfile] = useState(null);
  const menuRef = useRef(null);

  // Track processed updates to prevent double counting
  const processedUpdatesRef = useRef(new Set());

  // Add typing state to each component
const [typingUsers, setTypingUsers] = useState({});

// Add socket listener for typing events
useEffect(() => {
  if (!socket) return;

  // Listen for typing events
  const handleTypingEvent = (data) => {
    const chatId = data.chat_id || data.group_id;
    const userId = data.user_id;
    
    if (chatId && userId !== currentUserId) {
      setTypingUsers(prev => ({
        ...prev,
        [chatId]: {
          isTyping: data.is_typing,
          userId: userId,
          timestamp: Date.now()
        }
      }));
      
      // Clear typing indicator after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => {
          const typingData = prev[chatId];
          if (typingData && typingData.timestamp === Date.now() - 3000) {
            const newTyping = { ...prev };
            delete newTyping[chatId];
            return newTyping;
          }
          return prev;
        });
      }, 3000);
    }
  };

  // Listen for both private and group typing
  socket.on('user_typing', handleTypingEvent);
  socket.on('group_user_typing', handleTypingEvent);

  return () => {
    socket.off('user_typing', handleTypingEvent);
    socket.off('group_user_typing', handleTypingEvent);
  };
}, [socket, currentUserId]);

  // Load groups on component mount
  useEffect(() => {
    if (currentUserId) {
      loadGroups();
    }
  }, [currentUserId]);

  // ========== ADD REAL-TIME SOCKET LISTENERS HERE ==========
  useEffect(() => {
    if (!socket || !currentUserId) return;

    // Handle group unread count updates from server
    const handleGroupUnreadUpdated = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      const updateKey = `group-${data.group_id}-${data.unread_count}-${Date.now()}`;

      // Prevent processing the same update multiple times
      if (processedUpdatesRef.current.has(updateKey)) return;
      processedUpdatesRef.current.add(updateKey);

      // Update groups list with new unread count
      setGroups(prev => prev.map(group => {
        if (group._id.toString() === data.group_id.toString()) {
          return {
            ...group,
            unread_count: data.unread_count || 0,
            ...(data.last_message_at && {
              last_message: data.last_message || group.last_message,
              last_message_type: data.last_message_type || group.last_message_type,
              last_message_at: data.last_message_at
            })
          };
        }
        return group;
      }));

      // Also update filtered groups
      setFilteredGroups(prev => prev.map(group => {
        if (group._id.toString() === data.group_id.toString()) {
          return {
            ...group,
            unread_count: data.unread_count || 0,
            ...(data.last_message_at && {
              last_message: data.last_message || group.last_message,
              last_message_type: data.last_message_type || group.last_message_type,
              last_message_at: data.last_message_at
            })
          };
        }
        return group;
      }));

      // Clean up old processed keys
      setTimeout(() => {
        processedUpdatesRef.current.delete(updateKey);
      }, 3000);
    };

    // Handle when group messages are marked as read
    const handleGroupUnreadReset = (data) => {
      if (data.user_id.toString() !== currentUserId.toString()) return;

      setGroups(prev => prev.map(group =>
        group._id.toString() === data.group_id.toString()
          ? { ...group, unread_count: 0 }
          : group
      ));

      setFilteredGroups(prev => prev.map(group =>
        group._id.toString() === data.group_id.toString()
          ? { ...group, unread_count: 0 }
          : group
      ));
    };

    // Handle new group messages (for updating last message)
    const handleGroupMessage = (message) => {
      const groupId = message.group_id;
      if (!groupId) return;

      const isOwnMessage = parseInt(message.sender_id) === parseInt(currentUserId);
      const isSelected = selectedChat?.type === 'group' && selectedChat?._id === groupId.toString();

      // Update groups list with new last message
      setGroups(prev => {
        const groupIndex = prev.findIndex(g => g._id.toString() === groupId.toString());

        if (groupIndex === -1) {
          // Group not found, reload groups
          setTimeout(() => loadGroups(), 100);
          return prev;
        }

        const updatedGroups = [...prev];
        const groupToUpdate = { ...updatedGroups[groupIndex] };

        // Update last message info
        groupToUpdate.last_message = message.message;
        groupToUpdate.last_message_type = message.message_type;
        groupToUpdate.last_message_at = message.created_at || new Date().toISOString();

        // Move to top (most recent)
        updatedGroups.splice(groupIndex, 1);
        updatedGroups.unshift(groupToUpdate);

        return updatedGroups;
      });

      // Also update filtered groups
      setFilteredGroups(prev => {
        const groupIndex = prev.findIndex(g => g._id.toString() === groupId.toString());

        if (groupIndex === -1) return prev;

        const updatedGroups = [...prev];
        const groupToUpdate = { ...updatedGroups[groupIndex] };

        groupToUpdate.last_message = message.message;
        groupToUpdate.last_message_type = message.message_type;
        groupToUpdate.last_message_at = message.created_at || new Date().toISOString();

        updatedGroups.splice(groupIndex, 1);
        updatedGroups.unshift(groupToUpdate);

        return updatedGroups;
      });
    };

    // Handle group sidebar updates (from other components)
    const handleUpdateSidebarGroup = (data) => {
      if (data.group_id) {
        setGroups(prev => prev.map(group =>
          group._id.toString() === data.group_id.toString()
            ? {
              ...group,
              last_message: data.last_message || group.last_message,
              last_message_type: data.last_message_type || group.last_message_type,
              last_message_at: data.last_message_at || group.last_message_at
            }
            : group
        ));

        setFilteredGroups(prev => prev.map(group =>
          group._id.toString() === data.group_id.toString()
            ? {
              ...group,
              last_message: data.last_message || group.last_message,
              last_message_type: data.last_message_type || group.last_message_type,
              last_message_at: data.last_message_at || group.last_message_at
            }
            : group
        ));
      }
    };

    // Handle group deletion
    const handleGroupDeleted = (data) => {
      setGroups(prev => prev.filter(group =>
        group._id.toString() !== data.group_id.toString()
      ));

      setFilteredGroups(prev => prev.filter(group =>
        group._id.toString() !== data.group_id.toString()
      ));

      // If this group is currently selected, clear it
      if (selectedChat?.type === 'group' && selectedChat?._id === data.group_id.toString()) {
        onSelectChat(null);
      }

      errorToast(`Group "${data.group_name}" was deleted`);
    };

    // Set up socket listeners
    socket.on('group_unread_updated', handleGroupUnreadUpdated);
    socket.on('group_unread_reset', handleGroupUnreadReset);
    socket.on('group_message', handleGroupMessage);
    socket.on('update_sidebar_group', handleUpdateSidebarGroup);
    socket.on('group_deleted', handleGroupDeleted);

    return () => {
      // Clean up listeners
      socket.off('group_unread_updated', handleGroupUnreadUpdated);
      socket.off('group_unread_reset', handleGroupUnreadReset);
      socket.off('group_message', handleGroupMessage);
      socket.off('update_sidebar_group', handleUpdateSidebarGroup);
      socket.off('group_deleted', handleGroupDeleted);
    };
  }, [socket, currentUserId, selectedChat, onSelectChat]);


  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setGroupMenuOpen(null);
        setShowAddMember(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load muted groups from localStorage
  useEffect(() => {
    const savedMutedGroups = localStorage.getItem('mutedGroups');
    if (savedMutedGroups) {
      setMutedGroups(new Set(JSON.parse(savedMutedGroups)));
    }
  }, []);

  // Save muted groups to localStorage
  useEffect(() => {
    localStorage.setItem('mutedGroups', JSON.stringify(Array.from(mutedGroups)));
  }, [mutedGroups]);

  // Enhanced load groups with proper unread tracking
  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await groupAPI.getUserGroups();

      const responseUser = await userAPI.getProfile();
      if (responseUser?.data?._id) {
        setUserId(responseUser.data._id);
      }

      // Get fresh unread counts from server for ALL groups
      const groupsWithCounts = await Promise.all(
        response.data.map(async (group) => {
          try {
            const countResponse = await groupAPI.getGroupUnreadCount(group._id);
            return {
              ...group,
              unread_count: countResponse.data?.unread_count || 0
            };
          } catch (error) {
            console.error(`Error fetching count for group ${group._id}:`, error);
            return {
              ...group,
              unread_count: 0
            };
          }
        })
      );

      // Sort by last message time (most recent first)
      const sortedGroups = groupsWithCounts.sort((a, b) => {
        const timeA = new Date(a.last_message_at || a.created_at || 0);
        const timeB = new Date(b.last_message_at || b.created_at || 0);
        return timeB - timeA;
      });

      setGroups(sortedGroups);
      setFilteredGroups(sortedGroups); // Initialize filtered groups

    } catch (error) {
      console.error('Error loading groups:', error);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  // ========== ADD REAL-TIME SOCKET LISTENERS FOR GROUP MEMBER CHANGES ==========
  useEffect(() => {
    if (!socket || !currentUserId) return;

    // Handle when a member is added to group
    const handleMemberAdded = (data) => {
      if (data.group_id && data.user_id && data.user_id.toString() === currentUserId.toString()) {
        // If it's the current user being added, reload groups
        loadGroups();
        successToast(`You were added to the group "${data.group_name}"`);
      }
    };

    // Handle when a member is removed from group
    const handleMemberRemoved = (data) => {
      if (data.group_id && data.user_id && data.user_id.toString() === currentUserId.toString()) {
        // If current user is removed, remove group from list
        setGroups(prev => prev.filter(group =>
          group._id.toString() !== data.group_id.toString()
        ));
        setFilteredGroups(prev => prev.filter(group =>
          group._id.toString() !== data.group_id.toString()
        ));

        // If this group is currently selected, clear it
        if (selectedChat?.type === 'group' && selectedChat?._id === data.group_id.toString()) {
          onSelectChat(null);
        }

        errorToast(`You were removed from the group "${data.group_name}"`);
      }
    };

    // Handle group member count updates
    const handleGroupMemberUpdated = (data) => {
      if (data.group_id) {
        // Update member count for the group
        setGroups(prev => prev.map(group => {
          if (group._id.toString() === data.group_id.toString()) {
            return {
              ...group,
              member_count: data.member_count || group.member_count
            };
          }
          return group;
        }));

        setFilteredGroups(prev => prev.map(group => {
          if (group._id.toString() === data.group_id.toString()) {
            return {
              ...group,
              member_count: data.member_count || group.member_count
            };
          }
          return group;
        }));
      }
    };

    // Set up socket listeners
    socket.on('group_member_added', handleMemberAdded);
    socket.on('group_member_removed', handleMemberRemoved);
    socket.on('group_member_updated', handleGroupMemberUpdated);

    return () => {
      // Clean up listeners
      socket.off('group_member_added', handleMemberAdded);
      socket.off('group_member_removed', handleMemberRemoved);
      socket.off('group_member_updated', handleGroupMemberUpdated);
    };
  }, [socket, currentUserId, selectedChat, onSelectChat, loadGroups]);

  // Handle search toggle
  const toggleGroupSearch = () => {
    setShowGroupSearch(!showGroupSearch);
    if (showGroupSearch) {
      // If hiding search, clear the search
      clearGroupSearch();
    } else {
      // If showing search, focus the input
      setTimeout(() => {
        const searchInput = document.getElementById('groupSearchInput');
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  };

  // Handle group search
  const handleGroupSearch = (query) => {
    setGroupSearchQuery(query);
    setIsSearchingGroups(query.length > 0);

    if (query.length === 0) {
      setFilteredGroups(groups);
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered = groups.filter(group => {
      const name = group.name?.toLowerCase() || '';
      const description = group.description?.toLowerCase() || '';
      const lastMessage = group.last_message?.toLowerCase() || '';

      return (
        name.includes(searchTerm) ||
        description.includes(searchTerm) ||
        lastMessage.includes(searchTerm)
      );
    });

    setFilteredGroups(filtered);
  };

  // Clear search
  const clearGroupSearch = () => {
    setGroupSearchQuery('');
    setIsSearchingGroups(false);
    setFilteredGroups(groups);
    setShowGroupSearch(false); // Also hide the search input when clearing
  };
  // ========== END SEARCH FUNCTIONALITY ==========

  // Handle group click
  const handleGroupClick = async (group) => {
    // First update local state immediately
    setGroups(prev => prev.map(g =>
      g._id === group._id
        ? { ...g, unread_count: 0 }
        : g
    ));

    setFilteredGroups(prev => prev.map(g =>
      g._id === group._id
        ? { ...g, unread_count: 0 }
        : g
    ));

    // Then mark messages as read via API
    try {
      await groupAPI.markGroupMessagesAsRead(group._id);

      // Call parent function to reset group count
      if (onResetGroupCount) {
        onResetGroupCount(group._id);
      }

      // Emit socket event to notify server
      if (socket) {
        socket.emit('group_messages_read', {
          group_id: group._id,
          user_id: currentUserId
        });
      }

    } catch (error) {
      console.error(' Error marking group messages as read:', error);
      // Revert the local state if API call fails
      setGroups(prev => prev.map(g =>
        g._id === group._id
          ? { ...g, unread_count: group.unread_count }
          : g
      ));

      setFilteredGroups(prev => prev.map(g =>
        g._id === group._id
          ? { ...g, unread_count: group.unread_count }
          : g
      ));
    }

    onSelectChat({
      type: 'group',
      id: group._id,
      name: group.name,
      description: group.description,
      avatar: group.avatar || '/group-avatar.png',
      created_by: group.created_by,
      member_count: group.member_count,
      user_role: group.user_role,
      is_public: group.is_public
    });
  };

  // Enhanced group invitation with socket
  const inviteMember = async (groupId, userId) => {
    try {
      setError('');
      const response = await groupAPI.addMember(groupId, userId);

      // Emit socket event for real-time notification
      if (socket) {
        socket.emit('group_invitation_sent', {
          group_id: groupId,
          to_user_id: userId,
          from_user_id: currentUserId,
          invitation_id: response.data._id
        });
      }

      // Show success message
      successToast('Invitation sent successfully!');

      // Reload group details to show the new pending member
      await loadGroupDetails(groupId);

      // Clear search results and input
      setSearchResults([]);
      setMemberSearch('');

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to send invitation';
      setError(errorMessage);
      errorToast(errorMessage);
    }
  };

  // Enhanced remove member function
  const removeMember = async (groupId, userId) => {
    const memberName = groupDetails[groupId]?.members?.find(m => m.user._id === userId)?.user?.username || 'this member';

    if (confirm(`Are you sure you want to remove ${memberName} from the group?`)) {
      try {
        const response = await groupAPI.removeMember(groupId, userId);
        if (response.data.success) {
          successToast('Member removed successfully!');

          // Reload group details to reflect changes
          await loadGroupDetails(groupId);

          // If the removed member is the current user, remove group from list
          if (parseInt(userId) === parseInt(currentUserId)) {
            setGroups(prev => prev.filter(group => group._id !== groupId));
            setFilteredGroups(prev => prev.filter(group => group._id !== groupId));
            onSelectChat(null); // Close the chat window
          }
        }
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Failed to remove member';
        errorToast(errorMessage);

        if (error.response?.data?.code === 'ONLY_ADMIN') {
          errorToast('You are the only admin. Assign another admin before removing yourself.');
        }
      }
    }
  };

  // Function for leaving group
  const leaveGroup = async (groupId) => {
    if (confirm('Are you sure you want to leave this group?')) {
      try {
        const response = await groupAPI.leaveGroup(groupId);
        if (response.data.success) {
          successToast('You have left the group');

          // Reload groups list
          loadGroups();

          // Close the chat window if it was this group
          if (selectedChat?.type === 'group' && selectedChat?._id === groupId.toString()) {
            onSelectChat(null);
          }

          // Close member management section if open
          if (showAddMember === groupId) {
            setShowAddMember(null);
          }
        }
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Failed to leave group';
        if (error.response?.data?.code === 'ONLY_ADMIN') {
          errorToast('You are the only admin. Please assign another admin before leaving.');
        } else {
          errorToast(errorMessage);
        }
      }
    }
  };

  // Function to delete group
  const deleteGroup = async (groupId) => {
    if (confirm('Are you sure you want to delete this group? This action cannot be undone and all messages will be lost.')) {
      try {
        const response = await groupAPI.deleteGroup(groupId);
        if (response.data.success) {
          successToast('Group deleted successfully');

          // Remove group from local state immediately
          setGroups(prev => prev.filter(group => group._id !== groupId));
          setFilteredGroups(prev => prev.filter(group => group._id !== groupId));

          // Close chat if it's this group
          if (selectedChat?.type === 'group' && selectedChat?._id === groupId.toString()) {
            onSelectChat(null);
          }

          // Close member management section if open
          if (showAddMember === groupId) {
            setShowAddMember(null);
          }
        }
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Failed to delete group';
        errorToast(errorMessage);
      }
    }
  };

  // Enhanced load group details
  const loadGroupDetails = async (groupId) => {
    try {
      const response = await groupAPI.getGroupDetails(groupId);
      setGroupDetails(prev => ({
        ...prev,
        [groupId]: response.data
      }));
    } catch (error) {
      console.error('Error loading group details:', error);
      setError('Failed to load group details');
    }
  };

  // Toggle member management section
  const toggleMemberSection = async (groupId) => {
    if (showAddMember === groupId) {
      setShowAddMember(null);
      setMemberSearch('');
      setSearchResults([]);
    } else {
      setShowAddMember(groupId);
      // Load group details when opening member section
      await loadGroupDetails(groupId);
    }
    setGroupMenuOpen(null); // Close the menu
  };

  // Group menu functions
  const handleGroupMenuToggle = (groupId, e) => {
    e.stopPropagation();
    setGroupMenuOpen(groupMenuOpen === groupId ? null : groupId);
    setSelectedGroupForAction(groupId);
  };

  const handleToggleGroupMute = (groupId) => {
    const newMutedGroups = new Set(mutedGroups);
    if (newMutedGroups.has(groupId)) {
      newMutedGroups.delete(groupId);
      successToast('Group notifications unmuted');
    } else {
      newMutedGroups.add(groupId);
      successToast('Group notifications muted');
    }
    setMutedGroups(newMutedGroups);
    setGroupMenuOpen(null);
  };

  const handleViewGroupProfile = (group) => {
    setSelectedGroupForProfile({
      id: group._id,
      name: group.name,
      description: group.description,
      created_by: group.created_by,
      created_at: group.created_at,
      member_count: group.member_count,
      is_public: group.is_public,
      unread_count: group.unread_count,
      user_role: group.user_role
    });
    setShowGroupProfile(true);
    setGroupMenuOpen(null);
  };

  // Search users for member management
  const searchUsers = async (query) => {
    setMemberSearch(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await userAPI.searchUsers(query);

      // Ensure we have group details loaded
      if (showAddMember && !groupDetails[showAddMember]) {
        await loadGroupDetails(showAddMember);
      }

      if (showAddMember && groupDetails[showAddMember]) {
        // Get current member IDs to filter them out
        const currentMemberIds = groupDetails[showAddMember].members.map(member => member.user._id);
        // Filter out users who are already members
        const filteredResults = response.data.filter(user =>
          !currentMemberIds.includes(user._id)
        );
        setSearchResults(filteredResults);
      } else {
        setSearchResults(response.data);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Create group function
  const createGroup = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const response = await groupAPI.createGroup(newGroup);
      setNewGroup({ name: '', description: '', is_public: false });
      setShowCreateForm(false);
      await loadGroups();

      // Automatically select the newly created group
      onSelectChat({
        type: 'group',
        id: response.data._id,
        name: response.data.name,
        description: response.data.description,
        is_public: response.data.is_public,
        user_role: 'admin'
      });
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create group');
    }
  };

  // Get message preview
  const getMessagePreview = (group) => {
    if (!group.last_message) return 'Start a conversation';

    // Check for different message types
    switch (group.last_message_type) {
      case 'image':
        return '📷 Image';
      case 'file':
        return '📎 File';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎤 Voice Message';
      case 'code':
        return '💻 Code Snippet';
      case 'deleted':
        return '🗑️ Message deleted';
      case 'system':
        return '🔔 System notification';
      default:
        const text = group.last_message || '';
        if (text.length > 30) {
          return `${text.substring(0, 30)}...`;
        }
        return text;
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

      if (diffInDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffInDays === 1) {
        return 'Yesterday';
      } else if (diffInDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      return '';
    }
  };

  // Calculate unread counts
  const totalUnread = groups.reduce((sum, group) => sum + (group.unread_count || 0), 0);

  return (
    <div className="p-4" ref={menuRef}>
      {/* Header with refresh and search buttons - LIKE ALLCONVERSATIONS.JS */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Groups</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-600">
              {groups.length} total
            </span>
            {totalUnread > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {totalUnread} unread
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Search Icon Button - LIKE ALLCONVERSATIONS.JS */}
          <button
            onClick={toggleGroupSearch}
            className={`text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer ${showGroupSearch ? 'bg-blue-100 text-blue-600' : ''
              }`}
            title={showGroupSearch ? "Hide search" : "Search groups"}
          >
            {showGroupSearch ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>

          {/* Refresh Icon Button */}
          <button
            onClick={loadGroups}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="Refresh groups"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Input (shown when search icon is clicked) - LIKE ALLCONVERSATIONS.JS */}
      {showGroupSearch && (
        <div className="mb-3">
          <div className="relative">
            <input
              id="groupSearchInput"
              type="text"
              placeholder="Search groups by name or description..."
              value={groupSearchQuery}
              onChange={(e) => handleGroupSearch(e.target.value)}
              className="w-full p-2 pl-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {groupSearchQuery && (
              <button
                onClick={clearGroupSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {isSearchingGroups && (
            <div className="text-xs text-gray-500 mt-1">
              Found {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Create Group Button */}
      <button
        onClick={() => setShowCreateForm(true)}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2.5 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center mb-4 cursor-pointer shadow-sm hover:shadow"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create New Group
      </button>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Create Group Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Create New Group</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={createGroup}>
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter group name"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Group description (optional)"
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all cursor-pointer font-medium shadow-sm hover:shadow"
                  >
                    Create Group
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-all cursor-pointer font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Groups List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-700 text-sm">Your Groups</h3>
          <span className="text-xs text-gray-500">
            {(isSearchingGroups ? filteredGroups : groups).filter(group => group.unread_count > 0).length} unread
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
            <p className="ml-2 text-gray-600">Loading groups...</p>
          </div>
        ) : (isSearchingGroups ? filteredGroups : groups).length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500 text-sm">
              {isSearchingGroups ? 'No groups found' : 'No groups yet. Create your first group!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(isSearchingGroups ? filteredGroups : groups).map(group => {
              const unreadCount = group.unread_count || 0;
              const isSelected = selectedChat?.type === 'group' && selectedChat?._id === group._id;
              const isMuted = mutedGroups.has(group._id);
              const isAdmin = group.user_role === 'admin';
              const isCreator = group.created_by === userId;
              const isTyping = typingUsers[group._id]?.isTyping;
               const typingUserId = typingUsers[group._id]?.userId;

              return (
                <div
                  key={group._id}
                  onClick={() => handleGroupClick(group)}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 relative group ${isSelected
                    ? 'bg-green-50 border border-green-200 shadow-sm'
                    : unreadCount > 0
                      ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                      : 'border border-transparent hover:bg-gray-50'
                    }`}
                >
                  {/* Avatar with group indicator - LIKE ALLCONVERSATIONS.JS */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold`}>
                      {group.name.charAt(0).toUpperCase()}
                    </div>

                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white bg-blue-500`}>
                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                    </div>

                    {/* Unread badge - LIKE ALLCONVERSATIONS.JS */}
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}

                    {/* Muted indicator */}
                    {isMuted && (
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center border-2 border-white">
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Group info - LIKE ALLCONVERSATIONS.JS */}
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-gray-900 truncate ${unreadCount > 0 ? 'font-semibold text-black' : ''}`}>
                          {group.name}
                          {isMuted && (
                            <span className="ml-2 text-gray-400">
                              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              </svg>
                            </span>
                          )}
                        </p>
                        {group.is_public && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                            Public
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {group.last_message_at && (
                          <span className={`text-xs whitespace-nowrap ${unreadCount > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                            {formatTime(group.last_message_at)}
                          </span>
                        )}
                        {/* 3-dot menu button - LIKE ALLCONVERSATIONS.JS */}
                        <button
                          onClick={(e) => handleGroupMenuToggle(group._id, e)}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <>
                        {isTyping ? (
                          <div className="typing-indicator">
                            <span className="typing-dots">
                            </span>
                            <span className="typing-dots">
                            </span>
                            <span className="typing-dots">
                            </span>
                            Typing
                          </div>
                        ) : (
                      <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'text-black font-medium' : 'text-gray-600'}`}>
                        {getMessagePreview(group)}
                      </p>
                       )}
                      </>
                      {/* <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'text-black font-medium' : 'text-gray-600'}`}>
                        {getMessagePreview(group)}
                      </p> */}
                    </div>


                  </div>

                  {/* Dropdown Menu - LIKE ALLCONVERSATIONS.JS */}
                  {groupMenuOpen === group._id && (
                    <div className="absolute right-0 top-10 z-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewGroupProfile(group);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Group Details
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleGroupMute(group._id);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        {isMuted ? (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            Unmute Notifications
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            Mute Notifications
                          </>
                        )}
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMemberSection(group._id);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 3.75a2.5 2.5 0 01-2.5 2.5" />
                            </svg>
                            Manage Members
                          </button>
                        </>
                      )}

                      {/* Leave/Delete options */}
                      <div className="border-t border-gray-200 my-1 pt-1">
                        {!isCreator ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              leaveGroup(group._id);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Leave Group
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteGroup(group._id);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Group
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Member Management Section */}
        {showAddMember && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAddMember(null);
              }
            }}
          >
            <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800">
                    Manage "{groups.find(g => g._id === showAddMember)?.name}"
                  </h3>
                  <button
                    onClick={() => setShowAddMember(null)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Add Member Section */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-700 mb-4">Add New Members</h4>
                  <div className="relative mb-4">
                    <input
                      type="text"
                      placeholder="Search users by email or name (min 2 characters)..."
                      value={memberSearch}
                      onChange={(e) => searchUsers(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-3">
                        <LoadingSpinner size="small" />
                      </div>
                    )}
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-3 mb-6">
                      <p className="text-sm font-medium text-gray-600">Search Results:</p>
                      {searchResults.map(user => (
                        <div key={user._id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-center">
                            <img
                              src={user.profile_image || '/default-avatar.png'}
                              alt={user.first_name}
                              className="w-8 h-8 rounded-full mr-3 border-2 border-white"
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs text-gray-600">{user.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => inviteMember(showAddMember, user._id)}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:from-green-600 hover:to-emerald-700 transition-all cursor-pointer"
                          >
                            Invite
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {memberSearch.length >= 2 && searchResults.length === 0 && !searchLoading && (
                    <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 rounded-lg">
                      No users found matching "{memberSearch}"
                    </div>
                  )}
                </div>

                {/* Current Members */}
                {groupDetails[showAddMember]?.members && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700 mb-4">
                      Group Members ({groupDetails[showAddMember].members.length})
                    </h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {groupDetails[showAddMember].members.map(member => (
                        <div key={member.user._id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50">
                          <div className="flex items-center">
                            <img
                              src={member.user.profile_image || '/default-avatar.png'}
                              alt={member.user.username}
                              className="w-8 h-8 rounded-full mr-3 border-2 border-white"
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {member.user.username}
                              </p>
                              <p className="text-xs text-gray-600">{member.user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`text-xs px-3 py-1.5 rounded-full ${member.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                              : member.status === 'rejected'
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : member.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-green-100 text-green-800 border border-green-200'
                              }`}>
                              {member.role === 'admin' ? 'Admin' : member.status === 'pending' ? 'Pending' : 'Member'}
                            </span>
                            {groups.find(g => g._id === showAddMember)?.user_role === 'admin' &&
                              member.role !== 'admin' &&
                              member.user_id !== currentUserId && (
                                <button
                                  onClick={() => removeMember(showAddMember, member.user._id)}
                                  className="text-red-600 hover:text-red-800 text-sm bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                                  disabled={member.status === 'pending'}
                                >
                                  {member.status === 'pending' ? 'Pending' : 'Remove'}
                                </button>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Group Profile Modal */}
      {showGroupProfile && selectedGroupForProfile && (
        <GroupProfileModal
          groupId={selectedGroupForProfile._id}
          isOpen={showGroupProfile}
          onClose={() => {
            setShowGroupProfile(false);
            setSelectedGroupForProfile(null);
          }}
          groupData={selectedGroupForProfile}
          currentUserId={currentUserId}
          socket={socket}
        />
      )}
    </div>
  );
}