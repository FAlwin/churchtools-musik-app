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
 */
import { readdirSync, readFileSync } from 'node:fs';
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
  `### Von dieser Änderung betroffen (${betroffen.length})`,
  '',
  betroffen.length
    ? 'Ermittelt über das Feld **Betrifft** der Testfälle.'
    : '_Keiner – die Änderung berührt keinen Bereich mit manuellen Testfällen._',
  '',
  ...betroffen.map(zeile),
  '',
  `### Nicht vorgeschlagen: ${uebrig} weitere Fälle`,
  '',
  `Bewusst ausgelassen, weil diese Änderung sie nicht berührt. Ganze Sammlung: \`npm run testplan -- --alle\`.`,
  '',
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
