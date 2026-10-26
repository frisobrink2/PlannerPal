// Vercel Production has access to Neon; local builds and previews do not mutate it.
if (process.env.VERCEL_ENV === "production" && process.env.DATABASE_URL) {
  await import("./migrate.mjs");
  if (process.exitCode) process.exit(process.exitCode);
} else
  console.log("Geen automatische productiemigratie nodig voor deze build.");
