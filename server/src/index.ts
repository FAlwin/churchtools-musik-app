import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// ── Sicherheit & Basis-Middleware ───────────────────────────
app.use(helmet());
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

// ChurchTools-Proxy & Auth folgen in Schritt 7.

// ── Fehlerbehandlung (immer zuletzt) ────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server läuft auf http://localhost:${config.port} (${config.nodeEnv})`);
});
