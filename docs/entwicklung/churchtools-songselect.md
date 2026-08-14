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
| Hat ChurchTools eine SongSelect-Anbindung? | Ja – Suche nach Titel, Abfrage per Nummer, Download            |
| Gibt es dafür einen `/api/`-Endpunkt?      | **Nein.** Alle geratenen Pfade 404, keine OpenAPI-Beschreibung |
| Wo liegt sie dann?                         | Im **alten** Modul: `POST /index.php?q=churchservice/ajax`     |
| Kann unser Server das aufrufen?            | **Ja** – er hat Sitzungs-Cookie und CSRF-Token bereits         |
| Recht des Kontos                           | `use ccli: true` (aus `/api/permissions/global`)               |

## Die drei Aufrufe

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

### 2. Holen: `getCCLIChordPro` – **liefert TEXT, legt keine Datei an**

```
func=getCCLIChordPro
songNumber=4328979
title=Treu
tonality=E            ← CCLI transponiert beim Herunterladen
arrangementID=27
browsertabId=1964557953
```

**Achtung, hier lag mein teuerster Irrtum (11.08.2026).** Der Aufruf sieht in der Oberfläche so aus,
als lege er die Datei an – **er tut es nicht.** Er gibt den ChordPro-**Text** zurück; die
ChurchTools-Oberfläche lädt ihn danach selbst hoch.

Die Antwort ist hier **anders verpackt** als bei Suche und Abfrage: `data` ist ein Objekt
`{ success, content }`, und erst `content` ist die Zeichenkette mit der CCLI-Antwort:

```jsonc
{
  "data": {
    "type": "songChordPro",
    "songNumber": 4328979,
    "title": "Treu",
    "copyright": ["1995 Gerth Medien"],
    "chordPro": "{title: Treu}\n{key: E}\n…",
  },
}
```

Der Text trägt die Tonart selbst (`{key: E}`) – CCLI transponiert ihn nach `tonality`.

**Was das für uns heißt (und warum es besser ist):** Wir laden die Datei **selbst** hoch, über
`uploadFile` – unsere eigene geprüfte Stelle. Damit liegt der Dateiname in unserer Hand, und die
Reihenfolge „erst die neue Datei, dann die alte weg" ist eine echte Zusage statt einer Hoffnung.

**Was passiert, wenn man es nicht weiß:** Genau das ist mir passiert. Der Aufruf meldete
`status: success`, es entstand nichts, und mein Ablauf löschte danach das vorhandene Notenblatt.
Bei der ECG standen daraufhin zwei Arrangements ohne Blatt da – während die App „Notenblatt aus
SongSelect geholt" meldete. **Ein Erfolgssignal ist kein Beleg dafür, dass etwas entstanden ist.**

**Nachgemessen am 13.08.2026** (`probe-songsuche.ts`, streng lesend) – der frühere Satz „das ist
geraten" gilt für zwei der drei Fragen nicht mehr:

| Funktion                      | Befund                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getCCLILyrics`               | **existiert und ist am 14.08.2026 vollständig gemessen** – Parameter `songNumber`, Antwortform unten. (Am 13.08. ging der Aufruf nur bis `api.ccli.com/ss/v2/songs//lyrics` und scheiterte an der fehlenden ID.)                                       |
| Textsuche bei CCLI            | **gibt es nicht** – acht naheliegende Namen abgelehnt: `getCCLISongsMatchingLyrics`, `…MatchingText`, `…MatchingContent`, `…MatchingAuthor`, `…Matching`, `searchCCLISongs`, `getCCLISongs`. Antwort jeweils `Function … was not defined as Function!` |
| Akkord-PDF, Lead-/Vocal-Sheet | weiterhin **nicht gemessen** – wer sie ergänzt, misst vorher.                                                                                                                                                                                          |

**Folge für die Suche im Liedtext:** Sie ist über CCLI nicht möglich. Auch ChurchTools kann es nicht –
`/api/songs?query=…` filtert nur Stammdaten (Wort aus dem Liedtext: 0 Treffer, dasselbe Wort aus dem
Titel: 1 Treffer, Gegenprobe). Deshalb baut unser Server einen eigenen Index über die ChordPro-Dateien
(`songTextIndex.ts`).

