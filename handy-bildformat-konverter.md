# Projekt: Handy-Bildformat-Konverter

## Ziel

Eine Website, die ein Foto in das exakte Bildschirmformat eines bestimmten Handys bringt, **ohne zu verzerren und ohne Bildinhalt abzuschneiden**. Fehlende Fläche füllt das Tool möglichst natürlich auf, sodass das Ergebnis optisch wie das Originalbild wirkt, nur im neuen Format.

## Harte Vorgabe: komplett kostenlos

- **Kein Backend, keine kostenpflichtigen APIs, keine laufenden Kosten**
- Die gesamte Bildverarbeitung läuft **im Browser auf dem Gerät des Nutzers**. Fotos werden nirgendwohin hochgeladen. Das soll auf der Seite auch kurz erwähnt werden
- Die Website ist rein statisch und kostenlos hostbar, z. B. über GitHub Pages, Netlify oder Vercel
- Alle verwendeten Modelle und Bibliotheken müssen kostenlos und frei nutzbar sein. Lizenzen bitte prüfen und im README nennen

## Nutzerablauf

1. Foto hochladen (Drag & Drop oder Dateiauswahl; auf dem Handy auch aus der Galerie)
2. Zielgerät wählen:
   - **Automatisch:** Wird die Seite auf einem Handy geöffnet, die echte Bildschirmauflösung erkennen (`screen.width/height × devicePixelRatio`) und als Vorschlag vorauswählen
   - **Aus einer Liste:** Suchbare Auswahl gängiger Modelle (iPhone, Samsung Galaxy, Google Pixel, Xiaomi usw.)
   - **Manuell:** Eigene Breite × Höhe eingeben
3. Das Tool berechnet mehrere Varianten und zeigt sie nebeneinander an
4. Nutzer wählt seine Lieblingsvariante, kann die Position des Originals innerhalb der Fläche verschieben und lädt das Bild in exakter Zielauflösung herunter

## Verfahren

Das Originalbild wird immer so skaliert, dass es **vollständig** in die Zielfläche passt („contain“). Die übrige Fläche wird mit einem der folgenden Verfahren gefüllt. Das Original selbst bleibt immer unverändert, außer beim Seam Carving.

### A) KI-Erweiterung mit LaMa (Kernfunktion)

- Das Inpainting-Modell **LaMa** als ONNX-Export über **ONNX Runtime Web** im Browser ausführen. Wenn verfügbar mit WebGPU, sonst mit WASM als Fallback
- Ein passendes, frei lizenziertes ONNX-Modell finden (z. B. auf Hugging Face) und von dort laden, nicht ins Repo legen, wegen Dateigrößenlimits beim Hosting. Nach dem ersten Laden im Browser cachen (Cache API), damit es beim nächsten Besuch sofort da ist
- **Auflösungsproblem:** LaMa arbeitet typischerweise mit fester Eingabegröße (z. B. 512×512). Vorgehen:
  1. Das Bild mit Rändern auf Modellgröße verkleinern, eine Maske für die leeren Bereiche erzeugen und von LaMa füllen lassen
  2. Das Ergebnis auf Zielgröße hochskalieren
  3. **Nur die gefüllten Randbereiche** übernehmen und mit dem Original in voller Auflösung zusammensetzen. Den Übergang mit einem weichen Verlauf über einige Pixel kaschieren
  - Bei großen Rändern optional in mehreren Schritten erweitern, jeweils ein Stück, statt alles auf einmal. Das testen und nur einbauen, wenn es sichtbar besser wird
- Die Verarbeitung in einem **Web Worker** laufen lassen, damit die Seite nicht einfriert. Eine Fortschrittsanzeige zeigen, beim ersten Mal auch für den Modell-Download

### B) Seam Carving (inhaltsbasierte Skalierung)

- Für kleine Formatunterschiede: Pixelstreifen in unwichtigen Bildbereichen einfügen, sodass das Bild das Zielformat erreicht, ohne wichtige Objekte zu verzerren
- Eigene Implementierung oder eine frei lizenzierte JS-Bibliothek, ebenfalls im Web Worker
- Maximal ca. 15–20 % Streckung, sonst wird es sichtbar schief. Bei größerem Unterschied diese Variante nicht anbieten

### C) Unschärfe-Hintergrund

- Das Foto formatfüllend vergrößert, stark weichgezeichnet und leicht abgedunkelt als Hintergrund, das unveränderte Original darüber
- Läuft sofort, funktioniert immer und dient als zuverlässige Variante bei großen Formatsprüngen

