import { cookies } from "next/headers";
import { z } from "zod";
import { requireUser, sessionCookie } from "../../../server/auth";
import { database } from "../../../server/db";
import { revokeConnection } from "../../../server/disconnect";
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
    const revoked = await revokeConnection(user);
    await database().query("DELETE FROM users WHERE id=$1", [user.id]);
    (await cookies()).set(sessionCookie, "", { maxAge: 0, path: "/" });
    return response({ deleted: true, revoked, provider: user.provider });
  } catch (error) {
    return routeError(error);
  }
}
