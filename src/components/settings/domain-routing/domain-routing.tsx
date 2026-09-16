"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Forward, Inbox, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoutingRuleSelect } from "./routing-rule-select";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { CardGridSkeleton } from "@/components/page-skeletons";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import type { DomainRoutingProps, DomainRule, DomainRuleInput } from "./types";
import {
	createDomainRule,
	deleteDomainRule,
	describeRule,
	emptyRuleInput,
	fetchDomainRules,
	formatLastMatched,
	ruleToInput,
	updateDomainRule,
} from "./utils";

const ACTION_ICONS = {
	store: Inbox,
	forward: Forward,
	reject: Ban,
} as const;

export function DomainRouting({ domain }: DomainRoutingProps = {}) {
	const t = useTranslations("domainRouting");
	const qc = useQueryClient();
	const { selectedMailbox, isLoading: isMailboxLoading } = useSelectedMailbox();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<DomainRule | null>(null);
	const [form, setForm] = useState<DomainRuleInput>(emptyRuleInput(""));
	const [error, setError] = useState<string | null>(null);

	const domainId = domain?.id ?? selectedMailbox?.domainId ?? "";
	const mailboxId = selectedMailbox?.id ?? "";
	const mailboxAccessId = domain ? undefined : mailboxId;
	const canManage = !!domain || selectedMailbox?.permission === "full_access";
	const rulesQueryKey = ["domain-rules", domainId, mailboxAccessId ?? "admin"] as const;

	const rules = useQuery({
		queryKey: rulesQueryKey,
		enabled: !!domainId && (!!domain || !!mailboxId) && canManage,
		queryFn: () => fetchDomainRules(domainId, mailboxAccessId),
	});

	const hostname = domain?.hostname ?? selectedMailbox?.hostname ?? "";
	const mailboxes = rules.data?.mailboxes ?? [];

	const actionLabels = {
		store: t("actionStore"),
		forward: t("actionForward"),
		reject: t("actionReject"),
	};
	const matchFieldLabels = {
		recipient: t("fieldRecipient"),
		sender: t("fieldSender"),
		title: t("fieldTitle"),
		content: t("fieldContent"),
	};
	const matchOperatorLabels = {
		contains: t("operatorContains"),
		exact: t("operatorExact"),
		starts_with: t("operatorStartsWith"),
		ends_with: t("operatorEndsWith"),
		regex: t("operatorRegex"),
	};

	const save = useMutation({
		mutationFn: () => {
			const payload: DomainRuleInput = { ...form, domainId };
			return editing
				? updateDomainRule(editing.id, payload, mailboxAccessId)
				: createDomainRule(payload, mailboxAccessId);
		},
		onSuccess: () => {
			setDialogOpen(false);
			setEditing(null);
			setError(null);
			qc.invalidateQueries({ queryKey: rulesQueryKey });
		},
		onError: (e: Error) => setError(e.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => deleteDomainRule(id, mailboxAccessId),
		onSuccess: () => qc.invalidateQueries({ queryKey: rulesQueryKey }),
	});

	const toggle = useMutation({
		mutationFn: (rule: DomainRule) =>
			updateDomainRule(rule.id, { ...ruleToInput(rule), enabled: !rule.enabled }, mailboxAccessId),
		onSuccess: () => qc.invalidateQueries({ queryKey: rulesQueryKey }),
	});

	function openCreate() {
		setEditing(null);
		setError(null);
		setForm(emptyRuleInput(domainId));
		setDialogOpen(true);
	}

	function openEdit(rule: DomainRule) {
		setEditing(rule);
		setError(null);
		setForm(ruleToInput(rule));
		setDialogOpen(true);
	}

	const blockRules = (rules.data?.rules ?? []).filter((r) => r.action === "reject");
	const fallbackRules = (rules.data?.rules ?? []).filter((r) => r.action !== "reject");

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<h2 className="text-2xl font-semibold">{t("title")}</h2>
						<Tooltip label={t("aboutTooltip")}>
							<button type="button" aria-label={t("aboutAria")} className="text-neutral-400 hover:text-neutral-700">
								<Info className="h-4 w-4" />
							</button>
						</Tooltip>
					</div>
					<p className="mt-1 text-sm text-neutral-500">{t("rulesFor", { hostname: hostname || t("selectInbox") })}</p>
				</div>
				<div className="flex items-end gap-2">
					<Button onClick={openCreate} disabled={!domainId || (!domain && !mailboxId) || !canManage}>
						<Plus className="h-4 w-4" /> {t("addRoute")}
					</Button>
				</div>
			</div>

			{(!domain && isMailboxLoading) || rules.isLoading ? (
				<CardGridSkeleton />
			) : !domain && !mailboxId ? (
				<Card>
					<CardContent className="pt-6 text-sm text-neutral-500">
						{t("selectInboxBeforeRules")}
					</CardContent>
				</Card>
			) : !canManage ? (
				<Card>
					<CardContent className="pt-6 text-sm text-neutral-500">
						{t("fullAccessRequired")}
					</CardContent>
				</Card>
			) : (
				<div className="space-y-1 overflow-hidden rounded-3xl">
					<RuleSection
						className="rounded-b-lg rounded-t-3xl"
						title={t("blockRulesTitle")}
						description={t("blockRulesDescription")}
						rules={blockRules}
						hostname={hostname}
						mailboxes={mailboxes}
						onEdit={openEdit}
						onDelete={(id) => remove.mutate(id)}
						onToggle={(rule) => toggle.mutate(rule)}
					/>
					<RuleSection
						className="rounded-b-3xl rounded-t-lg"
						title={t("catchAllTitle")}
						description={t("catchAllDescription")}
						rules={fallbackRules}
						hostname={hostname}
						mailboxes={mailboxes}
						onEdit={openEdit}
						onDelete={(id) => remove.mutate(id)}
						onToggle={(rule) => toggle.mutate(rule)}
					/>
				</div>
			)}

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				{/* The form grows when the action changes, so the dialog must scroll rather than overflow the viewport. */}
				<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-[560px]">
					<DialogHeader>
						<DialogTitle>{editing ? t("editRule") : t("addRoutingRule")}</DialogTitle>
						<DialogDescription>{t("dialogDescription")}</DialogDescription>
					</DialogHeader>

					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							save.mutate();
						}}
					>
						<div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
						<div className="grid min-w-0 gap-2">
							<Label htmlFor="rule-name">{t("nameLabel")}</Label>
							<Input
								id="rule-name"
								value={form.name ?? ""}
								placeholder={t("namePlaceholder")}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
							/>
						</div>

						<div className="grid min-w-0 gap-2">
							<Label htmlFor="rule-action">{t("actionLabel")}</Label>
							<RoutingRuleSelect
								id="rule-action"
								value={form.action}
								onChange={(e) =>
									setForm({ ...form, action: e.target.value as DomainRuleInput["action"] })
								}
							>
								{Object.entries(actionLabels).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</RoutingRuleSelect>
						</div>
						</div>

						<div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
							<div className="grid min-w-0 gap-2">
								<Label htmlFor="rule-field">{t("matchOn")}</Label>
								<RoutingRuleSelect
									id="rule-field"
									value={form.matchField}
									onChange={(e) =>
										setForm({ ...form, matchField: e.target.value as DomainRuleInput["matchField"] })
									}
								>
									{Object.entries(matchFieldLabels).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</RoutingRuleSelect>
							</div>
							<div className="grid min-w-0 gap-2">
								<Label htmlFor="rule-operator">{t("condition")}</Label>
								<RoutingRuleSelect
									id="rule-operator"
									value={form.matchOperator}
									onChange={(e) =>
										setForm({
											...form,
											matchOperator: e.target.value as DomainRuleInput["matchOperator"],
										})
									}
								>
									{Object.entries(matchOperatorLabels).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</RoutingRuleSelect>
							</div>
						</div>

						<div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
							<div className="grid min-w-0 gap-2">
								<div className="flex items-center gap-2">
									<Label htmlFor="rule-value">{t("matchValue")}</Label>
									<Tooltip label={t("matchValueTooltip")}>
										<span className="text-neutral-400"><Info className="h-4 w-4" /></span>
									</Tooltip>
								</div>
								<Input
									id="rule-value"
									required
									value={form.matchValue}
									placeholder={t("matchValuePlaceholder")}
									onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
								/>
							</div>
							<div className="grid min-w-0 gap-2">
								<div className="flex items-center gap-2">
									<Label htmlFor="rule-priority">{t("priority")}</Label>
									<Tooltip label={t("priorityTooltip")}>
										<span className="text-neutral-400"><Info className="h-4 w-4" /></span>
									</Tooltip>
								</div>
								<Input
									id="rule-priority"
									type="number"
									min={0}
									max={1000}
									value={form.priority}
									onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
								/>
							</div>
						</div>

						{form.action !== "reject" && (
							<div className={form.action === "forward" ? "grid grid-cols-1 items-end gap-4 sm:grid-cols-2" : "grid min-w-0 gap-2"}>
							<div className="grid min-w-0 gap-2">
								<Label htmlFor="rule-mailbox">
									{form.action === "forward" ? t("mailboxKeptCopy") : t("destinationMailbox")}
								</Label>
								<RoutingRuleSelect
									id="rule-mailbox"
									value={form.mailboxId ?? ""}
									onChange={(e) => setForm({ ...form, mailboxId: e.target.value || null })}
								>
									<option value="">{t("selectMailboxOption")}</option>
									{mailboxes.map((mailbox) => (
										<option key={mailbox.id} value={mailbox.id}>
											{mailbox.localPart}@{hostname}
											{mailbox.disabled ? t("mailboxDisabledSuffix") : ""}
										</option>
									))}
								</RoutingRuleSelect>
							</div>
							{form.action === "forward" && (
								<div className="grid min-w-0 gap-2">
									<Label htmlFor="rule-forward">{t("forwardTo")}</Label>
									<Input
										id="rule-forward"
										type="email"
										required
										value={form.forwardTo ?? ""}
										onChange={(e) => setForm({ ...form, forwardTo: e.target.value })}
									/>
								</div>
							)}
							</div>
						)}

						{form.action === "forward" && (
							<div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
								<div>
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium">{t("keepCopy")}</p>
										<Tooltip label={t("keepCopyTooltip")}>
											<span className="text-neutral-400"><Info className="h-4 w-4" /></span>
										</Tooltip>
									</div>
								</div>
								<Switch
									checked={form.keepCopy}
									onCheckedChange={(keepCopy) => setForm({ ...form, keepCopy })}
								/>
							</div>
						)}

						{form.action === "reject" && (
							<div className="grid min-w-0 gap-2">
								<Label htmlFor="rule-reason">{t("rejectionReason")}</Label>
								<Input
									id="rule-reason"
									value={form.rejectReason ?? ""}
									placeholder={t("rejectionReasonPlaceholder")}
									onChange={(e) => setForm({ ...form, rejectReason: e.target.value })}
								/>
							</div>
						)}

						{error && <p className="text-sm text-red-600">{error}</p>}

						<div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
							<Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
								{t("cancel")}
							</Button>
							<Button type="submit" disabled={save.isPending}>
								{editing ? t("saveChanges") : t("createRule")}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function RuleSection({
	className,
	title,
	description,
	rules,
	hostname,
	mailboxes,
	onEdit,
	onDelete,
	onToggle,
}: {
	className: string;
	title: string;
	description: string;
	rules: DomainRule[];
	hostname: string;
	mailboxes: { id: string; localPart: string; displayName: string | null; disabled: boolean }[];
	onEdit: (rule: DomainRule) => void;
	onDelete: (id: string) => void;
	onToggle: (rule: DomainRule) => void;
}) {
	const t = useTranslations("domainRouting");
	return (
		<Card className={`${className} border-0 bg-white px-6`}>
			<CardHeader>
				<div className="flex items-center gap-2">
					<CardTitle className="text-xs uppercase">{title}</CardTitle>
					<Tooltip label={description}>
						<span className="text-neutral-400"><Info className="h-4 w-4" /></span>
					</Tooltip>
				</div>
			</CardHeader>
			<CardContent className="space-y-2 pb-5">
				{rules.length === 0 ? (
					<p className="text-sm text-neutral-500">{t("noRulesYet")}</p>
				) : (
					rules.map((rule) => {
						const Icon = ACTION_ICONS[rule.action];
						return (
							<div
								key={rule.id}
								className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2"
							>
								<Icon className="h-4 w-4 shrink-0 text-neutral-500" />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate text-sm font-medium">
											{rule.name || describeRule(rule, mailboxes, hostname)}
										</p>
										{!rule.enabled && <Badge variant="secondary">{t("disabledBadge")}</Badge>}
									</div>
									{rule.name && (
										<p className="truncate text-xs text-neutral-500">
											{describeRule(rule, mailboxes, hostname)}
										</p>
									)}
									<p className="text-xs text-neutral-400">
										{t("priorityLine", {
											priority: rule.priority,
											count: rule.matchCount,
											last: formatLastMatched(rule.lastMatchedAt),
										})}
									</p>
								</div>
								<Switch checked={rule.enabled} onCheckedChange={() => onToggle(rule)} />
								<Button variant="ghost" size="sm" onClick={() => onEdit(rule)}>
									<Pencil className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="sm" onClick={() => onDelete(rule.id)}>
									<Trash2 className="h-4 w-4 text-red-600" />
								</Button>
							</div>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}
