"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LoaderCircle, MailPlus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TurnstileField } from "@/components/auth/turnstile";
import {
  getSetupStatus,
  prepareSetup,
  submitPrimaryDomain,
  submitRegistration,
} from "./utils";
import type { DomainPreflight, DomainSetupResult, SetupRequirementCheck } from "./types";

export function RegisterClient() {
  const router = useRouter();
  const t = useTranslations("register");
  const ts = useTranslations("sending");
  const tc = useTranslations("common");
  const [hasAdminAccount, setHasAdminAccount] = useState<boolean | null>(null);
  const [hasPrimaryDomain, setHasPrimaryDomain] = useState<boolean | null>(
    null,
  );
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [primaryDomainSendingRequested, setPrimaryDomainSendingRequested] = useState<boolean | null>(null);
  const [setupDomain, setSetupDomain] = useState<string | null>(null);
  const [domainCheck, setDomainCheck] = useState<DomainPreflight | null>(null);
  const [domainChecking, setDomainChecking] = useState(false);
  const [enableSending, setEnableSending] = useState(false);
  const [setupEnableSending, setSetupEnableSending] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checks, setChecks] = useState<SetupRequirementCheck[]>([]);
  const [databaseMigrated, setDatabaseMigrated] = useState(false);
  const [preparationComplete, setPreparationComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);

  useEffect(() => {
    void runPreparation();
  }, []);

  async function runPreparation() {
    setLoading(true);
    setError(null);
    setPreparationComplete(false);

    try {
      const preparation = await prepareSetup();
      setChecks(preparation.data.checks ?? []);
      setDatabaseMigrated(!!preparation.data.migrated);
      if (!preparation.ok) {
        setError(preparation.data.error ?? t("prepareFailed"));
        return;
      }

      const data = await getSetupStatus();
      setHasAdminAccount(data.hasAdminAccount);
      setHasPrimaryDomain(data.hasPrimaryDomain);
      setPrimaryDomain(data.primaryDomain?.hostname ?? null);
      setPrimaryDomainSendingRequested(data.primaryDomain?.sendingRequested ?? null);
      setPreparationComplete(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("prepareError"));
    } finally {
      setLoading(false);
    }
  }

  async function onDomainSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const hostname = String(new FormData(e.currentTarget).get("domain") ?? "").toLowerCase().trim();
    const usedCachedCheck = domainCheck?.hostname === hostname;
    const result: { ok: boolean; data: DomainSetupResult } = usedCachedCheck
      ? { ok: true, data: { domain: domainCheck } }
      : await submitPrimaryDomain(hostname);
    const { ok, data } = result;
    setLoading(false);
    if (!ok || !data.domain) {
      setError(
        typeof data.error === "string" ? data.error : t("domainSetupFailed"),
      );
      return;
    }
    setSetupDomain(data.domain.hostname);
    setSetupEnableSending(usedCachedCheck ? enableSending : true);
    setStep(3);
  }

  async function onDomainBlur(e: React.FocusEvent<HTMLInputElement>) {
    const hostname = e.currentTarget.value.toLowerCase().trim();
    if (hostname.length < 3 || domainCheck?.hostname === hostname) return;

    setDomainChecking(true);
    setError(null);
    const { ok, data } = await submitPrimaryDomain(hostname);
    setDomainChecking(false);
    if (!ok || !data.domain) {
      setDomainCheck(null);
      setEnableSending(false);
      setError(typeof data.error === "string" ? data.error : t("domainCheckFailed"));
      return;
    }

    setDomainCheck(data.domain);
    setEnableSending(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const domain = setupDomain ?? primaryDomain;
    if (!domain) {
      setLoading(false);
      setError(t("domainIncomplete"));
      return;
    }

    const { ok, data } = await submitRegistration(form, {
      firstRun: true,
      domain,
      enableSending: setupDomain
        ? setupEnableSending
        : primaryDomainSendingRequested ?? undefined,
    });
    setLoading(false);
    if (!ok) {
      setError(
        typeof data.error === "string" ? data.error : t("failed"),
      );
      setTurnstileReset((value) => value + 1);
      return;
    }
    router.push(data.redirect ?? "/inbox");
  }

  const accountDomain = setupDomain ?? primaryDomain;
  const showDomainStep = hasPrimaryDomain === false && step === 2;

  if (hasAdminAccount === true) {
    return (
      <AuthShell
        icon={MailPlus}
        title={t("closedTitle")}
        footer={
          <Link
            href="/login"
            className="inline-flex items-center gap-2 hover:underline"
          >
            {t("signInInstead")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {t("closedBody", { domain: primaryDomain ?? t("thisWorkspace") })}
          </p>
          <Button
            type="button"
            className="h-11 w-full rounded-full px-6 active:scale-[0.98]"
            onClick={() => router.push("/login")}
          >
            {t("goToLogin")}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={MailPlus}
      title={step === 1 ? t("titleSystem") : showDomainStep ? t("titleDomain") : t("titleAccount")}
      // description={
      // 	showDomainStep
      // 		? "Connect the primary Cloudflare zone first so routing records can be created before the first mailbox."
      // 		: `Choose a mailbox username on ${accountDomain ?? "the primary domain"} and add a recovery email.`
      // }
      steps={
        [
          { label: t("stepSystem"), active: step === 1 },
          { label: t("stepDomain"), active: step === 2 },
          { label: t("stepAccount"), active: step === 3 },
        ]
      }
    >
      {step === 1 ? (
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {t("systemBody")}
          </p>
          <div className="space-y-2">
            {loading && checks.length === 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t("checkingInstallation")}
              </div>
            )}
            {checks.map((check) => (
              <div key={check.key} className="flex items-start gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
                {check.configured ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <div>
                  <p className="text-sm font-medium text-neutral-800">{check.key}</p>
                  {!check.configured && <p className="mt-1 text-xs leading-5 text-neutral-500">{check.message}</p>}
                </div>
              </div>
            ))}
            {preparationComplete && (
              <div className="flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {databaseMigrated ? t("dbMigrated") : t("dbReady")}
              </div>
            )}
          </div>
          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          {preparationComplete ? (
            <Button
              type="button"
              className="h-11 w-full rounded-full px-6 active:scale-[0.98]"
              onClick={() => setStep(hasPrimaryDomain ? 3 : 2)}
            >
              {tc("continue")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-full px-6 active:scale-[0.98]"
              disabled={loading}
              onClick={() => void runPreparation()}
            >
              {loading ? t("checking") : t("checkAgain")}
            </Button>
          )}
        </div>
      ) : showDomainStep ? (
        <form method="post" onSubmit={onDomainSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="domain">{t("primaryDomain")}</Label>
            <Input
              id="domain"
              name="domain"
              placeholder="example.com"
              autoComplete="url"
              required
              onBlur={(event) => void onDomainBlur(event)}
              onChange={(event) => {
                if (domainCheck?.hostname !== event.currentTarget.value.toLowerCase().trim()) {
                  setDomainCheck(null);
                  setEnableSending(false);
                }
              }}
            />
            <p className="text-xs leading-5 text-neutral-500">
              {t("domainHint")}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-neutral-50 px-4 py-3">
            <div>
              <Label htmlFor="setup-enable-sending">{ts("label")}</Label>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                {domainChecking
                  ? ts("checkingAccess")
                  : domainCheck
                    ? enableSending
                      ? ts("required")
                      : ts("receiveOnly")
                    : ts("hint")}
              </p>
            </div>
            <Switch
              id="setup-enable-sending"
              checked={enableSending}
              onCheckedChange={setEnableSending}
              disabled={domainChecking || !domainCheck}
            />
          </div>
          {domainCheck && (
            <div className="flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {ts("found", { zone: domainCheck.zone.name })}
            </div>
          )}
          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="h-11 w-full rounded-full px-6 active:scale-[0.98]"
            disabled={loading || domainChecking}
          >
            {loading ? tc("adding") : tc("continue")}
          </Button>
        </form>
      ) : (
        <form method="post" onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">{t("username")}</Label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 relative">
              <Input
                id="username"
                name="username"
                placeholder="you"
                autoComplete="username"
                required
								className="pr-34"
              />
              <span className="max-w-36 truncate text-sm font-medium text-neutral-500 absolute top-2.5 right-5">
                @{accountDomain ?? "domain"}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{tc("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resetEmail">{t("recoveryEmail")}</Label>
            <Input
              id="resetEmail"
              name="resetEmail"
              type="email"
              placeholder="you@gmail.com"
              required
            />
            {/* <p className="text-xs leading-5 text-neutral-500">Used later for password reset.</p> */}
          </div>

          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <TurnstileField resetSignal={turnstileReset} />
          <Button
            type="submit"
            className="h-11 w-full rounded-full px-6 active:scale-[0.98] mt-8"
            disabled={loading || hasAdminAccount === null || hasPrimaryDomain === null}
          >
            {loading ? tc("creating") : t("createAccount")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
