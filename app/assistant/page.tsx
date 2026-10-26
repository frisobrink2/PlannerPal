import { configuration } from "../../server/config";
import { database } from "../../server/db";
import { currentUser } from "../../server/auth";
import { capabilities } from "../../server/provider-config";
import Assistant from "./workspace";
export const dynamic = "force-dynamic";
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string; revoke?: string }>;
}) {
  const config = configuration();
  let user = null;
  let storageReady = true;
  if (config.ready)
    try {
      await database().query("SELECT provider FROM auth_identities LIMIT 1");
      const account = await currentUser();
      if (account)
        user = {
          name: account.name,
          email: account.email,
          loginProvider: account.login_provider || "google",
          provider: account.provider || null,
          connectedEmail: account.connection_email || null,
          capabilities: capabilities(account.provider, account.scopes),
        };
    } catch {
      storageReady = false;
    }
  const params = await searchParams;
  return (
    <Assistant
      account={user}
      configured={config.ready && storageReady}
      providers={config.providers}
      aiReady={config.aiReady}
      authFailed={Boolean(params.auth && params.auth !== "setup")}
      revokeWarning={params.revoke === "manual"}
    />
  );
}
