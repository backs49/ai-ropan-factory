# AI 로판 팩토리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready AI web novel planning & chapter generation SaaS with streaming generation, tier-based billing, and Korean web novel-optimized output.

**Architecture:** Next.js 15 App Router with Route Handlers for SSE streaming of 4-stage Claude API pipeline. Supabase for auth, database (PostgreSQL + RLS), and user management. Server Actions for form submissions and DB mutations.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS, shadcn/ui, Supabase (Auth + PostgreSQL + RLS), Anthropic Claude API (claude-sonnet-4-20250514), Node.js runtime

---

## File Structure

```
ai-ropan-factory/
├── app/
│   ├── layout.tsx                          # Root layout: fonts, ThemeProvider, metadata
│   ├── page.tsx                            # Landing page (public)
│   ├── globals.css                         # Tailwind + shadcn theme tokens
│   ├── (auth)/
│   │   ├── login/page.tsx                  # Login page
│   │   └── signup/page.tsx                 # Signup page
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # Auth-gated layout with sidebar
│   │   ├── page.tsx                        # Dashboard: project list
│   │   ├── generate/page.tsx               # Generation form
│   │   ├── projects/[id]/page.tsx          # Project detail view
│   │   └── settings/page.tsx               # Account settings
│   └── api/
│       ├── generate/route.ts               # SSE streaming endpoint
│       └── webhooks/toss/route.ts          # Toss Payments placeholder
├── components/
│   ├── ui/                                 # shadcn/ui primitives
│   ├── auth/
│   │   ├── login-form.tsx                  # Email/password login form
│   │   └── signup-form.tsx                 # Email/password signup form
│   ├── dashboard/
│   │   ├── project-card.tsx                # Single project card
│   │   └── project-list.tsx                # Project grid with empty state
│   ├── generate/
│   │   ├── generation-form.tsx             # Multi-field generation input form
│   │   ├── generation-stream.tsx           # SSE consumer + stage renderer
│   │   └── stage-card.tsx                  # Individual stage result card
│   ├── project/
│   │   ├── outline-view.tsx                # 3-act structure + episode list
│   │   ├── character-sheet.tsx             # Single character card
│   │   ├── episode-view.tsx                # First episode reader
│   │   └── download-button.tsx             # TXT/MD export
│   └── layout/
│       ├── sidebar.tsx                     # Navigation sidebar
│       ├── header.tsx                      # Top bar with user menu
│       └── theme-provider.tsx              # next-themes wrapper
├── lib/
│   ├── supabase/
│   │   ├── client.ts                       # Browser Supabase client
│   │   ├── server.ts                       # Server Supabase client (cookies)
│   │   └── middleware.ts                   # Auth middleware helper
│   ├── claude/
│   │   ├── client.ts                       # Anthropic SDK client singleton
│   │   ├── prompts.ts                      # System prompts for each stage
│   │   └── pipeline.ts                     # 4-stage generation orchestrator
│   ├── actions/
│   │   ├── auth.ts                         # Login/signup/logout server actions
│   │   ├── projects.ts                     # Project CRUD server actions
│   │   └── generation.ts                   # Create project + start generation
│   └── utils.ts                            # cn() helper, formatDate, etc.
├── types/
│   └── index.ts                            # All shared TypeScript types
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql          # Full DB schema + RLS policies
├── middleware.ts                            # Next.js middleware for auth redirect
├── .env.local.example                      # Environment variable template
├── next.config.ts                          # Next.js config
├── tailwind.config.ts                      # Tailwind config with shadcn
├── tsconfig.json                           # TypeScript strict config
├── package.json                            # Dependencies
└── components.json                         # shadcn/ui config
```

---

### Task 1: Project Scaffolding + Dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `app/globals.css`
- Create: `components.json`
- Create: `.env.local.example`
- Create: `lib/utils.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Next.js 15 project**

```bash
cd /Users/manggo-chaltteog/money-workspace/ai-ropan-factory
npx create-next-app@latest . --typescript --tailwind --eslint --app --src=no --import-alias "@/*" --use-npm
```

Expected: Project scaffolded with App Router, TypeScript, Tailwind.

- [ ] **Step 2: Install all dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk next-themes lucide-react class-variance-authority clsx tailwind-merge
npm install -D @types/node
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

Select: New York style, Zinc color, CSS variables enabled.

- [ ] **Step 4: Install required shadcn components**

```bash
npx shadcn@latest add button card input label select textarea badge separator avatar dropdown-menu sheet tabs scroll-area skeleton toast dialog form
```

- [ ] **Step 5: Create environment variable template**

Create `.env.local.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 6: Update next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
```

- [ ] **Step 7: Set up globals.css with dark mode defaults**

Replace `app/globals.css` with Tailwind base + shadcn CSS variables. Dark mode as default theme.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 262 83% 58%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 262 83% 58%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 262 83% 58%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 262 83% 58%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 8: Create lib/utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function formatRelativeDate(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return formatDate(date);
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000 without errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with shadcn/ui and dependencies"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Define all shared types**

```typescript
export type Tier = "free" | "pro" | "enterprise";

export type ProjectStatus =
  | "generating"
  | "completed"
  | "failed"
  | "archived";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  tier: Tier;
  monthly_generations: number;
  monthly_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string | null;
  status: ProjectStatus;
  genre: string;
  keywords: string[];
  target_age: string;
  mood: string;
  episode_count: number;
  outline: OutlineData | null;
  characters: CharacterData[] | null;
  first_episode: string | null;
  cover_prompts: CoverPrompt[] | null;
  seo: SeoData | null;
  variation_of: string | null;
  token_usage: TokenUsage | null;
  created_at: string;
  updated_at: string;
}

export interface OutlineData {
  title: string;
  logline: string;
  act1: {
    summary: string;
    episodes: EpisodeOutline[];
  };
  act2: {
    summary: string;
    episodes: EpisodeOutline[];
  };
  act3: {
    summary: string;
    episodes: EpisodeOutline[];
  };
}

export interface EpisodeOutline {
  episode_number: number;
  title: string;
  summary: string;
  key_event: string;
}

export interface CharacterData {
  name: string;
  role: string;
  age: string;
  appearance: string;
  personality: string;
  secret: string;
  motivation: string;
  relationships: { character: string; relationship: string }[];
}

export interface CoverPrompt {
  style: string;
  prompt: string;
  negative_prompt: string;
}

export interface SeoData {
  titles: string[];
  hashtags: string[];
  description: string;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cost_estimate: number;
}

export interface GenerationInput {
  genre: string;
  keywords: string[];
  target_age: string;
  mood: string;
  episode_count: number;
  variation_of?: string;
}

export type GenerationStage =
  | "outline"
  | "characters"
  | "first_episode"
  | "meta";

export interface StreamEvent {
  stage: GenerationStage;
  status: "started" | "streaming" | "completed" | "error";
  content?: string;
  error?: string;
}

export const GENRE_OPTIONS = [
  "로판 (로맨스 판타지)",
  "빙의물",
  "환생물",
  "회귀물",
  "실버 로맨스",
  "현대 로맨스",
  "궁중 로맨스",
  "하렘물",
  "역하렘물",
  "사극 로맨스",
] as const;

