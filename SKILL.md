# Calendar Markdown + Google Sync Skill

Use this skill to query/update the local markdown-backed calendar safely and sync it with Google Calendar.

## Source of Truth

- File: `calendar.md`
- Authoritative section: `## Event Records` (fenced `event` YAML blocks)
- Human summary section: `## Event Checklist`

## Event Identity Rules

- `id`: local identifier
- `externalId`: stable cross-system identifier used for dedupe
- `googleEventIds`: per-calendar Google event mapping
- `updatedAt`: event-level timestamp for conflict resolution

Do not remove `externalId` from existing records.

## Preferred Interface

Use CLI from repo root:

```bash
npm run cli -- <command>
```

## Safe Query Flow

1. Run `npm run cli -- summary`.
2. If raw markdown is needed, run `npm run cli -- export`.

## Safe Update Flow

1. Add (preferred for new events):
   `npm run cli -- add --title "..." --start "<ISO>" --end "<ISO>" --category <id>`
2. Update:
   `npm run cli -- update --id <event_id> [fields...]`
3. Check/uncheck:
   `npm run cli -- check --id <event_id>` or `--undone`
4. Delete:
   `npm run cli -- delete --id <event_id>`

## UI Constraints

- UI does not provide add-event form/button.
- Events are created via CLI agents only.
- UI still supports drag/drop, resize, and check-off.

## Google Sync Flow

1. In UI, sign in with Google.
2. Select target calendar via calendar selector controls.
3. Click **Sync Now** for two-way merge.

Sync state file:

- `.calendar-google-sync-state.json`

## Import/Export

- Export: `npm run cli -- export --out backup-calendar.md`
- Import: `npm run cli -- import --in backup-calendar.md`

## Notes for Agents

- Keep datetimes in ISO format.
- Prefer CLI operations over manual markdown edits.
- If categories are changed manually in frontmatter, keep `id`, `label`, and `color` fields valid.
