import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { appUrl, required } from "../../../../server/config";
import { hash, randomToken, seal, unseal } from "../../../../server/crypto";
import { database, transaction } from "../../../../server/db";
import { requestProvider } from "../../../../server/http";
import { sessionCookie } from "../../../../server/auth";
import { googleScopes } from "../../../../server/google";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let success = false;
  let session = "";
  try {
    const cookie = (await cookies()).get("plannerpal_oauth")?.value;
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!cookie || !code || !state) throw new Error("Missing OAuth fields");
    const saved = unseal<{ state: string; verifier: string; created: number }>(
      cookie,
    );
    const a = Buffer.from(state),
      b = Buffer.from(saved.state);
    if (
      a.length !== b.length ||
      !timingSafeEqual(a, b) ||
      Date.now() - saved.created > 600000
    )
      throw new Error("Invalid OAuth state");
    const tokens = await (
      await requestProvider("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: required("GOOGLE_CLIENT_ID"),
          client_secret: required("GOOGLE_CLIENT_SECRET"),
          redirect_uri: appUrl() + "/api/auth/callback",
          grant_type: "authorization_code",
          code_verifier: saved.verifier,
        }),
      })
    ).json();
    const profile = await (
      await requestProvider(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      )
    ).json();
    if (
      !profile.sub ||
      !profile.email_verified ||
      profile.email?.toLowerCase() !==
        required("ALLOWED_GOOGLE_EMAIL").trim().toLowerCase()
    )
      throw new Error("Account not allowed");
    const scopes = new Set(String(tokens.scope).split(" "));
    if (
      !googleScopes
        .filter((s) => s.startsWith("https:"))
        .every((s) => scopes.has(s))
    )
      throw new Error("Missing permissions");
    const existing = await database().query(
      "SELECT google_tokens FROM users WHERE id=$1",
      [profile.sub],
    );
    const refresh =
      tokens.refresh_token ||
      (existing.rows[0]
        ? unseal<{ refresh_token: string }>(
            existing.rows[0].google_tokens as string,
          ).refresh_token
        : null);
    if (!refresh) throw new Error("No refresh token");
    session = randomToken();
    await transaction(async (db) => {
      await db.query(
        "INSERT INTO users(id,email,name,google_tokens) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET email=$2,name=$3,google_tokens=$4",
        [
          profile.sub,
          profile.email,
          profile.name || profile.email,
          seal({
            access_token: tokens.access_token,
            refresh_token: refresh,
            expires_at: Date.now() + tokens.expires_in * 1000,
            scope: tokens.scope,
          }),
        ],
      );
      await db.query("DELETE FROM sessions WHERE expires_at<now()");
      await db.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
        [hash(session), profile.sub],
      );
    });
    success = true;
  } catch {
    /* Never expose provider responses, codes, credentials or mailbox contents in logs. */
  }
  const result = NextResponse.redirect(
    appUrl() + "/assistant" + (success ? "" : "?auth=failed"),
  );
  result.cookies.set("plannerpal_oauth", "", { path: "/api/auth", maxAge: 0 });
  if (success)
    result.cookies.set(sessionCookie, session, {
      httpOnly: true,
      secure: appUrl().startsWith("https:"),
      sameSite: "lax",
      path: "/",
      maxAge: 604800,
    });
  return result;
}
