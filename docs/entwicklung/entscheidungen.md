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
