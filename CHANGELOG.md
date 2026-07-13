# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier festgehalten.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/):
`MAJOR.MINOR.PATCH` – z. B. `v2.1.0` = Feature, `v2.1.1` = Bugfix, `v3.0.0` = größere Umstellung.

## [2.10.0] – 2026-07-13

### Geändert

- **Deutlich schnellerer Erststart (#142):** Die App lädt beim Start nur noch das Nötigste
  (Anmeldung + Terminliste, ~69 kB statt ~863 kB komprimiert). Die schweren Teile – v. a. die
  Chart-Anzeige mit dem PDF-Renderer – kommen erst beim ersten Öffnen nach (kurzer Lade-Moment,
  einmalig). Alle nachgeladenen Teile stecken weiter im Offline-Vorrat der installierten App:
  Einmal online geöffnet, funktioniert alles wie gehabt auch ohne Netz. Spürbar vor allem im
  langsamen Kirchen-WLAN.
- **Intern: Anmerkungs-Typen zu einer Quelle zusammengeführt (#137):** Die Datenform der
  Anmerkungen (Striche/Texte/Zoom) war an vier Stellen getrennt definiert und auf dem Server
  bereits veraltet (Format-Felder fehlten). Jetzt gibt es genau eine Definition in `shared/types`,
  und ein Compile-Wächter bricht den Build, falls Server-Prüfung und Typ je wieder
  auseinanderlaufen – Anmerkungsfelder können damit nicht mehr stillschweigend beim Speichern
  verloren gehen (die Bug-Klasse hinter #115). Keine sichtbare Änderung in der App.

### Behoben

- **Hängende ChurchTools-Anmeldung führt nicht mehr in die „Erneut versuchen"-Sackgasse (#149):**
  Liefert ChurchTools minutenlang leere Berechtigungen (realer Vorfall am 13.07.), überbrückt der
  Rechte-Speicher das jetzt zuverlässig – er kennt das Konto neuerdings direkt aus der Anmeldung
  und ist nicht mehr auf eine zweite ChurchTools-Abfrage angewiesen. Ist die ChurchTools-Sitzung
  wirklich unbrauchbar, führt die App automatisch zur Anmeldung, statt vergebliche „Erneut
  versuchen"-Knöpfe zu zeigen. Greift vollständig ab der ersten Neuanmeldung nach dem Update.

### Sicherheit

- **Feinschliff (#146, Teil 1):** Anmeldefelder längenbegrenzt; die öffentliche Konfigurations-
  Abfrage (Login-Screen) verrät keine internen Gruppen-/Rollen-Zuordnungen mehr; die
  Update-Prüfung fragt GitHub bei Netzwerkfehlern nicht mehr ungebremst an.

## [2.9.1] – 2026-07-10

### Behoben

- **Rechte-Änderungen greifen ohne Ab-/Neuanmelden:** Die Berechtigungen wurden auf dem Gerät bis
  zu 30 Minuten zwischengespeichert. Gab der Admin z. B. die Team-Notizen frei, sahen die anderen
  das erst nach langem Warten oder erst nach Abmelden/Neuanmelden. Jetzt wird der gespeicherte Stand
  zwar sofort angezeigt (kein Flackern), aber bei jedem App-Start frisch geprüft – geänderte Rechte
  erscheinen damit schon beim nächsten Neuladen.

## [2.9.0] – 2026-07-10

### Hinzugefügt

- **Team-Notizen (#124):** Anmerkungen bleiben persönlich – aber wer mag, **teilt** sie mit dem
  Team („Mehr → Team-Notizen → Meine Anmerkungen teilen"). Berechtigte wählen im Lied über den
  Personen-Knopf **„Notizen von …"** eine Person und dann eine ihrer Ebenen (Version +
  Darstellungsart, nur solche mit Anmerkungen) und sehen sie **schreibgeschützt in der Ansicht
  dieser Person** (Spalten, Schrift, Version), damit alles an der richtigen Stelle sitzt. Eine
  Leiste bietet **Ansehen / Zusammenführen / Ersetzen** mit **Live-Vorschau** direkt im Chart;
  erst **„Übernehmen"** kopiert die Anmerkungen in die eigenen (bei „Zusammenführen" zusätzlich zu
  den vorhandenen), zusammen mit der Ansicht dieser Ebene – die eigene Tonart bleibt. Wer
  Team-Notizen nutzen darf, legt der Admin unter „Mehr → Verwaltung → Anmerkungen" fest:
  **Gruppen-Zuweisung** (ChurchTools-Gruppen) + **Rollen-Zuweisung** (freigegebene Rollen je
  Gruppe; nichts angehakt = niemand). Die geführte Einführung der Chart-Ansicht wurde um den
  Schritt „Notizen von anderen" ergänzt.
- **Eigene Anmerkungen je Darstellungsart:** „Akkorde & Text" und „Nur Text" haben jetzt getrennte
  Anmerkungen (und eigenen Zoom) – beim Umschalten verrutscht nichts mehr. Bestehende Anmerkungen
  gelten als „Akkorde & Text". Im Lied-Menü zeigt ein kleines Stift-Symbol, welche Versionen und
  Darstellungsarten eigene Anmerkungen haben.
- **Anmerkungsleiste beweglich:** Die Werkzeugleiste lässt sich am Griff senkrecht verschieben und
  über den Pfeil zu einem kleinen Rand-Knopf einklappen (Position und Zustand bleiben pro Gerät
  erhalten).

### Behoben

- **Zoom bleibt nicht mehr in einer Hälfte stecken** beim Wechsel Hochformat ↔ Querformat oder nach
  dem Zurückkehren aus einer anderen App.
- **Anmerkungen auf der inaktiven Chart-Hälfte** (Querformat) lassen sich nicht mehr versehentlich
  auswählen oder bearbeiten – ein Tipp aktiviert dort nur die Seite.

## [2.8.1] – 2026-07-09

### Behoben

- **Kein fälschliches „keine Berechtigung" mehr bei ChurchTools-Aussetzern:** ChurchTools liefert
  gelegentlich für ein paar Sekunden leere Rechte zurück (während es die Berechtigungen einer
  Sitzung neu berechnet), obwohl der Nutzer normal berechtigt ist. Bisher sah man in diesem Moment
  den Hinweis „keine Berechtigung" bzw. musste die Seite mehrfach neu laden. Der Server merkt sich
  jetzt pro Konto die zuletzt gültigen Rechte und liefert sie während eines solchen Aussetzers aus –
  der Nutzer merkt nichts mehr davon. Ein dauerhaftes „keine Berechtigung" wird bewusst nie gemerkt,
  damit tatsächlich Nicht-Berechtigte weiterhin korrekt den Hinweis sehen. Die Rechte werden auf dem
  Daten-Volume abgelegt (überstehen Updates) und gelten bis zu 30 Tage als vertrauenswürdig.

## [2.8.0] – 2026-07-08

### Hinzugefügt

- **Hilfe „Als App installieren":** Der Mehr-Tab erklärt jetzt passend zum Gerät, wie man die App
  auf den Startbildschirm legt – auf iPhone/iPad („Teilen → Zum Home-Bildschirm"), auf dem Mac
  („Teilen → Zum Dock hinzufügen") und auf Android; unter Chrome/Edge erscheint ein echter
  „Installieren"-Knopf. Der Hinweis verschwindet, sobald die App bereits installiert läuft.

### Geändert

- **Deploy robuster gegen Datenverlust:** Die Compose-Dateien setzen den Projektnamen jetzt fest
  (`name:`). Damit bleibt das Daten-Volume (Gemeindename, Links, Anmerkungen) auch dann erhalten,
  wenn beim Aktualisieren im Container Manager versehentlich ein abweichender Projektname entsteht.
  (Hintergrund: Ein einmalig falsch benanntes Projekt hatte am 08.07. dazu geführt, dass die App
  ein leeres Volume einhängte und Werkseinstellungen zeigte – die Daten waren nie verloren.)

## [2.7.2] – 2026-07-08

### Sicherheit

- **Session-Cookie in Produktion nur über HTTPS:** In der Produktiv-Konfiguration trägt das
  Anmelde-Cookie jetzt das `Secure`-Flag und geht damit nie über eine unverschlüsselte Verbindung.
  (#45)
- **Restriktive Content-Security-Policy in Produktion:** Statt die CSP komplett abzuschalten gilt
  jetzt eine enge Richtlinie (nur eigene Quellen, kein eingeschleustes Fremd-Script; pdf.js-Worker
  und Anmerkungs-Bilder ausdrücklich erlaubt). Im reinen LAN-HTTP-Betrieb bleibt die App voll
  nutzbar. Zusätzliche Schutzschicht gegen Cross-Site-Scripting. (#47)

### Behoben

- **Neutraler Marker für bearbeitete Lieder:** Von der App gespeicherte Songversionen tragen jetzt
  den Zusatz „(App)" statt des gemeindespezifischen „(ECG)". Bestehende „(ECG)"-Dateien (und die
  ganz alten „— Bearbeitet"/„— ECG") werden weiterhin erkannt – es geht nichts verloren. (#34)
- **Einseitige Lieder mittig:** Ein Lied/Ablauf mit nur einer Seite wird im Querformat jetzt über
  die volle Breite zentriert statt links neben einer leeren Fläche angezeigt. (#128)

### Geändert

- **Direkt nachnutzbar für andere Gemeinden:** Die Produktiv- und Test-Compose-Dateien wurden von
  gemeindespezifischen Namen befreit (generische Container-/Watchtower-Namen), und die
  Installationsanleitung erklärt jetzt die drei Betriebs-Varianten (Basis / Produktiv / Test).
  Bestehende Instanzen behalten ihr Daten-Volume ohne Migration. (#35)

## [2.7.1] – 2026-07-07

### Sicherheit

- **Abmelden räumt jetzt vollständig auf:** Beim Logout wird auch die dahinterliegende
  ChurchTools-Sitzung serverseitig beendet (vorher blieb sie bis zu ihrem eigenen Ablauf gültig),
  und alle auf dem Gerät zwischengespeicherten Konto-Daten werden entfernt – Offline-Vorrat
  (Abläufe, Lieder, PDFs), lokale Anmerkungs-/Einstellungs-Caches. Wichtig für geteilte
  Gemeinde-Geräte: Der nächste Nutzer sieht keine Daten des vorherigen. Geräte-Einstellungen
  (z. B. „Einführung gesehen") bleiben erhalten.
- **Anmeldung läuft nach spätestens 90 Tagen ab:** Die automatische Verlängerung bei Nutzung
  verlängert nicht mehr unbegrenzt – 90 Tage nach dem Login ist eine Neuanmeldung nötig.
  Bestehende Anmeldungen bleiben beim Update erhalten (Frist zählt ab jetzt).

## [2.7.0] – 2026-07-07

### Hinzugefügt

- **Geführte Einführung für neue Nutzer:** Beim ersten Mal erklären kleine Hinweisblasen direkt am
  jeweiligen Knopf, was wofür da ist – in den Terminen (Terminliste, Liedblätter öffnen,
  Offline-Symbol, Bereiche), in der Ablauf-Ansicht (Lied öffnen, als PDF teilen, bearbeiten) samt
  Bearbeiten-Modus (Sortieren, Punkt bearbeiten, Hinzufügen) und in der Liedansicht (Blättern &
  Zoomen, Lied-Optionen, Darstellung, Anmerkungen). Jederzeit „Überspringen"; im Mehr-Tab lässt
  sich die Einführung erneut starten.

### Geändert

- **Termine-Ansicht aufgeräumt:** Die Liederanzahl steht jetzt als kleine Zahl am Noten-Knopf
  (vorher in der Textzeile abgeschnitten). Das Symbol zum Offline-Speichern ist eine Wolke mit
  Pfeil (statt eines Geräte-Download-Pfeils), passend zur „Wolke mit Haken" für „liegt offline vor".
- **„Vergangene" ohne Netz ausgegraut:** Vergangene Gottesdienste werden live geladen und sind
  offline nicht verfügbar – der Umschalter ist dann ausgegraut und erklärt das per kurzem Hinweis.

## [2.6.0] – 2026-07-06

### Hinzugefügt

- **Offline-Reserve (#32):** Gottesdienste sind im Saal auch ohne Netz verfügbar. Der **nächste**
  Gottesdienst wird automatisch komplett vorgehalten (Ablauf, Charts, PDFs/Bilder – Schalter im
  Mehr-Tab); weitere kommende Gottesdienste lassen sich per **Download-Knopf direkt am Termin**
  offline speichern und werden danach automatisch aktuell gehalten. Ein **Wolken-Symbol am Termin**
  zeigt dauerhaft, was offline bereitliegt. Ohne Netz werden nicht verfügbare Termine und die
  Liedersammlung **ausgegraut** (Tipp erklärt es kurz). Technik: React-Query-Persistenz in
  IndexedDB, Datei-Cache im Service Worker, PDF-Renderer komplett im App-Bundle; Dokumente werden
  als Ganzes geladen statt gestreamt – dadurch öffnen Lieder offline ohne die früheren ~10-Sekunden-
  Hänger. Das App-Logo in der Ecke der Akkord-Blätter ist jetzt fest eingebettet und erscheint
  daher auch offline (vorher fehlte es dort). Grenze: Ohne Netz kein neues Anmelden.
- **Verlässliche Offline-Erkennung & keine Sackgassen (#32):** Die App erkennt „offline" jetzt am
  tatsächlichen Server-Kontakt statt nur an der Netz-Anzeige des Geräts – so greift das Ausgrauen
  auch im Gemeinde-WLAN ohne Internet-/Server-Zugang. Beim Neustart wartet die App, bis der
  Offline-Speicher geladen ist (kein kurzer Anmelde-Bildschirm mehr, der gemerkte Gottesdienst
  bleibt erhalten). Lade- und Fehleransichten haben immer einen Rückweg, und der Anmelde-Bildschirm
  erklärt offline, dass eine Verbindung nötig ist – man bleibt nicht mehr in einer Schleife hängen.
- **Weißer Bildschirm beim Öffnen ohne Netz behoben (#32):** Nach dem kompletten Schließen blieb die
  App beim Wieder-Öffnen ohne Netz manchmal weiß. Ursache war ein „wartender" Hintergrund-Prozess
  (Service Worker), der auf iPad/iPhone beim Kaltstart die App-Hülle nicht auslieferte. Der neue
  Stand aktiviert sich jetzt sofort und zuverlässig – **ohne** die laufende App mitten im
  Gottesdienst neu zu laden. Zusätzliches Sicherheitsnetz: Startet die App einmal nicht, erscheint
  statt eines weißen Bildschirms eine Meldung mit „Neu laden".

### Geändert

- **„Aktualisieren"-Knopf im Lied entfernt:** Der Inhalt (Ablauf/Liedtexte) aktualisiert sich jetzt
  alle 60 Sekunden von selbst – auch wenn das Gerät dauerhaft offen im Lied bleibt. Neu gezeichnet
  wird nur bei echten Änderungen; ohne Netz scheitert das Nachladen lautlos.

## [2.5.2] – 2026-07-06

### Geändert

- **„Nach Updates suchen"-Knopf entfernt:** Er war überflüssig – beim (kompletten) Neu-Öffnen der App
  wird ohnehin automatisch die neueste Version geladen. Die stille Auto-Aktualisierung und der
  Versions-Hinweis bleiben.

### Behoben

- **Normaler Anmerkungs-Text wurde nach kurzer Zeit fett (#115):** Beim Server-Abgleich gingen die
  Format-Angaben (fett/kursiv/unterstrichen/Ausrichtung) verloren, weil sie serverseitig nicht
  gespeichert wurden – beim nächsten Laden wurde normaler Text fälschlich wieder fett. Die Formate
  werden jetzt vollständig mitgespeichert.
- **Gestrichelter Text-Rahmen blieb stehen (#114):** Beim Verlassen des Anmerkungsmodus wird die
  Text-Auswahl jetzt sofort aufgehoben – der Rahmen bleibt nicht mehr bis zum Seitenwechsel sichtbar.
- **Text-Anmerkungen blinkten beim Weiterwischen (#113):** Die Blätter-Animation nutzte einen
  doppelt breiten Schiebe-Streifen, der auf dem iPad (Retina) die maximale GPU-Texturbreite
  überschritt – WebKit zeichnete den Anmerkungs-Text dadurch verzögert (Striche/Seiten sind eigene
  Texturen und waren nicht betroffen), und vorwärts endete die Animation auf einer krummen Position.
  Jetzt werden alte und neue Seite als zwei getrennte, je bildschirmbreite Ebenen geschoben; beide
  Richtungen enden exakt deckungsgleich mit der Live-Ansicht. Zusätzlich: Text-Formatierung im
  Übergang exakt wie live (fett/normal/kursiv/…), Textebene wird beim Seitenwechsel synchron
  zurückgesetzt, Abdeckung steht garantiert vor dem ersten Frame.
- **Altes Lied blitzte bei sehr schnellem Blättern auf:** Startete ein neuer Übergang, während der
  vorherige noch lief (z. B. schnelles Tastatur-Blättern), blieb die alte Seiten-Grafik über der
  neuen liegen. Die Übergangs-Ebenen werden jetzt pro Blättern frisch aufgebaut.

## [2.5.1] – 2026-07-05

### Behoben

- **„Too many requests" im Gemeinde-WLAN behoben:** Das Anfrage-Limit galt versehentlich auch für
  statische Dateien und zählte pro IP – da im Gemeinde-WLAN alle Geräte über eine öffentliche IP
  laufen, teilte sich das ganze Team ein Kontingent und lief beim gemeinsamen Nutzen sofort voll.
  Das Limit greift jetzt nur noch für echte Aktionen und zählt **pro angemeldetem Nutzer**;
  Grenzwerte großzügiger.

## [2.5.0] – 2026-07-05

### Hinzugefügt

- **Update-Hinweis in der App:** Liegt eine neue Version bereit, erscheint ein dezenter Balken
  „Neue Version verfügbar" mit **Jetzt laden** (übernimmt sie sofort) und **Später**. Die App
  sucht dafür aktiv nach Updates – beim Start, bei Rückkehr in den Vordergrund und stündlich.
  Bisher blieben Geräte (v. a. iPhone/iPad-PWA) unbemerkt auf altem Stand hängen; so erreichte
  z. B. der Fix für das „keine Berechtigung"-Schloss die Geräte nie von selbst. Es wird weiterhin
  **nie ungefragt** mitten in der Nutzung neu geladen.
- **„Nach Updates suchen" im Mehr-Tab:** Ein Knopf unter der Versionszeile prüft sofort auf eine
  neue Version und **lädt sie direkt** (kurz „Aktualisiere…", dann neu geladen) bzw. meldet „Du bist
  auf dem neuesten Stand". Verlässlicher Hebel gerade auf dem iPhone, wo die automatische Suche
  beim App-Wechsel manchmal nicht anschlägt.

### Behoben

- **Kopfleiste rutschte beim Sortieren weg (iPhone):** Beim Ziehen eines Ablauf-Punkts mit
  Auto-Scroll verschwand die obere Leiste („‹ Termine" / „✓ Fertig") nach oben und war nur durch
  Drehen des Geräts zurückzuholen. Der Auto-Scroll bleibt jetzt auf die Liste begrenzt und die
  Ansicht wird nach dem Ziehen automatisch zurechtgerückt. (#56)
- **Abgelaufene Sitzung führt jetzt zum Login statt in eine Sackgasse:** War die App-Anmeldung noch
  gültig, die ChurchTools-Sitzung dahinter aber abgelaufen, zeigte die App „Berechtigungen konnten
  nicht geladen werden – Erneut versuchen" – was zwecklos war (nur Neu-Anmelden half). Jetzt erkennt
  die App die abgelaufene Sitzung, meldet automatisch ab und führt direkt zum Login. (#104)

## [2.4.1] – 2026-07-04

### Geändert

- **Spalten & Textgröße geräteübergreifend:** Diese Einstellungen sind jetzt auf allen Geräten
  gleich (über das Konto synchronisiert). Nur der **Zoom** bleibt bewusst pro Gerät getrennt
  (iPad/PC vs. iPhone).
- **Eintrag hinzufügen (Text):** zeigt jetzt dieselben Feld-Überschriften wie das Bearbeiten
  (Titel · Dauer · Zuständig · Bemerkung).
- **Verknüpfung aufheben:** entfernt jetzt auch den Titel (kein zurückbleibender Liedtitel), und
  der Bearbeiten-Dialog bleibt offen – so kann man den Punkt direkt neu benennen.
- **Ladekringel** ist ein weich auslaufender Ring statt eines harten Segments.

### Behoben

- **Sporadisches „keine Berechtigung"-Schloss:** Liefert ChurchTools kurzzeitig leere Rechte
  (ein bekannter Aussetzer, z. B. beim Neu-Laden), versucht die App es jetzt automatisch erneut,
  statt sofort das Schloss zu zeigen. Ein **Admin** bekommt zudem immer Zugriff.

## [2.4.0] – 2026-07-03

### Neu

- **PDFs mitten im Ablauf:** Hochgeladene Lied-PDFs/Bilder sind jetzt Teil des **durchgehenden
  Ablaufs** – man wischt nahtlos über alle Lieder (Akkorde und PDFs gemischt), und im Querformat
  stehen zwei Seiten nebeneinander (auch über Lied-Grenzen). Vorher war eine PDF eine isolierte
  Einzelansicht.
- **Weiche Blätter-Animation:** Beim Blättern schiebt sich die neue Seite horizontal herein (wie
  im Foto-Viewer) – ruhiger Übergang statt hartem Umschalten.
- **Anmerkungen im 2-Seiten-Modus:** Nur die **aktive** Seite ist beschreibbar und hervorgehoben,
  die andere ist ausgegraut und gesperrt; ein Tipp wechselt die aktive Seite (kein versehentliches
  Kritzeln auf der falschen Seite mehr).
- **Text-Anmerkungen direkt auf der Seite:** Antippen setzt einen Cursor genau an der Stelle
  (wie in Word) – lostippen, außerhalb tippen legt den Text fest. Zeilenumbrüche möglich;
  ausgewählten Text verschieben, Größe über einen Ziehknopf ändern (Anzeige in vertrauten „pt");
  ein Tipp auf einen bestehenden Text öffnet ihn direkt zum Bearbeiten.
- **Text formatieren:** Fett, Kursiv, Unterstrichen sowie linksbündig/zentriert/rechtsbündig –
  je Textblock, wirkt live auf den ausgewählten Text bzw. auf den nächsten neuen.
- **Dickere Strichstärken:** Stift, Marker und Radierer bieten zusätzliche, deutlich dickere
  Stufen (Radierer bis „Flächen-Format").
- **Akkorde per 1-Tipp:** Im Editor fügt ein Tipp auf den Grundton den Akkord sofort ein; Zusätze
  (m, 7, maj7, sus4 …) und Bass (Slash-Akkorde wie A/C#) hängen sich direkt an.
- **Staging-Version sichtbar:** Auf der Test-Instanz zeigt der „Mehr"-Tab den Build-Stand
  (`staging-<commit>`), damit man den geladenen Stand erkennt.

### Geändert

- **Zoom-/Blätter-Gesten neu:** **ein Finger blättert, zwei Finger zoomen und verschieben** – auch
  im Zeichenmodus (Zoomen/Verschieben kritzelt nicht mehr ins Dokument; beim Apple Pencil zeichnet
  der Stift, die Finger zoomen). Die „Zurück/Fertig"-Leiste entfällt – ein Pinch zoomt und speichert
  automatisch, Zurücksetzen über den Knopf in der Kopfleiste.
- **Anmerkungs-Werkzeugleiste** aufgeräumt: klare, einheitliche Icons, größere Knöpfe, ein
  Farbknopf mit aufklappender Farbreihe. Vier Farben (Rot, Blau, Grün, Orange) + eigener Farbwähler.
  Alle Werkzeuge einheitlich bedienbar: erster Tipp wählt, zweiter Tipp klappt die Einstellungen
  auf (Strichstärke bzw. Text-Einstellungen als eigener Balken), ein dezenter Punkt-Hinweis am
  aktiven Werkzeug zeigt das an. Die Einstellungen klappen jeweils auf Höhe ihres Werkzeugs auf.
- **Editor** aufgeräumt: kompakter Kopf, moderner Text-Look (proportional statt „Schreibmaschine",
  Akkorde farbig), mehrseitige und scharfe Vorschau.
- Die Fußzeilen-Punkte markieren im Querformat beide sichtbaren Lieder.

### Behoben

- **Zoom bleibt zuverlässig erhalten** – lokal wie serverseitig, über App-Wechsel/Neustart,
  Lied-/Seitenwechsel, Hochformat↔Querformat und das Öffnen/Schließen des Editors; kein
  Zurückspringen zur Mitte mehr, gleiche Seite links wie rechts.
- **Editor-Tastatur** schiebt nicht mehr die ganze Ansicht hoch – nur der Textbereich scrollt.
- **Text-Anmerkung auf dem iPad:** Die Bildschirmtastatur öffnet jetzt zuverlässig und schiebt
  die Ansicht nicht mehr weg – nur der Notenbereich hebt sich so weit, dass der Cursor sichtbar
  bleibt; kein hängender Balken beim Schließen der Tastatur mehr.
- **Sporadisches „keine Berechtigung"-Schloss behoben:** Eine kurzzeitig leere Rechte-Antwort von
  ChurchTools wird jetzt als Aussetzer erkannt und automatisch erneut versucht, statt fälschlich
  „keine Berechtigung für Lieder oder Abläufe" anzuzeigen.
- Einseitige PDF steht im Querformat an der richtigen Stelle (rechts neben dem Vorgänger).

## [2.3.2] – 2026-07-02

### Geändert

- **Länger angemeldet bleiben:** Die Anmeldung gilt jetzt **30 Tage** statt nur 12 Stunden und
  verlängert sich bei jeder Nutzung automatisch (gleitendes Ablaufdatum) – das ständige
  Neu-Anmelden entfällt bei regelmäßiger Nutzung. Hinweis: ChurchTools kann seine eigene Sitzung
  unabhängig davon früher beenden; auf dem iPhone/iPad (Web-App vom Home-Bildschirm) löscht iOS
  Cookies nach etwa 7 Tagen ohne Nutzung – beides liegt außerhalb der App.

## [2.3.1] – 2026-07-02

### Neu

- **Mehr Einstellungen beim Hinzufügen:** Das Fenster „Eintrag hinzufügen" hat für Text-Punkte
  jetzt ein Feld **Dauer (Minuten)** – vorher fehlte es hier.
- **Direkt weiterbearbeiten nach Lied-Hinzufügen:** Sobald ein Lied zum Ablauf hinzugefügt wurde,
  öffnet sich automatisch dessen Bearbeiten-Dialog, sodass Dauer, Zuständige, Bemerkung und die
  Uhrzeit-Anzeige gleich gesetzt werden können.

### Behoben

- **Überschriften im Bearbeiten-Modus wieder bearbeitbar:** Eine Überschrift lässt sich jetzt per
  Antippen (bzw. über den Stift) umbenennen; bisher war sie nur verschiebbar.

### Geändert

- **Optik im Bearbeiten-Modus:** Das unsauber dargestellte Zeichen „⠿" ist durch ein sauberes
  6-Punkte-Griff-Icon ersetzt; die Ziehgriffe sind kräftiger und der Bearbeiten-Stift in
  Akzent-Blau hervorgehoben.

## [2.3.0] – 2026-07-01

### Neu

- **Komfortabler ChordPro-Editor (neu gebaut):** Der Lied-Editor basiert jetzt auf CodeMirror und
  bietet Syntax-Farben (Akkorde blau, Direktiven teal), echtes **Rückgängig/Wiederholen**, sauberes
  Einfügen an der Cursorposition, **Auswahl-Menüs** für Akkorde (Dur/Moll/7) und Formate (deutsch
  beschriftet mit Erklärung), zuletzt genutzte Akkorde, Transponier-Regler und eine **echte
  PDF-Vorschau** („wie gedruckt") mit Umschalter **Editor · Beide · Vorschau** (je nach Fenstergröße). (#37)

### Geändert

- **Editor besser lesbar:** In den Info-Zeilen (`{title: …}`, `{artist: …}`, `{key: …}`) wird nur
  noch das Label dezent teal eingefärbt – der eigentliche Wert (Titel/Artist/Tonart) steht jetzt
  kräftig und gut lesbar in normaler Textfarbe. Liedtext etwas größer und luftiger.
- **Ablauf-Bearbeiten an die Ansicht angeglichen:** Der Bearbeiten-Modus sieht jetzt genauso aus wie
  die normale Ablauf-Ansicht (gleiche Positionen und Höhen) – kein Springen mehr beim Umschalten;
  Ziehgriff in der Zeit-Spalte, Bearbeiten per Stift.
- **Lied-Menü leichter auffindbar:** In der Akkord-Ansicht öffnet jetzt der gesamte Kopf-Bereich
  (Titel samt Tonart/Capo/Version/Tempo) das Lied-Menü – mit deutlich sichtbarem Auslöser, nicht
  mehr nur über den Titel. (#42)
- **Ablauf-Bearbeiten an die Ansicht angeglichen:** Beim Umschalten in den Bearbeiten-Modus bleiben
  Zeilenhöhe und Position gleich (die Uhrzeit-Spalte wird zum Ziehen-Griff, Dauer und Zuständige
  bleiben sichtbar). Lieder sind deutlich hervorgehoben, die Minutenangaben stehen auf einer Linie,
  ein Stift zeigt die Bearbeitbarkeit; Überschriften ohne Uhrzeit.

### Behoben

- Termine am gleichen Tag werden nach Uhrzeit sortiert. (#36)
- Manuell (als Freitext) zugeordnete Zuständige werden im Ablauf angezeigt. (#38)
- Beim Wechsel des Zeichenwerkzeugs schließt eine offene Textbearbeitung. (#39)
- Pinch-Zoom in der Akkord-Ansicht bleibt erhalten und friert beim Drehen (Hoch-/Querformat)
  nicht mehr ein. (#33)

### Behoben

- **Festhängender Zoom in der Akkord-Ansicht (iPad):** Ein reingezoomter Ausschnitt konnte beim
  Drehen bzw. über mehrere Lieder hinweg „kleben" bleiben oder fälschlich für alle Lieder gelten.
  Der Zoom wird jetzt pro Ausrichtung (Hoch-/Querformat) und pro Lied-Seite getrennt gemerkt. (#33)
- **Reihenfolge gleichzeitiger Termine:** Termine bzw. Einträge mit derselben Uhrzeit werden jetzt
  stabil und nachvollziehbar sortiert. (#36)
- **Zuständige als Freitext:** Frei eingetragene Namen (ohne Dienst-Klammern) werden im Ablauf jetzt
  mit angezeigt – nicht nur die über den Dienstplan zugewiesenen Personen. (#38)
- **Textfeld-Werkzeug:** Das Wechseln des Werkzeugs bzw. ein Tipp ins Leere schließt ein offenes
  Textfeld jetzt sauber und legt kein ungewolltes neues Feld an. (#39)

### Intern

- Anzeige- und Zustandslogik von `App` und `ChordChart` in eigene Hooks ausgelagert
  (`useAppNav`/`navStorage`, `useChartNavigation`, `useChartEditor`), tote Kopf-Styles entfernt –
  reine Wartbarkeit, ohne Funktionsänderung.
- GitHub-Actions auf Node-24-fähige Versionen gehoben (beseitigt die Node-20-Abkündigungswarnung).
- Die geplante **Offline-Reserve** (Issue #32) wurde bewusst wieder aus `main` herausgetrennt und
  liegt separat auf einem eigenen Branch – auf iPad noch nicht zuverlässig; wird später fortgesetzt.

## [2.2.0] – 2026-06-30

Großes Aufräum-, Verteilungs- und Härtungs-Release.

### Neu

- **Setup per Doppelklick** für andere Gemeinden: `deploy/setup.command` (macOS/Linux) und
  `deploy/setup.bat` (Windows) – prüfen Docker, fragen die ChurchTools-URL ab, erzeugen das
  Session-Secret und starten die App.
- **Update per Doppelklick:** neue Skripte `deploy/update.command` / `deploy/update.bat`
  (Daten bleiben erhalten).
- **Hilfeseite** `docs/betrieb/troubleshooting.md` mit Schritt-für-Schritt-Lösungen für die
  häufigsten Stolpersteine.
- **Update-Hinweis in der App:** Im „Mehr"-Tab erscheint dezent ein Hinweis, sobald eine neuere
  Version verfügbar ist – mit Link zu „Was ist neu". Quelle ist die neueste GitHub-Release-Note
  (serverseitig gecacht); jeder Release-Tag erzeugt nun automatisch ein GitHub Release.

### Geändert

- **Dokumentation & Repo-Struktur aufgeräumt:** Der Projekt-Root enthält nur noch das Nötigste
  (`README`, `INSTALL`, `UPDATE`, `CHANGELOG`, `LICENSE`, `CLAUDE.md`); die übrige Doku ist jetzt
  nach `docs/betrieb/`, `docs/entwicklung/` und `docs/archiv/` einsortiert.
- **Veraltete Doku-Inhalte korrigiert:** öffentliches Repo + MIT-Lizenz (statt „privat/proprietär"),
  White-Label als verworfen markiert, Doppelungen entfernt (Changelog und Backend-API jeweils nur noch
  an einer Stelle) und tote Verweise (gelöschte `WHITE-LABEL.md`) bereinigt.
- **Installation robuster:** Setup-Skripte unterscheiden „Docker nicht installiert" vs. „nicht
  gestartet", prüfen Compose v2 und halten das Fenster bei Fehlern offen; `INSTALL.md` erklärt den
  Doppelklick-Weg inkl. macOS-Gatekeeper- und Windows-SmartScreen-Hinweis.
- **Update-Strategie überarbeitet:** Releases tragen jetzt auch einen Major-Tag (`:2`); Gemeinde- und
  Prod-Instanz sind auf `:2` gepinnt (sichere Updates, kein ungewollter v3-Sprung). Das veraltete
  `containrrr/watchtower` wurde abgelöst – die Test-Instanz nutzt den gepflegten Fork
  `nickfedor/watchtower`, die Prod-Instanz aktualisiert bewusst (Hinweis künftig über das In-App-Banner).
- **Container-Healthcheck** im Docker-Image: Docker/Container-Manager erkennt jetzt, ob die App
  wirklich antwortet (prüft `/api/health`).
- **Automatische Tests für die ChurchTools-Anbindung** ergänzt (39 zusätzliche Server-Tests):
  Versions-Erkennung, Uhrzeit-Ausblenden, Zuständige, Zeitzonen-Umrechnung u. a. – fängt Fehler
  bei künftigen Änderungen früh ab, statt erst im Gottesdienst.

### Sicherheit

- **App läuft im Container jetzt als unprivilegierter Benutzer** (statt als root): zusätzliche
  Schutzschicht. Ein Entrypoint übereignet das Daten-Volume beim Start automatisch – auch
  bestehende Instanzen funktionieren ohne manuellen Eingriff weiter.
- **`SESSION_SECRET` ist in Produktion jetzt Pflicht** – kein unsicherer Fallback mehr (sonst wären
  die signierten Login-Cookies fälschbar). In der Entwicklung bleibt ein Komfort-Default.
- **Neues Flag `COOKIE_SECURE`** (Standard aus): Wer ausschließlich über HTTPS läuft (Reverse
  Proxy/Cloudflare), setzt es auf `true` und liefert das Login-Cookie dann nur noch über HTTPS aus.
  Im reinen LAN-HTTP-Betrieb bleibt es aus (unverändertes Verhalten).

## [2.1.7] – 2026-06-26

### Geändert

- **Bearbeiten-Hinweis** im Ablauf-Bearbeiten-Modus präzisiert: „Ziehen zum Sortieren · Eintrag antippen zum Bearbeiten" (vorher „Punkt …").

## [2.1.6] – 2026-06-26

### Neu

- **Neue Ablauf-Ansicht** in der Setlist (ersetzt die reine Lied-Liste): zeigt den kompletten Gottesdienst-Ablauf wie in ChurchTools – aufgeräumt mit Uhrzeit, Dauer je Punkt, Notizen und Zuständigen, auch Nicht-Lied-Positionen. Lieder darin sind antippbar und führen direkt zu den Charts.
- **Liederheft direkt aus der Terminübersicht:** Jede Termin-Karte hat (wenn Lieder vorhanden) rechts einen Noten-Button, der sofort die Lieder-Charts des Gottesdienstes öffnet – ohne Umweg über den Ablauf.
- **Uhrzeit pro Punkt ausblenden** (mit Bearbeiten-Recht): über das Bearbeiten-Fenster eines Punkts lässt sich die Uhrzeit aus-/einblenden (z. B. bei Soundcheck oder wenn mehrere Dinge gleichzeitig laufen) – **echt mit ChurchTools synchronisiert** (das „Auge"), in beide Richtungen. Der Punkt selbst bleibt mit Titel und Dauer erhalten.
- **Dauer pro Punkt bearbeiten** (mit Bearbeiten-Recht): über das Aktionsmenü eines Punkts die Dauer in Minuten setzen – schreibt nach ChurchTools, die Uhrzeiten verschieben sich automatisch.
- **Bemerkung bearbeiten** (mit Bearbeiten-Recht): Notiz/Beschreibung eines Eintrags im Bearbeiten- und Hinzufügen-Fenster setzen (wie „Bemerkung" in ChurchTools); wird im Ablauf angezeigt.

### Geändert

- **Einheitliche Dialoge:** Eintrag bearbeiten/hinzufügen sowie die Einstellungs-Dialoge (Organisation, Links verwalten) erscheinen jetzt als zentrierte Fenster mit allen Feldern auf einen Blick – statt der von unten einfahrenden Schublade. Konsistent und näher an ChurchTools.

### Behoben

- **Versionsanzeige im Mehr-Tab** zeigte fest „v2.0" statt der echten Version. Sie wird jetzt zur Build-Zeit aus dem Git-Tag gesetzt (`VITE_APP_VERSION`, vom CI als Build-Arg) und veraltet damit nicht mehr.

## [2.1.5] – 2026-06-26

### Neu

- **„Kaffee spendieren"-Bereich** im Mehr-Tab **und auf der Login-Seite**: dezente, freiwillige Unterstützung für den ehrenamtlichen Entwickler über PayPal mit vorgewählten Beträgen (1/3/5 €) und freier Eingabe. Bewusst zurückhaltend ganz unten platziert.

## [2.1.4] – 2026-06-26

### Geändert

- **Button „Punkt hinzufügen" → „Eintrag hinzufügen"** im Ablauf-Bearbeiten-Modus (passt besser, da auch Überschriften und Texte hinzugefügt werden).

## [2.1.3] – 2026-06-26

### Behoben

- **Unnötige Lücken bei breiten Akkorden:** Steht ein Akkord über einer kurzen Silbe (z. B. `E/G#`
  über „ler", `C#m` über „An"), wurde bisher immer mindestens die Akkordbreite freigehalten – auch
  wenn das nächste Wort gar keinen Akkord hat. Das erzeugte sichtbare Lücken („An␣␣␣den",
  „Ich␣␣␣glaube"). Jetzt darf ein breiter Akkord über die folgenden akkordlosen Wörter ragen (wie
  in Lead-Sheets üblich); Extra-Platz wird nur erzwungen, wenn direkt danach wieder ein Akkord
  käme – Akkorde überlappen also nie.
- **Einheitlich linksbündige Zeilen:** Zeilen, die im Quelltext nach dem ersten Akkord mit
  Leerzeichen beginnen (`[A]   Ich…`), starteten eingerückt, während andere bündig am Rand
  standen. Jetzt beginnt jede Zeile bündig am linken Rand. Mehrfach-Leerzeichen innerhalb der
  Zeile bleiben unberührt.

## [2.1.2] – 2026-06-26

### Behoben

- **Lücken in der „Akkorde & Text"-Ansicht:** Akkorde, die im Quelltext mit Leerzeichen vor dem
  Wort notiert sind („[C] wort"), landeten auf einem reinen Leerzeichen und wurden auf Akkordbreite
  aufgezogen – das erzeugte eine Lücke, über der der Akkord schwebte. Jetzt sitzt der Akkord bündig
  über dem zugehörigen Wort. Reine Instrumental-Akkorde ohne Text behalten ihren Abstand.
- **„Nur Text"-Ansicht sauber dargestellt:** Bisher wurden nur die Akkorde ausgeblendet, sodass
  Silbentrenner („Va - ter"), akkordbedingte Lücken und Einrückungen stehen blieben. Jetzt wird der
  reine Liedtext als ordentlicher, linksbündiger Fließtext gerendert – Silben werden zusammengeführt
  („Vater"), Mehrfach-Leerzeichen reduziert und Einrückungen entfernt. Die Akkord-Ansicht bleibt
  unverändert.

### Geändert

- **Zoom-Notausgang in die Kopfleiste:** Der Knopf „Zoom zurücksetzen" sitzt jetzt oben in der
  Menüleiste neben „Aa" (statt schwebend über dem Liedtext) und erscheint nur, wenn eine Seite
  reingezoomt ist. Neues Symbol (Lupe mit Rahmen-Ecken) passt zum übrigen Icon-Stil.
- **Seitenzahl nur bei mehrseitigen Liedern:** Die Anzeige unten rechts erscheint in der
  Strom-/Mehrseiten-Ansicht nur noch, wenn das aktuelle Lied mehr als eine Seite hat, und zählt
  lied-bezogen (z. B. „Seite 1 / 2"). Bei einseitigen Liedern entfällt sie – die Pfeile genügen.

## [2.1.1] – 2026-06-25

### Behoben

- **Festhängender Zoom in der Strom-/Mehrseiten-Ansicht (iPad):** Eine reingezoomte Seite konnte
  „kleben" bleiben – besonders, wenn ein gespeicherter Zoom beim Öffnen wiederhergestellt wurde
  (dann gab es keinen sichtbaren Ausweg). Neu erscheint ein Knopf **„Zoom zurücksetzen"**, sobald
  eine Seite vergrößert ist; ein Tipp setzt die Seite auf Normalgröße zurück **und** löscht ihren
  gespeicherten Zoom dauerhaft. Pinch-Zoom und das bewusste Speichern eines Ausschnitts bleiben
  unverändert.

## [2.1.0] – 2026-06-25

### Neu

- **Mehrere benannte Lied-Versionen:** Statt nur „Original/Bearbeitet" lassen sich pro Lied
  beliebig viele benannte Versionen anlegen (z. B. „Akustik", „Jugend"), umschalten, umbenennen
  und löschen. Versionen liegen im ChurchTools-Arrangement und sind für das ganze Team sichtbar.
  Tonart, Kapo, Spalten, Schrift, Abschnitts-Transponierung **und Anmerkungen gelten je Version**.
- **Persönliches Setup pro Konto (geräteübergreifend):** Anmerkungen (Stift/Text), Zoom sowie die
  Lied-Einstellungen werden jetzt am ChurchTools-Konto auf dem Server gespeichert und synchronisiert
  (vorher nur lokal pro Gerät). **Musikalische Einstellungen** (Tonart, Kapo, Abschnitte, gewählte
  Version, Nur-Text, Anzeige) gelten auf allen Geräten gleich. **Display-abhängige Einstellungen**
  (Spalten, Schrift, Zoom) werden **pro Gerätetyp** geteilt – Handy und „Tablet/Computer" getrennt,
  damit z. B. 2 Spalten vom iPad nicht auf dem Handy landen. Aktualisiert sich automatisch (alle
  30 s bzw. beim Zurückkehren zur App); vorhandene Geräte-Daten werden beim ersten Start übernommen.
- **Akkord-Ansicht als PDF (SongSelect-Look):** Jedes Lied wird aus dem ChordPro-Text als
  sauberes PDF erzeugt und angezeigt. Komplett **schwarz** (saubere S/W-Ausdrucke), deutliche
  Abschnitts-Labels (Vers/Refrain), Kopfzeile mit Tonart/Taktart/BPM und dem
  **ChurchTools-Musik-App-Logo oben rechts**. Lange Zeilen werden umbrochen, Abschnitte bleiben
  zusammen, 2-spaltiger Satz ohne Überlappung.
- **Zoom als Modus:** Pinch zum Zoomen, dann **✓ (Fertig) / ✗ (Zurück)** zum Festsetzen der
  Ansicht – danach funktionieren Wischen und Tippen wieder normal. Der Zoom wird **pro Lied-Seite
  dauerhaft gespeichert** (kein blauer Aktiv-Balken im Live-Betrieb).
- **2-Seiten-Querformat-Strom:** Im Querformat laufen zwei Seiten nebeneinander als ein Strom
  über den ganzen Ablauf; jede Seite ist ein eigener Bereich mit eigenem Zoom. Seiten auf leicht
  grauem Grund mit Mittelstreifen (Seitenränder beim Zeichnen sichtbar); eine einzelne Seite ist
  linksbündig, das letzte Lied steht nie allein (rechts, vorheriges links).
- **Volle Anmerkungen pro Lied-Seite:** Stift, Marker (glatter Leuchtstrich), Radierer (Farben
  Schwarz/Rot/Gelb), Textfelder sowie **Rückgängig/Wiederholen** – pro Version gespeichert.
- **Ablauf-Export als PDF** (Teilen-Symbol) – exportiert die Lieder genau wie angezeigt.

### Geändert

- **Viewer-Hintergrund** der Akkord-Ansicht jetzt leicht grau (statt weiß) + dezenter Seitenschatten,
  damit beim Zeichnen die Seitenränder klar erkennbar sind.
- **App-Logo** im PDF eng in die obere rechte Ecke gesetzt (eigene, zugeschnittene Logo-Variante
  ohne transparenten Rand; das App-Icon bleibt unverändert).
- **Auslieferung Test-Instanz:** Auto-Deploy über ein `:staging`-Image (GitHub-CI) + Watchtower auf
  dem NAS – kein manueller Container-Neubau mehr (siehe `deploy/docker-compose.staging.yml`).
- **Wartung:** Build-Werkzeug **Vite auf 8** angehoben (inkl. Vitest 3, `@vitejs/plugin-react`,
  `vite-plugin-pwa`). Behebt die zurückgestellten `npm audit`-Findings in `esbuild` (betrafen nur
  den lokalen Dev-Server, kein Produktivrisiko): von 7 Hinweisen (u. a. „high"/„critical") auf 1
  „low" (Windows-only Dev-Server). Build/Tests (44)/Lint grün. Keine Änderung am App-Verhalten.
- Basis-Image und CI auf **Node 22** (Vite 8 setzt Node ≥ 20.19 voraus).
- Vitest: deprecated `environmentMatchGlobs` entfernt – Komponenten-Tests setzen ihre
  jsdom-Umgebung per `// @vitest-environment`-Docblock.

### Behoben

- **Anmerkungen zuverlässiger:** kein Festhängen mehr (Pointer-Capture, nur Primär-Finger,
  Abbruch-Behandlung); über Textfeldern kann nun mit Stift/Marker gezeichnet werden.
- **Marker** zeichnet wieder einen glatten, gleichmäßigen Leuchtstrich (kein „Gepunktel" mehr).
- **Textfelder:** ließen sich nicht platzieren (Text-Ebene war 0×0) – behoben. Nach dem Eintippen
  ist der Text ausgewählt (Bearbeiten-/Verschieben-Rahmen); ein Klick ins Leere schließt nur das
  Eingabefeld bzw. hebt die Auswahl auf, statt ein neues Feld anzulegen oder den Text zu verschieben.
- **Auto-Auffrischung** überschreibt keine gerade gemachten Anmerkungen/Einstellungen mehr, bevor
  sie hochgeladen sind (Text bleibt stehen, „Alles löschen" wird nicht wieder zurückgeholt).
- **Letztes Lied** im 2-up-Querformat steht jetzt rechts (vorheriges links) statt allein links.
- **„Link hinzufügen"** stürzt nicht mehr ab, wenn die App über HTTP läuft (`crypto.randomUUID`
  nur im sicheren Kontext – Fallback ergänzt).
- Akkord-Seiten füllen im **Hoch- und Querformat** korrekt die Höhe (kein zu kleines Dokument).
- Rand-Tippen überspringt keine zweite Seite mehr; nach Rückkehr in die App stimmt die
  Querformat-Ansicht wieder.
- Liederliste: runder **Hinzufügen-Knopf** statt eckigem Kasten, einheitliche Zeilenhöhen;
  keine ungewollte vertikale Scroll-Bewegung der ganzen WebApp mehr.

## [2.0.1] – 2026-06-22

### Behoben

- **iOS-PWA-Layout (Homescreen/Standalone):** App füllt jetzt zuverlässig den vollen Bildschirm
  in **beiden** Ausrichtungen. Ursachen behoben:
  - `100dvh` aktualisierte sich beim Drehen nicht (Tab-Leiste rutschte im Querformat unter den
    Bildschirm) → App-Höhe wird jetzt aus `window.innerHeight` gesetzt (`--app-h`, mehrfach
    nachgesetzt bei `load`/`pageshow`/rAF) **plus** der unteren Safe-Area, die `innerHeight` im
    Standalone-Modus ausschließt (sonst dunkler Streifen unter der Leiste).
  - Detailansichten (Setlist/Chart) richteten ihr `position:absolute`-Layout am Layout-Viewport
    aus (ohne untere Safe-Area) → `#root` ist jetzt Bezugsrahmen, die Ansichten füllen die volle
    Höhe (kein leerer Balken / dunkler Streifen mehr).
  - Scrollbereiche bekommen unten Platz, damit der letzte Eintrag über den Home-Strich hinaus
    scrollbar ist.
- **Chord-Chart-Footer** springt nicht mehr zwischen 1- und 2-zeiligen „Nächstes Lied"-Titeln
  (feste Mindesthöhe, max. 2 Zeilen) und sitzt mit stabilem Abstand über dem Home-Strich.
- Tab-Leiste: Abstand der Symbole über dem Home-Strich vereinheitlicht und feinjustiert.

## [2.0.0] – 2026-06-19

Erster **öffentlicher** Release, für die Verteilung an andere Gemeinden
(jede Gemeinde betreibt ihre eigene, autarke Instanz desselben Codes).

### Geändert
- **ChurchTools-Look** als feste App-Optik (Tab-Navigation, neue Farb-/Schrift-Tokens,
  Light/Dark). Die frühere White-Label-Idee (Theming pro Gemeinde) ist verworfen.
- **Von ECG entkoppelt:** `CHURCHTOOLS_BASE_URL` ist Pflichtfeld ohne Default (die App
  startet nicht ohne eigene URL), Gemeindename-Default neutral, Titel generisch.
- Feature „bearbeitete Songversion" intern neutral benannt (vorher überall „ECG"); der
  Datei-Suffix heißt jetzt `— Bearbeitet.chordpro`. Alte `— ECG.chordpro`-Dateien werden
  weiterhin erkannt und beim nächsten Speichern automatisch übernommen.

### Hinzugefügt
- **Verteilung per fertigem Image:** automatischer Build bei jedem Versions-Tag
  (`v*`) → Multi-Arch-Image (amd64 **und** arm64) nach GHCR.
- End-User-Verteilpaket unter `deploy/` (image-basiertes `docker-compose.yml` + `.env.example`).
- **Frei konfigurierbare Links** (Mehr-Tab + optional Login-Seite), pro Instanz anpassbar.
- **Dokumentation:** `README.md`, `INSTALL.md`, `UPDATE.md` und interne Onboarding-Checkliste.
- **MIT-Lizenz** + Disclaimer (inoffizielles Community-Projekt, nicht mit der ChurchTools GmbH verbunden).

## [1.0.0] – 2026-06-18

- Internes/privates Release der App (Setlist aus ChurchTools, Auto-Transponierung,
  ChordPro-Editor, Dokumenten-Viewer, rechtebewusste UI). Produktiv für die ECG Donrath.