**Nebenbefund für künftige Erkundungen:** Die alte Schnittstelle braucht ein **Sitzungs-Cookie**, kein
Login-Token. Mit reinem Token antwortet ChurchTools mit einer Weiterleitung auf die Anmeldeseite – das
erste Erkundungsskript lief deshalb in „redirect count exceeded". Der Token lässt sich über
`GET /api/whoami?login_token=…` in eine Sitzung einlösen; die Antwort setzt das Cookie.

Blindes Ausprobieren gegen die Gemeinde-Instanz bleibt tabu: Ein Abruf legt dort eine Datei an, und die
Nutzung wird bei CCLI vermutlich vermerkt.

> ⚠️ **„wird bei CCLI vermerkt" ist eine ANNAHME, keine Messung** (nachgeprüft am 14.08.2026). Dieser Satz
> stand hier ohne Beleg. Er ist plausibel und die Vorsicht bleibt richtig – aber wer ihn zitiert, zitiert
> keine Messung. **Belastbar wäre nur:** die Nutzungs-/Download-Historie im SongSelect-Konto der Gemeinde
> oder eine Auskunft von CCLI bzw. dem ChurchTools-Support. Über die Schnittstelle ist die Frage
> grundsätzlich **nicht** beantwortbar: Eine Verbuchung passiert bei CCLI und müsste sich in der Antwort
> nicht spiegeln.

### 4b. Liedtext holen: `getCCLILyrics` — gemessen am 14.08.2026

`server/scripts/probe-ccli-lyrics.ts`, streng lesend, **ein** Abruf für **eine** Nummer.

```
func=getCCLILyrics
songNumber=4336851
```

Parameter ist **`songNumber`** (nicht die interne `songID`); `ccliNumber`, `songId` und `id` wurden nicht
gebraucht, weil der erste Name traf. Die Antwort trägt die drei bekannten Ebenen
(`{status,data}` → `{success,content}` → JSON-String) und darin:

