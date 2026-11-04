export type AIProvider = "anthropic" | "gemini" | "grok";

export interface AIModelConfig {
  light: string;  // Free 티어: 아웃라인/캐릭터/메타용
  heavy: string;  // Free 티어: 1화 완성본용 & Pro 티어: 전체
}

// 모델 ID는 환경변수로 덮어쓸 수 있다 (예: AI_MODEL_GROK_LIGHT). 모델 은퇴 시 재배포 없이 교체 가능.
// 서버 전용 값이라 클라이언트 번들에서는 undefined → 기본값으로 대체된다.
function modelFromEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const AI_MODELS: Record<AIProvider, AIModelConfig> = {
  gemini: {
    light: modelFromEnv("AI_MODEL_GEMINI_LIGHT", "gemini-2.5-flash"),
    heavy: modelFromEnv("AI_MODEL_GEMINI_HEAVY", "gemini-3.1-pro-preview"),
  },
  grok: {
    // grok-4-1-fast-non-reasoning은 2026-05-15 은퇴 후 grok-4.3(추론 없음)으로 자동 리다이렉트됨
    light: modelFromEnv("AI_MODEL_GROK_LIGHT", "grok-4-1-fast-non-reasoning"),
    heavy: modelFromEnv("AI_MODEL_GROK_HEAVY", "grok-4.20-0309-reasoning"),
  },
  anthropic: {
    // claude-sonnet-4-20250514는 2026-06-15 은퇴 → Haiku 5.5로 교체
    light: modelFromEnv("AI_MODEL_ANTHROPIC_LIGHT", "claude-haiku-5-5"),
    heavy: modelFromEnv("AI_MODEL_ANTHROPIC_HEAVY", "claude-sonnet-4-6"),
  },
};

export const AI_PROVIDER_OPTIONS: { value: AIProvider; label: string; freeModel: string; proModel: string }[] = [
  { value: "gemini", label: "Gemini (Google)", freeModel: "Gemini 2.5 Flash / 3.1 Pro", proModel: "Gemini 3.1 Pro" },
  { value: "grok", label: "Grok (xAI)", freeModel: "Grok 4.1 Fast / 4.20", proModel: "Grok 4.20" },
  { value: "anthropic", label: "Claude (Anthropic)", freeModel: "Haiku 5.5 / Sonnet 4.6", proModel: "Sonnet 4.6" },
];

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
  ai_provider: AIProvider;
  monthly_generations: number;
  monthly_reset_at: string;
  monthly_cover_count: number;
  cover_reset_at: string;
  monthly_episode_count: number;
  episode_reset_at: string;
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
  cover_image_url: string | null;
  cover_prompts: CoverPrompt[] | null;
  seo: SeoData | null;
  variation_of: string | null;
  retry_count: number;
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
  /** 화수가 많은 작품(30화 초과)에서 31화 이후를 10화 단위로 요약한 아크 */
  arcs?: { range: string; summary: string }[];
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

export interface Episode {
  id: string;
  project_id: string;
  episode_number: number;
  content: string;
  status: "completed" | "generating" | "failed";
  retry_count: number;
  created_at: string;
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
  /** 변주(다시 생성) 시 원작 정보 — 프롬프트에서 "기존과 다르게" 지시에 사용 */
  variation_source?: { title: string; logline: string };
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

export const COVER_MONTHLY_LIMIT = 20;

/** 프로젝트당 무료 에피소드 수 */
export const FREE_EPISODE_LIMIT = 3;

/**
 * 월간 에피소드 생성 상한 (재생성 포함). Pro 9,900원 대비 상위 모델 원가를 고려한 값 — 운영 데이터로 조정.
 * free는 프로젝트당 3화 제한이 실질 한도이고, 이 값은 우회 방지용 안전망.
 */
export const EPISODE_MONTHLY_LIMIT: Record<Tier, number> = {
  free: 30,
  pro: 100,
  enterprise: 1000,
};

/** 실패한 에피소드 1개당 재생성 최대 횟수 */
export const EPISODE_RETRY_LIMIT = 3;

/** 프로젝트 누락 단계(캐릭터/1화/메타) 재시도 최대 횟수 */
export const PROJECT_RETRY_LIMIT = 3;
