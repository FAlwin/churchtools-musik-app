import styles from './Segment.module.scss';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Optionale Klasse für äußere Abstände. */
  className?: string;
}

/** Segment-Control (iOS-/ChurchTools-Stil): eine Auswahl aus 2–3 Optionen. */
export function Segment<T extends string>({ value, options, onChange, className }: SegmentProps<T>) {
  return (
    <div className={`${styles.seg}${className ? ' ' + className : ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          className={`${styles.btn}${value === o.value ? ' ' + styles.on : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
