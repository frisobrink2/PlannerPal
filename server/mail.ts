import { z } from "zod";
import { randomUUID } from "node:crypto";
import { google } from "./google";
import { microsoftInbox, microsoftSend } from "./microsoft";
import { database, audit, Queryable } from "./db";
import type { Account } from "./auth";
import { PublicError, ProviderError } from "./http";
export const draftEdit = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  body: z.string().trim().min(1).max(20000),
});
export const sendInput = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  confirmed: z.literal(true),
});
export type GmailMessage = {
  id: string;
  threadId: string;
  internalDate: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
  };
};
const cleanHeader = (value: string) => value.replace(/[\r\n\0]/g, " ").trim();
export function mailboxAddress(value: string) {
  const clean = cleanHeader(value);
  const found = clean.match(/<([^<>]+)>/);
  const candidate = (found ? found[1] : clean).trim();
  return z.email().parse(candidate);
}
function plainPart(part: GmailMessage["payload"]): string {
  if (part.mimeType === "text/plain" && part.body?.data)
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  return part.parts?.map(plainPart).filter(Boolean).join("\n") || "";
}
function htmlPart(part: GmailMessage["payload"]): string {
  if (part.mimeType === "text/html" && part.body?.data)
    return Buffer.from(part.body.data, "base64url")
      .toString("utf8")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
  return part.parts?.map(htmlPart).filter(Boolean).join("\n") || "";
}
export function normalizeMail(message: GmailMessage) {
  const header = (name: string) =>
    cleanHeader(
      message.payload.headers.find((h) => h.name.toLowerCase() === name)
        ?.value || "",
    );
  return {
    id: message.id,
    thread_id: message.threadId,
    message_id: header("message-id"),
    subject: header("subject") || "(zonder onderwerp)",
    sender: header("from"),
    recipient: mailboxAddress(header("reply-to") || header("from")),
    body: (
      plainPart(message.payload) ||
      htmlPart(message.payload) ||
      "(Geen leesbare tekst. Bijlagen worden niet verwerkt.)"
    ).slice(0, 24000),
    received_at: new Date(Number(message.internalDate)).toISOString(),
  };
}
export async function syncMail(user: Account) {
  if (user.provider === "microsoft") {
    const group = await microsoftInbox(user);
    for (const message of group) await persistMail(user, message);
    await markInbox(
      user,
      group.map((m) => m.id),
    );
    return group.length;
  }
  const list = await google<{ messages?: { id: string }[] }>(
    user,
    "/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=20",
  );
  const ids = list.messages || [];
  let imported = 0;
  for (let offset = 0; offset < ids.length; offset += 4) {
    const group = await Promise.all(
      ids
        .slice(offset, offset + 4)
        .map((m) =>
          google<GmailMessage>(
            user,
            `/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=full`,
          ),
        ),
    );
    for (const message of group) {
      try {
        await persistMail(user, message);
        imported++;
      } catch (error) {
        if (error instanceof z.ZodError) continue;
        throw error;
      }
    }
  }
  await markInbox(
    user,
    ids.map((m) => m.id),
  );
  return imported;
}
async function persistMail(
  user: Account,
  message: GmailMessage & { web_url?: string },
) {
  const m = normalizeMail(message);
  const webUrl =
    message.web_url && safeMailLink(message.web_url) ? message.web_url : null;
  await database().query(
    "INSERT INTO mail_cache(id,user_id,thread_id,message_id,subject,sender,recipient,body,received_at,web_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(user_id,id) DO UPDATE SET subject=$5,sender=$6,recipient=$7,body=$8,received_at=$9,web_url=$10,synced_at=now()",
    [
      m.id,
      user.id,
      m.thread_id,
      m.message_id,
      m.subject,
      m.sender,
      m.recipient,
      m.body,
      m.received_at,
      webUrl,
    ],
  );
}
export function safeMailLink(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      [
        "outlook.office.com",
        "outlook.office365.com",
        "outlook.live.com",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
async function markInbox(user: Account, ids: string[]) {
  await database().query(
    "UPDATE mail_cache SET in_inbox=false WHERE user_id=$1 AND NOT (id=ANY($2::text[]))",
    [user.id, ids],
  );
  if (ids.length)
    await database().query(
      "UPDATE mail_cache SET in_inbox=true WHERE user_id=$1 AND id=ANY($2::text[])",
      [user.id, ids],
    );
}
export async function saveDraft(
  db: Queryable,
  userId: string,
  mailId: string,
  body: string,
) {
  const mail = await db.query(
    "SELECT * FROM mail_cache WHERE user_id=$1 AND id=$2",
    [userId, mailId],
  );
  if (!mail.rows[0]) throw new PublicError("Deze bronmail bestaat niet.", 404);
  const m = mail.rows[0];
  const result = await db.query(
    "INSERT INTO drafts(id,user_id,source_mail,recipient,subject,body) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,source_mail) DO NOTHING RETURNING *",
    [
      randomUUID(),
      userId,
      mailId,
      m.recipient,
      /^re:/i.test(m.subject as string) ? m.subject : "Re: " + m.subject,
      body,
    ],
  );
  return (
    result.rows[0] ||
    (
      await db.query(
        "SELECT * FROM drafts WHERE user_id=$1 AND source_mail=$2",
        [userId, mailId],
      )
    ).rows[0]
  );
}
export async function editDraft(
  db: Queryable,
  userId: string,
  input: z.infer<typeof draftEdit>,
) {
  const result = await db.query(
    "UPDATE drafts SET body=$1,revision=revision+1,status='draft' WHERE id=$2 AND user_id=$3 AND revision=$4 AND status IN ('draft','failed') RETURNING *",
    [input.body, input.id, userId, input.revision],
  );
  if (!result.rows[0])
    throw new PublicError(
      "Dit concept is veranderd, al verzonden of heeft een onzekere verzendstatus. Vernieuw het overzicht.",
      409,
    );
  return result.rows[0];
}
export function replyMime(
  draft: { recipient: string; subject: string; body: string },
  source: { message_id: string },
  from: string,
  identifier?: string,
) {
  const to = mailboxAddress(draft.recipient);
  const subject = Buffer.from(cleanHeader(draft.subject), "utf8").toString(
    "base64",
  );
  const reference = /^<[^<>\r\n]+>$/.test(source.message_id)
    ? `In-Reply-To: ${source.message_id}\r\nReferences: ${source.message_id}\r\n`
    : "";
  return Buffer.from(
    `From: ${mailboxAddress(from)}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${subject}?=\r\n${reference}${identifier ? `Message-ID: <${identifier}@plannerpal.vercel.app>\r\n` : ""}MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${
      Buffer.from(draft.body, "utf8")
        .toString("base64")
        .match(/.{1,76}/g)
        ?.join("\r\n") || ""
    }\r\n`,
  ).toString("base64url");
}
export async function sendDraft(
  user: Account,
  input: z.infer<typeof sendInput>,
  db: Queryable = database(),
  send = (path: string, init: RequestInit) =>
    user.provider === "microsoft"
      ? microsoftSend(user, JSON.parse(init.body as string).raw)
      : google<{ id: string }>(user, path, init),
) {
  // Atomic claim: concurrent taps and stale revisions can never send the same draft twice.
  const claimed = await db.query(
    "UPDATE drafts SET status='sending' WHERE user_id=$1 AND id=$2 AND revision=$3 AND status='draft' RETURNING *",
    [user.id, input.id, input.revision],
  );
  const draft = claimed.rows[0];
  if (!draft)
    throw new PublicError(
      "Dit concept is gewijzigd of al verzonden. Vernieuw het overzicht voordat je verdergaat.",
      409,
    );
  try {
    const mail = (
      await db.query("SELECT * FROM mail_cache WHERE user_id=$1 AND id=$2", [
        user.id,
        draft.source_mail,
      ])
    ).rows[0];
    if (!mail) throw new PublicError("Bronmail ontbreekt.", 404);
    const raw = replyMime(
      draft as { recipient: string; subject: string; body: string },
      mail as { message_id: string },
      user.connection_email || user.email,
      `${draft.id}.${draft.revision}`,
    );
    const result = await send("/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, threadId: mail.thread_id }),
    });
    if (!result.id) throw new Error("No send receipt");
    await db.query(
      "UPDATE drafts SET status='sent',sent_id=$1 WHERE id=$2 AND user_id=$3",
      [result.id, input.id, user.id],
    );
    await audit(db, user.id, "mail.send", "sent", input.id);
    return { sent: true };
  } catch (error) {
    const rejected =
      (error instanceof ProviderError &&
        error.status >= 400 &&
        error.status < 500) ||
      error instanceof PublicError;
    await db.query("UPDATE drafts SET status=$1 WHERE id=$2 AND user_id=$3", [
      rejected ? "failed" : "uncertain",
      input.id,
      user.id,
    ]);
    await audit(
      db,
      user.id,
      "mail.send",
      rejected ? "failed" : "uncertain",
      input.id,
    );
    if (!rejected)
      throw new PublicError(
        "Je maildienst heeft geen bevestiging teruggestuurd. Controleer eerst je map Verzonden. Dit concept wordt niet automatisch opnieuw verstuurd.",
        409,
      );
    throw error;
  }
}