export const MOOD_OPTIONS = [
  "사이다",
  "집착",
  "치유",
  "다크",
  "코미디",
  "미스터리",
  "달달",
  "앙스트",
  "스릴러",
  "힐링",
] as const;

export const TARGET_AGE_OPTIONS = [
  "10대",
  "20대",
  "30대",
  "40대+",
  "전연령",
] as const;

export const TIER_LIMITS: Record<Tier, number> = {
  free: 3,
  pro: Infinity,
  enterprise: Infinity,
};
```

- [ ] **Step 2: Commit**

```bash
git add types/
git commit -m "feat: add shared TypeScript types and constants"
```

---

### Task 3: Supabase Schema + RLS

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tier enum
create type user_tier as enum ('free', 'pro', 'enterprise');

-- Project status enum
create type project_status as enum ('generating', 'completed', 'failed', 'archived');

-- Profiles table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  tier user_tier not null default 'free',
  monthly_generations int not null default 0,
  monthly_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects table
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  status project_status not null default 'generating',
  genre text not null,
  keywords text[] not null default '{}',
  target_age text not null,
  mood text not null,
  episode_count int not null default 50,
  outline jsonb,
  characters jsonb,
  first_episode text,
  cover_prompts jsonb,
  seo jsonb,
  variation_of uuid references projects(id) on delete set null,
  token_usage jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_projects_user_id on projects(user_id);
create index idx_projects_status on projects(status);
create index idx_projects_created_at on projects(created_at desc);

-- RLS: Enable
alter table profiles enable row level security;
alter table projects enable row level security;

-- RLS: Profiles - users can only read/update their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- RLS: Projects - users can only CRUD their own projects
create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = user_id);

-- Function: Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: Auto-create profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function: Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure public.update_updated_at();

create trigger projects_updated_at
  before update on projects
  for each row execute procedure public.update_updated_at();

-- Service role policy for API route to update projects
create policy "Service role can manage all projects"
  on projects for all
  using (auth.role() = 'service_role');

create policy "Service role can manage all profiles"
  on profiles for all
  using (auth.role() = 'service_role');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema with profiles, projects, RLS policies"
```

---

### Task 4: Supabase Client Setup + Auth Middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create browser Supabase client**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server Supabase client**

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 3: Create middleware helper**

```typescript
// lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from dashboard
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    !request.nextUrl.pathname.startsWith("/api") &&
    request.nextUrl.pathname !== "/"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/signup"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Create Next.js middleware**

```typescript
// middleware.ts
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase client setup and auth middleware"
```

---

### Task 5: Theme Provider + Root Layout

**Files:**
- Create: `components/layout/theme-provider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create ThemeProvider**

```typescript
// components/layout/theme-provider.tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 2: Update root layout**

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const pretendard = localFont({
  src: [
    {
      path: "./fonts/PretendardVariable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-pretendard",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "AI 로판 팩토리 - AI 웹소설 자동 기획 & 생성",
  description:
    "장르, 키워드, 분위기만 입력하면 3막 구조, 캐릭터 시트, 1화 완성본까지 AI가 자동 생성합니다.",
  keywords: ["웹소설", "로판", "AI", "자동 생성", "기획", "캐릭터"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${pretendard.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Note: If Pretendard font file is not available, replace with `next/font/google` Inter as fallback:

```typescript
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/theme-provider.tsx app/layout.tsx
git commit -m "feat: add dark theme provider and root layout with Korean metadata"
```

---

### Task 6: Auth Server Actions + Auth Pages

**Files:**
- Create: `lib/actions/auth.ts`
- Create: `components/auth/login-form.tsx`
- Create: `components/auth/signup-form.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create auth server actions**

```typescript
// lib/actions/auth.ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Create login form component**

```typescript
// components/auth/login-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">로그인</CardTitle>
        <CardDescription>AI 로판 팩토리에 오신 것을 환영합니다</CardDescription>
      </CardHeader>
      <form action={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="hello@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Button>
          <p className="text-sm text-muted-foreground">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              회원가입
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Create signup form component**

```typescript
// components/auth/signup-form.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signup(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">회원가입</CardTitle>
        <CardDescription>무료로 시작하세요. 매월 3회 생성 가능합니다.</CardDescription>
      </CardHeader>
      <form action={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="displayName">닉네임</Label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              placeholder="작가님의 필명"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="hello@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="6자 이상"
              required
              minLength={6}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "가입 중..." : "무료로 시작하기"}
          </Button>
          <p className="text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-primary hover:underline">
              로그인
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 4: Create login page**

```typescript
// app/(auth)/login/page.tsx
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}
```

- [ ] **Step 5: Create signup page**

```typescript
// app/(auth)/signup/page.tsx
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <SignupForm />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/actions/auth.ts components/auth/ app/\(auth\)/
git commit -m "feat: add auth server actions, login/signup forms and pages"
```

---

### Task 7: Dashboard Layout (Sidebar + Header)

**Files:**
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/header.tsx`
- Create: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create sidebar**

```typescript
// components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Sparkles, Settings, BookOpen } from "lucide-react";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/generate", label: "새로 생성", icon: Sparkles },
  { href: "/settings", label: "설정", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <BookOpen className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">로판 팩토리</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create header**

```typescript
// components/layout/header.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, LayoutDashboard, Sparkles, Settings, LogOut, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/generate", label: "새로 생성", icon: Sparkles },
  { href: "/settings", label: "설정", icon: Settings },
];

export function Header({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (profile.display_name || profile.email)
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">로판 팩토리</span>
          </div>
          <nav className="space-y-1 p-4">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop: page title area */}
      <div className="hidden md:block" />

      {/* Right side: tier badge + user menu */}
      <div className="flex items-center gap-3">
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-medium",
          profile.tier === "pro"
            ? "bg-primary/20 text-primary"
            : "bg-muted text-muted-foreground"
        )}>
          {profile.tier === "free" ? "Free" : "Pro"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile.display_name}</p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">설정</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create dashboard layout**

```typescript
// app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { Profile } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header profile={profile as Profile} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/layout/sidebar.tsx components/layout/header.tsx app/\(dashboard\)/layout.tsx
git commit -m "feat: add dashboard layout with sidebar, header, and auth guard"
```

---

### Task 8: Dashboard Page (Project List)

**Files:**
- Create: `lib/actions/projects.ts`
- Create: `components/dashboard/project-card.tsx`
- Create: `components/dashboard/project-list.tsx`
- Create: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Create project server actions**

```typescript
// lib/actions/projects.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/types";

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data as Project;
}

export async function deleteProject(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) return { error: error.message };
  return {};
}
```

- [ ] **Step 2: Create project card component**

