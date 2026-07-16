# Umsetzungsplan – Modul „Verfügbarkeit" (Musik-Abwesenheiten), Phase 1

> Status: **Entwurf / noch nicht umgesetzt.** Ersetzt den alten Flask-Planner
> (`~/Documents/ecgd_musik_planner`) für den Abwesenheits-Teil.
> Erstellt: 2026-07-16.

## 1. Ziel & Abgrenzung

**Ziel Phase 1:** Musiker markieren in der Musik-App, an welchen Terminen sie
**nicht** können. Speicherung **direkt in ChurchTools** (keine Excel, kein Sync).

**In Phase 1 enthalten**
- Eigene Abwesenheiten ansehen, anlegen, entfernen
- Termin-Basis **kombiniert**: kommende Gottesdienste (Schnellauswahl) + freie Datumsauswahl
- Kommentarfeld je Abwesenheit
- Leiteransicht (optional, read-only) über die Abwesenheiten des Teams

**Bewusst NICHT in Phase 1** (→ Phase 2)
- Dienst-Einteilung (B/O-Zellen), Monatssperre, Eintragen als Musik-Dienst in CT-`eventServices`
- Ablösung der Excel-Planungslogik insgesamt

## 2. Getroffene Architektur-Entscheidungen

| Thema | Entscheidung |
|---|---|
| Datenhoheit | **ChurchTools ist die Quelle der Wahrheit.** Kein zweiter Datentopf. |
| Identität | Persönliches CT-Session-Cookie des Nutzers (bereits vorhanden via `ctGet(cookie, …)`) → jeder trägt nur **seine eigenen** ein |
| CT-Kennzeichnung | Grund „Abwesend" (`absenceReasonId = 1`) **+ Kommentar** mit festem Marker-Präfix |
| Termine | Gottesdienste aus CT (Schnellauswahl) **+** freie Datumsauswahl |
| Rechte | Eigene: immer. Fremde: nur mit Leiter-Rolle (vorhandenes Capabilities-System) |
| Sicherheit | Kein Service-Token, keine offenen Endpunkte – alles hinter der App-Session |

