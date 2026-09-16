# AGENTS.md

Guidance for AI coding agents working in this repository. This file is the canonical agent guide for this fork; `CLAUDE.md` holds a longer architecture deep dive that is still accurate.

## What this is

Mailflare: a self-hosted email inbox for custom domains. Next.js 16 App Router running on Cloudflare Workers via OpenNext, with Drizzle ORM over D1, R2 for raw MIME/attachments/backups, Queues for async mail processing, a Durable Object for realtime, and a cron trigger for scheduled backups. There is also a Node/Docker runtime for self-hosting without Cloudflare.

## Commands

```bash
npm run dev                  # next dev, Cloudflare bindings via initOpenNextCloudflareForDev
npm run lint                 # eslint
npm run build                # next build only — does NOT produce the deployable Worker
npm run db:generate          # drizzle-kit generate from src/db/schema/index.ts
npm run db:migrate:local     # apply migrations to the local D1
npm run db:seed              # POST /api/seed (run while dev is up)
npm run deploy               # OpenNext build + remote migrations + wrangler deploy
npm run preview              # local OpenNext preview
npm run cf-typegen           # regenerate cloudflare-env.d.ts from wrangler.jsonc
```

There is **no test suite** and no test runner. Verification means `npx tsc --noEmit`, `npx eslint <files>`, `npm run build`, and exercising the change locally.

### Type checking

`next.config.ts` sets `typescript.ignoreBuildErrors: true` and `tsconfig.json` sets `noImplicitAny: false`, so **the build does not catch type errors**. Always run `npx tsc --noEmit`.

There are **11 pre-existing type errors** on `main` (calendar `data` unknown, `avatar` size prop, `Uint8Array` vs `ArrayBuffer`, `setState` arg, two `possibly undefined`). Do not try to fix them unless the task asks; just make sure you add none.

### Windows local setup

`npm install` fails on Windows: npm runs `node-gyp rebuild` for `better-sqlite3` and there is no Visual Studio toolchain. The package ships a prebuilt binary, so install with `npm install --ignore-scripts` (that is also what the Dockerfile does). `better-sqlite3` is only used by the Node runtime; the Workers path never loads it.

## Deploying

- The Worker **must be named `mailflare`**. `wrangler.jsonc` (`services[].service`, `WORKER_SELF_REFERENCE`) and `getEmailWorkerName()` in `src/lib/cloudflare-api-utils.ts` (hardcoded `"mailflare"`) depend on it. Renaming it silently breaks Email Routing.
- Never deploy with `opennextjs-cloudflare deploy`. The deploy script builds with OpenNext and uploads with Wrangler because **`worker.ts`, not the generated Next worker, is the entrypoint**.
- This fork is connected to **Workers Builds**: pushing to `main` builds and deploys automatically (the deploy command runs `npm run deploy`, which also applies remote D1 migrations). Branch pushes run the non-production trigger, which builds with `npx opennextjs-cloudflare build` and uploads a version (`npx wrangler versions upload`) without touching production.
- Prefer a feature branch + PR. Merging to `main` is what ships.
- Unknown Worker env values are preserved by `keep_vars: true` in `wrangler.jsonc`.

## Architecture map

Read `CLAUDE.md` for the full detail. The essentials:

- **`worker.ts` is the entrypoint.** It wraps `.open-next/worker.js` and adds `fetch` (intercepts `/api/realtime` for the WebSocket upgrade), `email` (Cloudflare Email Routing: domain routing rules, reject/forward, raw MIME to R2, enqueue), and `queue` (one consumer for inbound, outbound and webhook retries). It re-exports the `RealtimeHub` Durable Object.
- **Mail pipeline.** Inbound: `email` → R2 → queue → `processInboundMessage` (`src/lib/email/inbound.ts`) → `resolveInboundAddress` → parse → insert message + attachments → contacts → webhooks → realtime notify. Outbound: `src/lib/email/send.ts` + `sender.ts`, composing with mimetext through the `EMAIL` binding, tracked by `outbound_jobs`.
- **Routing rules have two scopes.** `routing_rules.scope = "domain"` is evaluated *while resolving the address* by `resolveInboundAddress` (reject rules first, then exact mailbox/alias lookup, then catch-all) — this phase split stops a `*` catch-all from shadowing real mailboxes, preserve it. `scope = "mailbox"` runs *after* delivery and only picks a folder/spam/trash. Every rule query filters on `scope`.
- **Two runtimes, one code path.** Everything reaches bindings through `getEnv()` / `getEnvAsync()` (`src/lib/cloudflare.ts`) then `getDb(env)`. Never import `getCloudflareContext` directly. The Node runtime publishes the same shape on `globalThis.__mailflareNodeEnv`; code that must differ checks `isNodeRuntime(env)`.
- **JMAP** lives in `src/lib/jmap/` (framework-free); the Next routes only delegate. Auth is an API key with the `jmap` scope.
- **Search** is an FTS5 external-content table (`messages_fts`, migration 0030) kept in sync by triggers; `buildSearchConditions` (`src/lib/search/conditions.ts`) turns the Gmail-style grammar into a match predicate.
- **Folders are mostly virtual.** `messages.status` (`received`/`sent`/`draft`/`spam`/`trash`/`archived`) drives the folder views; `starred`, `snoozedUntil` and `folderId` (the `folders` table) are orthogonal. A "folder" route is usually a status filter, not a table.

## Data and migrations

Schema lives in one file, `src/db/schema/index.ts` (29 tables). Migrations are generated into `drizzle/migrations/`.

`drizzle-kit generate` prompts interactively (snapshot rename conflict) and cannot run non-interactively, so recent migrations are **hand-written** in the generated style and the journal is edited by hand.

