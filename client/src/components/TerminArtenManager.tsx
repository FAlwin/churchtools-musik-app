import { useState } from 'react';
import { SITE_CONFIG_GRENZEN, type SiteConfig, type TerminArt } from '@shared/types/index';
import { Spinner } from './Spinner';
import { Icon } from './icons';
import { useUpdateSiteConfig } from '../hooks/useSiteConfig';
import { neueId } from '../utils/ids';
// Dieselben Stile wie der Links-Editor – bewusst geteilt, nicht kopiert: zwei Listen-Editoren im
// selben Verwaltungsbereich sollen gleich aussehen, und eine Korrektur soll beide treffen.
import styles from './LinksManager.module.scss';

/**
 * Admin-Verwaltung der **Termin-Arten** für den Filter im Tab „Abwesenheiten" (#400).
 *
 * Eine Art = Knopfname + Suchwort. Ein Termin gehört zur ersten Art, deren Suchwort in seinem Namen
 * vorkommt; der Rest fällt unter „Sonstige" (Regeln in `utils/terminFilter.ts`). Die Reihenfolge
 * hier ist die Reihenfolge der Knöpfe – und die Reihenfolge, in der die Suchwörter geprüft werden:
 * Wer „Gottesdienst" vor „Jugendgottesdienst" stellt, bekommt den Jugendgottesdienst unter
 * „Gottesdienst". Das steht als Hinweis im Fenster, nicht nur hier.
 *
 * Nach dem Vorbild von `LinksManager`, ohne Ziehen zum Sortieren: Zwei bis fünf Arten sortiert man
 * durch Löschen und Neu-Anlegen schneller, als man den Griff findet.
 */
function neueArt(): TerminArt {
  return { id: neueId('t'), name: '', suchwort: '' };
}

export function TerminArtenManager({ site, onClose }: { site: SiteConfig; onClose: () => void }) {
  const [arten, setArten] = useState<TerminArt[]>(site.terminArten ?? []);
  const [err, setErr] = useState<string | null>(null);
  const update = useUpdateSiteConfig();

  function aendere(next: TerminArt): void {
    setArten((cur) => cur.map((x) => (x.id === next.id ? next : x)));
  }

  function save(): void {
    setErr(null);
    // Leere Zeilen verwerfen, Eingaben säubern – wie beim Links-Editor.
    const cleaned = arten
      .map((a) => ({ ...a, name: a.name.trim(), suchwort: a.suchwort.trim() }))
      .filter((a) => a.name || a.suchwort);
    for (const a of cleaned) {
      if (!a.name || !a.suchwort) {
        setErr('Bitte für jede Termin-Art einen Namen und ein Suchwort angeben.');
        return;
      }
    }
    update.mutate(
      { ...site, terminArten: cleaned },
      { onSuccess: onClose, onError: () => setErr('Speichern fehlgeschlagen.') },
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.list}>
        {arten.map((a) => (
          <div key={a.id} className={styles.card}>
            <div className={styles.cardTop}>
              <input
                className={styles.labelInput}
                value={a.name}
                maxLength={SITE_CONFIG_GRENZEN.terminArtName}
                placeholder="Name des Knopfs (z. B. Gottesdienst)"
                aria-label="Name"
                onChange={(e) => aendere({ ...a, name: e.target.value })}
              />
              <button
                className={styles.del}
                onClick={() => setArten((cur) => cur.filter((x) => x.id !== a.id))}
                aria-label="Termin-Art löschen"
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
            <input
              className={styles.urlInput}
              value={a.suchwort}
              maxLength={SITE_CONFIG_GRENZEN.terminArtSuchwort}
              placeholder="Suchwort im Terminnamen (z. B. Gottesdienst)"
              aria-label="Suchwort"
              autoCapitalize="off"
              onChange={(e) => aendere({ ...a, suchwort: e.target.value })}
            />
          </div>
        ))}
      </div>

      <button className={styles.add} onClick={() => setArten((cur) => [...cur, neueArt()])}>
        <Icon name="plus" size={18} /> Termin-Art hinzufügen
      </button>

      {err && <div className={styles.err}>{err}</div>}

      <button className={styles.save} onClick={save} disabled={update.isPending}>
        {update.isPending ? <Spinner /> : 'Speichern'}
      </button>
    </div>
  );
}
