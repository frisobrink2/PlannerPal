import { requireUser } from "../../../server/auth";
import { syncMail } from "../../../server/mail";
import { sameOrigin, response, routeError } from "../../../server/http";
import { workspace } from "../../../server/workspace";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    const user = await requireUser();
    return response(await workspace(user.id));
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const imported = await syncMail(user);
    return response({ ...(await workspace(user.id)), imported });
  } catch (error) {
    return routeError(error);
  }
}
