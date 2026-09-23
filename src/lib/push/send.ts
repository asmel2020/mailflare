import { buildPushPayload } from "@block65/webcrypto-web-push";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import type { NewMessageNotification } from "@/lib/realtime/types";
import type { WebPushPayload } from "./types";
import { getVapidKeys } from "./vapid-utils";

const PUSH_TTL_SECONDS = 120;
const DEAD_ENDPOINT_STATUSES = new Set([404, 410]);

export function buildWebPushPayload(notification: NewMessageNotification): WebPushPayload {
	return {
		type: "new_message",
		title: notification.subject?.trim() || "New email",
		body: `From ${notification.fromName ?? notification.from}`,
		url: `/inbox/${notification.messageId}`,
		tag: notification.messageId,
	};
}

export async function sendWebPushToUsers(
	env: CloudflareEnv,
	userIds: string[],
	notification: NewMessageNotification,
): Promise<void> {
	if (userIds.length === 0) return;
	const vapid = getVapidKeys(env);
	if (!vapid) return;

	const db = getDb(env);
	const rows = await db
		.select()
		.from(pushSubscriptions)
		.where(inArray(pushSubscriptions.userId, userIds))
		.orderBy(desc(pushSubscriptions.createdAt));

	if (rows.length === 0) return;

	const payload = buildWebPushPayload(notification);
	const body = JSON.stringify(payload);

	await Promise.allSettled(
		rows.map(async (row) => {
			try {
				const request = await buildPushPayload(
					{
						data: body,
						options: {
							ttl: PUSH_TTL_SECONDS,
							topic: notification.messageId,
							urgency: "high",
						},
					},
					{
						endpoint: row.endpoint,
						expirationTime: null,
						keys: { auth: row.auth, p256dh: row.p256dh },
					},
					vapid,
				);

				const response = await fetch(row.endpoint, {
					method: request.method,
					headers: request.headers,
					body: request.body,
				});

				if (response.ok || response.status === 201 || response.status === 202) {
					await db
						.update(pushSubscriptions)
						.set({ lastUsedAt: new Date() })
						.where(eq(pushSubscriptions.id, row.id));
					return;
				}

				if (DEAD_ENDPOINT_STATUSES.has(response.status)) {
					await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
				}
			} catch (error) {
				console.error(`Web Push delivery failed for subscription ${row.id}`, error);
			}
		}),
	);
}
