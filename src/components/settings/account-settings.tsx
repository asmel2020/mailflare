"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "./change-password-form";
import { EmailClientsSettings } from "./email-clients-settings";
import { MfaSettings } from "./mfa-settings";
import { ForwardingEmailForm } from "./forwarding-email-form";
import { MailboxSignatureForm } from "./mailbox-signature-form";
import { ProfileForm } from "./profile-form";
import { PushNotificationsSettings } from "./push-notifications-settings";
import type { AccountSettingsResponse } from "./types";
import { loadAccountSettings } from "./utils";

export function AccountSettings() {
	const t = useTranslations("settings");
	const tPages = useTranslations("settingsPages");
	const [user, setUser] = useState<AccountSettingsResponse["user"]>();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		loadAccountSettings()
			.then((nextUser) => {
				if (!cancelled) setUser(nextUser);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load account");
			});

		return () => {
			cancelled = true;
		};
	}, []);

	if (error) {
		return <p className="py-8 text-sm text-red-600">{error}</p>;
	}

	if (!user) {
		return (
			<div className="space-y-6 py-4">
				<Skeleton className="h-9 w-40" />
				<Skeleton className="h-72 w-full rounded-3xl" />
			</div>
		);
	}

	return (
		<div className="space-y-8 py-4">
			{/* <div>
				<h1 className="text-3xl font-medium text-neutral-900">Account</h1>
				<p className="mt-1 text-sm text-neutral-500">Manage your account details and sign-in password.</p>
			</div> */}

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{tPages("accountDetailsTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{tPages("accountDetailsDescription")}</p>
				</div>
				<div className="space-y-1 overflow-hidden rounded-3xl">
					<ProfileForm
						initialName={user.name}
						initialResetEmail={user.resetEmail ?? ""}
						email={user.email}
					/>

					{user.canForwardEmail && (
						<div className="space-y-4 rounded-lg bg-white p-6">
							<div>
								<h3 className="text-lg font-semibold text-neutral-900">{tPages("forwardingTitle")}</h3>
								<p className="mt-1 text-sm text-neutral-500">{tPages("forwardingDescription")}</p>
							</div>
						<ForwardingEmailForm initialForwardingEmail={user.forwardingEmail ?? ""} />
						</div>
					)}

					<div className="space-y-4 rounded-b-3xl rounded-t-lg bg-white p-6">
						<div>
							<h3 className="text-lg font-semibold text-neutral-900">{tPages("emailSignatureTitle")}</h3>
							<p className="mt-1 text-sm text-neutral-500">{tPages("emailSignatureDescription")}</p>
						</div>
					<MailboxSignatureForm />
					</div>
				</div>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{t("languageTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{t("languageHint")}</p>
				</div>
				<div className="rounded-3xl bg-white p-6">
					<LocaleSwitcher />
				</div>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{tPages("securityTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{tPages("securityDescription")}</p>
				</div>
				<div className="space-y-4 rounded-3xl bg-white p-6">
					<div>
						<h3 className="text-lg font-semibold text-neutral-900">{tPages("changePasswordTitle")}</h3>
						<p className="mt-1 text-sm text-neutral-500">{tPages("changePasswordDescription")}</p>
					</div>
					<ChangePasswordForm />
				</div>
				<div className="space-y-4 rounded-3xl bg-white p-6">
					<div>
						<h3 className="text-lg font-semibold text-neutral-900">{tPages("twoFactorTitle")}</h3>
						<p className="mt-1 text-sm text-neutral-500">{tPages("twoFactorDescription")}</p>
					</div>
					<MfaSettings />
				</div>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{tPages("emailAppsTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{tPages("emailAppsDescription")}</p>
				</div>
				<div className="space-y-4 rounded-3xl bg-white p-6">
					<EmailClientsSettings />
				</div>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{tPages("notificationsTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{tPages("notificationsDescription")}</p>
				</div>
				<div className="space-y-4 rounded-3xl bg-white p-6">
					<PushNotificationsSettings />
				</div>
			</section>
		</div>
	);
}
