import { z } from "zod";
import { randomUUID } from "node:crypto";
import { database, audit, Queryable } from "./db";
import { PublicError } from "./http";
import { dateString } from "./calendar";
export const taskFields = z.object({
  title: z.string().trim().min(1).max(160),
  duration: z.number().int().min(5).max(480),
  priority: z.enum(["Hoog", "Normaal", "Laag"]),
  deadline: dateString,
  work_date: dateString,
  source_mail: z.string().min(1).max(256).optional(),
  source_note: z.string().uuid().optional(),
  proposal_index: z.number().int().min(0).max(4).optional(),
});
export const taskInput = taskFields
  .refine(
    (v) => !(v.source_note || v.source_mail) || v.proposal_index !== undefined,
  )
  .refine((v) => !(v.source_mail && v.source_note));
export async function createTask(
  userId: string,
  input: z.infer<typeof taskInput>,
  db: Queryable = database(),
) {
  if (input.source_mail) {
    const source = await db.query(
      "SELECT id,analysis FROM mail_cache WHERE user_id=$1 AND id=$2",
      [userId, input.source_mail],
    );
    if (!source.rows[0])
      throw new PublicError("Deze bronmail hoort niet bij jouw account.", 404);
    const analysis = source.rows[0].analysis as { tasks: unknown[] } | null;
    if (!analysis?.tasks[input.proposal_index!])
      throw new PublicError("Dit voorstel bestaat niet.");
  }
  if (input.source_note) {
    const source = await db.query(
      "SELECT id,analysis FROM notes WHERE user_id=$1 AND id=$2",
      [userId, input.source_note],
    );
    if (!source.rows[0])
      throw new PublicError("Deze notitie hoort niet bij jouw account.", 404);
    const analysis = source.rows[0].analysis as { tasks: unknown[] };
    if (!analysis.tasks[input.proposal_index!])
      throw new PublicError("Dit voorstel bestaat niet.");
  }
  const result = await db.query(
    "INSERT INTO tasks(id,user_id,title,duration,priority,deadline,work_date,source_mail,source_note,proposal_index) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id",
    [
      randomUUID(),
      userId,
      input.title,
      input.duration,
      input.priority,
      input.deadline,
      input.work_date,
      input.source_mail || null,
      input.source_note || null,
      input.proposal_index ?? null,
    ],
  );
  if (!result.rows[0])
    throw new PublicError("Er bestaat al een taak voor dit voorstel.", 409);
  await audit(db, userId, "task.create", "saved", result.rows[0].id as string);
  return result.rows[0];
}
