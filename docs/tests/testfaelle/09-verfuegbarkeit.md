# Abwesenheiten (eigene Abwesenheiten in ChurchTools)

Der Tab „Abwesenheiten" (#177) schreibt **echte Abwesenheiten in ChurchTools**. Alle Fälle deshalb auf
**musik-test** mit einem Konto durchspielen, dessen Einträge man hinterher in ChurchTools nachsehen
und aufräumen darf. Aufbau seit dem 19.09.2026 (Entwurfsrunde 8): Monatsleiste, ein Abhakfeld je
Termin, **Speichern-Leiste** – nichts wird ohne „Speichern" geschrieben.

### TF-VERF-01 · Bei Terminen abhaken, speichern, zurücknehmen

**Das brauchst du:** Ein Konto, das aktives Mitglied einer unter „Mehr → Verwaltung → Anmerkungen →
Gruppen-Zuweisung" gewählten Gruppe ist (ECG: Musikteam). Zugriff auf ChurchTools, um nachzusehen.

**Das muss passieren:** Der Tab **Abwesenheiten** ist da (Person mit Schrägstrich). Ein Haken bei einem
Termin ist nur **vorgemerkt** (blauer Ring) – erst **Speichern** legt in ChurchTools **je Termin**
eine Abwesenheit mit dessen **Uhrzeit** und dem Kommentar `[Musikteam]` an, alle Häkchen auf einmal
(seit 22.09.2026; vorher ganztägig je Tag). Ein zweiter Tipp nimmt einen Haken zurück.

1. Anmelden, unten auf **Abwesenheiten**. Beim ersten Öffnen erscheint die Einführung (drei Blasen) –
   schließen. Oben der Schalter **Termine | Einträge**, darunter die Monatsleiste mit **Heute**
   (ausgegraut), dem laufenden Monat und sechs Monaten voraus, rechts der runde Pfeil.
2. Beim nächsten Gottesdienst das Kästchen **Abwesend** antippen: Haken rot, blauer Ring, die
   Datumskachel wird rot. Unten erscheint die Leiste **„Verwerfen · 1 Änderung vorgemerkt ·
   Speichern"**, das Plus ist weg. **In ChurchTools steht noch nichts.**
3. Ein zweites Kästchen antippen (2 Änderungen), dann beim ersten den Haken wieder wegnehmen (1
   Änderung). **Verwerfen** → Leiste weg, alle Haken wie vorher.
4. Ein Kästchen antippen, **Speichern** → Meldung „1 Änderung gespeichert – steht jetzt in
   ChurchTools.", der Ring ist weg, der Haken bleibt rot. Das Plus ist wieder da.
5. In ChurchTools: Personen → dein Profil → Abwesenheiten. Der Eintrag ist da, Grund „Abwesend",
   Kommentar **`[Musikteam]`**.
6. Zurück in der App: den Haken wegnehmen → Leiste, **Speichern** → in ChurchTools ist der Eintrag weg.
7. **Zwei auf einmal:** zwei Termine abhaken, einmal Speichern → Meldung „2 Änderungen gespeichert",
   in ChurchTools zwei Einträge. Dann beide wieder weg, Speichern.
8. **Unter „Termine" fehlt Vergangenes:** Der laufende Monat zeigt nur Termine ab heute.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/Availability.tsx`, `client/src/components/MonatsLeiste.tsx`, `client/src/hooks/useAvailability.ts`, `server/src/services/absences.ts`, `server/src/controllers/absencesController.ts`, `shared/absences/index.ts`
- **Automatisiert:** teilweise – `client/src/pages/Availability.test.tsx` (vorgemerkt statt geschrieben, zweiter Tipp, Verwerfen, kein Plus während der Vormerkung, Fehler behält die Vormerkung), `client/src/hooks/useAvailability.test.tsx` (erst anlegen, dann löschen, nacheinander; nach Fehlschlag neu holen), `server/src/services/absences.test.ts`; von Hand bleibt, dass ChurchTools die Einträge wirklich anlegt und der Grund stimmt (`CHURCHTOOLS_ABSENCE_REASON_ID`)
- **Historie:** #177 (Runde 8, 19.09.2026)

