import type { jsPDF } from 'jspdf';

/**
 * Teilt eine erzeugte PDF über das System-Teilen-Menü (Web Share API mit Datei – iPad/iPhone/
 * Android). Wo das nicht geht (Desktop), wird die PDF heruntergeladen.
 */
export async function sharePdf(doc: jsPDF, filename: string): Promise<void> {
  const safe = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = doc.output('blob') as Blob;

  // Teilen mit Datei, falls unterstützt
  const file = new File([blob], safe, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: safe });
      return;
    } catch (err) {
      // Abbruch durch den Nutzer ist kein Fehler; bei anderen Fehlern auf Download ausweichen.
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  // Fallback: Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
