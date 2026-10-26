import { NextRequest } from "next/server";
import { oauthCallback } from "../../../../server/oauth";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return oauthCallback(request, "google");
}
