import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { NextRequest } from "next/server";
import type { Queryable } from "../server/db";
import type { Account } from "../server/auth";
import { signInIdentity, connectIdentity } from "../server/identity";
import { capabilities, scopesFor } from "../server/provider-config";
import { seal, unseal } from "../server/crypto";
import { aiKey, configuration } from "../server/config";
import { analyzeText } from "../server/ai";
import { oauthStart, verifyIdentity, validateFlow } from "../server/oauth";
import {
  graph,
  graphMessage,
  graphEvent,
  microsoftSend,
  microsoftCalendar,
  microsoftWrite,
} from "../server/microsoft";
import { providerToken } from "../server/provider-token";
import { ruleSuggestions } from "../server/rules";
const pg = new PGlite();
const originalFetch = globalThis.fetch;
const db: Queryable = {
  query: async <T extends Record<string, unknown>>(
    query: string,
    params?: unknown[],
  ) => ({ rows: (await pg.query<T>(query, params)).rows }),
};
const tokens = {
  access_token: "fixture-access",
  refresh_token: "fixture-refresh",
  expires_at: Date.now() + 3600000,
  scope: "User.Read Mail.Read Calendars.Read Mail.Send Calendars.ReadWrite",
};
const account: Account = {
  id: "fixture-owner",
  email: "login@example.com",
  name: "Owner",
  provider: "microsoft",
  provider_tokens: "",
  connection_subject: "ms-sub",
  connection_email: "mailbox@example.com",
  scopes: tokens.scope,
};
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let publicJwk: Awaited<ReturnType<typeof exportJWK>>;
before(async () => {
  process.env.DATABASE_URL = "postgresql://fixture:fixture@localhost/test";
  process.env.SESSION_SECRET = "fixture-key-for-provider-tests-32-characters";
  process.env.APP_URL = "https://planner-pal.vercel.app";
  process.env.GOOGLE_CLIENT_ID = "google-fixture";
  process.env.GOOGLE_CLIENT_SECRET = "fixture";
  process.env.MICROSOFT_CLIENT_ID = "microsoft-fixture";
  process.env.MICROSOFT_CLIENT_SECRET = "fixture";
  await pg.exec(await readFile("db/001-assistant.sql", "utf8"));
  await pg.exec(await readFile("db/002-multiple-providers.sql", "utf8"));
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  publicJwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "fixture-key",
    alg: "RS256",
    use: "sig",
  };
});
beforeEach(async () => {
  globalThis.fetch = async () => {
    throw new Error("Unexpected external request in test");
  };
  await db.query("DELETE FROM users");
  account.provider_tokens = seal(tokens);
});
after(() => {
  globalThis.fetch = originalFetch;
  return pg.close();
});
const identity = (subject: string, email = "same@example.com") => ({
  subject,
  email,
  name: subject,
});
test("signin scopes contain no mailbox, calendar or offline permission for either provider", () => {
  for (const provider of ["google", "microsoft"] as const) {
    assert.deepEqual(scopesFor(provider, "login"), [
      "openid",
      "email",
      "profile",
    ]);
    const read = capabilities(
      provider,
      scopesFor(provider, "connect").join(" "),
    );
    assert.deepEqual(read, {
      readMail: true,
      readCalendar: true,
      sendMail: false,
      writeCalendar: false,
    });
    assert(
      capabilities(provider, scopesFor(provider, "send").join(" ")).sendMail,
    );
    assert(
      !capabilities(provider, scopesFor(provider, "send").join(" "))
        .writeCalendar,
    );
    assert(
      capabilities(provider, scopesFor(provider, "calendar").join(" "))
        .writeCalendar,
    );
  }
});
test("public signin works without ALLOWED_GOOGLE_EMAIL and creates distinct workspaces for equal emails", async () => {
  delete process.env.ALLOWED_GOOGLE_EMAIL;
  const google = await signInIdentity(db, "google", identity("google-sub"));
  const microsoft = await signInIdentity(db, "microsoft", identity("ms-sub"));
  assert.notEqual(google, microsoft);
  assert.equal((await db.query("SELECT * FROM connections")).rows.length, 0);
  assert.equal(
    await signInIdentity(
      db,
      "google",
      identity("google-sub", "renamed@example.com"),
    ),
    google,
  );
  assert.equal(
    (await db.query("SELECT email FROM users WHERE id=$1", [google])).rows[0]
      .email,
    "renamed@example.com",
  );
});
test("connections remain owned and cannot be silently replaced by another provider/account", async () => {
  const first = await signInIdentity(db, "google", identity("one"));
  const second = await signInIdentity(db, "microsoft", identity("two"));
  await connectIdentity(
    db,
    first,
    "microsoft",
    identity("mail-one", "mail1@example.com"),
    tokens,
  );
  await connectIdentity(
    db,
    second,
    "microsoft",
    identity("mail-two", "mail2@example.com"),
    tokens,
  );
  assert.equal(
    (await db.query("SELECT email FROM connections WHERE user_id=$1", [first]))
      .rows[0].email,
    "mail1@example.com",
  );
  await assert.rejects(
    connectIdentity(db, first, "microsoft", identity("mail-two"), tokens),
    /eerst los/,
  );
  await assert.rejects(
    connectIdentity(db, first, "google", identity("mail-one"), tokens),
    /eerst los/,
  );
});
test("refresh token is retained on incremental consent and stored encrypted", async () => {
  const id = await signInIdentity(db, "google", identity("one"));
  await connectIdentity(db, id, "microsoft", identity("mail-sub"), tokens);
  await connectIdentity(db, id, "microsoft", identity("mail-sub"), {
    access_token: "new-access",
    expires_at: Date.now() + 3600000,
    scope: tokens.scope,
  });
  const encrypted = (
    await db.query("SELECT tokens FROM connections WHERE user_id=$1", [id])
  ).rows[0].tokens as string;
  assert(!encrypted.includes("fixture-refresh"));
  assert.equal(
    unseal<typeof tokens>(encrypted).refresh_token,
    "fixture-refresh",
  );
});
test("legacy migration preserves user ID, sessions, tasks and encrypted Google connection", async () => {
  const legacy = new PGlite();
  try {
    await legacy.exec(await readFile("db/001-assistant.sql", "utf8"));
    const encrypted = seal({
      ...tokens,
      scope: scopesFor("google", "send").join(" "),
    });
    await legacy.query(
      "INSERT INTO users(id,email,name,google_tokens) VALUES($1,$2,$3,$4)",
      ["old-google-sub", "legacy@example.com", "Legacy", encrypted],
    );
    await legacy.exec(
      "INSERT INTO sessions VALUES('fixture-hash','old-google-sub',now()+interval '1 day'); INSERT INTO tasks(id,user_id,title,duration,priority,deadline,work_date) VALUES('legacy-task','old-google-sub','Keep me',30,'Normaal','2026-10-30','2026-10-26')",
    );
    await legacy.exec(await readFile("db/002-multiple-providers.sql", "utf8"));
    await legacy.exec(await readFile("db/002-multiple-providers.sql", "utf8"));
    assert.equal(
      (await legacy.query<{ id: string }>("SELECT id FROM users")).rows[0].id,
      "old-google-sub",
    );
    assert.equal(
      (await legacy.query<{ tokens: string }>("SELECT tokens FROM connections"))
        .rows[0].tokens,
      encrypted,
    );
    assert.equal(
      (
        await legacy.query<{ google_tokens: string }>(
          "SELECT google_tokens FROM users",
        )
      ).rows[0].google_tokens,
      encrypted,
    );
    assert.equal((await legacy.query("SELECT * FROM tasks")).rows.length, 1);
    assert.equal((await legacy.query("SELECT * FROM sessions")).rows.length, 1);
    assert.equal(
      (await legacy.query("SELECT * FROM auth_identities")).rows.length,
      1,
    );
  } finally {
    await legacy.close();
  }
});
test("OAuth validates state, provider, expiry and PKCE; login redirect asks only for identity", async () => {
  const flow = {
    provider: "google" as const,
    intent: "login" as const,
    state: "fixture-state",
    verifier: "fixture",
    nonce: "fixture",
    created: Date.now(),
  };
  validateFlow(flow, "google", "fixture-state");
  assert.throws(() => validateFlow(flow, "microsoft", "fixture-state"));
  assert.throws(() => validateFlow(flow, "google", "bad"));
  assert.throws(() =>
    validateFlow(
      { ...flow, created: Date.now() - 601000 },
      "google",
      "fixture-state",
    ),
  );
  for (const provider of ["google", "microsoft"] as const) {
    const response = await oauthStart(
      new NextRequest("https://planner-pal.vercel.app/api/auth/" + provider),
      provider,
    );
    const target = new URL(response.headers.get("location")!);
    assert.equal(target.searchParams.get("scope"), "openid email profile");
    assert.equal(target.searchParams.get("code_challenge_method"), "S256");
    assert(target.searchParams.get("nonce"));
    assert(target.searchParams.get("state"));
    assert(response.headers.get("set-cookie")?.includes("HttpOnly"));
  }
});
test("signed Google and Microsoft IDs validate audience, issuer, nonce and expiry", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ keys: [publicJwk] }), {
      headers: { "Content-Type": "application/json" },
    });
  const sign = async (
    provider: "google" | "microsoft",
    nonce = "fixture-nonce",
    audience = provider + "-fixture",
    expired = false,
  ) =>
    new SignJWT({
      nonce,
      email: "same@example.com",
      email_verified: true,
      name: "Fixture",
      ...(provider === "microsoft"
        ? { tid: "9188040d-6c67-4c5b-b112-36a304b66dad" }
        : {}),
    })
      .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
      .setSubject("fixture-sub")
      .setIssuer(
        provider === "google"
          ? "https://accounts.google.com"
          : "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
      )
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 5 : "2m")
      .sign(privateKey);
  for (const provider of ["google", "microsoft"] as const) {
    const token = await sign(provider);
    assert.equal(
      (await verifyIdentity(provider, token, "fixture-nonce")).subject,
      provider === "microsoft"
        ? "9188040d-6c67-4c5b-b112-36a304b66dad:fixture-sub"
        : "fixture-sub",
    );
    await assert.rejects(verifyIdentity(provider, token, "wrong-nonce"));
    await assert.rejects(
      verifyIdentity(
        provider,
        await sign(provider, "fixture-nonce", provider + "-fixture", true),
        "fixture-nonce",
      ),
    );
    await assert.rejects(
      verifyIdentity(
        provider,
        await sign(provider, "fixture-nonce", "wrong-client"),
        "fixture-nonce",
      ),
    );
  }
});
test("paid AI is blocked before any external call even if an owner key exists", async () => {
  const previous = process.env.ENABLE_PAID_AI;
  delete process.env.ENABLE_PAID_AI;
  process.env.PLANNERPAL_AI_KEY = "fixture-owner-key";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Must not call paid AI");
  };
  try {
    assert.throws(() => aiKey(), /Betaalde AI staat uit/);
    await assert.rejects(
      analyzeText("text", "mail", "2026-10-26"),
      /Betaalde AI staat uit/,
    );
    assert.equal(calls, 0);
    assert.equal(configuration().aiReady, false);
    assert.equal(
      ruleSuggestions("Kun je een offerte sturen?", "Offerte").source,
      "rules",
    );
    assert.equal(
      ruleSuggestions("Bel Sophie\nMaak een voorstel").tasks.length,
      2,
    );
  } finally {
    if (previous === undefined) delete process.env.ENABLE_PAID_AI;
    else process.env.ENABLE_PAID_AI = previous;
  }
});
test("Microsoft messages normalize Reply-To, source URLs and text to the existing mail model", () => {
  const m = graphMessage({
    id: "ms-id",
    conversationId: "conversation",
    subject: "Offerte",
    receivedDateTime: "2026-10-26T09:00:00Z",
    from: { emailAddress: { name: "Sophie", address: "from@example.com" } },
    replyTo: [{ emailAddress: { address: "reply@example.com" } }],
    body: { contentType: "text", content: "Kun je een offerte sturen?" },
    webLink: "https://outlook.office.com/mail/id/ms-id",
  });
  assert.equal(m.id, "ms-id");
  assert.equal(
    m.payload.headers.find((h) => h.name === "reply-to")?.value,
    "reply@example.com",
  );
  assert.equal(
    Buffer.from(m.payload.body!.data!, "base64url").toString(),
    "Kun je een offerte sturen?",
  );
  assert(m.web_url?.startsWith("https://outlook.office.com/"));
});
test("Microsoft Graph rejects hostile pagination URLs and enforces read/write scopes before network", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}");
  };
  await assert.rejects(graph(account, "https://evil.example/v1.0/me/messages"));
  await assert.rejects(
    graph({ ...account, scopes: "Mail.Read Calendars.Read" }, "/sendMail", {
      method: "POST",
    }),
    /extra toestemming/,
  );
  await assert.rejects(
    graph({ ...account, scopes: "Mail.Read Calendars.Read" }, "/events", {
      method: "POST",
    }),
    /extra toestemming/,
  );
  assert.equal(calls, 0);
});
test("Microsoft MIME send is an explicit Mail.Send call and accepts HTTP 202 without retries", async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://graph.microsoft.com/v1.0/me/sendMail");
    assert.equal(
      (init?.headers as Record<string, string>)["Content-Type"],
      "text/plain",
    );
    assert(
      Buffer.from(init?.body as string, "base64")
        .toString()
        .includes("Message-ID: <fixture@plannerpal.vercel.app>"),
    );
    return new Response(null, { status: 202 });
  };
  const result = await microsoftSend(
    account,
    Buffer.from(
      "Message-ID: <fixture@plannerpal.vercel.app>\r\nTo: recipient@example.com\r\n\r\nBody",
    ).toString("base64url"),
  );
  assert.equal(result.id, "accepted:fixture@plannerpal.vercel.app");
  assert.equal(calls, 1);
});
test("Microsoft calendar normalizes busy state and creates idempotent events with real returned IDs", async () => {
  let posts = 0;
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (init?.method === "POST") {
      posts++;
      const body = JSON.parse(init.body as string);
      assert.equal(body.transactionId, "fixture-calendar-key");
      assert.equal(body.start.timeZone, "UTC");
      return new Response(JSON.stringify({ id: "real-ms-event-id" }));
    }
    return new Response(
      JSON.stringify({
        value: [
          {
            id: "event",
            subject: "Meeting",
            showAs: "busy",
            transactionId: "fixture-calendar-key",
            start: { dateTime: "2026-10-26T09:00:00", timeZone: "UTC" },
            end: { dateTime: "2026-10-26T10:00:00", timeZone: "UTC" },
          },
        ],
      }),
    );
  };
  const items = await microsoftCalendar(
    account,
    "2026-10-26T00:00:00Z",
    "2026-10-27T00:00:00Z",
  );
  assert.equal(items[0].start.dateTime, "2026-10-26T09:00:00.000Z");
  assert.equal(items[0].lookupKey, "fixture-calendar-key");
  const receipt = await microsoftWrite(
    account,
    "/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      body: JSON.stringify({
        id: "fixture-calendar-key",
        summary: "Work",
        start: { dateTime: "2026-10-26T09:00:00Z" },
        end: { dateTime: "2026-10-26T10:00:00Z" },
      }),
    },
  );
  assert.equal(receipt.id, "real-ms-event-id");
  assert.equal(posts, 1);
  assert.equal(
    graphEvent({
      id: "free",
      showAs: "free",
      start: { dateTime: "2026-10-26T09:00:00", timeZone: "UTC" },
      end: { dateTime: "2026-10-26T10:00:00", timeZone: "UTC" },
    }).transparency,
    "transparent",
  );
});
test("Microsoft refresh rotates refresh tokens without touching another user connection", async () => {
  const id = await signInIdentity(db, "microsoft", identity("owner"));
  await connectIdentity(db, id, "microsoft", identity("ms-sub"), {
    ...tokens,
    expires_at: 0,
  });
  const row = (
    await db.query("SELECT tokens FROM connections WHERE user_id=$1", [id])
  ).rows[0];
  const user = { ...account, id, provider_tokens: row.tokens as string };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        access_token: "refreshed-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
        scope: tokens.scope,
      }),
    );
  assert.equal(await providerToken(user, db), "refreshed-access");
  const stored = (
    await db.query("SELECT tokens FROM connections WHERE user_id=$1", [id])
  ).rows[0];
  assert.equal(
    unseal<typeof tokens>(stored.tokens as string).refresh_token,
    "rotated-refresh",
  );
});
