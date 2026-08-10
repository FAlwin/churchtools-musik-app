// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TempoMenu } from './TempoMenu';
import { MIN_TIPPS } from '../utils/tapTempo';
import { MAX_BPM, MIN_BPM } from '../utils/bpmPulse';

/**
 * Das Menü führt drei Dinge zusammen, die sich in einem Punkt unterscheiden: Puls und Klick gehören
 * **nur mir**, das Tempo gilt für **alle**. Diese Grenze ist das Wichtigste an der Komponente –
 * deshalb prüfen die meisten Tests, dass der Speichern-Knopf nicht zu früh, nicht ohne Berechtigung
 * und nicht ohne Abweichung aktiv wird.
 *
 * Der zweite Schwerpunkt ist der **feste Rahmen**: Hinweiszeile und Speichern-Knopf müssen IMMER im
 * Baum stehen, auch wenn nichts zu speichern ist. Das ist die Mechanik, die verhindert, dass das
 * Menü beim Antippen unter dem Finger wegwächst – gemeldet mit zwei Bildschirmfotos.
 *
 * Das Antippen läuft über `performance.now()`. Mit echten Zeiten hinge der Test an der Laufzeit der
 * Testumgebung – deshalb eine gestellte Uhr, die ich selbst weiterdrehe. Das erwartete Ergebnis ist
 * damit eine Rechnung und keine Schätzung.
 */
let jetzt = 0;
beforeEach(() => {
  jetzt = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => jetzt);
});
afterEach(() => vi.restoreAllMocks());

interface Optionen {
  liedTempo?: number | null;
  timeSig?: string | null;
  zaehlweise?: number | null;
  darfSpeichern?: boolean;
  onSpeichern?: (tempo: number) => Promise<void>;
  klick?: 'aus' | 'einzaehlen' | 'dauerhaft';
}

/**
 * Das Menü ist GESTEUERT: Der Tempo-Wert liegt in `ChordChart`, damit Puls und Klick ihm folgen.
 * Für die Tests hält ihn diese Hülle – sonst prüfte man eine Komponente, die es so nicht gibt.
 */
function zeige(o: Optionen = {}) {
  const props = {
    liedTempo: o.liedTempo === undefined ? 120 : o.liedTempo,
    darfSpeichern: o.darfSpeichern ?? true,
    onSpeichern: o.onSpeichern ?? vi.fn().mockResolvedValue(undefined),
    onPuls: vi.fn(),
    onKlick: vi.fn(),
    onZaehlweise: vi.fn(),
    onClose: vi.fn(),
  };
  function Huelle() {
    const [wert, setWert] = useState<number | null>(null);
    return (
      <TempoMenu
        liedTempo={props.liedTempo}
        wert={wert}
        onWert={setWert}
        timeSig={o.timeSig === undefined ? '4/4' : o.timeSig}
        zaehlweise={o.zaehlweise ?? null}
        onZaehlweise={props.onZaehlweise}
        puls={false}
        onPuls={props.onPuls}
        klick={o.klick ?? 'aus'}
        onKlick={props.onKlick}
        darfSpeichern={props.darfSpeichern}
        onSpeichern={props.onSpeichern}
        onClose={props.onClose}
      />
    );
  }
  render(<Huelle />);
  return props;
}

// Generisch statt `as HTMLInputElement`: Die Zusicherung braucht `tsc` fuer `.value`, waehrend die
// Lint-Regel `no-unnecessary-type-assertion` sie fuer ueberfluessig hielt. Die generische Form
// stellt beide zufrieden – und ist ohnehin der von Testing Library vorgesehene Weg.
const feld = () => screen.getByRole<HTMLInputElement>('textbox');
const speichernKnopf = () => screen.getByRole('button', { name: /in ChurchTools speichern/ });
const knopf = (name: string | RegExp) => screen.getByRole('button', { name });

/** `anzahl` Tipps im Abstand `abstandMs` – die gestellte Uhr wird dabei weitergedreht. */
function tippen(anzahl: number, abstandMs: number) {
  for (let i = 0; i < anzahl; i++) {
    fireEvent.click(knopf(/Tempo antippen/));
    jetzt += abstandMs;
  }
}

