"use client";

import {
  DatabaseBackup,
  Globe2,
  Activity,
  Mail,
  Settings,
  Palette,
  BadgeDollarSign,
  Users,
  Route,
  Webhook,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NavItem } from "./components-nav";
import { SidebarFooter } from "./sidebar-footer";
import { useBranding } from "./branding-provider";
import { SidebarHeader } from "./sidebar-header";
import { useSidebar } from "./sidebar-state";

export function AdminNav({ className }: { className?: string }) {
  const branding = useBranding();
  const { minimal } = useSidebar();
  const t = useTranslations("adminNav");
  const sections = [
    {
      // label: "Overview",
      links: [{ href: "/admin", label: t("overview"), icon: Settings }],
    },
    {
      label: t("sectionEmail"),
      links: [
        { href: "/mailboxes", label: t("mailboxes"), icon: Mail },
        { href: "/domains", label: t("domains"), icon: Globe2 },
        { href: "/routing", label: t("routing"), icon: Route },
        { href: "/webhooks", label: t("webhooks"), icon: Webhook },
      ],
    },
    {
      label: t("sectionAdministration"),
      links: [
        { href: "/accounts", label: t("accounts"), icon: Users },
        { href: "/activity", label: t("activity"), icon: Activity },
        { href: "/backups", label: t("backups"), icon: DatabaseBackup },
      ],
    },
    {
      label: t("sectionProduct"),
      links: [
        { href: "/branding", label: t("branding"), icon: Palette },
        { href: "/licenses", label: t("licenses"), icon: BadgeDollarSign },
        // { href: "/api-keys", label: "API Keys", icon: KeyRound },
      ],
    },
  ];

  return (
    <nav className={cn("flex min-h-full flex-col gap-1", className)}>
      <SidebarHeader href="/inbox" label={t("admin")} />
      <div className={cn("space-y-4", minimal && "space-y-2")}>
        {sections.map((section) => {
          const links = section.links.filter(
            (link) =>
              (link.href !== "/branding" || branding.canCustomizeBranding) &&
              // Local fork override: the license page is not used here.
              link.href !== "/licenses",
          );
          if (links.length === 0) return null;

          return (
            // The first section has no label, so fall back to its first href for a stable key.
            <section key={section.label ?? links[0].href}>
              {!minimal && section.label && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  {section.label}
                </p>
              )}
              <div className="space-y-1">
                {links.map((link) => (
                  <NavItem link={link} key={link.href} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <span className="flex-1" />
      <SidebarFooter />
    </nav>
  );
}
