# Verteilung an andere Gemeinden (Selbst-Hosting)

> **Status: Umgesetzt ab v2.1.x** – Repo öffentlich, Images in GHCR, INSTALL.md fertig.

## Kontext & Abgrenzung

Die ursprüngliche White-Label-Idee (Farben/Logo pro Gemeinde anpassbar) wurde verworfen.
Die App hat ein festes Design. „Teilen" bedeutet hier **getrennte Deployments derselben Codebasis**:
Jede Gemeinde betreibt ihre **eigene, autarke Instanz** – mit eigener ChurchTools-Verbindung
und eigenem Gemeindenamen.

## Getroffene Entscheidungen

| Frage | Entscheidung |
|---|---|
| Was darf eine Gemeinde anpassen? | **Nur Gemeindename (in der App) + eigene ChurchTools-URL (`.env`).** Keine Farben/Logo-Anpassung. |
| Verteilungsweg | **Öffentliches GitHub-Repo + fertige Docker-Images (GHCR).** |
| Betriebsmodell | Jede Gemeinde betreibt ihre Instanz vollständig selbst – keine zentrale Infrastruktur, keine geteilten Secrets, kein Support-Versprechen. |

## Leitprinzip: Eine Codebasis für alle

ECG-Instanz und alle anderen Gemeinden laufen auf **demselben Code** aus demselben Repo.
Unterschiede stecken nur in der Konfiguration:

| Was | Wo |
|---|---|
| ChurchTools-URL, Session-Secret, Admin-Recht | `.env` auf dem jeweiligen Server |
| Gemeindename | In der App (Admin → „Mehr"-Tab) |
| Code, Design, Features | Identisch für alle |

Kein Fork, keine separate Distributions-Version.

## Update-Ablauf

```
1. Alwin:    Branch → Änderung → PR → merge in main
2. Alwin:    Git-Tag setzen (z. B. v2.2.0)
3. CI:       baut automatisch das Image → GHCR (öffentlich)
4. ECG:      Watchtower zieht das neue Image automatisch
5. Andere:   ziehen das neue Image selbst, wann es ihnen passt
```

- Das CHANGELOG genügt als Ankündigung – niemand muss einzeln benachrichtigt werden.
- Daten-Volume behalten → Gemeindename und Einstellungen überleben das Update.
- Dank MIT-Lizenz ist Weiterentwicklung freiwillig – pausiert Alwin, laufen alle Instanzen weiter.

## Technische Absicherung

- Kein zentraler Server, kein geteilter Token, kein Call-Home – jede App spricht ausschließlich
  mit dem ChurchTools der eigenen Gemeinde.
- Jeder Nutzer meldet sich mit seinen eigenen ChurchTools-Zugangsdaten an.
- Öffentlicher Code + Image-Pipeline = Gemeinden sind vollständig selbstständig.

## Risiken

| Risiko | Schutz |
|---|---|
| Geheimnisse versehentlich veröffentlicht | `.gitignore`; Git-Historie gecheckt |
| Haftung bei fremdem Einsatz | MIT-Lizenz (keine Gewähr) + DSGVO-Hinweis in README |
| Verwechslung mit offiziellem ChurchTools-Produkt | Disclaimer im README; beschreibender App-Name |

---

> Verwandte Doku: [INSTALL.md](../INSTALL.md) · [UPDATE.md](../UPDATE.md) ·
> [docs/onboarding-checkliste.md](onboarding-checkliste.md)
