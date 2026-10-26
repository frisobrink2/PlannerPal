export default function Privacy() {
  return (
    <main className="privacy-page">
      <a className="source" href="/assistant">
        ← Terug naar PlannerPal
      </a>
      <h1>Jouw gegevens in PlannerPal</h1>
      <p>
        PlannerPal helpt je mail, taken en agenda bij elkaar te houden. De demo
        gebruikt fictieve gegevens. In de app kies je zelf welke verbinding je
        maakt.
      </p>
      <h2>Aanmelden staat los van mailtoegang</h2>
      <p>
        Bij aanmelden met Google of Microsoft ontvangen we je geverifieerde
        accountidentiteit, naam en e-mailadres. We ontvangen geen wachtwoord en
        vragen bij deze stap geen toegang tot mail of agenda. Je krijgt een
        eigen werkplek. Accounts worden niet automatisch samengevoegd op basis
        van hetzelfde e-mailadres.
      </p>
      <h2>Mail en agenda verbinden</h2>
      <p>
        Na je afzonderlijke toestemming halen we maximaal twintig recente
        inboxmails en je primaire/default agenda op. Voor verzenden en afspraken
        maken vragen we later apart extra rechten. Je blijft de uiteindelijke
        actie bevestigen. Zakelijke Microsoft-accounts kunnen goedkeuring van
        een bedrijfsbeheerder vereisen.
      </p>
      <h2>Waar staan je gegevens?</h2>
      <p>
        Accountgegevens, taken, concepten, getypte notities, opgehaalde
        mailteksten en een actielog staan in de PostgreSQL-database van de
        beheerder. Provider-tokens staan versleuteld op de server en komen niet
        in browseropslag. Sessies gebruiken een beveiligde cookie en verlopen na
        zeven dagen. Privégegevens worden niet in een offline-cache bewaard.
      </p>
      <h2>Geen betaalde AI in de standaardroute</h2>
      <p>
        Regelvoorstellen, standaardantwoorden en het dagoverzicht werken zonder
        AI-dienst. Alleen een bewuste beheerdersinstelling kan optionele
        betaalde AI inschakelen. De aanwezigheid van een sleutel alleen is niet
        voldoende. Als deze uitbreiding is ingeschakeld, vermeldt de app bij de
        betreffende actie dat inhoud naar de ingestelde AI-dienst gaat. Er wordt
        geen complete inbox automatisch naar AI doorgestuurd.
      </p>
      <h2>Notities en opnames</h2>
      <p>
        In de standaardroute typ je je gespreksnotitie. Audio-transcriptie staat
        uit om kosten te voorkomen. Bij een expliciet ingeschakelde uitbreiding
        begint een opname alleen na jouw actie en microfoontoestemming. Er wordt
        niet naar telefoongesprekken geluisterd en geen achtergrondmicrofoon
        gebruikt.
      </p>
      <h2>Loskoppelen of verwijderen</h2>
      <p>
        Mail en agenda loskoppelen laat je aangemeld en bewaart je taken en
        notities. Opgehaalde mail, concepten en externe taakkoppelingen worden
        dan uit PlannerPal verwijderd. Verstuurde mails en aangemaakte afspraken
        blijven bij Google of Microsoft bestaan. Je kunt ook je hele
        PlannerPal-account verwijderen.
      </p>
      <p>
        Waar mogelijk trekken we de Google-toegang in. Microsoft-toestemming
        moet je daarnaast zelf via je provideraccount verwijderen. Dat geldt ook
        als een Google-intrekking mislukt. Gebruik hiervoor{" "}
        <a
          href="https://myaccount.google.com/connections"
          target="_blank"
          rel="noreferrer"
        >
          Google-verbindingen
        </a>
        ,{" "}
        <a
          href="https://account.live.com/consent/Manage"
          target="_blank"
          rel="noreferrer"
        >
          Microsoft persoonlijk
        </a>{" "}
        of{" "}
        <a
          href="https://myapplications.microsoft.com/"
          target="_blank"
          rel="noreferrer"
        >
          Microsoft zakelijk
        </a>
        . Retentie en back-ups van hosting-, database- en eventuele AI-providers
        vallen onder hun eigen voorwaarden en beheerdersinstellingen.
      </p>
      <h2>Op je telefoon</h2>
      <p>
        De app heeft internet nodig. Gegevens worden ververst wanneer de app
        zichtbaar is en bij terugkeer; iOS garandeert geen continue
        achtergrondverwerking. Controleer voorstellen altijd zelf voordat je een
        mail verstuurt of een afspraak maakt.
      </p>
      <p>
        De beheerder van deze PlannerPal-installatie is verantwoordelijk voor
        providerinstellingen, passende toegangsbeveiliging en de voorwaarden bij
        breder gebruik.
      </p>
    </main>
  );
}
