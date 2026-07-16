import { test, expect } from '@playwright/test';

/**
 * Render-Smoke des Chart-Pfads (#141): /?demo=chart mountet ChordChart → useSetlistPages → PageDeck
 * → PDF→Canvas mit Testliedern, ohne Login/Backend. Fängt grobe Brüche des refaktorierten Render-
 * Pfads (Hooks aus #140) ab. API-Aufrufe (pullAnnotations o. Ä.) scheitern hier erwartbar (kein
 * Server) – das ist KEIN Testfehler; wir prüfen nur unbehandelte JS-Ausnahmen der Seite.
 */
test('Chart-Demo rendert Seiten ohne unbehandelte Fehler', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/?demo=chart');

  // Die ChordPro→PDF-Seiten werden als Canvas gerendert (pdf.js). Auf mindestens eine warten.
  const firstCanvas = page.locator('canvas').first();
  await expect(firstCanvas).toBeVisible({ timeout: 30_000 });
  expect(await page.locator('canvas').count()).toBeGreaterThan(0);

  // Keine unbehandelten Ausnahmen (ErrorBoundary-Meldung darf nicht erscheinen).
  await expect(page.getByText('Das dauert länger')).toHaveCount(0);
  expect(pageErrors, `Seitenfehler: ${pageErrors.join(' | ')}`).toEqual([]);
});
