# Gmail en Google Agenda aansluiten

De productie-URL is **https://planner-pal.vercel.app**. De echte assistent staat op **/assistant**; **/** blijft de losstaande demo. De code maakt geen accounts bij leveranciers en activeert geen betaald abonnement. Onderstaande stappen gebeuren in jouw eigen Google-, Vercel-, database- en OpenAI-account. Deel geen sleutels in chat of GitHub.

## 1. PostgreSQL toevoegen in Vercel

1. Open in Vercel het project **planner-pal** en voeg via Marketplace/Storage een PostgreSQL-database toe, bijvoorbeeld Neon. Kies een passende regio en controleer zelf de voorwaarden en kosten.
2. Zorg dat de verbindings-URL als **DATABASE_URL** beschikbaar is voor de Production-omgeving. Deze waarde bevat een wachtwoord en blijft server-only. De code controleert TLS-certificaten bij verbinding met een externe database.
3. Open de SQL-editor van je databaseprovider. Kopieer de inhoud van [db/001-assistant.sql](../db/001-assistant.sql) en voer die uit. Dit schema kan opnieuw worden uitgevoerd zonder bestaande tabellen te wissen.
4. Alternatief met een eigen terminal en veilig ingestelde DATABASE_URL: `npm run db:migrate`.

Gebruik een database die alleen door deze applicatieserver wordt benaderd. Publiceer geen database-inloggegevens of algemene database-API in de browser. De app begrenst elke gegevensoperatie op het ingelogde account. Google-tokens zijn daarnaast versleuteld; overige gegevens krijgen de opslagbescherming van je databaseprovider. De code is nog geen onafhankelijke beveiligingsaudit.

## 2. Google-project en OAuth-client maken

