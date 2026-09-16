import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { backups } from "@/db/schema";
import { assertAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const env = getEnv();
	const t = await getTranslations("errors");
	try {
		const user = await requireUser(env, request);
		assertAdmin(user);
		const { id } = await params;
		const [backup] = await getDb(env).select().from(backups).where(eq(backups.id, id)).limit(1);
		if (!backup?.r2Key) return NextResponse.json({ error: t("backupFileNotFound") }, { status: 404 });
		const object = await env.BUCKET.get(backup.r2Key);
		if (!object) return NextResponse.json({ error: t("backupFileNotFound") }, { status: 404 });
		return new Response(object.body, {
			headers: {
				"Content-Type": "application/sql",
				"Content-Disposition": `attachment; filename="${backup.filename ?? `${backup.id}.sql`}"`,
				"Content-Length": String(object.size),
			},
		});
	} catch {
		return NextResponse.json({ error: t("forbidden") }, { status: 403 });
	}
}
