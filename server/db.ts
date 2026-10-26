import { Pool, PoolClient } from "pg";
import { required } from "./config";
export type Queryable = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
};
let pool: Pool | undefined;
export function database() {
  let url: URL;
  try {
    url = new URL(required("DATABASE_URL"));
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("DATABASE_URL heeft geen geldige PostgreSQL-structuur.");
  }
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    url.searchParams.set("sslmode", "verify-full");
  return (pool ??= new Pool({
    connectionString: url.toString(),
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    statement_timeout: 15000,
    query_timeout: 20000,
  }));
}
export async function transaction<T>(
  work: (db: Queryable) => Promise<T>,
): Promise<T> {
  const client: PoolClient = await database().connect();
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function audit(
  db: Queryable,
  userId: string,
  action: string,
  status: string,
  resourceId?: string,
) {
  await db.query(
    "INSERT INTO audit_log(user_id,action,status,resource_id) VALUES($1,$2,$3,$4)",
    [userId, action, status, resourceId ?? null],
  );
}