```typescript
// components/dashboard/project-card.tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeDate } from "@/lib/utils";
import { BookOpen, Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { Project } from "@/types";

const statusConfig = {
  generating: { label: "생성 중", icon: Loader2, variant: "secondary" as const },
  completed: { label: "완료", icon: CheckCircle2, variant: "default" as const },
  failed: { label: "실패", icon: XCircle, variant: "destructive" as const },
  archived: { label: "보관됨", icon: BookOpen, variant: "outline" as const },
};

export function ProjectCard({ project }: { project: Project }) {
  const status = statusConfig[project.status];
  const StatusIcon = status.icon;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base line-clamp-1">
              {project.title || project.outline?.title || "제목 없음"}
            </CardTitle>
            <Badge variant={status.variant} className="ml-2 shrink-0">
              <StatusIcon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge variant="outline" className="text-xs">{project.genre}</Badge>
            <Badge variant="outline" className="text-xs">{project.mood}</Badge>
            {project.keywords.slice(0, 3).map((kw) => (
              <Badge key={kw} variant="secondary" className="text-xs">
                {kw}
              </Badge>
            ))}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            {formatRelativeDate(project.created_at)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Create project list component**

```typescript
// components/dashboard/project-list.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./project-card";
import { Sparkles } from "lucide-react";
import type { Project } from "@/types";

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">아직 생성된 작품이 없습니다</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          장르, 키워드, 분위기만 입력하면 AI가 웹소설 기획을 자동으로 생성합니다.
        </p>
        <Button asChild>
          <Link href="/generate">
            <Sparkles className="mr-2 h-4 w-4" />
            첫 작품 생성하기
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create dashboard page**

```typescript
// app/(dashboard)/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/dashboard/project-list";
import { getProjects } from "@/lib/actions/projects";
import { Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 작품</h1>
          <p className="text-muted-foreground">
            총 {projects.length}개의 프로젝트
          </p>
        </div>
        <Button asChild>
          <Link href="/generate">
            <Sparkles className="mr-2 h-4 w-4" />
            새로 생성
          </Link>
        </Button>
      </div>
      <ProjectList projects={projects} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/projects.ts components/dashboard/ app/\(dashboard\)/page.tsx
git commit -m "feat: add dashboard page with project list and empty state"
```

---

### Task 9: Generation Form

**Files:**
- Create: `components/generate/generation-form.tsx`
- Create: `lib/actions/generation.ts`
- Create: `app/(dashboard)/generate/page.tsx`

- [ ] **Step 1: Create generation server action**

```typescript
// lib/actions/generation.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import type { GenerationInput, Tier, Profile } from "@/types";
import { TIER_LIMITS } from "@/types";

export async function createProject(input: GenerationInput): Promise<{
  projectId?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  // Check tier limits
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, monthly_generations, monthly_reset_at")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "프로필을 찾을 수 없습니다." };

  const p = profile as Pick<Profile, "tier" | "monthly_generations" | "monthly_reset_at">;

  // Reset monthly count if past reset date
  const now = new Date();
  const resetAt = new Date(p.monthly_reset_at);
  let currentCount = p.monthly_generations;

  if (now >= resetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await supabase
      .from("profiles")
      .update({
        monthly_generations: 0,
        monthly_reset_at: nextReset.toISOString(),
      })
      .eq("id", user.id);
    currentCount = 0;
  }

  const limit = TIER_LIMITS[p.tier as Tier];
  if (currentCount >= limit) {
    return {
      error: `이번 달 생성 한도(${limit}회)에 도달했습니다. Pro로 업그레이드하면 무제한으로 생성할 수 있습니다.`,
    };
  }

  // Create project
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      genre: input.genre,
      keywords: input.keywords,
      target_age: input.target_age,
      mood: input.mood,
      episode_count: input.episode_count,
      variation_of: input.variation_of || null,
      status: "generating",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Increment monthly count
  await supabase
    .from("profiles")
    .update({ monthly_generations: currentCount + 1 })
    .eq("id", user.id);

  return { projectId: project.id };
}
```

- [ ] **Step 2: Create generation form component**

