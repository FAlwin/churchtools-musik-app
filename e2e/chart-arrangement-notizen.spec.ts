import { test, expect } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';

/**
 * #320: Seit die Anmerkungs-Schlüssel das Arrangement tragen, sucht die App unter einem NEUEN
 * Schlüssel – der Bestand liegt unter dem alten. Ohne die Migration sähe ein Bestandsnutzer seine
 * handgezeichneten Notizen als verschwunden an.
 *
 * Warum als E2E: Die reine Rechnung ist in `arrangementMigration.test.ts` geprüft. Hier geht es um
 * etwas anderes – dass sie beim Öffnen des Liederhefts **wirklich läuft**, und zwar bevor gezeichnet
 * wird. Genau diese Naht (Rechnung stimmt, wird aber nirgends gerufen) ist im Projekt schon mehrfach
 * das Problem gewesen; zuletzt heute bei der Zählweise, die nie synchronisiert wurde.
 */
const LIED = 999001; // Demo-Lied; sein Arrangement trägt dieselbe Nummer
const ALT = `worship_docdraw_song${LIED}_voriginal_0`;
const NEU = `worship_docdraw_song${LIED}_a${LIED}_voriginal_0`;
const STRICHE = '[[[10,10],[20,20]]]';

test('Bestandsnotizen überleben das Arrangement-Segment', async ({ page }) => {
  await page.addInitScript(
    ({ tour, alt, striche }: { tour: string; alt: string; striche: string }) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem(alt, striche);
      localStorage.setItem(`${alt}_text`, '[{"t":"hallo"}]');
    },
    { tour: TOUR_CHART, alt: ALT, striche: STRICHE },
  );

  await page.goto('/?demo=chart');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);

  const stand = await page.evaluate(
    ({ alt, neu }: { alt: string; neu: string }) => ({
      neuStriche: localStorage.getItem(neu),
      neuText: localStorage.getItem(`${neu}_text`),
      altStriche: localStorage.getItem(alt),
    }),
    { alt: ALT, neu: NEU },
  );

  // Unter dem neuen Schlüssel zu finden – sonst wären die Notizen für den Nutzer weg.
  expect(stand.neuStriche).toBe(STRICHE);
  // Textobjekte ziehen mit; sonst bliebe der geschriebene Text zurück, während die Striche umziehen.
  expect(stand.neuText).toBe('[{"t":"hallo"}]');
  // Verlustfrei: Der Bestand bleibt als Sicherung liegen, statt umbenannt zu werden.
  expect(stand.altStriche).toBe(STRICHE);
});
