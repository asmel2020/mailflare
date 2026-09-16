import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { hasAdminAccount } from "@/lib/auth/setup";
import { getEnv } from "@/lib/cloudflare";
import { preflightDomain } from "@/lib/domains/preflight";
import { getPrimaryDomain } from "@/lib/user";
import { setupDomainSchema } from "@/lib/validators";
import { readJsonBody } from "@/lib/http/request";
import { RequestBodyTooLargeError } from "@/lib/http/errors";

export async function POST(request: Request) {
	const env = getEnv();
	const t = await getTranslations("errors");
	if (await hasAdminAccount(env)) {
		return NextResponse.json({ error: t("setupAlreadyComplete") }, { status: 403 });
	}

	const existing = await getPrimaryDomain(env);
	if (existing) {
		return NextResponse.json({ error: t("primaryDomainExists") }, { status: 409 });
	}

	let body: unknown;
	try {
		body = await readJsonBody(request, 16 * 1024);
	} catch (error) {
		const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
		return NextResponse.json({ error: t("invalidSetupRequest") }, { status });
	}
	const parsed = setupDomainSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	try {
		return NextResponse.json({ domain: await preflightDomain(env, parsed.data.hostname) });
	} catch (err) {
		const message = err instanceof Error ? err.message : t("domainCheckFailed");
		return NextResponse.json({ error: message }, { status: 502 });
	}
}
