import { z } from "zod";
import { requireUser } from "../../../server/auth";
import { database, audit } from "../../../server/db";
import { createTask, taskInput, taskFields } from "../../../server/tasks";
import {
  sameOrigin,
  jsonBody,
  response,
  routeError,
  PublicError,
} from "../../../server/http";
const edit = taskFields
  .omit({ source_mail: true, source_note: true, proposal_index: true })
  .extend({
    id: z.string().uuid(),
    version: z.number().int().positive(),
    done: z.boolean(),
  });
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    return response(
      await createTask(user.id, taskInput.parse(await jsonBody(request))),
      201,
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const input = edit.parse(await jsonBody(request));
    const result = await database().query(
      "UPDATE tasks SET title=$1,duration=$2,priority=$3,deadline=$4,work_date=$5,done=$6,version=version+1 WHERE user_id=$7 AND id=$8 AND version=$9 AND (calendar_status='none' OR (title=$1 AND duration=$2 AND work_date=$5::date)) RETURNING id",
      [
        input.title,
        input.duration,
        input.priority,
        input.deadline,
        input.work_date,
        input.done,
        user.id,
        input.id,
        input.version,
      ],
    );
    if (!result.rows[0])
      throw new PublicError(
        "De taak is gewijzigd of heeft een agendablok. Verplaats geplande taken via Inplannen; titel en duur staan vast zolang ze in Google Agenda staan.",
        409,
      );
    await audit(database(), user.id, "task.update", "saved", input.id);
    return response({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const input = z
      .object({
        id: z.string().uuid(),
        version: z.number().int().positive(),
        confirmed: z.literal(true),
      })
      .parse(await jsonBody(request));
    const result = await database().query(
      "DELETE FROM tasks WHERE user_id=$1 AND id=$2 AND version=$3 AND calendar_status='none' RETURNING id",
      [user.id, input.id, input.version],
    );
    if (!result.rows[0])
      throw new PublicError(
        "De taak is gewijzigd of heeft nog een agendablok. Verwijder dat blok eerst in Google Agenda en controleer de agendastatus.",
        409,
      );
    await audit(database(), user.id, "task.delete", "deleted", input.id);
    return response({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
