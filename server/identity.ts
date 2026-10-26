import { randomUUID } from "node:crypto";
import type { Queryable } from "./db";
import type { Provider } from "./provider-config";
import { PublicError } from "./http";
import { seal, unseal } from "./crypto";
export type Identity = { subject: string; email: string; name: string };
export type ProviderTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope: string;
};
export async function signInIdentity(
  db: Queryable,
  provider: Provider,
  identity: Identity,
) {
  let row = (
    await db.query(
      "SELECT user_id FROM auth_identities WHERE provider=$1 AND subject=$2",
      [provider, identity.subject],
    )
  ).rows[0];
  if (!row) {
    const id = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name,login_provider) VALUES($1,$2,$3,$4)",
      [id, identity.email, identity.name, provider],
    );
    row = (
      await db.query(
        "INSERT INTO auth_identities(provider,subject,user_id) VALUES($1,$2,$3) ON CONFLICT(provider,subject) DO NOTHING RETURNING user_id",
        [provider, identity.subject, id],
      )
    ).rows[0];
    if (!row) {
      await db.query("DELETE FROM users WHERE id=$1", [id]);
      row = (
        await db.query(
          "SELECT user_id FROM auth_identities WHERE provider=$1 AND subject=$2",
          [provider, identity.subject],
        )
      ).rows[0];
    }
  }
  if (!row) throw new Error("Identity creation failed");
  await db.query("UPDATE users SET email=$1,name=$2 WHERE id=$3", [
    identity.email,
    identity.name,
    row.user_id,
  ]);
  return row.user_id as string;
}
export async function connectIdentity(
  db: Queryable,
  userId: string,
  provider: Provider,
  identity: Identity,
  tokens: ProviderTokens,
) {
  await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
  const existing = (
    await db.query("SELECT * FROM connections WHERE user_id=$1", [userId])
  ).rows[0];
  if (
    existing &&
    (existing.provider !== provider || existing.subject !== identity.subject)
  )
    throw new PublicError(
      "Koppel je huidige mailaccount eerst los voordat je een ander account verbindt.",
      409,
    );
  const previous = existing
    ? unseal<ProviderTokens>(existing.tokens as string)
    : null;
  const refresh = tokens.refresh_token || previous?.refresh_token;
  if (!refresh)
    throw new PublicError(
      "Geen blijvende toestemming ontvangen. Verbind opnieuw en geef de gevraagde toestemming.",
      400,
    );
  await db.query(
    "INSERT INTO connections(user_id,provider,subject,email,tokens,scopes) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id) DO UPDATE SET tokens=$5,scopes=$6,email=$4,connected_at=now()",
    [
      userId,
      provider,
      identity.subject,
      identity.email,
      seal({ ...tokens, refresh_token: refresh }),
      tokens.scope,
    ],
  );
  await db.query("UPDATE users SET google_tokens=NULL WHERE id=$1", [userId]);
}
