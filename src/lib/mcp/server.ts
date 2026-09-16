import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import { z } from "zod";
import { api, callJson, toToolResult, type ToolResult } from "./client";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const addressSchema = z.string().min(3).max(500).describe('Address, optionally with a display name: "Maya Chen" <maya@example.com>');

function jsonText(value: unknown): ToolResult {
	return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorText(message: string): ToolResult {
	return { content: [{ type: "text", text: message }], isError: true };
}

function reSubject(subject: string | null | undefined, prefix: string): string {
	const value = subject?.trim() || "(no subject)";
	return value.toLowerCase().startsWith(prefix.toLowerCase()) ? value : `${prefix}${value}`;
}

type MailboxJson = { id?: string; localPart?: string; hostname?: string; addresses?: string[] };
type MessageJson = {
	message?: { mailboxId?: string; fromAddr?: string; toAddr?: string; ccAddr?: string | null; subject?: string | null; providerMessageId?: string | null; references?: string | null };
	attachments?: Array<{ id: string; filename: string; type: string; size: number }>;
};

async function loadMessage(authorization: string | null, messageId: string): Promise<MessageJson | null> {
	const response = await api.getMessage(authorization, messageId);
	if (!response.ok) return null;
	return (await callJson(response)) as MessageJson | null;
}

async function senderAddress(authorization: string | null, mailboxId: string | undefined): Promise<string | null> {
	const response = await api.listMailboxes(authorization);
	const data = (await callJson(response)) as { mailboxes?: MailboxJson[] } | null;
	const mailboxes = data?.mailboxes ?? [];
	const mailbox = mailboxId ? mailboxes.find((entry) => entry.id === mailboxId) : mailboxes[0];
	if (!mailbox) return null;
	return mailbox.addresses?.[0] ?? (mailbox.localPart && mailbox.hostname ? `${mailbox.localPart}@${mailbox.hostname}` : null);
}

/**
 * Builds a single-request MCP server. Authentication is carried by the caller's
 * Authorization header, exactly as on the REST API.
 */
export function buildMcpServer(authorization: string | null): McpServer {
	const server = new McpServer(
		{ name: "mailflare", version: "1.0.0" },
		{
			jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
			instructions:
				"Mailflare mail tools. Every call acts as the account that owns the API key. Sending is limited by the key's recipient allow-list.",
		},
	);

	server.registerTool(
		"whoami",
		{ description: "Return the authenticated account and the mailboxes it can use.", inputSchema: {} },
		async () => {
			const response = await api.listMailboxes(authorization);
			return toToolResult(response);
		},
	);

	server.registerTool(
		"list_mailboxes",
		{ description: "List the mailboxes (addresses) this account can read or send from.", inputSchema: {} },
		async () => toToolResult(await api.listMailboxes(authorization)),
	);

	server.registerTool(
		"list_folders",
		{
			description: "List the user folders of a mailbox.",
			inputSchema: { mailboxId: z.string().min(1) },
		},
		async ({ mailboxId }) => toToolResult(await api.listFolders(authorization, mailboxId)),
	);

	server.registerTool(
		"search_messages",
		{
			description:
				"Search and list messages. `q` supports the search grammar: words, \"exact phrase\", -exclude, from:, to:, subject:, has:attachment, is:unread, is:read, is:starred, after:YYYY-MM-DD, before:YYYY-MM-DD.",
			inputSchema: {
				q: z.string().optional(),
				mailboxId: z.string().optional(),
				folderId: z.string().optional(),
				status: z.enum(["received", "sent", "draft", "trash", "spam", "archived"]).optional(),
				read: z.enum(["read", "unread"]).optional(),
				starred: z.boolean().optional(),
				limit: z.number().int().min(1).max(100).optional(),
				offset: z.number().int().min(0).optional(),
			},
		},
		async (args) =>
			toToolResult(
				await api.listMessages(authorization, {
					q: args.q,
					mailboxId: args.mailboxId,
					folderId: args.folderId,
					status: args.status,
					read: args.read,
					starred: args.starred === undefined ? undefined : String(args.starred),
					limit: args.limit,
					offset: args.offset,
				}),
			),
	);

	server.registerTool(
		"get_message",
		{
			description: "Read one message, including its body and attachment metadata.",
			inputSchema: { messageId: z.string().min(1) },
		},
		async ({ messageId }) => toToolResult(await api.getMessage(authorization, messageId)),
	);

	server.registerTool(
		"get_thread",
		{
			description: "Read every message in the same conversation, oldest first.",
			inputSchema: { messageId: z.string().min(1) },
		},
		async ({ messageId }) => toToolResult(await api.getThread(authorization, messageId)),
	);

	server.registerTool(
		"list_attachments",
		{
			description: "List the attachment metadata of a message.",
			inputSchema: { messageId: z.string().min(1) },
		},
		async ({ messageId }) => {
			const data = await loadMessage(authorization, messageId);
			if (!data) return errorText("Message not found");
			return jsonText(data.attachments ?? []);
		},
	);

	server.registerTool(
		"download_attachment",
		{
			description: "Download one attachment as base64. Limited to 5 MB.",
			inputSchema: { messageId: z.string().min(1), attachmentId: z.string().min(1) },
		},
		async ({ messageId, attachmentId }) => {
			const response = await api.getAttachment(authorization, messageId, attachmentId);
			if (!response.ok) return errorText(`Error ${response.status}: ${await response.text()}`);
			const buffer = await response.arrayBuffer();
			if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
				return errorText(`Attachment is ${buffer.byteLength} bytes; the MCP limit is ${MAX_ATTACHMENT_BYTES}.`);
			}
			const base64 = Buffer.from(buffer).toString("base64");
			return jsonText({
				filename: response.headers.get("Content-Disposition"),
				contentType: response.headers.get("Content-Type"),
				contentBase64: base64,
			});
		},
	);

	server.registerTool(
		"send_message",
		{
			description:
				"Send a new email. The key's recipient allow-list is enforced; a rejected address returns an error.",
			inputSchema: {
				from: addressSchema,
				to: z.array(addressSchema).min(1),
				cc: z.array(addressSchema).optional(),
				bcc: z.array(addressSchema).optional(),
				subject: z.string().min(1).max(500),
				text: z.string().optional(),
				html: z.string().optional(),
				mailboxId: z.string().min(1),
				inReplyTo: z.string().optional(),
				references: z.array(z.string()).optional(),
				attachments: z
					.array(
						z.object({
							filename: z.string().min(1).max(255),
							type: z.string().optional(),
							contentBase64: z.string().min(1),
						}),
					)
					.max(10)
					.optional(),
			},
		},
		async (args) => toToolResult(await api.send(authorization, args)),
	);

	server.registerTool(
		"reply_message",
		{
			description: "Reply to a message, threading it correctly for the recipient.",
			inputSchema: {
				messageId: z.string().min(1),
				text: z.string().optional(),
				html: z.string().optional(),
				replyAll: z.boolean().optional(),
				from: addressSchema.optional(),
			},
		},
		async ({ messageId, text, html, replyAll, from }) => {
			const data = await loadMessage(authorization, messageId);
			const message = data?.message;
			if (!message) return errorText("Message not found");
			const sender = from ?? (await senderAddress(authorization, message.mailboxId));
			if (!sender) return errorText("Could not resolve the sending address; pass `from`.");
			const to = [message.fromAddr].filter(Boolean) as string[];
			const references = [
				...(message.references ? message.references.split(/\s+/).filter(Boolean) : []),
				...(message.providerMessageId ? [message.providerMessageId] : []),
			];
			return toToolResult(
				await api.send(authorization, {
					from: sender,
					to,
					cc: replyAll && message.ccAddr ? message.ccAddr.split(",").map((entry) => entry.trim()).filter(Boolean) : undefined,
					subject: reSubject(message.subject, "Re: "),
					text,
					html,
					mailboxId: message.mailboxId,
					inReplyTo: message.providerMessageId ?? undefined,
					references: references.length > 0 ? references : undefined,
				}),
			);
		},
	);

	server.registerTool(
		"forward_message",
		{
			description: "Forward a message to a new recipient. Attachments are not copied.",
			inputSchema: {
				messageId: z.string().min(1),
				to: z.array(addressSchema).min(1),
				text: z.string().optional(),
				from: addressSchema.optional(),
			},
		},
		async ({ messageId, to, text, from }) => {
			const data = await loadMessage(authorization, messageId);
			const message = data?.message;
			if (!message) return errorText("Message not found");
			const sender = from ?? (await senderAddress(authorization, message.mailboxId));
			if (!sender) return errorText("Could not resolve the sending address; pass `from`.");
			const quoted = await callJson(await api.getMessage(authorization, messageId));
			const body = (quoted as { message?: { textBody?: string | null } } | null)?.message?.textBody ?? "";
			return toToolResult(
				await api.send(authorization, {
					from: sender,
					to,
					subject: reSubject(message.subject, "Fwd: "),
					text: [text ?? "", "", "---------- Forwarded message ----------", body].join("\n"),
					mailboxId: message.mailboxId,
				}),
			);
		},
	);

	const flagTools: Array<[string, string, (messageId: string) => Promise<Response>]> = [
		["mark_read", "Mark a message as read.", (id) => api.patchMessage(authorization, id, { read: true })],
		["mark_unread", "Mark a message as unread.", (id) => api.patchMessage(authorization, id, { read: false })],
		["star_message", "Star a message.", (id) => api.patchMessage(authorization, id, { starred: true })],
		["unstar_message", "Remove a message's star.", (id) => api.patchMessage(authorization, id, { starred: false })],
		["archive_message", "Move a message to the archive.", (id) => api.patchMessage(authorization, id, { status: "archived" })],
		["trash_message", "Move a message to the trash.", (id) => api.patchMessage(authorization, id, { status: "trash" })],
		["move_to_inbox", "Move a message back to the inbox.", (id) => api.patchMessage(authorization, id, { status: "received" })],
		["mark_spam", "Mark a message as spam.", (id) => api.patchMessage(authorization, id, { status: "spam" })],
		["mark_ham", "Mark a message as not spam.", (id) => api.patchMessage(authorization, id, { status: "received" })],
		["unsnooze_message", "Bring a snoozed message back to the inbox.", (id) => api.patchMessage(authorization, id, { snoozedUntil: null })],
	];

	for (const [name, description, run] of flagTools) {
		server.registerTool(
			name,
			{ description, inputSchema: { messageId: z.string().min(1) } },
			async ({ messageId }) => toToolResult(await run(messageId)),
		);
	}

	server.registerTool(
		"move_message",
		{
			description: "Move a message to one of the mailbox's user folders (see list_folders).",
			inputSchema: { messageId: z.string().min(1), folderId: z.string().min(1) },
		},
		async ({ messageId, folderId }) => toToolResult(await api.patchMessage(authorization, messageId, { folderId })),
	);

	server.registerTool(
		"snooze_message",
		{
			description: "Hide a message from the inbox until the given ISO date-time (must be in the future).",
			inputSchema: { messageId: z.string().min(1), snoozedUntil: z.string().min(1) },
		},
		async ({ messageId, snoozedUntil }) => toToolResult(await api.patchMessage(authorization, messageId, { snoozedUntil })),
	);

	return server;
}
