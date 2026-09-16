"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  Archive,
  Clock,
  FileText,
  Folder,
  Inbox,
  MailPlus,
  Plus,
  Send,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSelectedMailbox } from "@/components/mailbox-provider";
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
import { useMessageCounts } from "@/hooks/use-message-counts";
import { authFetch } from "@/lib/auth/client";
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLOR_OPTIONS,
} from "@/lib/folders/colors";
import type { FolderColor } from "@/lib/folders/types";
import { cn } from "@/lib/utils";
import { NavItem } from "./components-nav";
import type { NavLink } from "./components-nav-types";
import type { CustomFolder } from "./dashboard-nav-types";
import {
  getFolderNavCount,
  moveMessagesToCustomFolder,
  moveMessagesToSystemFolder,
} from "./dashboard-nav-utils";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarHeader } from "./sidebar-header";
import { useSidebar } from "./sidebar-state";

const links = [
  { href: "/compose", labelKey: "compose", icon: MailPlus, primary: true },
  { href: "/inbox", labelKey: "inbox", icon: Inbox, preloadMessages: true },
  { href: "/starred", labelKey: "starred", icon: Star, preloadMessages: true },
  { href: "/snoozed", labelKey: "snoozed", icon: Clock, preloadMessages: true },
  { href: "/sent", labelKey: "sent", icon: Send, preloadMessages: true },
  { href: "/drafts", labelKey: "drafts", icon: FileText, preloadMessages: true },
  {
    href: "/archived",
    labelKey: "archived",
    icon: Archive,
    preloadMessages: true,
  },
  { href: "/spam", labelKey: "spam", icon: ShieldAlert, preloadMessages: true },
  { href: "/trash", labelKey: "trash", icon: Trash2, preloadMessages: true },
];

export function DashboardNav({ className }: { className?: string }) {
  const { minimal } = useSidebar();
  const { selectedMailbox, isLoading } = useSelectedMailbox();
  const { counts } = useMessageCounts(selectedMailbox?.id, !isLoading);
  const [folders, setFolders] = useState<CustomFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] =
    useState<FolderColor>(DEFAULT_FOLDER_COLOR);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const t = useTranslations("nav");
  const linksWithCounts: NavLink[] = links.map((link): NavLink => {
    const { labelKey, ...rest } = link;
    const label = t(labelKey);
    if (rest.href === "/inbox") {
      return { ...rest, label, count: getFolderNavCount("inbox", counts.folders) };
    }
    if (rest.href === "/starred") {
      return { ...rest, label, count: getFolderNavCount("starred", counts.folders) };
    }
    if (rest.href === "/snoozed") {
      return { ...rest, label, count: getFolderNavCount("snoozed", counts.folders) };
    }
    if (rest.href === "/sent") {
      return { ...rest, label, count: getFolderNavCount("sent", counts.folders) };
    }
    if (rest.href === "/drafts") {
      return { ...rest, label, count: getFolderNavCount("drafts", counts.folders) };
    }
    if (rest.href === "/archived") {
      return {
        ...rest,
        label,
        count: getFolderNavCount("archived", counts.folders),
        onMessageDrop: (messageIds: string[]) =>
          void moveMessagesToSystemFolder(messageIds, "archive"),
      };
    }
    if (rest.href === "/spam") {
      return {
        ...rest,
        label,
        count: getFolderNavCount("spam", counts.folders),
        onMessageDrop: (messageIds: string[]) =>
          void moveMessagesToSystemFolder(messageIds, "spam"),
      };
    }
    if (rest.href === "/trash") {
      return {
        ...rest,
        label,
        count: getFolderNavCount("trash", counts.folders),
        onMessageDrop: (messageIds: string[]) =>
          void moveMessagesToSystemFolder(messageIds, "trash"),
      };
    }
    return { ...rest, label };
  });

  useEffect(() => {
    if (!selectedMailbox?.id) {
      setFolders([]);
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({ mailboxId: selectedMailbox.id });
    authFetch(`/api/folders?${params.toString()}`)
      .then(
        (response) => response.json() as Promise<{ folders?: CustomFolder[] }>,
      )
      .then((data) => {
        if (!cancelled) setFolders(data.folders ?? []);
      })
      .catch(() => {
        if (!cancelled) setFolders([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMailbox?.id]);

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMailbox?.id || !newFolderName.trim()) return;

    setAddingFolder(true);
    try {
      const response = await authFetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxId: selectedMailbox.id,
          name: newFolderName,
          color: newFolderColor,
        }),
      });
      if (!response.ok) return;
      const folder = (await response.json()) as CustomFolder;
      setFolders((items) =>
        [...items, folder].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewFolderName("");
      setNewFolderColor(DEFAULT_FOLDER_COLOR);
      setFolderDialogOpen(false);
    } finally {
      setAddingFolder(false);
    }
  }

  return (
    <nav className={cn("flex min-h-full flex-col gap-1", className)}>
      <SidebarHeader href="/inbox" />
      {linksWithCounts.map((link, i) => (
        <NavItem link={link} key={`nav-${link.href || i}`} />
      ))}
      {!minimal && (
        <div className="mt-2 flex h-8 items-center justify-between px-3">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {t("folders")}
          </span>
          {selectedMailbox && (
            <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-blue-50 hover:text-blue-700"
                  aria-label={t("createFolder")}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("createFolder")}</DialogTitle>
                  <DialogDescription>
                    {t("createFolderHint")}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={createFolder} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="folderName">{t("folderName")}</Label>
                    <Input
                      id="folderName"
                      value={newFolderName}
                      onChange={(event) => setNewFolderName(event.target.value)}
                      placeholder={t("folderNamePlaceholder")}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("color")}</Label>
                    <div
                      className="flex flex-wrap gap-2"
                      role="radiogroup"
                      aria-label={t("folderColor")}
                    >
                      {FOLDER_COLOR_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={newFolderColor === option.value}
                          aria-label={option.label}
                          title={option.label}
                          onClick={() => setNewFolderColor(option.value)}
                          className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                            newFolderColor === option.value
                              ? "border-neutral-900 ring-2 ring-neutral-300 ring-offset-2"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: option.value }}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={addingFolder || !newFolderName.trim()}
                  >
                    {addingFolder ? t("creating") : t("createFolder")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
      {!minimal && folders.length === 0 && (
        <div className="mx-3 rounded-lg border border-dashed border-neutral-200 px-3 py-3 text-xs text-neutral-400">
          {t("noFolders")}
        </div>
      )}
      {folders.map((folder) => (
        <NavItem
          key={folder.id}
          link={{
            href: `/folders/${folder.id}`,
            label: folder.name,
            icon: Folder,
            preloadMessages: true,
            iconColor: folder.color,
            count: counts.customFolders[folder.id]?.unread,
            onMessageDrop: (messageIds: string[]) =>
              void moveMessagesToCustomFolder(messageIds, folder.id),
          }}
        />
      ))}
      <span className="flex-1" />
      <SidebarFooter />
    </nav>
  );
}
