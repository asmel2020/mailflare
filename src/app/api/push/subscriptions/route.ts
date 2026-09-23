import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { ZodError, z } from "zod";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireSessionUser } from "@/lib/api/auth";
import { getEnv } from "@/lib/cloudflare";
import { newId } from "@/lib/ids";
import { isPushConfigured } from "@/lib/push/vapid-utils";

const subscriptionSchema = z.object({
	endpoint: z.string().url().max(2048),
	keys: z.object({
		p256dh: z.string().min(1).max(512),
		auth: z.string().min(1).max(512),
	}),
	userAgent: z.string().max(512).optional(),
});

export async function GET(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;

	const rows = await getDb(env)
		.select({ endpoint: pushSubscriptions.endpoint })
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, auth.user.id));

	return NextResponse.json({
		hasVapid: isPushConfigured(env),
		subscriptionCount: rows.length,
		endpoints: rows.map((row) => row.endpoint),
	});
}

export async function POST(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;

	if (!isPushConfigured(env)) {
		const t = await getTranslations("errors");
		return NextResponse.json({ error: t("pushNotConfigured") }, { status: 503 });
	}

	const t = await getTranslations("errors");
	let input: z.infer<typeof subscriptionSchema>;
	try {
		input = subscriptionSchema.parse(await request.json());
	} catch (error) {
		if (error instanceof ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: t("invalidRequest") }, { status: 400 });
	}

	const db = getDb(env);
	const existing = await db
		.select({ id: pushSubscriptions.id })
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.endpoint, input.endpoint))
		.limit(1);

	if (existing[0]) {
		await db
			.update(pushSubscriptions)
			.set({
				userId: auth.user.id,
				p256dh: input.keys.p256dh,
				auth: input.keys.auth,
				userAgent: input.userAgent ?? null,
				lastUsedAt: new Date(),
			})
			.where(eq(pushSubscriptions.id, existing[0].id));
		return NextResponse.json({ ok: true, id: existing[0].id }, { status: 200 });
	}

	const id = newId("push");
	await db.insert(pushSubscriptions).values({
		id,
		userId: auth.user.id,
		endpoint: input.endpoint,
		p256dh: input.keys.p256dh,
		auth: input.keys.auth,
		userAgent: input.userAgent ?? null,
	});

	return NextResponse.json({ ok: true, id }, { status: 201 });
}

export async function DELETE(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;

	let body: { endpoint?: string };
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const db = getDb(env);
	if (typeof body.endpoint === "string" && body.endpoint) {
		await db
			.delete(pushSubscriptions)
			.where(eq(pushSubscriptions.endpoint, body.endpoint));
		return NextResponse.json({ ok: true });
	}

	await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, auth.user.id));
	return NextResponse.json({ ok: true });
}
