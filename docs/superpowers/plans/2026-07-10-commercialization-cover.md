# 상용화 준비 + 표지 생성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결제/구독 시스템의 치명적 버그 수정, 상용화 필수 요소(에러 UI·약관·계정 관리) 추가, Pro 전용 표지 이미지 생성 기능 구현.

**Architecture:** 기존 Next.js 16 App Router + Supabase + Toss Payments 구조 유지. 쿼터는 Postgres RPC로 원자화(선소비+실패 시 환불). 구독 갱신은 `past_due` 유예 상태를 추가한 상태 머신으로 재작성. 표지는 Gemini 이미지 모델 → Supabase Storage 업로드 → `projects.cover_image_url` 저장.

**Tech Stack:** Next.js 16, Supabase (RLS + service role + Storage), Toss Payments 빌링키, `@google/genai` (`gemini-2.5-flash-image`)

## Global Constraints

- 무료 생성 한도는 **평생 3회** (월간 리셋 없음). `TIER_LIMITS.free = 3` 유지.
- Pro 표지 생성 한도: **월 20회** (lazy 리셋).
- Pro 가격: 9,900원/월. `PRO_AMOUNT = 9900` 유지.
- 갱신 유예기간: **3일** (`past_due` 상태).
- Toss는 CDN 스크립트(`js.tosspayments.com/v2/standard`)로 로드 — npm 패키지 금지 (Vercel 빌드 에러).
- 한국어 UI 문구. 입력 `onKeyDown`은 `!e.nativeEvent.isComposing` 체크 (한글 IME).
- 테스트 프레임워크 없음 — 각 태스크 검증은 `npm run build` + `npm run lint` + 수동 확인.
- 마이그레이션 SQL은 `supabase/migrations/`에 파일 추가. 적용은 Supabase 대시보드 SQL 편집기 또는 `supabase db push` (실행자는 파일 작성까지만, 적용 여부는 사용자에게 보고).
- **AGENTS.md 준수**: Next.js 16은 훈련 데이터와 다를 수 있음 — API 확신이 없으면 `node_modules/next/dist/docs/` 확인.
- 커밋 메시지는 기존 컨벤션(`feat:`/`fix:` + 한국어 요약).

---

# 1단계 — 결제/보안 크리티컬

### Task 1: 마이그레이션 005 — customer_key + 쿼터 RPC

**Files:**
- Create: `supabase/migrations/005_billing_fixes.sql`

**Interfaces:**
- Produces: `subscriptions.customer_key text`, RPC `consume_generation(p_user_id uuid, p_limit int) returns boolean`, RPC `refund_generation(p_user_id uuid) returns void`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 005_billing_fixes.sql

-- 빌링키 발급에 사용된 Toss customerKey 저장 (갱신 결제에 필수)
alter table subscriptions add column customer_key text;

-- 생성 쿼터 원자적 소비: free 티어는 한도 체크와 증가를 단일 UPDATE로 수행
create or replace function consume_generation(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update profiles
  set monthly_generations = monthly_generations + 1
  where id = p_user_id
    and (tier <> 'free' or monthly_generations < p_limit);
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- 생성 실패 시 쿼터 환불
create or replace function refund_generation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set monthly_generations = greatest(monthly_generations - 1, 0)
  where id = p_user_id;
end;
$$;

-- RPC는 service role 전용 (anon/authenticated 직접 호출 차단)
revoke execute on function consume_generation(uuid, int) from public, anon, authenticated;
revoke execute on function refund_generation(uuid) from public, anon, authenticated;
```

- [ ] **Step 2: 빌드 확인** — `npm run build` (SQL 파일은 빌드에 영향 없음을 확인만)

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/005_billing_fixes.sql
git commit -m "feat: 구독 customer_key 컬럼 + 생성 쿼터 원자화 RPC (마이그레이션 005)"
```

---

### Task 2: customerKey를 user.id로 고정

**Files:**
- Modify: `components/pricing/toss-checkout.tsx`
- Modify: `components/pricing/pricing-cards.tsx`
- Modify: `app/(dashboard)/pricing/page.tsx`

**Interfaces:**
- Produces: `TossCheckout({ customerKey }: { customerKey: string })`, `PricingCards`에 `customerKey?: string` prop 추가
- Consumes: 없음

- [ ] **Step 1: `toss-checkout.tsx` — prop으로 customerKey 수신**

`export function TossCheckout() {` 를 다음으로 교체하고, `crypto.randomUUID()` 부분을 prop으로 대체:

```tsx
export function TossCheckout({ customerKey }: { customerKey: string }) {
```

```tsx
      const payment = tossPayments.payment({
        customerKey,
      });
```

또한 클라이언트 키 미설정 시 크래시 방지 — `handleCheckout` 시작부에 추가:

```tsx
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        throw new Error("결제 설정이 완료되지 않았습니다. 관리자에게 문의하세요.");
      }
      const tossPayments = window.TossPayments!(clientKey);
```

- [ ] **Step 2: `pricing-cards.tsx` — prop 전달**

```tsx
export function PricingCards({
  currentTier,
  hasSubscription,
  customerKey,
}: {
  currentTier: Tier;
  hasSubscription: boolean;
  customerKey?: string;
}) {
```

`<TossCheckout />` 렌더 부분을:

```tsx
          ) : customerKey ? (
            <TossCheckout customerKey={customerKey} />
          ) : (
            <Button className="w-full" render={<Link href="/login" />}>
              로그인 후 구독하기
            </Button>
          )}
```

상단에 `import Link from "next/link";` 추가.

- [ ] **Step 3: `pricing/page.tsx` — user.id 전달**

```tsx
      <PricingCards currentTier={tier} hasSubscription={hasSubscription} customerKey={user?.id} />
```

- [ ] **Step 4: 검증** — `npm run build && npm run lint` 통과 확인

- [ ] **Step 5: 커밋**

```bash
git add components/pricing/ "app/(dashboard)/pricing/page.tsx"
git commit -m "fix: Toss customerKey를 user.id로 고정 (갱신 결제 실패 근본 원인)"
```

---

### Task 3: 결제 성공 라우트 견고화

**Files:**
- Modify: `app/api/payments/billing-key/success/route.ts` (전체 교체)

**Interfaces:**
- Consumes: Task 1의 `subscriptions.customer_key` 컬럼
- Produces: `/pricing?error=<code>` 에러 코드: `missing_params`, `already_subscribed`, `billing_key_failed`, `payment_failed`, `sync_failed`, `processing_failed` (Task 5가 소비)

- [ ] **Step 1: 파일 전체를 다음으로 교체**

핵심 변경: ① `redirect()`를 try 밖으로(에러 코드를 변수에 담고 마지막에 리다이렉트), ② 기존 active/past_due 구독 시 중복 결제 차단, ③ Toss 호출에 `Idempotency-Key`, ④ orderId를 UUID 기반으로, ⑤ DB 쓰기 3건 에러 체크(구독 먼저), ⑥ 실패 결제도 payments에 기록, ⑦ customer_key 저장.

```ts
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;
const PRO_AMOUNT = 9900;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authKey = searchParams.get("authKey");
  const customerKey = searchParams.get("customerKey");

  if (!authKey || !customerKey) {
    redirect("/pricing?error=missing_params");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // customerKey는 반드시 본인 user.id여야 함 (Task 2에서 고정)
  if (customerKey !== user.id) {
    redirect("/pricing?error=missing_params");
  }

  const serviceClient = await createServiceClient();

  // 이미 유효한 구독이 있으면 중복 결제 차단
  const { data: existingSub } = await serviceClient
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .in("status", ["active", "past_due"])
    .maybeSingle();

  if (existingSub) {
    redirect("/pricing?error=already_subscribed");
  }

  const orderId = `pro_${user.id.slice(0, 8)}_${crypto.randomUUID()}`;
  const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");

  let errorCode: string | null = null;

  try {
    // 1. 빌링키 발급
    const billingRes = await fetch(
      "https://api.tosspayments.com/v1/billing/authorizations/issue",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `issue_${authKey}`,
        },
        body: JSON.stringify({ authKey, customerKey }),
      }
    );

    if (!billingRes.ok) {
      const err = await billingRes.json();
      console.error("Billing key issue failed:", err);
      errorCode = "billing_key_failed";
    } else {
      const billingData = await billingRes.json();
      const billingKey = billingData.billingKey;

      // 2. 빌링키로 즉시 첫 결제
      const paymentRes = await fetch(
        `https://api.tosspayments.com/v1/billing/${billingKey}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json",
            "Idempotency-Key": orderId,
          },
          body: JSON.stringify({
            customerKey,
            amount: PRO_AMOUNT,
            orderId,
            orderName: "AI 로판 팩토리 Pro 월 구독",
            customerEmail: user.email,
          }),
        }
      );

      if (!paymentRes.ok) {
        const err = await paymentRes.json();
        console.error("First payment failed:", err);
        // 실패 결제도 기록 (감사 추적)
        await serviceClient.from("payments").insert({
          user_id: user.id,
          order_id: orderId,
          amount: PRO_AMOUNT,
          status: "failed",
        });
        errorCode = "payment_failed";
      } else {
        const paymentData = await paymentRes.json();

        // 3. DB 반영 — 구독이 가장 중요하므로 먼저, 각 쓰기 에러 체크
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        if (periodEnd.getDate() < now.getDate()) periodEnd.setDate(0);

        const { error: subError } = await serviceClient
          .from("subscriptions")
          .upsert(
            {
              user_id: user.id,
              billing_key: billingKey,
              customer_key: customerKey,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            },
            { onConflict: "user_id" }
          );

        const { error: tierError } = await serviceClient
          .from("profiles")
          .update({ tier: "pro" })
          .eq("id", user.id);

        const { error: paymentError } = await serviceClient
          .from("payments")
          .insert({
            user_id: user.id,
            order_id: orderId,
            payment_key: paymentData.paymentKey,
            amount: PRO_AMOUNT,
            status: "paid",
            method: paymentData.method,
          });

        if (subError || tierError) {
          // 돈은 빠졌는데 반영 실패 — 반드시 수동 복구 가능하도록 상세 로그
          console.error(
            `[CRITICAL] 결제 성공했으나 DB 반영 실패. user=${user.id} orderId=${orderId} paymentKey=${paymentData.paymentKey}`,
            { subError, tierError }
          );
          errorCode = "sync_failed";
        } else if (paymentError) {
          // 결제 기록만 실패 — 구독은 정상이므로 성공 처리하되 로그
          console.error(
            `[WARN] 결제 기록 저장 실패. user=${user.id} orderId=${orderId}`,
            paymentError
          );
        }
      }
    }
  } catch (error) {
    console.error("Payment processing error:", error);
    errorCode = "processing_failed";
  }

  if (errorCode) {
    redirect(`/pricing?error=${errorCode}`);
  }
  redirect("/dashboard?upgraded=true");
}
```

- [ ] **Step 2: 검증** — `npm run build && npm run lint`

- [ ] **Step 3: 커밋**

```bash
git add app/api/payments/billing-key/success/route.ts
git commit -m "fix: 결제 성공 라우트 견고화 — redirect 삼킴 수정, DB 쓰기 검증, 멱등키, 중복 구독 차단"
```

---

### Task 4: 갱신 크론 재작성 (유예기간 + 멱등성)

**Files:**
- Modify: `app/api/cron/billing/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `subscriptions.customer_key` (Task 1)
- Produces: 구독 상태 머신 — `active` → (결제 실패) → `past_due` → (3일 초과) → `failed`+강등, `cancelled` → (만료) → `expired`+강등. Task 5의 설정 화면 문구와 정합.

