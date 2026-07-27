# Ohne Internet

Der Ernstfall: Saal ohne Netz, der Gottesdienst läuft. Bitte **wirklich den Flugmodus** einschalten –
mit schlechtem WLAN treten diese Fehler nicht auf.

### TF-OFFLINE-01 · Lieder für unterwegs speichern

**Das muss passieren:** Beim Termin erscheint ein **Wolken-Symbol**: Er ist auch ohne Internet
verfügbar.

1. Mit Internet unten auf **Termine** tippen.
2. Den nächsten Gottesdienst öffnen.
3. Jedes Lied einmal antippen und durchblättern.
4. Zurück zur Termin-Liste und auf das Symbol beim Termin schauen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/offline.ts`, `client/src/services/offlineAuto.ts`, `client/src/hooks/useOfflineReserve.ts`, `client/vite.config.ts`
- **Automatisiert:** teilweise – `client/src/services/offline.registry.test.ts`
- **Historie:** #32

</details>

### TF-OFFLINE-02 · Im Flugmodus arbeiten

**Das brauchst du:** TF-OFFLINE-01 muss vorher gelaufen sein.

**Das muss passieren:** Ablauf und alle Lieder sind ohne Internet da – auch nach dem Neustart der
App. Die Notiz lässt sich offline malen und ist nach Schritt 7 auf dem zweiten Gerät angekommen.

1. **Flugmodus einschalten.**
2. Die App ganz schließen (aus dem App-Umschalter wischen) und neu öffnen.
3. Den Termin öffnen.
4. Alle Lieder nacheinander aufrufen und durchblättern.
5. Bei einem Lied den Anmerkungsmodus einschalten und etwas malen.
6. **Flugmodus ausschalten.**
7. Eine Minute warten, dann auf einem zweiten Gerät dasselbe Lied ansehen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/services/offline.ts`, `client/src/services/reachability.ts`, `client/src/services/annotations.ts`, `client/src/hooks/useSetlistPages.ts`
- **Automatisiert:** nein – braucht echte Netztrennung
- **Historie:** #32

</details>

### TF-OFFLINE-03 · Nach dem Offline-Sein geht es von selbst weiter

**Das muss passieren:** Der Offline-Hinweis verschwindet **von allein**, spätestens wenn du zur App
zurückkommst. Falls die App dich abgemeldet hat, funktioniert die Anmeldung normal – sie darf
**nicht** fälschlich „Passwort falsch" melden. Du sollst die App **nicht** schließen müssen.

1. **Flugmodus einschalten** und warten, bis der Offline-Hinweis erscheint.
2. **Flugmodus ausschalten** – die App dabei **offen lassen**.
3. Eine halbe Minute warten und auf den Hinweis schauen.
4. Zu einer anderen App wechseln und zurückkommen.
5. Unten auf **Termine** tippen und die Liste nach unten ziehen (aktualisieren).
6. Falls eine Anmeldemaske kommt: normal anmelden.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/services/reachability.ts`, `client/src/utils/loginError.ts`, `client/src/pages/Login.tsx`, `client/src/components/UpdateBanner.tsx`
- **Automatisiert:** teilweise – `client/src/services/reachability.test.ts`, `client/src/services/reachability.probe.test.ts`
- **Historie:** #218

</details>

### TF-OFFLINE-04 · App-Wechsel behält alles bei

**Das brauchst du:** Die App muss **vom Startbildschirm** aus geöffnet sein (das Symbol, nicht der
Browser).

**Das muss passieren:** Dasselbe Lied, dieselbe Seite, dieselbe Vergrößerung. Die App darf nicht von
vorn laden und nicht zur Termin-Liste zurückspringen.

1. Ein Lied öffnen und auf Seite 3 blättern.
2. Mit zwei Fingern hineinzoomen.
3. Zu einer anderen App wechseln und dort ein paar Minuten etwas tun.
4. Zur Musik-App zurückkommen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/main.tsx`, `client/src/utils/navStorage.ts`, `client/src/components/RestoreGate.tsx`, `client/src/utils/appHeight.ts`
- **Automatisiert:** nein – App-Wechsel nur am Gerät
- **Historie:** #24

</details>

### TF-OFFLINE-05 · Nach einer neuen Version kein roter Fehlerbildschirm

**Das brauchst du:** Absprache – die App bleibt offen, während eine neue Version veröffentlicht wird.

**Das muss passieren:** Entweder erscheint der Hinweis „Neue Version verfügbar", oder die App lädt
sich still neu. Es darf **kein roter Fehlerbildschirm** kommen.

1. Die App offen lassen (Termin-Liste).
2. Neue Version deployen lassen.
3. In der App unten auf **Lieder** tippen – also einen Bereich öffnen, der noch nicht geladen war.
4. Hinschauen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/utils/chunkReload.ts`, `client/src/components/ErrorBoundary.tsx`, `client/src/components/UpdateBanner.tsx`, `client/src/hooks/useUpdateCheck.ts`
- **Automatisiert:** teilweise – `client/src/utils/chunkReload.test.ts`
- **Historie:** #151, #179

</details>
