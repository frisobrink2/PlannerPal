import { readFile } from "node:fs/promises";
import pg from "pg";
if (!process.env.DATABASE_URL)
  throw new Error("Stel DATABASE_URL veilig in voor de migratie.");
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  url.searchParams.set("sslmode", "verify-full");
const pool = new pg.Pool({ connectionString: url.toString() });
try {
  await pool.query(
    await readFile(new URL("../db/001-assistant.sql", import.meta.url), "utf8"),
  );
  console.log("PlannerPal-databaseschema toegepast.");
} finally {
  await pool.end();
}
