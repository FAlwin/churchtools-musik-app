# Verfügbarkeit (eigene Abwesenheiten)

Der Bereich „Verfügbar" (#177) schreibt **echte Abwesenheiten in ChurchTools**. Alle Fälle deshalb auf
**musik-test** mit einem Konto durchspielen, dessen Einträge man hinterher in ChurchTools nachsehen
und aufräumen darf.

### TF-VERF-01 · Bei einem Termin abmelden und zurücknehmen

**Das brauchst du:** Ein Konto, das aktives Mitglied einer unter „Mehr → Verwaltung → Anmerkungen →
Gruppen-Zuweisung" gewählten Gruppe ist (ECG: Musikteam). Zugriff auf ChurchTools, um nachzusehen.

**Das muss passieren:** Der Tab „Verfügbar" ist da. Ein Tipp auf „Kann nicht" legt in ChurchTools
eine Abwesenheit für genau diesen Tag an, mit Kommentar `[Musikteam] <dein Text>`; der Knopf wird rot
„Abgemeldet". Ein Tipp darauf löscht die Abwesenheit wieder.

1. Anmelden, unten auf **Verfügbar**. Beim ersten Öffnen erscheint die Einführung (drei Blasen) – schließen.
   Oben steht der **nächste Termin** mit „du bist verfügbar", darunter der **Wochenstreifen** mit der
   laufenden Woche (heute mit blauem Rand, Termintage mit Punkt).
2. Beim Termin unter „Diese Woche" – oder gleich oben im Kopf – auf **„Kann nicht"** tippen. Im
   Fenster als Kommentar „Test" eintragen, **Eintragen**.
3. Meldung „Eingetragen – steht jetzt als Abwesenheit in ChurchTools." Der Termin zeigt jetzt rot
   **„Abgemeldet"**, die Kachel des Tages im Streifen ist rot, der Kopf sagt „du bist abgemeldet",
   und unter „Meine Abwesenheiten" steht der Tag mit „Test".
4. In ChurchTools: Personen → dein Profil → Abwesenheiten. Der Eintrag ist da, Grund „Abwesend",
   Kommentar **`[Musikteam] Test`**.
5. Zurück in der App auf **„Abgemeldet"** tippen → Meldung „Abmeldung zurückgenommen.", der Termin
   zeigt wieder „Kann nicht". In ChurchTools ist der Eintrag weg.
6. **Kein Doppel:** zweimal schnell hintereinander „Kann nicht" für denselben Tag eintragen – in
   ChurchTools steht danach genau **ein** Eintrag.
7. **Zeitraum mit Schnellauswahl:** Im Streifen einen künftigen Tag antippen – es öffnet sich sofort
   „Abwesenheit eintragen" mit diesem Tag. Oben **„1 Woche"** antippen: Von/Bis springen auf sieben
   Tage, der Knopf heißt „Eintragen (7 Tage)". **Eintragen** → unter „Meine Abwesenheiten" steht der
   Zeitraum, in ChurchTools ein Eintrag über sieben Tage. Gegenproben: **„Wochenende"** trifft
   Samstag+Sonntag; vergangene Tage im Streifen lassen sich nicht antippen.
8. **Wischen:** Den Streifen mit dem Finger nach links ziehen – die nächste Woche kommt schon beim
   Ziehen sichtbar herein und rastet beim Loslassen ein. Ein halber Zug (weniger als ein Drittel der
   Breite) fällt zurück, ohne die Woche zu wechseln. In der ersten Woche lässt sich nicht weiter
   zurückziehen; der Streifen federt dann nur leicht.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/Availability.tsx`, `client/src/components/WochenStreifen.tsx`, `client/src/components/AbsenceSheet.tsx`, `client/src/utils/wochen.ts`, `client/src/hooks/useAvailability.ts`, `server/src/services/absences.ts`, `server/src/controllers/absencesController.ts`, `shared/absences/index.ts`
- **Automatisiert:** teilweise – `client/src/pages/Availability.test.tsx`, `client/src/components/AbsenceSheet.test.tsx`, `client/src/utils/wochen.test.ts`, `server/src/services/absences.test.ts`; von Hand bleibt, dass ChurchTools den Eintrag wirklich anlegt, der Grund stimmt (`CHURCHTOOLS_ABSENCE_REASON_ID`) und dass sich der Streifen am Gerät gut wischen lässt
- **Historie:** #177

</details>

### TF-VERF-02 · Ein ChurchTools-Eintrag: änderbar, aber mit Rückfrage

**Das brauchst du:** Wie TF-VERF-01, plus eine Abwesenheit, die du **direkt in ChurchTools** anlegst –
Grund **„Urlaub"**, mit einem Kommentar, über einen kommenden Termin.

**Das muss passieren:** Der Eintrag erscheint mit seinem Grund und ist **änderbar** (Entscheidung
Alwin, 05.09.2026 – vorher trug er ein Schloss). Beim Speichern bleibt er **Urlaub** und bekommt
**keinen** `[Musikteam]`-Kommentar. Vor dem **Löschen** fragt die App nach.

1. In ChurchTools eine Abwesenheit über einen kommenden Termin anlegen (Grund „Urlaub", Kommentar
   z. B. „Test-Urlaub", **ohne** `[Musikteam]`).
2. In der App **Verfügbar** öffnen (bei Bedarf nach unten ziehen zum Aktualisieren).
3. Unter „Meine Abwesenheiten" steht der Zeitraum mit „Test-Urlaub · Urlaub"; beim Termin steht
   „Urlaub" als Knopf.
4. Die Zeile antippen: Im Fenster sind Von/Bis, Kommentar und **Grund „Urlaub"** vorgewählt. Die
   Auswahl enthält die Gründe **deiner** ChurchTools-Instanz.
5. **Bis** um einen Tag verlängern, **Speichern** → „Geändert." In ChurchTools steht genau **ein**
   Eintrag mit den neuen Daten, Grund weiterhin **Urlaub** (nicht „Abwesend"!) und ohne Marker.
6. Zeile erneut antippen → **Löschen** → Rückfrage „Dieser Eintrag stammt aus ChurchTools („Urlaub")".
   **Behalten** bricht ab; **Ja, löschen** entfernt ihn. In ChurchTools ist er weg.
7. **Gegenprobe Grund:** Einen eigenen App-Eintrag anlegen (TF-VERF-01) – in ChurchTools trägt er den
   Standardgrund („Abwesend") und den Marker. Beim Löschen kommt **keine** Rückfrage.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/absences/index.ts`, `server/src/services/absences.ts`, `client/src/components/AbsenceSheet.tsx`, `client/src/pages/Availability.tsx`
