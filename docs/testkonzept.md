# Testkonzept

Bewusst **schlank** gehalten: Die App hat keine eigene DB, und der größte Teil
(UI, Express-Proxy) ist schnell manuell prüfbar. Automatisiert getestet wird gezielt
die **reine Logik, die man von Hand kaum vollständig durchprüfen kann** – Transponieren
über alle Tonarten und der ChordPro-Parser mit seinen zwei Dialekten.

## Umfang
| Ebene        | Status | Tool    | Ort |
|--------------|--------|---------|-----|
| Unit (Logik) | aktiv  | Vitest  | `client/src/utils/*.test.ts` |
| Integration/API | bewusst nicht | – | Proxy manuell + über echte Daten geprüft |
| E2E          | bewusst nicht | – | Kern-Flow manuell im Gottesdienst-Betrieb |

**Befehle:** `npm test` (alle), `npm run test:cov` (mit Coverage),
`npm run test:watch` (Watch-Modus, im Client).

## Getestete Logik

### `transpose.ts` – Transponieren
- Einfache Dur-/Moll-Akkorde, Suffix-Erhalt (m7, sus4)
- Bass-Akkorde (Root **und** Bass transponiert, z. B. `E/G#`)
- b- vs. #-Schreibweise (`flat`-Flag)
- Optionale Akkorde in Klammern `(E)` (SongSelect-Dialekt)
- Oktav-Umlauf (B → C)
- Robustheit: leere Eingabe, unbekannter Root (deutsche Notation „H")
- `getSemitoneOffset` (aufwärts umwickelnd, Moll-Suffix ignoriert)
- `shiftKey` (Dur/Moll-Erhalt), Tonart-Listen vollständig (12/12)

### `chordpro.ts` – Parser (zwei Dialekte)
- `parseLine`: Text ohne Akkorde, führender Text, Akkord am Zeilenanfang, leere `[]`
- Standard-Dialekt: `start_of/end_of`-Blöcke, Kurzform `{chorus: 2}`,
  Typ-Normalisierung (`pre-chorus` → `pre_chorus`)
- SongSelect-Dialekt: `{comment: …}` → Typableitung, deutsche/englische Labels
- Sonderfälle: impliziter Vers, Metadaten überspringen, leere Abschnitte verwerfen,
  nachlaufende Leerzeilen entfernen
- `parseMetadata`: bekannte Felder lesen, unbekannte ignorieren

## Regel für neue Fehler
Jeder gefundene Bug bekommt **(a)** ein GitHub-Issue (Vorlage „Fehlerbericht") und,
wenn er reine Logik betrifft, **(b)** einen Regressionstest, der nach dem Fix grün ist.
