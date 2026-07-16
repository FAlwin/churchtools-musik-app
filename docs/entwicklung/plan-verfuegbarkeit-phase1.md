# Umsetzungsplan – Modul „Verfügbarkeit" (Musik-Abwesenheiten) + beidseitiger Excel-Sync

> Status: **Entwurf / noch nicht umgesetzt. Machbarkeit (App-Eingabe) am 16.07.2026 live verifiziert ✅**
> Löst die **Weboberfläche** des alten Flask-Planners (`ecgd-musik.ecg-donrath.de`) ab.
> **Die Excel bleibt aktiv** (Eingabeweg + Dienst-Einteilung) und wird **beidseitig** mit CT synchronisiert.

## 1. Ziel & Abgrenzung

**Ziel:** Musiker tragen Abwesenheiten künftig in der **Musik-App** ein (statt im alten
Planner-Web). Speicherung in **ChurchTools**. Die **Excel bleibt gleichwertig gekoppelt** –
beidseitiger Abgleich Excel↔CT – und bleibt vorerst Heimat der Dienst-Einteilung.

**Zielarchitektur – ChurchTools als zentraler Hub / Master:**
```
   Musik-App  ──(Nutzer-Login)──►  ChurchTools  ◄──(beidseitig, Cron)──►  Excel
  (Abwesenheiten eingeben)          = MASTER              (Eintragen + Dienst-Einteilung)
```

**In diesem Vorhaben (Phase 1) enthalten**
- App-Eingabe: eigene Abwesenheiten ansehen/anlegen/entfernen (Nutzer-Login → CT, kein Service-Token)
- Termin-Basis kombiniert: kommende Gottesdienste (Schnellauswahl) + freie Datumsauswahl
- Kommentarfeld je Abwesenheit
- **Beidseitiger Sync-Dienst Excel↔CT** (Cron), CT gewinnt bei Konflikten
- Leiteransicht (optional, read-only) über die Abwesenheiten des Teams

**Bewusst NICHT (→ Phase 2)**
- Dienst-Einteilung (B/O-Zellen), Monatssperre, Eintragen als Musik-Dienst in CT-`eventServices`.
  ⚠️ Solange in Excel: die heutige „Einteilung → CT-Dienste"-Funktion des alten Planners
  (`assign_musicians_for_month`) darf beim Ablösen **nicht verloren gehen** (s. §8).

## 2. Getroffene Entscheidungen (16.07.2026, mit Alwin)

| Thema | Entscheidung |
|---|---|
| Datenhoheit / Master | **ChurchTools ist Master.** Bei Konflikt (Excel ≠ CT am selben Tag) **gewinnt CT** (überschreibt Excel). |
| App-Eingabe | Persönliches CT-Session-Cookie → jeder pflegt nur **seine eigenen** (kein Service-Token) |
| Excel | **bleibt aktiv** – aktiver Eingabeweg + Dienst-Einteilung; beidseitig mit CT gekoppelt |
| CT-Kennzeichnung | Grund „Abwesend" (`absenceReasonId=1`) **+ Kommentar** mit Marker `[Musikteam] <Freitext>` |
| Termine | Gottesdienste aus CT (Schnellauswahl) **+** freie Datumsauswahl |
| Reihenfolge | **Beidseitig gleich mitbauen** (App-Eingabe + voller Sync zusammen) |
| Rechte | Eigene: immer. Fremde (Leiteransicht): nur mit Leiter-Rolle |

### Marker-Konvention (zentral für „nur eigene anfassen")
Von App **und** Sync erzeugte CT-Abwesenheiten tragen den Kommentar-Präfix `[Musikteam] …`.
- **Schreiben/Löschen in CT** nur bei Einträgen mit diesem Marker.
- **Manuelle** CT-Abwesenheiten (Urlaub/Krank, ohne Marker) werden **gelesen** (fürs Anzeigen/
  Excel-Spiegeln), aber **nie verändert/gelöscht**.

## 3. Der beidseitige Sync (Kernstück, neu)

**Warum aufwändig:** „hinzugefügt" vs. „auf der anderen Seite gelöscht" ist ohne dritte
Vergleichsgröße nicht unterscheidbar. Lösung: **Baseline-Snapshot** (Stand des letzten Sync).

