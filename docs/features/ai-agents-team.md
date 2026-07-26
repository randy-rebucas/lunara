# Feature: Lunara AI Team (chat with AI personas)

> **Status:** in progress
> **Date:** 2026-07-26
> **Author / PR:** —

## Summary

A standalone internal tool where Lunara staff/admin can chat with 8 named AI personas (Aurora the orchestrator, plus 7 department specialists) backed by Anthropic Claude. Phase 1 is chat-only — personas give conversational guidance via a grounded system prompt, with no function-calling/tool-use against real backend data.

## Affected apps

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | yes | New `ai-agents` module: persona registry, conversation/message persistence, Claude integration |
| `admin-web` | no | Not touched — this is a separate standalone app |
| `partner-web` | no | N/A |
| `customer-web` | no | N/A |
| `customer-mobile` | no | N/A |
| `rider-mobile` | no | N/A |
| `ai-agents` (new) | yes | New Next.js app — roster + per-agent chat UI |

## Shared packages

- [x] `@lunara/types` — added `AiAgentPersona`, `AiConversationSummary`, `AiChatMessage`
- [ ] `@lunara/validation` — not touched
- [ ] `@lunara/utils` — reused `resolveApiV1BaseUrl`/`assertApiUrlConfigured`, no changes
- [ ] `@lunara/hooks` — not touched

## API changes

- **Routes** (all under `/ai-agents`, `JwtAuthGuard` + `RolesGuard(STAFF, ADMIN)`):
  - `GET /ai-agents` — list the 8 persona summaries
  - `GET /ai-agents/:agentId/conversations` — the caller's conversations with that agent
  - `GET /ai-agents/conversations/:conversationId/messages` — message history
  - `POST /ai-agents/:agentId/messages` — send a message; creates a conversation lazily, calls Claude, persists both turns
- **New collections:** `ai_conversations`, `ai_messages` (Mongoose)
- **New config:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` env vars (`apps/api/src/common/config/ai-config.ts`)
- **New dependency:** `@anthropic-ai/sdk` in `apps/api`

## Client changes

### ai-agents (new app, port 3005)
- Login page reusing the existing `/auth/login` endpoint, restricted to STAFF/ADMIN roles
- Roster page (`/`) — grid of persona cards
- Chat page (`/chat/[agentId]`) — message history + composer, calls the new API endpoints

## How to verify locally

1. Add `ANTHROPIC_API_KEY` to `.env` (already scaffolded with an empty value)
2. `npm install` at repo root
3. Start infrastructure: `docker compose up -d` (Mongo/Redis)
4. `npm run dev --workspace=@lunara/api`
5. `npm run dev --workspace=@lunara/ai-agents`
6. Sign in with an existing STAFF/ADMIN account, open a persona's chat, send a message, confirm a real Claude reply and that history persists across refresh

## Out of scope / follow-ups

- Tool/function-calling from agents to real backend APIs (live order lookups, real balances, etc.)
- Admin-editable persona prompts (currently code-only in `apps/api/src/modules/ai-agents/personas.ts`)
- A real routing/classifier endpoint for Aurora — phase 1 uses prompt-only orchestration
- Re-validating Emma's persona prompt whenever the underlying API endpoints change (mirrors the discipline in `docs/EMMA_PROMPT_LIBRARY.md`)
