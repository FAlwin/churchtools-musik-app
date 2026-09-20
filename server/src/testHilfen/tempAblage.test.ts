import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { leeren, tempDatei, tempVerzeichnis } from './tempAblage.js';

/**
 * Die Test-Ablage selbst (20.09.2026) – sie ist Werkzeug, aber ihre Zusagen sind es, an denen sieben
 * Testdateien hängen.
 *
 * **Der wichtigste Test ist der letzte.** `fs.rm` mit `force: true` unterdrückt nur „gibt es nicht"
 * (`ENOENT`) – gegen `ENOTEMPTY` hilft es NICHT. Legt jemand während des rekursiven Löschens eine
 * neue Datei an, scheitert das abschließende `rmdir`; nachgestellt am 20.09.2026 in **60 von 60**
 * Durchgängen. Genau das ist in der CI passiert (Lauf 35531036193, PR #397): Ein Test lief in seine
 * Zeitgrenze, seine Schreibschleife lief weiter, und der nächste Test scheiterte beim Aufräumen an
 * einem Fehler, der nichts mit ihm zu tun hatte.
 */
describe('tempVerzeichnis – eindeutig je Lauf', () => {
  it('gibt bei jedem Aufruf einen ANDEREN Pfad', () => {
    const a = tempVerzeichnis('probe');
    const b = tempVerzeichnis('probe');
    expect(a).not.toBe(b);
  });

  it('legt das Verzeichnis wirklich an, statt nur einen Namen zu bilden', async () => {
    const dir = tempVerzeichnis('probe');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  it('tempDatei liegt in einem eigenen Verzeichnis – zwei Läufe stören sich nicht', async () => {
    const a = tempDatei('probe', 'gleich.json');
    const b = tempDatei('probe', 'gleich.json');
    expect(path.basename(a)).toBe(path.basename(b));
    expect(path.dirname(a)).not.toBe(path.dirname(b));
    // Das Verzeichnis existiert schon, die Datei noch nicht – sie gehört dem Test.
    expect((await fs.stat(path.dirname(a))).isDirectory()).toBe(true);
  });
});

describe('leeren – hält paralleles Schreiben aus', () => {
  it('stört sich nicht an einem Pfad, den es gar nicht gibt', async () => {
    await expect(
      leeren(path.join(tempVerzeichnis('probe'), 'nie-dagewesen')),
    ).resolves.toBeUndefined();
  });

  it('räumt ein Verzeichnis, in das noch geschrieben wird – ohne ENOTEMPTY', async () => {
    const dir = tempVerzeichnis('probe');
    for (let i = 0; i < 200; i++) await fs.writeFile(path.join(dir, `f${i}`), 'x');

    // Der „abgebrochene Test", dessen Schreibschleife weiterläuft.
    let weiter = true;
    const schreiber = (async () => {
      for (let i = 0; weiter && i < 4000; i++) {
        await fs.writeFile(path.join(dir, `spaet${i}`), 'x').catch(() => {
          /* das Verzeichnis ist weg – genau das ist das Ziel */
        });
      }
    })();

    // Ohne die Wiederholungen in `leeren` wirft das hier zuverlässig ENOTEMPTY.
    await expect(leeren(dir)).resolves.toBeUndefined();
    weiter = false;
    await schreiber;
    await leeren(dir);
  });
});
