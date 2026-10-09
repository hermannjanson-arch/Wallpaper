# Handy-Hintergrund

Bringt ein Foto in das exakte Bildschirmformat eines Handys, ohne Verzerren und ohne Abschneiden.
Alles läuft im Browser, Fotos werden nirgendwohin hochgeladen. Es gibt keinen Server und keine Kosten.

> Stand: Schritt 4 von 6 (Upload, Geräteauswahl, Unschärfe-Variante, KI-Erweiterung, Export). Seam Carving, Kombination und automatische Auswahl folgen.

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

## Die KI-Erweiterung

- Beim ersten Antippen der KI-Karte wird das Modell einmalig geladen (ca. 208 MB) und danach im Browser gespeichert. Beim nächsten Besuch startet die KI ohne Download.
- Die Berechnung läuft auf deinem Gerät: mit dem Grafikchip (WebGPU), falls verfügbar, sonst mit dem Prozessor.
- Beim allerersten Besuch lädt die Seite einmal kurz neu. Das ist gewollt: Erst danach darf die KI mehrere Prozessorkerne nutzen.

### Gemessene Zeiten

Gemessen auf einem MacBook mit Apple M1 (8 Kerne, 16 GB) in Chrome, Foto 3:4 für ein iPhone 17 Pro (1206 × 2622), zwei Ränder:

| Situation | Zeit |
|---|---|
| Erster Besuch: Modell-Download (208 MB, abhängig von der Internetverbindung) | ca. 35–75 s |
| KI vorbereiten (bei jedem Seitenaufruf einmal) | ca. 6 s |
| KI-Variante berechnen mit Grafikchip (WebGPU) | ca. 5 s |
| KI-Variante berechnen nur mit Prozessor (4 Threads, ohne Grafikchip) | ca. 10 s |
| Neu berechnen nach dem Verschieben (WebGPU) | ca. 3 s |
| Zum Vergleich: Firefox, nur Prozessor (Testseite, Schritt 2) | ca. 9 s |

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

Unschärfe-Hintergrund, Layout und Export sind eigener Code ohne weitere Bibliotheken.
