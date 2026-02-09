import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { socketService } from "../lib/socket";

export const useSocket = () => {
  const { getToken, userId, isLoaded } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const eventHandlers = useRef(new Map());
  const isConnecting = useRef(false);
  const heartbeatIntervalRef = useRef(null);
  const monitorIntervalRef = useRef(null);
  const hasConnected = useRef(false);

  const setupHeartbeatHandlers = useCallback((socketInstance) => {
    // Heartbeat handlers
    const handleHeartbeatPing = () => {
      //  console.log('💓 Received heartbeat ping from server');
      setLastHeartbeat(Date.now());

      // Respond to server heartbeat
      socketInstance.emit("heartbeat_pong", {
        timestamp: Date.now(),
        clientId: socketInstance._id,
      });
    };

    const handleHeartbeatAck = () => {
      // console.log(' Heartbeat acknowledged by server');
      setLastHeartbeat(Date.now());
    };

    const handleConnectionCheck = () => {
      // console.log('🔍 Server checking connection');
      setLastHeartbeat(Date.now());

      // Respond to connection check
      socketInstance.emit("heartbeat_pong", {
        timestamp: Date.now(),
        clientId: socketInstance._id,
      });
    };

    const handleReconnectSuggested = (data) => {
      // console.log('🔄 Server suggests reconnection:', data);
      // Reconnect after delay
      setTimeout(() => {
        if (socketInstance && socketInstance.connected) {
          socketInstance.io.reconnect();
        }
      }, 2000);
    };

    // Register heartbeat handlers
    socketInstance.on("heartbeat_ping", handleHeartbeatPing);
    socketInstance.on("heartbeat_ack", handleHeartbeatAck);
    socketInstance.on("connection_check", handleConnectionCheck);
    socketInstance.on("reconnect_suggested", handleReconnectSuggested);

    // Store for cleanup
    eventHandlers.current.set("heartbeat_ping", handleHeartbeatPing);
    eventHandlers.current.set("heartbeat_ack", handleHeartbeatAck);
    eventHandlers.current.set("connection_check", handleConnectionCheck);
    eventHandlers.current.set("reconnect_suggested", handleReconnectSuggested);
  }, []);

  const setupBasicHandlers = useCallback((socketInstance) => {
    const handleConnect = () => {
      // console.log(' useSocket: Socket connected');
      setIsConnected(true);
      setConnectionError(null);
      isConnecting.current = false;
      setLastHeartbeat(Date.now());
      hasConnected.current = true;
    };

    const handleDisconnect = (reason) => {
      // console.log('🔌 useSocket: Socket disconnected:', reason);
      setIsConnected(false);
      isConnecting.current = false;
    };

    const handleConnectError = (error) => {
      //console.error(' useSocket: Socket connection error:', error.message);
      setConnectionError(error.message);
      setIsConnected(false);
      isConnecting.current = false;
    };

    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);
    socketInstance.on("connect_error", handleConnectError);

    // Store handlers for cleanup
    eventHandlers.current.set("connect", handleConnect);
    eventHandlers.current.set("disconnect", handleDisconnect);
    eventHandlers.current.set("connect_error", handleConnectError);
  }, []);

  const connectSocket = useCallback(async () => {
    if (isConnecting.current || hasConnected.current) return;

    isConnecting.current = true;
    setConnectionError(null);

    try {
      //  console.log('🔄 Starting socket connection...');
      const token = await getToken();

      if (!token) {
        throw new Error("No authentication token available");
      }

      //  console.log('🔑 Token acquired, connecting socket...');
      const socketInstance = socketService.connect(token);

      if (!socketInstance) {
        throw new Error("Failed to create socket instance");
      }

      setSocket(socketInstance);

      // Set up all event listeners
      setupBasicHandlers(socketInstance);
      setupHeartbeatHandlers(socketInstance);

      // Clear any existing intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }

      // Start client-side periodic heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        if (socketInstance && socketInstance.connected) {
          // Send client-initiated heartbeat
          socketInstance.emit("heartbeat", {
            timestamp: Date.now(),
            clientId: socketInstance._id,
          });
          // console.log('💓 Client heartbeat sent');
        }
      }, 30000); // Every 30 seconds

      // Monitor connection health
      monitorIntervalRef.current = setInterval(() => {
        if (lastHeartbeat && Date.now() - lastHeartbeat > 120000) {
          // 2 minutes
          // console.log('⚠️ No heartbeat from server, checking connection...');
          if (socketInstance && socketInstance.connected) {
            socketInstance.emit("ping", {}, (response) => {
              if (response) {
                // console.log(' Connection check successful');
                setLastHeartbeat(Date.now());
              }
            });
          }
        }
      }, 60000); // Check every minute
    } catch (error) {
      //  console.error(' useSocket: Connection setup error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      isConnecting.current = false;

      // Clear intervals on error
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }
    }
  }, [getToken, setupBasicHandlers, setupHeartbeatHandlers, lastHeartbeat]);

  // Connect on mount and when user changes
  useEffect(() => {
    if (isLoaded && userId && !hasConnected.current) {
      //console.log('👤 User loaded, connecting socket...');
      connectSocket();
    }

    return () => {
      // Don't cleanup here - let the cleanup effect handle it
    };
  }, [isLoaded, userId, connectSocket]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      //console.log('🧹 Cleaning up socket connection (unmount)');

      // Clear intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }

      // Remove all event listeners
      const currentSocket = socketService.getSocket();
      if (currentSocket) {
        eventHandlers.current.forEach((handler, event) => {
          currentSocket.off(event, handler);
        });
      }

      eventHandlers.current.clear();

      // Only disconnect if we're actually unmounting
      socketService.disconnect();
      setSocket(null);
      setIsConnected(false);
      isConnecting.current = false;
      hasConnected.current = false;
    };
  }, []); // Empty dependency array - only runs on unmount

  const on = useCallback(
    (event, callback) => {
      if (socket) {
        socket.on(event, callback);
        eventHandlers.current.set(event, callback);
      }
    },
    [socket],
  );

  const off = useCallback(
    (event) => {
      if (socket) {
        socket.off(event);
        eventHandlers.current.delete(event);
      }
    },
    [socket],
  );

  const emit = useCallback(
    (event, data) => {
      if (socket && isConnected) {
        console.log(`📤 Emitting event: ${event}`, data);

        try {
          socket.emit(event, data);
          // Update last heartbeat on any activity
          setLastHeartbeat(Date.now());
          return true;
        } catch (error) {
          console.error(` Error emitting event ${event}:`, error);
          return false;
        }
      } else {
        console.warn(`⚠️ Socket not connected, cannot emit event: ${event}`);
        return false;
      }
    },
    [socket, isConnected],
  );

  const reconnect = useCallback(() => {
    console.log("🔄 Manual reconnection requested");
    setConnectionError(null);
    hasConnected.current = false;

    // Clear existing intervals
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }

    // Clear event listeners
    const currentSocket = socketService.getSocket();
    if (currentSocket) {
      eventHandlers.current.forEach((handler, event) => {
        currentSocket.off(event, handler);
      });
      eventHandlers.current.clear();
    }

    // Disconnect and reconnect
    socketService.disconnect();
    setSocket(null);
    setIsConnected(false);
    isConnecting.current = false;

    // Reconnect after a short delay
    setTimeout(() => {
      connectSocket();
    }, 1000);
  }, [connectSocket]);

  return {
    socket,
    isConnected,
    connectionError,
    lastHeartbeat,
    emit,
    on,
    off,
    reconnect,
  };
};
