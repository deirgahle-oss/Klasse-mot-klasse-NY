# Klasse mot klasse

Konkurranse med elevvisning (`/`), arrangørpanel (`/admin.html`) og storskjerm (`/storskjerm.html?game=…`). Appen bruker Netlify Database til konkurranser, deltakere og svar, Netlify Blobs til opplastede bilder og MP3-filer. Ingen Supabase-konto eller eksterne API-nøkler er nødvendig.

## Før første konkurranse

Åpne `/admin.html` direkte for å administrere konkurransene. Det kreves ingen konto, invitasjon eller passord. Alle tidligere konkurranser er tilgjengelige i den felles oversikten. Databasen og eksisterende migrasjoner er beholdt.

Arrangørsiden og API-et er åpne: alle som besøker dem, kan se, endre og slette konkurranser, se deltakere og laste opp filer. Elevvisningen skjuler fortsatt fasit frem til den vises, men innholdet kan hentes via den åpne arrangørvisningen.

## Gjennomføring

1. Åpne arrangørpanelet, velg klasser og opprett en konkurranse. Nye klasser kan legges til før opprettelsen.
2. Legg til oppgaver. Utkastet lagres automatisk; «Legg til oppgave» eller «Lagre endringer» fører det inn i kjøreplanen. Endre rekkefølge og oppgaver før start. Tid oppgis som min:sek; steg oppgis i sekunder.
3. Åpne storskjermen fra arrangørpanelet. Del elevlenken eller QR-koden. Musikk krever ett trykk på «Aktiver lyd» på storskjermen på grunn av nettlesernes regler for automatisk avspilling.
4. Velg eventuelt «Klar til start», og deretter «Start». Svar lagres mens eleven flytter slideren. «Lås svar» bekrefter elevens eget svar. Siste serverlagrede sliderverdi gjelder også uten dette trykket.
5. Trykk «Lås svar – 5 sekunder igjen». Sluttidspunktet lagres én gang og følger databasens klokke. Oppdatering starter ikke nedtellingen på nytt. «Åpne svar» gir mer tid før fasit er vist.
6. Registrer fasit etter fristen. Forhåndslagret fasit er skjult for elevene frem til dette. Vis eventuelt topp 3 og gå til neste oppgave. Alle gjennomførte oppgaver må ha fasit før konkurransen fullføres.
7. «Restart konkurranse» nullstiller svar og poeng, men beholder elever og oppgaver. «Ny gjennomføring» fjerner også deltakerne. «Åpne» fra oversikten starter en ny gjennomføring etter en bekreftelse; «Fortsett» gjenopptar uten nullstilling. Vanlig oppdatering av siden gjenopptar alltid.

Delingslenken lager en selvstendig kopi av spørsmål og klasser uten deltakere eller resultater.

## Poeng

Poeng per oppgave er `100 × maks(0, 1 − |svar − fasit| / |fasit|)`, avrundet til to desimaler. Når fasit er null, brukes maksimum minus minimum som divisor. Individuell rangering bruker snittet for gjennomførte, fasitregistrerte oppgaver som eleven kunne delta i. Egen klasses oppgaver og oppgaver avsluttet før elevens registrering teller ikke. Ubesvarte oppgaver etter registrering gir null. Klassens score er snittet av alle dens registrerte elevers gjennomsnittspoeng. Elever uten tellende oppgaver står med null.

## Drift og grenser

Visningene henter endringer omtrent hvert 1,5 sekund og gjenopptar etter nettverksbrudd. Selve nedtellingen vises lokalt mot et estimat av serverklokken, men serveren bestemmer alltid om et svar er innen fristen. Dette er løpende oppdatering med polling, ikke WebSocket-distribusjon. En elevs siste lokale endring kan ikke garanteres lagret under nettverksbrudd; elevvisningen viser lagringsstatus og prøver igjen.

Svar fra forskjellige elever kan lagres samtidig. Delte radlåser hindrer at arrangøren endrer oppgaven mens et svar godkjennes. Sekvensnummer beskytter mot at forsinkede forespørsler overskriver nyere svar, og låste elevsvar kan ikke overskrives. Alle styringshandlinger og kontroll av gyldige svar skjer på serveren.

Konkurransen tillater maksimalt 200 registrerte deltakere. Dette er en applikasjonsgrense, ikke dokumentasjon på kapasitet: full belastning med 200 samtidige telefoner er ikke testet. Gjør en generalprøve på skolens nettverk før arrangementet. Polling og opplastinger bruker Netlify-kvoter, så gratis drift kan ikke garanteres. Filer er begrenset til 4 MB per opplasting.

Deltakeridentitet lagres i den aktuelle nettleseren. Ved sletting av nettleserdata eller bytte av telefon må eleven registreres på nytt. Arrangørpanelet kan slette duplikater.

## Utvikling og kontroll

Installer pakker med `npm ci`. Start lokal utvikling med `netlify dev --port 8889`. `npm run check` kontrollerer servertypene og `npm test` tester poengregler og nedtelling. Med lokalserveren i gang kan `npx playwright test` kjøres etter installasjon av Chromium med `npx playwright install chromium`.

Nettlesertestene bruker kontrollerte API-svar og dekker elevregistrering, oppdatering, sliderlagring, låsing, nedtelling, klassefritak, QR-kode og tidsregistrering. De erstatter ikke integrasjonstest av Database og Blobs på en deploy. Databasen endres gjennom genererte migrasjoner ved deploy.

`npm run test:integration` kjører den virkelige serverfunksjonen mot konfigurert testdatabase og kontrollerer at konkurranseoversikten og status for lagrede konkurranser kan hentes. Testen bruker ingen simulerte databasesvar. Med en testdatabase som har skrivetilgang kan `npm run test:integration -- --write` også kontrollere opprettelse, oppgaver, elevregistrering og svarlagring. Den ekstra testen sletter sin egen testkonkurranse etterpå.
