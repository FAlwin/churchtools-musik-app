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

## Branding: erst White-Label, dann feste ChurchTools-Version _(geändert 19.06.2026)_

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

## Verteilung: öffentliches GHCR-Image, MIT-Lizenz _(geändert 22.06.2026)_

**Ursprünglich geplant (verworfen):** privates GHCR-Image, Nutzung nur auf Anfrage, proprietäre Lizenz.
**Aktuelle Entscheidung:** Das Repo ist **öffentlich**, die Software steht unter der **MIT-Lizenz**
(`LICENSE`), die Docker-Images sind **anonym aus GHCR ziehbar**. Jede Gemeinde hostet ihre eigene
Instanz selbst (Anleitung `INSTALL.md` + `UPDATE.md`).
**Begründung:** niedrigschwellige Weitergabe an andere Gemeinden ohne Token-/Freigabe-Aufwand; es liegen
keine Secrets im Image (Env nur zur Laufzeit). Jede Gemeinde ist für DSGVO + eigenen Zugang verantwortlich.

## Schrift/Spalten NICHT gesperrt – Verrutschen wird in Kauf genommen _(31.07.2026, #251)_

**Entscheidung:** Schriftgröße und Spaltenzahl sind **jederzeit** änderbar, auch wenn zu der Seite
schon Anmerkungen existieren.

