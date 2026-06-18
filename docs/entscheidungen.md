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

## Schrift/Spalten gesperrt bei vorhandenen Anmerkungen
**Entscheidung:** Solange Anmerkungen existieren, sind Schriftgröße/Spaltenzahl gesperrt.
**Begründung:** Anmerkungen sind pixelbasiert (Canvas). Würde der Text neu umbrechen,
lägen die Anmerkungen falsch. Sperre verhindert das Verrutschen.
