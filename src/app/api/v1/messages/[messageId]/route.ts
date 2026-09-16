import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { getMessageWithBodyForUser } from "@/lib/email/inbound";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import { getFolderForMailbox } from "@/app/api/folders/utils";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { applySpamFeedback } from "@/lib/spam/feedback";
import { markMessageAsReadForUser } from "@/lib/user";
import type { MessageV1RouteParams, UpdateMessageV1Input } from "./types";

const MANAGED_STATUSES = new Set(["received", "sent", "draft", "trash", "spam", "archived"]);

export async function GET(request: Request, { params }: MessageV1RouteParams) {
	const { messageId } = await params;
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const detail = await getMessageWithBodyForUser(env, auth.user, messageId);
	if (!detail) return NextResponse.json({ error: "Message not found" }, { status: 404 });
	return NextResponse.json(detail);
}

/**
 * Updates flags and placement of one message. Body fields are optional and
 * applied in this order: read, starred, status, folderId, snoozedUntil.
 */
export async function PATCH(request: Request, { params }: MessageV1RouteParams) {
	const { messageId } = await params;
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: UpdateMessageV1Input;
	try {
		body = (await request.json()) as UpdateMessageV1Input;
	} catch {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const db = getDb(env);
	const [message] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
	if (!message?.mailboxId) return NextResponse.json({ error: "Message not found" }, { status: 404 });
	const access = await getMailboxAccessLevel(db, auth.user, message.mailboxId);
	if (!access?.canRead) return NextResponse.json({ error: "Message not found" }, { status: 404 });

	const needsManage =
		body.status !== undefined || body.folderId !== undefined || body.snoozedUntil !== undefined;
	if (needsManage && !access.canManage) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (body.read === true) {
		await markMessageAsReadForUser(env, auth.user, messageId);
	} else if (body.read === false) {
		await db.update(messages).set({ read: false }).where(eq(messages.id, messageId));
	}

	if (body.starred !== undefined) {
		await db.update(messages).set({ starred: body.starred }).where(eq(messages.id, messageId));
	}

	if (body.status !== undefined) {
		if (!MANAGED_STATUSES.has(body.status)) {
			return NextResponse.json({ error: "Invalid message status" }, { status: 400 });
		}
		if (body.status === "spam") {
			await applySpamFeedback(env, auth.user, messageId, "spam");
		} else if (body.status === "received" && message.status === "spam") {
			await applySpamFeedback(env, auth.user, messageId, "ham");
		} else {
			await db
				.update(messages)
				.set({ status: body.status, folderId: body.status === "received" ? null : message.folderId })
				.where(eq(messages.id, messageId));
			await createAuditLog(env, {
				actorUserId: auth.user.id,
				mailboxId: message.mailboxId,
				messageId,
				action: "email.delete",
				metadata: { status: body.status, source: "api" },
			});
		}
	}

	if (body.folderId !== undefined) {
		if (body.folderId === null) {
			await db.update(messages).set({ folderId: null }).where(eq(messages.id, messageId));
		} else {
			const folder = await getFolderForMailbox(db, body.folderId, message.mailboxId);
			if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
			await db
				.update(messages)
				.set({ folderId: body.folderId, status: "received" })
				.where(eq(messages.id, messageId));
		}
	}

	if (body.snoozedUntil !== undefined) {
		if (body.snoozedUntil === null) {
			await db.update(messages).set({ snoozedUntil: null }).where(eq(messages.id, messageId));
		} else {
			const when = new Date(body.snoozedUntil);
			if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
				return NextResponse.json({ error: "Choose a future snooze time" }, { status: 400 });
			}
			await db.update(messages).set({ snoozedUntil: when }).where(eq(messages.id, messageId));
		}
	}

	return NextResponse.json({ ok: true });
}
