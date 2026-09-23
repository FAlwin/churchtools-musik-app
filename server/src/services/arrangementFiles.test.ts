import { describe, expect, it } from 'vitest';
import { safeFileName } from './arrangementFiles.js';

describe('safeFileName – auch ohne Zeilenumbrüche (#410)', () => {
  it('entfernt weiterhin die in Dateinamen verbotenen Zeichen', () => {
    expect(safeFileName('Ich/weiß: wer?')).toBe('Ichweiß wer');
  });

  it('ersetzt Umbrüche und Tabulatoren durch ein Leerzeichen', () => {
    expect(safeFileName('Titel\r\nContent-Type text/html')).toBe('Titel Content-Type texthtml');
    expect(safeFileName('A\tB')).toBe('A B');
  });
});
