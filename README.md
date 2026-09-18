# Dayweave

Dayweave is a calm daily planning workspace for turning scattered thoughts into a realistic plan and focused action.

## Live demo

[dayweave-app.vercel.app](https://dayweave-app.vercel.app)

## Repository

[github.com/Athul129/Dayweave](https://github.com/Athul129/Dayweave)

## Features

- Supabase email/password authentication
- Today task planning with time, duration, energy, and sections
- This Week planning from Monday through Sunday
- Loose Notes for capturing and searching thoughts
- Daily Intention for each user and calendar date
- Focus Mode for working on one task at a time
- Responsive desktop, tablet, and mobile layouts

## Tech stack

- React 19 and TypeScript 5.6
- Vite 7 and Wouter
- Tailwind CSS 4 and project CSS
- Supabase Auth and PostgreSQL
- Express 4 and esbuild for the production server
- Playwright and axe-core for browser and accessibility testing

## Supabase and security

Supabase provides authentication and PostgreSQL persistence. Tasks, Notes, and Daily Intentions are user-scoped, with Row Level Security protecting access to each user’s data. Focus Session state currently uses browser `localStorage`.

## Project structure

```text
dayweave/
├── client/src/     # React application, pages, components, contexts, and data modules
├── server/         # Express production server
├── shared/         # Shared constants
├── tests/e2e/      # Playwright end-to-end and accessibility tests
├── package.json
├── vite.config.ts
├── playwright.config.ts
└── tsconfig.json
```

## Environment variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Do not commit `.env.local` or private keys.

## Local development

```bash
git clone https://github.com/Athul129/Dayweave.git
cd Dayweave
pnpm install
```

Add `.env.local`, then run the development server:

```bash
pnpm run dev
```

Validate the project with:

```bash
pnpm run check
pnpm run build
```

## Testing

The project includes Playwright end-to-end tests and an axe-core accessibility suite.

```bash
pnpm run test:e2e
pnpm run test:a11y
```

## Author

**Athul KP**

## License

MIT, as declared in `package.json`.
