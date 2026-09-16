"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ManagedAccount } from "./types";
import {
	fetchManagedAccount,
	saveManagedAccount,
	uploadManagedAccountAvatar,
} from "./utils";

export default function AccountDetailsPage() {
	const { id } = useParams<{ id: string }>();
	const t = useTranslations("accountsAdmin");
	const [account, setAccount] = useState<ManagedAccount | null>(null);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [avatarVersion, setAvatarVersion] = useState(0);

	useEffect(() => {
		void fetchManagedAccount(id)
			.then(setAccount)
			.catch((error) => setMessage(error instanceof Error ? error.message : t("unableToLoadAccount")));
	}, [id, t]);

	async function saveDetails() {
		if (!account) return;
		setSaving(true);
		setMessage(null);
		try {
			await saveManagedAccount(account);
			setAccount({ ...account, newPassword: "" });
			setMessage(account.newPassword ? t("accountUpdatedPassword") : t("accountUpdated"));
		} catch (error) {
			setMessage(error instanceof Error ? error.message : t("unableToUpdateAccount"));
		} finally {
			setSaving(false);
		}
	}

	async function uploadAvatar(file: File | undefined) {
		if (!file || !account) return;
		try {
			await uploadManagedAccountAvatar(account.id, file);
			setAccount({ ...account, hasAvatar: true });
			setAvatarVersion(Date.now());
		} catch (error) {
			setMessage(error instanceof Error ? error.message : t("unableToUpdateAvatar"));
		}
	}

	if (!account) return <p className="text-sm text-neutral-500">{message ?? t("loadingAccount")}</p>;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-medium text-neutral-900">{t("detailsTitle")}</h1>
				<p className="mt-2 text-sm text-neutral-500">{t("detailsDescription")}</p>
			</div>
			<section className="space-y-5 rounded-3xl bg-white p-6">
				<div className="flex items-center gap-4">
					<span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
						{account.name.charAt(0).toUpperCase()}
						{account.hasAvatar && (
							<img src={`/api/accounts/${id}/avatar?v=${avatarVersion}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
						)}
					</span>
					<Label className="cursor-pointer">
						<span className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm">
							<Upload className="h-4 w-4" />
							{t("changeAvatar")}
						</span>
						<Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
					</Label>
				</div>
				<div className="space-y-2">
					<Label htmlFor="account-email">{t("email")}</Label>
					<Input id="account-email" value={account.email} readOnly className="bg-neutral-50 text-neutral-500" />
				</div>
				<div className="space-y-2">
					<Label htmlFor="account-name">{t("name")}</Label>
					<Input id="account-name" value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} />
				</div>
				{account.canForwardEmail && <div className="space-y-2">
					<Label htmlFor="forwarding-email">{t("forwardingEmail")}</Label>
					<Input
						id="forwarding-email"
						type="email"
						value={account.forwardingEmail ?? ""}
						onChange={(event) => setAccount({ ...account, forwardingEmail: event.target.value || null })}
						placeholder={t("forwardingPlaceholder")}
					/>
					<p className="text-xs leading-5 text-neutral-500">
						{t("forwardingHint")}
					</p>
				</div>}
				<div className="space-y-2">
					<Label htmlFor="account-new-password">{t("resetPassword")}</Label>
					<Input
						id="account-new-password"
						type="password"
						autoComplete="new-password"
						minLength={8}
						value={account.newPassword ?? ""}
						onChange={(event) => setAccount({ ...account, newPassword: event.target.value })}
						placeholder={t("resetPasswordPlaceholder")}
					/>
					<p className="text-xs leading-5 text-neutral-500">
						{t("resetPasswordHint")}
					</p>
				</div>
				<label className="flex items-center gap-3 text-sm">
					<Checkbox checked={!account.disabled} onChange={(event) => setAccount({ ...account, disabled: !event.target.checked })} />
					{t("accountEnabled")}
				</label>
				<Button onClick={() => void saveDetails()} disabled={saving || !account.name.trim()}>
					{saving ? t("saving") : t("saveDetails")}
				</Button>
			</section>
			{message && <p className="text-sm text-neutral-500">{message}</p>}
		</div>
	);
}
