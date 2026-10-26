import { requireUser, requireCapability } from "../../../server/auth";
import { database } from "../../../server/db";
import {
  draftEdit,
  editDraft,
  sendDraft,
  sendInput,
  saveDraft,
} from "../../../server/mail";
import {
  sameOrigin,
  jsonBody,
  response,
  routeError,
} from "../../../server/http";
export const maxDuration = 60;
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    return response(
      await editDraft(
        database(),
        user.id,
        draftEdit.parse(await jsonBody(request)),
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const input = await jsonBody(request);
    if (input && typeof input === "object" && input.action === "create") {
      const { z } = await import("zod");
      const data = z
        .object({
          action: z.literal("create"),
          mailId: z.string().min(1).max(256),
        })
        .parse(input);
      return response(await saveDraft(database(), user.id, data.mailId, ""));
    }
    requireCapability(user, "sendMail");
    return response(await sendDraft(user, sendInput.parse(input)));
  } catch (error) {
    return routeError(error);
  }
}
// Resolve uncertain delivery without ever resending the original request.
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const { z } = await import("zod");
    const { google } = await import("../../../server/google");
    const { PublicError } = await import("../../../server/http");
    const { id } = z
      .object({ id: z.string().uuid() })
      .parse(await jsonBody(request));
    const draft = (
      await database().query(
        "SELECT id,revision FROM drafts WHERE user_id=$1 AND id=$2 AND status IN ('sending','uncertain')",
        [user.id, id],
      )
    ).rows[0];
    if (!draft)
      throw new PublicError(
        "Dit concept heeft geen onzekere verzendstatus.",
        409,
      );
    if (user.provider === "microsoft") {
      const { microsoftSentReceipt } =
        await import("../../../server/microsoft");
      const receipt = await microsoftSentReceipt(
        user,
        `${draft.id}.${draft.revision}@plannerpal.vercel.app`,
      );
      if (!receipt) return response({ resolved: false });
      await database().query(
        "UPDATE drafts SET status='sent',sent_id=$1 WHERE user_id=$2 AND id=$3",
        [receipt, user.id, id],
      );
      return response({ resolved: true });
    }
    const query = new URLSearchParams({
      q: `in:sent rfc822msgid:${draft.id}.${draft.revision}@plannerpal.vercel.app`,
      maxResults: "2",
    });
    const result = await google<{ messages?: { id: string }[] }>(
      user,
      "/gmail/v1/users/me/messages?" + query,
    );
    if (!result.messages?.length) return response({ resolved: false });
    await database().query(
      "UPDATE drafts SET status='sent',sent_id=$1 WHERE user_id=$2 AND id=$3",
      [result.messages[0].id, user.id, id],
    );
    return response({ resolved: true });
  } catch (error) {
    return routeError(error);
  }
}
