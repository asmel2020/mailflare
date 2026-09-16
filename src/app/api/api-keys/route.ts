import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { generateApiKey, scopesToJson } from "@/lib/api-keys";
import { allowedRecipientsToJson, parseAllowedRecipients } from "@/lib/api/allowlist";
import { newId } from "@/lib/ids";
import { allowedRecipientSchema } from "@/lib/validators";

const createKeySchema = z.object({
	name: z.string().min(1),
	scopes: z.array(z.enum(["send", "read", "jmap"])).min(1),
	allowedRecipients: z.array(allowedRecipientSchema).max(200).optional(),
});

export async function GET(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const db = getDb(env);

	// An administrator may inspect the keys of accounts they created.
	const requestedUserId = new URL(request.url).searchParams.get("userId");
	let ownerId = user.id;
	if (requestedUserId && requestedUserId !== user.id) {
		if (user.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		const [target] = await db
			.select({ createdByUserId: users.createdByUserId })
			.from(users)
			.where(eq(users.id, requestedUserId))
			.limit(1);
		if (!target || target.createdByUserId !== user.id) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		ownerId = requestedUserId;
	}

	const rows = await db
		.select({
			id: apiKeys.id,
			userId: apiKeys.userId,
			name: apiKeys.name,
			prefix: apiKeys.prefix,
			scopes: apiKeys.scopes,
			allowedRecipients: apiKeys.allowedRecipients,
			createdAt: apiKeys.createdAt,
			lastUsedAt: apiKeys.lastUsedAt,
		})
		.from(apiKeys)
		.where(eq(apiKeys.userId, ownerId));
	return NextResponse.json({
		apiKeys: rows.map((row) => ({ ...row, allowedRecipients: parseAllowedRecipients(row.allowedRecipients) })),
	});
}

export async function POST(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const parsed = createKeySchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const { fullKey, prefix, hash } = generateApiKey();
	const db = getDb(env);
	const id = newId("key");
	await db.insert(apiKeys).values({
		id,
		userId: user.id,
		name: parsed.data.name,
		prefix,
		keyHash: hash,
		scopes: scopesToJson(parsed.data.scopes),
		allowedRecipients: allowedRecipientsToJson(parsed.data.allowedRecipients),
	});

	return NextResponse.json({ id, name: parsed.data.name, prefix, key: fullKey });
}