```typescript
// components/generate/generation-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createProject } from "@/lib/actions/generation";
import { GENRE_OPTIONS, MOOD_OPTIONS, TARGET_AGE_OPTIONS } from "@/types";
import type { GenerationInput } from "@/types";
import { Sparkles, X } from "lucide-react";

export function GenerationForm({ variationOf }: { variationOf?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [targetAge, setTargetAge] = useState("");
  const [episodeCount, setEpisodeCount] = useState(50);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  function addKeyword() {
    const trimmed = keywordInput.trim();
    if (trimmed && keywords.length < 5 && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!genre || !mood || !targetAge || keywords.length === 0) {
      setError("모든 필수 항목을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    const input: GenerationInput = {
      genre,
      keywords,
      target_age: targetAge,
      mood,
      episode_count: episodeCount,
      variation_of: variationOf,
    };

    const result = await createProject(input);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Navigate to project page where SSE streaming will begin
    router.push(`/projects/${result.projectId}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Genre */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">장르</CardTitle>
            <CardDescription>작품의 장르를 선택하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant={genre === g ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGenre(g)}
                >
                  {g}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mood */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">분위기</CardTitle>
            <CardDescription>작품의 전체적인 톤을 선택하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={mood === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMood(m)}
                >
                  {m}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">키워드 (최대 5개)</CardTitle>
            <CardDescription>작품의 핵심 소재나 클리셰를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="예: 계약 결혼, 냉혈 공작, 전생 기억"
                disabled={keywords.length >= 5}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addKeyword}
                disabled={keywords.length >= 5}
              >
                추가
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Target Age + Episode Count */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">세부 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>타겟 연령</Label>
              <div className="flex flex-wrap gap-2">
                {TARGET_AGE_OPTIONS.map((age) => (
                  <Button
                    key={age}
                    type="button"
                    variant={targetAge === age ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTargetAge(age)}
                  >
                    {age}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="episodeCount">원하는 화수</Label>
              <Input
                id="episodeCount"
                type="number"
                min={10}
                max={200}
                value={episodeCount}
                onChange={(e) => setEpisodeCount(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>생성 시작 중...</>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              AI 생성 시작
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create generate page**

```typescript
// app/(dashboard)/generate/page.tsx
import { GenerationForm } from "@/components/generate/generation-form";

export default function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ variation_of?: string }>;
}) {
  // Note: In Next.js 15, searchParams is a Promise
  // We handle this with a wrapper
  return <GeneratePageInner searchParamsPromise={searchParams} />;
}

async function GeneratePageInner({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ variation_of?: string }>;
}) {
  const searchParams = await searchParamsPromise;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">새 작품 생성</h1>
        <p className="text-muted-foreground">
          장르, 키워드, 분위기를 선택하면 AI가 웹소설 기획을 자동으로 생성합니다.
        </p>
      </div>
      <GenerationForm variationOf={searchParams.variation_of} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/generation.ts components/generate/generation-form.tsx app/\(dashboard\)/generate/
git commit -m "feat: add generation form with genre/mood/keyword selection and tier limits"
```

---

### Task 10: Claude API Client + System Prompts

**Files:**
- Create: `lib/claude/client.ts`
- Create: `lib/claude/prompts.ts`

- [ ] **Step 1: Create Claude client singleton**

```typescript
// lib/claude/client.ts
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return client;
}
```

- [ ] **Step 2: Create optimized system prompts for each stage**

```typescript
// lib/claude/prompts.ts
import type { GenerationInput, OutlineData } from "@/types";

export function getOutlinePrompt(input: GenerationInput): {
  system: string;
  user: string;
} {
  return {
    system: `당신은 한국 웹소설 업계에서 20년 경력의 베테랑 기획자입니다. 카카오페이지, 네이버 시리즈 등 주요 플랫폼의 트렌드와 독자 심리를 완벽히 이해합니다.

역할: 주어진 장르, 키워드, 분위기를 바탕으로 상업적으로 성공 가능한 웹소설의 3막 구조와 전체 에피소드 아웃라인을 설계합니다.

규칙:
- 반드시 JSON 형식으로만 응답하세요
- 3막 구조(기승전결 변형): 1막(도입+갈등 설정), 2막(전개+위기 고조), 3막(클라이맥스+해결)
- 각 에피소드는 끝에 다음 화를 읽고 싶게 만드는 "훅"이 있어야 합니다
- ${input.mood} 분위기에 맞는 전개를 유지하세요
- 타겟 연령 ${input.target_age}에 맞는 소재와 수위를 설정하세요
- 전체 ${input.episode_count}화 분량으로 설계하세요`,
    user: `장르: ${input.genre}
키워드: ${input.keywords.join(", ")}
분위기: ${input.mood}
타겟 연령: ${input.target_age}
총 화수: ${input.episode_count}화

위 설정으로 웹소설 아웃라인을 JSON으로 생성해주세요. 형식:
{
  "title": "작품 제목",
  "logline": "한 줄 소개 (50자 이내)",
  "act1": {
    "summary": "1막 요약 (3-4문장)",
    "episodes": [
      {
        "episode_number": 1,
        "title": "에피소드 제목",
        "summary": "에피소드 요약 (2-3문장)",
        "key_event": "핵심 사건 한 줄"
      }
    ]
  },
  "act2": { ... },
  "act3": { ... }
}`,
  };
}

export function getCharacterPrompt(
  input: GenerationInput,
  outline: OutlineData
): { system: string; user: string } {
  return {
    system: `당신은 한국 웹소설 전문 캐릭터 디자이너입니다. 독자가 감정적으로 몰입할 수 있는 입체적 캐릭터를 설계합니다.

규칙:
- 반드시 JSON 배열 형식으로만 응답하세요
- 8명의 주요 캐릭터를 생성하세요 (주인공 2명 + 조연 4명 + 빌런/갈등 요소 2명)
- 각 캐릭터는 고유한 말투, 성격, 비밀을 가져야 합니다
- 캐릭터 간 관계가 스토리 갈등을 자연스럽게 만들어야 합니다
- ${input.genre} 장르의 클리셰를 활용하되 반전 요소를 포함하세요
- 외모 묘사는 웹소설 독자가 좋아하는 구체적이고 매력적인 스타일로 작성하세요`,
    user: `작품 제목: ${outline.title}
로그라인: ${outline.logline}
장르: ${input.genre}
분위기: ${input.mood}

1막 요약: ${outline.act1.summary}
2막 요약: ${outline.act2.summary}
3막 요약: ${outline.act3.summary}

위 스토리에 맞는 8명의 캐릭터를 JSON 배열로 생성해주세요. 형식:
[
  {
    "name": "캐릭터 이름",
    "role": "역할 (여주인공/남주인공/조연/빌런 등)",
    "age": "나이 또는 나이대",
    "appearance": "외모 묘사 (3-4문장, 구체적으로)",
    "personality": "성격 (3-4문장)",
    "secret": "이 캐릭터만의 비밀 (2-3문장)",
    "motivation": "행동 동기 (2-3문장)",
    "relationships": [
      {"character": "관련 캐릭터 이름", "relationship": "관계 설명"}
    ]
  }
]`,
  };
}

export function getFirstEpisodePrompt(
  input: GenerationInput,
  outline: OutlineData,
  characters: string
): { system: string; user: string } {
  const ep1 = outline.act1.episodes[0];

  return {
    system: `당신은 한국 웹소설 전문 작가입니다. 카카오페이지, 네이버 시리즈에서 연재하는 프로 작가 수준의 1화를 작성합니다.

필수 스타일 규칙:
- 한국어 웹소설 문체를 완벽하게 구사하세요
- 짧은 문장과 긴 문장을 리듬감 있게 섞으세요
- 대화와 내면 독백을 적절히 배분하세요 (대화 40%, 묘사 30%, 내면 30%)
- 감각적 묘사를 포함하세요 (시각, 청각, 촉각)
- 1화의 마지막은 반드시 강력한 "훅"으로 끝나야 합니다 (반전, 긴장감, 궁금증 유발)
- 4,000~5,000자 분량으로 작성하세요 (공백 포함)
- ${input.mood} 분위기를 일관되게 유지하세요
- 문단 사이에 빈 줄을 넣어 가독성을 높이세요
- "~했다", "~였다" 등 과거형 서술체를 기본으로 사용하세요
- 절대 JSON이 아닌 순수 소설 텍스트로만 응답하세요`,
    user: `작품 제목: ${outline.title}
장르: ${input.genre}
분위기: ${input.mood}

1화 제목: ${ep1?.title || "첫 번째 이야기"}
1화 요약: ${ep1?.summary || outline.act1.summary}
핵심 사건: ${ep1?.key_event || "주인공의 등장"}

캐릭터 정보:
${characters}

위 설정을 바탕으로 1화 완성본을 작성해주세요. 4,000~5,000자 분량, 한국어 웹소설 문체로.`,
  };
}

export function getMetaPrompt(
  input: GenerationInput,
  outline: OutlineData
): { system: string; user: string } {
  return {
    system: `당신은 웹소설 마케팅 전문가이자 AI 아트 프롬프트 엔지니어입니다.

규칙:
- 반드시 JSON 형식으로만 응답하세요
- SEO에 최적화된 제목을 생성하세요 (카카오페이지/네이버 시리즈 검색 트렌드 반영)
- Midjourney/Flux 스타일의 영문 이미지 프롬프트를 작성하세요
- 해시태그는 한국 웹소설 독자가 실제 사용하는 태그로 생성하세요`,
    user: `작품 제목: ${outline.title}
로그라인: ${outline.logline}
장르: ${input.genre}
분위기: ${input.mood}
키워드: ${input.keywords.join(", ")}

다음 JSON 형식으로 생성해주세요:
{
  "titles": ["제목1", "제목2", "제목3", "제목4", "제목5"],
  "hashtags": ["#태그1", "#태그2", ...최소 10개],
  "description": "작품 소개글 (100-150자)",
  "cover_prompts": [
    {
      "style": "스타일 설명 (예: 동양풍 수채화)",
      "prompt": "Midjourney/Flux 영문 프롬프트 (상세하게)",
      "negative_prompt": "제외할 요소 영문"
    }
  ]
}

cover_prompts는 3개를 생성하세요. 각각 다른 아트 스타일로.`,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/claude/
git commit -m "feat: add Claude client and optimized Korean web novel system prompts"
```

---

### Task 11: Generation Pipeline + SSE Route Handler

**Files:**
- Create: `lib/claude/pipeline.ts`
- Create: `app/api/generate/route.ts`

- [ ] **Step 1: Create 4-stage generation pipeline**

```typescript
// lib/claude/pipeline.ts
import { getClaudeClient } from "./client";
import {
  getOutlinePrompt,
  getCharacterPrompt,
  getFirstEpisodePrompt,
  getMetaPrompt,
} from "./prompts";
import type {
  GenerationInput,
  GenerationStage,
  OutlineData,
  CharacterData,
  StreamEvent,
  TokenUsage,
} from "@/types";

type SendEvent = (event: StreamEvent) => void;

export async function runGenerationPipeline(
  input: GenerationInput,
  sendEvent: SendEvent
): Promise<{
  outline: OutlineData | null;
  characters: CharacterData[] | null;
  firstEpisode: string | null;
  seo: Record<string, unknown> | null;
  tokenUsage: TokenUsage;
}> {
  const client = getClaudeClient();
  const tokenUsage: TokenUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cost_estimate: 0,
  };

  let outline: OutlineData | null = null;
  let characters: CharacterData[] | null = null;
  let firstEpisode: string | null = null;
  let seo: Record<string, unknown> | null = null;

  // --- Stage 1: Outline ---
  sendEvent({ stage: "outline", status: "started" });
  const outlinePrompt = getOutlinePrompt(input);
  let outlineText = "";

  const outlineStream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: outlinePrompt.system,
    messages: [{ role: "user", content: outlinePrompt.user }],
  });

  for await (const event of outlineStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      outlineText += event.delta.text;
      sendEvent({
        stage: "outline",
        status: "streaming",
        content: event.delta.text,
      });
    }
  }

  const outlineResult = await outlineStream.finalMessage();
  tokenUsage.input_tokens += outlineResult.usage.input_tokens;
  tokenUsage.output_tokens += outlineResult.usage.output_tokens;

  try {
    outline = JSON.parse(
      outlineText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    );
  } catch {
    sendEvent({ stage: "outline", status: "error", error: "아웃라인 파싱 실패" });
    return { outline, characters, firstEpisode, seo, tokenUsage };
  }
  sendEvent({ stage: "outline", status: "completed" });

  // --- Stage 2: Characters ---
  sendEvent({ stage: "characters", status: "started" });
  const charPrompt = getCharacterPrompt(input, outline!);
  let charText = "";

  const charStream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    system: charPrompt.system,
    messages: [{ role: "user", content: charPrompt.user }],
  });

  for await (const event of charStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      charText += event.delta.text;
      sendEvent({
        stage: "characters",
        status: "streaming",
        content: event.delta.text,
      });
    }
  }

  const charResult = await charStream.finalMessage();
  tokenUsage.input_tokens += charResult.usage.input_tokens;
  tokenUsage.output_tokens += charResult.usage.output_tokens;

  try {
    characters = JSON.parse(
      charText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    );
  } catch {
    sendEvent({ stage: "characters", status: "error", error: "캐릭터 파싱 실패" });
    return { outline, characters, firstEpisode, seo, tokenUsage };
  }
  sendEvent({ stage: "characters", status: "completed" });

  // --- Stage 3: First Episode ---
  sendEvent({ stage: "first_episode", status: "started" });
  const episodePrompt = getFirstEpisodePrompt(input, outline!, charText);
  let episodeText = "";

  const episodeStream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: episodePrompt.system,
    messages: [{ role: "user", content: episodePrompt.user }],
  });

  for await (const event of episodeStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      episodeText += event.delta.text;
      sendEvent({
        stage: "first_episode",
        status: "streaming",
        content: event.delta.text,
      });
    }
  }

  const episodeResult = await episodeStream.finalMessage();
  tokenUsage.input_tokens += episodeResult.usage.input_tokens;
  tokenUsage.output_tokens += episodeResult.usage.output_tokens;
  firstEpisode = episodeText;
  sendEvent({ stage: "first_episode", status: "completed" });

  // --- Stage 4: Meta (SEO + Cover Prompts) ---
  sendEvent({ stage: "meta", status: "started" });
  const metaPrompt = getMetaPrompt(input, outline!);
  let metaText = "";

  const metaStream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    system: metaPrompt.system,
    messages: [{ role: "user", content: metaPrompt.user }],
  });

  for await (const event of metaStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      metaText += event.delta.text;
      sendEvent({
        stage: "meta",
        status: "streaming",
        content: event.delta.text,
      });
    }
  }

  const metaResult = await metaStream.finalMessage();
  tokenUsage.input_tokens += metaResult.usage.input_tokens;
  tokenUsage.output_tokens += metaResult.usage.output_tokens;

  try {
    seo = JSON.parse(
      metaText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    );
  } catch {
    sendEvent({ stage: "meta", status: "error", error: "메타 데이터 파싱 실패" });
    return { outline, characters, firstEpisode, seo, tokenUsage };
  }
  sendEvent({ stage: "meta", status: "completed" });

  // Estimate cost (Claude Sonnet pricing: $3/1M input, $15/1M output)
  tokenUsage.cost_estimate =
    (tokenUsage.input_tokens / 1_000_000) * 3 +
    (tokenUsage.output_tokens / 1_000_000) * 15;

  return { outline, characters, firstEpisode, seo, tokenUsage };
}
```

- [ ] **Step 2: Create SSE Route Handler**

```typescript
// app/api/generate/route.ts
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { runGenerationPipeline } from "@/lib/claude/pipeline";
import type { GenerationInput, StreamEvent } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for Vercel Pro

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  // Verify user owns this project
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  if (project.status !== "generating") {
    return new Response("Project already processed", { status: 400 });
  }

  // Use service client for writes (bypasses RLS for server-side updates)
  const serviceClient = await createServiceClient();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: StreamEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      try {
        const input: GenerationInput = {
          genre: project.genre,
          keywords: project.keywords,
          target_age: project.target_age,
          mood: project.mood,
          episode_count: project.episode_count,
          variation_of: project.variation_of,
        };

        const result = await runGenerationPipeline(input, sendEvent);

        // Save results to DB stage by stage is handled inline,
        // but final save ensures everything is persisted
        await serviceClient
          .from("projects")
          .update({
            title: result.outline?.title || null,
            status: "completed",
            outline: result.outline,
            characters: result.characters,
            first_episode: result.firstEpisode,
            cover_prompts: result.seo
              ? (result.seo as Record<string, unknown>).cover_prompts
              : null,
            seo: result.seo
              ? {
                  titles: (result.seo as Record<string, unknown>).titles,
                  hashtags: (result.seo as Record<string, unknown>).hashtags,
                  description: (result.seo as Record<string, unknown>)
                    .description,
                }
              : null,
            token_usage: result.tokenUsage,
          })
          .eq("id", projectId);

        sendEvent({
          stage: "meta",
          status: "completed",
          content: "ALL_DONE",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        sendEvent({ stage: "outline", status: "error", error: message });

        await serviceClient
          .from("projects")
          .update({ status: "failed" })
          .eq("id", projectId);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/claude/pipeline.ts app/api/generate/route.ts
git commit -m "feat: add 4-stage Claude generation pipeline with SSE streaming"
```

---

### Task 12: Generation Stream UI + Stage Cards

**Files:**
- Create: `components/generate/stage-card.tsx`
- Create: `components/generate/generation-stream.tsx`

- [ ] **Step 1: Create stage card component**

```typescript
// components/generate/stage-card.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, BookOpen, Users, FileText, Palette } from "lucide-react";
import type { GenerationStage } from "@/types";

const stageConfig: Record<
  GenerationStage,
  { title: string; icon: typeof BookOpen; description: string }
> = {
  outline: {
    title: "3막 구조 & 아웃라인",
    icon: BookOpen,
    description: "전체 스토리 구조와 에피소드별 아웃라인을 생성합니다",
  },
  characters: {
    title: "캐릭터 시트",
    icon: Users,
    description: "8명의 주요 캐릭터 상세 설정을 생성합니다",
  },
  first_episode: {
    title: "1화 완성본",
    icon: FileText,
    description: "4,000~5,000자의 웹소설 1화를 작성합니다",
  },
  meta: {
    title: "표지 & SEO",
    icon: Palette,
    description: "AI 표지 프롬프트와 SEO용 제목/해시태그를 생성합니다",
  },
};

interface StageCardProps {
  stage: GenerationStage;
  status: "pending" | "started" | "streaming" | "completed" | "error";
  content: string;
  error?: string;
}

export function StageCard({ stage, status, content, error }: StageCardProps) {
  const config = stageConfig[stage];
  const Icon = config.icon;

  return (
    <Card
      className={
        status === "streaming" || status === "started"
          ? "border-primary/50"
          : ""
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{config.title}</CardTitle>
          </div>
          {status === "pending" && (
            <Badge variant="outline" className="text-xs">
              대기 중
            </Badge>
          )}
          {(status === "started" || status === "streaming") && (
            <Badge variant="secondary" className="text-xs">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              생성 중
            </Badge>
          )}
          {status === "completed" && (
            <Badge className="text-xs bg-green-500/20 text-green-400 hover:bg-green-500/20">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              완료
            </Badge>
          )}
          {status === "error" && (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="mr-1 h-3 w-3" />
              실패
            </Badge>
          )}
        </div>
        {(status === "pending" || status === "started") && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </CardHeader>
      {(status === "streaming" || status === "completed") && content && (
        <CardContent>
          <div className="max-h-96 overflow-y-auto rounded-md bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
              {content}
            </pre>
          </div>
        </CardContent>
      )}
      {status === "error" && error && (
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Create generation stream component**

```typescript
// components/generate/generation-stream.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StageCard } from "./stage-card";
import type { GenerationStage, StreamEvent } from "@/types";

type StageStatus = "pending" | "started" | "streaming" | "completed" | "error";

interface StageState {
  status: StageStatus;
  content: string;
  error?: string;
}

const STAGES: GenerationStage[] = [
  "outline",
  "characters",
  "first_episode",
  "meta",
];

export function GenerationStream({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [stages, setStages] = useState<Record<GenerationStage, StageState>>(
    () =>
      Object.fromEntries(
        STAGES.map((s) => [s, { status: "pending" as StageStatus, content: "" }])
      ) as Record<GenerationStage, StageState>
  );
  const [done, setDone] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/generate?projectId=${projectId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data: StreamEvent = JSON.parse(event.data);

      if (data.content === "ALL_DONE") {
        setDone(true);
        es.close();
        router.refresh();
        return;
      }

      setStages((prev) => {
        const current = prev[data.stage];
        const updated = { ...current };

        if (data.status === "started") {
          updated.status = "started";
        } else if (data.status === "streaming") {
          updated.status = "streaming";
          updated.content += data.content || "";
        } else if (data.status === "completed") {
          updated.status = "completed";
        } else if (data.status === "error") {
          updated.status = "error";
          updated.error = data.error;
        }

        return { ...prev, [data.stage]: updated };
      });
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [projectId, router]);

  return (
    <div className="space-y-4">
      {!done && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-primary">
            AI가 작품을 생성하고 있습니다. 이 페이지를 벗어나지 마세요.
          </p>
        </div>
      )}
      {STAGES.map((stage) => (
        <StageCard
          key={stage}
          stage={stage}
          status={stages[stage].status}
          content={stages[stage].content}
          error={stages[stage].error}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/generate/stage-card.tsx components/generate/generation-stream.tsx
git commit -m "feat: add SSE generation stream UI with stage cards"
```

---

### Task 13: Project Detail Page

**Files:**
- Create: `components/project/outline-view.tsx`
- Create: `components/project/character-sheet.tsx`
- Create: `components/project/episode-view.tsx`
- Create: `components/project/download-button.tsx`
- Create: `app/(dashboard)/projects/[id]/page.tsx`

- [ ] **Step 1: Create outline view**

```typescript
// components/project/outline-view.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { OutlineData } from "@/types";

export function OutlineView({ outline }: { outline: OutlineData }) {
  const acts = [
    { label: "1막 - 도입", data: outline.act1 },
    { label: "2막 - 전개", data: outline.act2 },
    { label: "3막 - 결말", data: outline.act3 },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{outline.title}</h2>
        <p className="text-muted-foreground">{outline.logline}</p>
      </div>

      {acts.map((act) => (
        <Card key={act.label}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{act.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{act.data.summary}</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-3">
                {act.data.episodes.map((ep) => (
                  <div
                    key={ep.episode_number}
                    className="flex gap-3 rounded-lg bg-muted/50 p-3"
                  >
                    <Badge
                      variant="outline"
                      className="shrink-0 h-6 w-10 justify-center"
                    >
                      {ep.episode_number}
                    </Badge>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{ep.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ep.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create character sheet**

```typescript
// components/project/character-sheet.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CharacterData } from "@/types";

export function CharacterSheet({ character }: { character: CharacterData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{character.name}</CardTitle>
          <Badge variant="secondary">{character.role}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{character.age}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-medium text-muted-foreground mb-1">외모</p>
          <p>{character.appearance}</p>
        </div>
        <Separator />
        <div>
          <p className="font-medium text-muted-foreground mb-1">성격</p>
          <p>{character.personality}</p>
        </div>
        <Separator />
        <div>
          <p className="font-medium text-muted-foreground mb-1">비밀</p>
          <p>{character.secret}</p>
        </div>
        <Separator />
        <div>
          <p className="font-medium text-muted-foreground mb-1">동기</p>
          <p>{character.motivation}</p>
        </div>
        {character.relationships.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="font-medium text-muted-foreground mb-1">관계</p>
              <div className="space-y-1">
                {character.relationships.map((rel, i) => (
                  <p key={i}>
                    <span className="font-medium">{rel.character}</span>
                    {" — "}
                    {rel.relationship}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create episode view**

```typescript
// components/project/episode-view.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EpisodeView({ content }: { content: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">1화 완성본</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-invert max-w-none">
          {content.split("\n\n").map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed mb-4">
              {paragraph}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create download button**

```typescript
// components/project/download-button.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import type { Project } from "@/types";

function generateMarkdown(project: Project): string {
  let md = `# ${project.outline?.title || project.title || "제목 없음"}\n\n`;
  md += `> ${project.outline?.logline || ""}\n\n`;
  md += `**장르:** ${project.genre} | **분위기:** ${project.mood} | **타겟:** ${project.target_age}\n\n`;
  md += `**키워드:** ${project.keywords.join(", ")}\n\n`;
  md += `---\n\n`;

  if (project.outline) {
    md += `## 3막 구조\n\n`;
    const acts = [
      { label: "1막", data: project.outline.act1 },
      { label: "2막", data: project.outline.act2 },
      { label: "3막", data: project.outline.act3 },
    ];
    for (const act of acts) {
      md += `### ${act.label}\n\n${act.data.summary}\n\n`;
      for (const ep of act.data.episodes) {
        md += `- **${ep.episode_number}화: ${ep.title}** — ${ep.summary}\n`;
      }
      md += `\n`;
    }
  }

  if (project.characters) {
    md += `## 캐릭터\n\n`;
    for (const char of project.characters) {
      md += `### ${char.name} (${char.role})\n\n`;
      md += `- **나이:** ${char.age}\n`;
      md += `- **외모:** ${char.appearance}\n`;
      md += `- **성격:** ${char.personality}\n`;
      md += `- **비밀:** ${char.secret}\n`;
      md += `- **동기:** ${char.motivation}\n\n`;
    }
  }

  if (project.first_episode) {
    md += `## 1화 완성본\n\n${project.first_episode}\n\n`;
  }

  if (project.seo) {
    md += `## SEO\n\n`;
    md += `**제목 후보:** ${project.seo.titles.join(" | ")}\n\n`;
    md += `**해시태그:** ${project.seo.hashtags.join(" ")}\n\n`;
  }

  if (project.cover_prompts) {
    md += `## 표지 프롬프트\n\n`;
    for (const cp of project.cover_prompts) {
      md += `### ${cp.style}\n\n`;
      md += `**Prompt:** ${cp.prompt}\n\n`;
      md += `**Negative:** ${cp.negative_prompt}\n\n`;
    }
  }

  md += `\n---\n*생성된 모든 콘텐츠의 저작권은 사용자에게 100% 귀속됩니다.*\n`;

  return md;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadButton({ project }: { project: Project }) {
  const title = project.outline?.title || project.title || "작품";

  function handleDownloadMD() {
    const md = generateMarkdown(project);
    downloadFile(md, `${title}.md`, "text/markdown;charset=utf-8");
  }

  function handleDownloadTXT() {
    const md = generateMarkdown(project);
    // Simple MD to plain text: strip markdown syntax
    const txt = md
      .replace(/^#{1,3}\s/gm, "")
      .replace(/\*\*/g, "")
      .replace(/^>\s/gm, "")
      .replace(/^-\s/gm, "  - ");
    downloadFile(txt, `${title}.txt`, "text/plain;charset=utf-8");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          다운로드
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleDownloadMD}>
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadTXT}>
          텍스트 (.txt)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Create project detail page**

```typescript
// app/(dashboard)/projects/[id]/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/actions/projects";
import { GenerationStream } from "@/components/generate/generation-stream";
import { OutlineView } from "@/components/project/outline-view";
import { CharacterSheet } from "@/components/project/character-sheet";
import { EpisodeView } from "@/components/project/episode-view";
import { DownloadButton } from "@/components/project/download-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { OutlineData, CharacterData, CoverPrompt, SeoData } from "@/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    redirect("/");
  }

  // If still generating, show the stream UI
  if (project.status === "generating") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">생성 중...</h1>
        </div>
        <GenerationStream projectId={id} />
      </div>
    );
  }

  const outline = project.outline as OutlineData | null;
  const characters = project.characters as CharacterData[] | null;
  const coverPrompts = project.cover_prompts as CoverPrompt[] | null;
  const seo = project.seo as SeoData | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {outline?.title || project.title || "제목 없음"}
            </h1>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{project.genre}</Badge>
              <Badge variant="outline">{project.mood}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/generate?variation_of=${project.id}`}>
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 생성
            </Link>
          </Button>
          <DownloadButton project={project} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        생성된 모든 콘텐츠의 저작권은 사용자에게 100% 귀속됩니다.
      </p>

      {/* Tabs */}
      <Tabs defaultValue="outline">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="outline">아웃라인</TabsTrigger>
          <TabsTrigger value="characters">캐릭터</TabsTrigger>
          <TabsTrigger value="episode">1화</TabsTrigger>
          <TabsTrigger value="meta">표지 & SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="outline" className="mt-4">
          {outline ? (
            <OutlineView outline={outline} />
          ) : (
            <p className="text-muted-foreground">아웃라인 데이터가 없습니다.</p>
          )}
        </TabsContent>

        <TabsContent value="characters" className="mt-4">
          {characters ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {characters.map((char, i) => (
                <CharacterSheet key={i} character={char} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">캐릭터 데이터가 없습니다.</p>
          )}
        </TabsContent>

        <TabsContent value="episode" className="mt-4">
          {project.first_episode ? (
            <EpisodeView content={project.first_episode} />
          ) : (
            <p className="text-muted-foreground">1화 데이터가 없습니다.</p>
          )}
        </TabsContent>

        <TabsContent value="meta" className="mt-4 space-y-4">
          {seo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SEO 제목 후보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {seo.titles.map((t, i) => (
                  <p key={i} className="text-sm">
                    {i + 1}. {t}
                  </p>
                ))}
                <div className="flex flex-wrap gap-1 mt-3">
                  {seo.hashtags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {coverPrompts && (
            <div className="space-y-4">
              <h3 className="font-semibold">표지 이미지 프롬프트</h3>
              {coverPrompts.map((cp, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{cp.style}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">
                        Prompt
                      </p>
                      <p className="rounded bg-muted p-2 text-xs font-mono">
                        {cp.prompt}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">
                        Negative Prompt
                      </p>
                      <p className="rounded bg-muted p-2 text-xs font-mono">
                        {cp.negative_prompt}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/project/ app/\(dashboard\)/projects/
git commit -m "feat: add project detail page with outline, characters, episode, and meta tabs"
```

---

### Task 14: Settings Page

**Files:**
- Create: `app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create settings page**

```typescript
// app/(dashboard)/settings/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Profile } from "@/types";
import { TIER_LIMITS } from "@/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const p = profile as Profile;
  const limit = TIER_LIMITS[p.tier];
  const remaining =
    limit === Infinity ? "무제한" : `${limit - p.monthly_generations}회 남음`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">계정 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">이메일</span>
            <span>{p.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">닉네임</span>
            <span>{p.display_name || "-"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">구독 플랜</CardTitle>
          <CardDescription>현재 이용 중인 플랜과 사용량</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={p.tier === "pro" ? "default" : "secondary"}
                className="text-sm"
              >
                {p.tier === "free" ? "Free" : "Pro"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {p.tier === "free"
                  ? "월 3회 생성"
                  : "무제한 생성"}
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">이번 달 사용량</span>
              <span>
                {p.monthly_generations}회 사용 / {remaining}
              </span>
            </div>
            {p.tier === "free" && (
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${Math.min((p.monthly_generations / 3) * 100, 100)}%`,
                  }}
                />
              </div>
            )}
          </div>

          {p.tier === "free" && (
            <>
              <Separator />
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h4 className="font-medium mb-1">Pro로 업그레이드</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  무제한 생성, 우선 처리, 향후 추가 기능 우선 제공
                </p>
                <Button disabled>
                  곧 출시 예정 (Toss Payments 연동 준비 중)
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/settings/
git commit -m "feat: add settings page with plan info and usage tracking"
```

---

### Task 15: Landing Page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Create landing page**

```typescript
// app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  BookOpen,
  Users,
  FileText,
  Palette,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    icon: BookOpen,
    title: "3막 구조 & 아웃라인",
    description: "전체 스토리 구조와 에피소드별 아웃라인을 자동 설계",
  },
  {
    icon: Users,
    title: "캐릭터 시트 8명",
    description: "외모, 성격, 비밀, 관계도까지 상세한 캐릭터 설정",
  },
  {
    icon: FileText,
    title: "1화 완성본",
    description: "4,000~5,000자의 프로급 한국어 웹소설 문체",
  },
  {
    icon: Palette,
    title: "표지 프롬프트 & SEO",
    description: "Midjourney/Flux 프롬프트 + 검색 최적화 제목",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">AI 로판 팩토리</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild>
                <Link href="/">
                  대시보드
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">로그인</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">무료로 시작</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          <Sparkles className="mr-1 h-3 w-3" />
          AI 기반 웹소설 기획 도구
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          장르와 키워드만 입력하면
          <br />
          <span className="text-primary">완성된 웹소설 기획</span>이 나옵니다
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          3막 구조, 캐릭터 시트, 1화 완성본, 표지 프롬프트까지.
          AI가 카카오페이지·네이버 시리즈 수준의 웹소설 기획을 자동으로 생성합니다.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button size="lg" asChild>
            <Link href={user ? "/generate" : "/signup"}>
              <Sparkles className="mr-2 h-5 w-5" />
              무료로 시작하기
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          회원가입 후 매월 3회 무료 생성
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold mb-10">
          한 번의 생성으로 받는 결과물
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <f.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="text-center">
            <Zap className="mx-auto h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold">실시간 스트리밍</h3>
            <p className="text-sm text-muted-foreground mt-1">
              생성 과정을 실시간으로 확인
            </p>
          </div>
          <div className="text-center">
            <Shield className="mx-auto h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold">100% 저작권 귀속</h3>
            <p className="text-sm text-muted-foreground mt-1">
              생성된 콘텐츠는 모두 작가님 것
            </p>
          </div>
          <div className="text-center">
            <BookOpen className="mx-auto h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold">플랫폼 투고 최적화</h3>
            <p className="text-sm text-muted-foreground mt-1">
              카카오페이지/시리즈 트렌드 반영
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          <p>AI 로판 팩토리 &copy; 2026. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
```

Note: The landing page is a Server Component and checks for auth status. Authenticated users see "대시보드" button, unauthenticated see login/signup.

However, the landing page is at `app/page.tsx` but the dashboard is at `app/(dashboard)/page.tsx`. The `(dashboard)` route group uses the dashboard layout. Since `app/page.tsx` is outside the route group, it will use the root layout only (no sidebar/header), which is correct for a landing page.

For authenticated users, clicking "대시보드" should go to the dashboard. We need to make the dashboard route separate from `/`. Update the sidebar links and dashboard to use `/dashboard`:

Actually, looking at the current structure: `app/(dashboard)/page.tsx` maps to `/` because `(dashboard)` is a route group (parentheses = no URL segment). This means the landing page (`app/page.tsx`) and dashboard (`app/(dashboard)/page.tsx`) both map to `/`, which is a conflict.

**Fix:** Move the dashboard to `/dashboard` route:
- Rename `app/(dashboard)/page.tsx` → keep the route group but adjust the landing page approach

The simplest fix: make the landing page redirect authenticated users to `/dashboard`, and move the dashboard content to `app/(dashboard)/dashboard/page.tsx`. But that changes the URL structure.

Better approach: Use `app/page.tsx` as the landing page for unauthenticated users, and redirect authenticated users from there. The dashboard becomes `app/(dashboard)/page.tsx` which is still `/`. We resolve the conflict by **removing `app/page.tsx`** and handling landing vs. dashboard logic inside `app/(dashboard)/page.tsx`, but that forces the sidebar layout on the landing page.

**Cleanest fix:**
- Landing page: `app/(marketing)/page.tsx` (route group, no layout)
- Dashboard: `app/(dashboard)/dashboard/page.tsx` → `/dashboard`
- Update all sidebar links accordingly

Let me update the plan to use `/dashboard` as the dashboard path:

**Updated route structure:**
```
app/
  page.tsx                          # Landing page (public, root layout only)
  (auth)/login/page.tsx
  (auth)/signup/page.tsx
  (dashboard)/
    layout.tsx                      # Auth-gated + sidebar
    dashboard/page.tsx              # /dashboard (project list)
    generate/page.tsx               # /generate
    projects/[id]/page.tsx          # /projects/:id
    settings/page.tsx               # /settings
```

Update sidebar `navItems[0].href` from `/` to `/dashboard`. Update redirects from `/` to `/dashboard`. This avoids the route conflict entirely.

This correction applies to Tasks 7, 8, and 15. The code in those tasks should use `/dashboard` instead of `/` for the dashboard route.

- [ ] **Step 2: Update sidebar navItems in components/layout/sidebar.tsx**

Change the first nav item:
```typescript
{ href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
```

And the `isActive` logic:
```typescript
const isActive = pathname.startsWith(item.href);
```

Apply the same change in `components/layout/header.tsx`.

- [ ] **Step 3: Move dashboard page to app/(dashboard)/dashboard/page.tsx**

Rename `app/(dashboard)/page.tsx` to `app/(dashboard)/dashboard/page.tsx`. All content stays the same.

- [ ] **Step 4: Update middleware redirect**

In `lib/supabase/middleware.ts`, redirect authenticated users from auth pages to `/dashboard` instead of `/`:

```typescript
if (user && (request.nextUrl.pathname.startsWith("/login") || ...)) {
  url.pathname = "/dashboard";
}
```

- [ ] **Step 5: Update auth actions redirect**

In `lib/actions/auth.ts`, change `redirect("/")` to `redirect("/dashboard")` for login and signup.

- [ ] **Step 6: Commit**

```bash
git add app/ components/layout/ lib/
git commit -m "feat: add landing page and fix route structure (landing=/, dashboard=/dashboard)"
```

---

### Task 16: Toss Payments Webhook Placeholder

**Files:**
- Create: `app/api/webhooks/toss/route.ts`

- [ ] **Step 1: Create placeholder webhook**

```typescript
// app/api/webhooks/toss/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // TODO: Toss Payments webhook integration
  // 1. Verify webhook signature
  // 2. Parse payment event
  // 3. Update user tier in profiles table
  // 4. Return 200

  const body = await request.json();

  console.log("Toss Payments webhook received:", body);

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/webhooks/
git commit -m "feat: add Toss Payments webhook placeholder"
```

---

## Self-Review Checklist

1. **Spec coverage:** All requirements from the spec are covered:
   - Supabase Auth (Task 4, 6) ✅
   - Dashboard with history (Task 8) ✅
   - Generation form with all inputs (Task 9) ✅
   - 4-stage pipeline with streaming (Task 10, 11, 12) ✅
   - Character sheets, outline, episode, cover prompts, SEO (Task 10 prompts, Task 13 views) ✅
   - Variation/re-generate (Task 9 form + Task 13 button) ✅
   - Toss Payments placeholder (Task 16) ✅
   - Dark mode, Korean, mobile responsive (Task 1, 5, all components) ✅
   - Tier limits and token tracking (Task 9 action, Task 11 pipeline) ✅
   - Download TXT/MD (Task 13) ✅
   - RLS security (Task 3) ✅

2. **Placeholder scan:** No TBDs or TODOs in implementation code. Only the Toss webhook has a TODO which is explicitly a placeholder per spec.

3. **Type consistency:** All types reference `types/index.ts`. `GenerationInput`, `StreamEvent`, `OutlineData`, `CharacterData`, `CoverPrompt`, `SeoData` are used consistently across actions, pipeline, and UI components.
