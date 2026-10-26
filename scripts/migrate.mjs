import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";
if (!process.env.DATABASE_URL)
  throw new Error("Stel DATABASE_URL veilig in voor de migratie.");
let url;
try {
  url = new URL(process.env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
} catch {
  console.error("DATABASE_URL heeft geen geldige PostgreSQL-structuur.");
  process.exit(1);
}
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  url.searchParams.set("sslmode", "verify-full");
const pool = new pg.Pool({
  connectionString: url.toString(),
  max: 1,
  connectionTimeoutMillis: 10000,
});
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('plannerpal:migrations'))",
  );
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const dir = new URL("../db/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort()) {
    const text = await readFile(new URL(name, dir), "utf8");
    const checksum = createHash("sha256").update(text).digest("hex");
    const previous = (
      await client.query(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      )
    ).rows[0];
    if (previous) {
      if (previous.checksum !== checksum)
        throw new Error(
          "Een toegepaste migratie is gewijzigd; herstel het oorspronkelijke bestand.",
        );
      continue;
    }
    const sql = text
      .replace(/^\s*BEGIN\s*;/i, "")
      .replace(/COMMIT\s*;\s*$/i, "");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
      [name, checksum],
    );
    console.log("Migratie toegepast: " + name);
  }
  await client.query("COMMIT");
  console.log("Databaseschema is actueel.");
} catch {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Migratie mislukt. Controleer databasebereikbaarheid, schema en migratiegeschiedenis. Verbindingsgegevens worden niet getoond.",
  );
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