- [ ] **Step 1: 파일 전체를 다음으로 교체**

핵심 변경: ① CRON_SECRET 미설정 시 무조건 거부, ② `active`+`past_due` 모두 갱신 시도, ③ 기간은 기존 `current_period_end` 기준 +1개월(말일 클램프), ④ orderId를 결정적으로(`renew_구독ID_기간말일`) 만들고 멱등키로 사용 — 부분 실패 후 재실행 시 이중 청구 방지, ⑤ 실패 시 3일 유예(past_due) 후 강등, 네트워크 예외도 동일 경로, ⑥ cancelled 만료 처리 후 `expired` 마킹, ⑦ 쿼리 limit.

```ts
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;
const PRO_AMOUNT = 9900;
const GRACE_DAYS = 3;
const BATCH_LIMIT = 100;

function addOneMonth(d: Date): Date {
  const r = new Date(d);
  const day = r.getDate();
  r.setMonth(r.getMonth() + 1);
  if (r.getDate() < day) r.setDate(0); // 1/31 → 2/28 말일 클램프
  return r;
}

export async function GET(request: Request) {
  // CRON_SECRET 미설정 시에도 무조건 거부 — 결제를 트리거하는 엔드포인트
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // 만료된 활성/유예 구독 조회
  const { data: expiredSubs, error: queryError } = await serviceClient
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", nowIso)
    .limit(BATCH_LIMIT);

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const tossAuth = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const sub of expiredSubs ?? []) {
    const periodEnd = new Date(sub.current_period_end);
    // 결정적 orderId: 같은 기간의 갱신 재시도는 같은 orderId → Toss 멱등키로 이중 청구 방지
    const periodTag = sub.current_period_end.slice(0, 10).replace(/-/g, "");
    const orderId = `renew_${sub.id.slice(0, 8)}_${periodTag}`;

    let charged = false;
    let failMessage = "";

    try {
      const res = await fetch(
        `https://api.tosspayments.com/v1/billing/${sub.billing_key}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${tossAuth}`,
            "Content-Type": "application/json",
            "Idempotency-Key": orderId,
          },
          body: JSON.stringify({
            customerKey: sub.customer_key ?? sub.user_id,
            amount: PRO_AMOUNT,
            orderId,
            orderName: "AI 로판 팩토리 Pro 월 구독 갱신",
          }),
        }
      );

      if (res.ok) {
        charged = true;
        const paymentData = await res.json();
        const newStart = periodEnd;
        const newEnd = addOneMonth(periodEnd);

        // 기간 갱신이 최우선 — 실패 시 다음 실행에서 같은 orderId로 재시도(멱등)
        const { error: renewError } = await serviceClient
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: newStart.toISOString(),
            current_period_end: newEnd.toISOString(),
          })
          .eq("id", sub.id);

        if (renewError) {
          console.error(
            `[CRITICAL] 갱신 결제 성공했으나 기간 갱신 실패. sub=${sub.id} orderId=${orderId}`,
            renewError
          );
        }

        // upsert: 재시도로 같은 orderId가 이미 있으면 무시
        await serviceClient.from("payments").upsert(
          {
            user_id: sub.user_id,
            order_id: orderId,
            payment_key: paymentData.paymentKey,
            amount: PRO_AMOUNT,
            status: "paid",
            method: paymentData.method,
          },
          { onConflict: "order_id", ignoreDuplicates: true }
        );
      } else {
        const err = await res.json();
        failMessage = err.message ?? "unknown";
      }
    } catch (error) {
      failMessage = error instanceof Error ? error.message : "Unknown error";
    }

    if (charged) {
      results.push({ userId: sub.user_id, success: true });
    } else {
      // 결제 실패: 3일 유예 후 강등. 네트워크 예외도 동일 경로.
      const graceEnd = new Date(periodEnd);
      graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);

      if (now > graceEnd) {
        await serviceClient
          .from("subscriptions")
          .update({ status: "failed" })
          .eq("id", sub.id);
        await serviceClient
          .from("profiles")
          .update({ tier: "free" })
          .eq("id", sub.user_id);
      } else if (sub.status !== "past_due") {
        await serviceClient
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("id", sub.id);
      }

      results.push({ userId: sub.user_id, success: false, error: failMessage });
    }
  }

  // 해지된 구독 중 기간 만료 → 강등 + expired 마킹 (재처리 방지)
  const { data: cancelledExpired } = await serviceClient
    .from("subscriptions")
    .select("id, user_id")
    .eq("status", "cancelled")
    .lte("current_period_end", nowIso)
    .limit(BATCH_LIMIT);

  for (const sub of cancelledExpired ?? []) {
    await serviceClient
      .from("profiles")
      .update({ tier: "free" })
      .eq("id", sub.user_id);
    await serviceClient
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("id", sub.id);
  }

  return NextResponse.json({
    message: "Billing cron completed",
    renewed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    downgraded: cancelledExpired?.length || 0,
    results,
  });
}
```

- [ ] **Step 2: 검증** — `npm run build && npm run lint`. 로컬 dev 서버 켜고:

```bash
curl -i http://localhost:3000/api/cron/billing            # 기대: 401
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/billing  # 기대: 200 JSON
```

- [ ] **Step 3: 커밋**

```bash
git add app/api/cron/billing/route.ts
git commit -m "fix: 갱신 크론 재작성 — 시크릿 필수화, 3일 유예, 멱등 갱신, expired 마킹"
```

---

### Task 5: 결제 결과 유저 표시 + 구독 상태 문구

**Files:**
- Modify: `app/(dashboard)/pricing/page.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `components/settings/subscription-manager.tsx` (past_due 문구)

