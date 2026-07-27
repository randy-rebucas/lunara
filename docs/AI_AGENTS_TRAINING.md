# Training the Lunara AI Agents

The AI team (`apps/api/src/modules/ai-agents/`) runs on Anthropic's Claude via the API — there is no
custom-trained or fine-tuned model. "Training" an agent here means **prompt + tool engineering**:
what the system prompt claims, what tools back those claims, what guardrails constrain behavior, and
a feedback loop from real conversations back into those three things.

This doc is the process for doing that deliberately instead of ad hoc.

---

## 1. The four levers

In order of how much a bad answer usually traces back to each one:

### a. System prompt accuracy (`personas.ts`)

Each persona's `systemPrompt` (and `customerSystemPrompt`/`guestSystemPrompt` where they exist) is
the single biggest lever. A wrong claim here — "yes, you can change your login email" when that flow
doesn't exist — causes a hallucinated or misleading answer regardless of model quality or tool access.

**Rule:** every capability claim must be either genuinely supported by the real app, or explicitly
flagged as unsupported. Emma's prompt is the reference example — see the "grounded in what the real
API supports" section with an explicit NOT-supported list. Copy that pattern when writing or editing
any persona.

### b. Tool coverage (`tools/*.ts` + `registry.ts`)

An agent can only ground an answer in live data if it has a tool for it. The failure mode is a real,
already-existing endpoint that nobody wired to the persona whose domain it belongs to — see
[AI_AGENT_ENDPOINT_MAP.md](./AI_AGENT_ENDPOINT_MAP.md) for the endpoint → persona ownership mapping,
and cross-check it against each tool file's `personas: [...]` array when auditing.

**Rule:** if a persona's system prompt says "you can look up X," a tool for X must exist and list that
persona's id. If a real endpoint exists in the persona's domain but has no tool, that's a gap — add
one (read-only; see guardrails below) or explicitly say in the prompt that it isn't available yet.

### c. Guardrails (`SHARED_GUARDRAILS`, `CUSTOMER_GUARDRAILS`, `GUEST_GUARDRAILS`)

These three blocks in `personas.ts` control tone, refusal behavior, and prompt-injection resistance,
and are appended to every persona's prompt at the appropriate audience tier (staff / customer / guest).
They're shared, not per-persona, so a change here affects every agent at that tier.

**Rule:** don't fork guardrail text per-persona unless a persona genuinely needs different security
posture. Tune scope via the persona's own prompt (what it's allowed to talk about) rather than the
guardrails (how it behaves under adversarial input).

### d. Tool safety scope

Every tool is currently **read-only** by design — no persona can create, update, or delete a real
record. Guest-accessible tools additionally require an explicit `guestSafe: true` flag on the
`ToolSpec` (see `tools/types.ts`, `tools/guest.tools.ts`) and must be backed by genuinely public,
no-auth data (the same pattern as `/public/branches`).

**Rule:** never mark a tool `guestSafe` unless the underlying data has no auth requirement at the API
layer today. Never add a write-capable tool without a separate, explicit decision to do so — v1 is
read-only across the board intentionally (see AI_AGENT_ENDPOINT_MAP.md notes).

---

## 2. The feedback loop

Prompt/tool engineering only improves if it's driven by real transcripts, not guesses.

1. **Find high-signal conversations.** Use the `/stats` page (staff/admin, linked from the ai-agents
   sidebar; backed by `GET /ai-agents/stats`) to see which personas get the most conversation/message
   volume — that's where fixing a bad answer has the most leverage. Guest Emma volume shows up there
   too (`guestMessages`), separate from authenticated usage.
2. **Pull the actual messages.** `ai_conversations` / `ai_messages` in MongoDB hold full transcripts,
   scoped per user. For a systemic issue (many users hitting the same wrong answer), sample several
   conversations for the same persona rather than acting on one anecdote.
3. **Classify the failure** against the four levers above:
   - Wrong/outdated claim → fix the system prompt.
   - "I don't have access to that" when it should be answerable → missing tool, check the endpoint map.
   - Refused something it should have answered, or was too easily redirected by injected text → guardrail tuning.
   - Answered something it shouldn't have (leaked scope, acted outside read-only) → tool scope bug, treat as a priority fix, not a prompt tweak.
4. **Patch the specific cause**, not the whole prompt. Small, targeted edits to the relevant section
   (a "What you know" bullet, one tool's `personas` array, one guardrail line) keep prompts reviewable
   and avoid regressing unrelated behavior.
5. **Re-verify** by asking the same question that surfaced the issue, ideally via the actual chat UI
   (`apps/ai-agents`) rather than assuming the prompt edit fixed it.

There's no automated eval suite yet — this loop is manual. A natural next step, once volume justifies
it, is a small script that replays a fixed set of known-tricky prompts per persona against
`POST /ai-agents/:agentId/messages` and diffs the responses after a prompt change.

---

## 3. Tuning by audience tier

Don't apply one bar to every persona — tune conservativeness to who's on the other end:

| Tier | Example | Posture |
|---|---|---|
| **Guest** (no login) | Emma via `/guest/emma` | Most conservative — zero account data, minimal tool surface (`guestSafe` only), quick to say "sign in for that." Optimize for never overclaiming to an anonymous visitor. |
| **Customer** (logged in) | Emma, customer variant | Warm, helpful, but still hard-scoped to the caller's own data server-side — the model never gets to choose whose order it looks up. |
| **Staff/internal** | Olivia, Daniel, Mia, Benjamin, Sophia, Noah, Aurora | Can be more direct and technical; internal users can tolerate "I'm not sure, check X module" better than a customer can. |

A guardrail or prompt change made for one tier should be evaluated against whether it's actually
tier-specific before copying it to the others.

---

## 4. Adding or changing a persona — checklist

- [ ] `systemPrompt` (and audience variants) only claims what's real; unsupported flows are explicitly named as unsupported.
- [ ] Every claimed live-data capability has a matching tool with this persona's id in `personas: [...]`.
- [ ] New tools are read-only; guest-facing tools are `guestSafe: true` **and** backed by genuinely public data.
- [ ] `suggestedPrompts` / `promptLibrary` (and `guest*`/`customer*` variants) reflect what the persona can actually answer well — these are also the discovery surface in the chat UI's prompt library panel.
- [ ] Cross-check new/changed endpoint ownership against [AI_AGENT_ENDPOINT_MAP.md](./AI_AGENT_ENDPOINT_MAP.md) and update it if the mapping changed.
- [ ] After deploying, sample a few real conversations for the persona within the first days to catch issues early (see §2).

---

## Related docs

- [AI Agent → API Endpoint Domain Map](./AI_AGENT_ENDPOINT_MAP.md)
- [API endpoints](./API_ENDPOINTS.md)
- [AI Agents deployment](./DEPLOYMENT_AI_AGENTS.md)
