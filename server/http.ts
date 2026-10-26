import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { appUrl } from "./config";
import { PublicError } from "./http-error";
export { PublicError } from "./http-error";
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
  ) {
    super("Provider request failed");
  }
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== appUrl())
    throw new PublicError("Dit verzoek komt niet van jouw werkplek.", 403);
}
export async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new PublicError("Dit verzoek is te groot.", 413);
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new PublicError("Dit verzoek is te groot.", 413);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new PublicError("Verwacht JSON.", 415);
  const text = (await limitedBody(request, 64000)).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new PublicError("Ongeldige invoer.");
  }
}
export function response(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function routeError(error: unknown) {
  if (error instanceof PublicError)
    return response({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return response({ error: "Controleer de ingevulde velden." }, 400);
  if (error instanceof ProviderError)
    return response(
      {
        error:
          error.status === 401 || error.status === 403
            ? "De gekoppelde dienst weigert toegang. Controleer de toestemming en verbind je account zo nodig opnieuw."
            : "De gekoppelde dienst is tijdelijk niet beschikbaar. Probeer het later opnieuw.",
      },
      502,
    );
  return response(
    {
      error:
        "Deze actie kon niet worden uitgevoerd. Controleer de serverconfiguratie of probeer het later opnieuw.",
    },
    500,
  );
}
export async function requestProvider(
  url: string,
  init: RequestInit = {},
  provider = "Google",
) {
  const result = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!result.ok) throw new ProviderError(provider, result.status);
  return result;
}
