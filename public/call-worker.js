// This runs once globally across all tabs
const connections = new Map();
let activeCall = null;
let incomingCall = null;

self.onconnect = function(event) {
  const port = event.ports[0];
  const tabId = Date.now() + Math.random().toString(36);
  
  connections.set(tabId, port);
  
  port.postMessage({
    type: 'init',
    tabId,
    activeCall,
    incomingCall
  });
  
  port.onmessage = function(event) {
    const { type, data } = event.data;
    
    switch(type) {
      case 'call_incoming':
        // Only forward to other tabs
        incomingCall = data;
        connections.forEach((p, id) => {
          if (id !== tabId) {
            p.postMessage({ type: 'call_incoming', data });
          }
        });
        break;
        
      case 'call_accepted':
        activeCall = data;
        incomingCall = null;
        // Forward to all tabs
        connections.forEach(p => {
          p.postMessage({ type: 'call_accepted', data });
        });
        break;
        
      case 'call_ended':
        activeCall = null;
        incomingCall = null;
        connections.forEach(p => {
          p.postMessage({ type: 'call_ended', data });
        });
        break;
        
      case 'tab_active':
        // Mark this as active tab
        connections.forEach((p, id) => {
          p.postMessage({ 
            type: 'tab_status', 
            data: { tabId: id, isActive: id === tabId } 
          });
        });
        break;
        
      case 'heartbeat':
        // Keep connection alive
        port.postMessage({ type: 'heartbeat_ack' });
        break;
    }
  };
  
  port.onmessageerror = function(error) {
    console.error('SharedWorker message error:', error);
  };
};

// Clean up disconnected tabs
setInterval(() => {
  connections.forEach((port, tabId) => {
    port.postMessage({ type: 'ping' });
  });
}, 30000);