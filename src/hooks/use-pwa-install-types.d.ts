export type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
	interface Window {
		__mailflareInstallPrompt?: BeforeInstallPromptEvent | null;
	}
}
