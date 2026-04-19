import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventClickArg } from "@fullcalendar/core";
import type { CalendarEvent } from "@/lib/ics";

type CalendarViewProps = {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
};

export default function CalendarView({ events, onEventClick }: CalendarViewProps) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin]}
      initialView="dayGridMonth"
      events={events}
      height="auto"
      fixedWeekCount={false}
      eventClick={(info: EventClickArg) => {
        info.jsEvent.preventDefault();
        info.jsEvent.stopPropagation();

        const originalEvent = events.find((event) => event.id === info.event.id);

        onEventClick?.(
          originalEvent ?? {
            id: info.event.id,
            title: info.event.title,
            start: info.event.startStr,
            end: info.event.endStr || undefined,
            allDay: info.event.allDay,
            extendedProps: {
              location:
                typeof info.event.extendedProps.location === "string"
                  ? info.event.extendedProps.location
                  : undefined,
            },
          },
        );
      }}
      eventContent={(info) => {
        const location =
          typeof info.event.extendedProps.location === "string"
            ? info.event.extendedProps.location
            : null;

        return (
          <div className="overflow-hidden">
            <div className="truncate font-medium">{info.event.title}</div>
            {location ? (
              <div className="truncate text-[10px] opacity-80">{location}</div>
            ) : null}
          </div>
        );
      }}
    />
  );
}
