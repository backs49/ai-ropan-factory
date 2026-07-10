# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Build & Dev Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build (Turbopack)
npm run lint      # ESLint
```

No test framework is configured.

## Architecture

AI 웹소설/로판 자동 기획 & 챕터 생성 SaaS. Next.js 16 App Router + Supabase + multi-AI provider streaming.

### Route Groups

- `app/(auth)/` — Login, signup, forgot-password, reset-password, check-email (public)
- `app/(dashboard)/` — Dashboard, projects, settings, pricing, generate (auth required, shared layout)
- `app/api/generate/` — SSE streaming endpoints for outline+characters+episode+meta pipeline
- `app/api/generate/episode/` — Next episode generation + retry
- `app/api/generate/cover/` — AI 표지 이미지 생성 (Pro 전용)
- `app/api/payments/` — Toss Payments billing key issue/success/fail, cancel subscription (웹훅 없음 — 미구현 스텁 삭제됨)
- `app/api/cron/billing/` — Vercel Cron for daily subscription renewal/downgrade

### AI Pipeline (`lib/ai/`)

- `providers.ts` — Unified `streamAI()` dispatches to Anthropic/Gemini/Grok. Each provider handles SSE streaming differently. `expectsJSON` flag enables JSON response mode per provider.
- `pipeline.ts` — `runGenerationPipeline()` runs 4 stages sequentially: outline → characters → first_episode → meta. Exports `extractJSON()` to safely parse AI responses that may wrap JSON in code blocks or surrounding text (also used directly by callers outside the pipeline).
- `prompts.ts` — Prompt builders. `getNextEpisodePrompt()` takes outline + characters + previous episode's last ~1000 chars as context.
- `cover.ts` — `buildCoverPrompt()` + `generateCoverImage()`. Uses Gemini `gemini-2.5-flash-image` (`@google/genai`) with `responseModalities: ["IMAGE"]` and 2:3 aspect ratio; text-in-image explicitly disallowed by prompt.

(`lib/claude/` was removed — dead code; all providers go through `lib/ai/`.)

### Key Patterns

- **Tier-based model routing**: `AI_MODELS[provider]` has `light`/`heavy` models. Free tier uses light for outline/chars/meta, heavy for episodes. Pro uses heavy for all.
- **SSE streaming**: All generation endpoints use `ReadableStream` + `text/event-stream`. Client components use `EventSource` to consume.
- **Service client for writes**: `createClient()` uses user auth (RLS). `createServiceClient()` uses service role key for cron/quota-RPC writes that bypass RLS.
- **Array safety**: AI providers may return `{"characters": [...]}` instead of `[...]`. Always unwrap with `Array.isArray(parsed) ? parsed : parsed.characters`.
- **Korean IME**: Input `onKeyDown` handlers must check `!e.nativeEvent.isComposing` to prevent duplicate characters.
- **Atomic quota via RPC**: generation/cover quotas are consumed *before* the AI call via a `security definer` RPC that does the limit check and increment in one `UPDATE` (blocks race-condition double-spend), and refunded via a companion RPC on failure. Never check-then-increment quota in application code.
- **Stuck recovery**: if a project sits in `generating` past ~2× `maxDuration` (10 min), the client offers recovery which flips status to `failed` and calls `refund_generation` (the server that would have refunded never got to run).

### Server Actions (`lib/actions/`)

- `generation.ts` — `createProject()`. Validates genre/mood/target_age against whitelists (`GENRE_OPTIONS`/`MOOD_OPTIONS`/`TARGET_AGE_OPTIONS`), clamps `episode_count` to 10–200, caps keywords to 10 items / 30 chars each. Enforces free limits: 3 projects max (count query), 3 generations max (`monthly_generations` — actual quota consumption happens atomically in `app/api/generate/route.ts` via `consume_generation`).
- `episodes.ts` — `getEpisodes()`, `getEpisode()`, `updateEpisodeContent()` (for inline editing).
- `projects.ts` — `getProjects()`, `getProject()`, `deleteProject()` (cascade deletes episodes), `recoverStuckProject()` (marks stuck `generating` projects as `failed` + refunds quota).
- `settings.ts` — `updateAIProvider()`.
- `account.ts` — Account deletion; blocked while the user has an active/past_due subscription.

### Database (Supabase)

Tables: `profiles`, `projects`, `episodes`, `payments`, `subscriptions`. Migrations in `supabase/migrations/` (001–007; **005, 006, 007 are not yet applied to the live DB — must be pushed before this branch ships**):

- `005_billing_fixes.sql` — `subscriptions.customer_key` column; `consume_generation(p_user_id, p_limit)` / `refund_generation(p_user_id)` RPCs (service-role only, `revoke execute ... from public, anon, authenticated`).
- `006_indexes_constraints.sql` — indexes, `status` CHECK constraints, cascade deletes, episode DELETE policy.
- `007_cover_generation.sql` — `projects.cover_image_url`, `profiles.monthly_cover_count`/`cover_reset_at`, `consume_cover_generation`/`refund_cover_generation` RPCs (lazy monthly reset, Pro/enterprise only), public `covers` storage bucket.

Episodes have `status` field (completed/generating/failed). Projects have `first_episode` (legacy) — new code uses `episodes` table. Episodes have unique constraint on `(project_id, episode_number)`. `profiles.monthly_reset_at` is legacy/unused — the free generation limit is a lifetime cap (3), not monthly.

### Billing

Toss Payments billing key flow. CDN script loaded dynamically at `js.tosspayments.com/v2/standard` (not npm package — causes Vercel build errors). Free: 3 projects, 3 episodes each (lifetime, not monthly). Pro (9,900원/월): unlimited.

- **customerKey = `user.id`** (fixed, not a random string): passed as a prop from `app/(dashboard)/pricing/page.tsx` → `<TossCheckout customerKey={user.id}>`, verified server-side against `user.id` in `billing-key/success`, persisted to `subscriptions.customer_key`. The renewal cron uses `sub.customer_key ?? sub.user_id` as fallback for subscriptions created before this column existed.
- **Subscription status machine**: `active` → (charge fails) `past_due` (3-day grace period, retried daily by the cron) → after grace expires: `failed` + downgrade to free tier. `cancelled` subscriptions downgrade + become `expired` once `current_period_end` passes (idempotent — re-processing is a no-op).
- **Renewal cron** (`app/api/cron/billing/route.ts`, `vercel.json` schedules it daily at 09:00 UTC): requires `CRON_SECRET` — **always returns 401 if the env var is unset**, even without an Authorization header (prevents an unauthenticated default-open endpoint). Uses a deterministic idempotency key (`renew_{subId8}_{YYYYMMDD}` from `current_period_end`) as both the Toss `Idempotency-Key` and `payments.order_id`, so retries after partial failure don't double-charge. New period = old `current_period_end` + 1 month, clamped to end-of-month (e.g. Jan 31 → Feb 28).
- **No webhook**: the previously-stubbed Toss webhook endpoint was deleted (unauthenticated public endpoint with no real implementation). Billing key issue/cancel/renewal all go through authenticated routes or the cron above.
- Payment result UI: `pricing` page shows one of 6 error banners via `?error=` codes; `dashboard` shows a success banner via `?upgraded=true`.

### Cover Generation

Pro-only feature, `POST /api/generate/cover?projectId=...`. Monthly limit `COVER_MONTHLY_LIMIT = 20` (`types/index.ts`), enforced via `consume_cover_generation`/`refund_cover_generation` RPCs with lazy per-user reset (checked/reset on each call, no cron needed). Image generated by `lib/ai/cover.ts` (Gemini `gemini-2.5-flash-image`), uploaded to the public `covers` Storage bucket, URL stored in `projects.cover_image_url`. UI: `CoverCard` component + dashboard project thumbnails.

### Free Tier Limits (enforced in multiple places)

- Project count (3, lifetime): `lib/actions/generation.ts` (server action) + `app/(dashboard)/dashboard/page.tsx` (UI)
- Generation/episode count (3, lifetime — not monthly despite the `monthly_generations` column name): atomically enforced by `consume_generation` RPC in `app/api/generate/route.ts` and `app/api/generate/episode/route.ts`; UI in `components/project/generate-next-button.tsx` (→ redirects to /pricing) and `lib/actions/generation.ts` (pre-check for a friendlier error message before hitting the API).
- Cover count (20/month, Pro only): `consume_cover_generation` RPC in `app/api/generate/cover/route.ts`.

### Auth Flow

Standard Supabase email/password auth plus: `/forgot-password` → `/reset-password` (uses `NEXT_PUBLIC_SITE_URL` for the redirect link, falling back to request Host only if unset — avoids trusting a spoofable Host header) → `/check-email` (post-signup, no-session state). Account deletion (`lib/actions/account.ts`) is blocked while an active/past_due subscription exists. The middleware allowlist (`lib/supabase/middleware.ts`) includes these auth routes so logged-out users aren't bounced from them.

### Error Handling & SEO

`app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/(dashboard)/loading.tsx`, `app/robots.ts`, OG metadata. Static `/terms` and `/privacy` pages.

### Environment Variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
AI (at least one): `GEMINI_API_KEY`, `XAI_API_KEY`, `ANTHROPIC_API_KEY` (cover generation specifically requires `GEMINI_API_KEY`)
Payments/Cron: `NEXT_PUBLIC_TOSS_CLIENT_KEY` (API 개별 연동 키, not 결제위젯 키), `TOSS_SECRET_KEY`, `CRON_SECRET` (mandatory — cron 401s without it)
Site: `NEXT_PUBLIC_SITE_URL` (preferred base URL for auth email links, e.g. password reset)

### UI

shadcn/ui (Base UI variant) + Tailwind v4. Components in `components/ui/`. The `render` prop pattern is used for polymorphic components (e.g., `<Button render={<Link href="..." />}>`). Episode list uses sub-tab pattern with inline edit (textarea) and copy-to-clipboard. Project cards have inline delete confirmation (not modal).
