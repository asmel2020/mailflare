export type AccountListItem = {
	id: string;
	email: string;
	name: string;
	resetEmail: string | null;
	role: "admin" | "user";
	createdAt: Date;
	hasAvatar?: boolean;
	canManageMailboxes?: boolean;
	mailboxId: string | null;
	localPart: string | null;
	hostname: string | null;
};

export type CreateAccountResult = {
	id?: string;
	email?: string;
	mailboxId?: string;
	error?: unknown;
};

export type CreateUserAccountInput = {
	username: string;
	domainId: string;
	/** Optional: the server generates a random password when omitted. */
	password?: string;
	role: "admin" | "user";
	/** Mint an API key for the new account; its secret is returned once. */
	generateApiKey: boolean;
	/** Recipients the new key may send to; empty means no restriction. */
	allowedRecipients?: string[];
};

export type AccountListResponse = {
	accounts?: AccountListItem[];
	error?: string;
};
