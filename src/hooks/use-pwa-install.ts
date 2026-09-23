"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

function isStandaloneDisplay() {
	return (
		window.matchMedia?.("(display-mode: standalone)").matches === true ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

function subscribeStandalone(onStoreChange: () => void) {
	const mql = window.matchMedia("(display-mode: standalone)");
	mql.addEventListener("change", onStoreChange);
	return () => mql.removeEventListener("change", onStoreChange);
}

function isAppleMobile() {
	if (typeof navigator === "undefined") return false;
	const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
	const iPadOS =
		navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
	return iOS || iPadOS;
}

export function usePwaInstall() {
	const [canInstall, setCanInstall] = useState(
		() => deferredPrompt !== null,
	);
	const isInstalled = useSyncExternalStore(
		subscribeStandalone,
		isStandaloneDisplay,
		() => false,
	);

	useEffect(() => {
		function onBeforeInstallPrompt(event: Event) {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
			setCanInstall(true);
		}

		function onAppInstalled() {
			deferredPrompt = null;
			setCanInstall(false);
		}

		window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
		window.addEventListener("appinstalled", onAppInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
			window.removeEventListener("appinstalled", onAppInstalled);
		};
	}, []);

	const promptInstall = useCallback(async () => {
		if (!deferredPrompt) return false;
		const prompt = deferredPrompt;
		deferredPrompt = null;
		setCanInstall(false);
		await prompt.prompt();
		const choice = await prompt.userChoice;
		return choice.outcome === "accepted";
	}, []);

	return {
		canInstall,
		isInstalled,
		isAppleMobile: isAppleMobile(),
		promptInstall,
	};
}
