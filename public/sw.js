/* Mailflare service worker: Web Push notifications only (no offline shell). */

self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
	if (!event.data) return;

	let payload = {};
	try {
		payload = event.data.json();
	} catch {
		payload = { title: "New email", body: event.data.text() };
	}

	const title = payload.title || "New email";
	const options = {
		body: payload.body || "",
		icon: "/icon-192.png",
		badge: "/icon-48.png",
		tag: payload.tag || "mailflare-new-message",
		renotify: true,
		data: { url: payload.url || "/inbox" },
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = (event.notification.data && event.notification.data.url) || "/inbox";

	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if ("focus" in client) {
					client.focus();
					if ("navigate" in client && "url" in client && client.url) {
						try {
							const target = new URL(url, self.location.origin);
							const origin = new URL(client.url).origin;
							if (target.origin === origin) {
								return client.navigate(target.href);
							}
						} catch {
							return client.focus();
						}
					}
					return;
				}
			}
			return self.clients.openWindow(url);
		}),
	);
});

self.addEventListener("pushsubscriptionchange", (event) => {
	// Best-effort: the page re-subscribes on next load if this fails.
	event.waitUntil(
		self.registration.pushManager
			.getSubscription()
			.then((subscription) => {
				if (!subscription) return;
				return fetch("/api/push/subscriptions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						endpoint: subscription.endpoint,
						keys: subscription.toJSON().keys,
						userAgent: navigator.userAgent,
					}),
					credentials: "same-origin",
				}).catch(() => {});
			})
			.catch(() => {}),
	);
});