describe('TempoMenu – ein Wert, vier Wege', () => {
  it('zeigt das Tempo des Lieds', () => {
    zeige();
    expect(feld().value).toBe('120');
  });

  it('bleibt leer, wenn im Lied kein Tempo steht', () => {
    zeige({ liedTempo: null });
    expect(feld().value).toBe('');
  });

  it('+ und − ändern den Wert um genau 1', () => {
    zeige();
    fireEvent.click(knopf('Tempo erhöhen'));
    expect(feld().value).toBe('121');
    fireEvent.click(knopf('Tempo verringern'));
    fireEvent.click(knopf('Tempo verringern'));
    expect(feld().value).toBe('119');
  });

  it('startet ohne jedes Tempo bei 120, statt am Rand des Bereichs', () => {
    zeige({ liedTempo: null });
    fireEvent.click(knopf('Tempo erhöhen'));
    expect(feld().value).toBe('121');
  });

  it('kommt über die Grenzen nicht hinaus', () => {
    zeige({ liedTempo: MAX_BPM });
    fireEvent.click(knopf('Tempo erhöhen'));
    expect(feld().value).toBe(String(MAX_BPM));
  });

  it('nimmt eine Eingabe im Bereich an', () => {
    zeige();
    fireEvent.change(feld(), { target: { value: '96' } });
    expect(speichernKnopf().hasAttribute('disabled')).toBe(false);
  });

  it('meldet unfertige Eingaben NICHT nach oben – sonst spränge der Puls auf 1', () => {
    // Beim Tippen von „96" entsteht zwischendurch „9". Das ist keine Absicht, sondern ein Zustand
    // auf dem Weg dorthin; erst was im Bereich liegt, gilt.
    zeige();
    fireEvent.change(feld(), { target: { value: '9' } });
    expect(speichernKnopf().hasAttribute('disabled')).toBe(true);
    fireEvent.change(feld(), { target: { value: '96' } });
    expect(speichernKnopf().hasAttribute('disabled')).toBe(false);
  });

  it('räumt beim Verlassen auf, statt Unsinn stehen zu lassen', () => {
    zeige();
    fireEvent.change(feld(), { target: { value: '999' } });
    fireEvent.blur(feld());
    expect(feld().value).toBe('120');
  });

  it('lässt sich unter das Minimum nicht eintippen', () => {
    zeige();
    fireEvent.change(feld(), { target: { value: String(MIN_BPM - 1) } });
    expect(speichernKnopf().hasAttribute('disabled')).toBe(true);
  });

  it('braucht mehr als einen Tipp – aus einem folgt kein Abstand', () => {
    zeige();
    tippen(1, 500);
    expect(feld().value).toBe('120');
  });

  it('rechnet aus den Abständen das Tempo – 500 ms ergibt 120', () => {
    zeige({ liedTempo: 60 });
    tippen(MIN_TIPPS, 500);
    expect(feld().value).toBe('120');
  });

  it('„Zurücksetzen" führt zurück auf das Tempo des Lieds', () => {
    zeige();
    fireEvent.click(knopf('Tempo erhöhen'));
    expect(feld().value).toBe('121');
    fireEvent.click(knopf('Zurücksetzen'));
    expect(feld().value).toBe('120');
  });
});

describe('TempoMenu – der Rahmen darf nicht springen', () => {
  it('zeigt Hinweiszeile und Speichern-Knopf IMMER, auch ohne Abweichung', () => {
    // Das ist die Mechanik hinter der festen Größe: Beide Elemente stehen immer im Baum, der Knopf
    // ist nur abgeblendet. Verschwänden sie, wüchse das Menü beim ersten Tipp – der gemeldete
    // Fehler.
    zeige();
    expect(speichernKnopf()).toBeTruthy();
    expect(screen.getByText(/gelten nur für dich/)).toBeTruthy();
  });

  it('zeigt sie auch ohne jedes Tempo im Lied', () => {
    zeige({ liedTempo: null });
    expect(speichernKnopf()).toBeTruthy();
  });

  it('zeigt sie auch ohne Berechtigung – abgeblendet, nicht entfernt', () => {
    zeige({ darfSpeichern: false });
    expect(speichernKnopf().hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/fehlt dir die Berechtigung/)).toBeTruthy();
  });

  it('zeigt den „Zurücksetzen"-Knopf immer, nur abgeblendet', () => {
    zeige();
    expect(knopf('Zurücksetzen').hasAttribute('disabled')).toBe(true);
    fireEvent.click(knopf('Tempo erhöhen'));
    expect(knopf('Zurücksetzen').hasAttribute('disabled')).toBe(false);
  });
});

