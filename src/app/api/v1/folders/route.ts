import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { getMailboxFolderAccess, listFoldersForMailbox } from "@/app/api/folders/utils";

/** User folders of a mailbox. */
export async function GET(request: Request) {
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const mailboxId = new URL(request.url).searchParams.get("mailboxId");
	if (!mailboxId) return NextResponse.json({ folders: [] });

	const db = getDb(env);
	const access = await getMailboxFolderAccess(db, auth.user, mailboxId);
	if (!access) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });

	const folders = await listFoldersForMailbox(db, mailboxId);
	return NextResponse.json({ folders });
}
