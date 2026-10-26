import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { appUrl, configuration, required } from "../../../../server/config";
import { randomToken, seal } from "../../../../server/crypto";
import { googleScopes } from "../../../../server/google";
export const runtime = "nodejs";
export async function GET() {
  if (!configuration().ready)
    return NextResponse.redirect(appUrl() + "/assistant?auth=setup");
  const state = randomToken(),
    verifier = randomToken();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: appUrl() + "/api/auth/callback",
    response_type: "code",
    scope: googleScopes.join(" "),
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    login_hint: required("ALLOWED_GOOGLE_EMAIL"),
  }).toString();
  const result = NextResponse.redirect(url);
  result.cookies.set(
    "plannerpal_oauth",
    seal({ state, verifier, created: Date.now() }),
    {
      httpOnly: true,
      secure: appUrl().startsWith("https:"),
      sameSite: "lax",
      maxAge: 600,
      path: "/api/auth",
    },
  );
  return result;
}