describe('TempoMenu – speichern gilt für alle', () => {
  it('ist ohne Abweichung nicht anklickbar', () => {
    zeige();
    expect(speichernKnopf().hasAttribute('disabled')).toBe(true);
  });

  it('wird anklickbar, sobald der Wert abweicht', () => {
    zeige();
    fireEvent.click(knopf('Tempo erhöhen'));
    expect(speichernKnopf().hasAttribute('disabled')).toBe(false);
  });

  it('bleibt ohne Berechtigung gesperrt, auch bei Abweichung', () => {
    zeige({ darfSpeichern: false });
    fireEvent.click(knopf('Tempo erhöhen'));
    expect(speichernKnopf().hasAttribute('disabled')).toBe(true);
  });

  it('reicht den eingestellten Wert weiter und schließt danach', async () => {
    const props = zeige();
    fireEvent.click(knopf('Tempo erhöhen'));
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(props.onSpeichern).toHaveBeenCalledWith(121));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it('BEHÄLT den Wert, wenn das Speichern fehlschlägt (#270)', async () => {
    // Ein vorübergehender Fehler darf keine Arbeit zerstören. Ein eingestelltes Tempo ist Arbeit:
    // Wer im Takt mitgetippt hat, soll nicht von vorn anfangen, weil ChurchTools kurz nicht wollte.
    const props = zeige({
      onSpeichern: vi.fn().mockRejectedValue(new Error('ChurchTools antwortet nicht')),
    });
    fireEvent.click(knopf('Tempo erhöhen'));
    fireEvent.click(speichernKnopf());

    await waitFor(() => expect(screen.getByText('ChurchTools antwortet nicht')).toBeTruthy());
    // Der Fehler steht in DERSELBEN Zeile wie der Hinweis, nicht in einer zusätzlichen: Sonst käme
    // ein Element dazu und das Menü würde höher – genau der gemeldete Sprung. Die Zeile hat dafür
    // zusätzlich eine feste Höhe im Stylesheet; DIE deckt kein Test ab, weil alle Hinweistexte
    // ohnehin zweizeilig umbrechen und nur eine kurze Servermeldung sie unterschreiten könnte.
    expect(screen.getByText('ChurchTools antwortet nicht').className).toMatch(/menuHint/);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(feld().value).toBe('121');
    expect(speichernKnopf().hasAttribute('disabled')).toBe(false);
  });
});

describe('TempoMenu – Puls und Klick gehören nur mir', () => {
  it('meldet den Puls nach oben, ohne etwas zu speichern', () => {
    const props = zeige();
    fireEvent.click(knopf('An'));
    expect(props.onPuls).toHaveBeenCalledWith(true);
    expect(props.onSpeichern).not.toHaveBeenCalled();
  });

  it('der Klick-Knopf startet – und zeigt danach das Anhalten', () => {
    const props = zeige();
    fireEvent.click(knopf('Klick starten'));
    expect(props.onKlick).toHaveBeenCalledWith('dauerhaft');
  });

  it('derselbe Knopf hält an, wenn es läuft', () => {
    const props = zeige({ klick: 'dauerhaft' });
    fireEvent.click(knopf('Klick anhalten'));
    expect(props.onKlick).toHaveBeenCalledWith('aus');
  });

  it('„Einzählen" lässt sich auch wieder abschalten', () => {
    const props = zeige({ klick: 'einzaehlen' });
    fireEvent.click(knopf('Einzählen'));
    expect(props.onKlick).toHaveBeenCalledWith('aus');
  });

  it('sperrt Ton und Puls ohne brauchbares Tempo – aber NICHT das Einstellen', () => {
    // Genau dann will man ein Tempo nachtragen: Das Menü ist der einzige Weg dorthin.
    zeige({ liedTempo: null });
    expect(knopf('An').hasAttribute('disabled')).toBe(true);
    expect(knopf('Klick starten').hasAttribute('disabled')).toBe(true);
    expect(knopf('Einzählen').hasAttribute('disabled')).toBe(true);
    expect(knopf('Tempo erhöhen').hasAttribute('disabled')).toBe(false);
    expect(knopf(/Tempo antippen/).hasAttribute('disabled')).toBe(false);
    expect(feld().hasAttribute('disabled')).toBe(false);
  });
});

describe('TempoMenu – Schläge je Takt', () => {
  it('beschriftet die Knöpfe mit dem, was man ZÄHLT', () => {
    // Im 6/8: sechs Achtel, drei Paare oder zwei Dreiergruppen. „Einzeln/Zweier/Dreier" stand
    // vorher da und sagte nichts darüber, was danach passiert – es war nicht zu verstehen.
    zeige({ timeSig: '6/8' });
    for (const n of ['6', '3', '2']) expect(knopf(`${n} Schläge je Takt`)).toBeTruthy();
  });

  it('zeigt im Viervierteltakt andere Zahlen als im 6/8', () => {
    zeige({ timeSig: '4/4' });
    expect(knopf('4 Schläge je Takt')).toBeTruthy();
    expect(knopf('2 Schläge je Takt')).toBeTruthy();
  });

  it('sperrt, was in dieser Taktart nicht aufgeht', () => {
    zeige({ timeSig: '4/4' });
    expect(knopf('4 Schläge je Takt').hasAttribute('disabled')).toBe(false);
    expect(knopf('2 Schläge je Takt').hasAttribute('disabled')).toBe(false);
    // 4/4 in Dreiern ergäbe 1⅓ Schläge je Takt. Der Knopf trägt dann einen Strich statt einer Zahl
    // und ist gesperrt – stehen bleibt er, damit man sieht, dass es ihn gibt.
    const gesperrt = knopf('in dieser Taktart nicht möglich');
    expect(gesperrt.hasAttribute('disabled')).toBe(true);
    expect(gesperrt.textContent).toBe('–');
  });

  it('meldet die Wahl nach oben und lässt sich auf Auto zurückstellen', () => {
    const props = zeige({ timeSig: '6/8' });
    fireEvent.click(knopf('3 Schläge je Takt'));
    expect(props.onZaehlweise).toHaveBeenCalledWith(2);
    fireEvent.click(knopf('Auto'));
    expect(props.onZaehlweise).toHaveBeenCalledWith(null);
  });

  it('nennt die Klick-Rate IMMER – auch wenn sie dem Tempo entspricht', () => {
    // Vorher erschien hier nur bei gröberer Zählweise ein Satz, und der wechselte mit dem Knopf.
    // Eine Zeile, die kommt und geht, ist schlimmer als eine, die immer dasteht.
    zeige({ liedTempo: 120, timeSig: '4/4', zaehlweise: 1 });
    expect(screen.getByText('klickt 120 ×/min')).toBeTruthy();
  });

  it('nennt sie auch bei gröberer Zählweise – dort weicht sie vom Feld ab', () => {
    zeige({ liedTempo: 120, timeSig: '6/8', zaehlweise: 3 });
    expect(feld().value).toBe('120');
    expect(screen.getByText('klickt 40 ×/min')).toBeTruthy();
  });

  it('sagt es, wenn gar kein Tempo eingestellt ist', () => {
    zeige({ liedTempo: null });
    expect(screen.getByText('kein Tempo eingestellt')).toBeTruthy();
  });

  it('spricht das Wort „Grundschläge" nirgends aus', () => {
    // Die Unterscheidung ist intern. Sie stand im Menü und war nicht zu verstehen – gemeldet.
    zeige({ liedTempo: 120, timeSig: '6/8', zaehlweise: 3 });
    expect(document.body.textContent).not.toContain('Grundschläge');
  });

  it('rechnet ein angetipptes Tempo auf Grundschläge zurück', () => {
    // In Dreiergruppen mitgetippt: 1000 ms Abstand sind 60 GEZÄHLTE Schläge – gespeichert gehören
    // die Grundschläge, also 180. Ohne die Rückrechnung stünde ein Drittel des richtigen Tempos in
    // ChurchTools.
    zeige({ liedTempo: 60, timeSig: '6/8', zaehlweise: 3 });
    tippen(MIN_TIPPS, 1000);
    expect(feld().value).toBe('180');
  });

  it('begrenzt auf die GESPEICHERTE Zahl, nicht auf die gezählte', () => {
    // 500 ms in Dreiergruppen wären 360 Grundschläge – über der Obergrenze. Gedeckelt wird der Wert,
    // der nach ChurchTools geht und dort geprüft wird; in Dreiergruppen sind damit höchstens
    // 100 gezählte Schläge je Minute erreichbar. Das ist gewollt: Die Grenze bewacht die Zahl, die
    // andere später zu sehen bekommen.
    zeige({ liedTempo: 60, timeSig: '6/8', zaehlweise: 3 });
    tippen(MIN_TIPPS, 500);
    expect(feld().value).toBe(String(MAX_BPM));
  });

  it('lässt bei Einzelschlägen alles wie es war', () => {
    zeige({ liedTempo: 60, timeSig: '4/4', zaehlweise: 1 });
    tippen(MIN_TIPPS, 500);
    expect(feld().value).toBe('120');
  });

  it('sperrt den Ton, wenn das GEZÄHLTE Tempo zu langsam wird', () => {
    // 30 Grundschläge in Dreiergruppen = 10 gezählte je Minute – darunter pulst nichts mehr.
    zeige({ liedTempo: 30, timeSig: '6/8', zaehlweise: 3 });
    expect(knopf('An').hasAttribute('disabled')).toBe(true);
    // Das Einstellen bleibt frei – sonst käme man aus dem Zustand nicht heraus.
    expect(knopf('Tempo erhöhen').hasAttribute('disabled')).toBe(false);
  });
});
