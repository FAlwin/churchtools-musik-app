# Anmeldung & Sitzung

Der Bereich mit den teuersten Fehlern: Wer hier hängt, kommt gar nicht erst an seine Charts – und
zwar meistens fünf Minuten vor dem Gottesdienst.

### TF-AUTH-01 · Anmelden und Abmelden

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/Login.tsx`, `client/src/services/api.ts`, `server/src/routes/auth.ts`, `server/src/middleware/session.ts`
- **Automatisiert:** nein – voller Auth-Flow braucht einen ChurchTools-Stub (#174)
- **Historie:** –

**Voraussetzung:** Abgemeldet.

1. E-Mail und Passwort eingeben, anmelden.
2. Die Termin-Liste abwarten.
3. Über „Mehr" abmelden.
4. Erneut anmelden.

**Erwartet:** Anmelden führt direkt zur Termin-Liste. Nach dem Abmelden erscheint wieder die
Anmeldemaske, und die erneute Anmeldung funktioniert ohne Neustart der App.

### TF-AUTH-02 · Falsches Passwort löscht die Offline-Reserve NICHT

- **Priorität:** hoch
- **Betrifft:** `client/src/services/api.ts`, `client/src/utils/loginError.ts`, `client/src/pages/Login.tsx`, `client/src/utils/clearDeviceData.ts`
- **Automatisiert:** teilweise – `client/src/services/api.session401.test.ts`, `client/src/utils/loginError.test.ts`
- **Historie:** #210

**Voraussetzung:** Offline-Reserve geladen (TF-OFFLINE-01), danach abgemeldet.

1. Anmelden mit **absichtlich falschem** Passwort.
2. Die Fehlermeldung lesen.
3. Mit dem richtigen Passwort anmelden.
4. In den Flugmodus gehen und einen Ablauf öffnen.

**Erwartet:** Schritt 2 meldet sinngemäß „E-Mail oder Passwort stimmt nicht" – **nicht** „Sitzung
abgelaufen". Und in Schritt 4 sind die Lieder noch da: Der Tippfehler darf die Offline-Reserve nicht
gelöscht haben.

### TF-AUTH-03 · Abgelaufene Sitzung führt zum Login, nicht in die Sackgasse

- **Priorität:** kritisch
- **Betrifft:** `client/src/services/api.ts`, `client/src/App.tsx`, `server/src/middleware/session.ts`, `server/src/services/churchtools.ts`
- **Automatisiert:** teilweise – `client/src/services/api.session401.test.ts`
- **Historie:** #186, #104, #149

**Voraussetzung:** Angemeldet. Die Sitzung muss serverseitig ungültig werden – am einfachsten, indem
sich jemand in ChurchTools als dasselbe Konto abmeldet, oder durch Warten bis zum Ablauf.

1. Mit ungültiger Sitzung einen Ablauf öffnen.

**Erwartet:** Die App führt **zum Anmeldebildschirm**. Es erscheint **kein** „Erneut versuchen", das
ins Leere läuft – das war die alte Sackgasse, aus der nur Ab- und Neuanmelden half.

### TF-AUTH-04 · Nach erneuter Anmeldung wird wieder synchronisiert

- **Priorität:** hoch
- **Betrifft:** `client/src/services/annotations.ts`, `client/src/services/userSettings.ts`, `client/src/services/api.ts`
- **Automatisiert:** teilweise – `client/src/services/api.session401.test.ts`
- **Historie:** #211

**Voraussetzung:** Zwei Geräte am selben Konto.

1. Auf Gerät A abmelden und wieder anmelden (ohne die App zu schließen).
2. Auf Gerät A eine Anmerkung zeichnen und eine Tonart ändern.
3. Auf Gerät B die App neu laden.

**Erwartet:** Anmerkung und Tonart sind auf Gerät B da. Der Fehler war: Nach einem automatischen
Abmelden blieb der Sync für die restliche Sitzung **still** abgeschaltet – alles landete nur noch
lokal, ohne jeden Hinweis.

### TF-AUTH-05 · Zu viele Fehlversuche werden verständlich gemeldet

- **Priorität:** normal
- **Betrifft:** `server/src/routes/auth.ts`, `server/src/utils/ipKey.ts`, `client/src/utils/loginError.ts`
- **Automatisiert:** teilweise – `server/src/utils/ipKey.test.ts` (Schlüsselbildung), Sperre selbst nicht
- **Historie:** #146

1. Mehrfach hintereinander mit falschem Passwort anmelden, bis die Sperre greift.

**Erwartet:** Eine Meldung, die die Sperre benennt („zu viele Versuche"), nicht wieder nur „Passwort
falsch". Nach der Wartezeit funktioniert die Anmeldung wieder.
