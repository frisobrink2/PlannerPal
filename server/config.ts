import { providerConfigured } from "./provider-config";
import { PublicError } from "./http-error";
export const requiredSettings = ["DATABASE_URL", "SESSION_SECRET"] as const;
export function paidAiEnabled() {
  return process.env.ENABLE_PAID_AI === "true";
}
export function configuration() {
  const missing: string[] = requiredSettings.filter((key) => !process.env[key]);
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32)
    missing.push("SESSION_SECRET");
  const providers = {
    google: providerConfigured("google"),
    microsoft: providerConfigured("microsoft"),
  };
  return {
    ready: missing.length === 0,
    missing: [...new Set(missing)],
    providers,
    aiReady:
      paidAiEnabled() &&
      Boolean(process.env.PLANNERPAL_AI_KEY || process.env.OPENAI_API_KEY),
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
  if (!paidAiEnabled())
    throw new PublicError(
      "Betaalde AI staat uit. Je kunt gratis regels, standaardantwoorden en handmatige taken gebruiken.",
      503,
    );
  return process.env.PLANNERPAL_AI_KEY || required("OPENAI_API_KEY");
}
