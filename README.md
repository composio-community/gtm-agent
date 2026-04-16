# GTM Agent

An AI agent that does your go-to-market work. Drop a task on the board, it runs in the background, and you can come back when it's done.

## What It Does

You write a task and the agent picks it up and does it, calling whatever Composio tools you've connected to send emails, search reddit, pull github issues, post to slack, or anything else that's wired up. It runs in the background and pings you when it's done.

some things people use it for:

- research leads: "find 10 series A fintech startups in NYC and draft cold emails to each founder"
- monitor brands: "scan reddit for posts mentioning Composio this week and summarize sentiment"
- cross-tool stuff: "pull open github issues labeled 'bug' and post a summary to slack"
- recurring work: "every day at 9am, check producthunt for new dev tool launches"

the agent calls Composio tools to do the actual work, so whatever integrations you connect on the Composio side, the agent can use immediately without any extra wiring.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Next.js 16 (App Router)                            │
│                                                     │
│  /kanban ─── task board, add tasks, click to chat   │
│  /kanban/[id] ─── per-task chat, live via Realtime  │
│  /inbox ─── notifications when tasks complete       │
│  /settings ─── connect Composio via OAuth           │
│  /login ─── email + password (Supabase Auth)        │
│                                                     │
│  API Routes                                         │
│  ├── POST /api/tasks ─── create + auto-run          │
│  ├── POST /api/tasks/[id]/chat ─── follow-up msg    │
│  ├── GET  /api/cron/dispatch ─── fire scheduled     │
│  └── GET  /api/oauth/composio/* ─── MCP OAuth       │
├─────────────────────────────────────────────────────┤
│  Agent (lib/agent/)                                 │
│  ├── harness.ts ─── streamText loop, mark_done tool │
│  └── tools.ts ─── MCP client or Composio SDK        │
├─────────────────────────────────────────────────────┤
│  Supabase                                           │
│  ├── Auth (email/password, session cookies)         │
│  ├── Postgres (tasks, notifications, integrations)  │
│  ├── RLS (each user sees only their own data)       │
│  └── Realtime (live chat updates via WebSocket)     │
├─────────────────────────────────────────────────────┤
│  Composio                                           │
│  ├── MCP (connect.composio.dev/mcp, per-user OAuth) │
│  └── Platform SDK (shared API key fallback)         │
└─────────────────────────────────────────────────────┘
```

## Quick Start

You'll need Node.js 20+, a Supabase project, and a Composio account before you start.

**1. clone and install**

```
git clone https://github.com/composio-community/gtm-agent.git
cd gtm-agent
npm install
```

**2. set up Supabase**

run the schema in your Supabase SQL editor.

<details>
<summary>full schema</summary>
</details>

**3. configure env**

create `.env` in the project root:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
OPENAI_API_KEY=sk-...
COMPOSIO_API_KEY=...           # optional if using MCP OAuth
CRON_SECRET=any-random-string  # for the scheduled task dispatcher
```

**4. run**

```
npm run dev
```

sign up at http://localhost:3000/login, add a task, and watch it work.

## How It Works

You create a task on the board with a title and optional description, and the server seeds the task's chat thread with your input and fires the agent in the background using `after()`.

the agent then calls Composio tools (search, email, github, slack, whatever's connected) and writes progress to the DB after each step, while Supabase Realtime pushes updates to the browser so you see messages appear as the agent works.

when the agent is done it calls `mark_done`, which flips the task to Done and drops a notification in your inbox, and you can reply in the chat at any point to have the agent pick up and continue from where it left off.

tasks run async, so you can close the tab and they keep going in the background, and when you come back later the chat history is still there waiting for you.

## Scheduling

The task form has a schedule picker that lets you control when the agent runs:

| mode | what happens |
|------|-------------|
| run now | agent starts immediately |
| once at [datetime] | sits in Todo until the time, then fires |
| every day at [time] | template stays in Todo forever. each day it clones a child task and runs it |
| every week on [day] | same, weekly |
| every hour at [:mm] | same, hourly |

recurring tasks show a purple chip on the board, and child tasks spawned from recurring templates show a grey "from recurring" chip so you can tell them apart at a glance.

**dispatcher:** `GET /api/cron/dispatch` checks for due tasks and fires them, and in production you'll want to wire this to Supabase pg_cron + pg_net running every minute. Locally you can just hit the endpoint manually or add inline dispatch.

## Composio Integration

Two paths, same tools:

**MCP (per-user OAuth)** — each user clicks "connect Composio" in settings, and the app auto-discovers OAuth endpoints from connect.composio.dev, does dynamic client registration + PKCE, and stores the token. The agent then connects to Composio's MCP server with the user's Bearer token, so there's no manual client ID or secret config to deal with.

**Platform SDK (shared key)** — set `COMPOSIO_API_KEY` in env, and the agent creates a Composio session keyed by the user's email. Simpler setup, shared rate limits.

MCP takes priority when both exist.

## Using It For Yourself vs. Your Users

**for yourself (MCP):** head to Settings and click "Connect Composio" to authenticate with your own Composio account and pull in your own tool connections. Your Gmail, your Slack, your GitHub — the agent acts as you, which is good for solo use, internal ops, or testing.

**for your users (Platform SDK):** set `COMPOSIO_API_KEY` in env, and each user that signs up gets a Composio session keyed to their email via `composio.create(userEmail)`. You control which tools are available, users authenticate their own app connections through Composio's flows, and rate limits are managed under your API key, which is the path you want if you're shipping this as a product where you own the Composio account and your users just use the tools you've enabled.

you can run both at the same time too, and if a user has connected via MCP OAuth the agent uses their token, otherwise it falls back to the shared platform key.

## Stack

| layer | tech |
|-------|------|
| framework | Next.js 16, App Router, React 19 |
| styling | Tailwind v4, custom CSS |
| auth | Supabase Auth (email/password, cookie sessions) |
| database | Supabase Postgres, RLS, Realtime |
| AI | Vercel AI SDK v6 (streamText, generateText) |
| model | configurable in `lib/agent/harness.ts` |
| tools | Composio MCP (`@ai-sdk/mcp`) or Platform SDK (`@composio/core`) |
| deploy | Vercel (serverless, `after()` for background work) |

## Deploying To Vercel

```
npm run build   # verify it builds
vercel deploy   # or push to GitHub and connect to Vercel
```

set the same env vars from `.env` in your Vercel project settings and add `CRON_SECRET`.

for scheduled tasks, set up pg_cron in Supabase to call your dispatch endpoint every minute:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'gtm-dispatch',
  '* * * * *',
  $$ select net.http_post(
    url := 'https://your-app.vercel.app/api/cron/dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  ); $$
);
```

**timeout note:** Vercel Hobby functions cap at 60s and Pro goes to 300s, so long agent runs with many tool calls can exceed this. If that's a problem, move agent execution to Trigger.dev for dedicated compute with no timeout.

## Project Structure

```
app/
  (app)/                   # auth-guarded routes
    kanban/                # task board
      [id]/                # per-task chat view
    inbox/                 # notifications
    settings/              # Composio OAuth connection
  api/
    tasks/                 # CRUD + auto-run on create
    cron/dispatch/         # scheduled task dispatcher
    oauth/composio/        # MCP OAuth start + callback
  login/                   # sign in / sign up
lib/
  agent/
    harness.ts             # agent loop, mark_done tool
    tools.ts               # MCP or platform SDK
  supabase/
    server.ts              # SSR client (cookies, RLS)
    admin.ts               # secret key client (background jobs)
  tasks.ts                 # task CRUD
  notifications.ts         # inbox CRUD
  oauth.ts                 # OAuth discovery, PKCE, token exchange
  schedule.ts              # recurrence helpers
components/ui/             # shadcn structure
proxy.ts                   # session refresh, auth redirects
```

## License

MIT