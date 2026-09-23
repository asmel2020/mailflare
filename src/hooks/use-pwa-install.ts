"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { BeforeInstallPromptEvent } from "./use-pwa-install-types";

const INSTALL_AVAILABLE_EVENT = "mailflare:install-available";

function getStoredPrompt(): BeforeInstallPromptEvent | null {
	if (typeof window === "undefined") return null;
	return window.__mailflareInstallPrompt ?? null;
}

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

function isAndroidMobile() {
	return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function usePwaInstall() {
	const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
		getStoredPrompt,
	);
	const isInstalled = useSyncExternalStore(
		subscribeStandalone,
		isStandaloneDisplay,
		() => false,
	);

	useEffect(() => {
		// The inline head script captures the event before hydration and
		// announces it; late events are caught by the direct listener.
		function syncPrompt() {
			setPromptEvent(getStoredPrompt());
		}

		function onBeforeInstallPrompt(event: Event) {
			event.preventDefault();
			window.__mailflareInstallPrompt = event as BeforeInstallPromptEvent;
			setPromptEvent(event as BeforeInstallPromptEvent);
		}

		window.addEventListener(INSTALL_AVAILABLE_EVENT, syncPrompt);
		window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
		return () => {
			window.removeEventListener(INSTALL_AVAILABLE_EVENT, syncPrompt);
			window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
		};
	}, []);

	const promptInstall = useCallback(async () => {
		const prompt = getStoredPrompt();
		if (!prompt) return false;
		window.__mailflareInstallPrompt = null;
		setPromptEvent(null);
		await prompt.prompt();
		const choice = await prompt.userChoice;
		return choice.outcome === "accepted";
	}, []);

	return {
		canInstall: promptEvent !== null,
		isInstalled,
		isAppleMobile: isAppleMobile(),
		isAndroidMobile: isAndroidMobile(),
		promptInstall,
	};
}
