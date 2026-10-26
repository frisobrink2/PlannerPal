import { z } from "zod";
import { requireUser } from "../../../server/auth";
import {
  sameOrigin,
  jsonBody,
  response,
  routeError,
} from "../../../server/http";
import { clearConnection, revokeConnection } from "../../../server/disconnect";
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    z.object({ confirmed: z.literal(true) }).parse(await jsonBody(request));
    const revoked = await revokeConnection(user);
    await clearConnection(user.id);
    return response({ disconnected: true, revoked, provider: user.provider });
  } catch (error) {
    return routeError(error);
  }
}
