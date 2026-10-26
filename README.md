# PlannerPal

Een Nederlandstalige werkplek voor zelfstandige professionals. Inbox, taken en dagplanning staan op desktop naast elkaar; op mobiel wissel je tussen die onderdelen. Alle mails en personen zijn fictief. Er worden geen mails verstuurd en er vinden geen AI-aanroepen plaats.

## Starten

Node.js 20.9 of nieuwer en npm zijn nodig. Gevalideerd met Node.js 24.

```bash
cd /workspace/PlannerPal
npm ci --cache /tmp/plannerpal-npm
npm run dev
```

De server gebruikt poort 3000. Voor productie:

```bash
npm run build
npm run start
```

Er zijn geen omgevingsvariabelen, accounts, API-sleutels of externe diensten nodig. De cache in `/tmp` voorkomt een probleem met de standaardcache in deze cloudomgeving. Je kunt deze optie op je eigen machine weglaten. Op Vercel kun je de repository als Next.js-project importeren met de standaardinstellingen.

## Probeer de gebruikersroute

1. Open in **Inbox** de mail van Mark Jansen over de websiteofferte. De mail verschijnt in een zijpaneel.
2. Kies **Taakvoorstel aanpassen**, wijzig titel, duur, prioriteit, deadline of werkdag en kies **Taak accepteren**. De taak krijgt een link naar de bronmail.
3. Klik bij de taak op **Inplannen**. Kies een werkdag en een vrij tijdstip tussen 09:00 en 17:00. Afspraken, pauzes en andere taken worden meegenomen in de overlapcontrole.
4. Klik op het geplande blok of op **Verplaatsen** om een andere dag/tijd te kiezen. **Uit planning halen** behoudt de taak zonder tijdstip. De deadline blijft onafhankelijk van de werkdag.
5. Gebruik **Nieuwe taak** om zonder mail een eigen taak toe te voegen. Klik op een taaknaam of het menu met drie puntjes om hem te bewerken of verwijderen.
6. Wissel bovenaan van werkdag via de pijlen of datumkiezer. **Deze dag** toont taken voor de gekozen dag, **Alle open** ook werk voor andere dagen. De agenda en capaciteitsmelding gelden altijd voor de geselecteerde dag.
7. Klik op een afspraak of pauze om die aan te passen. Via het plusje bij **Dagplanning** kun je een blok toevoegen. Overlappende blokken worden geweigerd met een uitleg. Een geplande taak langer maken kan ook een conflict veroorzaken; kies dan een ander tijdstip of **Nog niet inplannen**.
8. Bekijk via de mail **Antwoord controleren**, of open **Antwoordconcepten**. Bewerk en keur een concept goed. Bewerken na goedkeuring zet de status terug naar concept. Er wordt niets verstuurd.
9. Rond taken af met het selectievakje. De gereserveerde tijd komt vrij. Via **Afgerond** kun je taken heropenen en opnieuw plannen.
10. Herlaad de pagina: de taken, werkdagen, agenda, concepten en gelezen mails blijven bewaard. **Ongedaan maken** draait de laatste actie terug zolang je geen nieuwe wijziging doet of herlaadt.
11. De herstelknop rechtsboven zet alle voorbeelddata terug, met bevestiging en de mogelijkheid de reset direct ongedaan te maken.

De demo start op **maandag 26 oktober 2026** met 12 mails, drie taken, vier concepten, twee afspraken en een lunchpauze. Andere dagen beginnen zonder afspraken. **Voorbeelddag** brengt je terug naar de oorspronkelijke dag. Voor iedere mail zijn een taakvoorstel en antwoord vooraf geschreven. Een extra concept wordt toegevoegd bij taakacceptatie of via **Antwoord controleren**.

## Vormgeving en gedrag

De vorige statistiekkaarten, slogans, paarse pasteltinten en sparkle-iconen zijn vervangen door een werkoverzicht met drie onderdelen en één groene actiekleur. Beschikbare tijd en nog te plannen werk worden rechtstreeks vergeleken. Een waarschuwing geeft aan hoeveel werk niet meer in de dag past. Op desktop hebben de kolommen eigen scrollgebieden, zodat taken en agenda in beeld blijven. Op mobiel wissel je tussen Inbox, Taken en Planning.

