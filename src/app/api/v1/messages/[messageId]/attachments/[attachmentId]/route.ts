import { getEnv } from "@/lib/cloudflare";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { getAttachmentForUser } from "@/lib/email/attachments";
import type { AttachmentV1RouteParams } from "./types";

/** Streams an attachment the key's account can read. */
export async function GET(request: Request, { params }: AttachmentV1RouteParams) {
	const { messageId, attachmentId } = await params;
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return new Response("Unauthorized", { status: 401 });
	}

	const result = await getAttachmentForUser(env, auth.user, messageId, attachmentId);
	if (!result) return new Response("Not found", { status: 404 });

	const headers = new Headers();
	result.object.writeHttpMetadata(headers);
	headers.set("Content-Type", result.attachment.contentType);
	headers.set("Content-Length", String(result.attachment.size));
	headers.set("Content-Disposition", `attachment; filename="${result.attachment.filename.replace(/["\\\r\n]/g, "_")}"`);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Cache-Control", "private, max-age=3600");
	return new Response(result.object.body, { headers });
}
