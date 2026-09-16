"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth/client";
import { LicenseRequiredOverlay } from "@/components/license-required-overlay";
import type { Account, AccountResponse, Domain } from "./types";

export default function AccountsPage() {
	const t = useTranslations("accountsAdmin");
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [domains, setDomains] = useState<Domain[]>([]);
	const [username, setUsername] = useState("");
	const [domainId, setDomainId] = useState("");
	const [role, setRole] = useState<"admin" | "user">("user");
	const [password, setPassword] = useState("");
	const [generateApiKey, setGenerateApiKey] = useState(true);
	const [allowedRecipients, setAllowedRecipients] = useState("");
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [teamRequired, setTeamRequired] = useState(false);

	const loadAccounts = useCallback(async () => {
		const response = await authFetch("/api/accounts");
		const data = (await response.json()) as AccountResponse;
		if (!response.ok) throw new Error(data.error ?? t("unableToLoadAccounts"));
		setAccounts(data.accounts ?? []);
	}, [t]);

	useEffect(() => {
		loadAccounts().then(async () => {
			const response = await authFetch("/api/domains");
			const data = (await response.json()) as { domains?: Domain[]; error?: string };
			if (!response.ok) throw new Error(data.error ?? t("unableToLoadDomains"));
			setDomains(data.domains ?? []);
			setDomainId(data.domains?.[0]?.id ?? "");
		}).catch((error) => {
			const text = error instanceof Error ? error.message : t("unableToLoadAccounts");
			setTeamRequired(/team license/i.test(text));
			setMessage(text);
		}).finally(() => setLoading(false));
	}, [loadAccounts, t]);

	async function createAccount(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setMessage(null);
		try {
			const recipients = allowedRecipients.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
			const response = await authFetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, domainId, role, generateApiKey, ...(recipients.length > 0 ? { allowedRecipients: recipients } : {}), ...(password ? { password } : {}) }) });
			const data = (await response.json()) as AccountResponse;
			if (!response.ok) throw new Error(data.error ?? t("unableToCreateAccount"));
			setUsername("");
			setPassword("");
			setAllowedRecipients("");
			setCreateOpen(false);
			if (data.apiKey) setCreatedKey(data.apiKey);
			await loadAccounts();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : t("unableToCreateAccount"));
		} finally {
			setSaving(false);
		}
	}

	return <div className="space-y-6">
		<div className="flex items-center justify-between gap-4"><div><h1 className="text-3xl font-medium text-neutral-900">{t("title")}</h1><p className="mt-2 text-sm text-neutral-500">{t("description")}</p></div>{!teamRequired && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />{t("newAccount")}</Button>}</div>
		<div className="relative">{teamRequired && <LicenseRequiredOverlay required="Team"><div className="min-h-48 rounded-3xl bg-white" /></LicenseRequiredOverlay>}<div className="grid gap-3">
			{loading && <p className="text-sm text-neutral-500">{t("loading")}</p>}
			{accounts.map((account) => <Link key={account.id} href={`/accounts/${account.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-5 transition-colors hover:bg-blue-50/40"><span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-700">{account.name.charAt(0).toUpperCase()}{account.hasAvatar && <img src={`/api/accounts/${account.id}/avatar`} alt="" className="absolute inset-0 h-full w-full object-cover" />}</span><span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate font-semibold text-neutral-900">{account.name}</span><span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">{account.role}</span></span><span className="block truncate text-sm text-neutral-500">{account.email}</span></span></Link>)}
		</div></div>
		<Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>{t("addUserTitle")}</DialogTitle><DialogDescription>{t("addUserDescription")}</DialogDescription></DialogHeader><form onSubmit={createAccount} className="space-y-4">
			<div className="space-y-2"><Label htmlFor="account-username">{t("email")}</Label><div className="flex h-10 overflow-hidden rounded-md border border-neutral-200 bg-white"><Input id="account-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t("emailPlaceholder")} className="min-w-0 flex-1 rounded-none border-0 shadow-none" required /><span className="flex items-center text-sm text-neutral-400">@</span><Select aria-label={t("domainAria")} value={domainId} onChange={(event) => setDomainId(event.target.value)} className="max-w-[55%] bg-transparent px-3 text-sm" required><option value="">{t("selectDomain")}</option>{domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.hostname}</option>)}</Select></div></div>
			<div className="space-y-2"><Label htmlFor="account-password">{t("password")}</Label><Input id="account-password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /><p className="text-xs text-neutral-500">{t("passwordOptionalHint")}</p></div>
			<div className="flex items-start gap-2"><input id="account-generate-key" type="checkbox" checked={generateApiKey} onChange={(event) => setGenerateApiKey(event.target.checked)} className="mt-1 h-4 w-4" /><div><Label htmlFor="account-generate-key">{t("generateApiKey")}</Label><p className="text-xs text-neutral-500">{t("generateApiKeyHint")}</p></div></div>
			{generateApiKey && <div className="space-y-2"><Label htmlFor="account-allowed-recipients">{t("allowedRecipients")}</Label><Textarea id="account-allowed-recipients" rows={3} value={allowedRecipients} onChange={(event) => setAllowedRecipients(event.target.value)} placeholder={t("allowedRecipientsPlaceholder")} /><p className="text-xs text-neutral-500">{t("allowedRecipientsHint")}</p></div>}
			<div className="space-y-2"><Label htmlFor="account-role">{t("role")}</Label><Select id="account-role" value={role} onChange={(event) => setRole(event.target.value as "admin" | "user")} className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"><option value="user">{t("roleUser")}</option><option value="admin">{t("roleAdmin")}</option></Select></div>
			{message && <p className="text-sm text-red-600">{message}</p>}<Button type="submit" disabled={saving || !domainId}>{saving ? t("creating") : t("createAccount")}</Button>
		</form></DialogContent></Dialog>
		<Dialog open={createdKey !== null} onOpenChange={(open) => { if (!open) setCreatedKey(null); }}><DialogContent><DialogHeader><DialogTitle>{t("apiKeyCreatedTitle")}</DialogTitle><DialogDescription>{t("apiKeyCreatedHint")}</DialogDescription></DialogHeader>
			<div className="space-y-3">
				<Input readOnly aria-label={t("keyAria")} value={createdKey ?? ""} onFocus={(event) => event.currentTarget.select()} />
				<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => { if (createdKey) void navigator.clipboard.writeText(createdKey); }}>{t("copy")}</Button><Button type="button" onClick={() => setCreatedKey(null)}>{t("done")}</Button></div>
			</div>
		</DialogContent></Dialog>
	</div>;
}
