import type { AgendaServiceOption } from '@shared/types/index';
import styles from './ResponsibleField.module.scss';

interface ResponsibleFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Verfügbare ChurchTools-Dienste als Chips (fügen ein [Dienst]-Token ein). */
  services: AgendaServiceOption[];
  autoFocus?: boolean;
}

/** Eingabe der Zuständigen: freies Textfeld + Chips, die ein Dienst-Token „[Name]" einfügen. */
export function ResponsibleField({ value, onChange, services, autoFocus }: ResponsibleFieldProps) {
  function addToken(name: string) {
    const token = `[${name}]`;
    if (value.includes(token)) return; // schon vorhanden
    const trimmed = value.trim();
    onChange(trimmed ? `${trimmed}, ${token}` : token);
  }

  return (
    <div className={styles.wrap}>
      <input
        className={styles.input}
        placeholder="z.B. [Musik] oder Name"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {services.length > 0 && (
        <div className={styles.chips}>
          {services.map((s) => (
            <button key={s.id} type="button" className={styles.chip} onClick={() => addToken(s.name)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <p className={styles.hint}>Dienst antippen fügt z.B. „[Musik]" ein – ChurchTools füllt die zugesagten Personen automatisch.</p>
    </div>
  );
}
