# Google/Microsoft aanmelden en verbinden

Gebruikers hoeven geen sleutels of databasegegevens in te vullen. Ze kiezen **Doorgaan met Google** of **Doorgaan met Microsoft**, melden zich aan en krijgen een eigen werkplek. Daarna kunnen ze **mail en agenda verbinden**. Lezen, verzenden en agendablokken maken zijn afzonderlijke toestemmingsstappen.

De eigenaar registreert de app eenmalig bij de providers. Vercel en Neon vervangen deze OAuth-appregistraties niet. Deze handleiding is voor de beheerder; de dagelijkse gebruikerspagina bevat geen technische installatievelden.

## Kostenbeleid

**Betaalde AI staat standaard uit.** Zelfs een al ingestelde PLANNERPAL_AI_KEY of OPENAI_API_KEY activeert geen betaalde aanroepen. De server vereist de expliciete opt-in `ENABLE_PAID_AI=true`; die staat niet standaard aan en kan niet door een gewone gebruiker worden gewijzigd.

De standaardroute gebruikt trefwoordregels, standaardantwoorden, getypte notities, taakbeheer en een vast dagoverzicht. Er zijn geen AI-aanroepen of transcriptiekosten. Audio-transcriptie staat daarom in deze route uit. Openstaande oude AI-concepten kunnen nog gelezen worden, maar veroorzaken geen nieuwe aanroepen.

Google/Microsoft-appregistraties en de gebruikte basis-API's hebben doorgaans geen aparte toegangskosten. Hosting, PostgreSQL, e-mailabonnementen van zakelijke gebruikers en verificatietrajecten hebben eigen voorwaarden. Gratis Vercel- en Neon-abonnementen hebben limieten en zijn niet automatisch geschikt voor commercieel gebruik of onbeperkte groei. Controleer de actuele voorwaarden en gebruiksgrenzen; deze code belooft geen gratis exploitatie op elke schaal. Zet geen betaalde abonnementen of automatische upgrades aan om een gratis test te starten.

## 1. Neon en Vercel

Verbind je Neon-database met Vercel en bewaar de pooled verbindings-URL als **DATABASE_URL** bij Production. Bewaar een unieke willekeurige **SESSION_SECRET** van minimaal 32 tekens (bij voorkeur 64). Gebruik een wachtwoordmanager of een cryptografische generator. Deel waarden nooit in chat of GitHub. Houd SESSION_SECRET stabiel: die beschermt de versleutelde provider-tokens.

| Serverinstelling                              | Nodig voor                           |
| --------------------------------------------- | ------------------------------------ |
| APP_URL                                       | `https://planner-pal.vercel.app`     |
| DATABASE_URL                                  | Neon/PostgreSQL                      |
| SESSION_SECRET                                | Sessies en tokenversleuteling        |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET       | Google-aanmelding en -toestemming    |
| MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET | Microsoft-aanmelding en -toestemming |
| ENABLE_PAID_AI                                | Laat weg of stel in op `false`       |

Eén provider kan actief zijn terwijl de andere nog niet geconfigureerd is. De niet-geconfigureerde knop is dan tijdelijk niet beschikbaar. ALLOWED_GOOGLE_EMAIL wordt niet meer gebruikt. Er is geen eigenaar-mailadres nodig in de runtime-instellingen. Geef servervariabelen geen NEXT_PUBLIC_-prefix.

Na wijziging van Vercel-variabelen is een nieuwe **Production Redeploy** nodig. Instellingen in de Codex-cloudomgeving worden niet automatisch naar Vercel gekopieerd.

## 2. Google registreren

1. Maak/open een project in Google Cloud Console en activeer Gmail API en Google Calendar API.
2. Configureer de OAuth-consentpagina met appnaam, contactadres en privacy-URL `https://planner-pal.vercel.app/privacy`.
3. Maak een OAuth-client van het type **Web application**. De iPhone-webapp gebruikt dezelfde webclient.
4. Voeg onder **Authorized redirect URIs** exact toe:

   ```text
   https://planner-pal.vercel.app/api/auth/callback
   ```

