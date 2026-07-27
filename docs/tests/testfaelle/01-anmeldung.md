# Anmelden

Der Bereich mit den teuersten Fehlern: Wer hier hängt, kommt gar nicht erst an seine Lieder – und
das merkt man meistens fünf Minuten vor dem Gottesdienst.

### TF-AUTH-01 · Anmelden und Abmelden

**Das muss passieren:** Nach dem Anmelden bist du direkt bei den Terminen. Nach dem Abmelden
kommt wieder die Anmeldemaske, und du kannst dich sofort neu anmelden – ohne die App zu schließen.

1. Falls du angemeldet bist: unten auf **Mehr** tippen, ganz nach unten scrollen, **Abmelden**.
2. E-Mail und Passwort eingeben, **Anmelden** tippen.
3. Warten, bis die Liste der Gottesdienste erscheint.
4. Unten auf **Mehr**, dann **Abmelden**.
5. Noch einmal anmelden.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/Login.tsx`, `client/src/services/api.ts`, `server/src/routes/auth.ts`, `server/src/middleware/session.ts`
- **Automatisiert:** nein – voller Anmelde-Ablauf braucht einen ChurchTools-Ersatz (#174)
- **Historie:** –

</details>

### TF-AUTH-02 · Vertippt beim Passwort – die Offline-Lieder bleiben trotzdem da

**Das brauchst du:** Die Lieder müssen vorher offline gespeichert sein (siehe TF-OFFLINE-01).

**Das muss passieren:** Bei Schritt 3 steht sinngemäß **„E-Mail oder Passwort stimmt nicht"** – und
NICHT „Sitzung abgelaufen". Bei Schritt 6 sind die Lieder trotzdem noch da. Ein Tippfehler darf die
Offline-Lieder nicht löschen.

1. Unten auf **Mehr**, dann **Abmelden**.
2. Deine E-Mail eintragen, aber ein **falsches** Passwort.
3. **Anmelden** tippen und die Fehlermeldung lesen.
4. Jetzt mit dem richtigen Passwort anmelden.
5. **Flugmodus einschalten.**
6. Einen Termin öffnen und durch die Lieder blättern.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/api.ts`, `client/src/utils/loginError.ts`, `client/src/pages/Login.tsx`, `client/src/utils/clearDeviceData.ts`
- **Automatisiert:** teilweise – `client/src/services/api.session401.test.ts`, `client/src/utils/loginError.test.ts`
- **Historie:** #210

</details>

### TF-AUTH-03 · Abgelaufene Anmeldung führt zurück zum Anmelden

**Das brauchst du:** Die Anmeldung muss ungültig werden. Am einfachsten: dich in ChurchTools (im
Browser) mit demselben Konto abmelden, während die App offen bleibt.

**Das muss passieren:** Die App zeigt die **Anmeldemaske**. Es darf **kein** Knopf „Erneut versuchen"
erscheinen, der immer wieder fehlschlägt – aus dieser Sackgasse kam man früher nur mit Ab- und
Neuanmelden raus.

1. App öffnen und angemeldet lassen.
2. Im Browser bei ChurchTools abmelden.
3. In der App unten auf **Termine** und einen Gottesdienst öffnen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/services/api.ts`, `client/src/App.tsx`, `server/src/middleware/session.ts`, `server/src/services/churchtools.ts`
- **Automatisiert:** teilweise – `client/src/services/api.session401.test.ts`
- **Historie:** #186, #104, #149

</details>

### TF-AUTH-04 · Nach dem Neu-Anmelden kommt alles wieder auf dem anderen Gerät an

**Das brauchst du:** Zwei Geräte, beide mit demselben Konto angemeldet.

**Das muss passieren:** Auf Gerät B sind die Notiz und die Tonart da. Früher blieb nach einem
Neu-Anmelden alles nur auf dem Gerät liegen – ohne jeden Hinweis, dass nichts mehr ankommt.

1. Auf **Gerät A**: unten **Mehr** → **Abmelden**, dann sofort wieder anmelden. Die App dabei
   **nicht** schließen.
2. Auf Gerät A ein Lied öffnen, oben rechts auf den **Stift** tippen und etwas malen.
3. Auf den Liedtitel oben tippen und die **Tonart** ändern.
4. Auf **Gerät B** die App schließen und neu öffnen, dasselbe Lied aufrufen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/annotations.ts`, `client/src/services/userSettings.ts`, `client/src/services/api.ts`
- **Automatisiert:** teilweise – `client/src/services/api.session401.test.ts`
- **Historie:** #211

</details>

### TF-AUTH-05 · Zu viele Fehlversuche werden verständlich gemeldet

**Das muss passieren:** Irgendwann sagt die Meldung, dass es **zu viele Versuche** waren – nicht
schon wieder nur „Passwort falsch". Nach ein paar Minuten geht die Anmeldung wieder.

1. Abmelden.
2. Fünf- bis zehnmal hintereinander mit falschem Passwort anmelden.
3. Die Meldung lesen.
4. Ein paar Minuten warten und dich richtig anmelden.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/routes/auth.ts`, `server/src/utils/ipKey.ts`, `client/src/utils/loginError.ts`
- **Automatisiert:** teilweise – `server/src/utils/ipKey.test.ts` (Schlüsselbildung), Sperre selbst nicht
- **Historie:** #146

</details>
