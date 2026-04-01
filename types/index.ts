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
