export const requiredSettings = [
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SESSION_SECRET",
  "ALLOWED_GOOGLE_EMAIL",
] as const;
export function configuration() {
  const missing = requiredSettings.filter((key) => !process.env[key]);
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32)
    missing.push("SESSION_SECRET");
  return {
    ready: missing.length === 0,
    missing: [...new Set(missing)],
    aiReady: Boolean(
      process.env.PLANNERPAL_AI_KEY || process.env.OPENAI_API_KEY,
    ),
    appUrl: appUrl(),
  };
}
export function appUrl() {
  const url = new URL(process.env.APP_URL || "https://planner-pal.vercel.app");
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.hostname === "localhost" &&
        url.protocol === "http:"
      ))
  )
    throw new Error("APP_URL moet een HTTPS-origin zijn.");
  return url.origin;
}
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Instelling ontbreekt: ${name}`);
  return value;
}
export const timeZone = "Europe/Amsterdam";

export function aiKey() {
  return process.env.PLANNERPAL_AI_KEY || required("OPENAI_API_KEY");
}
