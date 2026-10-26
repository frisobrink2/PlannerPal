import { requireUser } from "../../../server/auth";
import { rateLimit } from "../../../server/ai";
import { aiKey } from "../../../server/config";
import {
  sameOrigin,
  response,
  routeError,
  PublicError,
  requestProvider,
  limitedBody,
} from "../../../server/http";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (Number(request.headers.get("content-length") || 0) > 4200000)
      throw new PublicError("De opname mag maximaal 4 MB groot zijn.", 413);
    const bytes = await limitedBody(request, 4200000);
    const form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new Uint8Array(bytes),
    }).formData();
    const file = form.get("audio");
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 4000000 ||
      ![
        "audio/mp4",
        "audio/mpeg",
        "audio/webm",
        "audio/wav",
        "audio/x-m4a",
        "audio/ogg",
      ].includes(file.type.split(";")[0])
    )
      throw new PublicError(
        "Kies een ondersteunde audio-opname van maximaal 4 MB.",
      );
    await rateLimit(user.id);
    const upload = new FormData();
    upload.set(
      "file",
      file,
      "notitie." +
        (file.type.includes("mp4") || file.type.includes("m4a")
          ? "m4a"
          : file.type.includes("mpeg")
            ? "mp3"
            : file.type.includes("wav")
              ? "wav"
              : file.type.includes("ogg")
                ? "ogg"
                : "webm"),
    );
    upload.set("model", "gpt-4o-mini-transcribe");
    upload.set("language", "nl");
    const result = await requestProvider(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${aiKey()}` },
        body: upload,
      },
      "OpenAI",
    );
    const data = await result.json();
    if (typeof data.text !== "string" || data.text.length > 16000)
      throw new PublicError(
        "Deze opname kon niet als korte notitie worden verwerkt.",
        502,
      );
    return response({ text: data.text });
  } catch (error) {
    return routeError(error);
  }
}
