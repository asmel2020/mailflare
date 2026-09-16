"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, ImagePlus, LockKeyhole, Palette } from "lucide-react";
import { useBranding } from "@/components/branding-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRANDING_ICON_ACCEPT, saveBranding } from "./utils";

export default function BrandingPage() {
	const t = useTranslations("brandingAdmin");
	const branding = useBranding();
	const [appName, setAppName] = useState(branding.appName);
	const [icon, setIcon] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setAppName(branding.appName);
	}, [branding.appName]);

	if (!branding.canCustomizeBranding) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-medium text-neutral-900">{t("pageTitle")}</h1>
					<p className="mt-2 text-sm text-neutral-500">{t("lockedDescription")}</p>
				</div>
				<Card className="rounded-3xl border-0 bg-white p-6">
					<CardHeader className="py-0">
						<CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" />{t("licenseRequired")}</CardTitle>
						<CardDescription>{t("lockedHint")}</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
						<Button asChild><a href="https://app.paymug.co/buy/mailflare-pro" target="_blank" rel="noopener noreferrer">{t("buyPro")} <ExternalLink className="h-4 w-4" /></a></Button>
						<Button asChild variant="outline"><a href="https://app.paymug.co/buy/mailflare-team" target="_blank" rel="noopener noreferrer">{t("buyTeam")} <ExternalLink className="h-4 w-4" /></a></Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	function pickIcon(file: File | null) {
		setIcon(file);
		if (preview) URL.revokeObjectURL(preview);
		setPreview(file ? URL.createObjectURL(file) : null);
	}

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setStatus(null);
		try {
			await saveBranding(appName.trim(), icon);
			await branding.refreshBranding();
			setIcon(null);
			setStatus(t("brandingUpdated"));
		} catch (error) {
			setStatus(error instanceof Error ? error.message : t("unableToSave"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-medium text-neutral-900">{t("pageTitle")}</h1>
				<p className="mt-2 text-sm text-neutral-500">{t("pageDescription")}</p>
			</div>
			<Card className="rounded-3xl border-0 bg-white p-6">
				<CardHeader className="py-0">
					<CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />{t("appIdentity")}</CardTitle>
					<CardDescription>{t("iconHint")}</CardDescription>
				</CardHeader>
				<CardContent className="pt-6">
					<form onSubmit={submit} className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="appName">{t("appName")}</Label>
							<Input id="appName" value={appName} maxLength={60} onChange={(event) => setAppName(event.target.value)} required />
						</div>
						<div className="space-y-2">
							<Label>{t("appIcon")}</Label>
							<Input ref={inputRef} type="file" accept={BRANDING_ICON_ACCEPT} className="hidden" onChange={(event) => pickIcon(event.target.files?.[0] ?? null)} />
							<button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-4 rounded-2xl border border-dashed border-neutral-300 p-4 text-left hover:bg-neutral-50">
								<img src={preview ?? branding.iconUrl} alt={t("iconPreviewAlt")} className="h-16 w-16 rounded-2xl object-cover" />
								<span className="text-sm text-neutral-600"><ImagePlus className="mb-1 h-5 w-5" />{t("chooseIconFormats")}<br /><span className="text-xs text-neutral-400">{t("maxSize")}</span></span>
							</button>
						</div>
						{status && <p className="text-sm text-neutral-600">{status}</p>}
						<Button type="submit" disabled={saving || !appName.trim()}>{saving ? t("saving") : t("saveBranding")}</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
