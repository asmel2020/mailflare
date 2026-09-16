import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { apiKeys, mailboxes, users } from "@/db/schema";
import { generateApiKey, scopesToJson } from "@/lib/api-keys";
import { allowedRecipientsToJson } from "@/lib/api/allowlist";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/ids";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { createUserAccountSchema } from "@/lib/validators";
import { ensureEmailRoutingRuleToWorker } from "@/lib/cloudflare-api";
import { ensureMailboxDomainRouting } from "@/lib/mailboxes/domain-addresses";
import type { CreateUserAccountInput } from "./types";
import {
	accountListItemFromUser,
	getDomainForAdmin,
	getExistingMailbox,
	listAccountsForAdmin,
	requireTeamAdmin,
} from "./utils";

export async function GET(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const rows = await listAccountsForAdmin(getDb(access.env));
	return NextResponse.json({
		accounts: rows.map((row) => accountListItemFromUser(row)),
	});
}

export async function POST(request: Request) {
	const access = await requireTeamAdmin(request);
	if (access.error) return access.error;
	const t = await getTranslations("errors");

	const parsed = createUserAccountSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const input: CreateUserAccountInput = parsed.data;
	const db = getDb(access.env);
	const domain = await getDomainForAdmin(db, access.user!.id, input.domainId);
	if (!domain) return NextResponse.json({ error: t("domainNotFound") }, { status: 404 });
	const username = input.username.toLowerCase().trim();
	const email = `${username}@${domain.hostname}`;
	const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
	if (existing) return NextResponse.json({ error: t("emailAlreadyRegistered") }, { status: 409 });
	const mailbox = await getExistingMailbox(db, domain.id, username);
	if (mailbox) return NextResponse.json({ error: t("emailAddressAlreadyAssigned") }, { status: 409 });

	const userId = newId("usr");
	try {
		await ensureEmailRoutingRuleToWorker(access.env, domain.zoneId, email);
		const [account] = await db
			.insert(users)
			.values({
				id: userId,
				email,
				passwordHash: hashPassword(input.password ?? crypto.randomUUID()),
				name: username,
				role: input.role,
				createdByUserId: access.user!.id,
			})
			.returning({
				id: users.id,
				email: users.email,
				name: users.name,
				resetEmail: users.resetEmail,
				role: users.role,
				disabled: users.disabled,
				createdAt: users.createdAt,
			});
		const mailboxId = newId("mbx");
		await db.insert(mailboxes).values({
			id: mailboxId,
			userId,
			domainId: domain.id,
			localPart: username,
			displayName: username,
		});
		await ensureMailboxDomainRouting(access.env, db, { id: mailboxId, domainId: domain.id, localPart: username, useAllDomains: true });

		// Mint an API key for the new account. Its secret is returned exactly once.
		let apiKey: string | null = null;
		if (input.generateApiKey) {
			const generated = generateApiKey();
			await db.insert(apiKeys).values({
				id: newId("key"),
				userId,
				name: `Agent key (${username})`,
				prefix: generated.prefix,
				keyHash: generated.hash,
				scopes: scopesToJson(["read", "send"]),
				allowedRecipients: allowedRecipientsToJson(input.allowedRecipients),
			});
			apiKey = generated.fullKey;
			await createAuditLog(access.env, {
				actorUserId: access.user!.id,
				targetUserId: userId,
				action: "account.api_key_created",
				metadata: { allowedRecipients: input.allowedRecipients ?? [] },
			});
		}

		return NextResponse.json({ account: accountListItemFromUser(account), apiKey }, { status: 201 });
	} catch (error) {
		await db.delete(users).where(eq(users.id, userId));
		const message = error instanceof Error ? error.message : t("accountMailboxCreateFailed");
		return NextResponse.json({ error: message }, { status: 502 });
	}
}
