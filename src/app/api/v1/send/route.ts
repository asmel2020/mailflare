import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { collectRecipientAddresses, findDisallowedRecipients } from "@/lib/api/allowlist";
import { sendEmailSchema } from "@/lib/validators";
import { sendEmail } from "@/lib/email/send";
import { decodeBase64Content } from "@/lib/email/attachments";
import { readJsonBody } from "@/lib/http/request";
import { RequestBodyTooLargeError } from "@/lib/http/errors";
import { getSendErrorStatus } from "@/app/api/send/error-utils";

export async function POST(request: Request) {
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "send")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const rate = await env.AGENT_SEND_RATE_LIMIT?.limit({ key: auth.keyId });
	if (rate && !rate.success) {
		return NextResponse.json({ error: "Too many sends. Try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
	}

	let body: unknown;
	try {
		body = await readJsonBody(request, 30 * 1024 * 1024);
	} catch (error) {
		const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
		return NextResponse.json({ error: "Invalid send request" }, { status });
	}
	const parsed = sendEmailSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const disallowed = findDisallowedRecipients(
		auth.allowedRecipients,
		collectRecipientAddresses(parsed.data.to, parsed.data.cc, parsed.data.bcc),
	);
	if (disallowed.length > 0) {
		return NextResponse.json(
			{ error: `This API key is not allowed to send to: ${disallowed.join(", ")}` },
			{ status: 403 },
		);
	}

	try {
		const { attachments, ...fields } = parsed.data;
		const result = await sendEmail(env, {
			userId: auth.userId,
			...fields,
			attachments: attachments?.map((attachment) => ({
				filename: attachment.filename,
				type: attachment.type,
				content: decodeBase64Content(attachment.contentBase64),
				disposition: "attachment",
			})),
		});
		return NextResponse.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Send failed";
		return NextResponse.json({ error: message }, { status: getSendErrorStatus(message) });
	}
}
