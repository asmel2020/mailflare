"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPasswordReset } from "./utils";

export function ResetPasswordClient() {
	const t = useTranslations("reset");
	const tc = useTranslations("common");
	const token = useSearchParams().get("token") ?? "";
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (password !== confirm) {
			setError(t("mismatch"));
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const result = await confirmPasswordReset(token, password);
			if (!result.ok) {
				setError(result.error ?? t("failed"));
				return;
			}
			setDone(true);
		} catch {
			setError(tc("unreachable"));
		} finally {
			setLoading(false);
		}
	}

	if (!token) {
		return (
			<AuthShell icon={LockKeyhole} title={t("missingTitle")} description={t("missingDescription")}>
				<Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
					{t("requestNewLink")}
				</Link>
			</AuthShell>
		);
	}

	return (
		<AuthShell
			icon={LockKeyhole}
			title={done ? t("titleDone") : t("title")}
			description={
				done ? t("descriptionDone") : t("description")
			}
			footer={
				done ? (
					<Link href="/login" className="text-sm font-medium text-blue-600 hover:underline">
						{t("goToSignIn")}
					</Link>
				) : undefined
			}
		>
			{!done && (
				<form onSubmit={onSubmit} className="space-y-5">
					<div className="space-y-2">
						<Label htmlFor="password">{t("newPassword")}</Label>
						<Input
							id="password"
							type="password"
							autoComplete="new-password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							minLength={8}
							required
							autoFocus
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="confirm">{t("confirmPassword")}</Label>
						<Input
							id="confirm"
							type="password"
							autoComplete="new-password"
							value={confirm}
							onChange={(event) => setConfirm(event.target.value)}
							minLength={8}
							required
						/>
					</div>
					{error && (
						<p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
					)}
					<Button type="submit" className="h-11 w-full rounded-full px-6 active:scale-[0.98]" disabled={loading}>
						{loading ? t("saving") : t("submit")}
					</Button>
				</form>
			)}
		</AuthShell>
	);
}
