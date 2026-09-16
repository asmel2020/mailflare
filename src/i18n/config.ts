/**
 * Supported UI languages. `en` is the source language for every message
 * catalog; add a locale here and a matching `messages/<locale>.json` to ship it.
 */
export const locales = ["en", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie the language picker writes so signed-out visitors keep their choice. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Endonyms, shown untranslated in the picker. */
export const localeLabels: Record<Locale, string> = {
	en: "English",
	es: "Español",
};

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Accepts a full tag ("es-MX") and falls back to its base language. */
export function normalizeLocale(value: string | null | undefined): Locale | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	if (isLocale(normalized)) return normalized;
	const base = normalized.split("-")[0];
	return isLocale(base) ? base : null;
}
