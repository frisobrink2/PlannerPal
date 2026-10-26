import { requireCapability, type Account } from "./auth";
import { providerToken } from "./provider-token";
import { requestProvider, PublicError } from "./http";
export const accessToken = providerToken;
export async function google<T>(
  user: Account,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (user.provider !== "google")
    throw new PublicError("Dit account is niet met Google verbonden.", 403);
  if (path.startsWith("/gmail/v1/users/me/"))
    requireCapability(user, path.endsWith("/send") ? "sendMail" : "readMail");
  else if (path.startsWith("/calendar/v3/calendars/primary/"))
    requireCapability(
      user,
      init.method && init.method !== "GET" ? "writeCalendar" : "readCalendar",
    );
  else throw new Error("Unsupported Google endpoint");
  const token = await providerToken(user);
  const result = await requestProvider("https://www.googleapis.com" + path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (result.status === 204) return undefined as T;
  return result.json();
}
