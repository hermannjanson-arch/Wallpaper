# Handy-Hintergrund

Bringt ein Foto in das exakte Bildschirmformat eines Handys, ohne Verzerren und ohne Abschneiden.
Alles läuft im Browser, Fotos werden nirgendwohin hochgeladen. Es gibt keinen Server und keine Kosten.

> Stand: Schritt 3 von 6 (Upload, Geräteauswahl, Unschärfe-Variante, Export). Die KI-Variante folgt.

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