**Interfaces:**
- Consumes: Task 3의 에러 코드, Task 4의 `past_due` 상태

- [ ] **Step 1: `pricing/page.tsx` — searchParams 에러 배너**

함수 시그니처와 본문 상단을 다음으로 변경 (Next.js 16: `searchParams`는 Promise):

```tsx
const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "결제 정보가 올바르지 않습니다. 다시 시도해주세요.",
  already_subscribed: "이미 구독 중입니다. 설정에서 구독을 관리하세요.",
  billing_key_failed: "카드 등록에 실패했습니다. 카드 정보를 확인 후 다시 시도해주세요.",
  payment_failed: "결제에 실패했습니다. 카드 한도나 잔액을 확인해주세요.",
  sync_failed: "결제는 완료됐지만 반영이 지연되고 있습니다. 잠시 후에도 Pro가 아니라면 문의해주세요.",
  processing_failed: "결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.processing_failed
    : null;
```

렌더 부분, 제목 아래에:

```tsx
      {errorMessage && (
        <div className="mx-auto max-w-3xl rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
```

- [ ] **Step 2: `dashboard/page.tsx` — 업그레이드 성공 배너**

```tsx
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { upgraded } = await searchParams;
```

렌더 최상단(`<div className="space-y-6">` 바로 안)에:

```tsx
      {upgraded === "true" && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          🎉 Pro 구독이 시작됐습니다! 이제 무제한으로 생성할 수 있어요.
        </div>
      )}
```

- [ ] **Step 3: `subscription-manager.tsx` — past_due 표시**

파일을 읽고, 상태별 분기(`active`/`cancelled` 처리하는 곳)에 `past_due` 케이스 추가:

```tsx
{subscription.status === "past_due" && (
  <p className="text-sm text-destructive">
    결제에 실패해 재시도 중입니다. 카드 정보를 확인해주세요. 3일 내 결제가 완료되지 않으면 Free로 전환됩니다.
  </p>
)}
```

- [ ] **Step 4: 검증** — `npm run build && npm run lint`. dev 서버에서 `/pricing?error=payment_failed` 접속 → 배너 확인, `/dashboard?upgraded=true` → 배너 확인.

- [ ] **Step 5: 커밋**

```bash
git add "app/(dashboard)/pricing/page.tsx" "app/(dashboard)/dashboard/page.tsx" components/settings/subscription-manager.tsx
git commit -m "feat: 결제 에러/성공 배너 표시 + past_due 상태 안내"
```

---

### Task 6: 쿼터 원자화 + 서버 입력 검증

**Files:**
- Modify: `app/api/generate/route.ts`
- Modify: `app/api/generate/episode/route.ts`
- Modify: `lib/actions/generation.ts`

**Interfaces:**
- Consumes: Task 1의 `consume_generation`/`refund_generation` RPC
- Produces: 없음

- [ ] **Step 1: `app/api/generate/route.ts` — 선소비/환불 방식으로 변경**

`const currentGenerations = profile?.monthly_generations ?? 0;` 줄을 삭제하고, `const serviceClient = await createServiceClient();` 바로 뒤(스트림 생성 전)에 추가:

```ts
  // 쿼터 원자적 선소비 (실패 시 아래에서 환불) — 동시 요청 이중 소비 차단
  const { data: consumed, error: consumeError } = await serviceClient.rpc(
    "consume_generation",
    { p_user_id: user.id, p_limit: 3 }
  );

  if (consumeError || !consumed) {
    return new Response(
      "무료 체험 3회를 모두 사용했습니다. Pro로 업그레이드하면 무제한으로 생성할 수 있습니다.",
      { status: 403 }
    );
  }
```

기존 성공 시 증가 블록:

```ts
        // 성공 시에만 생성 횟수 차감
        if (isSuccess) {
          await serviceClient
            .from("profiles")
            .update({ monthly_generations: currentGenerations + 1 })
            .eq("id", user.id);
```

을 다음으로 교체 (episodes upsert는 유지):

```ts
        // 실패 시 선소비한 쿼터 환불
        if (!isSuccess) {
          await serviceClient.rpc("refund_generation", { p_user_id: user.id });
        }

        if (isSuccess) {
```

그리고 `catch` 블록의 `status: "failed"` 업데이트 뒤에도 환불 추가:

```ts
        await serviceClient.rpc("refund_generation", { p_user_id: user.id });
```

- [ ] **Step 2: `app/api/generate/episode/route.ts` — 완료된 프로젝트만 에피소드 생성 허용**

`if (!project) return ...` 바로 뒤에 추가 (generating/failed 상태에서 에피소드 생성 차단):

