import { database } from "./db";
import { seal, unseal } from "./crypto";
import { required } from "./config";
import { requestProvider, PublicError, ProviderError } from "./http";
import type { Account } from "./auth";
export type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
};
export const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.events.owned",
];
export async function accessToken(user: Account) {
  const tokens = unseal<Tokens>(user.google_tokens);
  if (tokens.expires_at > Date.now() + 60000) return tokens.access_token;
  let response: Response;
  try {
    response = await requestProvider("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required("GOOGLE_CLIENT_ID"),
        client_secret: required("GOOGLE_CLIENT_SECRET"),
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
      }),
    });
  } catch (error) {
    if (
      error instanceof ProviderError &&
      [400, 401, 403].includes(error.status)
    )
      throw new PublicError(
        "Google-toegang is verlopen of ingetrokken. Log uit en verbind Google opnieuw.",
        401,
      );
    throw error;
  }
  const fresh = await response.json();
  if (!fresh.access_token)
    throw new PublicError("Verbind Google opnieuw.", 401);
  const next = {
    ...tokens,
    access_token: fresh.access_token,
    expires_at: Date.now() + fresh.expires_in * 1000,
  };
  await database().query("UPDATE users SET google_tokens=$1 WHERE id=$2", [
    seal(next),
    user.id,
  ]);
  user.google_tokens = seal(next);
  return next.access_token;
}
export async function google<T>(
  user: Account,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (
    !path.startsWith("/gmail/v1/users/me/") &&
    !path.startsWith("/calendar/v3/calendars/primary/")
  )
    throw new Error("Unsupported Google endpoint");
  const token = await accessToken(user);
  const result = await requestProvider("https://www.googleapis.com" + path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (result.status === 204) return undefined as T;
  return result.json();
}
