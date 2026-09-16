"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Star,
  Clock,
  Send,
  FileText,
  Archive,
  ShieldAlert,
  Trash2,
  MailPlus,
  Settings,
  HelpCircle,
} from "lucide-react";
import { useCompose } from "@/components/compose/compose-context";
import type { ShortcutDefinition, CommandItem } from "./types";
import { useHotkeys } from "./use-hotkeys";
import { CommandPalette } from "./command-palette";
import { ShortcutsHelpDialog } from "./shortcuts-help-dialog";
import { useShortcutsEnabled } from "./use-shortcuts-enabled";

interface ShortcutsContextValue {
  shortcutsEnabled: boolean;
  shortcutsPreferenceLoading: boolean;
  shortcutsPreferenceError: string | null;
  setShortcutsEnabled: (enabled: boolean) => Promise<void>;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openHelpModal: () => void;
  closeHelpModal: () => void;
  registerShortcut: (shortcut: ShortcutDefinition) => void;
  registerCommand: (command: CommandItem) => void;
  shortcuts: ShortcutDefinition[];
  commands: CommandItem[];
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) {
    throw new Error("useShortcuts must be used within a ShortcutsProvider");
  }
  return ctx;
}

export function ShortcutsProvider({
  children,
  extraShortcuts = [],
  extraCommands = [],
}: {
  children: React.ReactNode;
  extraShortcuts?: ShortcutDefinition[];
  extraCommands?: CommandItem[];
}) {
  const router = useRouter();
  const t = useTranslations("shortcuts");
  const { openComposer } = useCompose();
  const {
    enabled: shortcutsEnabled,
    error: shortcutsPreferenceError,
    isLoading: shortcutsPreferenceLoading,
    setEnabled: setShortcutsEnabled,
  } = useShortcutsEnabled();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutDefinition[]>(extraShortcuts);
  const [customCommands, setCustomCommands] = useState<CommandItem[]>(extraCommands);

  const openCommandPalette = () => {
    if (shortcutsEnabled && !shortcutsPreferenceLoading) setIsCommandPaletteOpen(true);
  };
  const closeCommandPalette = () => setIsCommandPaletteOpen(false);
  const openHelpModal = () => {
    if (shortcutsEnabled && !shortcutsPreferenceLoading) setIsHelpModalOpen(true);
  };
  const closeHelpModal = () => setIsHelpModalOpen(false);

  const registerShortcut = (shortcut: ShortcutDefinition) => {
    setCustomShortcuts((prev) => {
      const idx = prev.findIndex((s) => s.key === shortcut.key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = shortcut;
        return next;
      }
      return [...prev, shortcut];
    });
  };

  const registerCommand = (command: CommandItem) => {
    setCustomCommands((prev) => {
      const idx = prev.findIndex((c) => c.id === command.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = command;
        return next;
      }
      return [...prev, command];
    });
  };

  // Base navigation and global shortcuts
  const baseShortcuts = useMemo<ShortcutDefinition[]>(() => {
    return [
      {
        key: "k",
        modifiers: ["meta", "ctrl"],
        label: t("shortcutCommandPalette"),
        category: "General",
        action: () => setIsCommandPaletteOpen((prev) => !prev),
      },
      {
        key: "?",
        label: t("shortcutShortcutsCheatSheet"),
        category: "General",
        action: () => setIsHelpModalOpen((prev) => !prev),
      },
      {
        key: "c",
        label: t("shortcutComposeEmail"),
        category: "Composing",
        action: () => openComposer(),
      },
      {
        key: "/",
        label: t("shortcutSearchMail"),
        category: "Navigation",
        action: () => {
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[data-mail-search-input="true"]'
          );
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        },
      },
      {
        key: "g i",
        label: t("goToInbox"),
        category: "Navigation",
        action: () => router.push("/inbox"),
      },
      {
        key: "g s",
        label: t("goToStarred"),
        category: "Navigation",
        action: () => router.push("/starred"),
      },
      {
        key: "g z",
        label: t("goToSnoozed"),
        category: "Navigation",
        action: () => router.push("/snoozed"),
      },
      {
        key: "g t",
        label: t("goToSent"),
        category: "Navigation",
        action: () => router.push("/sent"),
      },
      {
        key: "g d",
        label: t("goToDrafts"),
        category: "Navigation",
        action: () => router.push("/drafts"),
      },
      {
        key: "g a",
        label: t("goToArchived"),
        category: "Navigation",
        action: () => router.push("/archived"),
      },
      {
        key: "g !",
        label: t("goToSpam"),
        category: "Navigation",
        action: () => router.push("/spam"),
      },
      {
        key: "g x",
        label: t("goToTrash"),
        category: "Navigation",
        action: () => router.push("/trash"),
      },
      {
        key: "escape",
        label: t("dismissModal"),
        category: "General",
        action: () => {
          setIsCommandPaletteOpen(false);
          setIsHelpModalOpen(false);
        },
      },
      ...customShortcuts,
    ];
  }, [router, openComposer, customShortcuts, t]);

  useHotkeys(baseShortcuts, { enabled: shortcutsEnabled && !shortcutsPreferenceLoading });

  // Base Command Palette actions
  const allCommands = useMemo<CommandItem[]>(() => {
    const builtins: CommandItem[] = [
      {
        id: "compose",
        title: t("commandCompose"),
        subtitle: t("commandComposeSubtitle"),
        category: "Actions",
        icon: MailPlus,
        shortcut: "c",
        perform: () => openComposer(),
      },
      {
        id: "nav-inbox",
        title: t("goToInbox"),
        category: "Navigation",
        icon: Inbox,
        shortcut: "g i",
        perform: () => router.push("/inbox"),
      },
      {
        id: "nav-starred",
        title: t("goToStarred"),
        category: "Navigation",
        icon: Star,
        shortcut: "g s",
        perform: () => router.push("/starred"),
      },
      {
        id: "nav-snoozed",
        title: t("goToSnoozed"),
        category: "Navigation",
        icon: Clock,
        shortcut: "g z",
        perform: () => router.push("/snoozed"),
      },
      {
        id: "nav-sent",
        title: t("goToSent"),
        category: "Navigation",
        icon: Send,
        shortcut: "g t",
        perform: () => router.push("/sent"),
      },
      {
        id: "nav-drafts",
        title: t("goToDrafts"),
        category: "Navigation",
        icon: FileText,
        shortcut: "g d",
        perform: () => router.push("/drafts"),
      },
      {
        id: "nav-archived",
        title: t("goToArchived"),
        category: "Navigation",
        icon: Archive,
        shortcut: "g a",
        perform: () => router.push("/archived"),
      },
      {
        id: "nav-spam",
        title: t("goToSpam"),
        category: "Navigation",
        icon: ShieldAlert,
        shortcut: "g !",
        perform: () => router.push("/spam"),
      },
      {
        id: "nav-trash",
        title: t("goToTrash"),
        category: "Navigation",
        icon: Trash2,
        shortcut: "g x",
        perform: () => router.push("/trash"),
      },
      {
        id: "settings-account",
        title: t("commandAccountSettings"),
        subtitle: t("commandAccountSettingsSubtitle"),
        category: "Settings",
        icon: Settings,
        perform: () => router.push("/settings/account"),
      },
      {
        id: "show-help",
        title: t("commandShortcuts"),
        subtitle: t("commandShortcutsSubtitle"),
        category: "General",
        icon: HelpCircle,
        shortcut: "?",
        perform: () => setIsHelpModalOpen(true),
      },
    ];

    return [...builtins, ...customCommands];
  }, [router, openComposer, customCommands, t]);

  return (
    <ShortcutsContext.Provider
      value={{
        shortcutsEnabled,
        shortcutsPreferenceLoading,
        shortcutsPreferenceError,
        setShortcutsEnabled,
        openCommandPalette,
        closeCommandPalette,
        openHelpModal,
        closeHelpModal,
        registerShortcut,
        registerCommand,
        shortcuts: baseShortcuts,
        commands: allCommands,
      }}
    >
      {children}
      {shortcutsEnabled && !shortcutsPreferenceLoading && (
        <>
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={closeCommandPalette}
            commands={allCommands}
          />
          <ShortcutsHelpDialog
            isOpen={isHelpModalOpen}
            onClose={closeHelpModal}
            shortcuts={baseShortcuts}
          />
        </>
      )}
    </ShortcutsContext.Provider>
  );
}
