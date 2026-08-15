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
- Question types: Single Choice, Multiple Select, True/False, Categorise, and Matching
- Live gameplay: real-time multiplayer with Socket.io
- Host controls: display view, player monitor, admission controls, reveal, and scoreboard
- Server-side scoring with partial credit and speed bonus
- Certificates: generated and downloadable for completed games
- AI assistance: AI-powered quiz and theme generation with selectable question types and content translation
- Multilingual: full application UI in 13 language variants, with RTL support and AI translation of quiz content
- Self-hosting: Docker deployment with persistent SQLite database

## Current Features

### Multilingual Application

The application interface is available in 13 language variants:
- 🇬🇧 English — default/master language (fallback for any missing key)
- 🇩🇪 Deutsch (German)
- 🇪🇸 Español (Spanish)
- 🇫🇷 Français (French)
- 🇮🇹 Italiano (Italian)
- 🇵🇹 Português (Portuguese)
- 🇷🇺 Русский (Russian)
- 🇯🇵 日本語 (Japanese)
- 🇨🇳 中文 (Chinese, simplified)
- 🇸🇦 العربية (Arabic — RTL)
- 🇮🇱 עברית (Hebrew — RTL)
- 🇷🇸 Српски (Serbian, Cyrillic)
- 🇷🇸 Srpski (Serbian, Latin)

Serbian Cyrillic and Serbian Latin are maintained as separate locales. Arabic and Hebrew are rendered right-to-left (RTL); all other locales are left-to-right. Application language and quiz-content language are separate systems. The player interface supports application language selection, while quiz content can be generated or translated into different languages.

**Language selection:** A language selector on the start page (homepage) lets users pick the application language. The choice is persisted in `localStorage` and applies to the entire Quiz0r UI (start page, menu, player lobby, join screen, host controls, and host display).

**I18n architecture:**
- `src/contexts/I18nContext.tsx` — `I18nProvider` holding the active locale and the `t(key, params?)` translation function. `t()` supports `{param}` interpolation, e.g. `t("player.questionOf", { current: 3, total: 10 })`. RTL detection (`RTL_LOCALES`) applies `dir="rtl"` for Arabic and Hebrew.
- `src/hooks/useTranslation.ts` — re-exports `t`, `locale`, `setLocale`, `availableLocales`, and `isRtl`.
- `src/lib/locales/*.json` — 13 translation files namespaced by `app`, `menu`, `player`, `host`, `admin`, and quiz-content sections. English is the master/fallback; missing keys fall back to English.
- `src/components/ui/language-selector.tsx` — reusable `<LanguageSelector />` dropdown (used on the start page).

To add another application language: add an entry to `AppSupportedLocales` in `I18nContext.tsx`, import a new `src/lib/locales/<code>.json` file, and translate the keys.

### Question Types

Quiz0r supports five question types, all stored on a single `Question` table with a `questionType` discriminator. The extended types (`CATEGORISE`, `MATCHING`) carry their structured content in nullable JSON columns (`categoriseData`, `matchingData`) so existing Single/Multiple Choice questions remain unaffected (backward-compatible migration).

Implemented question types:
- **Single Choice** (`SINGLE_SELECT`) — one correct answer
- **Multiple Select** (`MULTI_SELECT`) — multiple correct answers with partial-credit scoring
- **True/False** (`TRUE_FALSE`) — a binary statement the player marks as true or false
- **Categorise** (`CATEGORISE`) — assign items to the correct categories (structured JSON content)
- **Matching** (`MATCHING`) — connect pairs, e.g. countries to capitals (structured JSON content)

Content models, validation, and server-side scoring for the extended types live in `src/lib/question-types.ts`. Admin editor UI (`QuestionEditorDialog`), the player answer view, host reveal, and the question card all handle every type, with localized type labels drawn from the existing `host.*` i18n keys.

### Scoring System

Scoring runs server-side in `src/server/game-manager.ts` with helpers in `src/lib/question-types.ts`, and uses a partial-credit concept suited to learning and training quizzes:

- **Single Choice / True/False**: Base points with a speed bonus (up to 50% for the fastest answers).
- **Multiple Select**: Partial credit based on correct/incorrect selections, with penalties for wrong additional selections and a speed bonus.
- **Categorise**: Partial credit proportional to correctly assigned items (`correctnessRatio = correctItems / totalItems`), times a speed multiplier.
- **Matching**: Partial credit proportional to correctly matched pairs (`correctnessRatio = correctPairs / totalPairs`), times a speed multiplier.

In all cases the speed multiplier is `max(0, (1 - timeTaken / timeLimit) * 0.5)`, and the awarded points are `round(basePoints * correctnessRatio * (1 + speedMultiplier))` where applicable. The design incorporates concepts inspired by partial-credit scoring systems used in examination contexts.

### AI Question Generation

Quiz0r uses an extensible AI provider abstraction (`AIProvider` interface) that supports multiple AI backends through a single unified `OpenAICompatibleProvider` implementation.

**Architecture:**
```
Quiz0r → AIProvider interface → OpenAICompatibleProvider → configured AI endpoint
```

**Configurable AI providers** (`PROVIDER_PRESETS` in `src/lib/providers/openai-compatible-provider.ts`):
- **OpenAI** (GPT-4o, `https://api.openai.com/v1`)
- **FreeLLMAPI** (local proxy with multiple free-tier providers)
- **OpenRouter** (aggregated API access)
- **Ollama** (local LLM server, no API key required)
- **LM Studio** (local LLM server, no API key required)
- **Custom** (any user-configurable OpenAI-compatible endpoint)

