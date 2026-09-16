"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { useConversationView } from "@/components/messages/use-conversation-view";
import { useLatestMessagesFirst } from "@/components/messages/use-latest-messages-first";

export function InboxThreadingSettings() {
	const t = useTranslations("inboxSettings");
	const [conversationView, setConversationView] = useConversationView();
	const [latestMessagesFirst, setLatestMessagesFirst] = useLatestMessagesFirst();

	return (
		<div className="space-y-3">
			<label className="flex items-start gap-3 rounded-xl bg-neutral-50 p-4">
				<span className="flex-1">
					<span className="block text-sm font-medium text-neutral-900">{t("groupConversations")}</span>
					<span className="mt-1 block text-sm text-neutral-500">
						{t("groupConversationsHint")}
					</span>
				</span>
				<Switch checked={conversationView} onCheckedChange={setConversationView} />
			</label>
			<label className="flex items-start gap-3 rounded-xl bg-neutral-50 p-4">
				<span className="flex-1">
					<span className="block text-sm font-medium text-neutral-900">{t("sortLatestFirst")}</span>
					<span className="mt-1 block text-sm text-neutral-500">
						{t("sortLatestFirstHint")}
					</span>
				</span>
				<Switch checked={latestMessagesFirst} onCheckedChange={setLatestMessagesFirst} />
			</label>
		</div>
	);
}
