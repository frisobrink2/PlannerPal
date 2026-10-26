import { fromZonedTime } from "date-fns-tz";
import { providerToken } from "./provider-token";
import { requestProvider, PublicError } from "./http";
import { requireCapability, type Account } from "./auth";
import type { GmailMessage } from "./mail";
import type { CalendarEvent } from "./calendar";
export type GraphMessage = {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  from?: { emailAddress: { name?: string; address: string } };
  toRecipients?: { emailAddress: { address: string } }[];
  replyTo?: { emailAddress: { address: string } }[];
  body?: { contentType: string; content: string };
  webLink?: string;
};
export type GraphEvent = {
  id: string;
  subject?: string;
  isCancelled?: boolean;
  showAs?: string;
  transactionId?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  webLink?: string;
};
export async function graph<T>(
  user: Account,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (user.provider !== "microsoft")
    throw new PublicError("Dit account is niet met Microsoft verbonden.", 403);
  const url = new URL(
    path.startsWith("https:")
      ? path
      : "https://graph.microsoft.com/v1.0/me" + path,
  );
  if (
    url.origin !== "https://graph.microsoft.com" ||
    !url.pathname.startsWith("/v1.0/me/")
  )
    throw new Error("Unsupported Microsoft endpoint");
  const endpoint=url.pathname.slice('/v1.0/me'.length);const writing=Boolean(init.method&&init.method!=='GET');
  if(endpoint==='/sendMail')requireCapability(user,'sendMail');else if(endpoint.startsWith('/mailFolders/')||endpoint.startsWith('/messages'))requireCapability(user,'readMail');else if(endpoint.startsWith('/events')||endpoint.startsWith('/calendarView'))requireCapability(user,writing?'writeCalendar':'readCalendar');else throw new Error('Unsupported Microsoft endpoint');
  const token = await providerToken(user);
  const response = await requestProvider(
    url.toString(),
    {
      ...init,
      headers: {
        Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"',
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    },
    "Microsoft",
  );
  if (response.status === 204 || response.status === 202) return undefined as T;
  return response.json();
}
export function graphMessage(
  message: GraphMessage,
): GmailMessage & { web_url?: string } {
  const address = message.from?.emailAddress;
  return {
    id: message.id,
    threadId: message.conversationId || message.id,
    internalDate: String(
      Date.parse(message.receivedDateTime || message.sentDateTime || ""),
    ),
    web_url: message.webLink,
    payload: {
      headers: [
        {
          name: "from",
          value: address ? `${address.name || ""} <${address.address}>` : "",
        },
        {
          name: "reply-to",
          value:
            message.replyTo?.[0]?.emailAddress.address ||
            address?.address ||
            "",
        },
        { name: "subject", value: message.subject || "(zonder onderwerp)" },
        { name: "message-id", value: message.internetMessageId || "" },
      ],
      mimeType:
        message.body?.contentType.toLowerCase() === "html"
          ? "text/html"
          : "text/plain",
      body: {
        data: Buffer.from(message.body?.content || "", "utf8").toString(
          "base64url",
        ),
      },
    },
  };
}
export async function microsoftInbox(user: Account) {
  requireCapability(user, "readMail");
  const query = new URLSearchParams({
    $top: "20",
    $orderby: "receivedDateTime desc",
    $select:
      "id,conversationId,internetMessageId,subject,receivedDateTime,from,replyTo,body,webLink",
  });
  const result = await graph<{ value: GraphMessage[] }>(
    user,
    "/mailFolders/inbox/messages?" + query,
    {
      headers: {
        Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
      },
    },
  );
  return result.value.map(graphMessage);
}
export async function microsoftSend(user: Account, raw: string) {
  requireCapability(user, "sendMail");
  const mime = Buffer.from(raw, "base64url");
  const marker = mime
    .toString("utf8")
    .match(/^Message-ID: <([^<>\r\n]+)>/m)?.[1];
  if (!marker) throw new Error("Missing message identifier");
  await graph(user, "/sendMail", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: mime.toString("base64"),
  });
  return { id: "accepted:" + marker };
}
export function graphEvent(
  event: GraphEvent,
): CalendarEvent & { lookupKey?: string } {
  const instant = (value: GraphEvent["start"]) =>
    /[zZ]|[+-]\d\d:\d\d$/.test(value.dateTime)
      ? new Date(value.dateTime).toISOString()
      : fromZonedTime(
          value.dateTime,
          value.timeZone === "UTC" ? "UTC" : value.timeZone,
        ).toISOString();
  return {
    id: event.id,
    summary: event.subject || "Afspraak",
    status: event.isCancelled ? "cancelled" : "confirmed",
    transparency: event.showAs === "free" ? "transparent" : "opaque",
    start: { dateTime: instant(event.start) },
    end: { dateTime: instant(event.end) },
    htmlLink: event.webLink,
    lookupKey: event.transactionId,
  };
}
export async function microsoftCalendar(
  user: Account,
  start: string,
  end: string,
) {
  requireCapability(user, "readCalendar");
  let path =
    "/calendarView?" +
    new URLSearchParams({
      startDateTime: start,
      endDateTime: end,
      $top: "250",
      $select: "id,subject,start,end,showAs,isCancelled,transactionId,webLink",
      $orderby: "start/dateTime",
    });
  const events: ReturnType<typeof graphEvent>[] = [];
  do {
    const page = await graph<{
      value: GraphEvent[];
      "@odata.nextLink"?: string;
    }>(user, path);
    events.push(...page.value.map(graphEvent));
    path = page["@odata.nextLink"] || "";
    if (events.length > 2500)
      throw new PublicError("Er staan te veel afspraken op deze dag.", 422);
  } while (path);
  return events.filter((e) => e.status !== "cancelled");
}
export async function microsoftWrite(
  user: Account,
  path: string,
  init: RequestInit,
) {
  requireCapability(user, "writeCalendar");
  const input = JSON.parse(init.body as string);
  const id =
    init.method === "PATCH"
      ? decodeURIComponent(path.split("/events/")[1] || "")
      : "";
  const data = {
    subject: input.summary,
    body: {
      contentType: "text",
      content: input.description || "Gepland vanuit PlannerPal.",
    },
    start: {
      dateTime: new Date(input.start.dateTime).toISOString().replace("Z", ""),
      timeZone: "UTC",
    },
    end: {
      dateTime: new Date(input.end.dateTime).toISOString().replace("Z", ""),
      timeZone: "UTC",
    },
    ...(!id ? { transactionId: input.id } : {}),
  };
  return graph<{ id: string }>(
    user,
    id ? "/events/" + encodeURIComponent(id) : "/events",
    {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}
export async function microsoftSentReceipt(user: Account, marker: string) {
  requireCapability(user, "readMail");
  const filter = `internetMessageId eq '<${marker.replace(/'/g, "''")}>'`;
  const result = await graph<{ value: { id: string }[] }>(
    user,
    "/mailFolders/sentitems/messages?" +
      new URLSearchParams({ $filter: filter, $select: "id", $top: "2" }),
  );
  return result.value[0]?.id || null;
}

export async function microsoftFollowups(user: Account) {
  requireCapability(user, "readMail");
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString(),
    oldest = new Date(Date.now() - 14 * 86400000).toISOString();
  const sent = await graph<{ value: GraphMessage[] }>(
    user,
    "/mailFolders/sentitems/messages?" +
      new URLSearchParams({
        $filter: `sentDateTime le ${cutoff} and sentDateTime ge ${oldest}`,
        $orderby: "sentDateTime desc",
        $top: "10",
        $select: "id,conversationId,subject,sentDateTime,toRecipients,webLink",
      }),
  );
  const results = [];
  for (const mail of sent.value) {
    if (!mail.conversationId) continue;
    const thread = await graph<{
      value: GraphMessage[];
      "@odata.nextLink"?: string;
    }>(
      user,
      "/messages?" +
        new URLSearchParams({
          $filter: `conversationId eq '${mail.conversationId.replace(/'/g, "''")}'`,
          $top: "100",
          $select: "id,from,receivedDateTime,sentDateTime",
        }),
    );
    if (thread["@odata.nextLink"]) continue;
    const latest = thread.value
      .sort(
        (a, b) =>
          Date.parse(b.receivedDateTime || b.sentDateTime || "") -
          Date.parse(a.receivedDateTime || a.sentDateTime || ""),
      )
      .at(0);
    if (
      !latest ||
      latest.from?.emailAddress.address.toLowerCase() !==
        (user.connection_email || user.email).toLowerCase()
    )
      continue;
    results.push({
      id: mail.id,
      subject: mail.subject || "(zonder onderwerp)",
      recipient:
        mail.toRecipients?.map((r) => r.emailAddress.address).join(", ") || "",
      days: Math.floor(
        (Date.now() - Date.parse(mail.sentDateTime || "")) / 86400000,
      ),
    });
  }
  return results;
}