API credentials are stored server-side in the database and are never exposed to the client.

**Selectable question types:** When generating a quiz with AI, the request accepts a `questionTypes` list chosen from the `AiQuestionTypeOption` set (`MULTIPLE_CHOICE`, `MULTI_SELECT`, `TRUE_FALSE`, `CATEGORISE`, `MATCHING`). The generator (`src/lib/openai-quiz-generator.ts`) maps each option to the corresponding storage type and instructs the model accordingly; if no types are supplied it defaults to Multiple Choice.

**AI translation of quiz content:** Quiz text (questions, answers, and the structured labels of Categorise/Matching content) can be translated into the supported languages via the AI provider (`src/lib/openai-translate.ts`). Translations are stored per-language in the `QuestionTranslation`/`QuestionContentTranslation` tables.

**Source language:** Each quiz records a `sourceLanguage` used as the origin for translation. `src/lib/source-language.ts` resolves the saved `sourceLanguage` (defaulting to English for legacy quizzes); automatic language detection is intentionally not performed.

> **Note:** The AI provider architecture is implemented. End-to-end testing against local FreeLLMAPI instances is still pending.

### Stability and Improvements

Recent technical improvements include:
- Dialog animation fixes and html2canvas color handling
- Tailwind CSS 4 lab()/oklab() compatibility for image generation
- Docker build/runtime fixes for Prisma 7, Tailwind 4, and Next.js 16
- AI provider abstraction refactor for extensibility
- Multilingual application language support
- Extended question types (True/False, Categorise, Matching) with server-side partial-credit scoring

### Host / Player / Display System

A game runs across three coordinated surfaces connected via Socket.io (`src/server/game-manager.ts`):
- **Player view** (`/play/[gameCode]`) — public join/answer screen; players join with a game code or QR link.
- **Host control** (`/host/[gameCode]/control`) — admission controls, player monitor, reveal and scoreboard triggers, certificate access.
- **Host display** (`/host/[gameCode]/display`) — the projected leaderboard/question view, scaled to the screen via `AspectRatioHelper`.

The host reveals answers after each question, then advances to a scoreboard before the next question; both steps are required (`REVEAL_REQUIRED`).

### Reveal and Scoreboard

After players answer, the host reveals the correct answers. For the extended types, the reveal includes type-specific statistics (per-item correctness for Categorise, per-pair correctness for Matching). The scoreboard then ranks players by their accumulated server-side score.

### Certificates

Completed games can issue certificates, generated server-side (`src/lib/certificate-service.ts`, `src/lib/certificate-utils.ts`) and downloadable from the host control panel. Status banners and a regeneration panel are provided via `src/components/certificate/`.

### Import / Export

Quizzes can be imported from and exported to a portable format (`src/lib/validate-import.ts`, `src/app/api/quizzes/import`, `src/app/api/quizzes/[quizId]/export`). Import validation understands all five question types, including the structured Categorise/Matching content.

### Theme System

Quiz0r ships a theme system with presets, contrast checks, and AI theme generation. Themes are managed in the admin UI (`/admin/themes`) and applied to the player/display experience. Relevant code lives in `src/lib/theme-*.ts` and `src/components/theme/`.

### Admin and Settings

The admin area (`/admin`) covers quiz library management, game history, theme editing, and settings (`/admin/settings`) for API keys, AI provider configuration, tunneling, and other operational parameters. Admin/host routes are protected by authentication and kept local-only (see Security and routing).

### Learning Quiz and Examination Suitability

The combination of five question types, server-side partial-credit scoring with speed bonus, certificates, and multilingual content makes Quiz0r suitable for learning quizzes and knowledge assessments (Sachkundeprüfungen) — not only for entertainment game shows.

## Planned

Future enhancements under consideration:
- Provider/model selection UI
- Improved AI provider configuration interface
- Additional languages and translation refinements

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
│  ├─ contexts/                             # React contexts (dark mode, i18n)
│  │  ├─ DarkModeContext.tsx                # Dark mode provider
│  │  └─ I18nContext.tsx                    # I18n provider with t() translation function
│  ├─ hooks/                                # Client hooks (Socket.io, quiz preloading, translations)
│  │  ├─ useSocket.ts                       # Socket.io connection hook
│  │  ├─ useQuizPreloader.ts                # Quiz preloading hook
│  │  └─ useTranslation.ts                  # Hook exposing t(), locale, setLocale
│  ├─ lib/                                  # Services and utilities
│  │  ├─ locales/*.json                     # 13 application UI translation files
│  │  ├─ question-types.ts                  # Question content models, validation, server-side scoring, type labels
│  │  ├─ openai-*.ts                        # AI quiz/theme/translation helpers
│  │  ├─ providers/openai-compatible-provider.ts # AI provider presets (OpenAI, FreeLLMAPI, OpenRouter, Ollama, LM Studio, Custom)
│  │  ├─ source-language.ts                 # Resolves a quiz's saved source language for translation
│  │  ├─ certificate-*                      # Certificate generation and helpers
│  │  ├─ theme-*.ts                         # Theme presets, contrast, color utilities
│  │  ├─ tunnel.ts                          # ngrok tunnel control
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
