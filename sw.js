self.addEventListener("install", () => self.skipWaiting());self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));// Tik op de melding → app naar de voorgrond halen (of openen)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("./");
    })
  );
});
