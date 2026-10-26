export default function Privacy() {
  return (
    <main className="privacy-page">
      <a className="source" href="/assistant">
        ← Terug naar PlannerPal
      </a>
      <h1>Je gegevens in PlannerPal</h1>
      <p>
        PlannerPal is een persoonlijke assistent in ontwikkeling voor één
        ingesteld Google-account. Gebruik de demo als je geen echte gegevens
        wilt koppelen.
      </p>
      <h2>Wat wordt opgehaald?</h2>
      <p>
        Na Google-toestemming haalt de app de twintig nieuwste mails uit je
        inbox en afspraken uit je primaire agenda op. Mailteksten, taken,
        concepten, door jou verwerkte notities en een actielog worden in de
        ingestelde PostgreSQL-database bewaard. Google-toegangstokens staan
        versleuteld op de server. Ze komen niet in browseropslag of clientcode
        terecht.
      </p>
      <h2>Wanneer wordt AI gebruikt?</h2>
      <p>
        Alleen als je Mail analyseren, Opname uitschrijven of Acties voorstellen
        kiest, gaat de geselecteerde inhoud naar OpenAI. Gebruikskosten vallen
        onder de ingestelde API-account. AI-antwoorden gebruiken store:false; de
        bewaartermijnen en eventuele beveiligingslogging van OpenAI blijven van
        toepassing. Lees de gegevensvoorwaarden van de gekozen aanbieders
        voordat je gevoelige klantinformatie verwerkt.
      </p>
      <h2>Verzenden en agenda-acties</h2>
      <p>
        Een antwoord wordt pas naar Gmail gestuurd na jouw expliciete
        bevestiging van ontvanger en tekst. Agendablokken worden pas na
        goedkeuring aangemaakt of verplaatst. Binnenkomende mails zijn invoer
        voor voorstellen en kunnen zelf geen opdrachten uitvoeren. AI-resultaten
        blijven voorstellen die jij moet controleren.
      </p>
      <h2>Opnames</h2>
      <p>
        De microfoon begint alleen nadat je zelf op Opnemen drukt en
        browsertoegang geeft. Hij stopt na maximaal negentig seconden of wanneer
        je stopt. Audio wordt voor transcriptie doorgestuurd en niet in
        PlannerPal opgeslagen. Alleen de notitie die je daarna laat analyseren
        wordt bewaard. De app luistert niet naar telefoongesprekken of op de
        achtergrond. Deel alleen opnames waarvoor je toestemming hebt.
      </p>
      <h2>Toegang verwijderen</h2>
      <p>
        In Instellingen kun je de koppeling intrekken en alle accountgegevens
        uit PlannerPal verwijderen. Reeds verstuurde mails en aangemaakte
        afspraken blijven in Google bestaan. Bij een mislukte intrekking kun je
        de toegang ook verwijderen via{" "}
        <a
          href="https://myaccount.google.com/connections"
          target="_blank"
          rel="noreferrer"
        >
          je Google-account
        </a>
        . Back-ups en retentie van je databaseprovider worden door de beheerder
        van die dienst geregeld.
      </p>
      <h2>Op je telefoon</h2>
      <p>
        De app heeft internet nodig. Er is geen offline-cache voor mail, agenda
        of notities. Op iPhone wordt niet gegarandeerd op de achtergrond
        gesynchroniseerd; gegevens worden ververst wanneer de app zichtbaar is
        of je zelf vernieuwt.
      </p>
      <p>
        Beheerder: de eigenaar van deze persoonlijke PlannerPal-installatie.
        Voor breder gebruik zijn verdere product- en privacycontroles en
        mogelijk Google-verificatie nodig.
      </p>
    </main>
  );
}
