import type { Analysis } from "./ai";
export function ruleSuggestions(
  text: string,
  subject?: string,
): Analysis & { source: "rules" } {
  const lines = text
    .split(/[\n]+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const actions = subject
    ? /kun je|wil je|graag|verzoek|uiterlijk|deadline|offerte|factuur|voorstel|afspraak/i.test(
        subject + " " + text,
      )
      ? [
          {
            title: `Beantwoord: ${subject}`.slice(0, 160),
            duration: 15,
            priority: "Normaal" as const,
            deadline: null,
            reason: "Controleer zelf of deze mail een actie vraagt.",
          },
        ]
      : []
    : lines
        .slice(0, 5)
        .map((line) => ({
          title: line.slice(0, 160),
          duration: 15,
          priority: "Normaal" as const,
          deadline: null,
          reason:
            "Overgenomen uit je notitie; controleer titel, duur en deadline.",
        }));
  return {
    source: "rules",
    summary: subject
      ? "Regelvoorstel op basis van trefwoorden. Er is geen AI gebruikt."
      : "De eerste vijf regels of zinnen zijn als mogelijke taken overgenomen. Er is geen AI gebruikt.",
    tasks: actions,
    reply: subject
      ? "Bedankt voor je bericht. Ik heb het ontvangen en kom er bij je op terug."
      : "",
  };
}
