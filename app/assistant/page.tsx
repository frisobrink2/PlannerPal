import { configuration } from "../../server/config";
import { database } from "../../server/db";
import { currentUser } from "../../server/auth";
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
      await database().query("SELECT id FROM users LIMIT 1");
      const account = await currentUser();
      if (account) user = { name: account.name, email: account.email };
    } catch {
      storageReady = false;
    }
  const params = await searchParams;
  return (
    <Assistant
      account={user}
      configured={config.ready && storageReady}
      aiReady={config.aiReady}
      authFailed={params.auth === "failed"}
      revokeWarning={params.revoke === "manual"}
    />
  );
}
