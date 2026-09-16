import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { getMessageThreadForUser } from "@/lib/email/thread-view";
import type { MessageV1RouteParams } from "../types";

/** Every stored message in the same conversation, oldest first. */
export async function GET(request: Request, { params }: MessageV1RouteParams) {
	const { messageId } = await params;
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const thread = await getMessageThreadForUser(env, auth.user, messageId);
	if (!thread) return NextResponse.json({ error: "Message not found" }, { status: 404 });
	return NextResponse.json(thread);
}
