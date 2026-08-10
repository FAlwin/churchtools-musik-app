// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { arrangementKopien, arrangementMigrationAnwenden } from './arrangementMigration';
import { ANNO_DRAW_NS, ANNO_ZOOM_NS, songPageKey } from '@shared/keys/index';

/**
 * Hier hängt der Bestand an handgezeichneten Notizen dran. Die Tests prüfen deshalb vor allem, was
 * **nicht** passieren darf: nichts überschreiben, nichts vergessen, nichts an ein fremdes Lied
 * hängen.
 *
 * Die Schlüssel werden mit `songPageKey` ERZEUGT und nicht hingeschrieben – sonst bliebe der Test
 * bei einer Drift der Grammatik grün, also genau bei dem Fehler, den er festhalten soll.
 */
const draw = (...a: Parameters<typeof songPageKey>) => ANNO_DRAW_NS + songPageKey(...a);
const zoom = (...a: Parameters<typeof songPageKey>) => ANNO_ZOOM_NS + songPageKey(...a);

describe('arrangementKopien – was kopiert wird', () => {
  it('schlägt Bestandsnotizen dem geltenden Arrangement zu', () => {
    const alt = draw(12, 'original', false, 3);
    expect(arrangementKopien([alt], 12, 45)).toEqual([
      { von: alt, nach: draw(12, 'original', false, 3, 45) },
    ]);
  });

  it('nimmt Textobjekte und Zoom-Ausschnitte mit', () => {
    // Alles, was hinter der Version steht, wird unverändert übernommen – `_text` ebenso wie das
    // Layout-Segment des Zooms. Sonst bliebe der geschriebene Text zurück, während die Striche
    // umziehen.
    const text = draw(12, 'original', false, 3) + '_text';
    const zoomKey = zoom(12, 'original', false, 3) + '_dlarge2';
    const kopien = arrangementKopien([text, zoomKey], 12, 45);
    expect(kopien.map((k) => k.nach)).toEqual([
      draw(12, 'original', false, 3, 45) + '_text',
      zoom(12, 'original', false, 3, 45) + '_dlarge2',
    ]);
  });

  it('nimmt alle Versionen und beide Darstellungsarten mit', () => {
    const keys = [
      draw(12, 'original', false, 0),
      draw(12, 'original', true, 0),
      draw(12, 'akustik', false, 1),
    ];
    expect(arrangementKopien(keys, 12, 45)).toHaveLength(3);
  });
});

describe('arrangementKopien – was NICHT passieren darf', () => {
  it('überschreibt nichts, was für dieses Arrangement schon da ist', () => {
    // Sonst plättete ein später nachgezogener Altbestand die Notizen, die man für dieses
    // Arrangement bereits angelegt hat.
    const alt = draw(12, 'original', false, 3);
    const neu = draw(12, 'original', false, 3, 45);
    expect(arrangementKopien([alt, neu], 12, 45)).toEqual([]);
  });

  it('fasst bereits arrangement-genaue Schlüssel nicht an – auch nicht die eines anderen', () => {
    // Notizen, die zu Arrangement 46 gehören, dürfen nicht bei 45 auftauchen. Das wäre genau der
    // Fehler, den das ganze Segment verhindern soll.
    const fremd = draw(12, 'original', false, 3, 46);
    expect(arrangementKopien([fremd], 12, 45)).toEqual([]);
  });

  it('lässt andere Lieder in Ruhe', () => {
    expect(arrangementKopien([draw(13, 'original', false, 3)], 12, 45)).toEqual([]);
  });

  it('verwechselt Lied 1 nicht mit Lied 12', () => {
    // Ein reiner Präfix-Vergleich („song1") würde `song12_…` mitnehmen. Die Notizen eines fremden
    // Lieds unter einem falschen Schlüssel wären kaum wieder zu finden.
    expect(arrangementKopien([draw(12, 'original', false, 3)], 1, 45)).toEqual([]);
  });

  it('lässt Dokument-Anmerkungen in Ruhe – die hängen an der Datei, nicht am Arrangement', () => {
    expect(arrangementKopien([ANNO_DRAW_NS + '4711_2'], 12, 45)).toEqual([]);
  });

  it('ist wiederholbar: ein zweiter Lauf findet nichts mehr', () => {
    // Wichtig, weil die Zuordnung beim Öffnen eines Lieds läuft und nicht einmalig beim Start.
    const alt = draw(12, 'original', false, 3);
    const ersterLauf = arrangementKopien([alt], 12, 45);
    const danach = [alt, ...ersterLauf.map((k) => k.nach)];
    expect(arrangementKopien(danach, 12, 45)).toEqual([]);
  });
});

describe('arrangementMigrationAnwenden – am echten Speicher', () => {
  beforeEach(() => localStorage.clear());

  it('legt die Kopie an und lässt das Original stehen', () => {
    const alt = draw(12, 'original', false, 3);
    localStorage.setItem(alt, '[[1,2]]');
    expect(arrangementMigrationAnwenden(12, 45)).toBe(1);
    expect(localStorage.getItem(draw(12, 'original', false, 3, 45))).toBe('[[1,2]]');
    // Verlustfrei: Der Bestand bleibt als Sicherung liegen.
    expect(localStorage.getItem(alt)).toBe('[[1,2]]');
  });

  it('ist idempotent – der Speicher selbst ist der Merker', () => {
    localStorage.setItem(draw(12, 'original', false, 3), '[[1,2]]');
    expect(arrangementMigrationAnwenden(12, 45)).toBe(1);
    expect(arrangementMigrationAnwenden(12, 45)).toBe(0);
  });

  it('überschreibt vorhandene Notizen dieses Arrangements nicht', () => {
    localStorage.setItem(draw(12, 'original', false, 3), 'ALT');
    localStorage.setItem(draw(12, 'original', false, 3, 45), 'NEU');
    expect(arrangementMigrationAnwenden(12, 45)).toBe(0);
    expect(localStorage.getItem(draw(12, 'original', false, 3, 45))).toBe('NEU');
  });

  it('trägt für ein zweites Arrangement eigene Kopien nach', () => {
    localStorage.setItem(draw(12, 'original', false, 3), '[[1,2]]');
    arrangementMigrationAnwenden(12, 45);
    expect(arrangementMigrationAnwenden(12, 46)).toBe(1);
    expect(localStorage.getItem(draw(12, 'original', false, 3, 46))).toBe('[[1,2]]');
  });
});
