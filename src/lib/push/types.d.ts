export interface PushSubscriptionRow {
	id: string;
	userId: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	contentEncoding: string;
	userAgent: string | null;
	createdAt: Date;
	lastUsedAt: Date | null;
}

export interface WebPushPayload {
	type: "new_message";
	title: string;
	body: string;
	url: string;
	tag: string;
}
