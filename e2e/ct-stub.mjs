/**
 * ChurchTools-Stub für den E2E-Auth-Flow (#174).
 *
 * Warum: Der Server ist im Kern ein Proxy zu ChurchTools. Ohne Gegenstelle lässt sich im CI genau der
 * Weg nicht prüfen, der im Gottesdienst zählt – Anmelden, Termin öffnen, Chart sehen, anmerken,
 * abgleichen. Der vorhandene Render-Smoke (`?demo=chart`) mountet die Chart-Ansicht ohne Backend und
 * sagt über Login, Rechte und Sync nichts.
 *
 * Bewusst ein eigenes kleines Skript und kein Mock im Testprozess: So läuft der **echte** Server mit
 * seiner echten Session-, Rechte- und Proxy-Logik gegen etwas, das sich wie ChurchTools verhält. Nur
 * die Endpunkte, die der Flow wirklich anfasst – wächst der Bedarf, wächst diese Datei.
 *
 * Start: `node e2e/ct-stub.mjs` (Port über `PORT`, Standard 4599).
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 4599);
const SESSION = 'ChurchTools_stubsid=abc123';
const PERSON = { id: 4711, firstName: 'Test', lastName: 'Musiker' };

/** Abwesenheiten (#177): eine manuelle (ohne Marker) liegt vor, damit das Schloss zu sehen ist. */
let absenceId = 9000;
const ABSENCES = [
  {
    id: ++absenceId,
    personId: PERSON.id,
    startDate: '2099-12-24',
    endDate: '2099-12-26',
    comment: 'Weihnachten',
    absenceReason: { id: 3, name: 'Urlaub' },
  },
];

/** Ein Lied mit Arrangement + ChordPro-Datei. Die Datei-ID taucht in der fileUrl auf. */
const SONG = {
  id: 501,
  name: 'Testlied aus ChurchTools',
  author: 'Stub-Autor',
  ccli: null,
  arrangements: [
    {
      id: 9001,
      name: 'Standard',
      isDefault: true,
      key: 'G',
      keyOfArrangement: 'G',
      bpm: 72,
      beat: '4/4',
      files: [
        {
          name: 'Testlied aus ChurchTools.chordpro',
          fileUrl: `http://localhost:${PORT}/?q=public/filedownload&id=77001`,
        },
      ],
    },
    // Zweites Arrangement (#320): Ohne eines liesse sich das Umschalten nicht pruefen – und die
    // Auswahl erscheint absichtlich erst ab zwei. Eigene Tonart und eigene Datei, damit im Test
    // sichtbar ist, DASS das andere Blatt geladen wurde und nicht nur der Name wechselte.
    {
      id: 9002,
      name: 'Unplugged',
      isDefault: false,
      key: 'D',
      keyOfArrangement: 'D',
      bpm: 96,
      beat: '3/4',
      files: [
        {
          name: 'Testlied aus ChurchTools.chordpro',
          fileUrl: `http://localhost:${PORT}/?q=public/filedownload&id=77002`,
        },
      ],
    },
  ],
};

const CHORDPRO_UNPLUGGED = `{title: Testlied aus ChurchTools}
{key: D}

{comment: Vers 1 Unplugged}
[D]Leise Zeile aus dem [A]Stub
`;

const CHORDPRO = `{title: Testlied aus ChurchTools}
{key: G}

{comment: Vers 1}
[G]Erste Zeile aus dem [C]Stub
[D]Zweite Zeile mit [G]Akkorden

{comment: Refrain}
[C]Hier singt die [G]Gemeinde
`;

const EVENT_ID = 1500;
const events = [
  {
    id: EVENT_ID,
    startDate: isoInDays(2),
    name: 'Gottesdienst (Stub)',
    calendar: { domainIdentifier: '1' },
    appointmentId: null,
  },
];

const agenda = {
  items: [
    { id: 1, title: 'Begrüßung', type: 'normal', duration: 300, startTimes: {} },
    {
      id: 2,
      title: 'Lied',
      type: 'song',
      duration: 300,
      startTimes: {},
      song: {
        songId: SONG.id,
        arrangementId: 9001,
        title: 'Lied',
        arrangement: 'Standard',
        key: 'G',
        bpm: 72,
      },
    },
  ],
};

/**
 * Datum RELATIV zu heute. Die App fragt Termine im Fenster -7d…+42d ab – ein festes Datum fiele je
 * nach Testzeitpunkt heraus und der Termin würde nie erscheinen (genau das ist beim Bauen passiert).
 */
function isoInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

/** Alle Rechte, die die App auswertet – der Stub-Nutzer darf alles außer administrieren. */
const permissions = {
  churchservice: {
    'view agenda': [1],
    'edit agenda': [1],
    'view songcategory': [0, 1],
    'edit songcategory': [0, 1],
    // Ohne dieses Recht meldet der Server `canUseCcli: false` und der Reiter „SongSelect" (#378)
    // erschiene nie – dann liesse sich der Umschalter nicht durchklicken.
    'use ccli': [1],
  },
  churchcore: {},
};

