import styles from './GrosseUeberschrift.module.scss';

/**
 * Die große Überschrift am Anfang eines Bildschirms **ohne Kopfleiste** (22.09.2026).
 *
 * Alwin: „vielleicht lassen wir den Titel in der Mitte weg und machen es transparent?" – so wie
 * WhatsApp: Der Titel steht nur groß im Inhalt, oben gibt es keine Fläche, die Platz kostet. Beim
 * Scrollen läuft der Inhalt unter das Unschärfe-Band von iOS 26/27 (siehe `client/index.html`) und
 * wird dort weich – das ist der native Look, kein Fehler. Welcher Bildschirm gerade offen ist, sagt
 * die Tab-Leiste unten.
 *
 * Der Abstand nach oben (`--inhalt-pad-top`) hält die Überschrift im Ruhezustand unter dem Band;
 * er gehört zum Inhalt und scrollt mit weg.
 */
export function GrosseUeberschrift({ children }: { children: string }) {
  return <h1 className={styles.gross}>{children}</h1>;
}
