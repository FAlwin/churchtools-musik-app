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
RUN npm run build --workspace=client

ENV NODE_ENV=production
ENV PORT=3001
# Laufzeit-Branding (White-Label) + kontobezogene Anmerkungen liegen im Volume /app/data – überstehen Updates.
ENV SITE_CONFIG_PATH=/app/data/site.json
ENV ANNOTATIONS_PATH=/app/data/annotations
EXPOSE 3001
VOLUME ["/app/data"]

# Server starten (liefert /api + die gebaute App unter client/dist aus)
CMD ["npm", "run", "start", "--workspace=server"]
