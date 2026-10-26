import { z } from "zod";
import { requireUser } from "../../../server/auth";
import { database } from "../../../server/db";
import { calendarEvents, dateString } from "../../../server/calendar";
import {
  sameOrigin,
  jsonBody,
  response,
  routeError,
  PublicError,
} from "../../../server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const input = z
      .object({
        date: dateString,
        eventId: z.string().min(1).max(1024).optional(),
      })
      .parse(await jsonBody(request));
    const events = await calendarEvents(user, input.date);
    const event = input.eventId
      ? events.find((e) => e.id === input.eventId)
      : null;
    if (input.eventId && !event)
      throw new PublicError("Deze afspraak is niet gevonden.", 404);
    const tasks = (
      await database().query(
        "SELECT title,duration,deadline::text FROM tasks WHERE user_id=$1 AND done=false AND work_date=$2 ORDER BY deadline LIMIT 30",
        [user.id, input.date],
      )
    ).rows;
    const total = tasks.reduce((sum, t) => sum + Number(t.duration), 0);
    const text = event
      ? `${event.summary || "Afspraak"}\n\nControleer voor het gesprek je openstaande taken:\n${tasks.map((t) => "• " + t.title).join("\n") || "Geen openstaande taken op deze dag."}\n\nDit overzicht gebruikt vaste regels; er is geen AI-analyse uitgevoerd.`
      : `${input.date}\n${events.length} afspraken in je agenda.\n${tasks.length} openstaande taken, samen ${total} minuten geschat werk.\n\n${tasks.map((t) => `• ${t.title} (${t.duration} min, deadline ${t.deadline})`).join("\n") || "Nog geen taken voor deze dag."}\n\nControleer je agenda voordat je plant. Er is geen AI gebruikt.`;
    return response({ text, source: "rules" });
  } catch (error) {
    return routeError(error);
  }
}
