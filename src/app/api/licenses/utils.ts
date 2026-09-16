import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/cookies";
import type { LicenseKeyRequest } from "./types";

const licenseKeySchema = z.object({
	licenseKey: z.string().trim().min(1).max(500),
	plan: z.enum(["pro", "team"]).optional(),
});

export async function requireLicenseAdmin(env: CloudflareEnv, request: Request): Promise<NextResponse | null> {
	const t = await getTranslations("errors");
	try {
		assertAdmin(await requireUser(env, request));
		return null;
	} catch {
		return NextResponse.json({ error: t("forbidden") }, { status: 403 });
	}
}

export async function parseLicenseKeyRequest(request: Request): Promise<LicenseKeyRequest> {
	return licenseKeySchema.parse(await request.json());
}

export function getLicenseInstanceUrl(request: Request): string {
	return new URL(request.url).origin;
}

export async function getLicenseErrorResponse(error: unknown): Promise<NextResponse> {
	const t = await getTranslations("errors");
	if (error instanceof z.ZodError) {
		return NextResponse.json({ error: t("invalidLicenseKey") }, { status: 400 });
	}
	const message = error instanceof Error ? error.message : t("licenseRequestFailed");
	const migrationMissing = /no such table|license_settings/i.test(message);
	return NextResponse.json(
		{ error: migrationMissing ? t("licenseMigrationRequired") : message },
		{ status: migrationMissing ? 503 : 400 },
	);
}
