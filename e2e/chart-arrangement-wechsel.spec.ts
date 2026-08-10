import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Arrangement umschalten (#320) – gegen den ChurchTools-Stub, also mit echtem Server.
 *
 * **Warum das nur hier prüfbar ist:** Der Wechsel gilt lokal, in ChurchTools wird nichts geändert.
 * Der Client muss die Chart-Daten des anderen Arrangements deshalb SELBST holen und den Eintrag in
 * der Liederliste ersetzen. Ob diese Kette hält – Menü → Einstellung → Abruf → Ersetzung – sagt kein
 * Unit-Test; die Demo-Ansicht hat gar kein Backend, das die Arrangements liefern könnte.
 *
 * Das zweite Arrangement des Stubs hat eine andere Tonart UND eine andere Datei. So belegt der Test,
 * dass wirklich ein anderes Blatt geladen wurde und nicht bloß der Name wechselte.
 */
const TOUREN = [TOUR_TERMINE, TOUR_CHART, TOUR_SETLIST, TOUR_SETLIST_EDIT];

test('das Arrangement lässt sich umschalten – lokal, mit neuem Notenblatt', async ({ page }) => {
  await page.addInitScript((touren: string[]) => {
    for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
  }, TOUREN);

  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('test@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible({ timeout: 20_000 });
  await page.getByText('Gottesdienst (Stub)').click();
  await page.getByText('Testlied aus ChurchTools').first().click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  const info = page.locator('[class*="menuInfo"]').first();

  /**
   * Definierter Anfang – und der Grund dafür ist selbst ein Befund:
   *
   * Die Wahl wandert zum KONTO. Ein früherer Lauf hinterließ sie deshalb auf dem Server, und der
   * spielte sie beim Anmelden zurück – der Test startete beim zweiten Mal schon auf „Unplugged" und
   * fiel. Das ist keine Fehlfunktion, sondern der Beleg, dass die Einstellung synchronisiert wird;
   * ein Test darf sich davon nur nicht abhängig machen.
   *
   * Deshalb hier zuerst ausdrücklich auf das Ablauf-Arrangement stellen. Am Ende steht dieselbe
   * Wahl wieder – der Lauf hinterlässt also keinen Zustand für den nächsten.
   */
  await page.locator('[class*="menuBtn"]').first().click();
  await expect(page.getByText('Arrangement')).toBeVisible();
  await page.getByText('Standard', { exact: true }).click();
  await expect(info).toContainText('Standard', { timeout: 20_000 });
  await expect(info).toContainText('G');

  // ── Umschalten über das Lied-Menü ──────────────────────────────────────────
  await page.locator('[class*="menuBtn"]').first().click();
  await page.getByText('Unplugged', { exact: true }).click();

  // Der Name wechselt – und mit ihm die Tonart, die am ANDEREN Arrangement hängt. Genau das belegt,
  // dass das Blatt neu geladen wurde.
  await expect(info).toContainText('Unplugged', { timeout: 20_000 });
  await expect(info).toContainText('D');

  // ── Die Wahl überlebt einen Neustart, gilt aber nur lokal ──────────────────
  const gemerkt = await page.evaluate(() => localStorage.getItem('worship_arr_501'));
  expect(gemerkt).toBe('9002');

  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  await expect(info).toContainText('Unplugged', { timeout: 20_000 });

  // ── Zurück auf das Arrangement aus dem Ablauf = „keine eigene Wahl" ────────
  await page.locator('[class*="menuBtn"]').first().click();
  await page.getByText('Standard', { exact: true }).click();
  await expect(info).toContainText('Standard', { timeout: 20_000 });
  // Nicht als Nummer gemerkt: Ändert das Team den Ablauf später, folgt die App wieder.
  expect(await page.evaluate(() => localStorage.getItem('worship_arr_501'))).toBeNull();
});
