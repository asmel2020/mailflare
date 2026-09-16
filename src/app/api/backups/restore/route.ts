import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { assertAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/cookies";
import { restoreDatabaseRecords } from "@/lib/backups/export";
import { getEnv } from "@/lib/cloudflare";

export async function POST(request: Request) {
	const env = getEnv();
	const t = await getTranslations("errors");
	try {
		const user = await requireUser(env, request);
		assertAdmin(user);
		const form = await request.formData();
		const file = form.get("backup");
		if (!(file instanceof File)) return NextResponse.json({ error: t("chooseBackupFile") }, { status: 400 });
		await restoreDatabaseRecords(env.DB, await file.arrayBuffer());
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : t("backupRestoreFailed");
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
