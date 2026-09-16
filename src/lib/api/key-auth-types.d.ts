import type { users } from "@/db/schema";

export type ApiAuthResult = {
	userId: string;
	email: string;
	scopes: string[];
	/** Id of the api_keys row that authenticated this request. */
	keyId: string;
	/** Recipient patterns this key may send to; empty means no restriction. */
	allowedRecipients: string[];
	user: typeof users.$inferSelect;
};
