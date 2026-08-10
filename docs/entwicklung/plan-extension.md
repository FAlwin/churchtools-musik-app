# Umsetzungsplan – ChurchTools-Extension (zweite Auslieferung derselben Codebasis)

> Status: **Entwurf, 10.08.2026. Noch nichts umgesetzt.**
> Ziel: dieselbe App zusätzlich als **ChurchTools-Extension** unter `/ccm/<key>/` ausliefern –
> ohne eigenen Server, ohne zweite Anmeldung, installierbar von jeder Gemeinde.
> Die bestehende Server-/PWA-Variante (NAS, `musik.ecg-donrath.de`) **bleibt** und ist der Weg für
> alles, was die Extension nicht kann.

## 1. Ziel & Abgrenzung

**Ziel** (mit Alwin am 10.08.2026 festgelegt, alle vier Punkte gleichrangig):

1. **Keine zweite Anmeldung** – wer in ChurchTools angemeldet ist, ist in der App drin.
2. **Kein eigener Server/NAS** – ChurchTools liefert die App aus; kein Docker, kein Reverse Proxy,
   kein Zertifikat.
3. **Menüpunkt in ChurchTools** – die App liegt dort, wo die Musiker ohnehin arbeiten.
4. **Für andere Gemeinden verteilbar** – ZIP installieren, fertig.

**Leitentscheidung:** Wo die Extension Grenzen setzt, wird die Funktion **weggelassen und
angeteasert** – nicht mühsam nachgebaut. Der Teaser verweist auf die Server-Variante.

**Bewusst NICHT Teil dieses Vorhabens**

- Offline-Nutzung im Saal (siehe §6 – der Grund ist technisch, nicht Faulheit).
- Ablösen der NAS-Installation der ECG. Die läuft weiter; ob und wann die ECG selbst auf die
  Extension wechselt, ist eine **eigene** Entscheidung nach dem ersten Praxiseindruck.

## 2. Getroffene Entscheidungen

| Thema           | Entscheidung                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Repo            | **Ein Repo, zwei Auslieferungen.** Kein zweites Repo, kein Fork-Abgleich (Begründung §4)         |
| Build           | `npm run build` = PWA + Server (wie heute) · `npm run build:extension` = ZIP für ChurchTools     |
| Schalter        | **Genau ein** Modus-Schalter, abgefragt **nur in der Service-Schicht** – nie in einer Komponente |
| Datenspeicher   | Anmerkungen/Einstellungen/„gesehen" in den **Custom-Module-Daten** von ChurchTools               |
| Anmeldung       | Sitzung des CT-Kontexts; `login`/`logout` entfallen in der Extension                             |
| Offline         | **Fällt weg** und wird angeteasert (§6)                                                          |
| Server-Variante | **Bleibt** im Repo – Ziel des Teasers und Rückfallebene der ECG                                  |
| Vorlage         | Der Fork von bwl21 (§3) als **Vorlage**, nicht als Grundlage – er steht auf v2.13.5              |

## 3. Ausgangslage: der Fork von bwl21

`bwl21/churchtools-musik-app`, Branch `feat/churchtools-extension`, **ein** Commit vom 22.07.2026,
17 Dateien, ausschließlich im Client. Er hat den Weg **bewiesen** – das ist der Wert dieses Forks.
Was er gelöst hat und wir übernehmen:

- `@churchtools/churchtools-client` mit `window.settings.base_url` als Laufzeit-Anbindung.
- `base: /ccm/<VITE_KEY>/` im Vite-Build, Service Worker im Extension-Modus aus.
- Custom-Module-Daten als personenbezogener Speicher (`customdatavalues`, `domainType: 'person'`).
- Packaging: Build + ZIP nach `releases/`.

**Was dort fehlt – und bei uns nicht fehlen darf:**

