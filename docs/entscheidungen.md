# Architektur-Entscheidungen

Kurze Begründungen für die bewussten Abweichungen und Festlegungen. Neue
Entscheidungen unten anhängen (Datum + Kontext + Entscheidung + Begründung).

---

## Keine eigene Datenbank
**Entscheidung:** Die App hält keine eigene DB. ChurchTools ist die einzige
Datenquelle; das Backend ist ein reiner Proxy.
**Begründung:** Doppelte Datenhaltung (Lieder, Setlisten, Tonarten) wäre fehleranfällig
und müsste synchron gehalten werden. ChurchTools ist ohnehin das führende System der
Gemeinde. Lokale Notizen/Anmerkungen liegen pro Gerät im `localStorage` – sie sind
gerätegebunden und unkritisch, daher kein Server-Speicher nötig.
**Folge:** Kein ORM, keine Migrationen, keine Test-DB. Die Blueprint-Punkte rund um
Datenbanken entfallen für dieses Projekt.

## Auth über ChurchTools-Session
**Entscheidung:** Login mit persönlichem ChurchTools-Konto; das Backend hält die
Session und gibt dem Client ein signiertes httpOnly-Cookie.
**Begründung:** Keine zweite Nutzerverwaltung. Rechte (wer darf Ablauf bearbeiten,
wer sieht nur das Liederbuch) kommen direkt aus ChurchTools (`/api/capabilities`).

## Reverse Proxy statt Cloudflare
**Entscheidung:** Externer Zugang über Synology Reverse Proxy + DDNS + Let's Encrypt,
**kein** Cloudflare Tunnel (anders als im Blueprint vorgeschlagen).
**Begründung:** Das NAS bringt Reverse Proxy und Zertifikatsverwaltung mit; der
UniFi-Router leitet nur 443/80 weiter. Eine zusätzliche Cloudflare-Abhängigkeit ist
nicht nötig. DSM-Ports (5000/5001) bleiben geschlossen.

## ChordPro-Bearbeitung als separate ECG-Version
**Entscheidung:** Der Editor speichert Änderungen als eigene Datei
`"<Titel> — ECG.chordpro"`, das Original-Arrangement bleibt unangetastet.
**Begründung:** Kein Risiko, von SongSelect bezogene Originale zu überschreiben;
jederzeit auf das Original zurückführbar.

## White-Label: Laufzeit-Branding in einer JSON-Datei (statt DB)
**Entscheidung:** Name/Logo/Farben/CCLI werden zur Laufzeit aus `site.json` auf einem
persistenten Docker-Volume gelesen/geschrieben (`SITE_CONFIG_PATH`), nicht in einer Datenbank.
Das Logo liegt als base64-Data-URL in derselben Datei und wird über `GET /api/site-logo`
als Bild ausgeliefert.
**Begründung:** Bleibt der „keine DB"-Linie treu (siehe oben). Eine einzelne kleine Datei
genügt für die wenigen Branding-Werte einer Instanz, übersteht Updates und ist leicht zu sichern.
**Folge:** Ein gemeinsames Docker-Image für alle Gemeinden – Branding kommt zur Laufzeit,
kein Neubau pro Gemeinde.

## White-Label: Admin-Schutz über ChurchTools-Recht
**Entscheidung:** Nur ChurchTools-Administratoren dürfen das Branding ändern. Das maßgebliche
Recht ist konfigurierbar (`ADMIN_PERMISSION`, Default `churchcore:administer persons`).
**Begründung:** Keine zweite Passwortverwaltung; konsistent zur restlichen rechtebewussten UI.
**Offen:** Das exakte Admin-Recht variiert je CT-Instanz und sollte vor dem Ausrollen an eine
fremde Gemeinde an deren Instanz verifiziert werden.

## White-Label: Verteilung über privates GHCR-Image, Lizenz proprietär
**Entscheidung:** Das fertige Docker-Image liegt **privat** in der GitHub Container Registry und
wird per Versions-Tag (`v*`) durch einen Release-Workflow gepusht. Die Software steht **nicht** unter
einer offenen Lizenz – Nutzung durch andere Gemeinden nur **auf Anfrage** (`LIZENZ.md`).
**Begründung:** Verteilung bewusst kontrolliert (wer es nutzt, wird freigegeben). Privates Image +
Zugangstoken pro Gemeinde geben diese Kontrolle. Es liegen keine Secrets im Image (Env nur zur Laufzeit).
**Folge:** Empfangende Gemeinden brauchen einen GitHub-Token (`read:packages`) für `docker login ghcr.io`
(in `deploy/ANLEITUNG.md` beschrieben).

## Schrift/Spalten gesperrt bei vorhandenen Anmerkungen
**Entscheidung:** Solange Anmerkungen existieren, sind Schriftgröße/Spaltenzahl gesperrt.
**Begründung:** Anmerkungen sind pixelbasiert (Canvas). Würde der Text neu umbrechen,
lägen die Anmerkungen falsch. Sperre verhindert das Verrutschen.
