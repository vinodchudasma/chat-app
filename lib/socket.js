import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10; // Increased
    this.heartbeatInterval = null;
    this.connectionMonitor = null;
    this.lastHeartbeat = Date.now();
  }

  connect(token) {
    // Disconnect existing socket if any
    if (this.socket) {
      this.disconnect();
    }

    try {
      const serverUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

      //console.log('🔌 Connecting to socket server:', serverUrl);

      this.socket = io(serverUrl, {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
        timeout: 30000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,
        withCredentials: true,
        pingTimeout: 60000,
        pingInterval: 25000,
      });

      // Basic event listeners
      this.socket.on("connect", () => this.handleConnect());
      this.socket.on("disconnect", (reason) => this.handleDisconnect(reason));
      this.socket.on("connect_error", (error) =>
        this.handleConnectError(error),
      );
      this.socket.on("reconnect_attempt", (attempt) =>
        this.handleReconnectAttempt(attempt),
      );
      this.socket.on("reconnect", () => this.handleReconnect());
      this.socket.on("reconnect_error", (error) =>
        this.handleReconnectError(error),
      );
      this.socket.on("reconnect_failed", () => this.handleReconnectFailed());

      // Heartbeat handlers
      this.setupHeartbeatHandlers();

      return this.socket;
    } catch (error) {
      console.error(" Error creating socket connection:", error);
      return null;
    }
  }

  setupHeartbeatHandlers() {
    // Listen for server heartbeat ping
    this.socket.on("heartbeat_ping", (data) => {
      //  console.log('💓 Received heartbeat ping from server');
      this.lastHeartbeat = Date.now();

      // Respond immediately
      this.socket.emit("heartbeat_pong", {
        timestamp: Date.now(),
        clientId: this.socket._id,
      });
    });

    this.socket.on("heartbeat_ack", (data) => {
      //console.log(' Heartbeat acknowledged by server');
      this.lastHeartbeat = Date.now();
    });

    this.socket.on("connection_check", (data) => {
      //console.log('🔍 Server checking connection');
      this.lastHeartbeat = Date.now();

      // Respond to connection check
      this.socket.emit("heartbeat_pong", {
        timestamp: Date.now(),
        clientId: this.socket._id,
      });
    });

    this.socket.on("reconnect_suggested", (data) => {
      //console.log('🔄 Server suggests reconnection:', data);
      setTimeout(() => {
        if (this.socket) {
          this.socket.io.reconnect();
        }
      }, 2000);
    });

    this.socket.on("are_you_still_there", (data) => {
      //console.log('👀 Server checking if client is alive');
      this.lastHeartbeat = Date.now();
      this.socket.emit("im_still_here", {
        timestamp: Date.now(),
        socketId: this.socket._id,
      });
    });
  }

  handleConnect() {
    //console.log(' Socket connected successfully');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastHeartbeat = Date.now();
    this.startClientHeartbeat();
  }

  handleDisconnect(reason) {
    // console.log('🔌 Socket disconnected:', reason);
    this.isConnected = false;
    this.stopClientHeartbeat();

    // Auto-reconnect for certain reasons
    if (reason === "io server disconnect" || reason === "transport close") {
      setTimeout(() => {
        if (!this.isConnected && this.socket) {
          console.log("🔄 Auto-reconnecting...");
          this.socket.connect();
        }
      }, 3000);
    }
  }

  handleConnectError(error) {
    //console.error(' Socket connection error:', error.message);
    this.isConnected = false;
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    setTimeout(() => {
      if (!this.isConnected && this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  handleReconnectAttempt(attempt) {
    //  console.log(`🔄 Reconnection attempt ${attempt}`);
  }

  handleReconnect() {
    // console.log(' Socket reconnected successfully');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastHeartbeat = Date.now();
    this.startClientHeartbeat();
  }

  handleReconnectError(error) {
    //console.error(' Socket reconnection error:', error);
  }

  handleReconnectFailed() {
    //console.error(' Socket reconnection failed');
    // Try manual reconnect after delay
    setTimeout(() => {
      if (this.socket && !this.isConnected) {
        console.log("🔄 Manual reconnection attempt...");
        this.socket.connect();
      }
    }, 10000);
  }

  startClientHeartbeat() {
    // Clear existing interval
    this.stopClientHeartbeat();

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit("heartbeat", {
          timestamp: Date.now(),
          clientId: this.socket._id,
        });
        console.log("💓 Client heartbeat sent");
      }
    }, 30000);

    // Monitor connection health
    this.connectionMonitor = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;

      if (timeSinceLastHeartbeat > 120000 && this.isConnected) {
        // 2 minutes
        //  console.log('⚠️ No heartbeat from server for', Math.floor(timeSinceLastHeartbeat / 1000), 'seconds');

        // Send manual heartbeat
        if (this.socket) {
          this.socket.emit("heartbeat", {
            timestamp: Date.now(),
            clientId: this.socket._id,
          });
        }
      }
    }, 60000);
  }

  stopClientHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
      this.connectionMonitor = null;
    }
  }

  disconnect() {
    this.stopClientHeartbeat();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      console.log("🔌 Socket disconnected");
    }
  }

  getSocket() {
    return this.socket;
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      console.log(`📤 Emitting event: ${event}`, data);
      this.socket.emit(event, data);
      this.lastHeartbeat = Date.now();
      return true;
    } else {
      console.warn("⚠️ Socket not connected, cannot emit event:", event);
      return false;
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  waitForConnection() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve(this.socket);
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 30000);

      const onConnect = () => {
        clearTimeout(timeout);
        resolve(this.socket);
      };

      this.socket.once("connect", onConnect);
    });
  }
}

// Create a singleton instance
export const socketService = new SocketService();
