"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	disablePushNotifications,
	enablePushNotifications,
	getPushUiState,
	type PushUiState,
} from "@/hooks/push-notification-utils";

export function PushNotificationsSettings() {
	const t = useTranslations("pushSettings");
	const [state, setState] = useState<PushUiState>("loading");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		getPushUiState()
			.then((next) => {
				if (!cancelled) setState(next);
			})
			.catch(() => {
				if (!cancelled) setState("error");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const enable = useCallback(async () => {
		setBusy(true);
		setError(null);
		try {
			await enablePushNotifications();
			setState("enabled");
		} catch (err) {
			const code = err instanceof Error ? err.message : "error";
			if (code === "denied") setState("denied");
			else if (code === "unconfigured") setState("unconfigured");
			else setError(t("enableFailed"));
		} finally {
			setBusy(false);
		}
	}, [t]);

	const disable = useCallback(async () => {
		setBusy(true);
		setError(null);
		try {
			await disablePushNotifications();
			setState("default");
		} catch {
			setError(t("disableFailed"));
		} finally {
			setBusy(false);
		}
	}, [t]);

	if (state === "loading") {
		return (
			<div className="flex items-center gap-2 text-sm text-neutral-500">
				<Loader2 className="h-4 w-4 animate-spin" />
				{t("loading")}
			</div>
		);
	}

	if (state === "unsupported") {
		return <p className="text-sm text-neutral-500">{t("unsupported")}</p>;
	}

	if (state === "unconfigured") {
		return <p className="text-sm text-neutral-500">{t("unconfigured")}</p>;
	}

	return (
		<div className="space-y-4">
			<div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4">
				{state === "enabled" ? (
					<Bell className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
				) : (
					<BellOff className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
				)}
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium text-neutral-900">
						{state === "enabled" ? t("isEnabled") : t("isDisabled")}
					</p>
					<p className="mt-1 text-sm text-neutral-500">
						{state === "enabled" ? t("enabledDescription") : t("disabledDescription")}
					</p>
					{state === "denied" && (
						<p className="mt-2 text-sm text-amber-700">{t("deniedHint")}</p>
					)}
					{error && <p className="mt-2 text-sm text-red-600">{error}</p>}
				</div>
			</div>
			<div className="flex flex-wrap gap-3">
				{state === "enabled" ? (
					<Button variant="outline" disabled={busy} onClick={disable}>
						{t("disable")}
					</Button>
				) : (
					<Button disabled={busy || state === "denied"} onClick={enable}>
						{busy ? t("working") : t("enable")}
					</Button>
				)}
			</div>
		</div>
	);
}
