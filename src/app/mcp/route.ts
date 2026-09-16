import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiKey, requireScope } from "@/lib/api/auth";
import { getEnv } from "@/lib/cloudflare";
import { buildMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
	"Access-Control-Expose-Headers": "Mcp-Session-Id",
};

/**
 * Stateless MCP endpoint over Streamable HTTP. A key with the `read` scope can
 * call the tools; tools that send mail also need `send` and are subject to the
 * key's recipient allow-list and rate limit.
 */
async function handle(request: Request): Promise<Response> {
	const env = getEnv();
	const authorization = request.headers.get("authorization");
	const auth = await authenticateApiKey(env, authorization);
	if (!auth || !requireScope(auth.scopes, "read")) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer", ...CORS_HEADERS },
		});
	}

	const server = buildMcpServer(authorization);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);

	const response = await transport.handleRequest(request);
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
	return new Response(response.body, { status: response.status, headers });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

export async function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}