**Datenbasis:** je Zelle `(personId, datum) → abwesend? ja/nein`.
- **C** = aktueller CT-Stand (nur Marker-Einträge zählen als „von uns")
- **E** = aktueller Excel-Stand (X in der Musiker-Zeile)
- **B** = Baseline (persistierter JSON-Snapshot auf dem Volume, z. B. `sync-baseline.json`)

**Merge-Regel je Zelle:**
| C vs B | E vs B | Aktion |
|---|---|---|
| gleich | gleich | nichts |
| geändert | gleich | CT-Änderung → Excel schreiben |
| gleich | geändert | Excel-Änderung → CT schreiben (mit Marker) |
| geändert | geändert (widersprüchlich) | **Konflikt → CT gewinnt**, Excel auf CT setzen, Log |
Danach **Baseline = neuer gemeinsamer Stand**.

**Namens-Matching:** Excel kennt nur Namen, CT hat IDs → Auflösung wie Alt-Client
(`find_person_id`, exakter Match). Nicht auflösbare Namen werden geloggt, nicht geraten.
Baseline arbeitet mit `personId` (stabil), nicht mit Namen.

**Ausführung:** periodischer Job (Cron/Intervall). Braucht **CT-Service-Token** (schreibt für
alle Personen) **+ Graph** (Excel). → Das ist der Teil, der **nicht** mit Nutzer-Cookies geht.

**Fehler/Sicht:** Sync-Fehler werden **sichtbar** (Log + optionale Mail/Statusseite),
NICHT verschluckt wie im Alt-Planner.

## 4. ChurchTools-API (verifiziert 16.07.2026)

Basis: `/api/persons/{personId}/absences` – `GET` (from/to/limit), `POST`, `DELETE /{id}`.
Felder: `id, startDate, endDate, startTime/endTime (null=ganztägig), absenceReason{…}, comment,
meta{createdDate, createdPerson, modifiedDate}`. POST-Body:
```json
{ "startDate":"2026-05-24", "endDate":"2026-05-24", "absenceReasonId":1, "comment":"[Musikteam] Urlaub" }
```
Gottesdienste (Schnellauswahl): `GET /api/events?from=…&to=…`, Name enthält „gottesdienst".

### ✅ Machbarkeits-Check App-Eingabe (Testkonto „Test Tester" id 1009, ohne Admin-Rechte)
lesen 200 · anlegen 201 · löschen 204 · Events 200 → **normaler Nutzer kann eigene Abwesenheiten
pflegen, kein Service-Token für die App-Eingabe nötig.**

> ⚠️ **Nebenbefund CT-Rechte:** Das Testkonto konnte auch **fremde** Abwesenheiten anlegen
> (201) + lesen (Testeintrag sofort gelöscht). CT-Instanz-Einstellung, kein App-Problem
> (App erzwingt `personId = getUserId(cookie)`). **To-do Alwin:** in CT prüfen/einschränken.

## 5. Server (Muster: `annotations`/`teamNotes`)

**App-Eingabe (Nutzer-Cookie):**
- `services/absences.ts` – `getAbsences/createAbsence/deleteAbsence/getUpcomingServices`
- `controllers/absencesController.ts`, `routes/absences.ts` (session-geschützt)
- Endpunkte: `GET/POST/DELETE /api/absences`, `GET /api/absences/services`,
  optional `GET /api/absences/team` (nur Leiter-Rolle)
- `personId` serverseitig aus Cookie; Löschen nur bei Marker-Einträgen; Duplikate vermeiden.

**Sync-Dienst (Service-Token, NEU – OPTIONALES Modul, s. §12 White-Label):**
- `services/excelSync/…` – Graph-Client (Excel lesen/schreiben, aus Alt-`graph_client.py` portieren),
  CT-Service-Client, Baseline-Store (`sync-baseline.json` auf dem Volume), Merge-Logik (§3).
- Scheduler (Intervall, z. B. alle 5–10 min) + manueller Trigger `POST /api/absences/sync`
  (Admin-geschützt) + Statusausgabe.
- **Aktivierung rein über Server-Env** (nicht über SiteConfig – die ist teils öffentlich!):
  Modul wird nur registriert, wenn `EXCEL_FILE_ID` + `AZURE_*` + CT-Service-Token gesetzt sind
  (Muster wie Alt-Planner `if _ct_base_url and _ct_token`). Sonst läuft KEIN Excel-Code.
  > Entscheidung offen: Sync als Teil des Musik-App-Servers **oder** eigenständiger Mini-Dienst
  > (könnte der entkernte Alt-Planner ohne Web sein). Empfehlung: im Musik-App-Server integrieren
  > (eine Infrastruktur), aber Service-Token strikt getrennt vom Nutzerpfad halten.

## 6. Client
`pages/Availability.tsx` (+ `.module.scss`), `services/availability.ts`,
Hooks `useMyAbsences/useUpcomingServices/useToggleAbsence`, NavBar-Tab „Verfügbarkeit"
(nur Musikteam). UI: Gottesdienst-Schnellauswahl + freie Datumsauswahl + Kommentar;
eigene Liste mit Löschen; manuelle CT-Einträge angezeigt, aber gesperrt. Onboarding-Tour
+ Tour-Version erhöhen. Offline: Ansicht ja; Schreiben online (Queue optional später).

## 7. Rechte / Capabilities
Tab + Selbstpflege: Musikteam (Gruppe 9), analog `canUseGlobalNotes`. Leiteransicht:
Leiter-Rolle (Rollen-System aus #124). Fremde bearbeiten: nicht in Phase 1.

## 8. Übergang & Altlasten
1. Alter Planner + Excel laufen parallel, bis Phase 1 steht.
2. **Weboberfläche des Planners abschalten**, Backend/Sync durch neuen Dienst ersetzen.
3. **Dienst-Einteilung → CT** (heute `assign_musicians_for_month`) muss erhalten bleiben:
   entweder in den neuen Sync-Dienst übernehmen **oder** bis Phase 2 den Alt-Job dafür behalten.
   → **klären, bevor der Planner ganz abgeschaltet wird.**
4. Baseline beim ersten Lauf aus dem Ist-Stand initialisieren (kein „Massen-Löschen").
5. **Token rotieren:** der im Git-Verlauf des Planners offenliegende CT-Token ist noch aktiv →
   in CT neu erzeugen; für den Sync-Dienst ein sauberes eigenes Service-Konto/Token verwenden.

## 9. Tests
Server-Unit: Marker-Präfix, Löschschutz Nicht-Marker, Duplikate. **Sync-Merge: alle 4
Zell-Fälle inkl. Konflikt (CT gewinnt) + Baseline-Fortschreibung** (reine testbare Funktion).
Namens-Matching + „nicht auflösbar"-Pfad. Client-Hook-Optimismus. Lint 0, Tests grün.

## 10. Offene Punkte / Risiken
- Sync-Dienst: im Musik-App-Server oder eigenständig? (§5)
- Dienst-Einteilung-Übertragung beim Planner-Abschalten (§8.3).
- Marker-Präfix final (`[Musikteam]`).
- Ganztägig vs. Uhrzeit (Phase 1: ganztägig).
- Sync-Intervall + Umgang mit Excel-Sperrzeiten (usedRange, gesperrte Monate).
- CT-Rechte-Nebenbefund (§4).
- Namens-Matching-Fehler (Excel-Namen ≠ CT) – Log statt Raten.

## 12. White-Label / Mandantenfähigkeit (WICHTIG)

Die App ist gemeinde-neutral; andere Gemeinden nutzen **keine** Excel. Regel:

**Generischer Kern (für ALLE):** die „Verfügbarkeit" (CT-Abwesenheiten). Hängt nur an
ChurchTools, kennt kein „Excel". `shared/types`, Client-UI und Kern-Endpunkte enthalten
keinerlei Excel-Bezug.

**Excel-Sync = optionales, gekapseltes Add-on (nur ECG):**
- Lebt isoliert in `services/excelSync/`.
- **Aktivierung über Server-Env**, nicht über SiteConfig (Secrets gehören nicht in die teils
  öffentliche/admin-editierbare Config): Modul + Scheduler + `POST /api/absences/sync` werden
  **nur registriert, wenn die Excel-Env gesetzt ist**. Bei allen anderen Gemeinden existiert
  das Feature schlicht nicht (kein toter Menüpunkt).
- Optionales Server-Flag `excelSyncEnabled` (bool) nur, um im Admin-Bereich eine
  Sync-Status-Kachel ein-/auszublenden. Sonst nichts im Client.

**Perspektive (nicht jetzt, YAGNI):** `excelSync` später ggf. zu einer generischen
„externe-Quelle"-Schnittstelle (Adapter) verallgemeinern. Jetzt nur der Excel-Adapter,
aber so gekapselt, dass die Abstraktion später leichtfällt.

## 11. Etappen (da „beidseitig gleich mitbauen")
1. ~~CT-Selbstpflege verifizieren~~ ✅ (16.07.2026).
2. Server App-Eingabe: `absences.ts` + Controller + Route + Tests.
3. Client: Service + Hooks + `Availability.tsx` + Tab.
4. Sync-Dienst: Graph+CT-Service-Client, Baseline-Store, Merge-Logik (§3) + Tests, Scheduler.
5. Erst-Baseline-Init + Trockenlauf (Sync nur simulieren/loggen, nichts schreiben) zur Kontrolle.
6. Leiteransicht (optional).
7. Staging-Abnahme → Release → Planner-Web abschalten (Einteilung §8.3 sichern) → Token rotieren.
