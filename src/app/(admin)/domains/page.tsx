"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, LoaderCircle, Plus } from "lucide-react";
import { authFetch } from "@/lib/auth/client";
import type { DnsStatusSummary, Domain, DomainDnsView, DomainPreflight } from "./types";
import DomainItemCard from "./DomainItemCard";
import DomainDnsDetails from "./DomainDnsDetails";
import { CardGridSkeleton } from "@/components/page-skeletons";
import { checkDomain } from "./utils";

export default function DomainsPage() {
  const qc = useQueryClient();
  const t = useTranslations("domainsAdmin");
  const [hostname, setHostname] = useState("");
  // Self-hosted installs without Cloudflare credentials manage DNS by hand.
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await (await authFetch("/api/auth/me")).json()) as { managesDns?: boolean },
  });
  const managesDns = me?.managesDns ?? true;
  const [domainCheck, setDomainCheck] = useState<DomainPreflight | null>(null);
  const [domainChecking, setDomainChecking] = useState(false);
  const [enableSending, setEnableSending] = useState(false);
  const [domainCheckError, setDomainCheckError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dnsView, setDnsView] = useState<{
    domain: Domain;
    dns: DomainDnsView;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: async () => {
      const res = await authFetch("/api/domains?includeDns=true");
      return (await res.json()) as {
        domains: Domain[];
        dns: Record<string, DnsStatusSummary>;
      };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const normalized = hostname.toLowerCase().trim();
      let checkedDomain = domainCheck;
      let sendingRequested = enableSending;
      if (checkedDomain?.hostname !== normalized) {
        const result = await checkDomain(normalized);
        if (!result.ok || !result.domain) {
          throw new Error(result.error ?? t("domainCheckFailed"));
        }
        checkedDomain = result.domain;
        sendingRequested = true;
        setDomainCheck(result.domain);
        setEnableSending(sendingRequested);
      }
      if (!checkedDomain) throw new Error(t("domainCheckFailed"));

      const res = await authFetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: checkedDomain.hostname,
          enableRouting: true,
          enableSending: sendingRequested,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? t("failed"));
      return json;
    },
    onSuccess: () => {
      setHostname("");
      setDomainCheck(null);
      setEnableSending(false);
      setDomainCheckError(null);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/domains/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("failed"));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });

  const loadDns = async (id: string) => {
    const res = await authFetch(`/api/domains/${id}/dns`);
    const json = (await res.json()) as { domain: Domain; dns: DomainDnsView };
    if (res.ok) setDnsView(json);
  };

  const inspectDomain = async () => {
    const normalized = hostname.toLowerCase().trim();
    if (normalized.length < 3 || domainCheck?.hostname === normalized) return;

    setDomainChecking(true);
    setDomainCheckError(null);
    const result = await checkDomain(normalized);
    setDomainChecking(false);
    if (!result.ok || !result.domain) {
      setDomainCheck(null);
      setEnableSending(false);
      setDomainCheckError(result.error ?? t("domainCheckFailed"));
      return;
    }

    setDomainCheck(result.domain);
    setEnableSending(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium">{t("title")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {managesDns
              ? t("descriptionManaged")
              : t("descriptionSelfHosted")}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              {t("newDomain")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addDomainTitle")}</DialogTitle>
              <DialogDescription>
                {t("addDomainDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hostname">{t("hostname")}</Label>
                <Input
                  id="hostname"
                  value={hostname}
                  onChange={(e) => {
                    setHostname(e.target.value);
                    if (domainCheck?.hostname !== e.target.value.toLowerCase().trim()) {
                      setDomainCheck(null);
                      setEnableSending(false);
                    }
                  }}
                  onBlur={() => void inspectDomain()}
                  placeholder={t("hostnamePlaceholder")}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-neutral-50 px-4 py-3">
                <div>
                  <Label htmlFor="enable-sending">{t("enableSending")}</Label>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    {domainChecking
                      ? t("checkingCloudflare")
                      : domainCheck
                        ? enableSending
                          ? t("requiredToSend")
                          : t("receiveOnly")
                        : t("enterDomainToVerify")}
                  </p>
                </div>
                {domainChecking ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-neutral-500" />
                ) : (
                  <Switch
                    id="enable-sending"
                    checked={enableSending}
                    onCheckedChange={setEnableSending}
                    disabled={!domainCheck}
                  />
                )}
              </div>
              {domainCheck && (
                <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("domainFound", { zone: domainCheck.zone.name })}
                </div>
              )}
              {domainCheckError && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {domainCheckError}
                </p>
              )}
              {create.isError && (
                <div className="space-y-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p>{(create.error as Error).message}</p>
                  <div className="space-y-2">
                    <p className="font-medium">
                      {t("permissionsHint")}
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>
                        {t("permissionAccounts")}
                      </li>
                      <li>
                        {t("permissionZones")}
                      </li>
                    </ul>
                  </div>
                </div>
              )}
              <Button
                onClick={() => create.mutate()}
                disabled={!hostname || domainChecking || create.isPending}
              >
                {create.isPending ? t("adding") : t("addDomainAction")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <section className="space-y-3">
        {/* <div className="flex items-center justify-between">
					<span className="text-sm text-neutral-500">{(data?.domains ?? []).length} total</span>
				</div> */}
        {isLoading && (
          <CardGridSkeleton />
        )}
        {!isLoading && (data?.domains ?? []).length === 0 && (
          <p className="rounded-2xl bg-white px-5 py-4 text-sm text-neutral-500">
            {t("noDomains")}
          </p>
        )}
        <div className="grid gap-3">
          {(data?.domains ?? []).map((d) => {
            const dns = data?.dns?.[d.id];
            return (
              <DomainItemCard
                key={d.id}
                dns={dns}
                loadDns={loadDns}
                item={d}
                remove={remove}
              />
            );
          })}
        </div>
      </section>
      {dnsView && (
        <DomainDnsDetails domain={dnsView.domain} dns={dnsView.dns} />
      )}
    </div>
  );
}
