import { z } from "zod";
import { randomUUID } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser } from "../../../server/auth";
import { analyzeText, rateLimit } from "../../../server/ai";
import { database } from "../../../server/db";
import { saveDraft } from "../../../server/mail";
import { timeZone, aiKey } from "../../../server/config";
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
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    aiKey();
    const data = input.parse(await jsonBody(request));
    const db = database();
    let text = "";
    if (data.kind === "mail") {
      const mail = (
        await db.query("SELECT * FROM mail_cache WHERE user_id=$1 AND id=$2", [
          user.id,
          data.mailId,
        ])
      ).rows[0];
      if (!mail) throw new PublicError("Bronmail niet gevonden.", 404);
      if (mail.analysis)
        return response({ analysis: mail.analysis, cached: true });
      text = `Onderwerp: ${mail.subject}\nAfzender: ${mail.sender}\nTekst:\n${mail.body}`;
    } else text = data.text;
    await rateLimit(user.id);
    const analysis = await analyzeText(
      text,
      data.kind,
      formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd"),
    );
    if (data.kind === "mail") {
      await db.query(
        "UPDATE mail_cache SET analysis=$1 WHERE user_id=$2 AND id=$3",
        [JSON.stringify(analysis), user.id, data.mailId],
      );
      if (analysis.reply.trim())
        await saveDraft(db, user.id, data.mailId, analysis.reply);
      return response({ analysis });
    }
    const id = randomUUID();
    await db.query(
      "INSERT INTO notes(id,user_id,transcript,analysis) VALUES($1,$2,$3,$4)",
      [id, user.id, data.text, JSON.stringify(analysis)],
    );
    return response({ id, analysis });
  } catch (error) {
    return routeError(error);
  }
}
