import type { Account } from "./auth";
import { transaction } from "./db";
import { unseal } from "./crypto";
import type { ProviderTokens } from "./identity";
import { requestProvider } from "./http";
export async function revokeConnection(user: Account) {
  if (!user.provider_tokens) return true;
  if (user.provider === "microsoft") return false;
  try {
    const tokens = unseal<ProviderTokens>(user.provider_tokens);
    await requestProvider("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: tokens.refresh_token || tokens.access_token,
      }),
    });
    return true;
  } catch {
    return false;
  }
}
export async function clearConnection(userId: string) {
  await transaction(async (db) => {
    await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    await db.query(
      "UPDATE tasks SET source_mail=NULL,calendar_event_id=NULL,calendar_lookup_key=NULL,calendar_status='none',scheduled_start=NULL,scheduled_end=NULL,version=version+1 WHERE user_id=$1",
      [userId],
    );
    await db.query("DELETE FROM drafts WHERE user_id=$1", [userId]);
    await db.query("DELETE FROM mail_cache WHERE user_id=$1", [userId]);
    await db.query("DELETE FROM connections WHERE user_id=$1", [userId]);
    await db.query("UPDATE users SET google_tokens=NULL WHERE id=$1", [userId]);
  });
}
