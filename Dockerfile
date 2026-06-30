# Ein Image: baut die Web-App und startet den Server, der API + App ausliefert.
FROM node:22-alpine

WORKDIR /app

# Erst nur die Manifeste kopieren (besseres Caching der Installation)
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci

# Restlichen Quellcode kopieren und die Web-App bauen
COPY . .
# App-Version: vom CI aus dem Git-Tag als Build-Arg übergeben (z. B. v2.1.5); lokal „dev".
# Vite stellt VITE_*-Variablen zur Build-Zeit als import.meta.env bereit → Anzeige im Mehr-Tab.
ARG APP_VERSION=dev
RUN VITE_APP_VERSION="$APP_VERSION" npm run build --workspace=client

ENV NODE_ENV=production
ENV PORT=3001
# Laufzeit-Branding (White-Label) + kontobezogene Anmerkungen liegen im Volume /app/data – überstehen Updates.
ENV SITE_CONFIG_PATH=/app/data/site.json
ENV ANNOTATIONS_PATH=/app/data/annotations
EXPOSE 3001
VOLUME ["/app/data"]

# Lebenszeichen-Check: Docker/Container-Manager erkennt, ob die App wirklich antwortet
# (busybox-wget ist in node:alpine vorhanden). Greift auf den öffentlichen Health-Endpunkt zu.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3001/api/health || exit 1

# Server starten (liefert /api + die gebaute App unter client/dist aus)
CMD ["npm", "run", "start", "--workspace=server"]