/**
 * Die alte churchservice-Schnittstelle (`POST /index.php?q=churchservice/ajax`) – **so weit, wie der
 * Quellen-Umschalter sie braucht** (#378).
 *
 * `data` hat je Funktion eine andere Form, und das ist keine Erfindung des Stubs, sondern gemessen
 * (siehe `ctAjax.ts`): Bei SongSelect ist `data` eine **Zeichenkette** mit JSON darin, bei
 * `getMasterData` direkt ein Objekt. Ein Stub, der das glättet, würde genau den Fehler verdecken, den
 * die Grenze zu ChurchTools produziert.
 */
const CCLI_TREFFER = [
  {
    songNumber: 5841527,
    title: 'Stub-Lied bei SongSelect',
    authors: ['CCLI-Autor A', 'CCLI-Autor B'],
    defaultKey: ['E'],
    isPublicDomain: false,
    content: { ChordPro: {}, Lyrics: {} },
  },
  {
    songNumber: 7654321,
    title: 'Stub-Lied bei SongSelect (andere Fassung)',
    authors: ['CCLI-Autor C'],
    defaultKey: ['G'],
    isPublicDomain: true,
    content: { Lyrics: {} },
  },
];

function ajaxAntwort(func) {
  if (func === 'getMasterData') {
    // Kategorien: alles als Zeichenkette, Name als `bezeichnung` – so liefert es das alte Modul.
    return {
      status: 'success',
      data: {
        songcategory: [
          { id: '0', bezeichnung: 'Aktive Songs', sortkey: '0' },
          { id: '1', bezeichnung: 'Inaktive Songs', sortkey: '1' },
        ],
      },
    };
  }
  if (func === 'getCCLISongsMatchingTitle') {
    return {
      status: 'success',
      // Absichtlich mehr `totalItems` als Treffer: So ist der Hinweis „such genauer" sichtbar.
      data: JSON.stringify({
        pagination: { totalItems: 147 },
        data: { results: CCLI_TREFFER },
      }),
    };
  }
  if (func === 'getCCLISongData') {
    return {
      status: 'success',
      data: JSON.stringify({
        data: { ...CCLI_TREFFER[0], copyrights: ['© 2019 Stub-Verlag'] },
      }),
    };
  }
  /**
   * Der Liedtext (#381) – **in der Form, die am 14.08.2026 gemessen wurde**: strukturiert in
   * `lyricParts` mit `partLabel`, dazu `disclaimer`. Der Disclaimer ist hier absichtlich dabei: Er
   * MUSS angezeigt werden, und ohne ihn im Stub liesse sich das nicht durchklicken.
   */
  if (func === 'getCCLILyrics') {
    return {
      status: 'success',
      data: JSON.stringify({
        data: {
          type: 'songLyrics',
          songNumber: CCLI_TREFFER[0].songNumber,
          title: CCLI_TREFFER[0].title,
          authors: CCLI_TREFFER[0].authors,
          copyrights: ['© 2019 Stub-Verlag'],
          disclaimer:
            'For use solely with the SongSelect Terms of Use. All rights reserved. www.ccli.com',
          lyricParts: [
            { partLabel: 'Vers 1', partType: 'Verse', lyrics: 'Erste Zeile vom Stub-Vers,\nzweite Zeile.' },
            { partLabel: 'Chorus 1', partType: 'Chorus', lyrics: 'Stub-Refrain,\nHalleluja!' },
            // Ein Abschnitt ohne Text – er darf NICHT als leere Überschrift erscheinen.
            { partLabel: 'Bridge', partType: 'Bridge', lyrics: '   ' },
          ],
        },
      }),
    };
  }
  return null;
}

