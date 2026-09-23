"use client";

export type PushUiState =
	| "unsupported"
	| "loading"
	| "unconfigured"
	| "default"
	| "denied"
	| "enabled"
	| "error";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i += 1) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

export function isPushSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		"serviceWorker" in navigator &&
		"Notification" in window &&
		"PushManager" in window
	);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (!isPushSupported()) return null;
	if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
		return null;
	}
	try {
		const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
		return registration;
	} catch (error) {
		console.error("Service worker registration failed", error);
		return null;
	}
}

export async function getVapidPublicKey(): Promise<string | null> {
	try {
		const response = await fetch("/api/push/vapid-public-key", { credentials: "same-origin" });
		if (!response.ok) return null;
		const data = (await response.json()) as { publicKey?: string };
		return data.publicKey ?? null;
	} catch {
		return null;
	}
}

export async function getActiveSubscription(): Promise<PushSubscription | null> {
	const registration = await navigator.serviceWorker.ready;
	return registration.pushManager.getSubscription();
}

export async function enablePushNotifications(): Promise<void> {
	if (!isPushSupported()) throw new Error("unsupported");

	const permission = await Notification.requestPermission();
	if (permission !== "granted") {
		throw new Error(permission === "denied" ? "denied" : "dismissed");
	}

	const registration = await registerServiceWorker();
	if (!registration) throw new Error("sw-failed");

	const existing = await registration.pushManager.getSubscription();
	if (existing) {
		await syncSubscription(existing);
		return;
	}

	const publicKey = await getVapidPublicKey();
	if (!publicKey) throw new Error("unconfigured");

	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
	});
	await syncSubscription(subscription);
}

export async function disablePushNotifications(): Promise<void> {
	if (!isPushSupported()) return;
	const registration = await navigator.serviceWorker.getRegistration();
	if (!registration) return;
	const subscription = await registration.pushManager.getSubscription();
	if (!subscription) return;

	const endpoint = subscription.endpoint;
	await subscription.unsubscribe();
	await fetch("/api/push/subscriptions", {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		credentials: "same-origin",
		body: JSON.stringify({ endpoint }),
	});
}

async function syncSubscription(subscription: PushSubscription): Promise<void> {
	const json = subscription.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
		throw new Error("invalid-subscription");
	}
	const response = await fetch("/api/push/subscriptions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "same-origin",
		body: JSON.stringify({
			endpoint: json.endpoint,
			keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
			userAgent: navigator.userAgent,
		}),
	});
	if (!response.ok) {
		const data = (await response.json().catch(() => ({}))) as { error?: string };
		throw new Error(data.error || "save-failed");
	}
}

export async function getPushUiState(): Promise<PushUiState> {
	if (!isPushSupported()) return "unsupported";

	try {
		const statusResponse = await fetch("/api/push/status", { credentials: "same-origin" });
		if (statusResponse.status === 401) return "default";
		if (statusResponse.ok) {
			const status = (await statusResponse.json()) as { hasVapid?: boolean };
			if (status.hasVapid === false) return "unconfigured";
		}
	} catch {
		// still try local permission state
	}

	if (Notification.permission === "denied") return "denied";
	if (Notification.permission === "granted") {
		const subscription = await getActiveSubscription();
		if (subscription) return "enabled";
	}
	return Notification.permission === "granted" ? "default" : "default";
}

export async function ensurePushResubscribed(): Promise<void> {
	if (!isPushSupported() || Notification.permission !== "granted") return;
	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		if (subscription) {
			await syncSubscription(subscription);
			return;
		}
		const publicKey = await getVapidPublicKey();
		if (!publicKey) return;
		const next = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
		});
		await syncSubscription(next);
	} catch {
		// ignore — next user gesture will retry
	}
}
