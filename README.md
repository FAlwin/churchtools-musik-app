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
- **Alle Lieder** durchsuchbar inkl. Nutzungs-Statistik (Häufigkeit / zuletzt gespielt, mit
  wählbarem Zeitraum). Gesucht wird in Titel und Autor, Titel-Treffer stehen vorn; findet der Titel
  nichts, lässt sich **auch im Liedtext** suchen – für den Fall, dass man nur eine Zeile kennt
- **Beim Einfügen eines Liedes: ein Suchfeld, drei Quellen** – ein Umschalter wählt **Bibliothek ·
  Liedtexte · SongSelect**, der Begriff bleibt beim Wechseln stehen (beim Verknüpfen ohne SongSelect –
  dort könnte ein neu angelegtes Lied nicht landen)
- **Liedtext-Vorschau vor dem Einfügen** – ein Antippen zeigt erst den Text, dann den Knopf zum
  Hinzufügen; so unterscheidet man gleichnamige Lieder, ohne sie zu öffnen. Bei SongSelect mit
  Abschnitten, Autoren und CCLI-Nummer. Für den Alltag bleibt der **„+"**-Knopf: sofort einfügen
- **Lieder anlegen** – über die Quelle **SongSelect** gefunden (Titel oder CCLI-Nummer; Autoren,
  Copyright und Tonart kommen mit, das Notenblatt gleich dazu) oder über „Neues Lied" selbst
  eingetippt. Aus dem Liederheft oder direkt beim Ergänzen eines Ablaufs
- **Stammdaten pflegen** – Name, Kategorie, Autor, CCLI-Nummer und Copyright eines vorhandenen Liedes
  ändern; Löschen mit Rückfrage, die die Folgen nennt
- **Live-Aktualisierung**: Änderungen am Ablauf erscheinen zeitnah bei allen; geänderte Punkte
  werden beim Öffnen hervorgehoben, entfernte lösen sich sichtbar auf
- **Mehrere benannte Lied-Versionen** (z. B. „Akustik", „Jugend") – team-weit in ChurchTools,
  Original bleibt erhalten
- **Anmerkungen, Zoom & Einstellungen pro ChurchTools-Konto** – geräteübergreifend synchronisiert
  (Stift/Marker/Text auf den Seiten, Rückgängig/Wiederholen); optional **mit dem Team teilen**
- **Offline-Reserve**: einmal geladene Abläufe/Charts sind ohne Netz im Saal verfügbar; als App
  installierbar (Home-Bildschirm)
- **Hochgeladene PDFs/Bilder** je Lied – direkt im durchgehenden Ablauf (mitwischen, im Querformat
  neben dem Nachbarlied) und ebenfalls mit Anmerkungen
- **Dateien eines Arrangements verwalten** – ansehen, aufs Gerät laden, hinzufügen und löschen,
  ohne den Umweg über die ChurchTools-Oberfläche
- **Notenblatt aus CCLI SongSelect holen** – wenn die Gemeinde die SongSelect-Integration in
  ChurchTools aktiviert hat und das Lied eine CCLI-Nummer trägt; in der Tonart des Arrangements
- **Rechtebewusste Oberfläche** – jede Person sieht nur, wozu ihre ChurchTools-Rechte passen
- **Geführte Einführung** (Onboarding-Touren) beim ersten Öffnen
- **Frei konfigurierbare Links** (z. B. zu weiteren Gemeinde-Angeboten) im „Mehr"-Tab und optional
  auf der Login-Seite

## Für andere Gemeinden

Jede Gemeinde betreibt ihre **eigene, eigenständige Instanz** – mit ihrer ChurchTools-Verbindung
und ihrem Gemeindenamen. Es gibt **keine zentrale Infrastruktur** und keinen geteilten Zugang:
Jede App spricht ausschließlich mit dem ChurchTools der eigenen Gemeinde, jede Person meldet sich
mit ihren **eigenen ChurchTools-Zugangsdaten** an.

Anpassbar sind nur:

| Was                                          | Wo                              |
| -------------------------------------------- | ------------------------------- |
| ChurchTools-URL, Session-Secret, Admin-Recht | `.env` auf eurem Server         |
| Gemeindename + eigene Links                  | in der App (Admin → „Mehr"-Tab) |

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
