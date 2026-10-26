import { NextResponse } from "next/server";
import { requireUser } from "../../../../server/auth";
import { database } from "../../../../server/db";
import { routeError } from "../../../../server/http";
import { safeMailLink } from "../../../../server/mail";
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id") || "";
    const mail = (
      await database().query(
        "SELECT web_url FROM mail_cache WHERE user_id=$1 AND id=$2",
        [user.id, id],
      )
    ).rows[0];
    const target =
      user.provider === "microsoft"
        ? typeof mail?.web_url === "string" && safeMailLink(mail.web_url)
          ? mail.web_url
          : "https://outlook.office.com/mail/"
        : `https://mail.google.com/mail/?authuser=${encodeURIComponent(user.connection_email || user.email)}#all/${encodeURIComponent(id)}`;
    return NextResponse.redirect(target);
  } catch (error) {
    return routeError(error);
  }
}
