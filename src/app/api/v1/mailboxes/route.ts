import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { listAccessibleMailboxes } from "@/lib/mailboxes/access";
import { getMailboxDomainAddresses } from "@/lib/mailboxes/domain-addresses";

/** Mailboxes the key's account can read or send from. */
export async function GET(request: Request) {
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const db = getDb(env);
	const rows = await listAccessibleMailboxes(db, auth.user);
	return NextResponse.json({
		mailboxes: await Promise.all(
			rows.map(async (mailbox) => ({
				id: mailbox.id,
				localPart: mailbox.localPart,
				hostname: mailbox.hostname,
				displayName: mailbox.displayName,
				permission: mailbox.permission,
				isPrimary: mailbox.isPrimary,
				addresses: await getMailboxDomainAddresses(db, mailbox),
			})),
		),
	});
}
