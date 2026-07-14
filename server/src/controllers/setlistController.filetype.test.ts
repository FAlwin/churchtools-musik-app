import { describe, it, expect } from 'vitest';
import { sanitizeFileContentType } from './setlistController.js';

describe('sanitizeFileContentType (#138 – Datei-Proxy Content-Type härten)', () => {
  it('PDF und Rasterbilder werden inline mit unverändertem Content-Type ausgeliefert', () => {
    for (const t of ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      expect(sanitizeFileContentType(t)).toEqual({ contentType: t, attachment: false });
    }
  });

  it('Content-Type mit charset/Parametern wird korrekt erkannt (inline)', () => {
    expect(sanitizeFileContentType('text/plain; charset=utf-8')).toEqual({
      contentType: 'text/plain; charset=utf-8',
      attachment: false,
    });
    expect(sanitizeFileContentType('APPLICATION/PDF')).toEqual({
      contentType: 'APPLICATION/PDF',
      attachment: false,
    });
  });

  it('HTML/JS werden NICHT inline ausgeliefert → octet-stream + attachment (Stored-XSS-Schutz)', () => {
    for (const t of ['text/html', 'application/javascript', 'text/html; charset=utf-8']) {
      expect(sanitizeFileContentType(t)).toEqual({
        contentType: 'application/octet-stream',
        attachment: true,
      });
    }
  });

  it('SVG wird bewusst als Download behandelt (kann Skripte enthalten)', () => {
    expect(sanitizeFileContentType('image/svg+xml')).toEqual({
      contentType: 'application/octet-stream',
      attachment: true,
    });
  });

  it('leerer/unbekannter Content-Type → octet-stream + attachment', () => {
    expect(sanitizeFileContentType('')).toEqual({
      contentType: 'application/octet-stream',
      attachment: true,
    });
    expect(sanitizeFileContentType('application/x-msdownload')).toEqual({
      contentType: 'application/octet-stream',
      attachment: true,
    });
  });
});