function json(res, body, status = 200, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  // Datei-Download (ChordPro) – ChurchTools liefert das über einen Query-Pfad aus.
  if (url.searchParams.get('q') === 'public/filedownload') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    // Datei 77002 gehoert zum zweiten Arrangement und hat einen anderen Text: So belegt der Test,
    // dass beim Umschalten wirklich ein anderes Blatt geladen wird.
    res.end(url.searchParams.get('id') === '77002' ? CHORDPRO_UNPLUGGED : CHORDPRO);
    return;
  }

  // Die alte churchservice-Schnittstelle: Kategorien und SongSelect (#378).
  if (path === '/index.php' && url.searchParams.get('q') === 'churchservice/ajax') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const func = new URLSearchParams(body).get('func') ?? '';
      const antwort = ajaxAntwort(func);
      if (antwort) return json(res, antwort);
      console.warn(`[ct-stub] ajax-Funktion nicht abgedeckt: ${func}`);
      json(res, { status: 'error', message: `stub: ${func} nicht abgedeckt` });
    });
    return;
  }

  if (path === '/api/login' && req.method === 'POST') {
    // Der Stub prüft nichts – falsche Zugangsdaten sind ein eigener Testfall am echten CT.
    json(res, { data: PERSON }, 200, { 'Set-Cookie': `${SESSION}; Path=/; HttpOnly` });
    return;
  }
  if (path === '/api/logout') return json(res, { data: {} });
  if (path === '/api/whoami') return json(res, { data: PERSON });
  if (path === '/api/csrftoken') return json(res, { data: 'stub-csrf-token' });
  if (path === '/api/permissions/global') return json(res, { data: permissions });
  if (path === '/api/events') return json(res, { data: events });
  if (path === `/api/events/${EVENT_ID}/agenda`) return json(res, { data: agenda });
  /**
   * Die Liederliste. **Nicht mehr leer** (#378): Sie ist die Quelle „Bibliothek" und liefert dem
   * Liedtext-Index die ChordPro-Datei – ohne ein Lied darin liesse sich der Umschalter nicht anfassen.
   * Die Kategorie muss mit, sonst kennt die App das Lied ohne Zuordnung.
   */
  if (path === '/api/songs') {
    // Mit CCLI-Nummer, damit die Bibliothekssuche nach der Nummer prüfbar ist (#378). Bewusst eine
    // ANDERE als die SongSelect-Treffer des Stubs – sonst wäre nicht zu sehen, welche Quelle gefunden hat.
    return json(res, {
      data: [{ ...SONG, ccli: '1234567', category: { id: 0, name: 'Aktive Songs' } }],
    });
  }
  // Mitgliedschaft im „Musikteam" (Gruppe 9, Rolle 1). Wirkt nur, wenn die site.json des Servers die
  // Gruppe 9 unter musicianGroupIds führt – die E2E-Läufe tun das nicht (Standard leer), der lokale
  // Durchklick der Verfügbarkeit (#177) schon.
  if (path.startsWith('/api/persons/') && path.endsWith('/groups')) {
    return json(res, {
      data: [{ group: { domainIdentifier: '9' }, groupTypeRoleId: 1, groupMemberStatus: 'active', memberEndDate: null }],
    });
  }
  // Abwesenheiten (#177) – ein kleiner Speicher im Prozess, damit Anlegen/Löschen sichtbar wird.
  const absMatch = path.match(/^\/api\/persons\/(\d+)\/absences(?:\/(\d+))?$/);
  if (absMatch) {
    const personId = Number(absMatch[1]);
    if (req.method === 'GET') {
      return json(res, { data: ABSENCES.filter((a) => a.personId === personId) });
    }
    if (req.method === 'POST') {
      // Der Handler ist synchron – den Rumpf deshalb über die Ereignisse lesen.
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const neu = JSON.parse(body || '{}');
        const eintrag = {
          id: ++absenceId,
          personId,
          startDate: neu.startDate,
          endDate: neu.endDate,
          comment: neu.comment ?? null,
          absenceReason: { id: neu.absenceReasonId, name: 'Abwesend' },
        };
        ABSENCES.push(eintrag);
        res.statusCode = 201;
        json(res, { data: { id: eintrag.id } });
      });
      return;
    }
    if (req.method === 'DELETE' && absMatch[2]) {
      const idx = ABSENCES.findIndex((a) => a.id === Number(absMatch[2]));
      if (idx >= 0) ABSENCES.splice(idx, 1);
      res.statusCode = 204;
      return res.end();
    }
  }
  if (path === '/api/groups') return json(res, { data: [] });
  if (path === '/api/services') return json(res, { data: [] });

  // Datei-Upload an ein Arrangement und Löschen einer Datei – der Editor nach dem Anlegen schreibt das
  // Original-Notenblatt darüber (04.09.2026). Der Stub bestätigt nur; was hochgeladen wurde, prüft der
  // Server-Test am protokollierten fetch.
  if (path.startsWith('/api/files/song_arrangement/') && req.method === 'POST') {
    return json(res, { data: [] });
  }
  if (path.startsWith('/api/files/') && req.method === 'DELETE') return json(res, { data: {} });
  // Einzelnes Lied (getArrangement liest es vor dem Schreiben, das Stammdaten-Blatt zeigt es an). MIT
  // Kategorie – ohne sie zeigt das Stammdaten-Blatt nur den Hinweis statt des Formulars. Stand hier
  // zweimal (einmal ohne Kategorie, der Treffer davor schattete diesen ab) – die klassische Dopplung.
  if (/^\/api\/songs\/\d+$/.test(path)) {
    return json(res, { data: { ...SONG, ccli: '1234567', category: { id: 0, name: 'Aktive Songs' } } });
  }

  // Alles Übrige laut protokollieren, statt still 404 zu liefern – so fällt beim Erweitern des
  // Flows sofort auf, welcher Endpunkt noch fehlt.
  console.warn(`[ct-stub] nicht abgedeckt: ${req.method} ${req.url}`);
  json(res, { message: 'stub: not found' }, 404);
});

server.listen(PORT, () => console.log(`[ct-stub] läuft auf http://localhost:${PORT}`));

// Sauber beenden, wenn Playwright den Prozess stoppt: Ohne das halten untätige Keep-Alive-
// Verbindungen den Stub am Leben und der CI-Job hängt nach den Tests.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.closeIdleConnections();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
}
