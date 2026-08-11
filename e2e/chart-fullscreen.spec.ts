import { test, expect } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';

/**
 * Vollbild (#319): Beim Tipp in die Mitte verschwinden Kopf- und Fußzeile, die Anzeigefläche wird
 * höher – und beim Zurückschalten wieder niedriger. **Die sichtbare Seite muss danach in die neue
 * Fläche passen.**
 *
 * Warum als E2E und nicht als Unit-Test: Es geht um echte Geometrie – gerenderte PDF-Seiten, CSS,
 * die Zoom-Bibliothek. Genau da haben mich Annahmen zweimal in die Irre geführt: Im Hochformat ist
 * die Seite BREITENbegrenzt und ein Fehler in der Höhe unsichtbar; im lokalen Browser wurde der
 * Seitenaufbau gedrosselt, sobald die Vorschau nicht sichtbar war. Hier läuft alles echt.
 *
 * Das Fenster ist bewusst **hochkant und groß** (wie Alwins Fenster): Nur so ist die Seite
 * höhenbegrenzt, und nur dann fällt ein fehlendes Einpassen überhaupt auf.
 */
test.use({ viewport: { width: 1200, height: 1400 } });

test('Vollbild: die Seite passt in beiden Zuständen in die Fläche', async ({ page }) => {
  // Die geführte Einführung würde die Klicks abfangen – vorab als gesehen markieren.
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
  }, TOUR_CHART);

  await page.goto('/?demo=chart');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  const flaeche = page.locator('[class*="chartArea"]');
  const seite = page.locator('canvas').first();

  /** Passt die sichtbare Seite in ihre Fläche? Liefert den Überstand in Pixeln. */
  const ueberstand = async (): Promise<number> => {
    const a = await flaeche.boundingBox();
    const s = await seite.boundingBox();
    if (!a || !s) throw new Error('Fläche oder Seite nicht messbar');
    return Math.round(s.height - a.height);
  };

  /** Tipp in die MITTE der Anzeigefläche (nicht an den Rand – dort wird geblättert). */
  const tippMitte = async () => {
    const a = await flaeche.boundingBox();
    if (!a) throw new Error('Fläche nicht messbar');
    await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
    await page.waitForTimeout(700); // Einpassen läuft über eine kurze Animation
  };

  const kopfzeile = page.locator('[class*="hdr"]');

  // Ausgangslage: Leisten da, Seite passt.
  await expect(kopfzeile).toBeVisible();
  expect(await ueberstand()).toBeLessThanOrEqual(2);

  // Ins Vollbild: Leisten weg, Seite nutzt die größere Fläche und passt weiterhin.
  await tippMitte();
  await expect(kopfzeile).toHaveCount(0);
  expect(await ueberstand()).toBeLessThanOrEqual(2);

  // Zurück: Leisten da, und die Seite darf NICHT in Vollbild-Größe stehen bleiben.
  // Genau das war der gemeldete Fehler – der Text ragte hinter die Fußzeile.
  await tippMitte();
  await expect(kopfzeile).toBeVisible();
  expect(await ueberstand()).toBeLessThanOrEqual(2);
});

test('Vollbild BEHÄLT den Zoom – es blendet nur die Leisten aus', async ({ page }) => {
  /**
   * Die ursprüngliche Fassung dieses Tests prüfte das GEGENTEIL: „auch eine vergrößerte Seite wird
   * wieder eingepasst". Das war meine Auslegung des ersten Berichts („Text wird verdeckt") und ging
   * an der Absicht vorbei. Alwin im Klartext:
   *
   *   „Was ich eigentlich erwarte ist, dass der Vollbildmodus den Zoom einfach beibehält und nur
   *    die Leisten oben und unten ausblendet … Im gezoomten Lied klicken setzt den Zoom zurück."
   *
   * Ein Test, der eine falsch verstandene Anforderung festhält, ist schlimmer als keiner: Er macht
   * den Fehler dauerhaft. Deshalb umgeschrieben statt gelöscht – die Zusage steht jetzt richtig da.
   */
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
  }, TOUR_CHART);

  await page.goto('/?demo=chart');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  const flaeche = page.locator('[class*="chartArea"]');
  const a = (await flaeche.boundingBox())!;
  const mx = a.x + a.width / 2;
  const my = a.y + a.height / 2;

  /** Die tatsächlich wirkende Vergrößerung. */
  const skala = () =>
    page.evaluate(() => {
      const t = document.querySelector('.react-transform-component');
      return t ? +new DOMMatrix(getComputedStyle(t).transform).a.toFixed(2) : -1;
    });

  // Hineinzoomen wie mit zwei Fingern.
  await page.mouse.move(mx, my);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);

  const gezoomt = await skala();
  expect(gezoomt).toBeGreaterThan(1.2); // Vorbedingung: Es ist wirklich vergrößert.

  // Ins Vollbild – die Vergrößerung muss BLEIBEN.
  await page.mouse.click(mx, my);
  await expect(page.locator('[class*="hdr"]')).toHaveCount(0);
  await page.waitForTimeout(700);
  expect(await skala()).toBe(gezoomt);

  // Und zurück – ebenfalls unverändert.
  await page.mouse.click(mx, my);
  await expect(page.locator('[class*="hdr"]')).toBeVisible();
  await page.waitForTimeout(700);
  expect(await skala()).toBe(gezoomt);

  // Auch nach längerem Stehen: Kein Abgleich darf daran rühren (der 30-Sekunden-Fall).
  await page.waitForTimeout(2000);
  expect(await skala()).toBe(gezoomt);
});
