"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { LicenseStatus } from "@/lib/licenses/types";
import type { ActivatableLicensePlan, LicenseAction } from "./types";
import { formatLicensePlan, loadLicenseStatus, runLicenseAction } from "./utils";

export function LicenseActivation() {
	const t = useTranslations("licensesAdmin");
	const [license, setLicense] = useState<LicenseStatus | null>(null);
	const [licenseKey, setLicenseKey] = useState("");
	const [selectedPlan, setSelectedPlan] = useState<ActivatableLicensePlan>("pro");
	const [loading, setLoading] = useState(true);
	const [action, setAction] = useState<LicenseAction | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		loadLicenseStatus()
			.then((nextLicense) => {
				if (!cancelled) setLicense(nextLicense);
			})
			.catch((error) => {
				if (!cancelled) setStatus(error instanceof Error ? error.message : t("unableToLoadStatus"));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [t]);

	async function submit(nextAction: LicenseAction) {
		if (nextAction !== "deactivate" && !licenseKey.trim()) {
			setStatus(t("enterLicenseKey"));
			return;
		}
		if (nextAction === "deactivate" && !window.confirm(t("deactivateConfirm"))) return;

		setAction(nextAction);
		setStatus(null);
		try {
			const nextLicense = await runLicenseAction(nextAction, licenseKey, nextAction === "activate" ? selectedPlan : undefined);
			setLicense(nextLicense);
			setLicenseKey("");
			setStatus(nextAction === "deactivate" ? t("licenseDeactivated") : nextAction === "validate" ? t("licenseValidated") : t("licenseActivatedStatus"));
		} catch (error) {
			setStatus(error instanceof Error ? error.message : t("requestFailed"));
			try {
				setLicense(await loadLicenseStatus());
			} catch {
				// Keep the last visible status when the local status endpoint is unavailable.
			}
		} finally {
			setAction(null);
		}
	}

	if (loading) return <Skeleton className="h-64 w-full rounded-3xl" />;

	const hasActivation = !!license?.activatedAt && license.state !== "deactivated";

	if (license?.active) {
		return (
			<Card className="rounded-3xl border-0 bg-white px-6">
				<CardContent className="flex items-start gap-4 py-8">
					<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
						<CheckCircle2 className="h-6 w-6" />
					</span>
					<div className="min-w-0 flex-1">
						<CardTitle>{t("activatedTitle")}</CardTitle>
						<p className="mt-2 text-sm leading-6 text-neutral-600">
							{t("activeDescription", { plan: formatLicensePlan(license.plan) })}
						</p>
						<Button type="button" variant="outline" className="mt-5" onClick={() => void submit("deactivate")} disabled={action !== null}>
							{action === "deactivate" ? t("deactivating") : t("deactivateLicense")}
						</Button>
						{status && <p className="mt-3 text-sm text-neutral-500">{status}</p>}
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="rounded-3xl border-0 bg-white px-6">
			<CardHeader>
				<div className="flex items-center justify-between gap-4">
					<div className="space-y-1.5">
						<CardTitle>{t("activationTitle")}</CardTitle>
						<CardDescription>{t("activationDescription")}</CardDescription>
					</div>
					<Badge variant={license?.active ? "default" : "outline"}>
						{formatLicensePlan(license?.plan ?? "community")}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-5 pb-6">
				{hasActivation && license && (
					<p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
						{t("stateHint", { state: license.state })}
					</p>
				)}
				{!hasActivation && (
					<div className="space-y-2">
						<Label htmlFor="licensePlan">{t("product")}</Label>
						<Select
							id="licensePlan"
							value={selectedPlan}
							onChange={(event) => setSelectedPlan(event.target.value as ActivatableLicensePlan)}
							disabled={action !== null}
							className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="pro">Pro</option>
							<option value="team">Team</option>
						</Select>
					</div>
				)}
				<div className="space-y-2">
					<Label htmlFor="licenseKey">{t("licenseKey")}</Label>
					<Input
						id="licenseKey"
						type="password"
						autoComplete="off"
						value={licenseKey}
						onChange={(event) => setLicenseKey(event.target.value)}
						placeholder={t("licenseKeyPlaceholder")}
						disabled={action !== null}
					/>
					<p className="text-xs text-neutral-500">{t("licenseKeyHint")}</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					{hasActivation ? (
						<>
							<Button type="button" onClick={() => void submit("validate")} disabled={action !== null}>
								{action === "validate" ? t("validating") : t("validateLicense")}
							</Button>
							<Button type="button" variant="outline" onClick={() => void submit("deactivate")} disabled={action !== null}>
								{action === "deactivate" ? t("deactivating") : t("deactivate")}
							</Button>
						</>
					) : (
						<Button type="button" onClick={() => void submit("activate")} disabled={action !== null}>
							{action === "activate" ? t("activating") : t("activateLicense")}
						</Button>
					)}
					{status && <p className="text-sm text-neutral-500">{status}</p>}
				</div>
			</CardContent>
		</Card>
	);
}