## Technische keuzes

- Next.js App Router, React en TypeScript; clientinteracties bovenop een statisch renderbare pagina.
- Responsive CSS en Lucide-iconen, zonder externe fonts of runtime-netwerkafhankelijkheden.
- `app/data.ts`: types en oorspronkelijke demo-inhoud.
- `app/planning.ts`: datumfuncties, overlapcontrole, vrije tijdstippen en opslagvalidatie/migratie.
- `app/ui.tsx`: toegankelijk dialoogvenster/zijpaneel met focusbegrenzing, focusherstel en Escape.
- `app/page.tsx`: werkoverzicht, taak- en agendabeheer, concepten en lokale opslag.
- `app/globals.css`: vormgeving voor desktop en mobiel.
- `localStorage` (`plannerpal-demo-v1`) wordt na mount ingelezen. Bestaande taken en concepten uit het eerste prototype worden overgenomen; ontbrekende werkdagen worden aan de voorbeelddag gekoppeld. Onleesbare of ongeldige data valt terug op voorbeelden met een melding. Geblokkeerde opslag geeft een waarschuwing.
- Een taak heeft een werkdag en een onafhankelijke deadline. Plannen gebeurt op kwartiergrenzen met een exacte duur van 5–480 minuten. Afspraken en pauzes ondersteunen een starttijd op de minuut. Bewerken en plannen gebruiken dezelfde overlapregels.
- Afgeronde taken bezetten geen tijd. Heropenen zet een taak ongepland terug, zodat er geen conflict met nieuw werk ontstaat.
- De laatste mutatie kan als geheel ongedaan worden gemaakt. De undo-geschiedenis zelf wordt niet opgeslagen. Concepttekst wordt direct bewaard; typen of een mail openen sluit de vorige undo-actie af.

## Checks

```bash
npm run typecheck
npm run build
# Start eerst npm run start of npm run dev in een andere terminal:
npm run test:e2e
```

De Playwright-browsertest gebruikt `/usr/bin/chromium` indien aanwezig. Anders installeer je een browser met `npx playwright install chromium` of stel je `CHROMIUM_PATH` in op je eigen Chromium-installatie. `BASE_URL` kan een andere testserver aanwijzen. Screenshots staan na de test in `/tmp/plannerpal-v2-desktop.png` en `/tmp/plannerpal-v2-mobile.png`.

De browserroute controleert voorstellen, handmatige taken, bewerken, verwijderen, undo, meerdere dagen, deadlinebehoud, overlap bij aanmaken en wijzigen, afspraken/pauzes, capaciteitswaarschuwingen, concepten, persistentie, afronden, migratie, ongeldige opslag, reset en mobiel gebruik. Build en TypeScript worden afzonderlijk gecontroleerd.

## Beperkingen

- Voorbeelddata en een vaste begindag; de datum wordt niet automatisch naar vandaag gezet.
- Geen accounts, database, echte mail- of agendakoppeling, verzendfunctie of AI-aanroepen.
- Alleen werkdagen tussen 09:00 en 17:00. Geen drag-and-drop, herhalende afspraken, weekoverzicht of automatisch doorschuiven van onafgerond werk.
- Werkhoeveelheid is de som van geschatte minuten; energie, reistijd en inhoudelijke haalbaarheid worden niet beoordeeld. Vrije tijd kan versnipperd zijn: de tijdkeuze controleert of een taak aaneengesloten past.
- Opslag is per browser en origin; geen synchronisatie, back-up, encryptie of conflictregeling tussen tabbladen. Bij een andere deploy-URL zie je een aparte werkplek. Geen vertrouwelijke gegevens invoeren.
- Alleen gegevens worden bewaard: de actieve datum, filters, schermkeuze en undo-geschiedenis beginnen na herladen opnieuw.
