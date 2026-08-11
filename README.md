# Quiz0r

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![Node](https://img.shields.io/badge/Node-%E2%89%A518.17-339933?logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-010101?logo=socketdotio&logoColor=white)
![Prisma](https://img.shields.io/badge/DB-Prisma%20%2B%20SQLite-2D3748?logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Ready-Docker-2496ED?logo=docker&logoColor=white)
[![License](https://img.shields.io/badge/License-Custom-orange?logo=open-source-initiative&logoColor=white)](https://github.com/err0r-dev/.github/blob/main/profile/license.md)

A modern, self-hosted real-time quiz platform for teaching, training, presentations, and interactive knowledge assessment.

If you want a beginner-friendly walkthrough, start with [Non Techie Readme.md](/Non%20Techie%20Readme.md). This README is for developers and technical users who want details on how the app works.

## About

Quiz0r is a real-time multiplayer quiz application that enables hosts to create, manage, and run interactive quiz sessions. Players join via a game code or QR link and compete in real-time on their devices.

**Key capabilities:**
- Quiz management: create, edit, import/export quizzes with media support
- Live gameplay: real-time multiplayer with Socket.io
- Host controls: display view, player monitor, admission controls
- AI assistance: AI-powered quiz and theme generation
- Multilingual: application available in English, German, and Serbian
- Self-hosting: Docker deployment with persistent SQLite database

## Current Features

### Multilingual Application

The application interface is available in multiple languages:
- 🇬🇧 English — default/master language
- 🇩🇪 Deutsch (German)
- 🇷🇸 Srpski (Serbian)

Application language and quiz-content language are separate systems. The player interface supports application language selection, while quiz content can be generated or translated into different languages.

### Question Types

Current implemented question types:
- **Single Choice** — one correct answer
- **Multiple Choice** — multiple correct answers with partial credit scoring

### Scoring System

The scoring system is designed for learning and training quizzes and uses a partial-credit concept for Multiple Choice questions:
- **Single Choice**: Base points with speed bonus (up to 50% for fastest answers)
- **Multiple Choice**: Partial credit based on correct/incorrect selections, with penalties for wrong additional selections and speed bonus

The design incorporates concepts inspired by partial-credit scoring systems used in examination contexts.

### AI Question Generation

Quiz0r uses an extensible AI provider abstraction (`AIProvider` interface) that supports multiple AI backends through a single unified `OpenAICompatibleProvider` implementation.

**Architecture:**
```
Quiz0r → AIProvider interface → OpenAICompatibleProvider → configured AI endpoint
```

**Current preset configurations:**
- OpenAI (GPT-4o)
- FreeLLMAPI (local proxy with multiple free-tier providers)
- OpenRouter (aggregated API access)
- Ollama (local LLM server)
- LM Studio (local LLM server)
- Custom OpenAI-compatible endpoint (user-configurable)

API credentials are stored server-side in the database and are never exposed to the client.

> **Note:** The AI provider architecture is implemented. End-to-end testing against local FreeLLMAPI instances is still pending.

### Stability and Improvements

Recent technical improvements include:
- Dialog animation fixes and html2canvas color handling
- Tailwind CSS 4 lab()/oklab() compatibility for image generation
- Docker build/runtime fixes for Prisma 7, Tailwind 4, and Next.js 16
- AI provider abstraction refactor for extensibility
- Multilingual application language support

## Planned

Future enhancements under consideration:
- Additional question types (True/False, Categorise, Matching)
- Provider/model selection UI
- Improved AI provider configuration interface
- Extended language support

## Technology

- **Framework**: Next.js 14 (App Router), React 18, TypeScript
- **Realtime**: Socket.io for live gameplay
- **Database**: Prisma ORM with SQLite (local file)
- **Styling**: Tailwind CSS with shadcn/ui components
- **AI**: OpenAI SDK (provider-agnostic via abstraction)
- **Deployment**: Docker with docker-compose
- **Tunneling**: ngrok for public player access

## Prerequisites

- Node.js 18.17+ and npm
- SQLite (bundled via Prisma; no external database needed)
- Docker (optional) for containerized deployment

## Stack
- Next.js 14, React 18, TypeScript
- Socket.io for realtime play
- Prisma + SQLite (local file database)
- Tailwind + shadcn/ui for UI
- ngrok for tunneling

## Prerequisites
- Node.js 18.17+ and npm
- SQLite (bundled via Prisma; no external DB needed)
- Docker (optional) for containerized runs

## Quick Start
```bash
npm run setup   # installs deps, creates .env, sets up database
npm run dev     # starts the app at http://localhost:3000
```

<details>
<summary>Manual setup steps (if you prefer)</summary>

```bash
# 1) Install dependencies
npm install

# 2) Create .env with the SQLite URL if it does not exist
echo 'DATABASE_URL="file:./data/quiz.db"' > .env   # only if .env is missing

# 3) Apply schema (repo ships without migrations)
npx prisma db push

# 4) Start the dev server
npm run dev
# App: http://localhost:3000
```
</details>

## Running with Docker
```bash
docker compose up -d --build
docker compose logs -f   # wait for "Ready on http://localhost:3000"
```
- The image entrypoint runs `npx prisma migrate deploy`; if you see migration errors, replace that with `npx prisma db push` for a migration-less setup.
- For persistent data, align the DB path with the mounted volume. Easiest: set `DATABASE_URL=file:./prisma/data/quiz.db` in `docker-compose.yml` to match the `/app/prisma/data` volume.
- App URL: http://localhost:3000

## Environment variables
- `DATABASE_URL` (required): e.g., `file:./data/quiz.db` or `file:./prisma/data/quiz.db` when matching the Docker volume.
- Optional (used in admin/settings):
  - `OPENAI_API_KEY` (AI quiz generator)
  - `UNSPLASH_API_KEY` (image sourcing)
  - `NGROK_AUTHTOKEN` can also be saved via the UI.

## ngrok (external access)
- Add your authtoken in the admin UI: `http://localhost:3000/admin/settings`.
- The server auto-starts a tunnel when a token is saved or present at boot (`src/lib/tunnel.ts`).
- QR/join links use the tunnel URL for players. Admin/host routes remain local-only (`src/middleware.ts`).
- Players may see ngrok’s one-time warning page; after clicking through, the cookie suppresses it.

## Key scripts
- `npm run dev` — start Next.js + Socket.io server (tsx `server.ts`).
- `npm run build` — Next build.
- `npm run start` — production start (uses `NODE_ENV=production tsx server.ts`).
- `npm run db:push` — apply Prisma schema to SQLite.
- `npm run db:studio` — Prisma Studio.
- `npm run lint` — Next lint.
- `node scripts/cleanup-old-games.ts` — delete sessions older than 1 hour (manual/cron).

## Project structure
```
.
├─ src/
│  ├─ app/                                  # Next.js App Router pages + API routes
│  │  ├─ page.tsx                           # Landing page
│  │  ├─ menu/                              # Menu selection screen
│  │  ├─ play/[gameCode]/page.tsx           # Player join/answer view (public)
│  │  ├─ host/[gameCode]/{display,control,playermonitor}/page.tsx # Host display + control panels
│  │  ├─ admin/                             # Admin dashboard and tools
│  │  │  ├─ page.tsx                        # Admin home
│  │  │  ├─ games/page.tsx                  # Game history/controls
│  │  │  ├─ quiz/new/page.tsx               # New quiz creation
│  │  │  ├─ themes/[themeId]/page.tsx       # Theme editor
│  │  │  └─ settings/page.tsx               # App settings (API keys, tunnel, etc.)
│  │  ├─ api/                               # Route handlers for admin/host/player APIs
│  │  │  ├─ quizzes/(route.ts, ai-generate, import, [quizId])     # CRUD + AI generation
│  │  │  ├─ games/(route.ts, [gameCode])    # Game lifecycle endpoints
│  │  │  ├─ themes/(route.ts, generate, [themeId]) # Theme CRUD + AI generate
│  │  │  ├─ settings/(route.ts, tunnel)     # Settings and tunnel start/stop
│  │  │  ├─ tunnel/route.ts                 # ngrok status
│  │  │  ├─ shorten/route.ts                # URL shortener
│  │  │  └─ upload/route.ts                 # Media upload
│  │  └─ uploads/[...path]/route.ts         # Serves uploaded assets
│  ├─ components/                           # UI primitives + domain components
│  │  ├─ ui/                                # shadcn-based primitives (buttons, dialog, tabs, etc.)
│  │  ├─ landing/                           # Marketing/landing sections
│  │  ├─ quiz/                              # Quiz editing + player inputs
│  │  │  ├─ editor/                         # Question/section modals
│  │  │  ├─ questions/                      # Question list and stats
│  │  │  └─ settings/                       # Admission/power-up controls
│  │  ├─ admin/                             # Admin cards, pagination, side panels
│  │  ├─ certificate/                       # Certificate status/download/regeneration
│  │  ├─ theme/                             # Theme provider and background effects
│  │  └─ display/AspectRatioHelper.tsx      # Host display scaling helper
│  ├─ contexts/                             # React contexts (dark mode)
│  ├─ hooks/                                # Client hooks (Socket.io connection, quiz preloading)
│  ├─ lib/                                  # Services and utilities
│  │  ├─ openai-*.ts                        # AI quiz/theme/translation helpers
│  │  ├─ certificate-*                      # Certificate generation and helpers
│  │  ├─ theme-*.ts                         # Theme presets, contrast, color utilities
│  │  ├─ tunnel.ts                          # ngrok tunnel control
│  │  ├─ scoring.ts                         # Game scoring logic
│  │  ├─ db.ts                              # Prisma client helper
│  │  └─ utils.ts                           # Shared client/server helpers
│  ├─ middleware.ts                         # Blocks admin/host routes from ngrok/public traffic
│  ├─ server/game-manager.ts                # Socket.io game state manager
│  └─ types/                                # Shared TypeScript types (quizzes, settings, certificates, themes)
├─ public/                                  # Static assets; upload root kept under version control via .gitkeep
├─ prisma/schema.prisma                     # Database schema
├─ data/                                    # SQLite database location (gitignored)
├─ scripts/                                 # Setup/maintenance scripts (setup, cleanup-old-games, contrast checks)
├─ server.ts                                # Custom Next.js + Socket.io entrypoint
├─ list-players.ts                          # Utility to list currently connected players from the socket server
├─ docker-compose.yml, Dockerfile           # Container build/run setup
├─ components.json, tailwind.config.ts, postcss.config.mjs, next.config.mjs, tsconfig.json # Tooling/config
└─ package.json, package-lock.json          # Dependencies and npm scripts
```

## Data and storage
- Default SQLite file: `data/quiz.db` (ignored by git).
- Uploaded media lives under `public/uploads`; compose mounts `quiz-uploads` volume there.
- When changing DB paths, update both `DATABASE_URL` and any Docker volume mappings.

## Security and routing
- Player-facing routes (`/play`, `/play/[gameCode]` and related APIs) stay accessible over ngrok.
- Admin/host routes (`/admin`, `/host`, `/api/quizzes`, `/api/settings`, `/api/tunnel`) are blocked from external/ngrok traffic by middleware (`src/middleware.ts`).

## License

This project is licensed under the [ERROR.DEV OPEN USE LICENSE](https://github.com/err0r-dev/.github/blob/main/profile/license.md).

## Original Quiz0r

This repository is based on the original [Quiz0r project](https://github.com/err0r-dev/Quiz0r) and contains a customized and extended version with additional features, architectural changes, and improvements.
