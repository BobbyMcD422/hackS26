import { useState } from "react";
import type { ChangeEvent } from "react";
import { GraduationCap, MapPin, Trash2, Upload, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import CalendarView from "@/components/CalendarView";
import { buildShareableIcsUrl, uploadIcsFile } from "@/lib/api";
import { parseIcsToCalendarEvents, type CalendarEvent } from "@/lib/ics";

export default function MainPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [shareableIcsUrl, setShareableIcsUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [hasImported, setHasImported] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const remainingClasses = getRemainingClassesSummary(events);

  async function handleFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsImporting(true);
    setError(null);
    setWarnings([]);

    try {
      const uploadedFile = await uploadIcsFile(file);
      const icsText = await file.text();
      const result = parseIcsToCalendarEvents(icsText);

      setEvents(result.events);
      setWarnings(result.warnings);
      setImportedFileName(file.name);
      setShareableIcsUrl(buildShareableIcsUrl(uploadedFile.url));
      setCopyState("idle");
      setHasImported(true);
      setSelectedEvent(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The file could not be imported.",
      );
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  async function handleCopyIcsLink() {
    if (!shareableIcsUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareableIcsUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  function handleDeleteSelectedEvent() {
    if (!selectedEvent) {
      return;
    }

    setEvents((currentEvents) => currentEvents.filter((event) => event.id !== selectedEvent.id));
    setSelectedEvent(null);
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-black dark:bg-zinc-800 dark:text-white">
      <header className="flex items-center justify-between border-b border-sky-100 bg-sky-300 p-4 shadow-sm dark:border-sky-900 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <span>How Many Classes Left</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold">Import your ICS calendar</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Upload a local <code>.ics</code> export to load classes into the calendar for this
                session.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700">
                <Upload className="size-4" />
                <span>{isImporting ? "Importing..." : "Choose ICS File"}</span>
                <input
                  className="hidden"
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={handleFileImport}
                  disabled={isImporting}
                />
              </label>

              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {importedFileName ? (
                  <div className="flex flex-col items-start gap-1 text-left sm:items-end">
                    <span>
                      Loaded <span className="font-medium">{importedFileName}</span> with{" "}
                      <span className="font-medium">{events.length}</span> events.
                    </span>
                    {shareableIcsUrl ? (
                      <button
                        type="button"
                        onClick={handleCopyIcsLink}
                        className="text-sky-700 underline decoration-sky-400 underline-offset-2 dark:text-sky-300"
                      >
                        {copyState === "copied"
                          ? "Copied ICS link"
                          : copyState === "failed"
                            ? "Copy failed"
                            : "Copy ICS link"}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span>No file imported yet.</span>
                )}
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            ) : null}

            {!error && hasImported && events.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                No valid events were found in that ICS file.
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                {warnings[0]}
                {warnings.length > 1 ? ` (+${warnings.length - 1} more warnings)` : ""}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                  Classes Left
                </p>
                {remainingClasses ? (
                  <>
                    <div className="mt-2 text-3xl font-semibold">
                      {remainingClasses.totalRemaining}
                    </div>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                      {remainingClasses.totalRemaining === 1 ? "class instance" : "class instances"}{" "}
                      remaining from today forward
                    </p>
                    <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                      {remainingClasses.byTitle.map((entry) => (
                        <div
                          key={entry.title}
                          className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2 text-sm dark:bg-zinc-900/70"
                        >
                          <span className="truncate pr-3 font-medium">{entry.title}</span>
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/70 dark:text-sky-100">
                            {entry.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-2 text-3xl font-semibold">--</div>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                      Import a calendar to calculate the remaining classes.
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Today
                </p>
                <div className="mt-2 text-lg font-semibold">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  The countdown updates against your current local date.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 dark:bg-zinc-950/20">
            <CalendarView events={events} onEventClick={setSelectedEvent} />
          </div>
        </div>
      </main>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
                  Event Details
                </p>
                <h2 className="mt-2 text-xl font-semibold">{selectedEvent.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Close event details"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-200">
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/80">
                <div className="font-medium">When</div>
                <div className="mt-1 text-zinc-600 dark:text-zinc-300">
                  {formatEventTimeRange(selectedEvent)}
                </div>
              </div>

              {selectedEvent.extendedProps?.location ? (
                <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/80">
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="size-4 text-sky-600 dark:text-sky-400" />
                    <span>Location</span>
                  </div>
                  <div className="mt-1 text-zinc-600 dark:text-zinc-300">
                    {selectedEvent.extendedProps.location}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedEvent}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                <Trash2 className="size-4" />
                Delete This Instance
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatEventTimeRange(event: CalendarEvent) {
  if (event.allDay) {
    const allDayDate = new Date(event.start);
    return allDayDate.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;

  const startLabel = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (!end) {
    return startLabel;
  }

  const endLabel = end.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startLabel} - ${endLabel}`;
}

function getRemainingClassesSummary(events: CalendarEvent[]) {
  const now = new Date();

  const futureEvents = events.filter((event) => {
    const comparisonDate = new Date(event.end ?? event.start);

    return !Number.isNaN(comparisonDate.getTime()) && comparisonDate >= now;
  });

  if (futureEvents.length === 0) {
    return null;
  }

  const countsByTitle = new Map<string, number>();

  for (const event of futureEvents) {
    countsByTitle.set(event.title, (countsByTitle.get(event.title) ?? 0) + 1);
  }

  return {
    totalRemaining: futureEvents.length,
    byTitle: Array.from(countsByTitle.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title)),
  };
}
