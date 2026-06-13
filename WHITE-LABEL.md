# White-Label & Verteilung an andere Gemeinden

> Roadmap/Notiz für eine spätere Session. Stand der Besprechung: 14.06.2026.
> **Gewählte Richtung: Selbst-Hosting (jede Gemeinde betreibt es selbst).**
> Noch NICHT umgesetzt – hier nur der Plan.

## Ziel
Das Programm so aufbereiten, dass es jede Gemeinde mit wenigen Schritten an ihre eigene
ChurchTools-Instanz anbinden kann, mit nachlieferbaren Updates und einer Anleitung – ohne KI-Hilfe.

## Was schon vorbereitet ist
- **ChurchTools-Adresse ist Laufzeit-Wert:** `CHURCHTOOLS_BASE_URL` in der `.env`, vom Server beim
  Start gelesen → eine fremde Gemeinde trägt nur ihre Adresse ein, **kein Neubau nötig**.
- **Branding zentral gebündelt:** `client/src/config/branding.ts` (Name, Kurzname, Logo, Org, Farben)
  + Logo-Dateien in `client/public/`. ABER: greift derzeit **beim Bauen** (siehe To-do 1).
- Deploy-/Reverse-Proxy-Anleitung als Vorlage: `DEPLOYMENT.md`.

## To-dos für die Verteilung (empfohlene Reihenfolge)
1. **Branding zur Laufzeit** (statt Build-Zeit): App-Name/Logo/Farben per `.env`/Config + Logo-Ordner,
   damit ein fertiges Image ohne Neubau gebrandet werden kann. (Fundament fürs Ausliefern)
2. **Vorgebautes, versioniertes Docker-Image** in einer Registry (z.B. GitHub Container Registry).
   Auslieferung über `docker-compose.yml` mit `image: …:vX`. **Update = `pull` + neu starten**
   (oder automatisch via Watchtower). Ersetzt das lokale `build: .`.
3. **Anleitung** (bebildert), zwei Teile:
   - Installation (Synology Container Manager / Docker): Image holen, `.env` ausfüllen
     (CT-Adresse + `SESSION_SECRET`), starten.
   - Erreichbarkeit/HTTPS (Reverse Proxy / DDNS) – **der schwierigste Schritt für Laien**.
4. **Login-Sicherheit (optional, prüfen):** „Login mit ChurchTools" (Token/OAuth) statt
   E-Mail+Passwort. Bei Selbst-Hosting weniger kritisch, aber schöner. ChurchTools-Möglichkeiten prüfen.
5. **Lizenz + Haftungsausschluss** fürs Programm festlegen.

## Ehrliche Einordnung
- „Wenige Klicks, ohne Technik" ist bei **Selbst-Hosting nie ganz** erreichbar: App starten +
  CT-Adresse eintragen ist einfach, aber **HTTPS/Erreichbarkeit von außen** ist der echte Hürdenpunkt.
  Ohne eigenen Server/NAS geht es nicht. (Vollständig klickeinfach nur, wenn man zentral hostet –
  das wurde bewusst NICHT gewählt, wegen Betriebs-/DSGVO-Last.)
- Rechtlich ist Selbst-Hosting sauber: **jede Gemeinde ist eigener Verantwortlicher** für ihre Daten.

## Offene Entscheidungen (vor dem Start klären)
- Zielgruppe: nur Gemeinden mit NAS/Technik-Affinen?
- Lizenz: offen (z.B. MIT) oder kontrolliert (auf Anfrage)?
- Support: Update-Ankündigungen / Kontaktstelle?
- Branding: dürfen Gemeinden eigenes Logo/Namen, oder einheitlich „Musik App"?

## Empfohlener Startpunkt (nächste Session)
**(1) Branding zur Laufzeit + (2) Docker-Image in Registry** – das ist das Fundament für
„ausliefern und updaten". Danach (3) Anleitung, optional (4) Login-Token.
