// Service Worker for cross-tab coordination
let activeTabId = null;
const openTabs = new Set();

self.addEventListener("message", (event) => {
  const { type, data, tabId } = event.data;

  switch (type) {
    case "register_tab":
      openTabs.add(tabId);
      console.log(`📱 Tab registered: ${tabId}, total: ${openTabs.size}`);
      break;

    case "unregister_tab":
      openTabs.delete(tabId);
      console.log(`📱 Tab unregistered: ${tabId}, remaining: ${openTabs.size}`);
      break;

    case "call_incoming":
      // Forward call to all tabs except sender
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          if (client._id !== tabId) {
            client.postMessage({
              type: "INCOMING_CALL",
              data: data,
            });
          }
        });
      });
      break;

    case "call_answered":
      // Notify all tabs that call was answered
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "CALL_ANSWERED",
            data: data,
          });
        });
      });
      break;
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const callData = event.notification.data;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Focus an existing chat window
        for (const client of windowClients) {
          if (client.url.includes("/chat")) {
            client.focus();
            client.postMessage({
              type: "FOCUS_CALL",
              data: callData,
            });
            return;
          }
        }

        // Open new window if none exists
        return self.clients.openWindow(
          `/chat/${callData.chatType}/${callData.chatId}`,
        );
      }),
  );
});
