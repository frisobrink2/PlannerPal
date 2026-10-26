export const metadata = {
  robots: { index: false, follow: false },
  title: "PlannerPal · Beheer",
};
export default function Admin() {
  return (
    <main className="privacy-page">
      <a className="source" href="/assistant">
        ← Naar de app
      </a>
      <h1>Installatie voor de beheerder</h1>
      <p>
        Gebruikers melden zich aan via Google of Microsoft. Zij hoeven geen
        sleutels of databasegegevens in te vullen.
      </p>
      <h2>Eenmalige installatie</h2>
      <p>
        Verbind Vercel met Neon, stel een SESSION_SECRET in en registreer een
        Web OAuth-app bij de aanbieders die je wilt ondersteunen. Google en
        Microsoft hebben ieder hun eigen appregistratie nodig.
      </p>
      <p>
        Productiebuilds in Vercel voeren de versiebeheerste databasemigraties
        automatisch uit als DATABASE_URL aanwezig is. Preview- en lokale builds
        wijzigen de database niet.
      </p>
      <p>
        Betaalde AI staat standaard uit, ook als er een API-sleutel aanwezig is.
        Regels, standaardantwoorden en handmatige taken werken zonder
        AI-abonnement. Gratis platformabonnementen hebben gebruiksgrenzen;
        controleer die bij Vercel en Neon.
      </p>
      <a
        className="primary"
        href="https://github.com/frisobrink2/PlannerPal/blob/main/docs/CONNECT.md"
        target="_blank"
        rel="noreferrer"
      >
        Volledige installatiehandleiding
      </a>
    </main>
  );
}
