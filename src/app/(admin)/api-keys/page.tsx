"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardGridSkeleton } from "@/components/page-skeletons";
import { authFetch } from "@/lib/auth/client";
import type { ApiKey } from "./types";
import { parseApiKeyScopes } from "./utils";

export default function ApiKeysPage() {
	const qc = useQueryClient();
	const t = useTranslations("apiKeysAdmin");
	const [name, setName] = useState("");
	const [newKey, setNewKey] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: ["api-keys"],
		queryFn: async () => {
			const res = await authFetch("/api/api-keys");
			return (await res.json()) as { apiKeys: ApiKey[] };
		},
	});

	const create = useMutation({
		mutationFn: async () => {
			const res = await authFetch("/api/api-keys", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, scopes: ["send", "read"] }),
			});
			const json = (await res.json()) as { key?: string };
			if (!res.ok) throw new Error(t("failed"));
			setNewKey(json.key ?? null);
			setName("");
		},
		onSuccess: () => {
			setCreateOpen(false);
			qc.invalidateQueries({ queryKey: ["api-keys"] });
		},
	});

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-semibold">{t("title")}</h1>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="h-4 w-4" />
							{t("newApiKey")}
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{t("createTitle")}</DialogTitle>
							<DialogDescription>{t("createDescription")}</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label>{t("name")}</Label>
								<Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
							</div>
							{create.isError && (
								<p className="text-sm text-red-600">{(create.error as Error).message}</p>
							)}
							<Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
								{create.isPending ? t("creating") : t("createKey")}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>
			{newKey && (
				<Card className="border-blue-600/10 bg-blue-400/10">
					<CardContent className="pt-6">
						<p className="text-sm font-medium text-blue-600">{t("copyKey")}</p>
						<code className="block mt-2 text-xs break-all font-bold">{newKey}</code>
					</CardContent>
				</Card>
			)}
			<section className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-sm text-neutral-500">{t("total", { count: (data?.apiKeys ?? []).length })}</span>
				</div>
				{isLoading && (
					<CardGridSkeleton />
				)}
				{!isLoading && (data?.apiKeys ?? []).length === 0 && (
					<p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
						{t("noKeys")}
					</p>
				)}
				<div className="grid gap-3">
					{(data?.apiKeys ?? []).map((key) => (
						<div
							key={key.id}
							className="flex min-h-24 items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-100"
						>
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
								<KeyRound className="h-5 w-5" />
							</span>
							<span className="min-w-0 flex-1 space-y-2">
								<span className="block truncate text-sm font-semibold text-neutral-900">{key.name}</span>
								<span className="block truncate no-font-mono text-sm text-neutral-500">{key.prefix}...</span>
								<span className="flex flex-wrap gap-1">
									{parseApiKeyScopes(key.scopes).map((scope) => (
										<Badge key={scope} variant="outline">
											{scope}
										</Badge>
									))}
								</span>
							</span>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
