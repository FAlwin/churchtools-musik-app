import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import setlistRoutes from './routes/setlist.js';

const app = express();

// Pfad zur gebauten Web-App (client/dist), relativ zu dieser Datei
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

// Hinter dem Cloudflare-Tunnel/Reverse-Proxy: X-Forwarded-Proto vertrauen,
// damit secure-Cookies korrekt gesetzt werden.
if (config.isProduction) app.set('trust proxy', 1);

// ── Sicherheit & Basis-Middleware ───────────────────────────
// CSP aus: die App lädt externe Schriftarten + nutzt blob/worker (pdf.js).
// Interne Gemeinde-App; die übrigen Helmet-Header bleiben aktiv.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json());
app.use(cookieParser(config.sessionSecret));

// Allgemeines Rate-Limit (Login bekommt in Schritt 7 ein strengeres)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── Routen ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv });
});

app.use('/api/auth', authRoutes);
app.use('/api', setlistRoutes);

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