```ts
  if (project.status !== "completed") {
    return new Response("완료된 프로젝트에서만 에피소드를 생성할 수 있습니다.", {
      status: 400,
    });
  }
```

- [ ] **Step 3: `lib/actions/generation.ts` — 입력 검증 + failed 프로젝트 제외**

파일 상단 import에 옵션 상수 추가:

```ts
import { TIER_LIMITS, GENRE_OPTIONS, MOOD_OPTIONS, TARGET_AGE_OPTIONS } from "@/types";
```

`if (!user) return ...` 바로 뒤에 검증 블록 추가:

```ts
  // 서버 측 입력 검증 (클라이언트 우회 방지 + 프롬프트 인젝션/비용 방어)
  if (!(GENRE_OPTIONS as readonly string[]).includes(input.genre)) {
    return { error: "잘못된 장르입니다." };
  }
  if (!(MOOD_OPTIONS as readonly string[]).includes(input.mood)) {
    return { error: "잘못된 분위기입니다." };
  }
  if (!(TARGET_AGE_OPTIONS as readonly string[]).includes(input.target_age)) {
    return { error: "잘못된 타겟 연령입니다." };
  }
  if (!Array.isArray(input.keywords)) {
    return { error: "키워드 형식이 올바르지 않습니다." };
  }
  const keywords = input.keywords
    .map((k) => String(k).trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 10);
  const episodeCount = Math.min(
    200,
    Math.max(10, Math.floor(Number(input.episode_count) || 0))
  );
```

insert 부분에서 정제된 값 사용:

```ts
      keywords,
      episode_count: episodeCount,
```

프로젝트 3개 제한 count 쿼리에 failed 제외 추가:

```ts
      .eq("user_id", user.id)
      .neq("status", "failed");
```

- [ ] **Step 4: 검증** — `npm run build && npm run lint`. dev 서버에서 프로젝트 생성 1회 정상 동작 확인 (마이그레이션 005가 적용된 Supabase 기준).

- [ ] **Step 5: 커밋**

```bash
git add app/api/generate/route.ts app/api/generate/episode/route.ts lib/actions/generation.ts
git commit -m "fix: 생성 쿼터 원자화(RPC 선소비+실패 환불) + 서버 입력 검증 + 에피소드 상태 가드"
```

---

### Task 7: Toss 웹훅 스텁 삭제

**Files:**
- Delete: `app/api/webhooks/toss/route.ts`

- [ ] **Step 1: 삭제**

```bash
rm -r app/api/webhooks
```

- [ ] **Step 2: 검증** — `grep -r "webhooks" app/ lib/ components/` 로 참조 없음 확인, `npm run build`

- [ ] **Step 3: 커밋**

```bash
git add -A app/api
git commit -m "fix: 미구현 Toss 웹훅 스텁 삭제 (무인증 공개 엔드포인트 + 결제 페이로드 로깅 제거)"
```

---

# 2단계 — 프로덕션 필수

### Task 8: 에러/404/로딩 페이지

**Files:**
- Create: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/(dashboard)/loading.tsx`

- [ ] **Step 1: `app/error.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="text-2xl font-bold">문제가 발생했습니다</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        일시적인 오류일 수 있습니다. 다시 시도해도 반복되면 잠시 후에 다시 방문해주세요.
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}
```

- [ ] **Step 2: `app/global-error.tsx`**

```tsx
"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h2>문제가 발생했습니다</h2>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: `app/not-found.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h2>
      <p className="text-muted-foreground text-sm">주소가 잘못됐거나 삭제된 페이지입니다.</p>
      <Button render={<Link href="/" />}>홈으로</Button>
    </div>
  );
}
```

- [ ] **Step 4: `app/(dashboard)/loading.tsx`**

```tsx
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
```

- [ ] **Step 5: 검증** — `npm run build`. dev 서버에서 `/없는페이지` 접속 → 404 확인.

- [ ] **Step 6: 커밋**

```bash
git add app/error.tsx app/global-error.tsx app/not-found.tsx "app/(dashboard)/loading.tsx"
git commit -m "feat: 에러/404/로딩 페이지 추가"
```

---

### Task 9: SSE 에러 처리

**Files:**
- Modify: `components/generate/generation-stream.tsx`
- Modify: `components/project/generate-next-button.tsx`
- Modify: `components/project/retry-button.tsx`

**Interfaces:** 없음 (내부 UI 변경)

- [ ] **Step 1: `generation-stream.tsx` — 연결 오류 표시 + parse 가드**

`done` 상태를 ref로도 추적하고 `streamError` 상태 추가:

```tsx
  const [streamError, setStreamError] = useState<string | null>(null);
  const doneRef = useRef(false);
```

`onmessage` 내부의 `JSON.parse`를 가드로 감싸기:

```tsx
    es.onmessage = (event) => {
      let data: StreamEvent;
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // 손상된 프레임 무시
      }

      if (data.content === "ALL_DONE") {
        doneRef.current = true;
        setDone(true);
        es.close();
        router.refresh();
        return;
      }
```

`onerror`를 교체:

```tsx
    es.onerror = () => {
      es.close();
      if (!doneRef.current) {
        setStreamError(
          "생성 연결이 끊어졌습니다. 서버에서는 계속 진행 중일 수 있으니 잠시 후 새로고침해주세요."
        );
      }
    };
```

렌더에 에러 박스 추가 (`{!done && ...}` 안내 박스 아래):

```tsx
      {streamError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
          <p className="text-sm text-destructive">{streamError}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            새로고침
          </Button>
        </div>
      )}
```

상단에 `import { Button } from "@/components/ui/button";` 추가.

- [ ] **Step 2: `generate-next-button.tsx`, `retry-button.tsx` — 동일 패턴 적용**

각 파일을 읽고: ① `JSON.parse(event.data)`를 위와 같은 try/catch로 감싸고, ② `onerror`에서 조용히 닫기만 하는 부분에 `toast.error("생성 연결이 끊어졌습니다. 새로고침 후 다시 시도해주세요.")` 추가 (`import { toast } from "sonner";` — sonner Toaster는 루트 레이아웃에 이미 있음). 완료 플래그가 있으면 완료 후 onerror는 무시.

- [ ] **Step 3: 검증** — `npm run build && npm run lint`. dev 서버에서 생성 도중 dev 서버 강제 종료 → 에러 박스/토스트 표시 확인.

- [ ] **Step 4: 커밋**

```bash
git add components/generate/generation-stream.tsx components/project/generate-next-button.tsx components/project/retry-button.tsx
git commit -m "fix: SSE 연결 오류를 유저에게 표시 + JSON parse 가드"
```

---

### Task 10: 고착된 generating 프로젝트 복구

**Files:**
- Modify: `lib/actions/projects.ts`
- Create: `components/project/stuck-recovery.tsx`
- Modify: `app/(dashboard)/projects/[id]/page.tsx`

**Interfaces:**
- Produces: `recoverStuckProject(id: string): Promise<{ error?: string }>` (server action)
- Consumes: Task 1의 `refund_generation` RPC

- [ ] **Step 1: `lib/actions/projects.ts`에 액션 추가**

```ts
import { createClient, createServiceClient } from "@/lib/supabase/server";
```

(기존 import 교체) 그리고 파일 끝에:

```ts
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // maxDuration(300s)의 2배