- **Automatisiert:** teilweise – `server/src/services/absences.test.ts` (Grund und fehlender Marker bleiben beim Ändern; Gründe aus `getMasterData`), `server/src/services/absenceGrund.test.ts` (Übersetzung der Schlüssel), `client/src/components/AbsenceSheet.test.tsx` (Grund-Auswahl, Rückfrage vor dem Löschen); von Hand bleibt der echte ChurchTools-Eintrag und dass dort genau ein Eintrag übrig ist
- **Historie:** #177

</details>

### TF-VERF-03 · Ohne Gruppen-Mitgliedschaft kein Tab

**Das brauchst du:** Ein Konto, das in **keiner** der gewählten Gruppen aktives Mitglied ist (oder:
Admin leert die Gruppen-Zuweisung).

**Das muss passieren:** Unten gibt es **keinen** Tab „Verfügbar" – nur Termine, Lieder, Mehr. War der
Tab vorher geöffnet, landet man nach dem Neuladen auf „Termine", nicht auf einer leeren Seite.

1. Mit diesem Konto anmelden, Tab-Leiste ansehen.
2. Gegenprobe mit einem Musikteam-Konto: Tab ist da.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/services/ctCapabilities.ts`, `client/src/App.tsx`, `client/src/components/TabBar.tsx`
- **Automatisiert:** teilweise – `server/src/services/churchtools.capabilities.test.ts` (`computeAvailabilityAllowed`); der Rückfall auf „Termine" ist Handarbeit
- **Historie:** #177

</details>

### TF-VERF-04 · Eine eigene Abwesenheit ändern

**Das brauchst du:** Wie TF-VERF-01, plus einen eigenen Eintrag (z. B. den aus Schritt 7).

**Das muss passieren:** Ein Tipp auf die Zeile öffnet „Abwesenheit ändern". Nach dem Speichern steht
in ChurchTools **genau ein** Eintrag mit den neuen Werten – der alte ist weg, der Marker
`[Musikteam]` ist geblieben.

1. Unter **„Meine Abwesenheiten"** die eigene Zeile antippen (die mit dem Pfeil rechts).
2. Das Fenster zeigt Von, Bis und den Kommentar des Eintrags. **Bis** um zwei Tage nach hinten setzen,
   Kommentar ändern, **Speichern** → Meldung „Geändert.", die Zeile zeigt den neuen Zeitraum.
3. In ChurchTools nachsehen: **ein** Eintrag mit den neuen Daten und Kommentar `[Musikteam] …` –
   kein zweiter, kein alter.
4. Die Zeile erneut antippen → **Löschen** → Meldung „Gelöscht.", in ChurchTools ist der Eintrag weg.
5. **Gegenprobe Schloss:** Der Eintrag, den du direkt in ChurchTools gemacht hast (TF-VERF-02), ist
   **kein** Knopf – er zeigt „🔒 ChurchTools" und lässt sich hier nicht öffnen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `server/src/services/absences.ts`, `server/src/controllers/absencesController.ts`, `client/src/components/AbsenceSheet.tsx`, `client/src/pages/Availability.tsx`
- **Automatisiert:** teilweise – `server/src/services/absences.test.ts` (Reihenfolge anlegen→löschen, 403, 409, Fehlschlag beim Aufräumen), `client/src/components/AbsenceSheet.test.tsx`, `client/src/pages/Availability.test.tsx`; von Hand bleibt, dass in ChurchTools wirklich nur ein Eintrag übrig bleibt
- **Historie:** #177

</details>
