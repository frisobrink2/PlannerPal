import { requireUser } from "../../../server/auth";
import { google } from "../../../server/google";
import { mailboxAddress, GmailMessage } from "../../../server/mail";
import { sameOrigin, response, routeError } from "../../../server/http";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const list = await google<{
      messages?: { id: string; threadId: string }[];
    }>(
      user,
      "/gmail/v1/users/me/messages?" +
        new URLSearchParams({
          q: "in:sent newer_than:14d older_than:3d",
          maxResults: "10",
        }),
    );
    const ids = [...new Set((list.messages || []).map((m) => m.threadId))];
    const followups = [];
    for (let offset = 0; offset < ids.length; offset += 3) {
      const threads = await Promise.all(
        ids
          .slice(offset, offset + 3)
          .map((id) =>
            google<{ id: string; messages?: GmailMessage[] }>(
              user,
              `/gmail/v1/users/me/threads/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
            ),
          ),
      );
      for (const thread of threads) {
        const last = thread.messages
          ?.slice()
          .sort((a, b) => Number(a.internalDate) - Number(b.internalDate))
          .at(-1);
        if (!last || Date.now() - Number(last.internalDate) < 3 * 86400000)
          continue;
        const header = (name: string) =>
          last.payload.headers.find((h) => h.name.toLowerCase() === name)
            ?.value || "";
        let sender = "";
        try {
          sender = mailboxAddress(header("from"));
        } catch {
          continue;
        }
        if (sender.toLowerCase() !== user.email.toLowerCase()) continue;
        followups.push({
          id: last.id,
          subject: header("subject") || "(zonder onderwerp)",
          recipient: header("to"),
          days: Math.floor((Date.now() - Number(last.internalDate)) / 86400000),
        });
      }
    }
    return response({ followups });
  } catch (error) {
    return routeError(error);
  }
}
