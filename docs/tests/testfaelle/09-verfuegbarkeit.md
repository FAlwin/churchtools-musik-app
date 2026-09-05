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
2. Bei einem kommenden Termin auf **„Kann nicht"** tippen. Im Fenster als Kommentar „Test" eintragen,
   **Eintragen**.
3. Meldung „Eingetragen – steht jetzt als Abwesenheit in ChurchTools." Der Termin zeigt jetzt rot
   **„Abgemeldet"**, unten unter „Meine Abwesenheiten" steht der Tag mit „Test".
4. In ChurchTools: Personen → dein Profil → Abwesenheiten. Der Eintrag ist da, Grund „Abwesend",
   Kommentar **`[Musikteam] Test`**.
5. Zurück in der App auf **„Abgemeldet"** tippen → Meldung „Abmeldung zurückgenommen.", der Termin
   zeigt wieder „Kann nicht". In ChurchTools ist der Eintrag weg.
6. **Kein Doppel:** zweimal schnell hintereinander „Kann nicht" für denselben Tag eintragen – in
   ChurchTools steht danach genau **ein** Eintrag.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/Availability.tsx`, `client/src/hooks/useAvailability.ts`, `server/src/services/absences.ts`, `server/src/controllers/absencesController.ts`, `shared/absences/index.ts`
- **Automatisiert:** teilweise – `client/src/pages/Availability.test.tsx`, `server/src/services/absences.test.ts`; von Hand bleibt, dass ChurchTools den Eintrag wirklich anlegt und der Grund stimmt (`CHURCHTOOLS_ABSENCE_REASON_ID`)
- **Historie:** #177

</details>

### TF-VERF-02 · Manuelle ChurchTools-Abwesenheit bleibt unangetastet

**Das brauchst du:** Wie TF-VERF-01, plus eine Abwesenheit, die du **direkt in ChurchTools** anlegst
(z. B. Grund „Urlaub", ohne Kommentar), die einen kommenden Termin überdeckt.

**Das muss passieren:** Der Termin zeigt ein **Schloss** mit „Abwesend" statt eines Knopfs. In
„Meine Abwesenheiten" steht der Zeitraum mit Schloss, **ohne Papierkorb**. Nichts in der App kann
diesen Eintrag löschen.

1. In ChurchTools eine Abwesenheit über einen kommenden Termin anlegen (ohne `[Musikteam]`).
2. In der App **Verfügbar** öffnen (bei Bedarf nach unten ziehen zum Aktualisieren).
3. Der Termin zeigt das Schloss; der Zeitraum steht unten mit Schloss und Grund „Urlaub".
4. Den Eintrag in ChurchTools wieder löschen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/absences/index.ts`, `server/src/services/absences.ts`, `client/src/utils/absenceDatum.ts`, `client/src/pages/Availability.tsx`
- **Automatisiert:** ja – `server/src/services/absences.test.ts` (403 ohne Marker), `client/src/pages/Availability.test.tsx` (Schloss, kein Knopf); von Hand nur der echte ChurchTools-Eintrag
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