export async function recoverStuckProject(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

  const { data, error } = await supabase
    .from("projects")
    .update({ status: "failed" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "generating")
    .lt("updated_at", cutoff)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "아직 생성이 진행 중입니다. 잠시 후 다시 시도해주세요." };

  // 고착된 생성은 서버가 중단돼 환불이 실행되지 못한 케이스 — 쿼터 환불
  const serviceClient = await createServiceClient();
  await serviceClient.rpc("refund_generation", { p_user_id: user.id });

  return {};
}
```

- [ ] **Step 2: `components/project/stuck-recovery.tsx` 생성**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { recoverStuckProject } from "@/lib/actions/projects";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function StuckRecovery({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRecover() {
    setLoading(true);
    const result = await recoverStuckProject(projectId);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success("초기화됐습니다. 사용 횟수는 차감되지 않았어요.");
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
      <p className="text-sm text-destructive">
        생성이 중단된 것 같습니다. 초기화 후 다시 생성할 수 있습니다.
      </p>
      <Button variant="outline" size="sm" onClick={handleRecover} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        생성 초기화
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: `projects/[id]/page.tsx` — generating 분기에 stale 체크**

`if (project.status === "generating")` 블록을:

```tsx
  if (project.status === "generating") {
    const STUCK_THRESHOLD_MS = 10 * 60 * 1000;
    const isStuck =
      Date.now() - new Date(project.updated_at).getTime() > STUCK_THRESHOLD_MS;

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">생성 중...</h1>
        </div>
        {isStuck ? <StuckRecovery projectId={id} /> : <GenerationStream projectId={id} />}
      </div>
    );
  }
```

상단에 `import { StuckRecovery } from "@/components/project/stuck-recovery";` 추가.

- [ ] **Step 4: 검증** — `npm run build && npm run lint`

- [ ] **Step 5: 커밋**

```bash
git add lib/actions/projects.ts components/project/stuck-recovery.tsx "app/(dashboard)/projects/[id]/page.tsx"
git commit -m "feat: 고착된 생성 프로젝트 복구(초기화+쿼터 환불) 기능"
```

---

### Task 11: 비밀번호 재설정

**Files:**
- Modify: `lib/actions/auth.ts`
- Create: `lib/supabase/client.ts` (이미 있으면 생략)
- Create: `app/(auth)/forgot-password/page.tsx`
- Create: `app/(auth)/reset-password/page.tsx`
- Modify: `components/auth/login-form.tsx` (링크 추가)

**Interfaces:**
- Produces: `requestPasswordReset(formData: FormData): Promise<{ error?: string; success?: boolean }>`

- [ ] **Step 1: `lib/actions/auth.ts`에 액션 추가**

```ts
import { headers } from "next/headers";

export async function requestPasswordReset(formData: FormData): Promise<{
  error?: string;
  success?: boolean;
}> {
  const supabase = await createClient();
  const email = (formData.get("email") as string)?.trim();

  if (!email) return { error: "이메일을 입력해주세요." };

  const headersList = await headers();
  const origin = headersList.get("origin") ?? headersList.get("host") ?? "";
  const baseUrl = origin.startsWith("http") ? origin : `https://${origin}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/reset-password`,
  });

  if (error) return { error: error.message };
  return { success: true };
}
```

- [ ] **Step 2: `lib/supabase/client.ts` 확인/생성**

이미 존재하면 그대로 사용. 없으면:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: `app/(auth)/forgot-password/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await requestPasswordReset(new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) setError(result.error);
    else setSent(true);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>비밀번호 재설정</CardTitle>
        <CardDescription>가입한 이메일로 재설정 링크를 보내드립니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            메일을 보냈습니다. 받은편지함(스팸함 포함)을 확인해주세요.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="email" type="email" placeholder="이메일" required />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              재설정 링크 보내기
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline">로그인으로 돌아가기</Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

참고: `(auth)` 레이아웃이 카드를 중앙 배치하는지 `app/(auth)/layout.tsx`를 확인하고 login 페이지와 같은 래핑을 따를 것.

- [ ] **Step 4: `app/(auth)/reset-password/page.tsx`**

재설정 메일 링크는 `?code=` 파라미터로 도착 → 브라우저 클라이언트로 세션 교환 후 비밀번호 변경:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setError("링크가 만료됐거나 올바르지 않습니다. 다시 요청해주세요.");
        else setReady(true);
      });
    } else {
      // 이미 세션이 있는 경우(링크 자동 처리됨)
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
        else setError("링크가 만료됐거나 올바르지 않습니다. 다시 요청해주세요.");
      });
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>새 비밀번호 설정</CardTitle>
        <CardDescription>새로 사용할 비밀번호를 입력해주세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="password" type="password" placeholder="새 비밀번호 (6자 이상)" required disabled={!ready} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !ready}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            비밀번호 변경
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
```

- [ ] **Step 5: `login-form.tsx`에 링크 추가**

파일을 읽고, 비밀번호 입력 아래(또는 제출 버튼 아래)에:

```tsx
<Link href="/forgot-password" className="text-xs text-muted-foreground underline">
  비밀번호를 잊으셨나요?
</Link>
```

- [ ] **Step 6: 검증** — `npm run build && npm run lint`. dev 서버에서 `/forgot-password` 메일 발송 → 메일 링크 → `/reset-password` 변경 → 로그인 확인 (Supabase 이메일 발송 가능 환경 기준. 불가하면 화면 렌더만 확인하고 보고).

- [ ] **Step 7: 커밋**

```bash
git add lib/actions/auth.ts lib/supabase/client.ts "app/(auth)/forgot-password" "app/(auth)/reset-password" components/auth/login-form.tsx
git commit -m "feat: 비밀번호 재설정 플로우 추가"
```

---

### Task 12: 이메일 확인 대응

**Files:**
- Modify: `lib/actions/auth.ts` (signup)
- Create: `app/(auth)/check-email/page.tsx`

- [ ] **Step 1: `signup` 액션 수정**

```ts
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // 이메일 확인이 활성화된 환경: 세션이 없으므로 안내 페이지로
  if (!data.session) {
    redirect("/check-email");
  }

  redirect("/dashboard");
```

- [ ] **Step 2: `app/(auth)/check-email/page.tsx`**

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailCheck } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <Card className="w-full max-w-sm text-center">
      <CardHeader>
        <MailCheck className="mx-auto h-10 w-10 text-primary" />
        <CardTitle>이메일을 확인해주세요</CardTitle>
        <CardDescription>
          가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해주세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          확인 후 <Link href="/login" className="underline">로그인</Link>해주세요.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 검증 + 커밋**

```bash
npm run build && npm run lint
git add lib/actions/auth.ts "app/(auth)/check-email"
git commit -m "feat: 이메일 확인 안내 페이지 + 가입 후 세션 없음 처리"
```

---

### Task 13: 계정 삭제

**Files:**
- Create: `lib/actions/account.ts`
- Create: `components/settings/delete-account.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Produces: `deleteAccount(): Promise<{ error?: string }>`
- Consumes: Task 16의 FK cascade (payments/subscriptions) — **Task 16 적용 전에는 결제 이력 있는 계정 삭제가 실패할 수 있음** (실행 순서상 문제 없음: 마이그레이션 006이 먼저 적용되면 됨. 검증 시 참고)

