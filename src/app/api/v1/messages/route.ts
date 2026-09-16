import { NextResponse } from "next/server";
import { eq, desc, and, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { getDb } from "@/db";
import { messages, users } from "@/db/schema";
import { getMailboxAccessLevel, listAccessibleMailboxIds } from "@/lib/mailboxes/access";
import { buildSearchConditions } from "@/lib/search/conditions";

export async function GET(request: Request) {
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const mailboxId = url.searchParams.get("mailboxId");
	const direction = url.searchParams.get("direction");
	const folderId = url.searchParams.get("folderId");
	const status = url.searchParams.get("status");
	const read = url.searchParams.get("read");
	const starred = url.searchParams.get("starred");
	const query = url.searchParams.get("q")?.trim();
	const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
	const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

	const db = getDb(env);
	const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
	if (!user || user.disabled) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const conditions: SQL[] = [];
	if (mailboxId) {
		const access = await getMailboxAccessLevel(db, user, mailboxId);
		if (!access?.canRead) {
			return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
		}
		conditions.push(eq(messages.mailboxId, mailboxId));
	} else {
		const accessibleMailboxIds = await listAccessibleMailboxIds(db, user);
		if (accessibleMailboxIds.length > 0) {
			conditions.push(inArray(messages.mailboxId, accessibleMailboxIds));
		} else {
			conditions.push(eq(messages.userId, auth.userId));
		}
	}
	if (direction === "inbound" || direction === "outbound") {
		conditions.push(eq(messages.direction, direction));
	}
	if (folderId) conditions.push(eq(messages.folderId, folderId));
	if (status) conditions.push(eq(messages.status, status));
	if (read === "read" || read === "unread") conditions.push(eq(messages.read, read === "read"));
	if (starred === "true" || starred === "false") conditions.push(eq(messages.starred, starred === "true"));
	if (query) conditions.push(...buildSearchConditions(query));

	const rows = await db
		.select()
		.from(messages)
		.where(and(...conditions))
		.orderBy(desc(messages.createdAt))
		.limit(limit)
		.offset(offset);

	// The R2 key is internal plumbing; agents do not need it.
	return NextResponse.json({
		messages: rows.map((row) => {
			const copy: Record<string, unknown> = { ...row };
			delete copy.rawR2Key;
			return copy;
		}),
		limit,
		offset,
	});
}
