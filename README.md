# Dayweave

> **DAYWEAVE — A calm workspace for turning scattered thoughts into a realistic plan for the day.**

[![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/) [![Playwright](https://img.shields.io/badge/Playwright-1.62-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/) [![axe--core](https://img.shields.io/badge/axe--core-4.13-6B4FBB)](https://github.com/dequelabs/axe-core) [![License: MIT](https://img.shields.io/badge/License-MIT-F4B942.svg)](#license)

|               |                                 |
| ------------- | ------------------------------- |
| **Live Demo** | Not specified in the repository |
| **GitHub**    | `YOUR_REPOSITORY_URL`           |

## Overview

Dayweave is a calm daily planning workspace for turning a full mind into a day with shape. It starts with a daily intention, gives loose thoughts somewhere to land, and helps users turn those thoughts into tasks with a realistic time and energy profile.

It is deliberately more than a conventional to-do list. Dayweave combines daily planning, Monday–Sunday weekly planning, a quiet notebook for non-task thoughts, and a focused execution surface. Its **Quiet Cartography** identity treats the day as a route: editorial wayfinding, paper-like surfaces, route cues, and measured spacing help users decide what belongs now.

## The Problem

Traditional task lists can become overwhelming because they show everything without helping users decide what realistically belongs in the current day. Dayweave reduces that pressure by connecting intention, time, energy, and attention in one small planning loop.

## The Idea

```text
Scattered thoughts → realistic tasks → structured day → focused execution
```

## Core Features

### Today

Today is the daily planning surface. Users can set a daily intention, capture a brain dump, and shape tasks into **Morning**, **Midday**, or **Afternoon** sections. Each task can carry a time, estimated duration, and energy level: **Deep**, **Light**, or **Social**.

Tasks support editing, deletion with confirmation, completion and uncompletion, **Move Later**, **Up Next**, Focus Mode entry, progress tracking, and local browser persistence.

### This Week

The weekly view presents the current week from Monday through Sunday. It highlights the current day and shows task counts, completed counts, planned duration, and weekly progress. Tasks can be created, edited, deleted, completed, and moved between real calendar dates while remaining synchronized with Today.

### Loose Notes

Loose Notes is a quiet shelf for thoughts that are not tasks yet. Users can create, read, edit, delete, and search notes by title or body. The workspace includes intentional empty and no-results states, with notes persisted locally in the browser.

### Focus Mode

Focus Mode provides an immersive full-viewport execution space for one task. It includes task context, a duration-based countdown, pause/resume, task completion, a five-minute continuation option, exit confirmation, persisted session state, keyboard controls, focus trapping, and accessible timer/status feedback.

## Design

Dayweave uses **Quiet Cartography** rather than a generic productivity-dashboard aesthetic. Editorial wayfinding, warm paper-like surfaces, a marigold accent, route-line cues, calm typography, deliberate spacing, and tactile composition give the interface the feeling of a field guide arranged on a desk.

The layout adapts across desktop, tablet, and mobile without losing the route metaphor or the hierarchy of the current day.

## Technical Highlights

- React and TypeScript component architecture with reusable task, note, weekly, and Focus Mode surfaces.
- Vite-powered frontend development and production builds.
- LocalStorage-backed, local-first persistence for tasks, notes, and active Focus Mode sessions.
- Shared task state across Today and This week rather than disconnected copies.
- Date-only task representation using `YYYY-MM-DD` and dynamic Monday–Sunday week calculation.
- Safe migration of legacy demonstration dates and existing tasks without silently deleting user data.
- Persisted Focus Mode session state with elapsed-time restoration.
- Responsive mobile, tablet, and desktop behavior.
- Accessible dialogs, live status feedback, keyboard interactions, and focus management.
- An error boundary and structured UI components for resilient rendering.

## Tech Stack

| Area               | Technologies                                                                    |
| ------------------ | ------------------------------------------------------------------------------- |
| **Frontend**       | React 19, TypeScript, Tailwind CSS 4, Vite, Lucide React, Framer Motion, Wouter |
| **UI / Utilities** | Radix UI primitives, React Hook Form, Zod, Sonner                               |
| **Testing**        | Playwright 1.62.0, axe-core 4.13.0, `@axe-core/playwright`                      |
| **Tooling**        | pnpm, TypeScript, Prettier, esbuild                                             |

## Accessibility

The project includes an axe-core accessibility audit and keyboard-accessible interaction coverage. The verified audit covers Today, This week, Loose Notes, task dialogs, note dialogs, Focus Mode, Focus Mode exit confirmation, empty task and notes states, and key mobile states.

- 8 accessibility audits passed.
- 6 existing Playwright journeys passed.
- 14 combined Playwright tests passed.
- TypeScript check passed.
- Production build passed.
- No application runtime console errors were detected.
- No axe-core violations were intentionally left unresolved.

These results describe the project’s current automated checks; they are not a claim of WCAG certification.

## Testing

The automated suite covers Today task CRUD and progress, This Week planning and persistence, Loose Notes CRUD and search, Focus Mode timer controls and completion, browser persistence, validation, empty states, no-results states, and the no-task Focus Mode experience.

```bash
pnpm run check
pnpm run build
pnpm run test:e2e
pnpm run test:a11y
```

## Responsive Design

Dayweave supports desktop, tablet, and mobile layouts. The weekly view reflows into readable day surfaces on smaller screens, while mobile navigation keeps Today, This week, and Loose notes reachable when the desktop rail is hidden.

## Project Structure

```text
dayweave/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── pages/
│   ├── index.html
│   └── ...
├── server/
├── shared/
├── tests/
│   └── e2e/
├── package.json
├── playwright.config.ts
├── vite.config.ts
└── tsconfig.json
```

## Getting Started

```bash
git clone YOUR_REPOSITORY_URL
cd dayweave
pnpm install
pnpm run dev
```

For a production build:

```bash
pnpm run build
pnpm start
```

## Available Scripts

| Command              | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `pnpm run dev`       | Start the Vite development server.                    |
| `pnpm run build`     | Build the frontend and bundle the server entry point. |
| `pnpm run start`     | Start the production build.                           |
| `pnpm run preview`   | Preview the built frontend.                           |
| `pnpm run check`     | Run the TypeScript compiler without emitting files.   |
| `pnpm run test:e2e`  | Run the Playwright end-to-end suite.                  |
| `pnpm run test:a11y` | Run the axe-core accessibility suite.                 |
| `pnpm run format`    | Format project files with Prettier.                   |

## Future Direction

Possible future ideas include account-based synchronization, cross-device persistence, smarter planning assistance, previous/next week navigation, and optional cloud sync. These are not implemented features in the current project.

## Portfolio Note

Dayweave demonstrates product thinking through a focused planning model, UX-oriented frontend development, shared state management, local persistence, responsive composition, accessibility work, automated browser testing, and attention to small interaction details.

## License

MIT

## Author

**Athul KP**  
Python Full Stack Developer

## References

[1]: https://react.dev/ "React documentation"
[2]: https://www.typescriptlang.org/ "TypeScript documentation"
[3]: https://vite.dev/ "Vite documentation"
[4]: https://playwright.dev/ "Playwright documentation"
[5]: https://github.com/dequelabs/axe-core "axe-core repository"
