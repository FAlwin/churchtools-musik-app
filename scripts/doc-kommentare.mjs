#!/usr/bin/env node
/**
 * Findet **verwaiste Doc-Kommentare**: zwei `/** … *\/`-Blöcke direkt hintereinander.
 *
 * Warum das eine eigene Prüfung verdient: Diese Fehlerklasse entsteht beim Einfügen. Wer eine neue
 * Funktion oder Konstante zwischen einen vorhandenen Doc-Kommentar und die Funktion schiebt, zu der
 * er gehört, hinterlässt eine Beschreibung über dem falschen Code. Nichts wird dabei rot: Der
 * Compiler interessiert sich nicht für Kommentare, Tests erst recht nicht.
 *
 * Am 06.08.2026 fanden sich so **sieben** Stellen im Projekt – die schlimmste beschrieb über
 * `DisintegratingRow` eine ganz andere Komponente. Zwei davon waren beim Aufteilen von
 * `churchtools.ts` (#280) aufgefallen, die übrigen fünf erst durch diesen Scan.
 *
 * Aufruf: `npm run doc-check` – Exit 1, wenn etwas gefunden wird.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const dateien = execSync("git ls-files '*.ts' '*.tsx'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const funde = [];
for (const datei of dateien) {
  const zeilen = readFileSync(datei, 'utf8').split('\n');
  for (let i = 0; i < zeilen.length - 1; i++) {
    const jetzt = zeilen[i].trim();
    const naechste = zeilen[i + 1].trim();
    const endeEinesBlocks = jetzt === '*/' || (jetzt.startsWith('/**') && jetzt.endsWith('*/'));
    if (endeEinesBlocks && naechste.startsWith('/**')) {
      funde.push({ datei, zeile: i + 2 });
    }
  }
}

if (funde.length === 0) {
  console.log(`✓ ${dateien.length} Dateien geprüft – kein verwaister Doc-Kommentar.`);
  process.exit(0);
}

console.error(`✗ ${funde.length} verwaiste Doc-Kommentare:\n`);
for (const f of funde) console.error(`  - ${f.datei}:${f.zeile}`);
console.error(
  '\nZwei Doc-Kommentare direkt hintereinander heißen fast immer: Der obere beschreibt etwas,\n' +
    'das nicht mehr darunter steht. Zum rechtmäßigen Besitzer verschieben – oder löschen, wenn\n' +
    'der Inhalt dort schon dokumentiert ist.',
);
process.exit(1);