| Lücke                                                                                      | Folge                                                                 |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `markSetlistSeen` gibt im Extension-Modus `{ ok: true }` zurück, **ohne zu speichern**     | Das „Ablauf geändert"-Kennzeichen (#143) geht nie wieder weg          |
| `writeUserValue` liest vor **jedem** Schreiben **alle** Werte des Moduls                   | Genau die Last, die er selbst kritisiert – wächst mit jedem Lied      |
| Keine 429-Notbremse (die aus #300 sitzt im Server)                                         | Fünf Geräte überfahren die CT-Instanz wie im Juli                     |
| Teilen von Anmerkungen, fremde Anmerkungen ansehen, Branding, Update-Check nicht behandelt | Funktionen laufen ins Leere statt sauber wegzufallen                  |
| Stand v2.13.5 (16.07.)                                                                     | v2.14–v2.17 fehlen: Vollbild (#319), Metronom (#145), Härtung #273ff. |

Der Fork wird also **gelesen, nicht gemergt**.

## 4. Architektur: ein Repo, zwei Auslieferungen

Der gemeinsame Anteil ist riesig: Oberfläche, ChordPro-Verarbeitung, Transponieren, PDF-Erzeugung,
Zeichnen, Zoom, Blättern. Unterschiedlich ist einzig, **woher die Daten kommen**.

Ein zweites Repo hieße, jeden Fix am Liedblatt zweimal einzubauen. **Der Beweis liegt vor:** der Fork
ist nach drei Wochen vier Minor-Versionen zurück. Das ist die Fehlerklasse „dieselbe Regel an zwei
Stellen, Korrektur nur an einer" – in diesem Projekt schon dreimal teuer bezahlt (siehe `CLAUDE.md`).

**Die Weiche steht ausschließlich in der Service-Schicht.** Erfreulicher Befund der Voruntersuchung:
alle betroffenen Aufrufe liegen dort schon heute gebündelt –
`client/src/services/churchtoolsApi.ts`, `teamNotes.ts`, `siteConfigApi.ts`, `updateApi.ts`,
`annotations.ts`, `userSettings.ts`, `offline.ts`. Keine Komponente ruft `/api/...` direkt auf.

```
                     ┌───────────────────────────────┐
   Komponenten  ───► │  Service-Schicht (die Weiche) │ ───► ChurchTools direkt   (Extension)
   Hooks, UI         └───────────────────────────────┘ ───► eigener Server /api  (PWA/NAS)
   (kennen den Modus nicht)
```

Neu entstehen dabei:

- `client/src/services/ctRuntime.ts` – Modus-Erkennung + konfigurierter CT-Client (**die einzige
  Stelle, die `import.meta.env.MODE` liest**).
- `client/src/services/ctStore.ts` – der Datenspeicher in den Custom-Module-Daten.
- `client/src/services/ctSetlist.ts` – der Setlist-Aufbau im Browser (heute serverseitig).

## 5. Die fünf Phasen

Jede Phase hat ein Issue: **#333** (Spike) · **#334** (Speicher) · **#335** (CT-Aufrufe) ·
**#336** (Anteasern) · **#337** (Paket/Release). #333 blockiert alle übrigen.

### Phase 1 – Machbarkeits-Spike auf der Test-Instanz (#333)

Klärt die eine Frage, an der der halbe Funktionsumfang hängt. Klein halten: ein Build, ein Upload,
eine Stunde.

- [ ] Minimaler Extension-Build aus dem aktuellen `main`, eigener Key (z. B. `ecg-musik-test`)
- [ ] Custom Module in der Test-Instanz anlegen, ZIP hochladen, Menüpunkt öffnen
- [ ] Belegen – jeweils am **Netzwerk-Mitschnitt**, nicht am Gefühl:
  - [ ] `/whoami` liefert ohne eigene Anmeldung den angemeldeten Nutzer
  - [ ] Rechte lesbar (`/permissions/global`)
  - [ ] Termine, Ablauf und eine ChordPro-Datei ladbar
  - [ ] **Ein Wert in den Custom-Module-Daten schreib- und lesbar mit einem Konto OHNE
        Adminrechte** ← die Kernfrage; mit deinem Admin-Konto beweist sie nichts
  - [ ] Gibt es einen **global** (nicht personenbezogen) beschreibbaren Wert? → entscheidet, ob
        „Team-Anmerkungen teilen" überhaupt möglich ist
  - [ ] Liefert ChurchTools Gemeindename/Logo über die API? → entscheidet über das Branding
- [ ] Ergebnisse als Entscheidungstabelle in §2 dieses Plans nachtragen

**Wenn normale Nutzer nicht schreiben dürfen**, fallen Anmerkungen und persönliche Einstellungen in
der Extension weg. Dann ist die Extension eine **Ansicht** – immer noch nützlich, aber ein anderes
Produkt. Deshalb steht diese Prüfung vor allem anderen.

### Phase 2 – `ctStore`: der Datenspeicher (#334)

- [ ] `ctStore.ts` als **einzige** Stelle für Anmerkungen, Einstellungen und die „gesehen"-Basislinie
- [ ] **Index einmal laden, danach im Speicher halten** – nicht vor jedem Schreiben alles neu lesen
- [ ] Schlüssel-Grammatik unverändert aus `shared/keys` (keine zweite Grammatik!)
- [ ] `markSetlistSeen` speichert wirklich – sonst klebt das „geändert"-Kennzeichen (#143)
- [ ] Tests gegen einen gemockten CT-Client; für jede Härtung eine **eigene** Gegenprobe

### Phase 3 – Die ChurchTools-Aufrufe im Browser (#335)

- [ ] `server/src/services/setlistBuilder.ts` (613 Zeilen) als **reine Funktionen** in den Client;
      die vorhandenen Tests wandern mit
- [ ] Die **429-Notbremse aus #300** mit übernehmen: erster 429/Timeout stoppt den Lauf, Sperrfrist,
      Single-Flight. Ohne Server-Bündelung feuert jedes Gerät einzeln
- [ ] Dateien über die `fileUrl` des Arrangements statt über den Datei-Proxy
- [ ] Die Weiche in den sieben Service-Dateien aus §4 – und **nirgends sonst**

### Phase 4 – Was wegfällt, sauber angeteasert (#336)

Siehe §6. Kein toter Knopf, keine Fehlermeldung – ein Satz, der sagt, warum und wohin.

### Phase 5 – Paket, Anleitung, Release (#337)

- [ ] `npm run build:extension` + ZIP-Bau, Key über `.env` konfigurierbar
- [ ] Installationsanleitung, mit der eine fremde Gemeinde ohne Rückfrage zurechtkommt
- [ ] CI baut **beide** Auslieferungen; ein Release erzeugt Docker-Image **und** ZIP
- [ ] `CLAUDE.md`: die Regel „Weiche nur in der Service-Schicht" festhalten – sonst hält sie keine
      drei Monate

## 6. Was in der Extension wegfällt

| Funktion                         | Warum                                                                                                                                                     | Umgang                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Für offline speichern** (#32)  | Füllt den **Service-Worker-Cache** mit den PDFs/Bildern. Unter `/ccm/…` liefert CT die Seite aus – ein eigener Service Worker ist dort bestenfalls fragil | Knopf entfällt, Hinweis auf Server-Variante |
| **Team-Anmerkungen teilen**      | Braucht eine Tabelle, die für **alle** gilt – hängt an Phase 1 (globaler Wert?)                                                                           | Nach Phase 1 entscheiden                    |
| **Fremde Anmerkungen ansehen**   | Ebenso                                                                                                                                                    | Nach Phase 1 entscheiden                    |
| **Update-Hinweis**               | Ohne Service Worker gibt es keinen Update-Balken; die Version liefert ChurchTools                                                                         | Entfällt ganz                               |
| **Branding** (Gemeindename/Logo) | Kein `site.json` ohne Server                                                                                                                              | Möglichst aus der CT-API (Phase 1)          |
| **Login-Bildschirm, Rate-Limit** | Die Anmeldung macht ChurchTools                                                                                                                           | Entfällt – ein Gewinn                       |

**Der Teaser** (eine Formulierung, an einer Stelle, nicht sechs verschiedene): kurz, ohne
Werbeton, mit Verweis darauf, dass es die App auch mit eigenem Server gibt und wo man fragen kann.

## 7. Risiken & offene Fragen

1. **Schreibrechte für normale Nutzer** – ungeklärt, entscheidet über den halben Funktionsumfang.
   → Phase 1, mit einem Konto ohne Adminrechte.
2. **Last auf der CT-Instanz.** Ohne Server-Bündelung geht jede Anfrage direkt von jedem Gerät an CT.
   #300 hat gezeigt, dass das eine Instanz lahmlegen kann. Die Notbremse ist **Pflicht**, kein Extra.
3. **Für die ECG bedeutet Extension: im Saal ohne Netz keine Liedblätter.** Muss jetzt nicht
   entschieden werden – die NAS-App läuft weiter –, kommt aber am Ende auf den Tisch.
4. **Zwei Datenwelten.** Anmerkungen der Extension liegen in ChurchTools, die der PWA auf dem NAS.
   Es wird **nichts migriert**. Wer wechselt, fängt bei den Anmerkungen neu an. Bewusst so.
5. **Doppelte Arbeit mit bwl21.** Er baut parallel. Der Plan gehört ihm geschickt, bevor Phase 3
   beginnt.

## 8. Verifikation

- Beide Auslieferungen durch **dieselbe** Testsuite; Lint/Build/Tests am **Exit-Code** prüfen.
- Die Extension in der Test-Instanz **durchklicken** – die Lehre aus #283: 672 grüne Tests und eine
  kaputte Bedienung sind kein Widerspruch.
- Manuelle Testfälle (`docs/tests/README.md`) um die Extension-Fälle ergänzen; die weggefallenen
  Funktionen dort als „nur Server-Variante" kennzeichnen.
