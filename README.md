# Dashboard Apps (Local sqlite + Express)

This repo is a self-contained dashboard (clock, calculator, notes, tasks, calendar, jokes) backed by a local SQLite file via sql.js and an Express API.

## Prerequisites
- Node.js 18+ (includes `npm`)

## Install
```bash
npm install
```

## Run
```bash
npm start
```
Then open `http://127.0.0.1:3000` in your browser (or `http://127.0.0.1:$PORT` if you set `PORT`).

## Extension prototype (new tab)
A baseline Chrome-compatible extension is included in `extension/`. It opens from the browser new-tab page, checks the local service, and launches the dashboard URL.

1. Start the local server with `npm start`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked` and select the `extension` folder.
5. Open a new tab to use the extension page.

Notes:
- The extension defaults to `http://127.0.0.1:3000`.
- You can change the API base URL in the extension page if you run on a different port.

## Data storage
- Data lives in a per-user app data folder by default:
  - Windows: `%APPDATA%\\PersonalDashboard\\data.db`
  - macOS: `~/Library/Application Support/PersonalDashboard/data.db`
  - Linux: `${XDG_DATA_HOME:-~/.local/share}/PersonalDashboard/data.db`
- The app creates the DB and tables on first run; no migrations needed.
- Notes and tasks (with per-day ordering) are stored here. Notes can embed pasted images; those images are stored as BLOBs in the same DB.
- Optional overrides:
  - `DASHBOARD_DATA_DIR` to set the base data folder
  - `DASHBOARD_DB_PATH` to set the exact DB file path

## Keeping `data.db` out of git
Recommended: keep your personal `data.db` local and untracked.

1. Add it to `.gitignore` (if you have not already):
```gitignore
data.db
```

2. If `data.db` is already tracked, untrack it:
```bash
git rm --cached data.db
git commit -m "Stop tracking local data.db"
```

3. Options for a starter/empty DB:
- Auto-create: delete the DB file at the configured path and run `npm start`; the app will generate a fresh DB.
- Example file: this repo includes `data.db.example`. Copy it to your target DB path as `data.db`.
- Existing DB: if you already have a compatible DB from prior use, keep using it at the configured path.

## API overview (local only)
- `GET /api/health` - service health and uptime
- `GET /api/version` - app version
- `GET /api/db/export` - download current database file
- `POST /api/db/import` - replace DB from uploaded file (FormData `file`)
- `GET /api/notes` - list notes
- `POST /api/notes` - create note
- `PUT /api/notes/:id` - update note
- `DELETE /api/notes/:id` - delete note
- `POST /api/notes/:id/assets` - upload image (FormData `file`)
- `GET /api/assets/:assetId` - fetch stored image
- `GET /api/tasks?date=YYYY-MM-DD` - tasks for a day (ordered)
- `POST /api/tasks` - create task `{ name, hours, date_key }`
- `PUT /api/tasks/:id` - update task
- `POST /api/tasks/reorder` - reorder tasks for a date `{ date_key, order: [ids] }`

## Resetting data
Delete the DB file from its configured path and restart `npm start` to regenerate an empty database.

## Notes on repo size
If you clone elsewhere, run `npm install` to recreate `node_modules`; you can safely delete the committed `node_modules` directory if you prefer and add it to `.gitignore`.
