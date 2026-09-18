# Dayweave

Dayweave is a calm daily planning workspace for turning scattered thoughts into a realistic plan, then giving one task focused attention.

## Live demo

- **Production:** [dayweave-app.vercel.app](https://dayweave-app.vercel.app)
- **Repository:** [github.com/Athul129/Dayweave](https://github.com/Athul129/Dayweave)

## Features

- **Supabase authentication:** Email/password sign-up, email confirmation handling, session restoration, and sign-out.
- **Today:** Create, edit, complete, defer, and delete tasks organized by Morning, Midday, and Afternoon.
- **This week:** Review Monday–Sunday planning, progress, task counts, and tasks across calendar dates.
- **Loose Notes:** Create, edit, search, and delete notes by title or body.
- **Daily Intention:** Store one intention per authenticated user and local calendar date.
- **Focus Mode:** Work on one task in a focused full-screen view with pause, resume, completion, and five-minute continuation.
- **Responsive UI:** Desktop sidebar navigation, mobile navigation, responsive weekly surfaces, and compact mobile account controls.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript 5.6, Vite 7, Wouter |
| Styling | Tailwind CSS 4, project CSS, `tw-animate-css` |
| UI | Lucide React, Radix UI primitives, Sonner |
| Backend/runtime | Express 4 production static server, esbuild |
| Data and auth | Supabase JS 2.116, Supabase Auth, PostgreSQL |
| Testing | Playwright 1.62, `@axe-core/playwright` 4.13, Vitest 2.1 (installed) |
| Tooling | pnpm, TypeScript, Prettier |

## Supabase architecture and persistence

The browser uses the configured Supabase client in `client/src/lib/supabase.ts`. `AuthContext` restores the Supabase session and exposes `user`, `userId`, sign-in, sign-up, and sign-out operations.

Authenticated application data is persisted directly from the client through repository modules:

| Area | Table | Scope |
| --- | --- | --- |
| Tasks | `public.tasks` | Rows are owned by `user_id`; task UUIDs come from PostgreSQL. |
| Notes | `public.notes` | Rows are owned by `user_id`; note UUIDs come from PostgreSQL. |
| Daily intentions | `public.daily_intentions` | One row per `user_id` and local calendar `date`. |

Reads and writes pass the authenticated user ID, while PostgreSQL Row Level Security remains the data-access boundary. The application does not use a service-role key or a separate application API for these operations.

Focus Session state is separate from Supabase. The current session is persisted in browser `localStorage` under `dayweave-focus-session`.

## Security

Supabase Auth identifies the current user. RLS policies on the application tables restrict access to rows whose `user_id` matches `auth.uid()`. The client only uses the browser-safe publishable key; no secret or service-role key belongs in frontend environment variables.

## Focus Mode timing

The countdown is timestamp-based. A session stores `startAt` and `endAt`; active remaining time is derived from `endAt - Date.now()`. A one-second interval only refreshes the display. Pausing stores the current remaining duration, and resuming reconstructs a new `startAt`/`endAt` pair. Because elapsed time comes from the wall clock, background-tab throttling does not act as an implicit pause.

## Project structure

```text
dayweave/
├── client/
│   ├── index.html
│   └── src/
│       ├── components/       # Auth screen, account control, shared UI
│       ├── contexts/         # Auth and theme context
│       ├── hooks/            # Small reusable hooks
│       ├── lib/              # Supabase client and task/note/intention repositories
│       ├── pages/            # Home and not-found pages
│       ├── App.tsx
│       ├── index.css
│       └── main.tsx
├── server/                  # Express server for the production static bundle
├── shared/                  # Shared constants
├── tests/e2e/               # Playwright browser journeys and accessibility tests
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Environment variables

Create a local `.env.local` file with the public frontend Supabase values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Do not commit `.env.local`, credentials, or a Supabase service-role key. The source also contains optional Vite integrations for analytics, OAuth/hosted services, and map features; configure those only when using the corresponding integrations.

## Local development

```bash
git clone https://github.com/Athul129/Dayweave.git
cd Dayweave
pnpm install
```

Add `.env.local`, then start the Vite development server:

```bash
pnpm run dev
```

For a production build and local production server:

```bash
pnpm run build
pnpm run start
```

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Start Vite in development mode. |
| `pnpm run build` | Build the frontend and bundle `server/index.ts` into `dist`. |
| `pnpm run start` | Start the bundled Express production server. |
| `pnpm run preview` | Preview the Vite production frontend. |
| `pnpm run check` | Run `tsc --noEmit`. |
| `pnpm run test:e2e` | Run the Playwright suite from `tests/e2e`. |
| `pnpm run test:a11y` | Run the configured accessibility Playwright command. |
| `pnpm run format` | Format project files with Prettier. |

## Testing and validation

Playwright configuration uses Chromium at `/usr/bin/chromium`, a Vite web server on port 4173, and tests under `tests/e2e`. The repository includes journeys for authentication, task workflows, notes, persistence, Focus Mode, responsive behavior, and accessibility. Browser execution depends on the configured Chromium executable and the required environment/session setup.

TypeScript validation and the production build can be run independently with `pnpm run check` and `pnpm run build`.

## Deployment

The published deployment is available at [dayweave-app.vercel.app](https://dayweave-app.vercel.app). The repository contains Vite and Express build configuration; no Vercel-specific configuration file is present in the project, so deployment environment variables and build settings must be supplied by the hosting project.

## Current capabilities

Dayweave currently provides authenticated, user-scoped task, note, and daily-intention persistence through Supabase; responsive planning views; and a local, timestamp-based Focus Session. Tasks, notes, and intentions are not maintained as competing localStorage sources.

## Future improvements

Potential follow-up work includes Focus Session history, recurring tasks, reminders, weekly productivity insights, and richer task search/filtering. These are not currently implemented features.

## Author

**Athul KP**

