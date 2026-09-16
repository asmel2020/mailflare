import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getDb, type AppDatabase } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { allowedRecipientsToJson } from "@/lib/api/allowlist";
import { requireSessionUser } from "@/lib/api/auth";
import { getEnv } from "@/lib/cloudflare";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { updateApiKeySchema } from "@/lib/validators";
import type { ApiKeyRouteParams } from "./types";

/**
 * A key can be managed by its owner, or by the administrator who created the
 * owner's account (so an admin can revoke a key handed to an agent).
 */
async function canManageKey(db: AppDatabase, managerId: string, managerRole: string, ownerId: string): Promise<boolean> {
	if (managerId === ownerId) return true;
	if (managerRole !== "admin") return false;
	const [owner] = await db
		.select({ createdByUserId: users.createdByUserId })
		.from(users)
		.where(eq(users.id, ownerId))
		.limit(1);
	return owner?.createdByUserId === managerId;
}

export async function PATCH(request: Request, { params }: ApiKeyRouteParams) {
	const { id } = await params;
	const env = getEnv();
	const t = await getTranslations("errors");
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;

	const parsed = updateApiKeySchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const db = getDb(env);
	const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
	if (!key) return NextResponse.json({ error: t("notFound") }, { status: 404 });
	if (!(await canManageKey(db, auth.user!.id, auth.user!.role, key.userId))) {
		return NextResponse.json({ error: t("forbidden") }, { status: 403 });
	}

	await db
		.update(apiKeys)
		.set({
			...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
			...(parsed.data.allowedRecipients !== undefined
				? { allowedRecipients: allowedRecipientsToJson(parsed.data.allowedRecipients) }
				: {}),
		})
		.where(eq(apiKeys.id, id));

	await createAuditLog(env, {
		actorUserId: auth.user!.id,
		targetUserId: key.userId,
		action: "account.api_key_updated",
		metadata: { keyId: id },
	});

	return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: ApiKeyRouteParams) {
	const { id } = await params;
	const env = getEnv();
	const t = await getTranslations("errors");
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;

	const db = getDb(env);
	const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
	if (!key) return NextResponse.json({ error: t("notFound") }, { status: 404 });
	if (!(await canManageKey(db, auth.user!.id, auth.user!.role, key.userId))) {
		return NextResponse.json({ error: t("forbidden") }, { status: 403 });
	}

	await db.delete(apiKeys).where(eq(apiKeys.id, id));
	await createAuditLog(env, {
		actorUserId: auth.user!.id,
		targetUserId: key.userId,
		action: "account.api_key_revoked",
		metadata: { keyId: id, prefix: key.prefix },
	});

	return NextResponse.json({ ok: true });
}
