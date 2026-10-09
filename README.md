# Handy-Hintergrund

Bringt ein Foto in das exakte Bildschirmformat eines Handys, ohne Verzerren und ohne Abschneiden.
Alles läuft im Browser, Fotos werden nirgendwohin hochgeladen. Es gibt keinen Server und keine Kosten.

## Lokal starten

1. Terminal öffnen und in den Projektordner wechseln:
   ```
   cd ~/Documents/Wallpaper
   ```
2. Einen kleinen Webserver starten (Python ist auf dem Mac schon installiert):
   ```
   python3 -m http.server 8000
   ```
3. Im Browser öffnen: http://localhost:8000
4. Beenden: im Terminal `Ctrl + C` drücken.

Die Seite einfach per Doppelklick als Datei zu öffnen, funktioniert nicht, weil Browser dann aus Sicherheitsgründen keine Zusatzdateien laden.

## Kostenlos veröffentlichen (GitHub Pages)

So bekommt die Seite eine öffentliche Adresse wie `https://deinname.github.io/handy-hintergrund/`. Das kostet nichts und braucht keinen Server.

**Einmalig vorbereiten**

1. Auf https://github.com ein kostenloses Konto anlegen.
2. Die kostenlose App **GitHub Desktop** installieren: https://desktop.github.com und mit dem GitHub-Konto anmelden.
   (Über die GitHub-Webseite allein geht es nicht, weil sie nur Dateien bis 25 MB annimmt; eine Datei der KI-Laufzeit ist 27 MB groß.)

**Hochladen**

3. In GitHub Desktop: Menü **File → Add Local Repository …**, den Ordner `Documents/Wallpaper` auswählen, **Add Repository** klicken.
4. Oben auf **Publish repository** klicken.
   - Name: z. B. `handy-hintergrund`
   - Den Haken bei **Keep this code private** entfernen (GitHub Pages ist für öffentliche Projekte kostenlos).
   - **Publish Repository** klicken.

**Seite einschalten**

5. Auf github.com das neue Projekt öffnen, dann **Settings → Pages**.
6. Bei **Source** „Deploy from a branch“ wählen, bei **Branch** `main` und `/ (root)`, dann **Save**.
7. Nach 1–2 Minuten erscheint oben auf derselben Seite die Adresse. Fertig.

**Später etwas ändern**

Änderungen im Ordner speichern, in GitHub Desktop unten links eine kurze Beschreibung eintragen, **Commit to main** und danach **Push origin** klicken. Nach 1–2 Minuten ist die Seite aktualisiert.

**Auf dem Handy testen**

Nach dem Veröffentlichen auf dem Handy `https://deinname.github.io/handy-hintergrund/test/selbsttest.html` öffnen und **Test starten** tippen. Die Seite probiert alle Varianten automatisch durch und zeigt am Ende „Alles in Ordnung“ oder, was nicht geklappt hat. Im WLAN testen: Beim ersten Mal werden ca. 208 MB geladen.

(Über das Heimnetz, z. B. `http://192.168.…:8000`, lässt sich die Seite auf dem Handy nur eingeschränkt testen: Browser erlauben den Modell-Speicher und die schnelle Berechnung nur über `https` oder auf dem eigenen Rechner.)

**Alternative ohne Git:** Bei https://app.netlify.com/drop den Projektordner ins Browserfenster ziehen. Netlify ist ebenfalls kostenlos; für eine dauerhafte Adresse ist ein Konto nötig.

## Prüfen, dass keine Fotos hochgeladen werden

Im Browser die Entwicklerwerkzeuge öffnen (Chrome: Rechtsklick → **Untersuchen** → Reiter **Netzwerk**), dann ein Foto wählen und herunterladen. In der Liste erscheinen nur Dateien der Seite selbst und beim ersten KI-Einsatz der Modell-Download von `huggingface.co`. Es gibt keine Anfrage, die ein Foto verschickt.

## Die Varianten

Das Foto wird immer vollständig und unverzerrt in die Zielfläche gesetzt. Die übrige Fläche wird so gefüllt:

