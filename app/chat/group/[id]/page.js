"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import ChatWindow from "@/components/ChatWindow";
import { chatAPI } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function PrivateChatPage() {
  const params = useParams();
  const { getToken, userId } = useAuth();
  const { socket, isConnected } = useSocket();
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const loadChat = async () => {
      try {
        const chatId = params._id;
        const response = await chatAPI.getChatDetails(chatId);
        setChat(response.data);
      } catch (error) {
        console.error("Error loading chat:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params._id) {
      loadChat();
    }
  }, [params._id]);

  useEffect(() => {
    const loadUser = async () => {
      if (userId) {
        const token = await getToken();
        const response = await userAPI.getProfile();
        if (response?.data?._id) {
          setCurrentUserId(response.data._id);
        }
      }
    };
    loadUser();
  }, [userId, getToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Chat not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <ChatWindow
        chat={chat}
        socket={socket}
        isConnected={isConnected}
        currentUserId={currentUserId}
        standalone={true}
      />
    </div>
  );
}
