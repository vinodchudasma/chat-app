// utils/socket.js
const setupWebSocket = () => {
  const socket = new WebSocket(process.env.REACT_APP_WS_URL || 'ws://localhost:3001');
  
  socket.onopen = () => {
    console.log('WebSocket connected');
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  socket.onclose = () => {
    console.log('WebSocket disconnected');
  };
  
  return socket;
};