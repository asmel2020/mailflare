export type LoginResult = {
	token?: string;
	redirect?: string;
	error?: string;
	/** Stable machine-readable code for errors the client must branch on. */
	code?: string;
	/** Password accepted; a code from the authenticator is still needed. */
	mfaRequired?: boolean;
	challengeToken?: string;
};
