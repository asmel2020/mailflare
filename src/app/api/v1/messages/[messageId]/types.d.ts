export type MessageV1RouteParams = { params: Promise<{ messageId: string }> };

export type UpdateMessageV1Input = {
	read?: boolean;
	starred?: boolean;
	status?: string;
	folderId?: string | null;
	snoozedUntil?: string | null;
};
