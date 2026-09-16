import { GET as v1ListMailboxes } from "@/app/api/v1/mailboxes/route";
import { GET as v1ListFolders } from "@/app/api/v1/folders/route";
import { GET as v1ListMessages } from "@/app/api/v1/messages/route";
import { GET as v1GetMessage, PATCH as v1PatchMessage } from "@/app/api/v1/messages/[messageId]/route";
import { GET as v1GetThread } from "@/app/api/v1/messages/[messageId]/thread/route";
import { GET as v1GetAttachment } from "@/app/api/v1/messages/[messageId]/attachments/[attachmentId]/route";
import { POST as v1Send } from "@/app/api/v1/send/route";

/**
 * The MCP tools run inside the same Worker as the app, so they call the
 * `/api/v1` route handlers directly with the caller's own Authorization header.
 * Authentication, scopes, the recipient allow-list and the send rate limit all
 * live in those handlers, so the MCP surface cannot bypass them.
 */
const INTERNAL_ORIGIN = "https://mailflare.internal";

type CallOptions = {
	method?: string;
	body?: unknown;
	query?: Record<string, string | number | boolean | undefined | null>;
};

export function internalRequest(
	path: string,
	authorization: string | null,
	options: CallOptions = {},
): Request {
	const url = new URL(path, INTERNAL_ORIGIN);
	for (const [key, value] of Object.entries(options.query ?? {})) {
		if (value === undefined || value === null || value === "") continue;
		url.searchParams.set(key, String(value));
	}
	const headers = new Headers();
	if (authorization) headers.set("Authorization", authorization);
	if (options.body !== undefined) headers.set("Content-Type", "application/json");
	return new Request(url, {
		method: options.method ?? "GET",
		headers,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	});
}

export type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

export async function toToolResult(response: Response): Promise<ToolResult> {
	const text = await response.text();
	if (!response.ok) {
		return { content: [{ type: "text", text: `Error ${response.status}: ${text}` }], isError: true };
	}
	return { content: [{ type: "text", text }] };
}

type Json = Record<string, unknown> | null;

async function callJson(response: Response): Promise<Json> {
	try {
		return (await response.json()) as Json;
	} catch {
		return null;
	}
}

export const api = {
	listMailboxes: (authorization: string | null) => v1ListMailboxes(internalRequest("/api/v1/mailboxes", authorization)),
	listFolders: (authorization: string | null, mailboxId: string) =>
		v1ListFolders(internalRequest("/api/v1/folders", authorization, { query: { mailboxId } })),
	listMessages: (authorization: string | null, query: CallOptions["query"]) =>
		v1ListMessages(internalRequest("/api/v1/messages", authorization, { query })),
	getMessage: (authorization: string | null, messageId: string) =>
		v1GetMessage(internalRequest(`/api/v1/messages/${messageId}`, authorization), {
			params: Promise.resolve({ messageId }),
		}),
	getThread: (authorization: string | null, messageId: string) =>
		v1GetThread(internalRequest(`/api/v1/messages/${messageId}/thread`, authorization), {
			params: Promise.resolve({ messageId }),
		}),
	getAttachment: (authorization: string | null, messageId: string, attachmentId: string) =>
		v1GetAttachment(internalRequest(`/api/v1/messages/${messageId}/attachments/${attachmentId}`, authorization), {
			params: Promise.resolve({ messageId, attachmentId }),
		}),
	patchMessage: (authorization: string | null, messageId: string, body: unknown) =>
		v1PatchMessage(internalRequest(`/api/v1/messages/${messageId}`, authorization, { method: "PATCH", body }), {
			params: Promise.resolve({ messageId }),
		}),
	send: (authorization: string | null, body: unknown) =>
		v1Send(internalRequest("/api/v1/send", authorization, { method: "POST", body })),
};

export { callJson };
