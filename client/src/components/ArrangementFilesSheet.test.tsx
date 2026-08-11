// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ArrangementFileEntry } from '@shared/types/index';
import { ArrangementFilesSheet } from './ArrangementFilesSheet';

/**
 * #321, Schritt 3: Die Dateiliste eines Arrangements.
 *
 * Der Schwerpunkt liegt auf den **drei leeren Fällen**, die sich für den Nutzer völlig verschieden
 * anfühlen und deshalb nicht gleich aussehen dürfen: „wird geladen", „konnte nicht laden" und
 * „wirklich keine Dateien". Eine stumme leere Liste ist in allen drei Fällen eine Sackgasse – genau
 * das ist an anderer Stelle schon einmal aufgefallen (#198, `SharersSheet`).
 *
 * Dazu die Zusage aus der Entscheidung: **Die Liste ist flach und zeigt ALLES**, auch was die App
 * bisher nirgends anzeigte.
 */
const DATEIEN: ArrangementFileEntry[] = [
  { fileId: 1, name: 'Treu.chordpro', size: 2048, kind: 'chordpro-original' },
  { fileId: 2, name: 'Treu — Akustik (App).chordpro', size: 1024, kind: 'chordpro-version' },
  { fileId: 3, name: 'Treu - E.pdf', size: 412 * 1024, kind: 'pdf' },
  { fileId: 4, name: 'probe.mp3', size: null, kind: 'other' },
];

function setup(over: Partial<Parameters<typeof ArrangementFilesSheet>[0]> = {}) {
  const onDownload = vi.fn();
  render(
    <ArrangementFilesSheet
      arrangementName="Test"
      files={DATEIEN}
      laedt={false}
      angehalten={false}
      fehler={null}
      onDownload={onDownload}
      onClose={vi.fn()}
      {...over}
    />,
  );
  return { onDownload };
}

afterEach(cleanup);

describe('ArrangementFilesSheet – die flache Liste', () => {
  it('zeigt ALLE Dateien, auch die bisher unsichtbaren', () => {
    setup();
    for (const d of DATEIEN) expect(screen.getByText(d.name)).toBeTruthy();
  });

  it('nennt das Arrangement im Titel – sonst ist unklar, wessen Dateien man sieht', () => {
    setup();
    expect(screen.getByText('Dateien – Test')).toBeTruthy();
  });

  it('sagt bei jeder Datei, was sie IST', () => {
    setup();
    // Der Zusatz ist der einzige Hinweis darauf, dass das Original-ChordPro das Notenblatt trägt.
    // Ohne ihn sähen vier Klassen gleich aus, und die flache Liste wäre eine Falle.
    expect(screen.getByText(/ChordPro – daraus entsteht das Notenblatt/)).toBeTruthy();
    expect(screen.getByText(/ChordPro – von der App verwaltete Version/)).toBeTruthy();
    expect(screen.getByText(/^PDF · 412 KB$/)).toBeTruthy();
  });

  it('zeigt eine unbekannte Größe als Gedankenstrich', () => {
    setup();
    expect(screen.getByText('Datei · –')).toBeTruthy();
  });

  it('meldet die angetippte Datei vollständig zurück', () => {
    const { onDownload } = setup();
    screen.getByText('Treu - E.pdf').click();
    expect(onDownload).toHaveBeenCalledWith(DATEIEN[2]);
  });
});

describe('ArrangementFilesSheet – die drei leeren Fälle sehen verschieden aus', () => {
  it('lädt: sagt, dass geladen wird', () => {
    setup({ laedt: true, files: [] });
    expect(screen.getByText('Dateien werden geladen …')).toBeTruthy();
    expect(screen.queryByText('In diesem Arrangement liegen keine Dateien.')).toBeNull();
  });

  it('Fehlschlag: nennt ihn, statt „keine Dateien" zu behaupten', () => {
    // Das ist der wichtigste der drei: „konnte nicht laden" als „keine Dateien" darzustellen wäre
    // eine falsche Aussage über ChurchTools – man würde anfangen, die fehlende Datei zu suchen.
    setup({ files: [], fehler: 'Die Dateien konnten nicht geladen werden.' });
    expect(screen.getByText('Die Dateien konnten nicht geladen werden.')).toBeTruthy();
    expect(screen.queryByText('In diesem Arrangement liegen keine Dateien.')).toBeNull();
  });

  it('wirklich leer: sagt es ausdrücklich', () => {
    setup({ files: [] });
    expect(screen.getByText('In diesem Arrangement liegen keine Dateien.')).toBeTruthy();
  });

  it('angehalten: nennt die fehlende Verbindung, statt endlos „wird geladen" zu zeigen', () => {
    // Beim Durchklicken gemessen (11.08.2026): React Query hält den zweiten Versuch an, wenn der
    // Server als unerreichbar gilt – `isPending` bleibt dann für immer true, ein Fehler entsteht
    // NIE. Ohne diesen Fall stand „Dateien werden geladen …" endlos da.
    setup({ files: [], laedt: true, angehalten: true });
    expect(
      screen.getByText(/Keine Verbindung zum Server\. Die Dateien erscheinen, sobald/),
    ).toBeTruthy();
    expect(screen.queryByText('Dateien werden geladen …')).toBeNull();
  });

  it('angehalten schlägt auch die leere Liste – „keine Dateien" wäre eine falsche Aussage', () => {
    setup({ files: [], angehalten: true });
    expect(screen.queryByText('In diesem Arrangement liegen keine Dateien.')).toBeNull();
  });

  it('bei einem Fehlschlag wird keine halbe Liste gezeigt', () => {
    // Sonst hielte man den Rest für vollständig.
    setup({ fehler: 'Fehlgeschlagen.' });
    expect(screen.queryByText('Treu.chordpro')).toBeNull();
  });
});
