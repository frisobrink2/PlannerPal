import { database, type Queryable } from "./db";
import { seal, unseal } from "./crypto";
import { providerSettings } from "./provider-config";
import { requestProvider, PublicError, ProviderError } from "./http";
import type { Account } from "./auth";
import type { ProviderTokens } from "./identity";
export async function providerToken(user: Account, db?: Queryable) {
  if (!user.provider || !user.provider_tokens)
    throw new PublicError(
      "Verbind eerst je mail en agenda via Instellingen.",
      403,
    );
  const tokens = unseal<ProviderTokens>(user.provider_tokens);
  if (tokens.expires_at > Date.now() + 60000) return tokens.access_token;
  if (!tokens.refresh_token)
    throw new PublicError("Verbind je mailaccount opnieuw.", 401);
  const settings = providerSettings(user.provider);
  let response;
  try {
    response = await requestProvider(
      settings.token,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          refresh_token: tokens.refresh_token,
          grant_type: "refresh_token",
        }),
      },
      user.provider,
    );
  } catch (error) {
    if (
      error instanceof ProviderError &&
      [400, 401, 403].includes(error.status)
    )
      throw new PublicError(
        "De toestemming is verlopen of ingetrokken. Verbind je mailaccount opnieuw via Instellingen.",
        401,
      );
    throw error;
  }
  const fresh = await response.json();
  if (!fresh.access_token || !Number.isFinite(fresh.expires_in))
    throw new PublicError("Verbind je mailaccount opnieuw.", 401);
  const next = {
    ...tokens,
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token || tokens.refresh_token,
    scope: fresh.scope || tokens.scope,
    expires_at: Date.now() + fresh.expires_in * 1000,
  };
  const encrypted = seal(next);
  const saved = await (db || database()).query(
    "UPDATE connections SET tokens=$1,scopes=$2 WHERE user_id=$3 AND provider=$4 AND subject=$5 AND tokens=$6 RETURNING user_id",
    [
      encrypted,
      next.scope,
      user.id,
      user.provider,
      user.connection_subject,
      user.provider_tokens,
    ],
  );
  if (!saved.rows[0])
    throw new PublicError(
      "De verbinding is gewijzigd. Vernieuw het overzicht.",
      409,
    );
  user.provider_tokens = encrypted;
  user.scopes = next.scope;
  return next.access_token;
}
