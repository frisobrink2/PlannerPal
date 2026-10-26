export type Provider = "google" | "microsoft";
export type Intent = "login" | "connect" | "send" | "calendar";
export const intents = ["login", "connect", "send", "calendar"] as const;
export const providers = ["google", "microsoft"] as const;
export const providerLabel = (provider: Provider) =>
  provider === "google" ? "Google" : "Microsoft";
export function providerConfigured(provider: Provider) {
  const prefix = provider === "google" ? "GOOGLE" : "MICROSOFT";
  return Boolean(
    process.env[prefix + "_CLIENT_ID"] &&
    process.env[prefix + "_CLIENT_SECRET"],
  );
}
export function providerSettings(provider: Provider) {
  const prefix = provider === "google" ? "GOOGLE" : "MICROSOFT";
  const microsoft = provider === "microsoft";
  return {
    clientId: process.env[prefix + "_CLIENT_ID"] || "",
    clientSecret: process.env[prefix + "_CLIENT_SECRET"] || "",
    authorize: microsoft
      ? "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
      : "https://accounts.google.com/o/oauth2/v2/auth",
    token: microsoft
      ? "https://login.microsoftonline.com/common/oauth2/v2.0/token"
      : "https://oauth2.googleapis.com/token",
    callback: microsoft ? "/api/auth/callback/microsoft" : "/api/auth/callback",
  };
}
export function scopesFor(provider: Provider, intent: Intent) {
  const identity = ["openid", "email", "profile"];
  if (intent === "login") return identity;
  if (provider === "google")
    return [
      ...identity,
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      ...(intent === "send"
        ? ["https://www.googleapis.com/auth/gmail.send"]
        : []),
      ...(intent === "calendar"
        ? ["https://www.googleapis.com/auth/calendar.events.owned"]
        : []),
    ];
  return [
    ...identity,
    "offline_access",
    "https://graph.microsoft.com/User.Read",
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/Calendars.Read",
    ...(intent === "send" ? ["https://graph.microsoft.com/Mail.Send"] : []),
    ...(intent === "calendar"
      ? ["https://graph.microsoft.com/Calendars.ReadWrite"]
      : []),
  ];
}
export function capabilities(
  provider: Provider | null | undefined,
  scopes: string | null | undefined,
) {
  const granted = new Set(
    (scopes || "")
      .split(/\s+/)
      .map((s) =>
        s.replace(/^https:\/\/graph.microsoft.com\//i, "").toLowerCase(),
      ),
  );
  const has = (scope: string) => granted.has(scope.toLowerCase());
  if (!provider)
    return {
      readMail: false,
      readCalendar: false,
      sendMail: false,
      writeCalendar: false,
    };
  return provider === "google"
    ? {
        readMail: has("https://www.googleapis.com/auth/gmail.readonly"),
        readCalendar:
          has("https://www.googleapis.com/auth/calendar.events.readonly") ||
          has("https://www.googleapis.com/auth/calendar.events.owned"),
        sendMail: has("https://www.googleapis.com/auth/gmail.send"),
        writeCalendar: has(
          "https://www.googleapis.com/auth/calendar.events.owned",
        ),
      }
    : {
        readMail: has("Mail.Read"),
        readCalendar: has("Calendars.Read") || has("Calendars.ReadWrite"),
        sendMail: has("Mail.Send"),
        writeCalendar: has("Calendars.ReadWrite"),
      };
}
