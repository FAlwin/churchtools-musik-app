# Interne Begleit-Checkliste (Onboarding einer Gemeinde)

Nur für die interne Begleitung gedacht – die öffentliche Anleitung ist [INSTALL.md](../INSTALL.md).
Ziel: eine fremde Gemeinde betreibt ihre eigene, eigenständige Instanz. Wir liefern Code + Anleitung,
betreiben aber **nichts** für sie (kein zentraler Server, kein geteilter Zugang, kein Support-Versprechen).

## Vorab abfragen

- [ ] **ChurchTools-URL** der Gemeinde (`https://…church.tools`, ohne Slash)
- [ ] **Welches ChurchTools-Recht** soll als „Administrator" gelten? (Form `modul:recht`; Default
      `churchcore:administer persons` – bei abweichendem Rechtekonzept anpassen)
- [ ] **(Sub-)Domain** für den externen Zugang vorhanden? Wer verwaltet das DNS?
- [ ] Wer hat **Docker-Zugriff** auf dem Server/NAS und kann Container starten/aktualisieren?
- [ ] Welche **Mitglieder-Rolle** soll Inhalte sehen dürfen? (ChurchTools-Lese-Rechte klären)

## Beim Aufsetzen

- [ ] `deploy/`-Paket bereitgestellt, `.env` ausgefüllt
- [ ] `SESSION_SECRET` frisch erzeugt (`openssl rand -hex 32`) – **nicht** wiederverwenden/teilen
- [ ] Container läuft, `:3001` intern erreichbar
- [ ] Reverse Proxy + HTTPS-Zertifikat eingerichtet, externe URL erreichbar
- [ ] Erst-Login mit Admin-Recht funktioniert
- [ ] Gemeindename gesetzt, ggf. Links angelegt

## Typische Stolpersteine (aus Erfahrung)

- **Cookie/HTTPS:** Login-Cookie wird im reinen HTTP-LAN ggf. abgelehnt → über HTTPS testen.
  In Produktion vertraut die App dem Reverse Proxy (`trust proxy`) – die `X-Forwarded-*`-Header
  müssen ankommen.
- **ChurchTools-Rechte:** „Nichts sichtbar" liegt fast immer an fehlenden CT-Lese-Rechten
  (Veranstaltungen / Song-Kategorien), nicht an der App.
- **Admin-Recht passt nicht:** `ADMIN_PERMISSION` an das Rechtekonzept der Instanz anpassen.
- **Update löscht Einstellungen:** Daten-Volume `musik-data` muss erhalten bleiben.

## Datenschutz / Verantwortung

- [ ] Der Gemeinde ist klar: Sie verantwortet **ihre** Instanz, ihren CT-Zugang und ihre Daten selbst
      (DSGVO). Wir geben keine Gewähr (MIT-Lizenz).
