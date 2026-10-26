import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, decodeJwt } from "jose";
import { z } from "zod";
import { appUrl, configuration } from "./config";
import { randomToken, hash, seal, unseal } from "./crypto";
import { currentUser, sessionCookie } from "./auth";
import { requestProvider } from "./http";
import { transaction } from "./db";
import { signInIdentity, connectIdentity, type Identity } from "./identity";
import {
  providerConfigured,
  providerSettings,
  scopesFor,
  capabilities,
  type Provider,
  type Intent,
  intents,
} from "./provider-config";
type Flow = {
  provider: Provider;
  intent: Intent;
  owner?: string;
  state: string;
  verifier: string;
  nonce: string;
  created: number;
  scopes?: string[];
};
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const microsoftKeys = createRemoteJWKSet(
  new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"),
);
export async function verifyIdentity(
  provider: Provider,
  idToken: string,
  nonce: string,
): Promise<Identity> {
  const settings = providerSettings(provider);
  let issuer: string | string[],
    keys = googleKeys;
  if (provider === "google")
    issuer = ["https://accounts.google.com", "accounts.google.com"];
  else {
    const tenant = z.uuid().parse(decodeJwt(idToken).tid);
    issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
    keys = microsoftKeys;
  }
  const { payload } = await jwtVerify(idToken, keys, {
    issuer,
    audience: settings.clientId,
    algorithms: ["RS256"],
  });
  if (payload.nonce !== nonce || !payload.sub)
    throw new Error("Invalid identity nonce");
  if (provider === "google" && payload.email_verified !== true)
    throw new Error("Unverified Google email");
  const email = z.email().parse(payload.email || payload.preferred_username);
  return {
    subject:
      provider === "microsoft"
        ? `${String(payload.tid)}:${payload.sub}`
        : payload.sub,
    email,
    name: typeof payload.name === "string" ? payload.name : email,
  };
}
export function validateFlow(
  saved: Flow,
  provider: Provider,
  state: string,
  now = Date.now(),
) {
  const a = Buffer.from(state),
    b = Buffer.from(saved.state);
  if (
    saved.provider !== provider ||
    !intents.includes(saved.intent) ||
    a.length !== b.length ||
    !timingSafeEqual(a, b) ||
    now - saved.created > 600000 ||
    saved.created > now + 10000
  )
    throw new Error("Invalid OAuth flow");
}
export async function oauthStart(request: NextRequest, provider: Provider) {
  const config = configuration();
  if (!config.ready || !providerConfigured(provider))
    return NextResponse.redirect(appUrl() + "/assistant?auth=setup");
  const parsed = z
    .enum(intents)
    .safeParse(request.nextUrl.searchParams.get("intent") || "login");
  if (!parsed.success)
    return NextResponse.redirect(appUrl() + "/assistant?auth=failed");
  const intent = parsed.data;
  const user = intent === "login" ? null : await currentUser();
  if (intent !== "login" && !user)
    return NextResponse.redirect(appUrl() + "/assistant?auth=signin");
  if (user?.provider && user.provider !== provider)
    return NextResponse.redirect(appUrl() + "/assistant?auth=disconnect");
  const flow: Flow = {
    provider,
    intent,
    owner: user?.id,
    state: randomToken(),
    verifier: randomToken(),
    nonce: randomToken(),
    created: Date.now(),
  };
  const granted = user ? capabilities(user.provider, user.scopes) : null;
  flow.scopes = [
    ...new Set([
      ...scopesFor(provider, intent),
      ...(granted?.sendMail ? scopesFor(provider, "send") : []),
      ...(granted?.writeCalendar ? scopesFor(provider, "calendar") : []),
    ]),
  ];
  const settings = providerSettings(provider);
  const url = new URL(settings.authorize);
  url.search = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: appUrl() + settings.callback,
    response_type: "code",
    response_mode: "query",
    scope: flow.scopes.join(" "),
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256")
      .update(flow.verifier)
      .digest("base64url"),
    code_challenge_method: "S256",
    prompt: intent === "login" ? "select_account" : "consent",
    ...(provider === "google"
      ? {
          access_type: intent === "login" ? "online" : "offline",
          include_granted_scopes: intent === "login" ? "false" : "true",
        }
      : {}),
  }).toString();
  const result = NextResponse.redirect(url);
  result.cookies.set("plannerpal_oauth", seal(flow), {
    httpOnly: true,
    secure: appUrl().startsWith("https:"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/auth",
  });
  return result;
}
export async function oauthCallback(request: NextRequest, provider: Provider) {
  let success = false,
    session = "",
    intent: Intent = "login";
  try {
    const cookie = (await cookies()).get("plannerpal_oauth")?.value;
    const code = request.nextUrl.searchParams.get("code"),
      state = request.nextUrl.searchParams.get("state");
    if (!cookie || !code || !state) throw new Error("Missing OAuth fields");
    const flow = unseal<Flow>(cookie);
    validateFlow(flow, provider, state);
    intent = flow.intent;
    const user = intent === "login" ? null : await currentUser();
    if (intent !== "login" && (!user || user.id !== flow.owner))
      throw new Error("Connection owner changed");
    const settings = providerSettings(provider);
    const token = await (
      await requestProvider(
        settings.token,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: settings.clientId,
            client_secret: settings.clientSecret,
            redirect_uri: appUrl() + settings.callback,
            grant_type: "authorization_code",
            code_verifier: flow.verifier,
            ...(provider === "microsoft"
              ? {
                  scope: (flow.scopes || scopesFor(provider, intent)).join(" "),
                }
              : {}),
          }),
        },
        provider,
      )
    ).json();
    const identity = await verifyIdentity(provider, token.id_token, flow.nonce);
    if (intent === "login") {
      session = randomToken();
      await transaction(async (db) => {
        const id = await signInIdentity(db, provider, identity);
        await db.query("DELETE FROM sessions WHERE expires_at<now()");
        await db.query(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
          [hash(session), id],
        );
      });
    } else {
      const permissions = capabilities(provider, token.scope);
      if (
        !permissions.readMail ||
        !permissions.readCalendar ||
        (intent === "send" && !permissions.sendMail) ||
        (intent === "calendar" && !permissions.writeCalendar)
      )
        throw new Error("Required permission declined");
      let email = identity.email;
      if (provider === "microsoft") {
        const profile = await (
          await requestProvider(
            "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
            { headers: { Authorization: `Bearer ${token.access_token}` } },
            "Microsoft",
          )
        ).json();
        email = z.email().parse(profile.mail || profile.userPrincipalName);
      }
      await transaction((db) =>
        connectIdentity(
          db,
          user!.id,
          provider,
          { ...identity, email },
          {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expires_at: Date.now() + Number(token.expires_in) * 1000,
            scope: token.scope,
          },
        ),
      );
    }
    success = true;
  } catch {
    /* No provider responses, credentials or personal data in logs. */
  }
  const result = NextResponse.redirect(
    appUrl() +
      "/assistant" +
      (success
        ? intent === "login"
          ? "?welcome=1"
          : "?connected=1"
        : "?auth=failed"),
  );
  result.cookies.set("plannerpal_oauth", "", { path: "/api/auth", maxAge: 0 });
  if (success && session)
    result.cookies.set(sessionCookie, session, {
      httpOnly: true,
      secure: appUrl().startsWith("https:"),
      sameSite: "lax",
      path: "/",
      maxAge: 604800,
    });
  return result;
}