5. Bewaar de client-ID en het client-secret in Vercel. Begin voor een besloten test met de toegestane testgebruikers in Google Auth Platform.

**Aanmelden** vraagt alleen openid, email en profile. **Verbinden** voegt gmail.readonly en calendar.events.readonly toe. **Verzenden activeren** vraagt gmail.send; **Plannen activeren** vraagt calendar.events.owned. De server controleert de werkelijk toegekende scopes en bindt de koppeling aan de aangemelde gebruiker.

Voor publieke toegang tot Gmail kan Google verificatie en mogelijk aanvullende beveiligingsbeoordeling eisen. Een codepush heft Google Testing-beperkingen niet op. In Testing kunnen refresh-tokens na zeven dagen verlopen. Dan moet de gebruiker opnieuw verbinden.

## 3. Microsoft registreren

1. Open Microsoft Entra admin center → App registrations → New registration.
2. Kies ondersteunde accounttypen voor **accounts in any organizational directory AND personal Microsoft accounts**. De app gebruikt de `common`-autoriteit zodat Outlook.com/Hotmail en zakelijke Microsoft 365-accounts kunnen aanmelden.
3. Voeg bij het platform **Web** exact deze redirect URI toe:

   ```text
   https://planner-pal.vercel.app/api/auth/callback/microsoft
   ```

4. Bewaar Application (client) ID als MICROSOFT_CLIENT_ID. Maak een client-secret en bewaar de **secret value**, niet het secret-ID, als MICROSOFT_CLIENT_SECRET. Noteer de vervaldatum en vervang het secret voordat het verloopt.
5. Configureer de gedelegeerde Microsoft Graph-rechten: User.Read, Mail.Read, Calendars.Read, Mail.Send en Calendars.ReadWrite. De app vraagt ze stapsgewijs en niet allemaal bij aanmelden. Geen application permissions instellen en geen algemene adminrechten toevoegen.

Aanmelden vraagt openid, email en profile. Verbinden voegt offline_access, User.Read, Mail.Read en Calendars.Read toe. Verzenden vraagt Mail.Send; afspraken maken vraagt Calendars.ReadWrite. Zakelijke organisaties kunnen een administratorbesluit vereisen. De app kan hun beleid niet omzeilen. Een account moet daadwerkelijk een ondersteunde Outlook/Exchange-mailbox hebben om mail/agenda te kunnen verbinden.

## 4. Database-upgrade en deployment

**Vercel Production-builds voeren automatisch `npm run prebuild` uit.** Als DATABASE_URL aanwezig is, worden de SQL-migraties vóór `next build` toegepast. `schema_migrations` bewaart bestandsnamen en checksums; een transactionele advisory lock voorkomt gelijktijdige upgrades. Bij een migratiefout stopt de build met een melding zonder verbindingsgegevens.

- `db/001-assistant.sql`: oorspronkelijke tabellen voor gebruikers, sessies, mail, taken, concepten, notities en log.
- `db/002-multiple-providers.sql`: provider-identiteiten en verbindingen, legacy Google-migratie en extra kalender-/bronvelden.
- Bestaande Google-gebruikers houden hun ID, taken, sessies en versleutelde verbinding. De versleutelde tokens worden naar de verbindingstabel gekopieerd. Het oude veld blijft tijdens de uitrol staan zodat de vorige deployment verzoeken kan afmaken. Nieuwe code leest alleen de verbindingstabel; opnieuw verbinden of loskoppelen ruimt de legacy-kopie op.
- Lokale en Preview-builds voeren geen automatische databasewijzigingen uit. Met een veilig ingestelde DATABASE_URL kun je bewust `npm run db:migrate` uitvoeren.
- Wijzig geen reeds toegepaste migraties. Voeg voor verdere schemawijzigingen een nieuw genummerd SQL-bestand toe.

