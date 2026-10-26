"use client";
export default function ProviderButtons({
  available,
  intent = "login",
  disabled = false,
}: {
  available: { google: boolean; microsoft: boolean };
  intent?: "login" | "connect";
  disabled?: boolean;
}) {
  return (
    <div className="provider-buttons">
      {(["google", "microsoft"] as const).map((provider) => {
        const label = provider === "google" ? "Google" : "Microsoft";
        const text =
          intent === "login" ? `Doorgaan met ${label}` : `${label} verbinden`;
        return !disabled && available[provider] ? (
          <a
            key={provider}
            className="provider-button"
            href={`/api/auth/${provider}?intent=${intent}`}
          >
            <span className={`provider-symbol ${provider}`} aria-hidden="true">
              {provider === "google" ? (
                "G"
              ) : (
                <>
                  <i />
                  <i />
                  <i />
                  <i />
                </>
              )}
            </span>
            {text}
            <span aria-hidden="true">→</span>
          </a>
        ) : (
          <button key={provider} className="provider-button" disabled>
            <span className={`provider-symbol ${provider}`} aria-hidden="true">
              {provider === "google" ? (
                "G"
              ) : (
                <>
                  <i />
                  <i />
                  <i />
                  <i />
                </>
              )}
            </span>
            <span>
              {text}
              <small>Tijdelijk niet beschikbaar</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
