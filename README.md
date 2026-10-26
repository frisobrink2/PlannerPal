# PlannerPal

Een werkend Nederlandstalig prototype voor zelfstandige professionals: van mail naar taak, van taak naar een haalbare dag. Alle personen en berichten zijn fictieve voorbeelden. Er worden geen mails verstuurd en er vinden geen AI-aanroepen plaats.

## Starten

Node.js 20.9 of nieuwer en npm zijn nodig. Gevalideerd met Node.js 24.

```bash
cd /workspace/PlannerPal
npm ci --cache /tmp/plannerpal-npm
npm run dev
```

De webserver gebruikt poort 3000. Voor een productieversie:

```bash
npm run build
npm run start
```

Er zijn geen omgevingsvariabelen, accounts, API-sleutels of aanvullende diensten nodig. De schrijfbare npm-cache in `/tmp` voorkomt een probleem met de standaardcache in deze cloudomgeving.

## Probeer de gebruikersroute

1. Open in **Inbox** de mail van Mark Jansen over de websiteofferte.
2. Kies **Voorstel bekijken & aanpassen**. Pas titel, prioriteit, deadline en/of duur aan en accepteer de taak.
3. Open de taak en kies **Inplannen**. Selecteer een vrij moment. Alleen tijden tussen 09:00 en 17:00 zonder overlap met afspraken, pauzes of andere taken worden aangeboden.
4. Bekijk de taak in **Dagplanning**. Met het kruisje kun je hem weer uit de planning halen.
5. Bewerk in **Antwoordconcepten** het antwoord aan Mark en keur het goed. Bewerken na goedkeuring zet de status terug naar concept. Goedkeuren verstuurt niets.
6. Herlaad de pagina: taken, ingeplande tijden, concepten, goedkeuringen en gelezen mails blijven bewaard.
7. Vink in **Taken** de taak af. Afgeronde taken geven hun tijd in de planning weer vrij. Je kunt ze heropenen en opnieuw inplannen.
8. Gebruik **Voorbeelddata herstellen** in de zijbalk of onderaan de pagina. Bevestig de reset om de oorspronkelijke gegevens terug te zetten.

De inbox bevat 12 mails, met zoeken en filters. Er zijn aanvankelijk drie geaccepteerde taken, vier concepten, twee afspraken en een lunchpauze. Voor elke mail is een taakvoorstel en antwoord voorbereid. Een extra concept verschijnt bij het accepteren van een voorstel of via **Bekijk antwoordconcept** in een mail.

## Technische keuzes

- Next.js App Router, React en TypeScript; statisch renderbare pagina met interactieve clientcomponenten.
- Gewone responsive CSS en Lucide-iconen; geen externe fonts of andere runtime-netwerkafhankelijkheden.
- `app/data.ts`: getypeerde voorbeeldmails, beginstatus en vaste afspraken.
- `app/page.tsx`: schermen, taakacceptatie, planning, concepten en opslag.
- `app/globals.css`: desktop- en mobiele vormgeving.
- Eén versiegebonden `localStorage`-record (`plannerpal-demo-v1`), pas ingelezen na mount om hydrationproblemen te vermijden. Bij onleesbare data wordt teruggevallen op voorbeelddata; geblokkeerde opslag geeft een melding.
- Plannen op kwartiergrenzen, met exacte taakduur en controle op tijdsoverlap. Een taak kan eenmaal ingepland staan; haal hem eerst uit de planning om hem te verplaatsen.
- Dialogen ondersteunen Escape, een focusbegrenzing en focusherstel. Formulieren hebben labels en relevante browservalidatie; meldingen zijn toegankelijk aangekondigd.

## Checks

```bash
npm run typecheck
npm run build
# Start eerst npm run start of npm run dev in een andere terminal:
npm run test:e2e
```

De browsertest gebruikt Playwright met de aanwezige `/usr/bin/chromium`. Op een andere machine: installeer Chromium met `npx playwright install chromium`, of stel `CHROMIUM_PATH` in op een eigen Chromium-installatie. Downloaden kan netwerktoegang tot de Playwright-CDN vereisen. `BASE_URL` kan een andere testserver aanwijzen. De browser draait headless; screenshots worden in `/tmp/plannerpal-desktop.png` en `/tmp/plannerpal-mobile.png` opgeslagen.

Gecontroleerd: 12 mails, aangepast voorstel accepteren, dubbele/overlappende tijdstippen uitsluiten, inplannen, concept bewerken en goedkeuren, status terugzetten na bewerken, persistentie na herladen, taak afronden, reset, mobiele breedte en browserfouten. Build, TypeScript en de browserroute zijn geslaagd.

## Beperkingen

- De dag is bewust vastgezet op **maandag 26 oktober 2026**, zodat planning en deadlines reproduceerbaar blijven. Geen agenda voor meerdere dagen.
- Voorstellen en concepten zijn vooraf geschreven, zonder analyse van echte mails.
- Opslag is per browser en origin; geen synchronisatie, encryptie, back-up of conflictregeling tussen tabbladen. Privémodus of het wissen van browserdata kan de wijzigingen verwijderen. Gebruik geen vertrouwelijke gegevens.
- Afspraken en pauzes zijn vaste demoblokken. Er is geen drag-and-drop, terugkerende planning of echte agenda-integratie.
- De planningssuggesties toetsen tijdcapaciteit, niet energie, reistijd of inhoudelijke haalbaarheid. Er wordt niets automatisch ingepland.
- Geen accounts, externe database, mailkoppeling, verzendfunctie of betaalde AI.
