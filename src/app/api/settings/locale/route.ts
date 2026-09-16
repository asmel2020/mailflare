import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { normalizeLocale } from "@/i18n/config";

export async function PUT(request: Request) {
	const env = getEnv();
	const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
	const locale = normalizeLocale(typeof body?.locale === "string" ? body.locale : null);
	if (!locale) {
		return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
	}

	// Visitors who are not signed in still keep the choice in the cookie the
	// picker sets client-side; there is nothing to persist server-side for them.
	const user = await getCurrentUser(env, request);
	if (user) {
		await getDb(env).update(users).set({ locale }).where(eq(users.id, user.id));
	}

	return NextResponse.json({ locale });
}
