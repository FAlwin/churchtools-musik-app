/**
 * Was in dieser App als Datei durchgeht – **einzige Quelle für Client UND Server** (#321).
 *
 * Warum hier und nicht im Server: Eine hochgeladene Datei wandert vom Browser über den Server nach
 * ChurchTools. Damit prüfen zwei Stellen dieselbe Grenze – der Client, **bevor** er 50 MB durchs Netz
 * schickt, und der Server, bevor er sie annimmt. Stünde die Zahl an beiden Orten, wäre die Frage nur,
 * wann sie auseinanderlaufen: Der Client bötte dann etwas an, das der Server ablehnt – nach der
 * vollen Übertragung, also im schlechtesten Moment.
 *
 * Dieselbe Überlegung hat `shared/keys` (#250) und `shared/tempo` (#145) hervorgebracht.
 *
 * Der Wert lag vorher als `MAX_FILE_BYTES` in `server/src/services/ctHttp.ts` und galt dort fürs
 * LESEN aus ChurchTools. Beim Hochladen dieselbe Grenze zu nehmen ist Absicht: Was die App nicht
 * wieder ausliefern kann, soll sie auch nicht annehmen.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Die Grenze in Worten – für Meldungen an den Nutzer, damit „52428800" nirgends auftaucht. */
export const MAX_FILE_TEXT = '50 MB';
