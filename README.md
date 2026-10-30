# st-johns-v2

Turns a YouTube video library into blog-ready posts. Videos are synced from a
channel, transcribed, cleaned up and structured by OpenAI, edited and reviewed
in a Tiptap studio, then exported as HTML or Markdown.

Built with Next.js 16, Drizzle ORM on PostgreSQL, BullMQ on Redis, Auth.js v5
(Google OAuth) and OpenAI.

## Getting started

```bash
bun install
ops/env pull           # decrypts .env.sops into .env (needs sops and the age key)
bun dev                # opens the SSH tunnel, then serves http://localhost:3000
```

Use `bun`, not npm or pnpm.

**There is one database, and it is production.** `bun dev` runs
`scripts/tunnel.sh`, which tunnels the Coolify-hosted Postgres and Redis to
`localhost:15432` and `localhost:16379`. There is no local copy, so:

- Change the schema with `bun run db:generate` then `bun run db:migrate`.
  Never use `drizzle-kit push`: it drops columns that have no migration file.
- `backfill-live-status`, `ingest-missing`, `repair-ingest-status` and
  `prune-empty-transcripts` write live data only with `--apply`; run them
  without it first to see a dry run.
- `ingest-channel.ts`, `generate-drafts.ts` (which also spends OpenAI money)
  and `grant-access.ts` have no dry run and write to production as soon as
  they run. Never run them without the captain's say-so.
- Run `./scripts/tunnel.sh` by hand before running a script when the dev
  server is not up.

## Secrets

`.env` is gitignored and is what the app reads. `.env.sops` is the committed
copy, encrypted with SOPS and age: values are encrypted, key names stay
readable. The age key is the same one Kouzr uses, kept in Apple Passwords
under "Kouzr repo secrets (age)", never in git; `ops/env` prints how to
restore it when it is missing. Install the tool with `brew install sops`.

    ops/env pull     .env.sops -> .env      (after a clone)
    ops/env push     .env -> .env.sops      (after adding or rotating a value)
    ops/env diff     what push would change, keys only, never values
    ops/env edit     edit .env.sops decrypted in $EDITOR
    ops/env rekey    re-encrypt after adding a recipient to .sops.yaml

`ops/env pull` points `core.hooksPath` at `ops/hooks`, whose pre-commit hook
re-encrypts a changed `.env` into `.env.sops` in the same commit. Other env
files (`.env.local`, `.env.production`) work the same way once encrypted with
`ops/env push .env.local`. Do not hand-edit a `.sops` file.

## Checks

```bash
bunx tsc --noEmit
bun run lint
bun test
```

CI (`.github/workflows/ci.yml`) runs these, plus
`bun audit --audit-level=critical`, on pull requests and pushes to `main`.

## Deployment

The `Dockerfile` builds a standalone image (the build runs under Node, because
Bun crashes on `next build` for Next 16.3) and is deployed through Coolify.

See `AGENTS.md` for the architecture, data model and environment variables.
