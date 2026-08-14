// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LiedtextTeil } from '@shared/types/index';
import { LiedVorschau } from './LiedVorschau';

/**
 * Die Vorschau vor dem Einfügen (#381) – Muster: ProPresenter.
 *
 * Sie ist der **Zwischenschritt** zwischen Trefferliste und Einfügen: Der Liedtext ist die
 * Entscheidungsgrundlage, nicht eine Zusatzinfo. Geprüft wird deshalb vor allem, dass sie in **jedem**
 * Zustand handlungsfähig bleibt:
 *
 *  - Kein Text vorhanden? Einfügen muss trotzdem gehen.
 *  - Text konnte nicht geholt werden? Ebenfalls – ein Ladefehler darf niemanden aussperren.
 *  - Kommt ein CCLI-Hinweis mit, **muss** er angezeigt werden (Lizenzbedingung, keine Zierde).
 */
const TEILE: LiedtextTeil[] = [
  { label: 'Vers 1', text: 'All die Fülle ist in dir, o Herr,\nund alle Schönheit kommt von dir.' },
  { label: 'Chorus 1', text: 'Quelle des Lebens,\nlebendiges Wasser.' },
];

const onAktion = vi.fn();
const onZurueck = vi.fn();

beforeEach(() => vi.clearAllMocks());

function zeige(props: Partial<Parameters<typeof LiedVorschau>[0]> = {}) {
  return render(
    <LiedVorschau
      titel="All die Fülle ist in dir"
      teile={TEILE}
      laeuft={false}
      aktion="Zum Ablauf hinzufügen"
      onAktion={onAktion}
      onZurueck={onZurueck}
      {...props}
    />,
  );
}

const aktionsKnopf = (name = 'Zum Ablauf hinzufügen') => screen.getByRole('button', { name });

describe('LiedVorschau – was zu sehen ist', () => {
  it('Titel, Abschnitte mit Beschriftung und der Text', () => {
    zeige();
    expect(screen.getByText('All die Fülle ist in dir')).toBeTruthy();
    expect(screen.getByText('Vers 1')).toBeTruthy();
    expect(screen.getByText('Chorus 1')).toBeTruthy();
    expect(screen.getByText(/lebendiges Wasser/)).toBeTruthy();
  });

  it('Autoren und Kennung, wenn sie mitkommen', () => {
    zeige({ autoren: 'Norbert Jagode', kennung: 'CCLI-Nr. 4336851' });
    expect(screen.getByText('Norbert Jagode')).toBeTruthy();
    expect(screen.getByText('CCLI-Nr. 4336851')).toBeTruthy();
  });

  it('während des Holens ein Hinweis statt einer leeren Fläche', () => {
    zeige({ teile: [], laeuft: true });
    expect(screen.getByText(/wird geholt/)).toBeTruthy();
  });
});

describe('LiedVorschau – handlungsfähig in jedem Zustand', () => {
  it('ohne Liedtext bleibt Einfügen möglich', () => {
    /**
     * Ein Lied ohne Notenblatt hat keinen Text – das ist kein Grund, es nicht einfügen zu können. Der
     * Satz sagt es ausdrücklich, statt eine leere Fläche zu zeigen, die nach einem Ladeproblem aussieht.
     */
    zeige({ teile: [] });
    expect(screen.getByText(/kein Liedtext vor/)).toBeTruthy();
    expect(aktionsKnopf().hasAttribute('disabled')).toBe(false);

    fireEvent.click(aktionsKnopf());
    expect(onAktion).toHaveBeenCalled();
  });

  it('bei einem Fehler steht die Meldung des Servers – und Einfügen geht weiter', () => {
    // „ChurchTools bremst uns aus" ist etwas anderes als „kein Text" (#270). Und ein Ladefehler beim
    // Text darf nicht verhindern, dass das Lied in den Ablauf kommt.
    zeige({ teile: [], fehler: 'ChurchTools bremst uns aus. Bitte kurz warten.' });

    expect(screen.getByText(/bremst uns aus/)).toBeTruthy();
    expect(screen.queryByText(/kein Liedtext vor/)).toBeNull();
    expect(aktionsKnopf().hasAttribute('disabled')).toBe(false);
  });

  it('während eines laufenden Vorgangs ist die Aktion gesperrt', () => {
    zeige({ busy: true });
    expect(aktionsKnopf().hasAttribute('disabled')).toBe(true);
  });

  it('zurück zur Liste geht immer', () => {
    zeige({ teile: [], laeuft: true });
    fireEvent.click(screen.getByRole('button', { name: /Zurück zur Liste/ }));
    expect(onZurueck).toHaveBeenCalled();
  });
});

describe('LiedVorschau – der CCLI-Hinweis ist Pflicht', () => {
  it('wird angezeigt, wenn die Quelle ihn mitschickt', () => {
    /**
     * CCLI liefert `disclaimer` mit **jedem** Liedtext („For use solely with the SongSelect Terms of
     * Use…", gemessen 14.08.2026). Das ist eine Lizenzbedingung – wer den Text zeigt, zeigt ihn mit.
     */
    zeige({ disclaimer: 'For use solely with the SongSelect Terms of Use. www.ccli.com' });
    expect(screen.getByText(/SongSelect Terms of Use/)).toBeTruthy();
  });

  it('fehlt er, steht auch nichts da – eigene Lieder brauchen keinen', () => {
    zeige();
    expect(screen.queryByText(/Terms of Use/)).toBeNull();
  });
});

describe('LiedVorschau – die Beschriftung der Aktion kommt vom Aufrufer', () => {
  it('„Zum Ablauf hinzufügen" oder „Als neues Lied anlegen …" – je nach Quelle', () => {
    // Zwei Kontexte, eine Komponente: Was der Knopf tut, weiß nur der Aufrufer.
    zeige({ aktion: 'Als neues Lied anlegen …' });
    expect(aktionsKnopf('Als neues Lied anlegen …')).toBeTruthy();
  });
});
