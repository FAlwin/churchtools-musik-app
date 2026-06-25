# Churchtools Musik App

Eine Progressive Web App (PWA), die die **Chord Charts der aktuellen Setlist aus ChurchTools**
holt, automatisch transponiert und im Gottesdienst anzeigt. ChurchTools bleibt die einzige
Datenquelle – die App hat keine eigene Datenbank.

> **Hinweis:** Dies ist ein **inoffizielles Community-Projekt** und steht in keiner Verbindung
> zur ChurchTools GmbH. „ChurchTools" ist eine Marke der jeweiligen Inhaber. Der Name dieser
> App ist rein beschreibend gemeint („Musik-App **für** ChurchTools").

## Was die App kann

- **Ablaufpläne & Setlists** aus ChurchTools anzeigen (kompletter Ablauf, nicht nur Lieder)
- **Chord Charts als PDF** (SongSelect-Look) mit automatischer Transponierung, Kapo, Spalten- und
  Schrift-Optionen; im Querformat zwei Seiten nebeneinander, als PDF teil-/druckbar
- **Alle Lieder** durchsuchbar inkl. Nutzungs-Statistik
- **Mehrere benannte Lied-Versionen** (z. B. „Akustik", „Jugend") – team-weit in ChurchTools,
  Original bleibt erhalten
- **Anmerkungen, Zoom & Einstellungen pro ChurchTools-Konto** – geräteübergreifend synchronisiert
  (Stift/Marker/Text auf den Seiten, Rückgängig/Wiederholen)
- **Dokumenten-Viewer** (PDF/Bild) mit Anmerkungen
- **Rechtebewusste Oberfläche** – jede Person sieht nur, wozu ihre ChurchTools-Rechte passen
- **Frei konfigurierbare Links** (z. B. zu weiteren Gemeinde-Angeboten) im „Mehr"-Tab und optional
  auf der Login-Seite

## Für andere Gemeinden

Jede Gemeinde betreibt ihre **eigene, eigenständige Instanz** – mit ihrer ChurchTools-Verbindung
und ihrem Gemeindenamen. Es gibt **keine zentrale Infrastruktur** und keinen geteilten Zugang:
Jede App spricht ausschließlich mit dem ChurchTools der eigenen Gemeinde, jede Person meldet sich
mit ihren **eigenen ChurchTools-Zugangsdaten** an.

Anpassbar sind nur:

| Was | Wo |
|---|---|
| ChurchTools-URL, Session-Secret, Admin-Recht | `.env` auf eurem Server |
| Gemeindename + eigene Links | in der App (Admin → „Mehr"-Tab) |

Optik und Funktionen sind für alle identisch (eine gemeinsame Codebasis).

## Schnellstart

Die App läuft als fertiges Docker-Image – kein eigener Build nötig:

```bash
# 1. Verteilpaket aus dem Ordner deploy/ holen (docker-compose.yml + .env.example)
# 2. .env ausfüllen (eigene ChurchTools-URL + Session-Secret)
docker compose up -d
```

Ausführliche Anleitung: **[INSTALL.md](INSTALL.md)** · Updates: **[UPDATE.md](UPDATE.md)**

## Lizenz & Haftung

Veröffentlicht unter der **[MIT-Lizenz](LICENSE)** – Nutzung, Anpassung und Weitergabe sind frei.
Die Software wird **ohne jede Gewährleistung** bereitgestellt (siehe Lizenztext).

Jede Gemeinde ist für ihre eigene Instanz, ihren ChurchTools-Zugang und die **Einhaltung der
DSGVO** selbst verantwortlich.
