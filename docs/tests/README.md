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

Eine Datei je Bereich, darin je Testfall ein `###`-Abschnitt. Der Kopf ist maschinenlesbar –
Reihenfolge und Schreibweise der vier Felder bitte genau so:

```markdown
### TF-CHART-05 · Zoom bleibt erhalten

- **Priorität:** kritisch
- **Betrifft:** `client/src/hooks/useZoomOrchestration.ts`, `client/src/components/PageDeck.tsx`
- **Automatisiert:** nein – Pinch-Geste, nur am Gerät
- **Historie:** #33

**Voraussetzung:** Ein mehrseitiges Lied, iPad im Querformat.

1. Auf der linken Seite mit zwei Fingern hineinzoomen.
2. Eine Seite weiterblättern.
3. Zurückblättern.

**Erwartet:** Der Zoom der linken Seite ist unverändert. Die zweite Seite war nie gezoomt.
```

**Priorität**

- `kritisch` – läuft bei jedem Testlauf mit. Sparsam vergeben: Nur was einen Gottesdienst
  tatsächlich stören würde. Aktuell sind es zehn.
- `hoch` / `normal` – nur, wenn die Änderung den Bereich berührt.

**Betrifft** – Pfade oder Muster mit `*`, kommagetrennt. Lieber ein Verzeichnis zu viel als eines zu
wenig: Ein Fall, der zu oft vorgeschlagen wird, kostet Minuten – einer, der übersehen wird, kostet
einen Gottesdienst.

**Automatisiert** – `nein – <Grund>` oder der Pfad des Tests, der das inzwischen abdeckt. Wird ein
Fall automatisiert, bleibt er hier stehen mit dem Verweis; so schrumpft die manuelle Liste sichtbar,
statt ewig zu wachsen.

**Historie** – die Issue-Nummern, bei denen das schon einmal kaputt war. Der wichtigste Teil: Er
sagt, warum dieser Schritt in der Liste steht, und verhindert, dass jemand ihn als überflüssig
streicht.

## Schritte formulieren

- **Eine Handlung je Schritt**, in der Reihenfolge des Tuns. Nicht „Tonart und Kapo ändern", sondern
  zwei Schritte.
- **Erwartet gehört ans Ende**, nicht in jeden Schritt – sonst liest man beim Abhaken doppelt.
- **Konkret statt allgemein**: „Kapo auf 2" statt „Kapo ändern". Beim Nachstellen eines Fehlers zählt
  der genaue Wert.
- **Die Voraussetzung ehrlich nennen**: Braucht der Fall zwei Geräte, ein Lied mit PDF oder ein
  zweites Konto, steht das oben. Sonst bricht man mittendrin ab.
