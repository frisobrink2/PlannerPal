import { cookies } from "next/headers";
import { database } from "../../../../server/db";
import { hash } from "../../../../server/crypto";
import { sessionCookie } from "../../../../server/auth";
import { sameOrigin, response, routeError } from "../../../../server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const jar = await cookies();
    const token = jar.get(sessionCookie)?.value;
    if (token)
      await database().query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(token),
      ]);
    jar.set(sessionCookie, "", { maxAge: 0, path: "/" });
    return response({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
