import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getEnv } from "@/lib/cloudflare";
import { requireUser } from "@/lib/auth/cookies";
import { getDomainForUser, removeDomainForUser } from "@/lib/domains/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const domain = await getDomainForUser(env, user.id, id);
	const t = await getTranslations("errors");
	if (!domain) return NextResponse.json({ error: t("notFound") }, { status: 404 });
	return NextResponse.json({ domain });
}

export async function DELETE(request: Request, { params }: Params) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const t = await getTranslations("errors");
	try {
		await removeDomainForUser(env, user.id, id);
		return NextResponse.json({ ok: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : t("failedToRemoveDomain");
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
