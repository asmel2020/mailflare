import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { getEnv } from "@/lib/cloudflare";
import { isPushConfigured } from "@/lib/push/vapid-utils";

export async function GET(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;

	return NextResponse.json({
		hasVapid: isPushConfigured(env),
		userId: auth.user.id,
	});
}