### D) Kombination

- LaMa für einen Teil der Fläche, der Rest weich in den Unschärfe-Hintergrund überblenden. Gedacht für große Formatsprünge, bei denen LaMa allein verwaschen oder repetitiv wird

### Automatische Auswahl und Anzeige

Aus dem Verhältnis von Original- zu Zielformat den Anteil der zu füllenden Fläche berechnen:

- **Klein (bis ca. 15 %):** Seam Carving und LaMa anzeigen
- **Mittel (ca. 15–45 %):** LaMa und Unschärfe anzeigen
- **Groß (über ca. 45 %):** Kombination und Unschärfe anzeigen, LaMa allein nur als zusätzliche Option

Die Schwellenwerte zentral als Konstanten definieren, damit ich sie nach dem Testen anpassen kann. Die als beste eingeschätzte Variante zuerst und hervorgehoben zeigen.

## Gerätedaten

- Eine `devices.json` mit Hersteller, Modell, Erscheinungsjahr und nativer Auflösung in Pixeln
- Mit den gängigen Modellen der letzten ca. 4 Jahre befüllen. Die Werte sorgfältig recherchieren, nicht schätzen
- So aufbauen, dass ich neue Modelle einfach ergänzen kann

## Vorschau mit Sperrbildschirm (optional, zweite Ausbaustufe)

- Umschaltbare Vorschau, die grob Uhrzeit, Kamera-Aussparung und Dock andeutet, damit man sieht, ob etwas Wichtiges verdeckt wird
- Nur schematische, selbst gezeichnete Elemente, keine Nachbauten echter Herstelleroberflächen

## Export

- Exakt in der Zielauflösung
- Format wählbar: JPEG (Qualität ca. 92 %, Standard) oder PNG
- Dateiname z. B. `foto_iphone-16-pro_1206x2622.jpg`
- Wenn möglich EXIF-Ausrichtung des Originals beim Einlesen berücksichtigen, damit Handyfotos nicht gedreht ankommen

## Technik

- Statische Seite mit Vanilla JS oder einem leichten Build-Setup (Vite ist ok). Kein Framework-Overhead, wenn nicht nötig
- Responsiv, auf dem Handy genauso gut bedienbar wie am Laptop
- Große Fotos (z. B. 48-MP-Handyfotos) dürfen den Browser nicht zum Absturz bringen. Vor der Verarbeitung sinnvoll begrenzen

## Nicht im Umfang

- Kein Server, keine Nutzerkonten, keine kostenpflichtigen Dienste
- Keine Bildbearbeitung über das Formatanpassen hinaus (keine Filter usw.)

## Vorgehen

1. Zuerst einen kurzen Plan vorlegen und offene Fragen klären
2. **Zuerst das Risiko prüfen:** Eine minimale Testseite, die LaMa im Browser lädt und an einem Beispielbild einen Rand füllt. Mir das Ergebnis zeigen und berichten, wie lange es auf einem normalen Laptop dauert
3. Danach Upload, Geräteauswahl, Unschärfe-Variante und Export bauen. Damit ist die Seite schon nutzbar
4. LaMa-Variante mit dem Zusammensetzen in voller Auflösung integrieren
5. Seam Carving, Kombination und automatische Auswahl ergänzen
6. Zum Schluss Feinschliff und optional die Sperrbildschirm-Vorschau

## Abnahmekriterien

- Ein Handyfoto im Format 3:4 wird für ein aktuelles iPhone im Hochformat erweitert, ohne Verzerrung und ohne Beschnitt. Der Übergang zwischen Original und Ergänzung ist bei normaler Betrachtung nicht erkennbar
- Ein Querformat-Foto liefert für dasselbe Handy mindestens eine ansprechende Variante
- Auf einem normalen Laptop ohne Grafikkarte dauert eine LaMa-Variante (nach dem ersten Modell-Download) höchstens ca. 15 Sekunden. Die gemessenen Zeiten bitte im README nennen
- Die Seite funktioniert in aktuellem Chrome, Safari und Firefox, auch auf dem Handy
- Im Netzwerk-Tab des Browsers ist zu sehen, dass keine Fotos an einen Server gehen

## Lieferumfang

- Lauffähiger Code
- `README.md` mit Anleitung zum lokalen Starten und zum kostenlosen Veröffentlichen, z. B. über GitHub Pages. Die Anleitung soll so geschrieben sein, dass jemand ohne viel Programmiererfahrung sie befolgen kann
- Liste der verwendeten Modelle und Bibliotheken mit ihren Lizenzen
