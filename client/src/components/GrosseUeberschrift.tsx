import type { Ref } from 'react';
import styles from './GrosseUeberschrift.module.scss';

interface Props {
  children: string;
  /** Aus `useEinklappenderTitel` – daran hängt das Einklappen in die Leiste. */
  innerRef: Ref<HTMLHeadingElement>;
}

/**
 * Die große Überschrift am Anfang eines Bildschirms (#402-Nachlauf, 22.09.2026).
 *
 * Sie gehört in den SCROLL-Bereich, nicht in die Leiste: Nur dann wandert sie beim Hochschieben
 * weg und gibt ihren Platz an den Inhalt zurück. Zusammen mit `useEinklappenderTitel` ergibt das
 * das iOS-Muster – und hält den Titel aus dem Unschärfe-Band von iOS 26/27 heraus.
 */
export function GrosseUeberschrift({ children, innerRef }: Props) {
  return (
    <h1 className={styles.gross} ref={innerRef}>
      {children}
    </h1>
  );
}
