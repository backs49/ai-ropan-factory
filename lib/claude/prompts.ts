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
