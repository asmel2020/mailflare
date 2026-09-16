export type ApiKey = {
	id: string;
	userId: string;
	name: string;
	prefix: string;
	scopes: string;
	/** Empty means the key may send to anyone. */
	allowedRecipients: string[];
	createdAt?: string;
	lastUsedAt?: string | null;
};
