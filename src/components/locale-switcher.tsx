"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { Select } from "@/components/ui/select";
import { authFetch } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import {
	LOCALE_COOKIE,
	LOCALE_COOKIE_MAX_AGE,
	localeLabels,
	locales,
	type Locale,
} from "@/i18n/config";

export function LocaleSwitcher({ className }: { className?: string }) {
	const current = useLocale() as Locale;
	const t = useTranslations("localeSwitcher");
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	function change(next: string) {
		if (next === current) return;
		document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};samesite=lax`;
		void authFetch("/api/settings/locale", {
			method: "PUT",
			redirectOnUnauthorized: false,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ locale: next }),
		}).catch(() => undefined);
		startTransition(() => router.refresh());
	}

	return (
		<span className={cn("inline-flex items-center gap-2", className)}>
			<Globe className="h-4 w-4 text-neutral-500" aria-hidden="true" />
			<Select
				aria-label={t("aria")}
				value={current}
				disabled={pending}
				onChange={(event) => change(event.target.value)}
			>
				{locales.map((locale) => (
					<option key={locale} value={locale}>
						{localeLabels[locale]}
					</option>
				))}
			</Select>
		</span>
	);
}
