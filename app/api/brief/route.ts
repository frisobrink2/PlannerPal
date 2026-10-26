import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser } from "../../../server/auth";
import { database } from "../../../server/db";
import { analyzeText, rateLimit } from "../../../server/ai";
import { calendarEvents, dateString } from "../../../server/calendar";
import { timeZone, aiKey } from "../../../server/config";
import {
  sameOrigin,
  jsonBody,
  response,
  routeError,
  PublicError,
} from "../../../server/http";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    aiKey();
    const input = z
      .object({
        date: dateString,
        eventId: z.string().min(1).max(1024).optional(),
      })
      .parse(await jsonBody(request));
    const events = await calendarEvents(user, input.date);
    const event = input.eventId
      ? events.find((e) => e.id === input.eventId)
      : undefined;
    if (input.eventId && !event)
      throw new PublicError(
        "Deze afspraak is niet gevonden op de gekozen dag.",
        404,
      );
    const [tasks, mails] = await Promise.all([
      database().query(
        "SELECT title,duration,priority,deadline::text,work_date::text,calendar_status FROM tasks WHERE user_id=$1 AND done=false ORDER BY deadline LIMIT 30",
        [user.id],
      ),
      database().query(
        "SELECT id,subject,sender,left(body,700) AS text FROM mail_cache WHERE user_id=$1 AND in_inbox=true ORDER BY received_at DESC LIMIT 10",
        [user.id],
      ),
    ]);
    await rateLimit(user.id);
    const analysis = await analyzeText(
      JSON.stringify({
        date: input.date,
        event,
        events,
        tasks: tasks.rows,
        mails: mails.rows,
      }),
      "note",
      formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd"),
      event
        ? "Maak een korte voorbereiding op de geselecteerde afspraak: relevante onderwerpen uit de aangeleverde context, openstaande acties en maximaal drie vragen. Zeg expliciet wanneer context ontbreekt. Maak geen nieuwe taken; tasks moet leeg zijn."
        : "Maak een kort ochtendoverzicht voor de gekozen dag: urgente taken, afspraken en een realistische volgorde van aandacht. Baseer je alleen op deze context en geef geen garantie dat alles past. Maak geen nieuwe taken; tasks moet leeg zijn.",
    );
    return response({ text: analysis.summary });
  } catch (error) {
    return routeError(error);
  }
}