</details>

### TF-VERF-02 · Ein Termin in einem Zeitraum: Rückfrage statt stillem Löschen

**Das brauchst du:** Wie TF-VERF-01, plus eine Abwesenheit **über mehrere Tage**, die du **direkt in
ChurchTools** anlegst – Grund **„Urlaub"**, Kommentar „Test-Urlaub" (**ohne** `[Musikteam]`), über einen
kommenden Termin.

**Das muss passieren:** Der Termin im Urlaub hat den Haken (Kachel grau, Unterzeile „Urlaub · Mi,
14.10. – Di, 20.10."). Den Haken wegzunehmen fragt nach: **Zeitraum löschen** (vorgemerkt) oder
**Zeitraum anpassen** (Fenster) oder Abbrechen. Beim Anpassen bleibt der Eintrag **Urlaub** und
bekommt **keinen** Marker.

1. In ChurchTools den Urlaub anlegen. In der App **Abwesenheiten** öffnen (nach unten ziehen zum
   Aktualisieren).
2. Beim Termin im Urlaub das Kästchen antippen → Fenster **„Teil eines Zeitraums"** mit dem Satz
   „… gehört zu Urlaub, Mi, 14.10. – Di, 20.10. (Test-Urlaub)". **Abbrechen** → nichts vorgemerkt.
3. Erneut antippen → **Zeitraum anpassen**: Das Fenster „Abwesenheit ändern" zeigt Von/Bis, Kommentar
   und **Grund „Urlaub"**. **Bis** um einen Tag kürzen, **Speichern** → „Geändert." In ChurchTools steht
   genau **ein** Eintrag mit den neuen Daten, Grund weiterhin **Urlaub**, ohne Marker.
4. Erneut antippen → **Zeitraum löschen**: Fenster zu, der Haken ist weg, Leiste „1 Änderung
   vorgemerkt". Ein weiterer Tipp auf das Kästchen nimmt die Löschung **ohne Rückfrage** zurück.
5. Noch einmal löschen vormerken, **Speichern** → in ChurchTools ist der Urlaub weg.
6. **Gegenprobe:** Ein eigener Eintages-Eintrag (TF-VERF-01) fragt beim Wegnehmen **nicht** nach.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ZeitraumFrage.tsx`, `client/src/pages/Availability.tsx`, `client/src/components/AbsenceSheet.tsx`, `server/src/services/absences.ts`, `shared/absences/index.ts`
- **Automatisiert:** teilweise – `client/src/pages/Availability.test.tsx` (Rückfrage, löschen vormerken, zurücknehmen, anpassen öffnet das Fenster), `server/src/services/absences.test.ts` (Grund und fehlender Marker bleiben beim Ändern), `server/src/services/absenceGrund.test.ts`; von Hand bleibt der echte ChurchTools-Eintrag
- **Historie:** #177 (Runde 8, 19.09.2026)

</details>

### TF-VERF-03 · Ohne Gruppen-Mitgliedschaft kein Tab

**Das brauchst du:** Ein Konto, das in **keiner** der gewählten Gruppen aktives Mitglied ist (oder:
Admin leert die Gruppen-Zuweisung).

**Das muss passieren:** Unten gibt es **keinen** Tab „Abwesenheiten" – nur Termine, Lieder, Mehr. War
der Tab vorher geöffnet, landet man nach dem Neuladen auf „Termine", nicht auf einer leeren Seite.

1. Mit diesem Konto anmelden, Tab-Leiste ansehen.
2. Gegenprobe mit einem Musikteam-Konto: Tab ist da.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/services/ctCapabilities.ts`, `client/src/App.tsx`, `client/src/components/TabBar.tsx`
- **Automatisiert:** teilweise – `server/src/services/churchtools.capabilities.test.ts` (`computeAvailabilityAllowed`); der Rückfall auf „Termine" ist Handarbeit
- **Historie:** #177

</details>

### TF-VERF-04 · Zeitraum über das Plus eintragen, unter „Einträge" ändern und löschen

**Das brauchst du:** Wie TF-VERF-01.

**Das muss passieren:** Das Plus öffnet **„Zeitraum eintragen"** mit Schnellwahl; nach dem Eintragen
steht der Zeitraum unter **Einträge → Anstehend** mit den Terminen, die er trifft. Ein Tipp auf die
Zeile öffnet „Abwesenheit ändern"; nach dem Speichern steht in ChurchTools **genau ein** Eintrag mit
den neuen Werten – der alte ist weg, der Marker `[Musikteam]` geblieben.

1. Unten rechts auf das **Plus** → Fenster „Zeitraum eintragen", Von = nächster Termin. **„1 Woche"**
   antippen: Von/Bis springen auf sieben Tage, der Knopf heißt „Eintragen (7 Tage)". **Eintragen** →
   Meldung „Eingetragen …". Gegenprobe: **„Wochenende"** trifft Samstag+Sonntag.
2. Oben auf **Einträge**: Unter **Anstehend (n)** steht der Zeitraum, Unterzeile „trifft So, …" mit den
   Terminen darin. Der Zähler am Schalter stimmt. Unter „Termine" haben die getroffenen Termine den
   Haken, Unterzeile mit Zeitraum.
3. Die Zeile antippen → „Abwesenheit ändern" mit Von, Bis, Kommentar, Grund. **Bis** zwei Tage nach
   hinten, Kommentar ändern, **Speichern** → „Geändert.", die Zeile zeigt den neuen Zeitraum.
4. In ChurchTools nachsehen: **ein** Eintrag mit den neuen Daten und Kommentar `[Musikteam] …` –
   kein zweiter, kein alter.
5. Die Zeile erneut antippen → **Löschen** → „Gelöscht.", in ChurchTools ist der Eintrag weg. Bei
   einem Eintrag, der direkt in ChurchTools gemacht wurde (TF-VERF-02), kommt vor dem Löschen die
   Rückfrage „stammt aus ChurchTools".

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `server/src/services/absences.ts`, `server/src/controllers/absencesController.ts`, `client/src/components/AbsenceSheet.tsx`, `client/src/pages/Availability.tsx`
- **Automatisiert:** teilweise – `server/src/services/absences.test.ts` (Reihenfolge anlegen→löschen, 403, 409, Fehlschlag beim Aufräumen), `client/src/components/AbsenceSheet.test.tsx`, `client/src/pages/Availability.test.tsx` (Plus mit nächstem Termin, Einträge nach Monat mit „trifft", Löschen); von Hand bleibt, dass in ChurchTools wirklich nur ein Eintrag übrig bleibt
- **Historie:** #177 (Runde 8, 19.09.2026)

</details>

### TF-VERF-05 · Monate wählen, Früheres ansehen

**Das brauchst du:** Wie TF-VERF-01, dazu eine Abwesenheit in der Vergangenheit (in ChurchTools ein
Datum vor heute eintragen – das lässt die App nicht zu).

**Das muss passieren:** Die Monatsleiste zeigt nur nach vorn; der Pfeil klappt zwölf Monate auf;
**Heute** führt zurück. Vergangenes steht unter **Einträge → Früher**, nur zum Ansehen.

1. In der Leiste **Dez 26** antippen: Überschrift „Dezember 2026", die Termine dieses Monats. **Heute**
   ist jetzt aktiv → Tipp → zurück zum laufenden Monat, Heute ausgegraut. Die Leiste lässt sich nach
   rechts wischen (rechte Kante läuft aus), sechs Monate voraus.
2. Auf den runden **Pfeil** rechts: Raster mit zwölf Monaten ab heute, Jahreszahl darüber; Monate mit
   Einträgen tragen einen roten Punkt. Einen Monat weit hinten wählen → Raster zu, Monat gewählt, er
   steht als Pill in der Leiste. Pfeil erneut → Raster wieder zu.
3. **Einträge → Früher (n):** Der vergangene Eintrag steht dort, blass. Antippen → Fenster
   „Vergangene Abwesenheit", Felder gesperrt, kein Speichern, kein Löschen, Knopf „Schließen".
4. **Anstehend** zeigt ihn nicht; unter „Termine" gibt es keinen vergangenen Monat.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/MonatsLeiste.tsx`, `client/src/utils/monate.ts`, `client/src/pages/Availability.tsx`, `client/src/components/AbsenceSheet.tsx`, `server/src/services/absences.ts`
- **Automatisiert:** teilweise – `client/src/components/MonatsLeiste.test.tsx`, `client/src/utils/monate.test.ts`, `client/src/pages/Availability.test.tsx` (Monat wechseln, Heute, Früher nur lesbar), `server/src/services/absences.test.ts` (Fenster bis zu einem Tag, höchstens ein Jahr); von Hand bleibt das Wischen der Leiste am Gerät
- **Historie:** #177 (Runde 8, 19.09.2026)

</details>

### TF-VERF-06 · Termine nach Art filtern (mit Admin-Pflege)

**Das brauchst du:** Ein Admin-Konto und ein Konto mit dem Tab „Abwesenheiten". Einen Monat, in dem
Termine mit verschiedenen Namen liegen (z. B. „Gottesdienst", „Gebetsabend", „Probe").

**Das muss passieren:** Der Admin legt die Arten fest, die Knöpfe heißen wie die Arten, Liste und
Zahl folgen der Auswahl (genau eine Art oder alles), und beim nächsten Öffnen steht der Filter
noch so.

1. **Als Admin:** Mehr → Verwaltung → **„Abwesenheiten: Termin-Arten"**. Zwei Arten anlegen:
   Name „Gottesdienst", Suchwort „Gottesdienst"; Name „Gebetsabend", Suchwort „Gebet". Speichern.
   Die Reihe zeigt „2 Arten".
2. Tab „Abwesenheiten" → „Termine". Unter der Monatsleiste stehen **„Alle"**, „Gottesdienst",
   „Gebetsabend" und – falls es Termine mit anderem Namen gibt – **„Sonstige"**. „Alle" ist blau.
3. **„Gottesdienst"** antippen: Nur Gottesdienste (auch „Gottesdienst mit Abendmahl") bleiben, die
   Zahl passt, „Alle" ist nicht mehr blau.
4. **„Gebetsabend"** antippen: Jetzt nur Gebetsabende – der Knopf **ersetzt** „Gottesdienst".
   „Gebetsabend" erneut antippen: Die Anzeige springt auf **„Alle"**.
5. Einen Monat ohne Gebetsabend wählen, „Gebetsabend" antippen: „Kein Termin mehr in diesem
   Monat" – der Filter ist sichtbar aktiv.
6. **Häkchen bleibt:** Einen Gottesdienst abhaken (Leiste „Speichern" erscheint), dann auf
   „Gebetsabend" filtern: Die Leiste bleibt. Zurück auf „Alle": Der Haken steht noch.
7. **Merken:** „Gebetsabend" wählen, App schließen und neu öffnen → der Filter steht noch.
8. **Ohne Arten:** Der Admin löscht alle Arten und speichert. Im Tab gibt es die Knöpfe **nicht**.
9. **Halbe Zeile:** Im Admin-Fenster eine Art nur mit Namen anlegen und speichern → Meldung, nichts
   gespeichert.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/pages/Availability.tsx`, `client/src/utils/terminFilter.ts`, `client/src/components/TerminArtenManager.tsx`, `client/src/pages/Settings.tsx`, `client/src/utils/devicePrefs.ts`, `server/src/services/siteConfig.ts`
- **Automatisiert:** überwiegend – `client/src/utils/terminFilter.test.ts` (Suchwort, Reihenfolge, Sonstige, eins-oder-alles, verwaiste Wahl), `client/src/pages/Availability.test.tsx` (Knöpfe, Zahl, eins-oder-alles, Sonstige, Merken, Häkchen übersteht den Wechsel, keine Knöpfe ohne Arten), `client/src/components/TerminArtenManager.test.tsx` (trimmen, halbe Zeile, löschen), `server/src/services/siteConfig.test.ts` (Schema, Rundlauf, doppelte IDs); von Hand bleibt der Weg über den echten Admin-Bereich
- **Historie:** #400 (20.09.2026), Wunsch Alwin; erster Bau nach Kalender verworfen (bei der ECG ein Kalender für alles)

</details>

### TF-VERF-07 · Zwei Termine an einem Tag einzeln abhaken

**Das brauchst du:** Einen Tag mit **zwei** Terminen in ChurchTools (z. B. Gottesdienst 10:00 und
Jugendtreff 16:00) und Zugriff auf ChurchTools zum Nachsehen.

**Das muss passieren:** Die beiden Termine sind unabhängig. Ein Haken am Vormittagstermin lässt den
Nachmittag frei – in ChurchTools steht eine Abwesenheit **mit Uhrzeit**, nicht für den ganzen Tag
(Wunsch Alwin, 22.09.2026: „manchmal hab ich morgens keine Zeit kann aber nachmittags").

1. Tab **Abwesenheiten**, den Monat mit den beiden Terminen wählen. Beide stehen untereinander, die
   Datumskachel zeigt links die Uhrzeit.
2. Beim **ersten** Termin **Abwesend** abhaken → nur dieser bekommt den Haken, der zweite bleibt
   leer. Unten die Leiste, **Speichern**.
3. Nach dem Speichern: Der erste Termin ist rot, der zweite **unverändert frei**.
4. In ChurchTools nachsehen (Personen → dein Profil → Abwesenheiten): Der Eintrag trägt die
   **Uhrzeit des Termins**, nicht „ganztägig".
5. Jetzt auch den **zweiten** Termin abhaken und speichern → **zwei** Einträge am selben Tag.
6. Unter **Einträge** stehen beide getrennt, jeder mit seiner Uhrzeit („Abwesend · 10:00 – 12:00").
7. **Ganztägig bleibt ganztägig:** Über das **Plus** einen Zeitraum eintragen, der diesen Tag
   enthält → **beide** Termine zeigen den Haken (ein Urlaub gilt für den ganzen Tag).
8. Einen Eintrag mit Uhrzeit antippen, nur den **Kommentar** ändern, speichern → die Uhrzeit bleibt
   erhalten, der zweite Termin ist weiterhin frei.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/absences/index.ts`, `client/src/pages/Availability.tsx`, `client/src/utils/absenceDatum.ts`, `client/src/hooks/useAvailability.ts`, `server/src/services/absences.ts`, `server/src/controllers/absencesController.ts`
- **Automatisiert:** teilweise – `client/src/utils/absenceDatum.test.ts` (Fenster trennt Vormittag/Nachmittag, ganztägig deckt beides, Grenzen offen), `client/src/pages/Availability.test.tsx` (Haken lässt den zweiten Termin frei), `server/src/services/absences.test.ts` (Doppel-Erkennung mit Fenster, Uhrzeit überlebt eine Änderung); von Hand bleibt, dass ChurchTools die Uhrzeit wirklich speichert und anzeigt
- **Historie:** Alwin 22.09.2026 („das muss in der logik geändert werden")

</details>
