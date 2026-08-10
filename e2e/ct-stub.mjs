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
    'view songcategory': [1],
    'edit songcategory': [1],
  },
  churchcore: {},
};

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
  if (path === `/api/songs/${SONG.id}`) return json(res, { data: SONG });
  if (path === '/api/songs') return json(res, { data: [] }); // Liederliste: leer genügt
  if (path.startsWith('/api/persons/') && path.endsWith('/groups')) return json(res, { data: [] });
  if (path === '/api/groups') return json(res, { data: [] });
  if (path === '/api/services') return json(res, { data: [] });

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
