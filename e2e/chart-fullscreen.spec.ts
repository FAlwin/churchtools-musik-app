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

test('Vollbild: auch eine vergrößerte Seite wird wieder eingepasst', async ({ page }) => {
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
  }, TOUR_CHART);

  await page.goto('/?demo=chart');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  const flaeche = page.locator('[class*="chartArea"]');
  const seite = page.locator('canvas').first();
  const a = await flaeche.boundingBox();
  if (!a) throw new Error('Fläche nicht messbar');
  const mx = a.x + a.width / 2;
  const my = a.y + a.height / 2;

  // Hineinzoomen wie mit zwei Fingern – Strg + Mausrad ist der Desktop-Weg derselben Geste.
  await page.mouse.move(mx, my);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);

  const vergroessert = await seite.boundingBox();
  const flaecheJetzt = await flaeche.boundingBox();
  if (!vergroessert || !flaecheJetzt) throw new Error('nicht messbar');
  // Vorbedingung des Tests: Es ist wirklich vergrößert. Sonst prüft er nichts.
  expect(vergroessert.height).toBeGreaterThan(flaecheJetzt.height);

  // Umschalten – danach muss die Seite wieder in die Fläche passen.
  await page.mouse.click(mx, my);
  await page.waitForTimeout(900);

  const nachher = await seite.boundingBox();
  const flaecheNachher = await flaeche.boundingBox();
  if (!nachher || !flaecheNachher) throw new Error('nicht messbar');
  expect(Math.round(nachher.height - flaecheNachher.height)).toBeLessThanOrEqual(2);
});
