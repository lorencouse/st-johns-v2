# st-johns-v2

Turns a YouTube video library into blog-ready posts. Videos are synced from a
channel, transcribed, cleaned up and structured by OpenAI, edited and reviewed
in a Tiptap studio, then exported as HTML or Markdown.

Built with Next.js 16, Drizzle ORM on PostgreSQL, BullMQ on Redis, Auth.js v5
(Google OAuth) and OpenAI.

## Getting started

```bash
bun install
cp .env.example .env   # then fill in the values
bun dev                # opens the SSH tunnel, then serves http://localhost:3000
```

Use `bun`, not npm or pnpm.

**There is one database, and it is production.** `bun dev` runs
`scripts/tunnel.sh`, which tunnels the Coolify-hosted Postgres and Redis to
`localhost:15432` and `localhost:16379`. There is no local copy, so:

- Change the schema with `bun run db:generate` then `bun run db:migrate`.
  Never use `drizzle-kit push`: it drops columns that have no migration file.
- Scripts in `scripts/` that take `--apply` write live data. Run them without
  it first to see a dry run.
- Run `./scripts/tunnel.sh` by hand before running a script when the dev
  server is not up.

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
