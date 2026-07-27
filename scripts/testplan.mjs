#!/usr/bin/env node
/**
 * Stellt aus der Testfall-Sammlung (`docs/tests/testfaelle/`) einen Testlauf zusammen – nur die
 * Fälle, die diese Änderung betreffen, plus die immer zu prüfenden.
 *
 * Warum überhaupt auswählen: Die Sammlung darf wachsen, ein Lauf nicht. Eine Liste mit 45 Fällen
 * wird abgekürzt, und dann weiß hinterher niemand, was tatsächlich geprüft wurde. Begründung
 * ausführlich in `docs/tests/README.md`.
 *
 *   node scripts/testplan.mjs                      Vorschau im Terminal
 *   node scripts/testplan.mjs --since v2.14.0      anderer Vergleichspunkt
 *   node scripts/testplan.mjs --issue v2.14.3      legt das Testlauf-Issue an (braucht `gh`)
 *   node scripts/testplan.mjs --alle               ganze Sammlung (z. B. vor einem großen Release)
 *   node scripts/testplan.mjs --pruefen            Sammlung gegen den Code prüfen (bei /festhalten)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const WURZEL = path.resolve(import.meta.dirname, '..');
const FALL_DIR = path.join(WURZEL, 'docs/tests/testfaelle');

// ── Argumente ──
const argv = process.argv.slice(2);
const wert = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const alle = argv.includes('--alle');
const pruefen = argv.includes('--pruefen');
const issueVersion = wert('--issue');

/** Alle Testfälle aus den Markdown-Dateien lesen. */
function ladeFaelle() {
  const faelle = [];
  for (const datei of readdirSync(FALL_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()) {
    const text = readFileSync(path.join(FALL_DIR, datei), 'utf8');
    // Ein Fall beginnt mit "### TF-…" und reicht bis zum nächsten "### " oder Dateiende.
    for (const teil of text.split(/^### /m).slice(1)) {
      const kopfzeile = teil.split('\n', 1)[0].trim();
      const [id, ...titelTeile] = kopfzeile.split('·');
      const feld = (name) => teil.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`))?.[1]?.trim();
      faelle.push({
        id: id.trim(),
        titel: titelTeile.join('·').trim(),
        datei,
        prioritaet: (feld('Priorität') ?? 'normal').toLowerCase(),
        betrifft: (feld('Betrifft') ?? '')
          .split(',')
          .map((s) => s.trim().replace(/^`|`$/g, ''))
          .filter(Boolean),
        automatisiert: feld('Automatisiert') ?? '',
        historie: feld('Historie') ?? '',
      });
    }
  }
  return faelle;
}

/** Sehr einfacher Glob: `*` steht für „beliebig, auch /". Reicht für Pfad-Präfixe und `**​/x`. */
function passt(muster, datei) {
  if (!muster.includes('*'))
    return datei === muster || datei.startsWith(muster.replace(/\/$/, '') + '/');
  const re = new RegExp(
    '^' +
      muster
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
  );
  return re.test(datei);
}

/** Letzter Versions-Tag – der übliche Vergleichspunkt. */
function letzterTag() {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], { cwd: WURZEL })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function geaenderteDateien(seit) {
  if (!seit) return null;
  try {
    return execFileSync('git', ['diff', '--name-only', `${seit}...HEAD`], { cwd: WURZEL })
      .toString()
      .split('\n')
      .filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Prüft die Sammlung gegen den Code. Der gefährlichste Fund ist ein **Betrifft**, das auf eine
 * verschobene oder gelöschte Datei zeigt: Der Testfall wird dann NIE wieder vorgeschlagen – ohne
 * Fehlermeldung, ohne dass es jemandem auffällt. Genau die Art stiller Lücke, die diese Sammlung
 * eigentlich verhindern soll.
 */
function pruefeSammlung(faelle) {
  const probleme = [];
  for (const f of faelle) {
    if (!f.betrifft.length) {
      probleme.push(
        `${f.id}: kein »Betrifft« – wird nur noch als kritisch/gar nicht vorgeschlagen`,
      );
      continue;
    }
    for (const m of f.betrifft) {
      if (m.includes('*')) continue; // Muster können auf noch nichts zeigen
      if (!existsSync(path.join(WURZEL, m))) probleme.push(`${f.id}: »${m}« gibt es nicht mehr`);
    }
    if (!['kritisch', 'hoch', 'normal'].includes(f.prioritaet)) {
      probleme.push(`${f.id}: unbekannte Priorität »${f.prioritaet}«`);
    }
    if (!f.historie) probleme.push(`${f.id}: kein »Historie«-Feld (»–« reicht)`);
  }
  const ids = faelle.map((f) => f.id);
  for (const id of ids) {
    if (ids.indexOf(id) !== ids.lastIndexOf(id)) probleme.push(`${id}: Nummer doppelt vergeben`);
  }
  return [...new Set(probleme)];
}

if (pruefen) {
  const probleme = pruefeSammlung(ladeFaelle());
  const anzahl = ladeFaelle().length;
  if (probleme.length === 0) {
    console.log(`✓ ${anzahl} Testfälle geprüft – alle »Betrifft«-Pfade gibt es noch.`);
    process.exit(0);
  }
  console.error(`✗ ${probleme.length} Problem(e) in ${anzahl} Testfällen:\n`);
  for (const p of probleme) console.error(`  - ${p}`);
  console.error(
    '\nEin »Betrifft« auf eine verschobene Datei heißt: Der Fall wird nie wieder vorgeschlagen.',
  );
  process.exit(1);
}

const seit = wert('--since') ?? letzterTag();
const geaendert = alle ? null : geaenderteDateien(seit);
const faelle = ladeFaelle();

// ── Einteilen ──
const immer = faelle.filter((f) => f.prioritaet === 'kritisch');
const istImmer = new Set(immer.map((f) => f.id));
const betroffen = alle
  ? faelle.filter((f) => !istImmer.has(f.id))
  : faelle.filter(
      (f) => !istImmer.has(f.id) && geaendert?.some((d) => f.betrifft.some((m) => passt(m, d))),
    );
const uebrig = faelle.length - immer.length - betroffen.length;

// ── Ausgabe ──
const zeile = (f) =>
  `- [ ] **${f.id}** · ${f.titel}  \n      <sub>${f.datei} · ${f.historie || 'neu'}</sub>`;

const kopf = alle
  ? 'Ganze Sammlung (`--alle`).'
  : geaendert
    ? `Geändert seit \`${seit}\`: **${geaendert.length} Dateien**.`
    : `⚠️ Kein Vergleichspunkt gefunden – es werden nur die kritischen Fälle vorgeschlagen.`;

const teile = [
  `## Testlauf${issueVersion ? ` ${issueVersion}` : ''}`,
  '',
  kopf,
  '',
  `### Immer prüfen (${immer.length})`,
  '',
  'Die Wege, ohne die ein Gottesdienst nicht läuft – unabhängig davon, was geändert wurde.',
  '',
  ...immer.map(zeile),
  '',
  alle
    ? `### Alle übrigen Fälle (${betroffen.length})`
    : `### Von dieser Änderung betroffen (${betroffen.length})`,
  '',
  alle
    ? 'Der Rest der Sammlung, unabhängig von Änderungen.'
    : betroffen.length
      ? 'Ermittelt über das Feld **Betrifft** der Testfälle.'
      : '_Keiner – die Änderung berührt keinen Bereich mit manuellen Testfällen._',
  '',
  ...betroffen.map(zeile),
  '',
  // Bei `--alle` steht die ganze Sammlung da – ein „nicht vorgeschlagen: 0" wäre dort sinnlos.
  ...(alle
    ? []
    : [
        `### Nicht vorgeschlagen: ${uebrig} weitere Fälle`,
        '',
        'Bewusst ausgelassen, weil diese Änderung sie nicht berührt. Ganze Sammlung: `npm run testplan -- --alle`.',
        '',
      ]),
  '---',
  '',
  '**Durchgefallen?** Fehler-Issue anlegen, die Testfall-Nummer in den Titel, hier verlinken und das',
  'Häkchen leer lassen. Die Sammlung liegt in [`docs/tests/`](../blob/main/docs/tests/README.md).',
];
const ausgabe = teile.join('\n');

if (issueVersion) {
  const titel = `Testlauf ${issueVersion}`;
  execFileSync(
    'gh',
    ['issue', 'create', '--title', titel, '--body', ausgabe, '--label', 'typ:test'],
    {
      cwd: WURZEL,
      stdio: 'inherit',
    },
  );
} else {
  console.log(ausgabe);
  console.log(
    `\n(${immer.length} immer + ${betroffen.length} betroffen von ${faelle.length} gesamt)`,
  );
}
