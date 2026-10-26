import { cookies } from "next/headers";
import { z } from "zod";
import { requireUser, sessionCookie } from "../../../server/auth";
import { database } from "../../../server/db";
import { unseal } from "../../../server/crypto";
import { Tokens } from "../../../server/google";
import {
  sameOrigin,
  jsonBody,
  response,
  routeError,
} from "../../../server/http";
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    z.object({ confirmed: z.literal(true) }).parse(await jsonBody(request));
    let revoked = false;
    try {
      const tokens = unseal<Tokens>(user.google_tokens);
      const result = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tokens.refresh_token }),
        signal: AbortSignal.timeout(10000),
      });
      revoked = result.ok;
    } catch {}
    await database().query("DELETE FROM users WHERE id=$1", [user.id]);
    (await cookies()).set(sessionCookie, "", { maxAge: 0, path: "/" });
    return response({ deleted: true, revoked });
  } catch (error) {
    return routeError(error);
  }
}
