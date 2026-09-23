# Push notifications and the installable app

Mailflare ships a progressive web app (PWA) manifest and a service worker so you can install it like a native app and receive browser push notifications for new email — even with the tab or app closed.

## What you get

- **Installable app.** `manifest.webmanifest` plus 48/96/192/512 icons; the browser can install Mailflare to the dock, home screen, or desktop.
- **Web Push.** Inbound mail for a subscribed user is signed with VAPID and delivered to the browser's push service. The service worker shows the notification and opens the message on click.
- **Unread badge.** The tab title and favicon show `(N)` unread while the app is open.
- **New-mail chime.** A short two-tone sound plays when a message arrives while the tab is visible. The operating-system notification is handled only by Web Push, so there is never a double alert.

## 1. Generate the VAPID keys

The keys are not issued by any dashboard — you generate them yourself, once, and never rotate them casually (regenerating invalidates every existing subscription).

```bash
npx web-push generate-vapid-keys --json
```

Or without installing anything (Node only):

```bash
node -e "const c=require('crypto');const{publicKey,privateKey}=c.generateKeyPairSync('ec',{namedCurve:'P-256'});console.log(JSON.stringify({publicKey:publicKey.export({type:'spki',format:'der'}).toString('base64url'),privateKey:privateKey.export({type:'pkcs8',format:'der'}).toString('base64url')}))"
```

Both print base64url-encoded EC P-256 keys in the format Web Push expects.

## 2. Configure the runtime

| Variable | Required | Purpose |
|---|---|---|
| `VAPID_PUBLIC_KEY` | yes | base64url public key; the browser uses it to subscribe |
| `VAPID_PRIVATE_KEY` | yes | base64url private key; signs every outgoing push |
| `VAPID_SUBJECT` | no | VAPID contact, defaults to `mailto:admin@localhost` |

**Cloudflare Workers**

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_SUBJECT   # optional; or set it as a plain var
```

Or set them under Workers & Pages → Settings → Variables & Secrets. Redeploy after changing them.

**Self-hosted (Docker / Node)**

Put them in `.env.docker` (or the process environment) alongside the SMTP settings; see the [configuration reference](self-hosting.md#configuration-reference).

**Local development**

`cp .dev.vars.example .dev.vars` and paste a test pair. `.dev.vars` is gitignored — never commit real keys.

If either key is missing the app still runs; **Settings → Account → Notifications** reports that push is not configured.

## 3. Enable notifications in the browser

1. Open **Settings → Account → Notifications**.
2. Click **Enable notifications** — this gesture is required; browsers only grant the permission from a user action.
3. Accept the browser prompt.

Each device is subscribed separately. Subscriptions live in the `push_subscriptions` table (migration `0034`); switching browsers or clearing site data requires re-enabling.

## How delivery works

Inbound mail → `processInboundMessage` → `sendWebPushToUsers` (`src/lib/push/send.ts`) → signed request to each browser push endpoint → `public/sw.js` `push` event → `showNotification` → click focuses the app and navigates to `/inbox/{id}`.

Spam is never pushed (the same branch that suppresses realtime new-message notifications). Dead endpoints (HTTP 404/410) are deleted automatically on delivery; successful deliveries update `last_used_at`.

## Platform notes

- **HTTPS (or localhost) is required.** Service workers and the Notification API do not work over plain HTTP.
- **iOS / iPadOS:** Safari 16.4+ and the site must be added to the Home Screen (installed PWA). Notifications from a regular Safari tab are not supported. Re-open the installed app after enabling.
- **Chrome / Edge / Firefox desktop:** works from the installed app or a normal tab.
- **Android:** the installed PWA receives pushes through the system push service.
- If you change VAPID keys, every user must disable and re-enable notifications.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Settings shows "not configured" | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` missing in the runtime |
| Permission prompt never appears | Click **Enable notifications** directly; browsers block prompts not tied to a gesture |
| Permission denied | Re-enable the site in the browser's notification settings, then click Enable again |
| Notification appears twice | Should not happen: the page no longer calls `new Notification()`. Hard-refresh to pick up an updated `sw.js` |
| No notification with the app closed | Battery saver / restricted background mode, expired subscription, or a device without background push |
| Click does not open the message | Check the service worker updated: DevTools → Application → Service Workers |

## Related

- [Deployment and configuration](deployment.md)
- [Self-hosting](self-hosting.md)
- [Troubleshooting](troubleshooting.md)
