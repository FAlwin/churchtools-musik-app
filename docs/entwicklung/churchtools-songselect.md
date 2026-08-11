# ChurchTools als Fernbedienung: CCLI SongSelect

> Stand: **11.08.2026**, gemessen an ChurchTools **3.135.2** (ecg-donrath.church.tools).
> Status: **erkundet, noch nicht umgesetzt.** Gehört zu #321/#322.

## Warum diese Seite existiert

In #322 stand: „SongSelect-Import nicht machbar – CCLI gibt die Datenbank nur zertifizierten Partnern
frei." Das ist richtig, beantwortet aber die **falsche Frage**. Es sagt, dass _wir_ nicht direkt bei
CCLI anfragen dürfen.

Alwins Idee (11.08.2026) ist eine andere: **die App als Fernbedienung für ChurchTools.** ChurchTools
ist der zertifizierte Partner, die Gemeinde hat das SongSelect-Abo, und unsere App löst nur aus, was
in der ChurchTools-Oberfläche ohnehin vorhanden ist. Dafür brauchen wir keinen eigenen CCLI-Zugang.

**Die Idee trägt.** Das ist gemessen, nicht geschlossen.

## Was gemessen wurde

| Frage                                      | Antwort                                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| Hat ChurchTools eine SongSelect-Anbindung? | Ja – Suche, Text, Akkorde, ChordPro, Lead-/Vocal-Sheet         |
| Gibt es dafür einen `/api/`-Endpunkt?      | **Nein.** Alle geratenen Pfade 404, keine OpenAPI-Beschreibung |
| Wo liegt sie dann?                         | Im **alten** Modul: `POST /index.php?q=churchservice/ajax`     |
| Kann unser Server das aufrufen?            | **Ja** – er hat Sitzungs-Cookie und CSRF-Token bereits         |
| Recht des Kontos                           | `use ccli: true` (aus `/api/permissions/global`)               |

## Die beiden Aufrufe

Gemeinsam für beide:

```
POST /index.php?q=churchservice/ajax
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Csrf-Token:      <wie bei jedem Schreibvorgang – `getCsrfToken` in ctCsrf.ts>
X-Requested-With: XMLHttpRequest
Cookie:          <ChurchTools-Sitzung>
→ application/json
```

### 1. Abfragen: `getCCLISongData`

```
func=getCCLISongData
songNumber=4328979
browsertabId=1964557953
```

Antwort (äußere Hülle `{"status":"success","data":"<JSON als Zeichenkette>"}`), innen die
SongSelect-Auskunft von CCLI:

```jsonc
{
  "data": {
    "songNumber": 4328979,
    "title": "Treu",
    "authors": ["Tobias Gerster"],
    "copyrights": ["1995 Gerth Medien"],
    "defaultKey": ["E"],
    "alsoKnownAs": ["Du bist Herr (German)", "Feiert Jesus (German)"],
    "themes": ["Acceptance", "Faithfulness", "Friendship"],
    "content": {
      "lyrics": { "exists": true, "isAuthorized": true },
      "chordSheet": { "exists": true, "isAuthorized": true },
      "vocalSheet": { "exists": true, "isAuthorized": true },
      "leadSheet": { "exists": true, "isAuthorized": true },
      "chordPro": { "exists": true, "isAuthorized": true },
    },
  },
}
```

**`isAuthorized` ist das wichtige Feld:** ChurchTools sagt vorher, was die Lizenz der Gemeinde
hergibt. Ein Angebot, das dann doch abgelehnt wird, muss es also nicht geben.

**Nebenwert für #322:** Titel, Autoren, Copyright und Tonart kommen hier mit. Ein neues Lied ließe
sich damit aus der CCLI-Nummer **vorausfüllen**, statt alles abzutippen.

### 2. Holen: `getCCLIChordPro`

```
func=getCCLIChordPro
songNumber=4328979
title=Treu
tonality=E            ← CCLI transponiert beim Herunterladen
arrangementID=27
browsertabId=1964557953
```

ChurchTools holt die Datei bei CCLI und legt sie als `<Titel>.chordpro` ins Arrangement.

**Nicht bestätigt:** Für Text, Akkord-PDF, Lead- und Vocal-Sheet gibt es vermutlich entsprechende
Funktionen (`getCCLILyrics`, …) – **das ist geraten**, nicht gemessen. Wer sie ergänzt, misst sie
vorher; blindes Ausprobieren gegen die Gemeinde-Instanz legt bei jedem Versuch eine Datei an
(siehe unten).

## Was beim Bauen zählt

**Der Aufruf ist NICHT idempotent.** Beim Erkunden entstanden drei gleichnamige `Treu.chordpro` im
selben Arrangement – jeder Klick legt eine weitere an, ChurchTools ersetzt nicht. Unsere Oberfläche
muss deshalb **vorher warnen**, wenn es die Datei schon gibt. Dieselbe Regel gilt bereits für unser
eigenes Hochladen (#321) – die Warnung dort kann übernommen werden.

**Es ist eine undokumentierte interne Schnittstelle.** Sie kann sich mit einem ChurchTools-Update
ohne Ankündigung ändern. Für eine Funktion, die im Gottesdienst gebraucht wird, ist das ein echtes
Risiko:

- der Aufruf gehört **hinter eine eigene Stelle** (`ctSongSelect.ts`), damit eine Änderung genau
  einen Ort betrifft,
- schlägt er fehl, muss die App das **verständlich melden** und darf nicht so tun, als sei nichts
  gewesen,
- eine Anfrage beim ChurchTools-Support nach einem offiziellen Weg ist offen.

**`browsertabId`** ist eine Zahl, die das alte Frontend je Browser-Tab vergibt. Ob der Aufruf sie
zwingend braucht, ist **nicht geprüft** – beim Bauen zuerst ohne versuchen.

**Voraussetzung bei der Gemeinde:** SongSelect-Abo und einmalige Aktivierung in ChurchTools
(System-Einstellungen › Integrationen › CCLI). Bei der ECG Donrath **ist sie aktiv** (11.08.2026).

## Nebenfund: Auto-Reporting

ChurchTools kann eingeplante Lieder **automatisch 7 Tage nach dem Termin an CCLI melden**
(`ccli.auto.reporting`). Das ist unabhängig von unserer App und lohnt einen Blick, falls die Meldung
bisher von Hand läuft.

## Wie das gemessen wurde

- `server/scripts/probe-songselect.ts` – rein lesend, bricht bei 429 ab. Findet die Rechte und
  belegt, dass es unter `/api/` **keinen** SongSelect-Endpunkt gibt.
- Die beiden Aufrufe stammen aus der **Netzwerk-Aufzeichnung von Alwins Browser** in ChurchTools
  selbst; aus dem Code allein waren sie nicht zu finden (das Legacy-Bündel wird nicht ausgeliefert).
