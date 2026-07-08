import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import setlistRoutes from './routes/setlist.js';
import siteConfigRoutes from './routes/siteConfig.js';
import annotationsRoutes from './routes/annotations.js';
import updateRoutes from './routes/update.js';

const app = express();

// Pfad zur gebauten Web-App (client/dist), relativ zu dieser Datei
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

// Hinter dem Cloudflare-Tunnel/Reverse-Proxy: X-Forwarded-Proto vertrauen,
// damit secure-Cookies korrekt gesetzt werden.
if (config.isProduction) app.set('trust proxy', 1);

// ── Sicherheit & Basis-Middleware ───────────────────────────
// Content-Security-Policy: In Produktion restriktiv (zusätzliche Schutzschicht gegen XSS),
// in der Entwicklung AUS – dort liefert der Vite-Dev-Server das HTML aus (mit HMR + Inline-
// Scripts/eval); eine strenge CSP würde ihn nur brechen. (#47)
//
// Der einzige erlaubte Inline-Script ist der Boot-Fallback in index.html (#32). Statt
// `script-src 'unsafe-inline'` (würde den XSS-Schutz aushebeln) erlauben wir ihn über seinen
// sha256-Hash. Der Hash wird beim Start aus der gebauten index.html berechnet – so wandert er
// automatisch mit, falls sich der Boot-Script je ändert (kein manuelles Nachpflegen).
function inlineScriptHashes(): string[] {
  try {
    const html = readFileSync(path.join(clientDist, 'index.html'), 'utf8');
    const hashes: string[] = [];
    // Nur Inline-Scripts (ohne src=…); externe /assets/*.js sind bereits über 'self' abgedeckt.
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    for (let m = re.exec(html); m; m = re.exec(html)) {
      hashes.push(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
    }
    return hashes;
  } catch {
    return []; // z. B. wenn (noch) kein Build vorliegt – dann greift script-src 'self'
  }
}

if (config.isProduction) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          // App-JS liegt als externe /assets/*.js (self); Boot-Fallback via Hash. Kein unsafe-inline.
          scriptSrc: ["'self'", ...inlineScriptHashes()],
          // Inline-Styles nötig: Boot-Fallback nutzt style="…" und React setzt zur Laufzeit
          // dynamische Styles (z. B. Slide-Transform beim Blättern). Style-Injektion ist ungefährlich.
          styleSrc: ["'self'", "'unsafe-inline'"],
          // Logo (base64-DataURL) + Anmerkungs-PNGs (DataURL/Blob) + gerenderte PDF-Seiten.
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"], // System-Font, kein Web-Font
          connectSrc: ["'self'"], // Client spricht nur mit dem eigenen /api-Proxy
          workerSrc: ["'self'", 'blob:'], // pdf.js-Worker ist inline → Blob-URL
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          manifestSrc: ["'self'"],
          // BEWUSST KEIN upgrade-insecure-requests: Die App lädt ausschließlich relative,
          // same-origin Ressourcen (nichts hochzustufen), aber die Direktive würde im reinen
          // LAN-HTTP-Betrieb (Staging + Gemeinden ohne HTTPS) das App-JS auf https:// erzwingen
          // → JS lädt nicht → nur der Boot-Fallback erscheint. Über HTTPS wäre sie wirkungslos.
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
} else {
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
}
// Limit höher: Logo (base64) + Anmerkungs-Striche einer Seite (PNG-DataURL) müssen hineinpassen.
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser(config.sessionSecret));

// Allgemeines Rate-Limit – NUR auf echte API-Aktionen (`/api`), nicht auf statische
// Frontend-Dateien (JS/CSS/Icons); die zählten sonst jede beim App-Laden mit.
// Gezählt wird PRO ANGEMELDETEM NUTZER (Session-Cookie), sonst pro IP: Im Gemeinde-WLAN gehen
// alle Geräte über EINE öffentliche IP raus – ohne Nutzer-Schlüssel teilte sich das ganze Team
// ein Kontingent und lief sofort in „Too many requests". (Login bekommt zusätzlich ein strengeres.)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      (req.signedCookies?.ct_session as string | undefined) || req.ip || 'unbekannt',
  }),
);

// ── Routen ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv });
});

app.use('/api/auth', authRoutes);
app.use('/api', siteConfigRoutes);
app.use('/api', updateRoutes); // öffentlich – vor den session-geschützten Routern mounten
app.use('/api', setlistRoutes);
app.use('/api', annotationsRoutes);

// ── Im Produktionsbetrieb: die gebaute Web-App ausliefern ───
if (config.isProduction) {
  app.use(express.static(clientDist));
  // SPA-Fallback: alle Nicht-API-Pfade auf index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Fehlerbehandlung (immer zuletzt) ────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server läuft auf http://localhost:${config.port} (${config.nodeEnv})`);
});
