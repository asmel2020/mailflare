import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { getMessageWithBodyForUser } from "@/lib/email/inbound";

type MessageRouteParams = {
	params: Promise<{ messageId: string }>;
};

export async function GET(request: Request, { params }: MessageRouteParams) {
	const env = getEnv();
	const t = await getTranslations("errors");
	const user = await getCurrentUser(env, request);
	if (!user) {
		return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
	}

	const { messageId } = await params;
	const data = await getMessageWithBodyForUser(env, user, messageId);
	if (!data) {
		return NextResponse.json({ error: t("notFound") }, { status: 404 });
	}

	return NextResponse.json(data);
}
