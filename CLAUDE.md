# CLAUDE.md

## What This Is

A Next.js web app that converts YouTube video libraries into blog-ready content for any CMS. Workspace-based multi-tenant architecture with role-based access, review workflows, and versioned content.

## Running the App

```bash
bun install
bun run db:generate   # Generate Drizzle migrations
bun run db:migrate    # Run migrations — against PRODUCTION, see below
bun dev               # Opens the SSH tunnel, then serves localhost:3000
```

Requires: Redis, Google OAuth credentials, OpenAI API key.

**There is one database, and it is production.** `DATABASE_URL` points at the
Coolify Postgres through the SSH tunnel `scripts/tunnel.sh` opens on
`localhost:15432`; `bun dev` opens it first. There is no local copy to fall
back on, so:

- The `db:push` script has been removed from `package.json`, and must not be
  added back: drizzle-kit push diffs the schema against the live database and
  drops columns with no migration file. Use `db:generate` then `db:migrate`.
- A script's `--apply` flag writes live data. Dry-run first; they all support it.
- Run `./scripts/tunnel.sh` by hand before scripts, when the dev server is not up.

## Architecture

**Tech Stack:** Next.js 16 (App Router) + Tailwind CSS 4 + Drizzle ORM + PostgreSQL + BullMQ + Auth.js v5 + Tiptap + OpenAI

**Key directories:**

- `src/app/` — Next.js App Router pages and API routes
- `src/server/db/` — Drizzle schema and database client
- `src/server/auth/` — Auth.js configuration
- `src/server/jobs/` — BullMQ job queue and workers
- `src/server/youtube/` — YouTube API integration
- `src/server/ai/` — OpenAI prompts and processing
- `src/server/export/` — HTML/Markdown rendering
- `src/components/` — React components organized by domain
- `src/lib/` — Shared utilities
- `drizzle/` — SQL migration files

**Data model:** Workspace -> Channel -> Video -> Transcript Revision -> Content Project -> Draft Version -> Export Artifact

**Processing:** BullMQ workers started via `instrumentation.ts`. Queues: channel-sync, video-ingest, transcript-process, draft-generate, export-render.

**Auth:** Google OAuth with YouTube scopes via Auth.js v5. Workspace membership with roles: owner, admin, editor, reviewer, viewer.

**Routing:** Workspace-scoped: `/w/:workspaceSlug/library|projects|review|settings`

## Package Manager

Use `bun`, not npm or pnpm.

## Environment Variables

```
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