- [ ] **Step 1: `lib/actions/account.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const serviceClient = await createServiceClient();

  // 유효한 구독이 있으면 먼저 해지 필요
  const { data: sub } = await serviceClient
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .in("status", ["active", "past_due"])
    .maybeSingle();

  if (sub) {
    return { error: "구독이 활성 상태입니다. 설정에서 먼저 구독을 해지한 뒤 탈퇴해주세요." };
  }

  const { error } = await serviceClient.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`[account] 삭제 실패 user=${user.id}`, error);
    return { error: "탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: `components/settings/delete-account.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/lib/actions/account";
import { Loader2 } from "lucide-react";

export function DeleteAccount() {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await deleteAccount();
    // 성공 시 redirect되므로 여기 도달하면 실패
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        탈퇴하면 모든 프로젝트와 에피소드가 즉시 삭제되며 복구할 수 없습니다.
      </p>
      <div className="flex gap-2">
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={'"탈퇴"를 입력하세요'}
          className="max-w-[200px]"
        />
        <Button
          variant="destructive"
          disabled={confirmText !== "탈퇴" || loading}
          onClick={handleDelete}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          계정 삭제
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: `settings/page.tsx` 맨 아래 카드 추가** (마지막 `</Card>` 뒤, 닫는 `</div>` 앞)

```tsx
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">회원 탈퇴</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteAccount />
        </CardContent>
      </Card>
```

상단에 `import { DeleteAccount } from "@/components/settings/delete-account";` 추가.

- [ ] **Step 4: 검증 + 커밋**

```bash
npm run build && npm run lint
git add lib/actions/account.ts components/settings/delete-account.tsx "app/(dashboard)/settings/page.tsx"
git commit -m "feat: 계정 삭제(회원 탈퇴) 기능"
```

---

### Task 14: 약관/개인정보처리방침 페이지

**Files:**
- Create: `app/terms/page.tsx`, `app/privacy/page.tsx`
- Modify: `app/page.tsx` (푸터 링크), `components/auth/signup-form.tsx` (동의 문구)

- [ ] **Step 1: `app/terms/page.tsx`**

한국 전자상거래 표준 구성으로 작성 — 서비스 개요(AI 웹소설 기획/생성 SaaS), 이용 계약, 요금(Pro 9,900원/월, 매월 자동결제), 해지(기간 말 해지, 일할 환불 없음), 생성 콘텐츠 저작권(사용자 귀속), AI 생성물 특성(정확성 비보장), 무료 한도(평생 3회), 금지 행위, 책임 제한, 준거법 섹션 포함. `prose` 스타일의 정적 페이지:

```tsx
export const metadata = { title: "이용약관 - AI 로판 팩토리" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <p className="text-sm text-muted-foreground">시행일: 2026년 7월 10일</p>
      {/* 아래 섹션들을 h2 + p 구조로 작성 */}
    </div>
  );
}
```

각 섹션(제1조 목적 ~ 제N조 준거법)은 실제 문구로 채울 것 — 실행자가 위 구성 요소를 빠짐없이 실제 조문으로 작성한다. 특히: 자동결제 사실과 해지 방법, 저작권 사용자 귀속, AI 산출물 무보증은 반드시 명시.

- [ ] **Step 2: `app/privacy/page.tsx`**

개인정보처리방침 — 수집 항목(이메일, 닉네임, 결제 기록), 이용 목적, 보유 기간(탈퇴 시 즉시 삭제, 전자상거래법상 결제 기록 5년 보관), 처리 위탁(Supabase, Toss Payments, AI 제공사 — 생성 요청 텍스트가 AI API로 전송됨을 명시), 이용자 권리(열람·삭제 = 설정의 탈퇴 기능), 문의처. 구조는 terms와 동일.

- [ ] **Step 3: 랜딩 푸터 + 가입 폼 링크**

`app/page.tsx`를 읽고 맨 아래(닫는 태그 직전)에 푸터 추가:

```tsx
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© 2026 AI 로판 팩토리</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:underline">이용약관</Link>
            <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
          </div>
        </div>
      </footer>
```

`signup-form.tsx`를 읽고 제출 버튼 아래에:

```tsx
<p className="text-xs text-muted-foreground text-center">
  가입 시 <Link href="/terms" className="underline">이용약관</Link> 및{" "}
  <Link href="/privacy" className="underline">개인정보처리방침</Link>에 동의하게 됩니다.
</p>
```

- [ ] **Step 4: 검증 + 커밋**

```bash
npm run build && npm run lint
git add app/terms app/privacy app/page.tsx components/auth/signup-form.tsx
git commit -m "feat: 이용약관/개인정보처리방침 페이지 + 푸터·가입 동의 링크"
```

---

### Task 15: 코드 정리

**Files:**
- Delete: `lib/claude/` (디렉터리 전체)
- Modify: `lib/ai/pipeline.ts` (`extractJSON`에 `export` 추가)
- Modify: `app/api/generate/retry/route.ts` (로컬 `extractJSON` 삭제, import로 교체)
- Modify: `app/api/generate/episode/route.ts`, `app/api/generate/episode/retry/route.ts` (무의미한 삼항 제거)

- [ ] **Step 1: 죽은 코드 삭제**

```bash
grep -rn "lib/claude" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "lib/claude/"
# 출력 없음 확인 후:
rm -r lib/claude
```

- [ ] **Step 2: `extractJSON` 통합**

`lib/ai/pipeline.ts`의 `function extractJSON` 앞에 `export` 추가. `app/api/generate/retry/route.ts`의 로컬 `extractJSON` 정의(14-35행 부근)를 삭제하고 상단에:

```ts
import { extractJSON } from "@/lib/ai/pipeline";
```

- [ ] **Step 3: 무의미한 삼항 제거** — 두 파일에서

```ts
  const model =
    tier === "pro" || tier === "enterprise"
      ? AI_MODELS[provider].heavy
      : AI_MODELS[provider].heavy; // 에피소드 본문은 항상 heavy 모델
```

을 다음으로 교체 (사용하지 않게 된 `tier` 변수/import가 있으면 정리하되, free 에피소드 한도 체크에 tier가 쓰이므로 변수 자체는 유지):

```ts
  const model = AI_MODELS[provider].heavy; // 에피소드 본문은 항상 heavy 모델
```

- [ ] **Step 4: 검증 + 커밋**

```bash
npm run build && npm run lint
git add -A lib/ app/api/generate/
git commit -m "chore: 죽은 lib/claude 삭제, extractJSON 통합, 무의미한 삼항 제거"
```

---

### Task 16: 마이그레이션 006 — 인덱스/제약/cascade

**Files:**
- Create: `supabase/migrations/006_indexes_constraints.sql`

- [ ] **Step 1: 파일 작성**

```sql
-- 006_indexes_constraints.sql

-- FK 인덱스 (Postgres는 FK에 자동 인덱스를 만들지 않음)
create index if not exists idx_episodes_project_id on episodes(project_id);
create index if not exists idx_payments_user_id on payments(user_id);
create index if not exists idx_subscriptions_renewal on subscriptions(status, current_period_end);

-- status 허용값 고정
alter table subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'past_due', 'cancelled', 'failed', 'expired'));
alter table payments add constraint payments_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled'));

-- 계정 삭제(auth.users 삭제) 시 결제/구독 기록도 삭제되도록 cascade
alter table payments drop constraint payments_user_id_fkey;
alter table payments add constraint payments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table subscriptions drop constraint subscriptions_user_id_fkey;
alter table subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 유저가 자기 에피소드를 삭제할 수 있도록 (기존에 DELETE 정책 없음)
create policy "Users can delete own episodes"
  on episodes for delete
  using (
    exists (
      select 1 from projects
      where projects.id = episodes.project_id
        and projects.user_id = auth.uid()
    )
  );
```

주의: 001/003의 `projects.user_id`, `episodes.project_id` FK에 이미 `on delete cascade`가 있는지 확인하고(파일 읽기), 없으면 위와 같은 drop/add 패턴으로 이 파일에 추가할 것.

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/006_indexes_constraints.sql
git commit -m "feat: DB 인덱스·status CHECK·삭제 cascade·에피소드 DELETE 정책 (마이그레이션 006)"
```

---

### Task 17: SEO 기본

**Files:**
- Create: `app/robots.ts`
- Modify: `app/layout.tsx` (metadata 보강)

- [ ] **Step 1: `app/robots.ts`**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/settings", "/projects/", "/generate"],
    },
  };
}
```

- [ ] **Step 2: `app/layout.tsx` metadata 보강**

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "AI 로판 팩토리 - AI 웹소설 자동 기획 & 생성",
    template: "%s | AI 로판 팩토리",
  },
  description:
    "장르, 키워드, 분위기만 입력하면 3막 구조, 캐릭터 시트, 1화 완성본까지 AI가 자동 생성합니다.",
  keywords: ["웹소설", "로판", "AI", "자동 생성", "기획", "캐릭터"],
  openGraph: {
    title: "AI 로판 팩토리",
    description: "AI가 웹소설 기획부터 에피소드까지 자동 생성",
    type: "website",
    locale: "ko_KR",
  },
};
```

`.env.local.example`에 `NEXT_PUBLIC_SITE_URL=` 항목 추가.

- [ ] **Step 3: 검증 + 커밋**

```bash
npm run build
git add app/robots.ts app/layout.tsx .env.local.example
git commit -m "feat: robots.txt + OG 메타데이터"
```

---

# 3단계 — 표지 생성 (Pro 전용)

### Task 18: 마이그레이션 007 + 타입

**Files:**
- Create: `supabase/migrations/007_cover_generation.sql`
- Modify: `types/index.ts`

**Interfaces:**
- Produces: `projects.cover_image_url`, `profiles.monthly_cover_count/cover_reset_at`, RPC `consume_cover_generation(p_user_id uuid, p_limit int) returns boolean`, RPC `refund_cover_generation(p_user_id uuid)`, Storage 버킷 `covers`, 상수 `COVER_MONTHLY_LIMIT = 20`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 007_cover_generation.sql

alter table projects add column cover_image_url text;
alter table profiles add column monthly_cover_count int not null default 0;
alter table profiles add column cover_reset_at timestamptz not null
  default (date_trunc('month', now()) + interval '1 month');

-- 표지 쿼터 원자 소비 (lazy 월간 리셋 포함, Pro 전용)
create or replace function consume_cover_generation(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  -- 지난 달 카운터면 리셋
  update profiles
  set monthly_cover_count = 0,
      cover_reset_at = date_trunc('month', now()) + interval '1 month'
  where id = p_user_id and cover_reset_at <= now();

  update profiles
  set monthly_cover_count = monthly_cover_count + 1
  where id = p_user_id
    and tier in ('pro', 'enterprise')
    and monthly_cover_count < p_limit;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

create or replace function refund_cover_generation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set monthly_cover_count = greatest(monthly_cover_count - 1, 0)
  where id = p_user_id;
end;
$$;

revoke execute on function consume_cover_generation(uuid, int) from public, anon, authenticated;
revoke execute on function refund_cover_generation(uuid) from public, anon, authenticated;

-- 표지 이미지 공개 버킷 (쓰기는 service role만 — 별도 정책 없음)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: `types/index.ts` 갱신**

`Profile`에 `monthly_cover_count: number; cover_reset_at: string;` 추가, `Project`에 `cover_image_url: string | null;` 추가, 그리고 상수:

```ts
export const COVER_MONTHLY_LIMIT = 20;
```

- [ ] **Step 3: 검증 + 커밋**

```bash
npm run build
git add supabase/migrations/007_cover_generation.sql types/index.ts
git commit -m "feat: 표지 생성 스키마 — cover_image_url, 월 쿼터 RPC, covers 버킷 (마이그레이션 007)"
```

---

### Task 19: 표지 이미지 생성 라이브러리

**Files:**
- Create: `lib/ai/cover.ts`

**Interfaces:**
- Produces: `buildCoverPrompt(input: CoverPromptInput): string`, `generateCoverImage(prompt: string): Promise<Buffer>`, `interface CoverPromptInput { title: string; genre: string; mood: string; logline?: string; heroineAppearance?: string }`

- [ ] **Step 1: 파일 작성**

```ts
export interface CoverPromptInput {
  title: string;
  genre: string;
  mood: string;
  logline?: string;
  heroineAppearance?: string;
}