| Variante | So funktioniert sie | Gezeigt bei |
|---|---|---|
| Inhaltsbasiert gestreckt (Seam Carving) | Fügt Pixelstreifen an unauffälligen Stellen ein, z. B. im Himmel. Nichts wird erfunden. | wenig zu füllen (bis ca. 15 %) |
| KI-Erweiterung | Die KI LaMa malt die Ränder passend weiter. | wenig bis mittel (bis ca. 45 %), bei viel als Zusatzoption |
| Unschärfe-Hintergrund | Das Foto weichgezeichnet als Hintergrund. Funktioniert immer und sofort. | mittel und viel |
| KI + Unschärfe | Nahe am Foto die KI-Ergänzung, nach außen weicher Übergang in die Unschärfe. | viel zu füllen (über ca. 45 %) |

Die als beste eingeschätzte Variante steht zuerst und ist mit „Empfohlen“ markiert. Die Grenzwerte stehen in `js/config.js` (`FILL_SMALL`, `FILL_LARGE`, `SEAM_MAX_STRETCH`) und lassen sich dort anpassen.

## Die KI-Erweiterung

- Beim ersten Antippen der KI-Karte wird das Modell einmalig geladen (ca. 208 MB) und danach im Browser gespeichert. Beim nächsten Besuch startet die KI ohne Download.
- Die Berechnung läuft auf deinem Gerät: mit dem Grafikchip (WebGPU), falls verfügbar, sonst mit dem Prozessor.
- Beim allerersten Besuch lädt die Seite einmal kurz neu. Das ist gewollt: Erst danach darf die KI mehrere Prozessorkerne nutzen.

### Gemessene Zeiten

Gemessen auf einem MacBook mit Apple M1 (8 Kerne, 16 GB), Foto 3:4 für ein iPhone 17 Pro (1206 × 2622), zwei Ränder. Die Zeiten für die KI-Variante gelten, nachdem das Modell einmal geladen wurde.

| Situation | Chrome 154 | Firefox 157 | Safari 26 |
|---|---|---|---|
| KI-Variante berechnen | ca. 5 s (Grafikchip) | ca. 10 s | ca. 12 s (Prozessor¹) |
| KI-Variante nur mit Prozessor (Laptop ohne Grafikchip) | ca. 10 s | – | – |
| KI vorbereiten (einmal pro Seitenaufruf) | ca. 6 s | ca. 6 s | ca. 9 s |
| Modell-Download beim ersten Mal (208 MB, abhängig von der Verbindung) | 35–85 s | ca. 50 s | ca. 60 s |
| Seam Carving | unter 0,5 s | | |
| Foto mit 48 Megapixeln einlesen | 0,3 s | | |

¹ Safari rechnet dieses Modell mit dem Grafikchip langsamer (ca. 25 s) als mit dem Prozessor, darum nutzt die Seite in Safari den Prozessor.

Auf dem Handy wurde noch nicht gemessen: Dafür nach dem Veröffentlichen die Selbsttest-Seite öffnen (siehe oben).

## Neue Handymodelle ergänzen

In `data/devices.json` einen vorhandenen Eintrag kopieren und anpassen. `breite` und `hoehe` sind die native Auflösung in Pixeln im Hochformat.

## Einstellungen

Schwellenwerte, Unschärfe-Stärke, JPEG-Qualität usw. stehen gesammelt in `js/config.js`.

## Verwendete Bibliotheken, Modelle und Inhalte

| Was | Wofür | Lizenz |
|---|---|---|
| [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) 1.30.0 (`vendor/onnxruntime-web`) | Führt das KI-Modell im Browser aus | MIT |
| [LaMa](https://github.com/advimman/lama), ONNX-Export [Carve/LaMa-ONNX](https://huggingface.co/Carve/LaMa-ONNX) | KI-Füllung der Ränder (wird beim ersten Benutzen von Hugging Face geladen, ca. 208 MB) | Apache-2.0 |
| [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) 0.1.7 | Erlaubt schnellere Mehrkern-Berechnung auch auf GitHub Pages | MIT |
| Beispielfotos: [Beach at Sunrise](https://commons.wikimedia.org/wiki/File:Beach_at_Sunrise.jpg), [Forest path during autumn](https://commons.wikimedia.org/wiki/File:Forest_path_during_autumn.jpg) (Wikimedia Commons) | Beispiel und Tests | CC0 |

Hinweis zu LaMa: Das Modell wurde mit dem Bilddatensatz Places365 trainiert, dessen Nutzungsbedingungen auf Forschung ausgerichtet sind. Die Modelldatei selbst ist unter Apache-2.0 veröffentlicht.

Seam Carving, Unschärfe-Hintergrund, Kombination, Layout und Export sind eigener Code ohne weitere Bibliotheken.
