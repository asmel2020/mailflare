import { getTranslations } from "next-intl/server";
import { InboxThreadingSettings } from "@/components/settings/inbox-threading-settings";
import { InboxShortcutsSettings } from "@/components/settings/inbox-shortcuts-settings";
import { MailboxAutoReplyForm } from "@/components/settings/mailbox-auto-reply-form";
import { SpamFilterSettings } from "@/components/settings/spam-filter-settings";

export default async function SettingsInboxPage() {
	const t = await getTranslations("settingsPages");
	return (
		<div className="space-y-8 py-4">
			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{t("spamProtectionTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{t("spamProtectionDescription")}</p>
				</div>
				<div className="rounded-3xl bg-white p-6">
					<SpamFilterSettings />
				</div>
			</section>
			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{t("threadingTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{t("threadingDescription")}</p>
				</div>
				<div className="rounded-3xl bg-white p-6">
					<InboxThreadingSettings />
				</div>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{t("shortcutsTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{t("shortcutsDescription")}</p>
				</div>
				<div className="rounded-3xl bg-white p-6">
					<InboxShortcutsSettings />
				</div>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{t("autoResponseTitle")}</h2>
					<p className="mt-1 text-sm text-neutral-500">
						{t("autoResponseDescription")}
					</p>
				</div>
				<div className="rounded-3xl bg-white p-6">
					<MailboxAutoReplyForm />
				</div>
			</section>
		</div>
	);
}
