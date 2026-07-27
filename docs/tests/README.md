# Manuelles Testmanagement

Alles, was sich **nicht** automatisch prüfen lässt: Stift und Finger auf dem iPad, die iOS-Tastatur,
Offline im Saal, das Zusammenspiel mit ChurchTools. Die automatisierten Tests stehen im
[Testkonzept](../entwicklung/testkonzept.md) – hier geht es nur um das, was ein Mensch anfassen muss.

Angelehnt an klassisches Testmanagement (ALM), aber ohne zusätzliches Werkzeug:

| ALM-Begriff       | Hier                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| Test Plan         | `testfaelle/*.md` – die Sammlung, versioniert mit dem Code           |
| Test Set/Lab      | ein GitHub-Issue „Testlauf vX.Y.Z" mit Häkchen, am iPad abhakbar     |
| Requirements-Link | das Feld **Betrifft** je Testfall – verbindet Testfall und Quelltext |
| Defect            | ein normales Fehler-Issue, das die Testfall-Nummer nennt             |

## Warum die Sammlung groß und der Lauf klein ist

Die Sammlung darf wachsen – jeder gefundene Fehler kommt dazu. Ein Testlauf mit 45 Fällen würde
aber schlicht nicht durchgeführt, und eine Liste, die man abkürzt, ist schlimmer als eine kurze:
Man weiß hinterher nicht, was geprüft wurde.

Deshalb wählt `npm run testplan` aus. Jeder Testfall nennt unter **Betrifft**, welche Dateien ihn
berühren. Das Skript vergleicht das mit dem, was sich seit dem letzten Release geändert hat, und
teilt in drei Gruppen:

- **Immer prüfen** – Priorität `kritisch`. Die Wege, ohne die ein Gottesdienst nicht läuft. Rund
  zehn Fälle, unabhängig von der Änderung.
- **Von dieser Änderung betroffen** – über **Betrifft** ermittelt.
- **Nicht betroffen** – wird nur gezählt, nicht aufgelistet. Damit sichtbar bleibt, was bewusst
  ausgelassen wurde (stilles Weglassen wäre schlimmer als gar keine Auswahl).

## Ablauf vor einem Release

```bash
npm run testplan                      # Vorschau im Terminal
npm run testplan -- --issue v2.14.3   # legt das Testlauf-Issue an
```

Dann am Gerät abhaken. Ein durchgefallener Schritt wird ein Fehler-Issue mit der Testfall-Nummer im
Titel; das Häkchen bleibt leer und der Verweis kommt in den Testlauf. Das Issue bleibt als Protokoll
stehen: **was wurde wann auf welcher Version geprüft**.

## Einen Testfall schreiben

Eine Datei je Bereich, darin je Testfall ein `###`-Abschnitt. Der Testfall selbst ist eine
**Klickanleitung** – jemand ohne technisches Vorwissen soll ihn abarbeiten können, ohne zu fragen,
was gemeint ist. Die technischen Angaben stehen zugeklappt darunter; sie sind für das Auswahl-Skript
da, nicht zum Lesen.

```markdown
### TF-CHART-04 · Vergrößerung bleibt beim Blättern erhalten

**Das brauchst du:** Ein Lied mit mehreren Seiten.

**Das muss passieren:** Die Seite ist noch genauso vergrößert wie vorher und zeigt denselben
Ausschnitt. Sie darf nicht wieder klein sein.

1. Unten auf **Termine** tippen, einen Gottesdienst öffnen.
2. Ein mehrseitiges Lied antippen.
3. Mit zwei Fingern die Seite aufziehen.
4. Nach links wischen und wieder zurück.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useZoomOrchestration.ts`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** nein – Zwei-Finger-Geste, nur am Gerät
- **Historie:** #33

</details>
```

**Die vier Felder** im zugeklappten Block liest das Skript – Schreibweise bitte genau so:

- **Priorität** – `kritisch` läuft bei jedem Testlauf mit. Sparsam vergeben: nur, was einen
  Gottesdienst tatsächlich stören würde. Aktuell sind es zwölf. Sonst `hoch` oder `normal`.
- **Betrifft** – Pfade oder Muster mit `*`, kommagetrennt. Lieber ein Verzeichnis zu viel als eines
  zu wenig: Ein Fall, der zu oft vorgeschlagen wird, kostet Minuten – einer, der übersehen wird,
  kostet einen Gottesdienst.
- **Automatisiert** – `nein – <Grund>` oder der Test, der das inzwischen abdeckt. Wird ein Fall
  automatisiert, bleibt er hier stehen mit dem Verweis; so schrumpft die manuelle Liste sichtbar,
  statt ewig zu wachsen.
- **Historie** – die Issue-Nummern, bei denen das schon einmal kaputt war. Der wichtigste Teil: Er
  sagt, warum dieser Schritt dasteht, und verhindert, dass jemand ihn als überflüssig streicht.

## Schritte formulieren

- **Beim Nullpunkt anfangen.** Erster Schritt ist, was man tippt, um überhaupt hinzukommen („Unten
  auf **Termine** tippen"). Niemand soll raten müssen, wo er startet.
- **Eine Handlung je Schritt**, in der Reihenfolge des Tuns.
- **Die Beschriftung nennen, die wirklich dasteht** – **Aa**, **Bearbeiten**, **Lied verknüpfen**,
  „das Personen-Symbol oben rechts". Keine internen Begriffe wie „Anmerkungsmodus umschalten".
- **„Das muss passieren" gehört nach oben**, direkt vor die Schritte: Man liest erst, worauf man
  achten soll, und tippt dann – nicht umgekehrt.
- **Konkret statt allgemein**: „Kapo auf 2" statt „Kapo ändern". Beim Nachstellen zählt der genaue
  Wert.
- **Ehrlich sagen, was man braucht**: zwei Geräte, ein Lied mit PDF, ein zweites Konto, ein
  Test-Termin. Sonst bricht man mittendrin ab.
- **Warnen, wo es wehtut**: Alles, was nach ChurchTools schreibt, beginnt mit einem Hinweis auf den
  Test-Termin.
