import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getVapidKeys } from "@/lib/push/vapid-utils";

export async function GET() {
	const env = getEnv();
	const keys = getVapidKeys(env);
	if (!keys?.publicKey) {
		return NextResponse.json({ error: "Push not configured" }, { status: 503 });
	}
	return NextResponse.json({ publicKey: keys.publicKey });
}
