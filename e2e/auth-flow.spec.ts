import { test, expect } from '@playwright/test';

/**
 * Voller Auth-Flow gegen den ChurchTools-Stub (#174): Anmelden → Termin → Ablauf → Chart → Anmerkung
 * → Abgleich.
 *
 * Das ist der Weg, der im Gottesdienst zählt, und er lief bisher in keinem automatischen Test: Der
 * vorhandene Render-Smoke (`?demo=chart`) mountet die Chart-Ansicht **ohne** Backend und sagt über
 * Login, Rechte und Sync nichts. Hier läuft der **echte** Server mit seiner echten Session-, Rechte-
 * und Proxy-Logik – nur ChurchTools selbst ist ersetzt (`e2e/ct-stub.mjs`).
 *
 * Genau in diesem Bereich lagen die Fehler, die diese App am häufigsten getroffen haben: eine
 * abgelaufene Anmeldung, die in eine Sackgasse führte (#186), ein Sync, der nach dem Neu-Anmelden
 * tot blieb (#211), und Anmerkungen, die still verschwanden (#245/#256).
 *
 * Die geführte Einführung legt sich beim ersten Öffnen als Dialog über die Seite und fängt Klicks ab.
 * Für den Flow-Test wird sie deshalb vorab als gesehen markiert – dass sie beim ERSTEN Mal erscheint,
 * prüft ein eigener Test.
 */
const TOUREN = ['termine-v2', 'chart-v2', 'setlist-v1', 'setlist-edit-v1'];

test.describe('Auth-Flow mit ChurchTools-Stub', () => {
  test('Anmelden, Termin öffnen, Chart sehen, anmerken – die Anmerkung geht zum Konto', async ({
    page,
  }) => {
    await page.addInitScript((touren: string[]) => {
      for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
    }, TOUREN);

    const konsolenfehler: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') konsolenfehler.push(m.text());
    });

    // ── Anmelden ──────────────────────────────────────────────────────────────
    await page.goto('/');
    await page.getByLabel(/E-Mail/i).fill('test@example.org');
    await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
    await page.getByRole('button', { name: /Anmelden/i }).click();

    // Die Terminliste ist da – also haben Login, Session-Cookie UND die Rechte-Abfrage funktioniert.
    await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible({ timeout: 20_000 });

    // ── Ablauf öffnen ─────────────────────────────────────────────────────────
    await page.getByText('Gottesdienst (Stub)').click();
    await expect(page.getByText('Begrüßung')).toBeVisible();
    // Der Lied-Punkt zeigt Titel UND Liedname (#200).
    await expect(page.getByText('Testlied aus ChurchTools')).toBeVisible();

    // ── Chart öffnen ──────────────────────────────────────────────────────────
    await page.getByText('Testlied aus ChurchTools').first().click();
    // Der Seitenstrom wird aus dem ChordPro der Stub-Datei gebaut → mindestens eine Seite rendert.
    const seiten = page.locator('canvas');
    await expect(seiten.first()).toBeVisible({ timeout: 30_000 });

    // ── Anmerken und Abgleich ─────────────────────────────────────────────────
    // Auf den PUT zum eigenen Backend warten, während wir zeichnen. Das ist der Beweis, dass die
    // Anmerkung den Weg bis zum Konto nimmt – nicht nur ins localStorage.
    const syncPut = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().includes('/api/annotations/'),
      { timeout: 20_000 },
    );

    await page.getByTitle('Anmerkungen').click();
    const flaeche = seiten.first();
    const box = await flaeche.boundingBox();
    expect(box).not.toBeNull();
    // Einen kurzen Strich ziehen (Zeigergerät-Ereignisse, wie ein Finger/Stift).
    await page.mouse.move(box!.x + box!.width * 0.3, box!.y + box!.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.5, { steps: 8 });
    await page.mouse.up();

    const request = await syncPut;
    // Der Schlüssel muss der Lied-/Versions-Grammatik folgen (#250) – sonst lehnt der Server ihn ab.
    expect(decodeURIComponent(request.url())).toMatch(
      /\/api\/annotations\/song\d+_v[a-z0-9-]+_\d+/i,
    );

    const antwort = await request.response();
    expect(antwort?.status()).toBe(200);

    // Keine unbehandelten Fehler auf dem ganzen Weg.
    expect(konsolenfehler).toEqual([]);
  });

  test('beim ersten Öffnen erscheint die geführte Einführung', async ({ page }) => {
    // Gegenstück zum Überspringen oben: Ohne Merker MUSS sie kommen – sonst sieht ein neuer
    // Mitspieler sie nie, und das würde niemandem auffallen.
    await page.goto('/');
    await page.getByLabel(/E-Mail/i).fill('test@example.org');
    await page.getByLabel(/Passwort/i).fill('egal');
    await page.getByRole('button', { name: /Anmelden/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    await page.getByText(/Überspringen/i).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('ein unbrauchbares Session-Cookie wird beim ersten Aufruf entsorgt (#268)', async ({
    page,
    context,
    baseURL,
  }) => {
    /**
     * Der Fall aus der Praxis: Das Cookie ist noch da, aber unlesbar (gewechseltes `SESSION_SECRET`
     * oder ein CT-Anteil, der sich nicht entschlüsseln lässt). Es wurde bisher nur ignoriert, nicht
     * gelöscht – der Browser schickte eine tote Anmeldung also bis zu 30 Tage bei JEDER Anfrage mit.
     *
     * ⚠️ Was dieser Test bewusst NICHT behauptet: dass das Anmelden dadurch blockiert war. Genau das
     * hatte ich zuerst geprüft – der Test war auch OHNE die Middleware grün, weil das frische
     * Login-Cookie das kaputte ohnehin überschreibt. Geprüft wird deshalb der Unterschied, den es
     * wirklich gibt: **ohne Anmeldung** ist das Cookie hinterher weg.
     */
    await context.addCookies([
      { name: 'ct_session', value: 's:voelliger-unsinn.kaputte-signatur', url: baseURL! },
    ]);

    await page.goto('/');
    // Auf die Statusabfrage warten – erst danach steht die Antwort mit dem Lösch-Header.
    await page.waitForResponse((r) => r.url().includes('/api/auth/me'), { timeout: 20_000 });

    expect((await context.cookies()).find((c) => c.name === 'ct_session')).toBeUndefined();
  });

  test('ohne Anmeldung führt der Weg zum Login, nicht in eine Sackgasse (#186)', async ({
    page,
  }) => {
    await page.goto('/');
    // Ohne Session muss die Anmeldemaske stehen – und kein „Erneut versuchen"-Schirm.
    await expect(page.getByRole('button', { name: /Anmelden/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Erneut versuchen/i)).toHaveCount(0);
  });
});
