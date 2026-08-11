import type { jsPDF } from 'jspdf';
import { shareOrDownload } from './shareFile';

/**
 * Teilt eine erzeugte PDF über das System-Teilen-Menü (Web Share API mit Datei – iPad/iPhone/
 * Android). Wo das nicht geht (Desktop), wird die PDF heruntergeladen.
 *
 * Der Ablauf selbst steht in `shareOrDownload` – er gilt seit #321 für jede Datei, nicht nur für
 * erzeugte PDFs. Hier bleibt nur, was PDF-spezifisch ist: die Endung.
 */
export async function sharePdf(doc: jsPDF, filename: string): Promise<void> {
  const safe = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  await shareOrDownload(doc.output('blob'), safe);
}
