# PROJEKTPLAN – ChurchTools Musik App

> Grober Fahrplan. Detailstatus lebt in den GitHub-Issues + Projects-Board
> (nicht doppelt pflegen). Zu Session-Beginn lesen, am Ende Checkboxen +
> Changelog in `CLAUDE.md` aktualisieren.

## Worum es geht
Progressive Web App, die Chord Charts der aktuellen Setlist aus ChurchTools holt,
automatisch transponiert und im Gottesdienst anzeigt. ChurchTools bleibt die einzige
Datenquelle. Details: `CLAUDE.md`.

## Feste Entscheidungen
| Thema            | Entscheidung |
|------------------|--------------|
| Datenhaltung     | keine eigene DB – ChurchTools ist Datenquelle |
| Auth             | persönlicher ChurchTools-Login, Session in signiertem httpOnly-Cookie |
| Externer Zugang  | Synology Reverse Proxy + Let's Encrypt (KEIN Cloudflare) |
| Deployment       | Docker auf Synology NAS (Container Manager) |

Begründungen: `docs/entscheidungen.md`.

## Doku-Pflicht je Session
Checkbox hier aktualisieren **und** Changelog-Zeile in `CLAUDE.md`. Architektur-
Entscheidungen → `docs/entscheidungen.md`.

---

## Phasen

### Phase 1–4 – Aufbau & Funktionen ✅ (abgeschlossen, fertig & produktiv)
- [x] 1 Fundament (Git, Tooling, Struktur, Security)
- [x] 2 Backend-Proxy zu ChurchTools (Login, Setlist-Pipeline, Schreibzugriff)
- [x] 3 App-Funktionen: Login, Agenda, Setlist/Ablauf, ChordChart, „Alle Lieder",
      ChordPro-Editor, Dokumenten-Viewer mit Anmerkungen, rechtebewusste UI
- [x] 4 Deployment NAS (Docker) intern + extern (Reverse Proxy + DDNS)

**Definition of Done:** App im Gottesdienst nutzbar, intern und extern live. ✓

### Phase 5 – Qualitätssicherung (laufend)
- [x] 5.1 Unit-Tests für die kniffligste reine Logik (`transpose.ts`, `chordpro.ts`)
- [x] 5.2 CI (GitHub Actions): lint + build + test je PR
- [x] 5.3 Testkonzept dokumentiert (`docs/testkonzept.md`)
- [ ] 5.4 Bei Bedarf weitere Tests, wenn neue Logik dazukommt

**Definition of Done:** Kernlogik durch grüne Tests abgesichert, CI bei jedem PR grün.

### Phase 6 – Offen / optional
- [ ] 6.1 Musik-Abwesenheitsplaner (separate Flask-App) in diese App nachbauen
- [ ] 6.2 White-Label-Vollausbau für andere Gemeinden (Roadmap: `WHITE-LABEL.md`)
- [ ] 6.3 vite@8-Upgrade (behebt die zurückgestellten moderate npm-audit-Findings)

**Definition of Done:** je Teilprojekt eigener Plan; hier nur als Merker.
