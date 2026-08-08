import { test, expect } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';

/**
 * Tempo-Menü (#145): **Der Rahmen darf sich nicht bewegen.**
 *
 * Gemeldet mit zwei Bildschirmfotos: Beim Antippen wuchs das Menü in beide Richtungen und sprang
 * unter dem Finger weg. Ursache war zweierlei – `min-width` statt `width` (der lange Speichern-Knopf
 * bestimmte die Breite, sobald er auftauchte) und Elemente, die es nur zeitweise gab.
 *
 * Warum als E2E und nicht als Unit-Test: Es geht um gemessene Geometrie. Ein jsdom-Test kann
 * bestätigen, dass die Elemente im Baum stehen – das tut `TempoMenu.test.tsx` –, aber nicht, dass
 * der Kasten danach gleich groß ist. Genau diese Lücke hat beim Vollbild-Fehler (#319) zweimal
 * dazu geführt, dass ein Fix „grün" war und der Fehler blieb.
 */
test('Tempo-Menü: der Rahmen bleibt in jedem Zustand gleich', async ({ page }) => {
  // Die geführte Einführung würde die Klicks abfangen – vorab als gesehen markieren.
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
  }, TOUR_CHART);

  await page.goto('/?demo=chart');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /^Tempo:/ }).click();
  const menu = page.locator('[class*="tempoMenu"]');
  await expect(menu).toBeVisible();

  /** Kasten auf ganze Pixel – Größe UND Stelle, denn beides sprang. */
  const rahmen = async () => {
    const b = await menu.boundingBox();
    if (!b) throw new Error('Menü nicht messbar');
    return {
      x: Math.round(b.x),
      y: Math.round(b.y),
      w: Math.round(b.width),
      h: Math.round(b.height),
    };
  };

  const start = await rahmen();

  // 1. Wert erhöhen → Speichern-Knopf und „Zurücksetzen" werden aktiv, Hinweistext wechselt.
  // Alle Knöpfe INNERHALB des Menüs suchen: Der Kopfzeilen-Knopf heißt „Tempo: Puls, Klick und
  // Tempo antippen" und passt sonst auf dieselbe Suche.
  await menu.getByRole('button', { name: 'Tempo erhöhen' }).click();
  expect(await rahmen()).toEqual(start);

  // 2. Antippen – der Zustand, in dem es gemeldet wurde.
  const tap = menu.getByRole('button', { name: /Tempo antippen/ });
  for (let i = 0; i < 4; i++) {
    await tap.click();
    await page.waitForTimeout(250);
  }
  expect(await rahmen()).toEqual(start);

  // 3. Dreistellige Zahl im Feld – die breiteste Beschriftung auf dem Speichern-Knopf.
  await menu.getByRole('textbox').fill('300');
  await page.waitForTimeout(150);
  expect(await rahmen()).toEqual(start);

  // 4. Zurück auf den Ausgangswert → Knöpfe wieder abgeblendet, Text wieder kurz.
  await menu.getByRole('button', { name: 'Zurücksetzen' }).click();
  await page.waitForTimeout(150);
  expect(await rahmen()).toEqual(start);
});

test('Tempo-Menü: die Kopfzeile zeigt das EINGESTELLTE Tempo', async ({ page }) => {
  // Puls und Klick laufen mit dem eingestellten Wert. Zeigte die Kopfzeile weiter das gespeicherte,
  // stünde dort eine Zahl, während eine andere tickt.
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
  }, TOUR_CHART);

  await page.goto('/?demo=chart');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  const kopfInfo = page.locator('[class*="menuInfo"]').first();
  const vorher = (await kopfInfo.innerText()).trim();

  await page.getByRole('button', { name: /^Tempo:/ }).click();
  await page.locator('[class*="tempoMenu"]').getByRole('textbox').fill('137');
  await page.waitForTimeout(200);

  await expect(kopfInfo).toContainText('137');
  expect((await kopfInfo.innerText()).trim()).not.toBe(vorher);
});
