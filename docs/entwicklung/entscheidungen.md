# Architektur-Entscheidungen

Kurze Begründungen für die bewussten Abweichungen und Festlegungen. Neue
Entscheidungen unten anhängen (Datum + Kontext + Entscheidung + Begründung).

---

## Keine eigene Datenbank
**Entscheidung:** Die App hält keine eigene DB. ChurchTools ist die einzige
Datenquelle; das Backend ist ein reiner Proxy.
**Begründung:** Doppelte Datenhaltung (Lieder, Setlisten, Tonarten) wäre fehleranfällig
und müsste synchron gehalten werden. ChurchTools ist ohnehin das führende System der
Gemeinde. **App-eigene Daten** (Anmerkungen, Lied-Einstellungen, Rechte-/„gesehen"-Caches,
Teilen-Status) liegen **pro Konto als JSON-Dateien auf einem Docker-Volume** (Env-Pfade
`ANNOTATIONS_PATH`, `SEEN_SETLISTS_PATH`, `CAPABILITIES_CACHE_PATH`, `SITE_CONFIG_PATH`);
`localStorage` ist nur Client-Cache.
**Folge:** Kein ORM, keine Migrationen, keine Test-DB – aber Persistenz übers Volume statt
klassischer Datenbank. Die Blueprint-Punkte rund um Datenbanken entfallen für dieses Projekt.

## Auth über ChurchTools-Session
**Entscheidung:** Login mit persönlichem ChurchTools-Konto; das Backend hält die
Session und gibt dem Client ein signiertes httpOnly-Cookie.
**Begründung:** Keine zweite Nutzerverwaltung. Rechte (wer darf Ablauf bearbeiten,
wer sieht nur das Liederbuch) kommen direkt aus ChurchTools (`/api/capabilities`).

## Reverse Proxy statt Cloudflare
**Entscheidung:** Externer Zugang über Synology Reverse Proxy + DDNS + Let's Encrypt,
**kein** Cloudflare Tunnel (anders als im Blueprint vorgeschlagen).
**Begründung:** Das NAS bringt Reverse Proxy und Zertifikatsverwaltung mit; der
Router leitet nur 443/80 weiter. Eine zusätzliche Cloudflare-Abhängigkeit ist
nicht nötig. DSM-Ports (5000/5001) bleiben geschlossen.

## ChordPro-Bearbeitung als separate App-Version
**Entscheidung:** Der Editor speichert Änderungen als eigene Datei
`"<Titel> — <Name> (App).chordpro"` (Marker `(App)`; Alt-Bestand `(ECG)` bleibt
abwärtskompatibel erkannt), das Original-Arrangement bleibt unangetastet.
**Begründung:** Kein Risiko, von SongSelect bezogene Originale zu überschreiben;
jederzeit auf das Original zurückführbar.

