import { cookies } from "next/headers";
import { database } from "./db";
import { hash } from "./crypto";
import { PublicError } from "./http";
export const sessionCookie = "plannerpal_session";
export type Account = {
  id: string;
  email: string;
  name: string;
  google_tokens: string;
};
export async function currentUser(): Promise<Account | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const { rows } = await database().query(
    "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND lower(u.email)=lower($2)",
    [hash(token), process.env.ALLOWED_GOOGLE_EMAIL?.trim() || ""],
  );
  return (rows[0] as Account) || null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new PublicError("Log eerst in met Google.", 401);
  return user;
}