| Feld         | Inhalt (gemessen an „All die Fülle ist in dir")                                      |
| ------------ | ------------------------------------------------------------------------------------ |
| `type`       | `songLyrics`                                                                         |
| `songID`     | interne CCLI-UUID                                                                    |
| `songNumber` | `4336851`                                                                            |
| `title`      | `All die Fülle ist in dir`                                                           |
| `cclid`      | `2395145`                                                                            |
| `authors`    | `["Norbert Jagode"]`                                                                 |
| `copyrights` | `["2001 Gerth Medien"]`                                                              |
| `disclaimer` | `For use solely with the SongSelect Terms of Use. All rights reserved. www.ccli.com` |
| `lyricParts` | Liste mit `partLabel` („Vers 1", „Chorus 1"), `partType`, `partTypeNumber`, `lyrics` |

🔴 **`disclaimer` MUSS angezeigt werden.** CCLI liefert ihn mit jedem Text mit – das ist eine
Lizenzbedingung, keine Beigabe. Er geht deshalb bis in die Oberfläche durch (`LiedVorschau`).

**Kein Feld deutet auf eine Verbuchung hin** – gesucht wurde nach `report`, `usage`, `logged`, `licence`,
`count`, `billing`, `track`, `quota`. Das ist **kein Beweis**, nur kein Indiz dafür (siehe den Kasten
oben). **Die Vorkehrung in der App ist deshalb strukturell:** Der Abruf passiert nur, wenn jemand einen
Treffer bewusst öffnet – nie beim Durchsehen einer Liste –, und das Ergebnis bleibt je Nummer
zwischengespeichert (`useSongSelectLiedtext`, `staleTime: Infinity`). Damit ist die Zahl der Abrufe die
Zahl der wirklich angesehenen Lieder.

### 3. Suchen: `getCCLISongsMatchingTitle`

```
func=getCCLISongsMatchingTitle
songTitle=Wo ich auch stehe
browsertabId=1964557953
```

Antwort wie oben verpackt; innen eine Trefferliste:

```jsonc
{
  "pagination": { "pageSize": 100, "pageNumber": 1, "totalItems": 147, "lastPage": 2 },
  "data": {
    "type": "searchResults",
    "results": [
      {
        "title": "Wo ich auch stehe",
        "songNumber": 4330228,
        "authors": ["Albert Frey"],
        "defaultKey": ["C"], // kann leer sein
        "transposeKeyList": "majorKeys",
        "isPublicDomain": false,
        "content": {
          /* wie oben: exists + isAuthorized je Format */
        },
      },
    ],
  },
}
```

**Die Suche ist unscharf und großzügig.** „Wo ich auch stehe" ergab **147** Treffer, darunter viel
Unverwandtes – gesucht wird offenbar über den ganzen CCLI-Katalog, nicht nur über den Titelanfang.
Die Trefferliste in unserer App muss deshalb **die Unterscheidungsmerkmale zeigen**, mit denen man
den richtigen findet: Titel, Autoren, Nummer und was verfügbar ist. Genau das macht ChurchTools auch
(Spalten „Texte" und „Akkorde" mit ✓/✗).

**Blättern ist ungeklärt.** ChurchTools holt Seite 1 mit 100 Einträgen; ein Parameter dafür war in
der Nutzlast **nicht** zu sehen. Ob und wie sich Seite 2 holen lässt, ist nicht gemessen. Für die
App heißt das zunächst: die ersten 100 zeigen und zum Verfeinern der Suche raten – nicht so tun, als
wäre die Liste vollständig.

**Suchen ändert nichts.** Anders als das Herunterladen ist dieser Aufruf gefahrlos wiederholbar.

## Was beim Bauen zählt

**Der Aufruf ist NICHT idempotent.** Beim Erkunden entstanden drei gleichnamige `Treu.chordpro` im
selben Arrangement – jeder Klick legt eine weitere an, ChurchTools ersetzt nicht. Unsere Oberfläche
muss deshalb **vorher warnen**, wenn es die Datei schon gibt. Dieselbe Regel gilt bereits für unser
eigenes Hochladen (#321) – die Warnung dort kann übernommen werden.

**Die Tonart steckt IN der Datei – und pro Arrangement gehört genau EINE hin.** Gemessen am
11.08.2026: CCLI transponiert beim Herunterladen und schreibt `{key: …}` in das ChordPro. Dasselbe
Lied „Treu" liegt bei der ECG in zwei Arrangements –

| Arrangement          | Tonart | in der Datei | erste Akkorde |
| -------------------- | ------ | ------------ | ------------- |
| Standard-Arrangement | E      | `key=E`      | E F#m7 A B    |
| Test                 | D      | `key=D`      | D Em7 G A     |

– und der Download nimmt automatisch die Tonart **des jeweiligen Arrangements**. Verschiedene
Tonarten gehören also in verschiedene **Arrangements**, nicht nebeneinander in eines.

**Warum zwei ChordPro im selben Arrangement gefährlich sind:** Beide heißen `<Titel>.chordpro`, und
`setlistBuilder` sucht das Notenblatt mit `arr.files.find(isOriginalChordpro)` – **die erste
gewinnt**, welche das ist, entscheidet die Reihenfolge von ChurchTools. Weil die Datei ihre Tonart
selbst mitbringt und bei uns Vorrang vor den ChurchTools-Angaben hat (#236), könnte das Blatt still
auf eine andere Fassung **und eine andere Tonart** springen. Nichts kracht, es ist nur plötzlich
anders.

Deshalb beim Holen: Ist im Arrangement schon ein ChordPro, wird **gefragt und ersetzt** (altes
löschen, neues holen) – nicht danebengelegt.

**Es ist eine undokumentierte interne Schnittstelle.** Sie kann sich mit einem ChurchTools-Update
ohne Ankündigung ändern. Für eine Funktion, die im Gottesdienst gebraucht wird, ist das ein echtes
Risiko:

- der Aufruf gehört **hinter eine eigene Stelle** (`ctAjax.ts`), damit eine Änderung genau
  einen Ort betrifft – seit #322/Schritt 7 ein eigenes Modul, weil die Lied-Kategorien ein zweiter
  Nutzer derselben Schnittstelle sind; die CCLI-Aufrufe selbst liegen weiter in `ctSongSelect.ts`,
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