## Branding: erst White-Label, dann feste ChurchTools-Version *(geändert 19.06.2026)*
**Ursprünglich (verworfen):** Pro-Gemeinde-Branding (Name/Logo/Farben/CCLI) zur Laufzeit aus
`site.json` auf einem Docker-Volume – ein gemeinsames Image für alle, Branding kommt zur Laufzeit.
**Geändert zu:** eine **feste ChurchTools-Version** mit einheitlicher Optik und eigenem Logo für alle
Instanzen. **Begründung:** ein gepflegtes, einheitliches Erscheinungsbild statt Wildwuchs; deutlich
weniger Konfigurationsfläche und Fehlerquellen. **Geblieben ist nur** der anpassbare **Gemeindename**
(`orgName`) in `site.json` (Volume, `SITE_CONFIG_PATH`) – treu zur „keine DB"-Linie. Details:
`CLAUDE.md` (Abschnitt „Design & Branding") + `design-system.md`.

## Admin-Schutz über ChurchTools-Recht
**Entscheidung:** Nur ChurchTools-Administratoren dürfen den Gemeindenamen ändern. Das maßgebliche
Recht ist konfigurierbar (`ADMIN_PERMISSION`, Default `churchcore:administer persons`).
**Begründung:** Keine zweite Passwortverwaltung; konsistent zur restlichen rechtebewussten UI.
**Hinweis:** Das exakte Admin-Recht variiert je CT-Instanz und sollte vor dem Ausrollen an eine
fremde Gemeinde an deren Instanz verifiziert werden.

## Verteilung: öffentliches GHCR-Image, MIT-Lizenz *(geändert 22.06.2026)*
**Ursprünglich geplant (verworfen):** privates GHCR-Image, Nutzung nur auf Anfrage, proprietäre Lizenz.
**Aktuelle Entscheidung:** Das Repo ist **öffentlich**, die Software steht unter der **MIT-Lizenz**
(`LICENSE`), die Docker-Images sind **anonym aus GHCR ziehbar**. Jede Gemeinde hostet ihre eigene
Instanz selbst (Anleitung `INSTALL.md` + `UPDATE.md`).
**Begründung:** niedrigschwellige Weitergabe an andere Gemeinden ohne Token-/Freigabe-Aufwand; es liegen
keine Secrets im Image (Env nur zur Laufzeit). Jede Gemeinde ist für DSGVO + eigenen Zugang verantwortlich.

## Schrift/Spalten gesperrt bei vorhandenen Anmerkungen
**Entscheidung:** Solange Anmerkungen existieren, sind Schriftgröße/Spaltenzahl gesperrt.
**Begründung:** Anmerkungen sind pixelbasiert (Canvas). Würde der Text neu umbrechen,
lägen die Anmerkungen falsch. Sperre verhindert das Verrutschen.

## `trust proxy: 'loopback'` statt `1` *(26.07.2026, #214)*
**Entscheidung:** In Produktion gilt `app.set('trust proxy', 'loopback')`.
**Begründung:** Von dieser Einstellung hängt die gesamte IP-Härtung ab – vor allem das Login-Limit
(`routes/auth.ts`), das mangels Session **nur** die IP hat. Mit der festen `1` vertraut Express genau
einem Hop; steht noch eine lokale Zwischenstation dazwischen, ist `req.ip` immer `127.0.0.1` und
**alle** Anfragen teilen einen Rate-Limit-Schlüssel – eine von außen auslösbare Login-Sperre für die
ganze Gemeinde. `'loopback'` überspringt von rechts **alle** lokalen Hops und liefert den rechtesten
echten Client-Eintrag; das ist bei einer **und** bei zwei lokalen Stationen korrekt.
**Verifiziert:** `server/src/trustProxy.test.ts` startet einen echten Express-Server und prüft beide
Fälle – inklusive Gegenprobe, dass die alte `1` im Zwei-Hop-Fall tatsächlich auf `127.0.0.1` kippt.
Damit hängt die Annahme nicht mehr an der (von hier nicht einsehbaren) Proxy-Kette des NAS.
**Nicht abgedeckt:** Würde die App je **ohne** Reverse-Proxy direkt ins Netz gehängt (der Kommentar in
`deploy/docker-compose.prod.yml` lädt zum Umstellen auf `3001:3001` ein), wäre `X-Forwarded-For` frei
wählbar und das IP-Limit umgehbar. Prod bindet deshalb bewusst nur `127.0.0.1`.

## Server läuft per `tsx` aus dem Quelltext, ohne Build-Artefakt *(27.07.2026, #199)*
`server/package.json` fährt `"build": "tsc --noEmit"` und `"start": "tsx src/index.ts"` – in
Produktion wird also bei jedem Start transpiliert, und `tsx` (eine devDependency) muss im Image
liegen. Deshalb zieht `npm ci` im Dockerfile die Dev-Abhängigkeiten mit.

**Bewusst so belassen.** Was dagegen spricht, ist real, aber klein: ein paar Sekunden Startzeit und
ein größeres Image. Was dafür spricht: Ein echtes Emit müsste `shared/` mit auflösen (Pfad-Alias
`@shared/*`, eigener `rootDir`) und die ESM-Auflösung im Container nachbilden – Aufwand und
Regressionsrisiko an der Stelle, an der ein Fehler den Produktivstart verhindert. Der Nutzen wäre
kein Verhalten, sondern nur Bequemlichkeit.

**Wenn es doch umgestellt wird**, gehören diese vier Schritte zusammen: `tsc` mit Emit nach
`server/dist`, `start` auf `node dist/index.js`, im Dockerfile `npm ci --omit=dev` **nach** dem
Build, und der Healthcheck als Gegenprobe (der Container muss ohne `tsx` hochkommen). Vorher auf
Staging prüfen – ein Fehlschlag zeigt sich erst beim Start, nicht beim Bauen.

## Entzogene Team-Notizen-Rechte greifen mit bis zu 5 Minuten Verzögerung *(27.07.2026, #199)*
`getCapabilities` merkt sich die Rechte eines Kontos bis zu 5 Minuten (`capsMemo` in
`server/src/services/churchtools.ts`). Wird jemandem der Zugriff auf Team-Notizen in ChurchTools
entzogen, kann er sie in diesem Fenster noch sehen.

**Bewusst in Kauf genommen.** Der Cache ist die Antwort auf ein reales Problem: ChurchTools liefert
`/api/permissions/global` sporadisch für Sekunden bis Minuten mit leeren Rechte-Arrays aus (belegt
am 08.07.2026 im Log). Ohne Überbrückung stünden mitten im Gottesdienst alle ohne Rechte da – das
wiegt schwerer als ein Rechteentzug, der ein paar Minuten später greift. Es geht zudem um
Anmerkungen des eigenen Teams, nicht um Personen- oder Finanzdaten. Wer den Entzug sofort
durchsetzen muss, startet den Container neu.
