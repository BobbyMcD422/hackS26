import ICAL from "ical.js";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  extendedProps?: {
    location?: string;
  };
};

export type IcsImportResult = {
  events: CalendarEvent[];
  warnings: string[];
};

const MAX_RECURRING_OCCURRENCES = 500;
const RECURRING_WINDOW_MONTHS = 12;

export function parseIcsToCalendarEvents(icsText: string): IcsImportResult {
  try {
    const parsed = ICAL.parse(icsText);
    const calendar = new ICAL.Component(parsed);
    const eventComponents = calendar.getAllSubcomponents("vevent");
    const recurringWindow = getRecurringWindow();
    const warnings: string[] = [];
    const events: CalendarEvent[] = [];

    for (const eventComponent of eventComponents) {
      const icalEvent = new ICAL.Event(eventComponent);

      // Recurrence exceptions are applied through the base recurring event.
      if (icalEvent.isRecurrenceException()) {
        continue;
      }

      try {
        if (icalEvent.isRecurring()) {
          events.push(
            ...expandRecurringEvent(icalEvent, recurringWindow.start, recurringWindow.end, warnings),
          );
        } else {
          const normalized = normalizeOccurrence(
            `${icalEvent.uid || "event"}:${formatIcalTime(icalEvent.startDate)}`,
            icalEvent.summary,
            icalEvent.startDate,
            icalEvent.endDate,
            icalEvent.location,
          );

          if (normalized) {
            events.push(normalized);
          }
        }
      } catch {
        warnings.push(
          `Skipped "${icalEvent.summary || "Untitled Event"}" because its recurrence could not be read.`,
        );
      }
    }

    events.sort((left, right) => left.start.localeCompare(right.start));

    return {
      events,
      warnings,
    };
  } catch {
    throw new Error("Unable to parse that ICS file. Please upload a valid .ics calendar export.");
  }
}

function expandRecurringEvent(
  icalEvent: ICAL.Event,
  rangeStart: ICAL.Time,
  rangeEnd: ICAL.Time,
  warnings: string[],
) {
  const expandedEvents: CalendarEvent[] = [];
  const iterator = icalEvent.iterator();
  let occurrenceCount = 0;
  let occurrence = iterator.next();

  while (occurrence) {
    if (occurrence.compare(rangeEnd) > 0) {
      break;
    }

    if (occurrence.compare(rangeStart) >= 0) {
      const details = icalEvent.getOccurrenceDetails(occurrence);
      const normalized = normalizeOccurrence(
        `${icalEvent.uid || "event"}:${formatIcalTime(details.recurrenceId)}`,
        details.item.summary,
        details.startDate,
        details.endDate,
        details.item.location,
      );

      if (normalized) {
        expandedEvents.push(normalized);
      }

      occurrenceCount += 1;

      if (occurrenceCount >= MAX_RECURRING_OCCURRENCES) {
        warnings.push(
          `Showing only the next ${MAX_RECURRING_OCCURRENCES} occurrences for "${icalEvent.summary || "Untitled Event"}".`,
        );
        break;
      }
    }

    occurrence = iterator.next();
  }

  return expandedEvents;
}

function normalizeOccurrence(
  id: string,
  summary: string,
  startDate: ICAL.Time | null,
  endDate: ICAL.Time | null,
  location?: string,
): CalendarEvent | null {
  if (!startDate) {
    return null;
  }

  const event: CalendarEvent = {
    id,
    title: summary || "Untitled Event",
    start: formatIcalTime(startDate),
  };

  if (endDate) {
    event.end = formatIcalTime(endDate);
  }

  if (startDate.isDate) {
    event.allDay = true;
  }

  if (location) {
    event.extendedProps = {
      location,
    };
  }

  return event;
}

function formatIcalTime(time: ICAL.Time) {
  if (time.isDate) {
    return [
      time.year.toString().padStart(4, "0"),
      time.month.toString().padStart(2, "0"),
      time.day.toString().padStart(2, "0"),
    ].join("-");
  }

  return time.toJSDate().toISOString();
}

function getRecurringWindow() {
  const start = new Date();
  start.setMonth(start.getMonth() - RECURRING_WINDOW_MONTHS);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + RECURRING_WINDOW_MONTHS * 2);
  end.setHours(23, 59, 59, 999);

  return {
    start: ICAL.Time.fromJSDate(start, false),
    end: ICAL.Time.fromJSDate(end, false),
  };
}
