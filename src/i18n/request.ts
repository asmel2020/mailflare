import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { LOCALE_COOKIE, defaultLocale, normalizeLocale, type Locale } from "./config";

const catalogs: Record<Locale, typeof en> = { en, es };

/** The single-row id used by the app settings table. */
const APP_SETTINGS_ID = "default";

async function getAppDefaultLocale(): Promise<Locale | null> {
	try {
		const [settings] = await getDb(getEnv())
			.select({ defaultLocale: appSettings.defaultLocale })
			.from(appSettings)
			.where(eq(appSettings.id, APP_SETTINGS_ID))
			.limit(1);
		return normalizeLocale(settings?.defaultLocale);
	} catch {
		return null;
	}
}

/**
 * Resolution order: explicit picker choice (cookie) → signed-in user's saved
 * preference → site default set by an admin → the browser's Accept-Language.
 * Every step is defensive because this also runs while prerendering, where
 * cookies, headers, and Cloudflare bindings are unavailable.
 */
async function resolveLocale(): Promise<Locale> {
	try {
		const jar = await cookies();
		const fromCookie = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
		if (fromCookie) return fromCookie;
	} catch {
		// Not in a request context.
	}

	try {
		const user = await getCurrentUser(getEnv());
		const fromUser = normalizeLocale(user?.locale);
		if (fromUser) return fromUser;
	} catch {
		// Signed out, or no request context.
	}

	const fromSettings = await getAppDefaultLocale();
	if (fromSettings) return fromSettings;

	try {
		const header = (await headers()).get("accept-language");
		for (const part of (header ?? "").split(",")) {
			const candidate = normalizeLocale(part.split(";")[0]);
			if (candidate) return candidate;
		}
	} catch {
		// No header available.
	}

	return defaultLocale;
}

export default getRequestConfig(async () => {
	const locale = await resolveLocale();
	return { locale, messages: catalogs[locale] };
});
