import type { VapidKeys } from "@block65/webcrypto-web-push";

export function getVapidKeys(env: CloudflareEnv): VapidKeys | null {
	const publicKey = env.VAPID_PUBLIC_KEY?.trim();
	const privateKey = env.VAPID_PRIVATE_KEY?.trim();
	if (!publicKey || !privateKey) return null;

	return {
		subject: env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost",
		publicKey,
		privateKey,
	};
}

export function isPushConfigured(env: CloudflareEnv): boolean {
	return getVapidKeys(env) !== null;
}
