# Geo-Quiz – Flüsse und Seen

Kartenquiz im Stil von world-geography-games.com, aber mit Texteingabe statt Klick. `index.html` direkt im Browser öffnen (keine Server nötig).

- `app.js` Karte (D3, Natural Earth 1:50m), Ablauf, Punkte, Zeit
- `fuzzy.js` Namensprüfung: Groß/Klein, Akzente, Tippfehler (Damerau-Levenshtein; 0 Fehler bis 2 Buchstaben, 1 bis 5, 2 bis 9, sonst 3), Alternativnamen
- `build/rivers.json`, `build/lakes.json`: [id, deutscher Name, Kontinent, Alternativnamen, Natural-Earth-Namen]; GeoJSON nach `build/` laden (siehe Kopf von `build/build.py`), dann `python3 build/build.py` → `data/geo.js`
- Seen: Natural Earth 10m-Polygone, Kaspisches Meer aus `ne_50m_geography_marine_polys`; `app.js` dreht Polygon-Ringe, die D3 sonst als „ganze Welt minus See“ liest
- Themen-Auswahl Flüsse / Seen / Gemischt; Test-URL `index.html?autostart&cat=Seen`
- Daten: Natural Earth (Public Domain)
- Karte: Länder 1:50 Mio. (Grüntöne nach MAPCOLOR7), Wüsten und Tundra aus ne_50m_geography_regions_polys (ohne Punjab/Caatingas), Eis aus ne_50m_glaciated_areas, Landesgrenzen als eigene Ebene obenauf
- Meere: `build/seas.json` [id, Name, Region, Alternativen, NE-Namen, [Nomen, Artikel]] aus ne_50m_geography_marine_polys; unter den Landflächen gezeichnet, damit Küsten die groben Polygone abschneiden. Region „Welt“ (Ozeane, Weddell-/Rossmeer) erscheint nur bei „Alle“.
- Tippfehler-Treffer, die exakt dem Namen eines anderen Eintrags entsprechen (Rotes/Totes Meer), zählen als falsch.
- Test-URL für einen Eintrag: `index.html?autostart&cat=Gemischt&item=s-nordsee`
- Spielmodus „Auf Karte zeigen“: Name vorgegeben, Klick auf die Karte. Treffer per Hit-Test in `app.js` (`hitItems`): Flüsse ±10 px, Seen innen oder ±8 px am Ufer, Meere innen; Reihenfolge Fluss direkt unter dem Zeiger > See > Fluss in der Nähe > Meer. Hover markiert gelb, falscher Klick nennt das getroffene Gewässer, 3 Versuche, Tipp zoomt in die Nähe. Regionen zoomen beim Start auf die Region.
- Tests: `?selftest` (Klickpunkt auf jedem Eintrag trifft ihn; Ergebnis im Seitentitel), `?mode=click&autostart&cat=Gemischt&item=r-donau&clicktest` (simulierter Klick, `clicktest=wrong` für Fehlklick); per `--dump-dom` auslesen.
- Schwierigkeit: „Leicht“ = Liste `EASY` in `app.js` (30 Flüsse, 22 Seen, 25 Meere), „Schwierig“ = alle 182. Test: `?level=Schwierig`.
- Zielquote 80/100 %: verfehlt → „Test wiederholen“ mit denselben Fragen (neu gemischt, Menü ausgeblendet); erreicht → Lob. Bei 40 % und 60 % richtiger Antworten (gemessen an allen Fragen) erscheint eine Motivations-Einblendung. Tests: `?autostart&finishtest=6` (Ergebnis mit 6 Richtigen), `?toasttest`, `?goal=100`.
- iPad/Touch (`pointer: coarse`, Test: `?touch`): größere Tap-Flächen, Treffer-Toleranz 20 px, Quiz-Panel oben (Tastatur), Startpanel im Hochformat zentriert, kein Seiten-Zoom. Auf dem iPad muss die App über einen Webserver geladen werden (file:// geht dort nicht).
