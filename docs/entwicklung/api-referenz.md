# API des eigenen Backends

> Referenz der Endpunkte, die das Express-Backend dem Client anbietet (ausgelagert aus `CLAUDE.md`).
> ChurchTools-spezifische Schreib-/Lese-Eigenheiten stehen weiterhin in `CLAUDE.md`.
> Stand: v2.13.x. Alle `/api/...`-Routen außer `health`, `site-config` (GET), `update-check` und
> `auth/login` erfordern eine gültige Session.

## System / Auth / Konfiguration
- `GET  /api/health` → `{status, env}` (öffentlich, für Reverse-Proxy/Monitoring)
- `GET  /api/update-check` → neueste veröffentlichte Version (liest GitHub-Release; für den In-App-Hinweis)
- `GET  /api/site-config` → `{ appName, description, orgName }` (öffentlich, für Login/Mehr)
- `PUT  /api/site-config` → Gemeinde-Name/Anmerkungs-Zuweisungen speichern (nur Admin, Zod-validiert)
- `POST /api/auth/login` {email, password} → `{authenticated, user}` + setzt signiertes Session-Cookie
- `POST /api/auth/logout` → Session + ChurchTools-Session beenden
- `GET  /api/auth/me` → `{authenticated, user?}`
- `GET  /api/capabilities` → Rechte des Nutzers (view/edit agenda, view/edit songcategory, canUseGlobalNotes) → steuert UI

## Termine / Ablauf
- `GET  /api/services?from=&to=` → `Service[]` (nur mit Setlist; Default-Fenster -7d…+42d; enthält `setlistChanged`-Markierung je Konto)
- `GET  /api/services/:eventId/setlist` → kompletter Ablauf (`AgendaItem[]`, Lieder mit `chordpro` + `versions[]` + documents[]; geänderte/entfernte Punkte markiert)
- `GET  /api/services/:eventId/setlist/version` → billiger Fingerabdruck (sha256) des Ablaufs für den Live-Abgleich (8s-Poll; Server-5s-Memo je Event)
- `POST /api/services/:eventId/seen` → aktuellen Ablauf-Stand als „gesehen"-Basislinie merken (steuert den „geändert"-Hinweis, #143/#161)
- `PATCH /api/services/:eventId/agenda/order` → Reihenfolge zurückschreiben (ganze Liste)
- `POST /api/services/:eventId/agenda/items` → Ablaufpunkt anlegen
- `PUT  /api/services/:eventId/agenda/items/:itemId` → Punkt ändern (Felder gebündelt: `title`, `responsible`, `arrangementId`, `unlink`, `note`, `durationMin` → CT-Sekunden)
- `DELETE /api/services/:eventId/agenda/items/:itemId` → Punkt löschen
- `PUT  /api/services/:eventId/agenda/items/:itemId/hidden` {hidden} → Uhrzeit aus-/einblenden (CT-„Auge")
- `GET  /api/agenda-services` → ChurchTools-Dienste (für die Verantwortlich-Chips)

## Lieder
- `GET  /api/song-library` → alle Lieder (Ansicht „Alle Lieder" + Auswahl beim Hinzufügen/Verknüpfen)
- `GET  /api/song-usage` → Nutzungsstatistik je Song als **`{ dates: string[] }`** (vergangene Spieltermine, bis zu 4 Jahre zurück, absteigend; 1h-Cache). Häufigkeit + „zuletzt gespielt" für den gewählten Zeitraum rechnet der **Client** daraus – ohne erneuten Server-Roundtrip.
- `GET  /api/songs/:songId/arrangements` → Arrangements eines Lieds (für „Zu Ablauf hinzufügen")
- `GET  /api/songs/:songId/chart` → Chart eines einzelnen Lieds (aus „Alle Lieder")
- `POST /api/songs/:songId/versions` {arrangementId, name, text} → neue benannte Version → `SongVersion`
- `PUT  /api/songs/:songId/versions/:versionKey` {arrangementId, text?, name?} → Version aktualisieren/umbenennen
- `DELETE /api/songs/:songId/versions/:versionKey` {arrangementId} → Version löschen (Original bleibt)
- `GET  /api/songs/:songId/files/:fileId` → PDF/Bild aus ChurchTools durchreichen (Content-Type-Whitelist; Viewer)

## Anmerkungen / Einstellungen (pro Konto, serverseitig auf dem Volume)
- `GET  /api/annotations?songs=` / `PUT /api/annotations/:key` / `DELETE …/:key` → Anmerkungen+Zoom pro Konto (Feld-Merge strokes/texts/zoom; key `song<id>_v<ver>_<seite>[_lyr][_d<class>]`; Konto-Obergrenzen #139)
- `GET  /api/settings?songs=` / `PUT /api/settings` → Lied-Einstellungen pro Konto (Schlüssel-Wert, Merge)

## Team-Notizen (geteilte Anmerkungen, PCO-Modell)
- `GET/PUT /api/annotations/sharing` → eigenen Teilen-Schalter lesen/setzen
- `GET  /api/annotations/sharers?songs=` → wer teilt für die gefragten Lieder geteilte Anmerkungen
- `GET  /api/annotations/of/:personId` → geteilte Anmerkungen einer Person (schreibgeschützt ansehen)
- `GET  /api/settings/of/:personId` → Ansicht-Einstellungen dieser Person (damit man in DEREN Darstellung schaut)

## Admin (nur mit Admin-Recht)
- `GET  /api/groups` → ChurchTools-Gruppen (Dropdown „Gruppen-Zuweisung" für Team-Notizen)
- `GET  /api/groups/:id/roles` → Rollen einer Gruppe (Rollen-Zuweisung)
