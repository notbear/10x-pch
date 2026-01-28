## 1. FlashcardsAI


[![Node][node-badge]][node-link]
[![License: MIT][license-badge]][license-link]

## 2. Project description

FlashcardsAI is a **mobile-first, responsive web app for software developers** that helps you create and study flashcards using **spaced repetition**.

The MVP focuses on:

- Generating flashcards with AI from **pasted technical text** (Markdown + code blocks supported)
- Letting users **review, edit, tag, accept/reject** generated drafts before saving
- Studying saved flashcards in an SRS session with **keyboard + mouse support**

Product requirements: see `./.ai/prd.md`.  
Target MVP tech stack: see `./.ai/tech-stack.md`.

## Table of contents

- [1. FlashcardsAI](#1-flashcardsai)
- [2. Project description](#2-project-description)
- [Table of contents](#table-of-contents)
- [3. Tech stack](#3-tech-stack)
  - [Frontend](#frontend)
  - [Backend \& database (planned for MVP)](#backend--database-planned-for-mvp)
  - [AI integration (planned for MVP)](#ai-integration-planned-for-mvp)
  - [CI/CD \& hosting (planned for MVP)](#cicd--hosting-planned-for-mvp)
- [4. Getting started locally](#4-getting-started-locally)
  - [Prerequisites](#prerequisites)
  - [Install \& run](#install--run)
  - [Build \& preview production build](#build--preview-production-build)
  - [Notes](#notes)
- [5. Available scripts](#5-available-scripts)
- [6. Project scope](#6-project-scope)
  - [MVP in scope](#mvp-in-scope)
  - [Out of scope for MVP](#out-of-scope-for-mvp)
  - [Open decisions (from PRD)](#open-decisions-from-prd)
- [7. Project status](#7-project-status)
- [8. License](#8-license)

## 3. Tech stack

### Frontend

- **Astro 5**: app shell, pages, and islands architecture
- **React 19**: interactive UI (draft review, bulk actions, study session)
- **TypeScript 5**: typed models and safer FE/BE contracts
- **Tailwind CSS 4**: fast, consistent styling (RWD/mobile-first)
- **shadcn/ui (Radix-based)**: accessible, editable UI primitives

### Backend & database (planned for MVP)

- **Supabase (Postgres + Auth + RLS)**:
  - Data storage for flashcards, tags, AI generation logs, and acceptance metrics
  - OAuth-only authentication and user session handling
  - Row Level Security (RLS) for per-user data isolation

### AI integration (planned for MVP)

- **OpenRouter.ai**: LLM access for synchronous flashcard generation and tag suggestions  
  Important: **API keys and model calls must run server-side only** (never from the browser).

### CI/CD & hosting (planned for MVP)

- **GitHub Actions**: lint/build quality gates and automation
- **DigitalOcean**: hosting with full environment control (with higher ops overhead vs managed hosting)

## 4. Getting started locally

### Prerequisites

- **Node.js `22.14.0`** (from `.nvmrc`)
- **npm** (bundled with Node)

### Install & run

```bash
nvm use
npm install
npm run dev
```

Then open the URL printed by Astro (typically `http://localhost:4321`).

### Build & preview production build

```bash
npm run build
npm run preview
```

### Notes

- This repository includes `.husky/` and `lint-staged` configuration in `package.json` (Git hooks may run lint/format on commit).
- A `.env.example` file is present in the repository root; copy it to `.env` if/when environment variables are required:

```bash
cp .env.example .env
```

## 5. Available scripts

| Script             | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start the Astro development server   |
| `npm run build`    | Build the production bundle          |
| `npm run preview`  | Preview the production build locally |
| `npm run astro`    | Run the Astro CLI                    |
| `npm run lint`     | Run ESLint across the project        |
| `npm run lint:fix` | Run ESLint and auto-fix issues       |
| `npm run format`   | Format files with Prettier           |

## 6. Project scope

### MVP in scope

- **OAuth-only authentication** (minimal provider set; provider choice is an open decision)
- **AI flashcard generation** from pasted text:
  - Input length: **300–10,000 chars**
  - Output format: **Question (≤ 100 chars)** + **Answer (≤ 300 chars)**
  - Markdown + code blocks supported
  - **Daily limit**: **50 AI-generated flashcards per user** with UI counter
  - Generation logging (timing, per-card status, acceptance metrics)
  - Sensitive-data / NDA warning before sending text to AI
- **Draft review workflow**:
  - Review generated drafts before saving
  - Edit, accept/save, reject/delete
  - Bulk operations + bulk tagging
  - Persist drafts until accepted or rejected
- **Manual flashcard creation** (no daily limit)
- **Flashcards management**: list, edit, delete
- **Full-text search** in question/answer (min. 3 chars, case-insensitive)
- **Tags system**: CRUD tags, usage counters, autocomplete/suggestions
- **Study session (SRS)**:
  - Up to **30 flashcards per session**
  - Rating **1–4** (keyboard + mouse)
  - Min. latency **24h** and no card repeated within the same session
  - Inline edit (content + tags) while studying
  - Session summary (cards reviewed + rating distribution)

### Out of scope for MVP

- Custom advanced SRS algorithm (e.g. SuperMemo/Anki-level)
- Importing from PDFs/DOCX or other document formats
- Sharing flashcard sets between users
- Integrations with external learning platforms
- Native mobile apps
- Dark mode in the first release

### Open decisions (from PRD)

- SRS library selection
- OAuth provider selection
- Initial list of “starter” technology tags
- System prompt enforcing consistent Markdown + code-block formatting in AI responses

## 7. Project status

This repository contains the **early-stage MVP codebase** for FlashcardsAI.

- **Current focus**: implementing the MVP described in `./.ai/prd.md`
- **Planned integrations**: Supabase (Auth/DB/RLS) and OpenRouter.ai for AI generation

## 8. License

Licensed under the **MIT License**.

[node-badge]: https://img.shields.io/badge/node-22.14.0-339933?logo=node.js&logoColor=white
[node-link]: https://nodejs.org/
[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[license-link]: https://opensource.org/licenses/MIT