De productie-DB heeft nu ook `auth_identities`, `connections` en `schema_migrations`. Er is geen gebruikersdata-reset nodig voor deze upgrade. Er is geen automatische downgrade naar de oude single-user-code; die verwacht tokens op de oude plek. Gebruik bij herstel een gecontroleerde roll-forward of een vooraf gemaakte databaseback-up.

## 5. Gebruikersroute testen

1. Open `/assistant`. Kies Google of Microsoft en meld je aan. Er worden nog geen mail- of agendarechten gevraagd.
2. Controleer dat je eigen taken kunt toevoegen zonder een mailbox te verbinden.
3. Kies een provider onder **Verbind je mail en agenda** en geef leesrechten. De twintig nieuwste inboxmails en primaire/default agenda worden opgehaald.
4. Open een mail → **Regelvoorstel maken**. Controleer de voorgestelde taak en het standaardantwoord. Niets wordt automatisch uitgevoerd.
5. Activeer **Verzenden** of **Plannen** wanneer je die functie wilt gebruiken. Het officiële provider-scherm vraagt de extra machtiging. Het account moet hetzelfde zijn als de bestaande mailboxkoppeling.
6. Bewerk een concept, sla de wijziging op en bevestig daarna de exacte ontvanger/tekst. Dit is een echte verzendactie. Microsoft accepteert een verzending met HTTP 202; dat is geen garantie op uiteindelijke bezorging.
7. Plan een taak in. De server controleert de actuele agenda opnieuw. Microsoft gebruikt transactionId voor idempotente creatie; de echte ontvangen event-ID wordt bewaard. Google gebruikt een deterministische event-ID.
8. Meld je met een ander account in een aparte browser aan. Controleer dat de gegevens gescheiden blijven.
9. Kies bij Instellingen **Mail en agenda loskoppelen**. Je blijft aangemeld, taken/notities blijven bestaan, cache/concepten en externe koppelingen worden verwijderd. Verstuurde mails en afspraken blijven bij je provider staan.

Accounts worden gekoppeld op provider + geverifieerd subject, nooit automatisch op e-mailadres. Google en Microsoft met hetzelfde e-mailadres krijgen dus niet stilzwijgend één gezamenlijke werkplek. Gebruik voor terugkeer dezelfde inlogprovider. Een gebruiker kan één mailbox tegelijk verbinden; voor een ander account moet de huidige verbinding eerst expliciet losgekoppeld worden.

## Veiligheid en grenzen

OAuth gebruikt PKCE, state, nonce en gecontroleerde redirect-URI's. ID-tokens worden cryptografisch gecontroleerd op handtekening, issuer, audience en nonce. Provider-tokens blijven versleuteld op de server; sessies zijn gehashte, zeven dagen geldige cookies. Wachtwoorden en tokens worden nooit in de browser of localStorage gezet.

Elke dataquery blijft op de ingelogde gebruiker begrensd. Onduidelijke verzend-/agenda-antwoorden worden niet blind herhaald. Gebruik de statuscontrole en kijk bij je provider. Microsoft ondersteunt hier geen programmafunctie om individueel alle OAuth-toestemming in te trekken: na lokaal loskoppelen verwijst de app naar je accountinstellingen voor volledige intrekking. Dat geldt ook wanneer een Google-intrekking mislukt.

De huidige versie ondersteunt een mailbox per gebruiker, een primaire/default agenda, maximaal twintig inboxmails en de bestaande begrensde taken-/notitieoverzichten. Agenda verversen toont externe wijzigingen; statuscontrole zet de gekoppelde taak gelijk. Google/Microsoft-toestemmingen moeten na configuratie echt met jouw accounts getest worden. Mocktests bewijzen geen werkende appregistratie of akkoord van een bedrijfsbeheerder.

## iPhone

Open in Safari → Deel → Zet op beginscherm. De app heeft internet nodig en bewaart geen privégegevens in een offline-cache. Polling werkt bij zichtbare app en bij terugkeer, niet gegarandeerd als iOS de app sluit. Geen automatische call-opname of achtergrondmicrofoon. In de kostenloze standaardroute werk je met getypte notities; audio-transcriptie is een optionele betaalde uitbreiding die uit staat.