### Marker-Konvention (wichtig)
CT-Abwesenheiten mit `reasonId = 1` können auch **manuell** angelegt sein
(z. B. Kommentar „Familienurlaub"). Damit die App nur ihre eigenen Einträge
verändert/löscht, bekommt jeder von der App erzeugte Eintrag einen festen
Kommentar-Präfix:

```
[Musikteam] <optionaler Freitext des Musikers>
```

- **Erkennung „eigener" Einträge:** `comment` beginnt mit `[Musikteam]`.
- Manuelle Urlaube/Krank-Einträge werden dadurch **nie** angefasst.
- Zusätzlich als Sicherheitsnetz nutzbar: `meta.createdPerson.id` (wer hat angelegt).

## 3. ChurchTools-API (verifiziert 2026-07-16)

Basis: `/api/persons/{personId}/absences`

| Zweck | Request |
|---|---|
| Lesen | `GET /api/persons/{id}/absences?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500` |
| Anlegen | `POST /api/persons/{id}/absences` |
| Löschen | `DELETE /api/persons/{id}/absences/{absenceId}` |

**Felder einer Abwesenheit** (bestätigt): `id`, `startDate`, `endDate`,
`startTime`/`endTime` (null = ganztägig), `absenceReason{id,name,…}`,
`comment`, `meta{createdDate, createdPerson, modifiedDate}`.

**POST-Body**
```json
{
  "startDate": "2026-05-24",
  "endDate":   "2026-05-24",
  "absenceReasonId": 1,
  "comment": "[Musikteam] Urlaub"
}
```
Gottesdienst-Abmeldung = eintägig (`startDate == endDate`, Zeiten null).
Freie Auswahl kann auch einen Zeitraum (`startDate < endDate`) setzen.

**Termine (Gottesdienste) für die Schnellauswahl**
`GET /api/events?from=…&to=…&limit=…`, gefiltert auf Name enthält
„gottesdienst" (wie im Alt-Client `get_events_for_date`).

> ⚠️ **Vor Baubeginn zu verifizieren:** Kann ein **normaler** Musiker mit seinem
> eigenen Cookie `POST`/`DELETE` auf seine **eigenen** Abwesenheiten? (In CT i. d. R.
> ja, wenn das Abwesenheitsmodul aktiv ist.) Kurzer Test mit einem Nicht-Admin-Login.

## 4. Server (Muster: `annotations` / `teamNotes`)

Neue Dateien:
- `server/src/services/absences.ts`
  - `getAbsences(cookie, personId, from, to)`
  - `createAbsence(cookie, personId, {startDate, endDate, comment})` → setzt `reasonId=1` + Marker-Präfix
  - `deleteAbsence(cookie, personId, absenceId)` → nur wenn `comment` mit Marker beginnt
  - `getUpcomingServices(cookie, from, to)` → Gottesdienst-Termine für die Schnellauswahl
- `server/src/controllers/absencesController.ts`
- `server/src/routes/absences.ts`

Endpunkte (alle **session-geschützt**, `personId` serverseitig aus dem Cookie
via `getUserId(cookie)` – Client schickt keine fremde ID für Selbstpflege):
```
GET    /api/absences                 → eigene Abwesenheiten (Zeitraum via Query)
POST   /api/absences                 → eigene anlegen  { date | startDate,endDate, comment }
DELETE /api/absences/:absenceId      → eigene entfernen (Marker-Prüfung serverseitig)
GET    /api/absences/services        → kommende Gottesdienste (Schnellauswahl)
GET    /api/absences/team            → Leiteransicht (nur mit Leiter-Rolle) [optional Phase 1b]
```
Einhängen in `server/src/index.ts` bei den session-geschützten Routern
(neben `annotationsRoutes`, Zeile ~114): `app.use('/api', absencesRoutes)`.

**Serverseitige Regeln**
- Selbstpflege: `personId = getUserId(cookie)` – kein Vertrauen auf Client-IDs.
- Löschen nur, wenn `comment` mit `[Musikteam]` beginnt (Schutz manueller Einträge).
- Doppelte vermeiden: vor dem Anlegen prüfen, ob der Tag bereits durch eine
  eigene Abwesenheit abgedeckt ist.

## 5. Client

Neue Seite `client/src/pages/Availability.tsx` (+ `.module.scss`) und Eintrag in
`components/NavBar.tsx` (neuer Tab „Verfügbarkeit"; sichtbar nur für
Musikteam-Mitglieder – Capability wie `canUseGlobalNotes`).

Neuer Service `client/src/services/availability.ts` (analog `annotations.ts`):
`getMyAbsences`, `createAbsence`, `deleteAbsence`, `getServices`.

React-Query-Hooks: `useMyAbsences`, `useUpcomingServices`, `useToggleAbsence`
(optimistisches Update, Invalidierung nach Erfolg).

**UI-Fluss**
1. Oben „Kommende Gottesdienste" – Liste mit Datum/Wochentag + Schalter „kann nicht".
   Bereits abgedeckte Tage werden als „abwesend" angezeigt (auch wenn manuell/Urlaub).
2. Darunter „Weitere Termine" – Datepicker (Einzeltag oder Zeitraum) + optionales Kommentarfeld.
3. Eigene Abwesenheiten als Liste mit Löschen (nur Marker-Einträge löschbar; manuelle
   werden angezeigt, aber gesperrt mit Hinweis „in ChurchTools angelegt").

**Offline (PWA):** Ansicht offline verfügbar (React-Query-Persistenz);
Schreibaktionen offline optional in Phase 1b (Queue wie `offlineAuto.ts`),
sonst Hinweis „nur online möglich".

## 6. Rechte / Capabilities

- Sichtbarkeit des Tabs + Selbstpflege: Mitglied Musikteam (Gruppe 9) – analog
  `musicianGroupIds`/`canUseGlobalNotes`.
- `GET /api/absences/team` (fremde ansehen): nur Leiter-Rolle
  (Rollen-System aus #124 wiederverwenden: `groupTypeRoleId`).
- Fremde **bearbeiten** ist in Phase 1 **nicht** vorgesehen.

## 7. Übergang & Alt-Daten

1. Alter Flask-Planner + Excel laufen **parallel weiter**, bis Phase 1 abgenommen ist.
2. **Einmaliger Import** des aktuellen Excel-Abwesenheitsstands → CT
   (Skript, das den bestehenden `sync_full_absences`-Gedanken nutzt, aber mit
   Marker-Kommentar schreibt). Nur zukünftige Tage, keine Duplikate.
3. Danach Excel-Eintragung abschalten; Planner-Backend vom Netz nehmen.
4. **Token rotieren** (s. Sicherheitshinweis) – unabhängig davon sofort fällig.

## 8. Sicherheit (löst Altlasten mit)

- Kein allmächtiges Service-Token für Abwesenheiten mehr (Nutzer-Cookie).
- Keine unauthentifizierten Endpunkte (alles hinter Session-Middleware).
- **Sofort, unabhängig vom Neubau:** den im Git-Verlauf des Planner-Repos
  offenliegenden CT-Token in ChurchTools **neu erzeugen** (er ist noch aktiv);
  den alten Planner absichern / vom Internet nehmen.

## 9. Tests

- Server-Unit: `absences.ts` (Marker-Präfix beim Anlegen; Löschschutz für
  Nicht-Marker-Einträge; Duplikat-Vermeidung; Zeitraum-Logik).
- Controller: Rechteprüfung (Selbst vs. Team), `personId` aus Cookie.
- Client: Hook-Optimismus, Anzeige gesperrter (manueller) Einträge.
- Bestehende Konventionen: Lint 0 Fehler, Client- + Server-Tests grün.

## 10. Offene Punkte / Risiken

- **CT-Selbstpflege-Recht** für Nicht-Admins verifizieren (Abschnitt 3).
- Marker-Präfix im Kommentar final festlegen (`[Musikteam]` ok?).
- Umgang mit ganztägig vs. Uhrzeit (Phase 1: ganztägig).
- Leiteransicht Phase 1 oder 1b?
- Import-Skript: Namens-/Personen-Zuordnung wie im Alt-Client (Namensabgleich).

## 11. Etappen-Reihenfolge (Vorschlag)

1. CT-Selbstpflege-Recht verifizieren (kurzer Live-Test, read/write mit Testeintrag).
2. Server: `absences.ts` + Controller + Route + Tests.
3. Client: Service + Hooks + Seite `Availability.tsx` + Tab.
4. Feinschliff UI (gesperrte manuelle Einträge, Kommentar, Zeitraum).
5. Leiteransicht (optional).
6. Import-Skript Excel → CT (einmalig).
7. Staging-Abnahme → Release → alten Planner abschalten → Token rotieren.