1. Maak/open een project in [Google Cloud Console](https://console.cloud.google.com/).
2. Activeer **Gmail API** en **Google Calendar API** bij APIs & Services.
3. Configureer Google Auth Platform/OAuth consent: appnaam PlannerPal, jouw contactadres en privacy-URL `https://planner-pal.vercel.app/privacy`.
4. Begin voor persoonlijk gebruik met de status **Testing** en voeg jouw Gmail-adres als testgebruiker toe. Gebruik hetzelfde adres bij ALLOWED_GOOGLE_EMAIL.
5. Maak een OAuth-client van het type **Web application**. Ook op iPhone gebruiken we deze webclient, geen native iOS-client.
6. Stel de authorized redirect URI exact in op:

   ```text
   https://planner-pal.vercel.app/api/auth/callback
   ```

   Bij een veld voor JavaScript origins kun je `https://planner-pal.vercel.app` toevoegen. De code gebruikt de OAuth-codeflow op de server, met PKCE en een gecontroleerde state-cookie.

7. Bewaar de Client ID en Client Secret in Vercel als GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET.

De app vraagt openid, email, profile, gmail.readonly, gmail.send, calendar.events.readonly en calendar.events.owned. De Calendar-write-scope wordt uitsluitend gebruikt voor je primaire agenda. Er worden geen rechten gevraagd voor contacten, Drive of het verwijderen van mails.

Google kan bij deze Gmail-rechten een niet-geverifieerde-appmelding tonen. Voeg voor eigen tests alleen jezelf als testgebruiker toe. OAuth-toegang in Testing kan na zeven dagen verlopen; dan moet je opnieuw verbinden. Voor publieke distributie kunnen Google-verificatie en aanvullende controles voor restricted Gmail-scopes nodig zijn. Dat is niet met een codepush geregeld. Workspace-beheerders kunnen deze rechten apart blokkeren.

## 3. Serverinstellingen in Vercel zetten

Open Project → Settings → Environment Variables. Voeg voor Production toe:

| Naam                 | Waarde                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| APP_URL              | `https://planner-pal.vercel.app`                                       |
| DATABASE_URL         | De beveiligde PostgreSQL-verbindings-URL                               |
| GOOGLE_CLIENT_ID     | Je Google Web OAuth Client ID                                          |
| GOOGLE_CLIENT_SECRET | De bijbehorende Client Secret                                          |
| ALLOWED_GOOGLE_EMAIL | Je eigen Gmail-adres; alleen dit account mag inloggen                  |
| SESSION_SECRET       | Een unieke willekeurige waarde van minimaal 32 tekens, bij voorkeur 64 |
| PLANNERPAL_AI_KEY    | Een eigen OpenAI API-sleutel, nodig voor AI en transcriptie            |
| AI_MODEL             | Optioneel; standaard `gpt-4.1-mini`                                    |

Genereer SESSION_SECRET met een wachtwoordmanager, of op je eigen computer met `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Bewaar deze waarde veilig en houd hem stabiel: wijzigen maakt opgeslagen Google-tokens onleesbaar. Herstel dan de vorige waarde of trek Google-toegang in en verbind opnieuw.

De OpenAI API wordt apart afgerekend van een ChatGPT-abonnement. Stel eerst een passend budget en gebruikswaarschuwingen in bij OpenAI. De app begrenst AI/transcriptie tot twintig gestarte verzoeken per uur voor het ingelogde account. AI draait op jouw klik; er is geen automatische AI-verwerking van de hele inbox. OPENAI_API_KEY wordt als alternatief ondersteund, maar PLANNERPAL_AI_KEY vermijdt conflicten met gereserveerde platformnamen.

Geef deze variabelen **geen NEXT_PUBLIC\_-prefix**. Plak de waarden niet in broncode of screenshots. Op Vercel voer je de echte waarden in; eventuele instellingen in de Codex-cloudomgeving worden niet automatisch naar Vercel gekopieerd.

Klik na wijzigingen op **Redeploy** voor de productieomgeving. Een codepush past deze instellingen niet vanzelf aan. Voor preview-URL's moet je een eigen APP_URL en overeenkomstige Google-redirect instellen; de vaste productie-URL is voor de eerste aansluiting eenvoudiger.

## 4. Verbinden en de echte route testen

1. Open `https://planner-pal.vercel.app/assistant` in Safari. Er mag geen melding meer staan dat de verbinding nog moet worden ingesteld.
2. Tik op **Verbinden met Google**, kies jouw toegestane Gmail-account en geef de gevraagde rechten. Als je een recht uitvinkt, maakt de app de koppeling niet af.
3. Controleer of je twintig nieuwste inboxmails (of minder bij een kleine inbox) en afspraken uit je primaire agenda verschijnen.
4. Open één niet-vertrouwelijke testmail en kies **Mail analyseren**. Controleer samenvatting, taakvoorstellen en concept. AI kan fouten maken; hij voert geen opdrachten uit die in de mail staan.
5. Bewaar een voorgestelde taak. Plan hem in: de server haalt je agenda opnieuw op en weigert overlap of een eindtijd na 17:00. Alle tijden zijn Europe/Amsterdam, inclusief zomer-/wintertijd.
6. Open **Antwoorden**. Bewerk het concept en bewaar de wijzigingen. Controleer de ontvanger en klik vervolgens op **Verzenden controleren** en **Ja, verstuur dit antwoord**. Test dit eerst met een mail tussen eigen adressen.
7. Controleer het resultaat in Gmail → Verzonden en Google Agenda. Deze test moet je na configuratie echt uitvoeren; gemockte tests bewijzen geen werkende Google-toestemming.
8. Herlaad en log op een tweede browser in: taken, notities en concepten horen bij hetzelfde Google-account. Je kunt op meerdere apparaten tegelijk ingelogd blijven. Sessies verlopen na zeven dagen.
9. Bij **Gespreksnotities** kun je typen, maximaal negentig seconden zelf opnemen of een eigen audiobestand van maximaal 4 MB toevoegen. Kies eerst Uitschrijven, controleer de tekst en kies daarna Acties voorstellen. Accepteer de taken afzonderlijk.
10. Probeer Maak dagoverzicht, Afspraak voorbereiden en Waar wacht ik op? Deze functies werken op een beperkte selectie; een wachtende mail is niet automatisch een verplichting om te antwoorden.

## 5. Op het iPhone-beginscherm

Open /assistant in Safari → Deel → Zet op beginscherm. Log indien nodig opnieuw in vanuit de geïnstalleerde app. De app heeft een manifest, eigen iconen en standalone-weergave. Er is bewust geen offline-cache voor privégegevens. Opnames stoppen bij het verlaten van de app.

iOS biedt een webapp geen algemene toegang tot telefoongesprekken of continue achtergrondverwerking. PlannerPal luistert niet naar calls. Voor echte call-integratie is later een apart ondersteund telefonie-/opnameproduct nodig, met de juiste toestemming. Deze versie verwerkt alleen jouw expliciet aangeleverde audio/notities.

## Wat gebeurt automatisch?

- Bij openen en iedere vijf minuten zolang de app zichtbaar is: de nieuwste inboxmails ophalen. Bij terugkeer naar de app wordt opnieuw opgehaald als de vorige synchronisatie ouder dan een minuut is.
- Bij een andere werkdag kiezen: die dag uit je primaire agenda ophalen.
- Bij gewijzigde teksten: geen automatische verzending. AI, verzenden en agendawijzigingen blijven afzonderlijke opdrachten.

Er zijn nog geen Gmail-pushwebhooks, cronjobs, iPhone-pushmeldingen of gegarandeerde achtergrondupdates. De app geeft geen altijd-aan-assistent voor als de telefoon vergrendeld is. Dat vraagt aanvullende infrastructuur en apparaatvalidatie.

## Fouten en herstel

- **Verbinding moet nog ingesteld worden:** controleer de vijf verplichte instellingen, voldoende lengte van SESSION_SECRET, databasebereikbaarheid en het uitgevoerde schema.
- **Google verbinden mislukt:** controleer de exacte redirect URI, je testgebruiker, het toegestane e-mailadres, geactiveerde APIs en alle gevraagde rechten.
- **Google-toegang verlopen:** log uit in Instellingen en verbind opnieuw. Controleer ook de OAuth-teststatus.
- **Onzekere verzendstatus:** open Gmail → Verzonden en gebruik Verzendstatus controleren. Er wordt nooit blind opnieuw verstuurd. Het unieke Message-ID helpt een eerder verstuurd antwoord terugvinden. Als er geen bevestiging is, blijft de status onzeker.
- **Onzekere agendastatus:** controleer Google Agenda en gebruik Agendastatus controleren. Een unieke event-ID voorkomt dat dezelfde poging een tweede blok invoegt.
- **Blok handmatig in Google gewijzigd/verwijderd:** gebruik de statuscontrole om de taak weer met Google gelijk te trekken. De agenda zelf wordt bij vernieuwen live opgehaald. Automatisch terugschrijven van alle handmatige wijzigingen naar taakvelden is nog beperkt.
- **Te grote opname:** maak een kortere notitie. De limiet van 4 MB blijft onder de limiet van een gebruikelijke Vercel Function-request.

## Gegevens verwijderen

Instellingen → Toegang intrekken & gegevens verwijderen verwijdert de accountgegevens uit PlannerPal en probeert de Google-koppeling in te trekken. Mails en afspraken in Google blijven behouden. Bij een mislukte intrekking toont de app een link naar Google Account → Verbindingen. Back-ups en bewaartermijnen van database- en AI-providers moet de beheerder zelf instellen; de app beweert niet dat het verwijderen alle leveranciersback-ups onmiddellijk wist.
