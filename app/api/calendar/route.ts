import { requireUser } from "../../../server/auth";
import {
  dateString,
  calendarEvents,
  scheduleInput,
  scheduleTask,
} from "../../../server/calendar";
import { timeZone } from "../../../server/config";
import {
  sameOrigin,
  jsonBody,
  response,
  routeError,
} from "../../../server/http";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const date = dateString.parse(
      new URL(request.url).searchParams.get("date"),
    );
    return response({ events: await calendarEvents(user, date), timeZone });
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    return response(
      await scheduleTask(user, scheduleInput.parse(await jsonBody(request))),
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const { z } = await import("zod");
    const { database } = await import("../../../server/db");
    const { google } = await import("../../../server/google");
    const { ProviderError, PublicError } = await import("../../../server/http");
    const { taskId } = z
      .object({ taskId: z.string().uuid() })
      .parse(await jsonBody(request));
    const task = (
      await database().query("SELECT * FROM tasks WHERE user_id=$1 AND id=$2", [
        user.id,
        taskId,
      ])
    ).rows[0];
    if (!task?.calendar_event_id)
      throw new PublicError("Geen gekoppeld agendablok gevonden.", 404);
    let event;
    try {
      event = await google<{
        status?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
      }>(
        user,
        "/calendar/v3/calendars/primary/events/" +
          encodeURIComponent(task.calendar_event_id as string),
      );
    } catch (error) {
      if (!(error instanceof ProviderError && error.status === 404))
        throw error;
    }
    if (!event || event.status === "cancelled") {
      await database().query(
        "UPDATE tasks SET calendar_event_id=null,calendar_status='none',scheduled_start=null,scheduled_end=null,version=version+1 WHERE user_id=$1 AND id=$2",
        [user.id, taskId],
      );
      return response({ found: false });
    }
    if (!event.start?.dateTime || !event.end?.dateTime)
      throw new PublicError(
        "Controleer het agendablok handmatig in Google Agenda.",
        409,
      );
    await database().query(
      "UPDATE tasks SET calendar_status='planned',scheduled_start=$1,scheduled_end=$2,version=version+1 WHERE user_id=$3 AND id=$4",
      [event.start.dateTime, event.end.dateTime, user.id, taskId],
    );
    return response({ found: true });
  } catch (error) {
    return routeError(error);
  }
}
