/* Mailflare service worker: Web Push notifications only (no offline shell). */

// Workers assets redirect /offline.html to /offline, so cache the canonical URL.
const OFFLINE_URL = "/offline";
const OFFLINE_CACHE = "mailflare-offline-v1";

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			try {
				const cache = await caches.open(OFFLINE_CACHE);
				await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
			} catch {
				// The offline page is best-effort; install must still succeed.
			}
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

// Chrome's install-prompt algorithm requires a service worker with a real
// fetch handler. Only navigations are intercepted; everything else passes
// through untouched so the app behaves exactly as before when online.
self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET" || request.mode !== "navigate") return;

	event.respondWith(
		(async () => {
			try {
				return await fetch(request);
			} catch {
				const cache = await caches.open(OFFLINE_CACHE);
				const cached = await cache.match(OFFLINE_URL);
				if (cached) return cached;
				return new Response("Offline", {
					status: 503,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}
		})(),
	);
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
