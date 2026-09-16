"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Activity, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { CardGridSkeleton } from "@/components/page-skeletons";
import type { Webhook, WebhookEvent } from "./types";
import {
	WEBHOOK_EVENTS,
	WEBHOOK_EVENT_LABEL_KEYS,
	createWebhook,
	deleteWebhook,
	fetchWebhooks,
	testWebhook,
	updateWebhook,
} from "./utils";
import { WebhookDeliveries } from "./deliveries";

export default function WebhooksPage() {
	const qc = useQueryClient();
	const t = useTranslations("webhooksAdmin");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [url, setUrl] = useState("");
	const [description, setDescription] = useState("");
	const [maxAttempts, setMaxAttempts] = useState(5);
	const [events, setEvents] = useState<WebhookEvent[]>(WEBHOOK_EVENTS.map((e) => e.value));
	const [secret, setSecret] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [expanded, setExpanded] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<Record<string, string>>({});

	const webhooks = useQuery({ queryKey: ["webhooks"], queryFn: fetchWebhooks });
	const invalidate = () => qc.invalidateQueries({ queryKey: ["webhooks"] });

	const create = useMutation({
		mutationFn: () => createWebhook({ url, description: description || undefined, events, maxAttempts }),
		onSuccess: (result) => {
			setSecret(result.secret);
			setUrl("");
			setDescription("");
			setError(null);
			setDialogOpen(false);
			invalidate();
		},
		onError: (e: Error) => setError(e.message),
	});

	const toggle = useMutation({
		mutationFn: (hook: Webhook) => updateWebhook(hook.id, { enabled: !hook.enabled }),
		onSuccess: invalidate,
	});

	const remove = useMutation({ mutationFn: deleteWebhook, onSuccess: invalidate });

	const runTest = useMutation({
		mutationFn: testWebhook,
		onSuccess: (result, id) => {
			setTestResult((prev) => ({ ...prev, [id]: result.status }));
			invalidate();
		},
		onError: (e: Error, id) => setTestResult((prev) => ({ ...prev, [id]: e.message })),
	});

	function toggleEvent(event: WebhookEvent) {
		setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">{t("title")}</h1>
					<p className="mt-1 text-sm text-neutral-500">
						{t("description")}
					</p>
				</div>
				<Button
					onClick={() => {
						setError(null);
						setDialogOpen(true);
					}}
				>
					<Plus className="h-4 w-4" /> {t("addEndpoint")}
				</Button>
			</div>

			{secret && (
				<Card>
					<CardContent className="pt-6 text-sm">
						<p className="font-medium">{t("secretShownOnce")}</p>
						<p className="mt-1 text-neutral-500">
							{t.rich("secretHint", { code: (chunks) => <code>{chunks}</code> })}
						</p>
						<code className="mt-2 block break-all rounded-lg bg-neutral-100 p-2 text-xs">
							{secret}
						</code>
						<Button variant="outline" size="sm" className="mt-3" onClick={() => setSecret(null)}>
							{t("dismiss")}
						</Button>
					</CardContent>
				</Card>
			)}

			{webhooks.isLoading ? (
				<CardGridSkeleton />
			) : !webhooks.data?.length ? (
				<Card>
					<CardContent className="pt-6 text-sm text-neutral-500">
						{t("noEndpoints")}
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{webhooks.data.map((hook) => (
						<Card key={hook.id}>
							<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									<CardTitle className="truncate text-base">{hook.url}</CardTitle>
									{hook.description && (
										<p className="mt-1 text-sm text-neutral-500">{hook.description}</p>
									)}
									<div className="mt-2 flex flex-wrap gap-1">
										{hook.events.map((event) => (
											<Badge key={event} variant="secondary">
												{t(WEBHOOK_EVENT_LABEL_KEYS[event])}
											</Badge>
										))}
										{!hook.enabled && <Badge variant="outline">{t("disabledBadge")}</Badge>}
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Switch checked={hook.enabled} onCheckedChange={() => toggle.mutate(hook)} />
									<Button
										variant="outline"
										size="sm"
										onClick={() => runTest.mutate(hook.id)}
										disabled={runTest.isPending}
									>
										<Send className="h-4 w-4" /> {t("test")}
									</Button>
									<Button variant="ghost" size="sm" onClick={() => remove.mutate(hook.id)}>
										<Trash2 className="h-4 w-4 text-red-600" />
									</Button>
								</div>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex flex-wrap gap-4 text-sm text-neutral-600">
									<span>{t("deliveriesCount", { count: hook.stats.total })}</span>
									<span className="text-green-600">{t("deliveredCount", { count: hook.stats.delivered })}</span>
									<span className="text-amber-600">{t("inFlightCount", { count: hook.stats.pending })}</span>
									<span className="text-red-600">{t("failedCount", { count: hook.stats.failing })}</span>
									<span className="text-neutral-400">{t("upToAttempts", { count: hook.maxAttempts })}</span>
								</div>

								{testResult[hook.id] && (
									<p className="text-sm text-neutral-600">
										{t("testDelivery")} <span className="font-medium">{testResult[hook.id]}</span>
									</p>
								)}

								<Button
									variant="outline"
									size="sm"
									onClick={() => setExpanded(expanded === hook.id ? null : hook.id)}
								>
									<Activity className="h-4 w-4" />
									{expanded === hook.id ? t("hideDeliveries") : t("viewDeliveries")}
								</Button>

								{expanded === hook.id && <WebhookDeliveries webhookId={hook.id} />}
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{t("addEndpointTitle")}</DialogTitle>
						<DialogDescription>
							{t("addEndpointDescription")}
						</DialogDescription>
					</DialogHeader>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							create.mutate();
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="hook-url">{t("endpointUrl")}</Label>
							<Input
								id="hook-url"
								type="url"
								required
								value={url}
								onChange={(e) => setUrl(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="hook-description">{t("descriptionLabel")}</Label>
							<Input
								id="hook-description"
								value={description}
								placeholder={t("optionalPlaceholder")}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>{t("events")}</Label>
							{WEBHOOK_EVENTS.map((event) => (
								<label
									key={event.value}
									className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 px-3 py-2"
								>
									<span>
										<span className="block text-sm font-medium">{t(event.label)}</span>
										<span className="block text-xs text-neutral-500">{t(event.hint)}</span>
									</span>
									<input
										type="checkbox"
										className="h-4 w-4"
										checked={events.includes(event.value)}
										onChange={() => toggleEvent(event.value)}
									/>
								</label>
							))}
						</div>
						<div className="space-y-2">
							<Label htmlFor="hook-attempts">{t("maxAttempts")}</Label>
							<Input
								id="hook-attempts"
								type="number"
								min={1}
								max={10}
								value={maxAttempts}
								onChange={(e) => setMaxAttempts(Number(e.target.value))}
							/>
						</div>

						{error && <p className="text-sm text-red-600">{error}</p>}

						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
								{t("cancel")}
							</Button>
							<Button type="submit" disabled={create.isPending || events.length === 0}>
								<RefreshCw
									className={create.isPending ? "h-4 w-4 animate-spin" : "hidden"}
								/>
								{t("create")}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
