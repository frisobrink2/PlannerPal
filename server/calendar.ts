import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { google, accessToken } from "./google";
import {
  microsoftCalendar,
  microsoftWrite,
  graph,
  graphEvent,
  type GraphEvent,
} from "./microsoft";
import { hash } from "./crypto";
import { audit, transaction, type Queryable } from "./db";
import { timeZone } from "./config";
import { PublicError, ProviderError } from "./http";
import type { Account } from "./auth";
export const dateString = z.iso
  .date()
  .refine((d) => d >= "2000-01-01" && d <= "2100-12-31");
export const scheduleInput = z.object({
  taskId: z.string().uuid(),
  version: z.number().int().positive(),
  date: dateString,
  time: z.string().regex(/^(09|1[0-6]):[0-5]\d$/),
  confirmed: z.literal(true),
});
export type CalendarEvent = {
  id: string;
  summary?: string;
  status?: string;
  transparency?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  lookupKey?: string;
};
export function rangeFor(date: string) {
  const start = fromZonedTime(date + "T00:00:00", timeZone);
  const next = new Date(date + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start: start.toISOString(),
    end: fromZonedTime(
      next.toISOString().slice(0, 10) + "T00:00:00",
      timeZone,
    ).toISOString(),
  };
}
export async function calendarEvents(user: Account, date: string) {
  const range = rangeFor(date);
  if (user.provider === "microsoft")
    return microsoftCalendar(user, range.start, range.end);
  const all: CalendarEvent[] = [];
  let token = "";
  do {
    const query = new URLSearchParams({
      timeMin: range.start,
      timeMax: range.end,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      ...(token ? { pageToken: token } : {}),
    });
    const page = await google<{
      items?: CalendarEvent[];
      nextPageToken?: string;
    }>(user, "/calendar/v3/calendars/primary/events?" + query);
    all.push(...(page.items || []));
    token = page.nextPageToken || "";
    if (all.length > 2500)
      throw new PublicError(
        "Deze agenda bevat te veel afspraken voor dit dagoverzicht.",
        422,
      );
  } while (token);
  return all.filter((e) => e.status !== "cancelled");
}
export function blocksTime(
  event: CalendarEvent,
  start: string,
  end: string,
  excludeId?: string,
) {
  if (
    event.id === excludeId ||
    event.transparency === "transparent" ||
    event.status === "cancelled"
  )
    return false;
  const eStart = event.start.dateTime
    ? new Date(event.start.dateTime)
    : fromZonedTime(event.start.date + "T00:00:00", timeZone);
  const eEnd = event.end.dateTime
    ? new Date(event.end.dateTime)
    : fromZonedTime(event.end.date + "T00:00:00", timeZone);
  return (
    Number.isNaN(eStart.getTime()) ||
    Number.isNaN(eEnd.getTime()) ||
    (eStart < new Date(end) && new Date(start) < eEnd)
  );
}
export type CalendarDependencies = {
  prepare?: (user: Account) => Promise<void>;
  transact: <T>(work: (db: Queryable) => Promise<T>) => Promise<T>;
  list: (user: Account, date: string) => Promise<CalendarEvent[]>;
  write: (user: Account, path: string, init: RequestInit) => Promise<unknown>;
};
const calendarDependencies: CalendarDependencies = {
  prepare: async (user) => {
    await accessToken(user);
  },
  transact: transaction,
  list: calendarEvents,
  write: (user, path, init) =>
    user.provider === "microsoft"
      ? microsoftWrite(user, path, init)
      : google(user, path, init),
};
export async function scheduleTask(
  user: Account,
  input: z.infer<typeof scheduleInput>,
  dependencies: CalendarDependencies = calendarDependencies,
) {
  // Token refresh updates the user row. Complete it before taking our calendar lock.
  await dependencies.prepare?.(user);
  return dependencies.transact(async (db) => {
    // Serialize our own calendar writes for this account. Google remains the source of truth.
    await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [user.id]);
    const task = (
      await db.query(
        "SELECT * FROM tasks WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [input.taskId, user.id],
      )
    ).rows[0];
    if (!task || task.done)
      throw new PublicError("Deze openstaande taak bestaat niet.", 404);
    if (task.version !== input.version)
      throw new PublicError(
        "De taak is aangepast. Vernieuw het overzicht.",
        409,
      );
    if (["pending", "uncertain"].includes(task.calendar_status as string))
      throw new PublicError(
        "Controleer eerst de onzekere agenda-actie in je agenda.",
        409,
      );
    const start = fromZonedTime(
        `${input.date}T${input.time}:00`,
        timeZone,
      ).toISOString(),
      end = new Date(
        Date.parse(start) + Number(task.duration) * 60000,
      ).toISOString();
    if (
      formatInTimeZone(end, timeZone, "yyyy-MM-dd") !== input.date ||
      formatInTimeZone(end, timeZone, "HH:mm") > "17:00"
    )
      throw new PublicError("Deze taak past niet vóór 17:00.");
    const eventId =
      (task.calendar_event_id as string) ||
      hash(user.id + ":" + task.id + ":" + task.version);
    const events = await dependencies.list(user, input.date);
    if (events.some((e) => blocksTime(e, start, end, eventId)))
      throw new PublicError(
        "Dit tijdstip overlapt een afspraak. Kies een ander vrij moment.",
        409,
      );
    const ownBlocks = await db.query(
      "SELECT id FROM tasks WHERE user_id=$1 AND id<>$2 AND calendar_status IN ('planned','pending','uncertain') AND scheduled_start<$3::timestamptz AND scheduled_end>$4::timestamptz",
      [user.id, task.id, end, start],
    );
    if (ownBlocks.rows.length)
      throw new PublicError(
        "Dit moment is al gereserveerd vanuit PlannerPal. Controleer de agendastatus als je het blok zelf bij je aanbieder hebt gewijzigd.",
        409,
      );
    // Keep a deterministic provider ID if confirmation is lost; no automatic retry.
    // The deterministic Google event ID prevents duplicate inserts if a response is lost.
    try {
      const receipt = await dependencies.write(
        user,
        `/calendar/v3/calendars/primary/events${task.calendar_event_id ? "/" + eventId : ""}`,
        {
          method: task.calendar_event_id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(task.calendar_event_id ? {} : { id: eventId }),
            summary: task.title,
            description: "Gepland vanuit PlannerPal.",
            extendedProperties: {
              private: {
                plannerpalTask: task.id,
                plannerpalOwner: hash(user.id),
              },
            },
            start: { dateTime: start, timeZone },
            end: { dateTime: end, timeZone },
          }),
        },
      );
      if (
        !receipt ||
        typeof receipt !== "object" ||
        !("id" in receipt) ||
        typeof receipt.id !== "string"
      )
        throw new Error("Missing event receipt");
      if (user.provider !== "microsoft" && receipt.id !== eventId)
        throw new Error("Calendar receipt does not match the requested event");
      const actualId = receipt.id;
      await db.query(
        "UPDATE tasks SET calendar_event_id=$1,calendar_status='planned',scheduled_start=$2,scheduled_end=$3,work_date=$4,version=version+1 WHERE id=$5 AND user_id=$6",
        [actualId, start, end, input.date, task.id, user.id],
      );
      await audit(
        db,
        user.id,
        "calendar.schedule",
        "planned",
        task.id as string,
      );
      return { planned: true };
    } catch (error) {
      const rejected =
        error instanceof ProviderError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 409;
      if (!rejected) {
        await db.query(
          "UPDATE tasks SET calendar_event_id=$1,calendar_lookup_key=$7,calendar_status='uncertain',scheduled_start=$2,scheduled_end=$3,work_date=$4,version=version+1 WHERE id=$5 AND user_id=$6",
          [
            user.provider === "microsoft" ? task.calendar_event_id : eventId,
            start,
            end,
            input.date,
            task.id,
            user.id,
            eventId,
          ],
        );
        await audit(
          db,
          user.id,
          "calendar.schedule",
          "uncertain",
          task.id as string,
        );
        return { planned: false, uncertain: true };
      }
      throw error;
    }
  });
}

export async function findCalendarEvent(
  user: Account,
  task: Record<string, unknown>,
) {
  if (user.provider === "microsoft") {
    if (task.calendar_event_id) {
      try {
        return graphEvent(
          await graph<GraphEvent>(
            user,
            "/events/" + encodeURIComponent(task.calendar_event_id as string),
          ),
        );
      } catch (error) {
        if (error instanceof ProviderError && error.status === 404) return null;
        throw error;
      }
    }
    if (task.calendar_lookup_key) {
      const events = await calendarEvents(
        user,
        String(
          task.work_date instanceof Date
            ? task.work_date.toISOString().slice(0, 10)
            : task.work_date,
        ),
      );
      return (
        events.find((e) => e.lookupKey === task.calendar_lookup_key) || null
      );
    }
    return null;
  }
  try {
    return await google<CalendarEvent>(
      user,
      "/calendar/v3/calendars/primary/events/" +
        encodeURIComponent(task.calendar_event_id as string),
    );
  } catch (error) {
    if (error instanceof ProviderError && error.status === 404) return null;
    throw error;
  }
}
