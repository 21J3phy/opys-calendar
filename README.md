# Human-Friendly Calendar (Markdown-Backed + Google Calendar Sync)

A local-first calendar app where every event lives in `calendar.md`, with optional two-way sync to Google Calendar.

## What It Does

- Keeps `calendar.md` as the source of truth.
- Supports drag/drop + resize in the UI.
- Supports task-style check-off directly on events.
- Uses CLI for event creation (`add`), updates, completion, and delete.
- Supports OAuth sign-in with Google for any user.
- Lets you choose which Google Calendar to sync from UI controls.
- Performs two-way sync between local markdown and the selected Google Calendar.
- Prevents duplicate sync rows using stable `externalId` on each event + stored mapping.

## Stack

- Frontend: Vite + React + TypeScript + FullCalendar
- API: Express + TypeScript
- Data format: Markdown + YAML frontmatter + `event` code blocks

## Quick Start

```bash
npm install
npm run dev
```

- Web app: `http://localhost:5173`
- API: `http://localhost:8787`

## Google OAuth Setup

### 1) Create Google Cloud OAuth credentials

1. Create/select a Google Cloud project.
2. Enable **Google Calendar API**.
3. Configure OAuth consent screen as needed for your app.
4. Create OAuth Client ID (Web application).

### 2) Configure redirect URIs in Google Cloud

Add this redirect URI for local development:

- `http://localhost:8787/api/google/auth/callback`

If you deploy, add your production callback URI too:

- `https://<your-domain>/api/google/auth/callback`

### 3) Set environment variables

Set these before running the API server:

```bash
export GOOGLE_CLIENT_ID="<your-client-id>"
export GOOGLE_CLIENT_SECRET="<your-client-secret>"
export GOOGLE_REDIRECT_URI="http://localhost:8787/api/google/auth/callback"
export APP_BASE_URL="http://localhost:5173"
```

Optional:

```bash
export PORT="8787"
export CALENDAR_AGENT_SNAPSHOT="/Users/nrav/.openclaw/workspace/recent-calendar.md"
export CALENDAR_AGENT_DAYS="14"
```

- `CALENDAR_AGENT_SNAPSHOT`: where CLI writes the rolling markdown snapshot after each calendar mutation.
- `CALENDAR_AGENT_DAYS`: how many past days to include in snapshot "Recent" (default `14`).

### 4) Run and connect in UI

1. Open the app.
2. Click **Sign in with Google**.
3. Select a calendar via the calendar buttons.
4. Click **Sync Now** for two-way merge.

## UI Notes

- The old UI Add Event form/button is removed.
- Add events via CLI only.
- Drag/drop, resizing, and check-off are still enabled.

## Markdown + Sync Model

Each event record includes:

- `id`: local event id
- `externalId`: stable cross-system id for dedupe
- `updatedAt`: per-event timestamp for conflict resolution
- `googleEventIds`: map of `{ [calendarId]: googleEventId }`

Sync state is also tracked in:

- `.calendar-google-sync-state.json`

This file helps map deletions and avoids duplicate event creation during repeated syncs.

## CLI Usage

Run all commands as:

```bash
npm run cli -- <command> [options]
```

Examples:

```bash
npm run cli -- summary
npm run cli -- add --title "Physics lab" --start "2026-02-26T14:00:00.000Z" --end "2026-02-26T15:30:00.000Z" --category school
npm run cli -- update --id evt_abc12345 --notes "Bring workbook" --done
npm run cli -- add --title "Standup" --start "2026-02-26T09:00:00.000Z" --end "2026-02-26T09:30:00.000Z" --shift-to-next
npm run cli -- update --id evt_abc12345 --start "2026-02-26T14:00:00.000Z" --end "2026-02-26T15:00:00.000Z" --allow-overlap
npm run cli -- check --id evt_abc12345 --undone
npm run cli -- export --out backup-calendar.md
npm run cli -- import --in backup-calendar.md
npm run cli -- delete --id evt_abc12345
```

Conflict behavior for `add` and time-changing `update`:

- CLI detects overlapping events.
- Interactive mode prompts: accept overlap, shift to next open slot, or enter a custom time.
- Non-interactive/agent mode:
- `--allow-overlap` to keep requested time even with conflicts.
- `--shift-to-next` to auto-move to the next non-overlapping window.

Snapshot behavior:

- Every mutating CLI command (`import`, `add`, `update`, `check`, `delete`) writes a rolling markdown snapshot.
- Default snapshot path: `/Users/nrav/.openclaw/workspace/recent-calendar.md`
- Snapshot contains:
- Recent window: last `CALENDAR_AGENT_DAYS` days (default `14`)
- Upcoming window: next `7` days (when events are present)
- Compact markdown tables for agent-friendly scanning.

## Key Files

- `calendar.md`: source-of-truth event data
- `server/index.ts`: API, OAuth, Google sync, markdown persistence
- `shared/calendarMarkdown.ts`: parser/writer + event normalization
- `scripts/calendar-cli.ts`: agent-friendly CLI
- `SKILL.md`: operational instructions for agents
