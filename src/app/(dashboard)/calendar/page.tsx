"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth/client";
import { useSelectedMailbox } from "@/components/mailbox-provider";

type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  attendees: string;
};

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [adding, setAdding] = useState(false);
  const [guests, setGuests] = useState("");
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | string | null>(null);
  const { selectedMailbox } = useSelectedMailbox();
  useEffect(() => {
    const start = new Date();
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    void authFetch(
      `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`,
    )
      .then((response) => response.json())
      .then((data) => setEvents(data.events ?? []));
  }, []);
  async function addEvent() {
    setPendingAction("save");
    try {
    const response = await authFetch(
      editing ? `/api/calendar/events/${editing.id}` : "/api/calendar/events",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startsAt,
          endsAt,
          attendees: guests.split(","),
          mailboxId: selectedMailbox?.id,
          from:
            selectedMailbox?.senderAddresses?.[0] ??
            (selectedMailbox
              ? `${selectedMailbox.localPart}@${selectedMailbox.hostname}`
              : ""),
        }),
      },
    );
    const data = await response.json();
    if (response.ok) {
      setEvents((items) =>
        editing
          ? items.map((event) =>
              event.id === editing.id
                ? {
                    ...event,
                    title,
                    startsAt,
                    endsAt,
                    attendees: JSON.stringify(
                      guests.split(",").filter(Boolean),
                    ),
                  }
                : event,
            )
          : [...items, data.event].sort((a, b) =>
              a.startsAt.localeCompare(b.startsAt),
            ),
      );
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setGuests("");
      setEditing(null);
      setAdding(false);
    }
    } finally {
      setPendingAction(null);
    }
  }
  async function deleteEvent(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    setPendingAction(id);
    try {
    const response = await authFetch(`/api/calendar/events/${id}`, {
      method: "DELETE",
    });
    if (response.ok)
      setEvents((items) => items.filter((event) => event.id !== id));
    } finally {
      setPendingAction(null);
    }
  }
  function editEvent(event: CalendarEvent) {
    setEditing(event);
    setTitle(event.title);
    setStartsAt(event.startsAt.slice(0, 16));
    setEndsAt(event.endsAt.slice(0, 16));
    setGuests(JSON.parse(event.attendees || "[]").join(", "));
    setAdding(true);
  }
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-neutral-900">
            <CalendarDays className="h-7 w-7 text-blue-600" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t("description")}
          </p>
        </div>
        <Button disabled={pendingAction !== null} onClick={() => { setEditing(null); setAdding(true); }}>
          <Plus className="h-4 w-4" />
          {t("newEvent")}
        </Button>
      </div>
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">{editing ? t("editEvent") : t("createEvent")}</h2>
            <div className="mt-5 grid gap-3">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("eventTitlePlaceholder")}
              />
              <Input
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
                placeholder={t("guestsPlaceholder")}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  aria-label={t("startDateTime")}
                />
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  aria-label={t("endDateTime")}
                />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" disabled={pendingAction === "save"} onClick={() => { setEditing(null); setAdding(false); }}>
                  {t("cancel")}
                </Button>
                <Button
                  onClick={() => void addEvent()}
                  disabled={!title || !startsAt || !endsAt || pendingAction === "save"}
                >
                  {pendingAction === "save" ? (editing ? t("saving") : t("creating")) : (editing ? t("saveChanges") : t("createEvent"))}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-neutral-200">
        {events.length === 0 ? (
          <p className="p-8 text-center text-sm text-neutral-500">
            {t("empty")}
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-5 border-b border-neutral-100 px-5 py-4 last:border-b-0"
            >
              <div className="w-36">
                <span>{new Date(event.startsAt).toLocaleDateString()}</span>
                <time className="text-xs text-neutral-500 flex flex-col">
                  <span>{new Date(event.startsAt).toLocaleTimeString()}</span>
                </time>
              </div>
              <div className="flex-1">
                <p className="font-medium text-neutral-900">{event.title}</p>
                {event.location && (
                  <p className="text-sm text-neutral-500">{event.location}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("editEvent")}
                disabled={pendingAction !== null}
                onClick={() => void editEvent(event)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("deleteEvent")}
                disabled={pendingAction !== null}
                onClick={() => void deleteEvent(event.id)}
              >
                <Trash2 className="h-4 w-4" />{pendingAction === event.id && <span className="sr-only">{t("deleting")}</span>}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
