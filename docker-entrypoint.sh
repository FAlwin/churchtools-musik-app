#!/bin/sh
# Startet die App als unprivilegierten Benutzer „node" statt als root.
# Davor – noch als root – das Daten-Volume dem node-User übereignen. Das ist idempotent und
# korrigiert auch bestehende, früher als root angelegte Volumes (sonst könnte der node-User
# dort weder Gemeindename noch Anmerkungen speichern). Danach werden die Rechte abgegeben.
set -e
mkdir -p /app/data
chown -R node:node /app/data
exec su-exec node "$@"
