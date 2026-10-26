import { NextRequest } from "next/server";
import { oauthStart } from "../../../../server/oauth";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return oauthStart(request, "microsoft");
}
