# TimeTracker

Lokale Wochenplanung für macOS und Linux. Eine Woche, Montag bis Sonntag, 6:00 bis 23:00. Einträge lassen sich mit der Maus zeichnen, verschieben und in der Länge ändern. Ein Schalter oben rechts zeigt neben dem Plan die tatsächlich genutzte Zeit. Die Ist-Zeit übernimmt den Plan, bis sie selbst angepasst wird.

Links liegt eine Todo-Liste. Todos haben eine Farbe und Unter-Todos, die diese Farbe übernehmen. Ein Todo oder Unter-Todo kann auf den Plan gezogen werden; Titel und Farbe bleiben verknüpft. Alles bleibt auf dem Gerät, ohne Konto und ohne Synchronisation.

## Installieren

Die Installer liegen bei den [GitHub Releases](https://github.com/suneet-feldion/TimeTracker/releases).

- macOS: die `.dmg` öffnen und TimeTracker nach Programme ziehen. Der Build ist nicht signiert. Beim ersten Start die App im Finder mit rechts anklicken und „Öffnen“ wählen.
- Linux (amd64): das `.deb` installieren oder das AppImage ausführbar machen (`chmod +x TimeTracker_*.AppImage`) und starten.

## Entwicklung

Voraussetzung: Node.js 20+ und Rust.

```bash
npm install
npm test
npm run tauri dev
```

`npm run dev` startet nur die Oberfläche unter http://127.0.0.1:1420 und speichert im `localStorage` des Browsers.

## Daten

Die Desktop-App schreibt `timetracker.json` ins App-Datenverzeichnis:

- macOS: `~/Library/Application Support/com.suneet.timetracker/timetracker.json`
- Linux: `~/.local/share/com.suneet.timetracker/timetracker.json`

## Tastatur

- Pfeil links / rechts: Woche wechseln
- Cmd oder Strg + C, dann einen Tag anklicken, Cmd oder Strg + V: Eintrag kopieren
- Entf oder Rücktaste: ausgewählten Eintrag löschen
- Doppelklick: Titel und Farbe

## License

MIT. See [LICENSE](LICENSE).

---

# TimeTracker

A local weekly planner for macOS and Linux. One week at a time, Monday to Sunday, 6:00 to 23:00. Draw, move, and resize entries with the mouse. A switch at the top right shows the hours you actually spent next to the plan. Actual time follows the plan until you edit it.

A todo list sits on the left. Todos have a color and sub-todos that inherit it. Drag a todo onto the plan and the block keeps that title and color. The app stays on this computer: no account and no sync.

## Install

Installers are attached to the [GitHub releases](https://github.com/suneet-feldion/TimeTracker/releases).

- macOS: open the `.dmg` and drag TimeTracker to Applications. The build is unsigned. The first time, right-click the app in Finder and choose Open.
- Linux (amd64): install the `.deb`, or mark the AppImage executable (`chmod +x TimeTracker_*.AppImage`) and run it.

## Development

Requires Node.js 20+ and Rust.

```bash
npm install
npm test
npm run tauri dev
```

`npm run dev` serves the interface at http://127.0.0.1:1420 and stores data in the browser `localStorage`.

## Data

The desktop app writes `timetracker.json` to the app data directory:

- macOS: `~/Library/Application Support/com.suneet.timetracker/timetracker.json`
- Linux: `~/.local/share/com.suneet.timetracker/timetracker.json`

## Keyboard

- Left / right arrow: change week
- Cmd or Ctrl+C, click a day, Cmd or Ctrl+V: copy an entry
- Delete or Backspace: remove the selected entry
- Double-click: edit title and color

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
