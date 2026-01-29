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
Then open `http://localhost:3000` in your browser.

## Data storage
- Data lives in `data.db` in the project root.
- The app creates the DB and tables on first run; no migrations needed.
- Notes and tasks (with per-day ordering) are stored here. Notes can embed pasted images; those images are stored as BLOBs in the same DB.

## API overview (local only)
- `GET /api/notes` — list notes
- `POST /api/notes` — create note
- `PUT /api/notes/:id` — update note
- `DELETE /api/notes/:id` — delete note
- `POST /api/notes/:id/assets` — upload image (FormData `file`)
- `GET /api/assets/:assetId` — fetch stored image
- `GET /api/tasks?date=YYYY-MM-DD` — tasks for a day (ordered)
- `POST /api/tasks` — create task `{ name, hours, date_key }`
- `PUT /api/tasks/:id` — update task
- `POST /api/tasks/reorder` — reorder tasks for a date `{ date_key, order: [ids] }`

## Resetting data
Delete `data.db` and restart `npm start` to regenerate an empty database.

## Notes on repo size
If you clone elsewhere, run `npm install` to recreate `node_modules`; you can safely delete the committed `node_modules` directory if you prefer and add it to `.gitignore`.
