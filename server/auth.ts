import { cookies } from "next/headers";
import { database } from "./db";
import { hash } from "./crypto";
import { PublicError } from "./http";
import { capabilities, type Provider } from "./provider-config";
export const sessionCookie = "plannerpal_session";
export type Account = {
  id: string;
  email: string;
  name: string;
  login_provider?: Provider;
  provider?: Provider | null;
  provider_tokens?: string | null;
  connection_email?: string | null;
  connection_subject?: string | null;
  scopes?: string | null;
  google_tokens?: string;
};
export async function currentUser(): Promise<Account | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const { rows } = await database().query(
    "SELECT u.id,u.email,u.name,u.login_provider,c.provider,c.tokens AS provider_tokens,c.email AS connection_email,c.subject AS connection_subject,c.scopes FROM users u JOIN sessions s ON s.user_id=u.id LEFT JOIN connections c ON c.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
    [hash(token)],
  );
  return (rows[0] as Account) || null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user)
    throw new PublicError("Log eerst in met Google of Microsoft.", 401);
  return user;
}
export function requireCapability(
  user: Account,
  capability: keyof ReturnType<typeof capabilities>,
) {
  if (!user.provider || !user.provider_tokens)
    throw new PublicError(
      "Verbind eerst je mail en agenda via Instellingen.",
      403,
    );
  if (!capabilities(user.provider, user.scopes)[capability])
    throw new PublicError(
      "Deze actie heeft extra toestemming nodig. Activeer die via Instellingen.",
      403,
    );
}