**`src/lib/setup/migration.ts` duplicates the whole schema as inline SQL** for bootstrapping an empty database. Adding a migration therefore means four edits:

1. the new `drizzle/migrations/00NN_name.sql`
2. an entry in `drizzle/migrations/meta/_journal.json`
3. the filename appended to `MIGRATION_NAMES`
4. the same DDL added to `INITIAL_SCHEMA_SQL` (fresh installs never run the `.sql` files)

Use `--> statement-breakpoint` between statements. The bootstrap splitter keeps trigger bodies whole; do not break that.

## Internationalization (en + es)

`next-intl`, **no URL prefix**. The locale resolves from the `NEXT_LOCALE` cookie → the signed-in user's `users.locale` → `app_settings.default_locale` → `Accept-Language` → `en` (`src/i18n/request.ts`).

- Catalogs are `messages/en.json` and `messages/es.json`. **Every user-facing string needs a key in both** — the catalogs must stay in parity (no orphans, no missing keys). `english` is the source language.
- Client components: `const t = useTranslations("<namespace>")`. Server components/pages: `await getTranslations("<namespace>")`. Outside a request (queues, emails) pass an explicit locale: `getTranslations({ locale, namespace })`.
- Keys are camelCase. ICU treats `'` as an escape, so write an apostrophe inside a message as `''`. Use `t.rich` for inline markup and `{placeholder}` for interpolation.
- **API error messages are translated on the server**: route handlers call `await getTranslations("errors")` and return `t("key")`, and the client renders `data.error` unchanged. Do not add error codes for display.
- Machine-facing surfaces stay in English: `/api/v1/**`, `/api/inbound`, `/api/seed`, JMAP, `throw new Error` internals, and Zod field-validation output.
- Adding a locale: add it to `src/i18n/config.ts` and add `messages/<locale>.json`.
- Because the locale comes from a cookie, every page renders dynamically. That is expected; a `/[locale]/` prefix strategy would be needed to keep pages static.

## Auth, API keys and permissions

Two independent surfaces:

- **Session cookie** (`ep_session`): `getCurrentUser` / `requireUser` (`src/lib/auth/cookies.ts`). `requireUser` **throws** → 500; prefer `requireSessionUser` from `src/lib/api/auth.ts`, which returns a proper 401. Most older routes still use `requireUser` and 500 when unauthenticated.
- **API key** (`ep_…`, bcrypt-hashed, scopes `read`/`send`/`jmap`): `authenticateApiKey` + `requireScope` (`src/lib/api/auth.ts`). Used by `/api/v1/*`, JMAP and `/mcp`.

Consequences worth remembering:

- A key **cannot** reach session-only routes (including `POST /api/api-keys`), so a key holder cannot mint or revoke keys or change the account. The kill switch is `users.disabled`, which invalidates every session and key at once.
- Keys are per **user**, not per mailbox. For isolation, give each agent its own account (auto-generated key + an unshared random password).
- `api_keys.allowed_recipients` is a JSON allow-list (exact address, `@domain`, `*`). It is enforced in `POST /api/v1/send` via `src/lib/api/allowlist.ts`, and the MCP send tools reuse that handler, so it cannot be bypassed. Empty means anyone. Dashboard sends (session) are unaffected.
- `AGENT_SEND_RATE_LIMIT` caps API-key sends per key.
- **Mailbox authorization is separate from user role** and goes through `src/lib/mailboxes/access.ts` (`getMailboxAccessLevel`, `listAccessibleMailboxes`, `listAccessibleMailboxIds`). Message queries scope by accessible mailbox ids, not `userId` — see `src/app/api/messages/route.ts` for the canonical pattern.

## MCP

`POST /mcp` is a **stateless** MCP server over Streamable HTTP (`WebStandardStreamableHTTPServerTransport` with `sessionIdGenerator: undefined`, `enableJsonResponse: true`), authenticated with an API key (`read` scope; send tools also need `send`). The Cloudflare-safe `CfWorkerJsonSchemaValidator` is used because Ajv needs `eval`.

The tools in `src/lib/mcp/server.ts` do **not** re-implement anything: they call the `/api/v1` route handlers directly with the caller's `Authorization` header, so scopes, the allow-list and the rate limit all apply. Keep it that way — add a `/api/v1` endpoint rather than reaching into the database from a tool. Clients must send `Accept: application/json, text/event-stream`.

## Conventions

- Tabs for indentation. `@/*` maps to `src/*`.
- Split types and pure helpers into sibling `*-types.d.ts` / `*-utils.ts` files (59 and 41 exist). Follow this for anything non-trivial.
- API routes return `NextResponse.json({ error: "..." }, { status })`; there is no shared error envelope.
- UI is Tailwind v4 + shadcn/Radix primitives in `src/components/ui/`. `DialogContent` sets no max height, so a tall dialog overflows with an unreachable submit button — add `max-h-[calc(100vh-4rem)] overflow-y-auto` to dialogs with more than a few fields.
- `cloudflare-env.d.ts` is generated (large) — regenerate with `cf-typegen`, never hand-edit.
- Do not add comments unless they explain something non-obvious.

## This fork's local changes

This fork is self-hosted and does not use the hosted license service. `Team` features are enabled deliberately in three places — keep them in mind when merging upstream changes:

1. `toLicenseStatus()` in `src/lib/licenses/service.ts` (`const unlocked = true`)
2. `TEAM_SHARING_UNLOCKED` in `src/lib/mailboxes/access-utils.ts`
3. the `/licenses` filter in `src/components/admin-nav.tsx`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
