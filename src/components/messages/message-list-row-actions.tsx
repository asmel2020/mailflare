"use client";

import { useState } from "react";
import { Archive, Clock, Mail, MailOpen, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import type { MessageListRowActionsProps } from "./types";
import { getSnoozePresets, isMessageSnoozed, snoozeMessage, unsnoozeMessage } from "./message-list-row-actions-utils";

export function MessageListRowActions({ message, onAction }: MessageListRowActionsProps) {
	const t = useTranslations("messageActions");
	const [snoozeOpen, setSnoozeOpen] = useState(false);
	const [snoozedUntil, setSnoozedUntil] = useState(() => getSnoozePresets()[0].value);
	const [snoozing, setSnoozing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const snoozePresets = getSnoozePresets();
	const snoozePresetLabels = [t("snoozeTomorrow"), t("snoozeNextWeek"), t("snoozeNextMonth")];
	const snoozed = isMessageSnoozed(message.snoozedUntil);
	const readAction = message.read ? "unread" : "read";

	async function handleSnooze() {
		setSnoozing(true);
		setError(null);
		try {
			await snoozeMessage(message.id, snoozedUntil);
			setSnoozeOpen(false);
		} catch (nextError) {
			setError(nextError instanceof Error ? nextError.message : t("snoozeFailed"));
		} finally {
			setSnoozing(false);
		}
	}

	return (
		<>
			<div className="pointer-events-none absolute right-6 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 pl-3 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 bg-[#f2f6fc]">
				<Tooltip label={t("archive")}>
					<Button type="button" variant="ghost" size="sm" onClick={() => void onAction("archive")} aria-label={t("archive")}>
						<Archive className="h-4 w-4" />
					</Button>
				</Tooltip>
				<Tooltip label={t("trash")}>
					<Button type="button" variant="ghost" size="sm" onClick={() => void onAction("trash")} aria-label={t("trash")}>
						<Trash2 className="h-4 w-4" />
					</Button>
				</Tooltip>
				<Tooltip label={readAction === "read" ? t("markAsRead") : t("markAsUnread")}>
					<Button type="button" variant="ghost" size="sm" onClick={() => void onAction(readAction)} aria-label={readAction === "read" ? t("markAsRead") : t("markAsUnread")}>
						{readAction === "read" ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
					</Button>
				</Tooltip>
				<Tooltip label={snoozed ? t("unsnooze") : t("snooze")}>
					<Button type="button" variant="ghost" size="sm" onClick={() => {
						if (snoozed) {
							void unsnoozeMessage(message.id);
							return;
						}
						setSnoozeOpen(true);
					}} aria-label={snoozed ? t("unsnooze") : t("snooze")}>
						<Clock className="h-4 w-4" />
					</Button>
				</Tooltip>
			</div>

			<Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("snoozeTitle")}</DialogTitle>
						<DialogDescription>{t("snoozeDescription")}</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="grid gap-2 sm:grid-cols-3">
							{snoozePresets.map((preset, index) => (
								<Button key={preset.label} type="button" variant="outline" size="sm" onClick={() => setSnoozedUntil(preset.value)}>
									{snoozePresetLabels[index] ?? preset.label}
								</Button>
							))}
						</div>
						<div className="space-y-2">
							<label htmlFor={`snooze-until-${message.id}`} className="text-sm font-medium text-neutral-700">{t("snoozeDateLabel")}</label>
							<Input id={`snooze-until-${message.id}`} type="datetime-local" value={snoozedUntil} onChange={(event) => setSnoozedUntil(event.target.value)} />
						</div>
						{error && <p className="text-sm text-red-600">{error}</p>}
						<Button type="button" onClick={() => void handleSnooze()} disabled={snoozing}>
							{snoozing ? t("snoozing") : t("snooze")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
