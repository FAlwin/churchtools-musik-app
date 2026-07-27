# Offline & PWA

Der Ernstfall: Saal ohne Netz, Gottesdienst läuft. Diese Fälle bitte **wirklich im Flugmodus**
prüfen, nicht mit gedrosseltem Netz – die Fehler treten sonst nicht auf.

### TF-OFFLINE-01 · Offline-Reserve laden

- **Priorität:** hoch
- **Betrifft:** `client/src/services/offline.ts`, `client/src/services/offlineAuto.ts`, `client/src/hooks/useOfflineReserve.ts`, `client/vite.config.ts`
- **Automatisiert:** teilweise – `client/src/services/offline.registry.test.ts`
- **Historie:** #32

1. Mit Netz den Ablauf des nächsten Gottesdienstes öffnen.
2. Alle Lieder einmal durchblättern.
3. Unter „Mehr" prüfen, ob die Offline-Reserve als geladen angezeigt wird.

**Erwartet:** Die Reserve meldet den Ablauf als verfügbar.

### TF-OFFLINE-02 · Im Flugmodus arbeiten

- **Priorität:** kritisch
- **Betrifft:** `client/src/services/offline.ts`, `client/src/services/reachability.ts`, `client/src/services/annotations.ts`, `client/src/hooks/useSetlistPages.ts`
- **Automatisiert:** nein – braucht echte Netztrennung
- **Historie:** #32

**Voraussetzung:** TF-OFFLINE-01 durchgeführt.

1. **Flugmodus einschalten.**
2. Die App schließen und neu öffnen.
3. Den Ablauf öffnen, durch alle Lieder blättern.
4. Eine Anmerkung zeichnen.
5. Flugmodus aus, eine Minute warten.
6. Auf einem zweiten Gerät nachsehen.

**Erwartet:** Ablauf und alle Charts sind ohne Netz da – auch nach dem Neustart. Die Anmerkung
lässt sich offline setzen und ist nach Schritt 5 auf dem zweiten Gerät angekommen.

### TF-OFFLINE-03 · Rückkehr online ohne Neustart

- **Priorität:** kritisch
- **Betrifft:** `client/src/services/reachability.ts`, `client/src/utils/loginError.ts`, `client/src/pages/Login.tsx`, `client/src/components/UpdateBanner.tsx`
- **Automatisiert:** teilweise – `client/src/services/reachability.test.ts`, `client/src/services/reachability.probe.test.ts`
- **Historie:** #218

1. Flugmodus ein, warten, bis der Offline-Hinweis erscheint.
2. Flugmodus aus, **ohne** die App zu schließen.
3. Kurz warten, dann etwas antippen, das Netz braucht (z. B. Termin-Liste aktualisieren).
4. Falls die App abgemeldet hat: anmelden.

**Erwartet:** Der Offline-Hinweis verschwindet von selbst, spätestens beim Zurückkehren in die App.
Die Anmeldung meldet **nicht** fälschlich „falsches Passwort". Ein kompletter Neustart der App darf
nicht nötig sein.

### TF-OFFLINE-04 · App-Wechsel behält den Zustand

- **Priorität:** hoch
- **Betrifft:** `client/src/main.tsx`, `client/src/utils/navStorage.ts`, `client/src/components/RestoreGate.tsx`, `client/src/utils/appHeight.ts`
- **Automatisiert:** nein – App-Wechsel nur am Gerät
- **Historie:** #24

**Voraussetzung:** Installierte PWA (Symbol auf dem Startbildschirm), nicht der Browser-Tab.

1. Ein Lied öffnen, auf Seite 3 blättern, hineinzoomen.
2. Zu einer anderen App wechseln, dort etwas tun.
3. Nach ein paar Minuten zurückkehren.

**Erwartet:** Dasselbe Lied, dieselbe Seite, derselbe Zoom. Kein Neuladen von vorn, kein Sprung
zurück zur Termin-Liste.

### TF-OFFLINE-05 · Nach einem Deploy kein Startfehler

- **Priorität:** hoch
- **Betrifft:** `client/src/utils/chunkReload.ts`, `client/src/components/ErrorBoundary.tsx`, `client/src/components/UpdateBanner.tsx`, `client/src/hooks/useUpdateCheck.ts`
- **Automatisiert:** teilweise – `client/src/utils/chunkReload.test.ts`
- **Historie:** #151, #179

**Voraussetzung:** Die App auf dem Gerät **geöffnet lassen**, während eine neue Version deployt wird.

1. App geöffnet lassen, neue Version deployen.
2. Am Gerät zu einem Bereich wechseln, der noch nicht geladen war (z. B. Lieder-Bibliothek).

**Erwartet:** Entweder erscheint der Aktualisierungs-Hinweis, oder die App lädt sich still neu. Es
darf **kein** roter Startfehler-Vollbildschirm kommen – der alte Fehler war ein nicht mehr
vorhandenes Nachlade-Paket.
