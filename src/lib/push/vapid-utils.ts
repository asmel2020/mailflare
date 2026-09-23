import type { VapidKeys } from "@block65/webcrypto-web-push";

function decodeBase64Url(value: string): Uint8Array {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Web Push needs the raw 65-byte uncompressed point, but openssl-style tooling
 * emits SPKI DER. Accept either and normalise to raw so a DER key does not
 * surface as an opaque `InvalidAccessError` in the browser.
 */
function normalizePublicKey(value: string): string {
	const bytes = decodeBase64Url(value);
	if (bytes.length === 65 && bytes[0] === 0x04) return value;
	if (bytes.length > 65) return encodeBase64Url(bytes.slice(bytes.length - 65));
	return value;
}

/**
 * The signing library writes the key straight into a JWK `d`, which must be the
 * raw 32-byte scalar; PKCS8 DER wraps it as a 32-byte OCTET STRING.
 */
function normalizePrivateKey(value: string): string {
	const bytes = decodeBase64Url(value);
	if (bytes.length === 32) return value;
	if (bytes.length > 32) {
		for (let i = 0; i < bytes.length - 33; i += 1) {
			if (bytes[i] === 0x04 && bytes[i + 1] === 0x20) {
				return encodeBase64Url(bytes.slice(i + 2, i + 34));
			}
		}
	}
	return value;
}

export function getVapidKeys(env: CloudflareEnv): VapidKeys | null {
	const publicKey = env.VAPID_PUBLIC_KEY?.trim();
	const privateKey = env.VAPID_PRIVATE_KEY?.trim();
	if (!publicKey || !privateKey) return null;

	return {
		subject: env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost",
		publicKey: normalizePublicKey(publicKey),
		privateKey: normalizePrivateKey(privateKey),
	};
}

export function isPushConfigured(env: CloudflareEnv): boolean {
	return getVapidKeys(env) !== null;
}
