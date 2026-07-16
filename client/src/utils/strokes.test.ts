import { describe, it, expect } from 'vitest';
import { mergeStrokes } from './strokes';

const PNG = 'data:image/png;base64,AAAA';
const OTHER = 'data:image/png;base64,BBBB';

describe('mergeStrokes (reine Zweige)', () => {
  it('gibt die fremde Ebene zurück, wenn keine eigene existiert', async () => {
    await expect(mergeStrokes(null, OTHER)).resolves.toBe(OTHER);
  });
  it('gibt die eigene Ebene zurück, wenn keine fremde existiert', async () => {
    await expect(mergeStrokes(PNG, null)).resolves.toBe(PNG);
  });
  it('gibt null zurück, wenn beide fehlen', async () => {
    await expect(mergeStrokes(null, null)).resolves.toBeNull();
  });
});
