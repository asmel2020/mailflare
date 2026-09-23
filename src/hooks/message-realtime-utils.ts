import type { NewMessageEvent } from "./message-realtime-types";

export const REALTIME_FALLBACK_INTERVAL_MS = 60_000;
export const REALTIME_HEARTBEAT_INTERVAL_MS = 25_000;
export const REALTIME_RECONNECT_MAX_MS = 30_000;

export function getRealtimeWebSocketUrl(): string {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/api/realtime`;
}

export function getReconnectDelay(attempt: number): number {
	return Math.min(1_000 * 2 ** attempt, REALTIME_RECONNECT_MAX_MS);
}

export function parseNewMessageEvent(value: string): NewMessageEvent | null {
	try {
		const payload = JSON.parse(value) as Partial<NewMessageEvent>;
		if (
			payload.type !== "new_message" ||
			typeof payload.messageId !== "string" ||
			typeof payload.mailboxId !== "string" ||
			typeof payload.from !== "string"
		) {
			return null;
		}

		return {
			type: "new_message",
			messageId: payload.messageId,
			mailboxId: payload.mailboxId,
			from: payload.from,
			fromName: typeof payload.fromName === "string" ? payload.fromName : null,
			subject: typeof payload.subject === "string" ? payload.subject : null,
		};
	} catch {
		return null;
	}
}

/**
 * Short two-tone chime via Web Audio — no asset file required.
 * OS-level alerts are handled by the service worker Web Push path.
 */
export function playNewMessageSound(): void {
	if (typeof window === "undefined") return;
	if (document.visibilityState !== "visible") return;

	try {
		const AudioContextCtor =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!AudioContextCtor) return;

		const context = new AudioContextCtor();
		const now = context.currentTime;
		const gain = context.createGain();
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
		gain.connect(context.destination);

		const tones = [
			{ freq: 880, start: 0, duration: 0.15 },
			{ freq: 1174.66, start: 0.14, duration: 0.2 },
		];
		for (const tone of tones) {
			const oscillator = context.createOscillator();
			oscillator.type = "sine";
			oscillator.frequency.setValueAtTime(tone.freq, now + tone.start);
			oscillator.connect(gain);
			oscillator.start(now + tone.start);
			oscillator.stop(now + tone.start + tone.duration);
		}

		window.setTimeout(() => void context.close(), 600);
	} catch {
		// autoplay may be blocked until first gesture — ignore
	}
}
