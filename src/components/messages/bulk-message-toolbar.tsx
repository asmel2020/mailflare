"use client";

import { Archive, Mail, MailOpen, ShieldAlert, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import type { BulkMessageAction } from "@/app/api/messages/bulk/types";
import type { BulkMessageToolbarProps } from "./types";

export function BulkMessageToolbar({
	selectedCount,
	hasUnreadSelection,
	hideSelectedCount = false,
	onAction,
	onClearSelection,
	pending,
}: BulkMessageToolbarProps) {
	const t = useTranslations("bulk");
	return (
		<div className="flex min-w-0 items-center gap-2 text-neutral-600 w-full">
			{!hideSelectedCount && (
				<span className="mr-2 text-sm font-medium text-neutral-800">
					{t("selectedCount", { count: selectedCount })}
				</span>
			)}
			<Tooltip label={t("archive")}>
				<Button variant="ghost" size="sm" onClick={() => onAction("archive")} disabled={pending} aria-label={t("archive")}>
					<Archive className="h-4 w-4" />
				</Button>
			</Tooltip>
			<Tooltip label={t("reportSpam")}>
				<Button variant="ghost" size="sm" onClick={() => onAction("spam")} disabled={pending} aria-label={t("reportSpam")}>
					<ShieldAlert className="h-4 w-4" />
				</Button>
			</Tooltip>
			<Tooltip label={t("delete")}>
				<Button variant="ghost" size="sm" onClick={() => onAction("trash")} disabled={pending} aria-label={t("delete")}>
					<Trash2 className="h-4 w-4" />
				</Button>
			</Tooltip>
			<Tooltip label={hasUnreadSelection ? t("markAsRead") : t("markAsUnread")}>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onAction(hasUnreadSelection ? "read" : "unread")}
					disabled={pending}
					aria-label={hasUnreadSelection ? t("markAsRead") : t("markAsUnread")}
				>
					{hasUnreadSelection ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
				</Button>
			</Tooltip>
			<span className="flex-1" />
			<Tooltip label={t("moveSelected")}>
					<Select
						className="bg-white text-xs font-medium py-2 text-neutral-700 outline-none"
						disabled={pending}
						defaultValue=""
						aria-label={t("moveSelected")}
						onChange={(event) => {
							if (!event.target.value) return;
							onAction(event.target.value as BulkMessageAction);
							event.target.value = "";
						}}
					>
						<option value="">{t("moveTo")}</option>
						<option value="archive">{t("archived")}</option>
						<option value="spam">{t("spam")}</option>
						<option value="trash">{t("trash")}</option>
					</Select>
			</Tooltip>
			<Tooltip label={t("clearSelection")}>
				<Button variant="ghost" size="sm" onClick={onClearSelection} disabled={pending} aria-label={t("clearSelection")}>
					<X className="h-4 w-4" />
				</Button>
			</Tooltip>
		</div>
	);
}
