import { getEmailAddressList, normalizeEmailAddress } from "@/lib/email/address";

/**
 * Recipient allow-list for an API key. Patterns are matched case-insensitively:
 * - `maya@example.com` — one exact address
 * - `@example.com` or `example.com` — any address on that domain
 * - `*` — anyone (same as leaving the list empty)
 */
export function parseAllowedRecipients(value: string | null | undefined): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((entry): entry is string => typeof entry === "string")
			.map((entry) => entry.trim().toLowerCase())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/** Stores the patterns as JSON; null/empty means "no restriction". */
export function allowedRecipientsToJson(patterns: string[] | null | undefined): string | null {
	if (!patterns) return null;
	const cleaned = Array.from(new Set(patterns.map((pattern) => pattern.trim().toLowerCase()).filter(Boolean)));
	return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

function domainOf(pattern: string): string | null {
	const value = pattern.trim().toLowerCase();
	if (!value) return null;
	if (value.startsWith("@")) return value.slice(1);
	return value.includes("@") ? null : value;
}

export function isRecipientAllowed(patterns: string[], address: string): boolean {
	// An empty list means the key may send to anyone.
	if (patterns.length === 0) return true;
	const normalized = normalizeEmailAddress(address);
	if (!normalized) return false;
	for (const pattern of patterns) {
		if (pattern === "*") return true;
		if (pattern === normalized) return true;
		const domain = domainOf(pattern);
		if (domain && normalized.endsWith(`@${domain}`)) return true;
	}
	return false;
}

/** Every address in `to`, `cc` and `bcc` that the allow-list rejects. */
export function findDisallowedRecipients(
	patterns: string[],
	addresses: string[],
): string[] {
	return addresses.filter((address) => !isRecipientAllowed(patterns, address));
}

function listToAddresses(value: string | string[] | null | undefined): string[] {
	if (!value) return [];
	const entries = Array.isArray(value) ? value : getEmailAddressList(value);
	return entries.map((entry) => normalizeEmailAddress(entry)).filter(Boolean);
}

export function collectRecipientAddresses(
	...lists: Array<string | string[] | null | undefined>
): string[] {
	const seen = new Set<string>();
	for (const list of lists) {
		for (const address of listToAddresses(list)) seen.add(address);
	}
	return Array.from(seen);
}
