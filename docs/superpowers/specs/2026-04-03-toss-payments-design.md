# Toss Payments Pro 월 구독 Design Spec

## Context

현재 tier는 DB에만 존재하고 실제 결제 흐름이 없습니다. Pro 월 구독(9,900원)을 Toss Payments로 연동하여 수익화합니다.

## 요구사항

- Pro 월 구독: 9,900원/월
- Toss Payments 빌링키 방식 자동결제
- 결제 성공 시 tier 즉시 변경
- 구독 해지 기능
- 결제 실패 시 자동 다운그레이드

## 결제 흐름

```
사용자 → /pricing → Toss 결제 위젯 (빌링키 발급)
→ /api/payments/billing-key (빌링키 저장 + 즉시 첫 결제)
→ profiles.tier = 'pro' + payments 기록
→ /dashboard 리다이렉트

매일 크론 → /api/cron/billing
→ next_billing_at 만료된 구독 조회
→ 빌링키로 자동결제
→ 성공: next_billing_at +1개월
→ 실패: tier = 'free', status = 'cancelled'
```

## DB 스키마

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  order_id text not null unique,
  payment_key text unique,
  amount int not null default 9900,
  status text not null default 'pending',
  method text,
  created_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) unique,
  billing_key text not null,
  status text not null default 'active',  -- active | cancelled | failed
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  created_at timestamptz default now()
);
```

## API 엔드포인트

| 엔드포인트 | 용도 |
|-----------|------|
| `POST /api/payments/billing-key` | 빌링키 발급 + 즉시 결제 |
| `POST /api/payments/cancel` | 구독 해지 |
| `GET /api/cron/billing` | 월간 자동결제 (Vercel Cron) |

## 페이지/컴포넌트

| 파일 | 용도 |
|------|------|
| `app/(dashboard)/pricing/page.tsx` | 가격표 + Toss 위젯 |
| `components/pricing/pricing-card.tsx` | Free/Pro 비교 카드 |
| `components/pricing/toss-checkout.tsx` | Toss 결제 위젯 래퍼 |
| `components/settings/subscription-manager.tsx` | 구독 상태 + 해지 |

## 환경변수

```
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...
CRON_SECRET=... (크론 인증용)
```

## 수정 대상

- `app/(dashboard)/settings/page.tsx` — 구독 관리 섹션 추가
- `app/api/webhooks/toss/route.ts` — 기존 placeholder 교체 (불필요 시 제거)
- `.env.local.example` — Toss 키 추가
- `package.json` — @tosspayments/tosspayments-sdk 추가