⚠️ **Korrektur:** Hier stand bis zum 31.07.2026 das Gegenteil – „solange Anmerkungen existieren, sind
Schriftgröße/Spaltenzahl gesperrt". **Diese Sperre gibt es im Code nicht** (und gab es seit dem Umbau
auf den durchgehenden Seitenstrom nicht mehr): `ChartAppearanceMenu` lässt beides immer zu, und der
Rückgabewert `hasAnnotations` in `usePageDraw`, der die Sperre einmal steuerte, war zuletzt toter Code
(im Zuge von #251 entfernt). Die Doku beschrieb also ein Verhalten, auf das man sich nicht verlassen
konnte.

**Die Begründung der alten Entscheidung gilt aber weiter:** Anmerkungen sind pixelbasiert (PNG pro
Seite), und der Anmerkungs-Schlüssel (`drawKeyForPage` in `utils/chartPageKeys.ts`, seit #314 – davor
inline in `pages/ChordChart.tsx`) enthält **weder `cols` noch `fontSize`**. Ein Wechsel der Spaltenzahl baut die PDF neu → vorhandene Striche liegen danach
verschoben.

**Warum trotzdem keine Sperre:** Das Ändern der Schriftgröße ist die häufigste Einstellung überhaupt
(unterschiedliche Augen, unterschiedliche Geräte) – sie zu sperren, sobald irgendwo ein Strich liegt,
wäre in der Praxis lästiger als das Verrutschen. Wer die Darstellung ändert, sieht das Verrutschen
sofort und kann rückgängig machen.

**Wollte man es sauber lösen,** müsste `cols` (und ggf. `fontSize`) in den Anmerkungs-Schlüssel wandern
– dann hätte jede Darstellung ihre eigene Anmerkungs-Ebene, wie es „Nur Text" per `_lyr` bereits hat.
Das ist bewusst nicht umgesetzt: Es vervielfacht die Ebenen und würde bestehende Anmerkungen ohne
Migration unsichtbar machen.

## `trust proxy: 'loopback'` statt `1` _(26.07.2026, #214)_

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

## Server läuft per `tsx` aus dem Quelltext, ohne Build-Artefakt _(27.07.2026, #199)_

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

## Entzogene Team-Notizen-Rechte greifen mit bis zu 5 Minuten Verzögerung _(27.07.2026, #199)_

`getCapabilities` merkt sich die Rechte eines Kontos bis zu 5 Minuten (`capsMemo` in
`server/src/services/ctCapabilities.ts`). Wird jemandem der Zugriff auf Team-Notizen in ChurchTools
entzogen, kann er sie in diesem Fenster noch sehen.

**Bewusst in Kauf genommen.** Der Cache ist die Antwort auf ein reales Problem: ChurchTools liefert
`/api/permissions/global` sporadisch für Sekunden bis Minuten mit leeren Rechte-Arrays aus (belegt
am 08.07.2026 im Log). Ohne Überbrückung stünden mitten im Gottesdienst alle ohne Rechte da – das
wiegt schwerer als ein Rechteentzug, der ein paar Minuten später greift. Es geht zudem um
Anmerkungen des eigenen Teams, nicht um Personen- oder Finanzdaten. Wer den Entzug sofort
durchsetzen muss, startet den Container neu.

## Ein Prozess, ein Zustand – die App skaliert nicht horizontal _(27.07.2026, #198)_

**Sechs** Caches leben **im Arbeitsspeicher des Server-Prozesses**, alle in `services/`:

| Wo                                 | Was                                            | Lebensdauer |
| ---------------------------------- | ---------------------------------------------- | ----------- |
| `versionMemo.ts`                   | Ablauf-Fingerabdruck je Termin **und Konto**   | 5 s         |
| `ctSessionMemos.ts` (Konto-ID)     | Konto-ID zum Session-Cookie                    | 12 h        |
| `ctSessionMemos.ts` (Rechte)       | Rechte eines Kontos                            | 5 min       |
| `ctSessionMemos.ts` (CSRF-Token)   | Schreib-Token einer Sitzung                    | 1 min       |
| `setlistBuilder.ts` (`usageCache`) | org-weite Lied-Statistik                       | 1 h         |
| `songTextIndex.ts` (`index`)       | org-weiter Suchindex über die Liedtexte (#322) | 1 h         |

(Die Zahl stand hier bis zum 13.08.2026 auf „vier", obwohl die Tabelle fünf Zeilen hatte – beim
Ergänzen des Suchindex nachgezählt.)

**Bewusst so.** Die App läuft als **eine** Container-Instanz auf dem NAS; ein geteilter Speicher
(Redis o. ä.) wäre ein zusätzlicher Dienst, der ausfallen kann – für Caches, deren Verlust nichts
kostet außer ein paar Abfragen mehr.

⚠️ **Die Einschränkung, die daraus folgt:** Mit einer zweiten Instanz hinter einem Lastverteiler
wären diese Caches nicht mehr konsistent. Konkret: Der Fingerabdruck-Poll träfe je nach Instanz
unterschiedliche Stände (der Ablauf „flackerte" zwischen geändert und unverändert), und ein
Rechteentzug würde je nach Instanz unterschiedlich schnell greifen. Beim Suchindex käme hinzu, dass
**jede** Instanz ihn einmal baut – bei 50 Liedern also 50 Datei-Downloads pro Instanz. Wer skalieren
will, muss diese Stellen zuerst gemeinsam lösen – nicht einzeln.

Alle liegen deshalb in `services/`, nicht in Controllern: So sind sie an einer Stelle auffindbar,
statt zwischen Routing-Code versteckt. **Zwei Bausteine tragen die gemeinsame Mechanik:** `ttlMemo.ts`
(Verfallszeit) und `gebuendelterLauf.ts` (Bündelung + Sperrfrist der teuren org-weiten Läufe – Statistik
und Suchindex).

## Ein Suchfeld mit Quellen-Umschalter – die Wegwahl in „Neues Lied" fiel dafür weg _(14.08.2026, #378)_

Gesucht wird in **einem** Feld; ein `Segment` darunter wählt die Quelle: **Bibliothek · Liedtexte ·
SongSelect**. Vorbilder waren ProPresenter und WorshipTools Planning, von Alwin als Muster benannt. Der
Suchbegriff gehört dem Nutzer, die Quelle ist eine Umschaltung daneben – kein zweiter Dialog.

**Die Folge war ein Rückbau, und der ist der eigentliche Gewinn:** Das Blatt „Neues Lied" hatte davor eine
vorgeschaltete Wahl („Bei SongSelect suchen" / „Selbst eintippen") und darin eine **zweite**
SongSelect-Suche. Mit dem Reiter gab es sie damit zweimal – genau die Regel-Dopplung, die dieses Projekt
mehrfach Geld gekostet hat. Jetzt führt „Neues Lied" direkt ins leere Formular, und ein Treffer aus dem
Reiter öffnet dasselbe Formular über `startTreffer` gefüllt.

**Was wo liegt** (die Aufteilung ist die Entscheidung, nicht nur der Ort):

| Wo                                              | Was                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `hooks/useLiedSuche.ts`                         | die **Regeln**: welche Quelle gilt, was an sie geschickt wird, Entprellung |
| `components/LiedSucheKopf.tsx`                  | Feld + Umschalter (die Optik, an allen drei Stellen dieselbe)              |
| `SongSelectTrefferListe`/`LiedtextTrefferListe` | die zwei Trefferlisten, die überall gleich aussehen                        |
| die Aufrufer                                    | **nur** die Bibliotheksliste – sie ist je Ansicht verschieden              |

**Der Suchtext liegt bewusst NICHT im Hook**, sondern weiterhin in `useSongFilter` beim Aufrufer: Der
filtert die Bibliothek ohnehin lokal, und zwei Zustände für denselben Text wären zwei Stellen, die
auseinanderlaufen.

**Warum „SongSelect" in „Lied verknüpfen" fehlt:** Dort wird einem **vorhandenen** Ablaufpunkt ein Lied
zugeordnet; der Anlege-Weg erzeugt mit `eventId` aber einen **neuen** Punkt. Ein Reiter dorthin wäre eine
Sackgasse. `SongPicker` bietet ihn deshalb nur an, wenn der Aufrufer einen `onSongSelectTreffer`-Weg
mitgibt – die Verfügbarkeit hängt am tatsächlich vorhandenen Ziel, nicht an einem Schalter, den man
vergessen kann.

**Die Kosten je Quelle bestimmen die Mechanik:** Die Bibliothek filtert im Browser (gratis, bei jedem
Tastendruck). Die Liedtexte brauchen serverseitig einen Index – **ein Datei-Download je Lied** –, deshalb
erst ab `LIEDTEXT_SUCHE_MIN_ZEICHEN` und entprellt; ein Tipp auf den Reiter allein löst nichts aus.
SongSelect geht über ChurchTools an CCLI (~800 ms gemessen), deshalb entprellt und erst bei „reifer"
Eingabe – eine CCLI-Nummer also erst vollständig (7 Stellen, am Bestand gemessen).

**Die letzte Quelle wird NICHT gemerkt** (Entscheidung Alwin): Jeder Einstieg beginnt bei der Bibliothek.
Auf einem geteilten iPad am Notenpult soll nicht plötzlich der CCLI-Katalog offen stehen, weil zuletzt
jemand Lieder eingepflegt hat.

## Liedtext-Vorschau: auf Verlangen je Lied, und der Suchindex wird nur BENUTZT _(14.08.2026, #379)_

Unter jedem Lied steht ein kleines **„Text zeigen"**. Erst der Tipp holt den Textanfang – **keine Vorschau
unter jedem Titel** (Entscheidung Alwin). Zwei Gründe, und beide zählen:

- **Kosten.** Eine Vorschau je Zeile ist eine Anfrage je Zeile. Bei 49 Liedern wären das 49 Abrufe, nur um
  eine Liste durchzusehen.
- **Ruhe.** Auf einem Notenpult im Gottesdienst ist eine ruhige Liste wichtiger als Vollständigkeit.

**Der Suchindex aus #322 wird benutzt, aber NIE für die Vorschau gebaut** – das ist der Kern:

| Lage                                   | Kosten der Vorschau              |
| -------------------------------------- | -------------------------------- |
| Index frisch (es wurde gerade gesucht) | **keine** Anfrage an ChurchTools |
| Index fehlt oder ist alt               | **ein** Datei-Download           |

Ein Index-Aufbau kostet einen Download je Lied. Ihn für zwei Zeilen Vorschau anzustoßen wäre grob
unverhältnismäßig – und genau die Sorte Last, die in #300 das ChurchTools-Limit gerissen hat.

**Der Index hält seitdem zwei Texte je Lied**, und die Trennung ist Absicht: `text` ist kleingeschrieben
und ohne Akkorde – zum **Suchen** gebaut; `vorschau` ist der lesbare Anfang mit Groß-/Kleinschreibung – zum
**Lesen**. Bei ~50 Liedern kostet das wenige Kilobyte, deutlich weniger als eine Datei erneut zu laden.
Damit die Regel „Akkorde fallen ersatzlos weg" nur **einmal** existiert, baut `chordproZuText` auf
`chordproZuLesetext` auf.

**Bei den Liedtext-Treffern stehen bewusst zwei Dinge übereinander:** der Ausschnitt um die **Fundstelle**
(aus dem Suchtext, also kleingeschrieben – das ist ehrlich: so wurde gesucht) und darunter auf Wunsch der
**Anfang** des Liedes. Zwei verschiedene Aussagen; eine davon weglassen hieße, die andere für beides
ausgeben.

**Für SongSelect-Treffer gibt es die Vorschau noch nicht.** `getCCLILyrics` existiert (am 13.08.2026
gemessen), aber es ist **offen, ob CCLI einen Textabruf als Nutzung vermerkt** – beim Notenblatt ist das so.
Solange das nicht gemessen ist, wird nicht abgerufen: Ein Abruf bei jedem Durchsehen könnte der Gemeinde
Nutzungen verbuchen, die niemand wollte.
