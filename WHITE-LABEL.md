# White-Label & Verteilung an andere Gemeinden

> Stand: 18.06.2026. **Gewählte Richtung: Selbst-Hosting (jede Gemeinde betreibt
> eine eigene Instanz).** Einrichtung erfolgt **per Klick in der App**, nicht über Dateien.
> Phase A+B (Laufzeit-Branding + Einstellungsseite) sind umgesetzt; C+D offen.

## Getroffene Entscheidungen (18.06.2026)
- **Hosting:** jede Gemeinde selbst (eine Instanz pro Gemeinde). Rechtlich sauber.
- **Konfiguration:** in der App per Klick (Einstellungsseite), kein Datei-Editieren.
- **CT-Adresse:** bleibt in der `.env` (kein Setup-Bildschirm vor dem Login nötig).
- **Admin-Schutz:** ChurchTools-Admin-Recht (`ADMIN_PERMISSION`, Default
  `churchcore:administer persons` – je Instanz prüfen).
- **Einstellbar:** App-Name, Kurzname, Beschreibung, Org-Name, Logo (Upload),
  Haupt-/Akkordfarbe, CCLI-Nummer.

## Umsetzungsstand
- **[x] Phase A – Branding zur Laufzeit (Lesen):** `GET /api/site-config` +
  `GET /api/site-logo`; Client wendet Farben/Name/Logo beim Start an (`useSiteConfig` +
  `applyBranding`). Speicher: `site.json` auf Volume (kein DB-Bruch).
- **[x] Phase B – Einstellungsseite (nur Admin):** `PUT /api/site-config`
  (Session + Admin, Zod-validiert); Seite `pages/Settings.tsx` mit Live-Vorschau.
- **[ ] Phase C – PWA-Manifest dynamisch:** Manifest aktuell noch Build-Zeit
  (`branding.ts`). Server muss `/manifest.webmanifest` aus der Config erzeugen.
- **[ ] Phase D – Auslieferung:** versioniertes Docker-Image (GHCR), `docker-compose`
  mit Volume, Installations-Anleitung, Lizenz/Haftungsausschluss.

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