export function buildCoverPrompt(input: CoverPromptInput): string {
  const parts = [
    `한국 웹소설 "${input.genre}" 장르의 표지 일러스트를 그려주세요.`,
    `분위기: ${input.mood}.`,
  ];
  if (input.logline) parts.push(`줄거리: ${input.logline}`);
  if (input.heroineAppearance) parts.push(`주인공 외형: ${input.heroineAppearance}`);
  parts.push(
    "스타일: 고품질 디지털 일러스트, 로맨스 판타지 웹소설 표지, 화려한 색감, 세로 구도.",
    "중요: 이미지에 어떤 글자나 텍스트도 넣지 마세요. 인물과 배경만 그려주세요."
  );
  return parts.join("\n");
}

export async function generateCoverImage(prompt: string): Promise<Buffer> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "2:3" },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("이미지가 생성되지 않았습니다. 잠시 후 다시 시도해주세요.");
}
```

참고: `imageConfig`/`responseModalities` 타입이 설치된 `@google/genai` 버전과 안 맞으면 `config`를 최소화(`responseModalities: ["IMAGE"]`만)하고 세로 비율 요구를 프롬프트 문장으로 대체할 것.

- [ ] **Step 2: 검증 + 커밋**

```bash
npm run build && npm run lint
git add lib/ai/cover.ts
git commit -m "feat: Gemini 표지 이미지 생성 라이브러리"
```

---

### Task 20: 표지 생성 API

**Files:**
- Create: `app/api/generate/cover/route.ts`

**Interfaces:**
- Consumes: Task 18 RPC/버킷, Task 19 `buildCoverPrompt`/`generateCoverImage`
- Produces: `POST /api/generate/cover` body `{ projectId: string }` → 200 `{ coverUrl: string }` | 4xx/5xx `{ error: string }`

- [ ] **Step 1: 파일 작성**

```ts
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildCoverPrompt, generateCoverImage } from "@/lib/ai/cover";
import { NextResponse } from "next/server";
import type { OutlineData, CharacterData, Tier } from "@/types";
import { COVER_MONTHLY_LIMIT } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId;
  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId가 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, genre, mood, outline, characters")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const tier = (profile?.tier as Tier) || "free";
  if (tier === "free") {
    return NextResponse.json(
      { error: "표지 생성은 Pro 전용 기능입니다. Pro로 업그레이드하세요." },
      { status: 403 }
    );
  }

  const serviceClient = await createServiceClient();

  // 월 쿼터 원자 소비 (실패 시 환불)
  const { data: consumed, error: consumeError } = await serviceClient.rpc(
    "consume_cover_generation",
    { p_user_id: user.id, p_limit: COVER_MONTHLY_LIMIT }
  );

  if (consumeError || !consumed) {
    return NextResponse.json(
      { error: `이번 달 표지 생성 한도(${COVER_MONTHLY_LIMIT}회)를 모두 사용했습니다.` },
      { status: 429 }
    );
  }

  try {
    const outline = project.outline as OutlineData | null;
    const rawChars = project.characters;
    const characters = Array.isArray(rawChars) ? (rawChars as CharacterData[]) : [];
    const heroine = characters.find((c) => c.role?.includes("주인공")) ?? characters[0];

    const prompt = buildCoverPrompt({
      title: outline?.title ?? project.title ?? "",
      genre: project.genre,
      mood: project.mood,
      logline: outline?.logline,
      heroineAppearance: heroine?.appearance,
    });

    const imageBuffer = await generateCoverImage(prompt);

    const { error: uploadError } = await serviceClient.storage
      .from("covers")
      .upload(`${projectId}.png`, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);

    const {
      data: { publicUrl },
    } = serviceClient.storage.from("covers").getPublicUrl(`${projectId}.png`);

    // 재생성 시 브라우저 캐시 무효화를 위해 버전 쿼리 부착
    const coverUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await serviceClient
      .from("projects")
      .update({ cover_image_url: coverUrl })
      .eq("id", projectId);

    if (updateError) throw new Error(`저장 실패: ${updateError.message}`);

    return NextResponse.json({ coverUrl });
  } catch (error) {
    // 생성/업로드 실패 — 쿼터 환불
    await serviceClient.rpc("refund_cover_generation", { p_user_id: user.id });
    const message = error instanceof Error ? error.message : "표지 생성에 실패했습니다.";
    console.error(`[cover] 생성 실패 project=${projectId}`, error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: 검증** — `npm run build && npm run lint`. 마이그레이션 007 적용 후 dev 서버에서 Pro 계정으로:

```bash
curl -X POST http://localhost:3000/api/generate/cover -H "Content-Type: application/json" -d '{"projectId":"<실제 ID>"}' --cookie "<세션 쿠키>"
```

(브라우저에서 UI로 검증해도 됨 — Task 21 이후)

- [ ] **Step 3: 커밋**

```bash
git add app/api/generate/cover/route.ts
git commit -m "feat: 표지 생성 API — Pro 전용, 월 쿼터, Storage 업로드"
```

---

### Task 21: 표지 UI

**Files:**
- Create: `components/project/cover-card.tsx`
- Modify: `app/(dashboard)/projects/[id]/page.tsx` ("표지 & SEO" 탭)
- Modify: `components/dashboard/project-card.tsx` (썸네일)

**Interfaces:**
- Consumes: `POST /api/generate/cover` (Task 20), `project.cover_image_url` (Task 18)

- [ ] **Step 1: `components/project/cover-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon, Loader2, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function CoverCard({
  projectId,
  coverUrl,
  title,
  isPro,
}: {
  projectId: string;
  coverUrl: string | null;
  title: string;
  isPro: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "표지 생성에 실패했습니다.");
      } else {
        toast.success("표지가 생성됐습니다!");
        router.refresh();
      }
    } catch {
      toast.error("표지 생성 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI 표지</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {coverUrl ? (
          <div className="relative mx-auto w-full max-w-[240px] aspect-[2/3] overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={`${title} 표지`} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-sm font-bold text-white line-clamp-2">{title}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[240px] aspect-[2/3] items-center justify-center rounded-lg border border-dashed">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {isPro ? (
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {coverUrl ? "표지 다시 생성" : "표지 생성"}
          </Button>
        ) : (
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="h-3.5 w-3.5" /> 표지 생성은 Pro 전용입니다
            </p>
            <Button variant="outline" className="w-full" render={<Link href="/pricing" />}>
              Pro로 업그레이드
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: `projects/[id]/page.tsx` — "표지 & SEO" 탭 상단에 배치**

`<TabsContent value="meta" ...>` 첫 자식으로:

```tsx
          <CoverCard
            projectId={project.id}
            coverUrl={project.cover_image_url}
            title={outline?.title || project.title || "제목 없음"}
            isPro={tier !== "free"}
          />
```

상단에 `import { CoverCard } from "@/components/project/cover-card";` 추가.

- [ ] **Step 3: `project-card.tsx` — 대시보드 썸네일**

`<CardHeader className="pb-3">` 바로 위(Link 안 첫 자식)에:

```tsx
        {project.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover_image_url}
            alt=""
            className="h-32 w-full object-cover object-top rounded-t-lg"
          />
        )}
