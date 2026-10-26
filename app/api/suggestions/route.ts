import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireUser } from "../../../server/auth";
import { database } from "../../../server/db";
import { saveDraft } from "../../../server/mail";
import { ruleSuggestions } from "../../../server/rules";
import {
  sameOrigin,
  jsonBody,
  response,
  routeError,
  PublicError,
} from "../../../server/http";
const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mail"), mailId: z.string().min(1).max(256) }),
  z.object({
    kind: z.literal("note"),
    text: z.string().trim().min(5).max(16000),
  }),
]);
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const value = input.parse(await jsonBody(request));
    const db = database();
    if (value.kind === "mail") {
      const mail = (
        await db.query("SELECT * FROM mail_cache WHERE user_id=$1 AND id=$2", [
          user.id,
          value.mailId,
        ])
      ).rows[0];
      if (!mail) throw new PublicError("Deze mail is niet gevonden.", 404);
      if (mail.analysis) return response({ analysis: mail.analysis });
      const analysis = ruleSuggestions(
        mail.body as string,
        mail.subject as string,
      );
      await db.query(
        "UPDATE mail_cache SET analysis=$1 WHERE user_id=$2 AND id=$3",
        [JSON.stringify(analysis), user.id, value.mailId],
      );
      await saveDraft(db, user.id, value.mailId, analysis.reply);
      return response({ analysis });
    }
    const id = randomUUID(),
      analysis = ruleSuggestions(value.text);
    await db.query(
      "INSERT INTO notes(id,user_id,transcript,analysis) VALUES($1,$2,$3,$4)",
      [id, user.id, value.text, JSON.stringify(analysis)],
    );
    return response({ id, analysis });
  } catch (error) {
    return routeError(error);
  }
}
