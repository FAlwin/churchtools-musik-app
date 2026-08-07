/**
 * Was in dieser App als Tempo gilt – **einzige Quelle für Client UND Server** (#145).
 *
 * Warum hier und nicht im Client: Ein angetipptes Tempo wandert über den Server nach ChurchTools.
 * Damit prüfen zwei Stellen denselben Bereich – der Client, bevor er den Speichern-Knopf zeigt, und
 * der Server, bevor er schreibt. Standen die Zahlen an beiden Orten, wäre die Frage nur, wann sie
 * auseinanderlaufen: Wer den Bereich später weitet, weitet ihn erfahrungsgemäß an einer Stelle. Das
 * Ergebnis wäre ein Knopf, der etwas anbietet, das der Server dann mit 400 ablehnt.
 *
 * Genau dieselbe Überlegung hat schon `shared/keys` hervorgebracht (#250).
 *
 * Werte außerhalb dieses Bereichs sind Datenfehler aus ChurchTools – ein Puls daraus wäre entweder
 * unsichtbar (bei 0) oder ein Stroboskop (bei 5000).
 */
export const MIN_BPM = 20;
export const MAX_BPM = 300;
