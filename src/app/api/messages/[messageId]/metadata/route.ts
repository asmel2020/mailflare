import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { getMessageMetadataForUser } from "@/lib/email/inbound";
import type { MessageMetadataRouteParams } from "./types";

export async function GET(request: Request, { params }: MessageMetadataRouteParams) {
	const env = getEnv();
	const t = await getTranslations("errors");
	const user = await getCurrentUser(env, request);
	if (!user) return NextResponse.json({ error: t("unauthorized") }, { status: 401 });

	const { messageId } = await params;
	const metadata = await getMessageMetadataForUser(env, user, messageId);
	if (!metadata) return NextResponse.json({ error: t("notFound") }, { status: 404 });
	return NextResponse.json(metadata);
}
