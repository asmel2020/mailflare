"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "./utils";

export function ChangePasswordForm() {
	const t = useTranslations("accountForm");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus(null);

		if (newPassword !== confirmPassword) {
			setStatus(t("newPasswordsDoNotMatch"));
			return;
		}

		setLoading(true);
		try {
			await updatePassword(currentPassword, newPassword);
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setStatus(t("passwordChanged"));
		} catch (err) {
			setStatus(err instanceof Error ? err.message : t("failedToChangePassword"));
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="currentPassword">{t("currentPassword")}</Label>
				<Input
					id="currentPassword"
					type="password"
					autoComplete="current-password"
					value={currentPassword}
					onChange={(event) => setCurrentPassword(event.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="newPassword">{t("newPassword")}</Label>
				<Input
					id="newPassword"
					type="password"
					autoComplete="new-password"
					value={newPassword}
					onChange={(event) => setNewPassword(event.target.value)}
					minLength={8}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="confirmPassword">{t("confirmNewPassword")}</Label>
				<Input
					id="confirmPassword"
					type="password"
					autoComplete="new-password"
					value={confirmPassword}
					onChange={(event) => setConfirmPassword(event.target.value)}
					minLength={8}
					required
				/>
			</div>
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={loading}>
					{loading ? t("changing") : t("changePassword")}
				</Button>
				{status && <p className="text-sm text-neutral-500">{status}</p>}
			</div>
		</form>
	);
}
