/**
 * Eine Datei ans Gerät geben – teilen, wo es geht, sonst herunterladen (#321).
 *
 * **Warum hier und nicht in `sharePdf`:** Der Ablauf – erst das System-Teilen-Menü mit Datei
 * versuchen, sonst einen unsichtbaren Link anklicken und die Objekt-URL wieder freigeben – galt
 * bisher nur für erzeugte PDFs. Mit der Dateiverwaltung (#321) gilt er für **jede** Datei aus
 * ChurchTools. Ihn dort abzuschreiben hätte eine zweite Fassung ergeben, und die vergisst dann
 * irgendwann das `revokeObjectURL` oder behandelt den Abbruch des Nutzers als Fehler.
 *
 * `sharePdf` ist seitdem nur noch ein Aufrufer.
 */

/**
 * Gibt `blob` unter `filename` an das Gerät weiter.
 *
 * Auf iPad/iPhone erscheint das Teilen-Menü (dort ist „In Dateien speichern" der übliche Weg), am
 * Rechner wird direkt heruntergeladen.
 *
 * **Ein Abbruch durch den Nutzer ist kein Fehler.** Wer im Teilen-Menü „Abbrechen" tippt, will
 * nichts – dann darf hinterher nicht doch noch ein Download starten und schon gar keine
 * Fehlermeldung erscheinen.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // Abbruch durch den Nutzer ist kein Fehler; bei anderen Fehlern auf Download ausweichen.
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst später freigeben: Safari bricht den Download ab, wenn die URL sofort ungültig wird.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