```

- [ ] **Step 4: 검증** — `npm run build && npm run lint`. dev 서버에서: Free 계정 → 잠금 카드 + 업그레이드 버튼 확인. Pro 계정(마이그레이션 007 적용 후) → 표지 생성 → 이미지 표시 → 대시보드 썸네일 확인.

- [ ] **Step 5: 커밋**

```bash
git add components/project/cover-card.tsx "app/(dashboard)/projects/[id]/page.tsx" components/dashboard/project-card.tsx
git commit -m "feat: 표지 생성 UI — 프로젝트 표지 카드 + 대시보드 썸네일"
```

---

### Task 22: 문서/마무리

**Files:**
- Modify: `CLAUDE.md` (변경된 아키텍처 반영)
- Modify: `.env.local.example` (누락 항목 확인)

- [ ] **Step 1: CLAUDE.md 갱신** — 다음 사실을 반영: 쿼터는 RPC(`consume_generation`/`refund_generation`)로 원자 처리(선소비+실패 환불), 무료 한도는 평생 3회, 구독 상태 머신(`active/past_due/cancelled/failed/expired`, 3일 유예), customerKey=user.id, 표지 생성(`/api/generate/cover`, Pro 전용 월 20회, `covers` 버킷), 웹훅 삭제됨, 마이그레이션 005-007 추가.

- [ ] **Step 2: 최종 검증**

```bash
npm run build && npm run lint
```

- [ ] **Step 3: 커밋**

```bash
git add CLAUDE.md .env.local.example
git commit -m "docs: CLAUDE.md에 결제 상태 머신·쿼터 RPC·표지 기능 반영"
```

---

## 실행 후 사용자 안내 사항 (실행자는 최종 보고에 포함)

1. **마이그레이션 적용 필요**: 005, 006, 007을 Supabase에 적용 (`supabase db push` 또는 대시보드 SQL 편집기).
2. **환경 변수**: `CRON_SECRET`이 Vercel에 반드시 설정돼 있어야 크론이 동작 (이제 미설정 시 무조건 401). `NEXT_PUBLIC_SITE_URL` 추가 권장.
3. **기존 구독자**: `customer_key`가 null인 기존 구독은 갱신 시 `user_id`로 폴백 — 기존 구독자의 빌링키가 랜덤 customerKey로 발급된 경우 갱신이 실패할 수 있으므로, 실패 시 재구독을 안내해야 함.
4. **Supabase 이메일 설정**: 비밀번호 재설정 메일의 Redirect URL 허용 목록에 `/reset-password` 추가 필요.
