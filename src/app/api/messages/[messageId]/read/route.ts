import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getEnv } from "@/lib/cloudflare";
import { getCurrentUser } from "@/lib/auth/cookies";
import { markMessageAsReadForUser } from "@/lib/user";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ messageId: string }> },
) {
	const { messageId } = await params;
	const env = getEnv();
	const t = await getTranslations("errors");
	const user = await getCurrentUser(env, request);
	if (!user) {
		return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
	}

	const success = await markMessageAsReadForUser(env, user, messageId);
	if (!success) {
		return NextResponse.json({ error: t("messageNotFound") }, { status: 404 });
	}

	return NextResponse.json({ success: true });
}
