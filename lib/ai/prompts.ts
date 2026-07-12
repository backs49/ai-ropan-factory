import type { GenerationInput, OutlineData } from "@/types";

// --- 장르별 창작 가이드 (아웃라인/캐릭터 프롬프트에 주입) ---
// cast가 있으면 캐릭터 구성 기본값(주인공 2+조연 4+빌런 2)을 대체한다.
const GENRE_GUIDELINES: Record<string, { outline: string; cast?: string }> = {
  "로판 (로맨스 판타지)": {
    outline:
      "서양풍 신분제 세계관(제국·공작가·황실)을 기본으로 하고, 여주인공의 성장 서사와 로맨스를 함께 전개하세요. 신분·권력 격차가 갈등의 축이 됩니다.",
  },
  빙의물: {
    outline:
      "1화에서 반드시 빙의 사건이 발생해야 합니다(현대인이 소설/게임 속 인물의 몸에 들어감). 주인공은 원작 지식을 활용해 생존·공략하며, 원작 전개와 어긋나기 시작하는 분기점을 중반에 배치하세요. 빙의 전 기억과 원작 지식의 활용 규칙을 일관되게 유지하세요.",
  },
  환생물: {
    outline:
      "주인공은 전생의 기억을 가진 채 새 삶을 시작합니다. 전생의 한(죽음의 원인, 못 이룬 것)과 이번 생의 목표를 연결하고, 전생 기억으로 얻는 이점의 규칙을 일관되게 유지하세요.",
  },
  회귀물: {
    outline:
      "1화에서 주인공의 죽음 또는 파국 직후 과거의 특정 시점으로 회귀해야 합니다. 미래 지식으로 비극을 회피하고 원인 제공자에게 복수하는 구조를 기본으로 하되, 회귀로 바꿀 수 있는 것과 바꿔도 반복되는 것의 규칙을 유지하세요.",
  },
  "실버 로맨스": {
    outline:
      "중장년 주인공의 원숙한 로맨스입니다. 인생 2막, 과거의 상처·이별과의 재회 서사를 중심에 두고, 젊은 로맨스와 다른 깊이 있는 감정선을 그리세요.",
  },
  "현대 로맨스": {
    outline:
      "현대 한국 배경(직장·일상)의 로맨스입니다. 현실 공감형 갈등을 기본으로 하되 재벌·계약연애 등 인기 클리셰를 매력적으로 활용할 수 있습니다.",
  },
  "궁중 로맨스": {
    outline:
      "궁궐을 배경으로 한 권력 암투와 로맨스입니다. 후궁·세자·왕위 다툼 구도를 활용하고, 예법과 신분 제약이 로맨스의 장애물로 작동하게 하세요.",
  },
  하렘물: {
    outline:
      "남주인공 1명과 매력적인 여성 상대역 다수(4명 이상)의 관계를 그립니다. 각 히로인마다 고유한 매력과 개별 서사(만남-호감-갈등)를 배치하고, 화마다 다른 히로인의 비중을 순환시키세요.",
    cast: "주인공(남) 1명 + 히로인 5명(각기 다른 매력·계열) + 조연/갈등 요소 2명",
  },
  역하렘물: {
    outline:
      "여주인공 1명과 매력적인 남성 상대역 다수(4명 이상)의 관계를 그립니다. 각 남주 후보의 상반된 매력(다정/냉정/장난기/헌신 등)을 설계하고 개별 서사를 배치하세요.",
    cast: "주인공(여) 1명 + 남주 후보 5명(상반된 매력·계열) + 조연/갈등 요소 2명",
  },
  "사극 로맨스": {
    outline:
      "한국 전통 사극(조선풍) 배경입니다. 시대에 맞는 어휘·호칭·예법을 사용하고, 신분 차이와 가문·조정의 정치가 로맨스의 장애물로 작동하게 하세요.",
  },
};

// --- 분위기별 전개 가이드 (아웃라인/본문 프롬프트에 주입) ---
const MOOD_GUIDELINES: Record<string, string> = {
  사이다:
    "답답한(고구마) 구간은 한 화를 넘기지 마세요. 주인공이 당하기만 하는 전개는 금지이며, 매 화에 최소 1회 통쾌한 반격·응징·승리의 순간을 배치하세요. 응징은 빠르고 명확하게.",
  집착:
    "상대역의 독점욕과 집착을 점층적으로 고조시키세요. 위험한 매력과 깊은 애정 사이의 긴장을 유지하되, 독자가 불쾌할 수준의 일방적 폭력은 지양하세요.",
  치유: "상처의 서사와 회복 과정을 중심에 두세요. 갈등은 부드럽게 해소하고, 인물 간 온기가 쌓이는 장면의 비중을 높이세요.",
  다크: "무거운 분위기, 도덕적 회색지대, 배신과 음모를 적극 활용하세요. 다만 주인공 서사의 방향성(목표)은 흐려지지 않게 유지하세요.",
  코미디:
    "매 화 2~3개의 웃음 포인트를 배치하세요. 티키타카 대사와 상황 개그를 활용하고, 진지한 장면 뒤에는 이완 장면을 넣어 리듬을 만드세요.",
  미스터리:
    "떡밥(단서)을 화마다 배치하고 회수 시점을 설계하세요. 독자에게 공개하는 정보의 순서를 통제해 궁금증을 유지하세요.",
  달달: "설렘 장면(심쿵 포인트)을 매 화 최소 1회 배치하세요. 스킨십과 고백의 수위는 타겟 연령을 준수하세요.",
  앙스트:
    "감정적 고통·오해·이별 구간을 의도적으로 설계해 독자의 감정을 흔드세요. 다만 회복과 화해의 희망을 완전히 꺼뜨리지는 마세요.",
  스릴러:
    "긴박한 전개와 시간 압박을 유지하고 위협의 실체를 점진적으로 공개하세요. 각 화의 끝은 위기 고조로 마무리하세요.",
  힐링: "잔잔한 일상과 소소한 성취를 중심에 두세요. 큰 갈등보다 작은 문제의 해결이 반복되는 편안한 리듬을 유지하세요.",
};

const DEFAULT_CAST = "주인공 2명(남녀 주인공) + 조연 4명 + 빌런/갈등 요소 2명";

function genreGuide(genre: string): string {
  return GENRE_GUIDELINES[genre]?.outline ?? "";
}

function castGuide(genre: string): string {
  return GENRE_GUIDELINES[genre]?.cast ?? DEFAULT_CAST;
}

function moodGuide(mood: string): string {
  return MOOD_GUIDELINES[mood] ?? "";
}

function ageGuide(targetAge: string): string {
  return `타겟 연령(${targetAge}) 독자 기준의 소재와 수위를 지키세요. 과도한 폭력·선정적 묘사는 피하고, 전연령이라면 순한 수위를 유지하세요.`;
}

// 화수가 많으면 에피소드별 상세 아웃라인이 출력 토큰 한도를 초과하므로,
// 초반만 상세히 쓰고 이후는 10화 단위 아크 요약으로 받는다 (웹소설 기획 관행과 동일).
const DETAILED_EPISODE_LIMIT = 30;

export function getOutlinePrompt(input: GenerationInput): {
  system: string;
  user: string;
} {
  const useArcs = input.episode_count > DETAILED_EPISODE_LIMIT;
  const variation = input.variation_source
    ? `\n\n[변주 요청] 아래 기존 작품의 "변주"입니다. 같은 키워드·장르를 쓰되 제목, 설정 디테일, 전개 방향은 기존 작품과 뚜렷이 다르게 만드세요.
- 기존 제목: ${input.variation_source.title}
- 기존 로그라인: ${input.variation_source.logline}`
    : "";

  return {
    system: `당신은 한국 웹소설 업계에서 20년 경력의 베테랑 기획자입니다. 카카오페이지, 네이버 시리즈 등 주요 플랫폼의 트렌드와 독자 심리를 완벽히 이해합니다.

역할: 주어진 장르, 키워드, 분위기를 바탕으로 상업적으로 성공 가능한 웹소설의 3막 구조와 전체 에피소드 아웃라인을 설계합니다.

규칙:
- 반드시 JSON 형식으로만 응답하세요
- 3막 구조(기승전결 변형): 1막(도입+갈등 설정), 2막(전개+위기 고조), 3막(클라이맥스+해결)
- 각 에피소드는 끝에 다음 화를 읽고 싶게 만드는 "훅"이 있어야 합니다
- 장르 지침: ${genreGuide(input.genre) || `${input.genre} 장르의 관습과 독자 기대를 충실히 따르세요`}
- 분위기 지침(${input.mood}): ${moodGuide(input.mood) || "선택된 분위기에 맞는 전개를 유지하세요"}
- ${ageGuide(input.target_age)}
- 전체 ${input.episode_count}화 분량으로 설계하세요
${
  useArcs
    ? `- 에피소드별 상세 아웃라인은 1~${DETAILED_EPISODE_LIMIT}화까지만 세 막의 episodes 배열에 작성하세요 (episode_number 연속, 누락 금지)
- ${DETAILED_EPISODE_LIMIT + 1}화부터 ${input.episode_count}화까지는 최상위 "arcs" 배열에 10화 단위 아크 요약(각 3~4문장)으로 작성하세요
- 세 막의 summary는 전체 ${input.episode_count}화 기준의 큰 흐름으로 작성하세요`
    : `- 1~${input.episode_count}화를 세 막에 빠짐없이 배분하세요 (episode_number 연속, 누락 금지)`
}`,
    user: `장르: ${input.genre}
키워드: ${input.keywords.join(", ")}
분위기: ${input.mood}
타겟 연령: ${input.target_age}
총 화수: ${input.episode_count}화${variation}

위 설정으로 웹소설 아웃라인을 JSON으로 생성해주세요. 아래는 형식 예시이며, 실제 응답에서는 각 막의 "episodes" 배열에 그 막에 배정된 모든 화를 채워야 합니다:
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
  "act2": {
    "summary": "2막 요약 (3-4문장)",
    "episodes": [
      {
        "episode_number": 2,
        "title": "에피소드 제목",
        "summary": "에피소드 요약 (2-3문장)",
        "key_event": "핵심 사건 한 줄"
      }
    ]
  },
  "act3": {
    "summary": "3막 요약 (3-4문장)",
    "episodes": [
      {
        "episode_number": 3,
        "title": "에피소드 제목",
        "summary": "에피소드 요약 (2-3문장)",
        "key_event": "핵심 사건 한 줄"
      }
    ]
  }${
    useArcs
      ? `,
  "arcs": [
    {
      "range": "${DETAILED_EPISODE_LIMIT + 1}-${Math.min(DETAILED_EPISODE_LIMIT + 10, input.episode_count)}",
      "summary": "이 구간의 전개 요약 (3-4문장)"
    }
  ]`
      : ""
  }
}`,
  };
}

export function getCharacterPrompt(
  input: GenerationInput,
  outline: OutlineData
): { system: string; user: string } {
  // 캐릭터 설계가 실제 플롯의 사건·복선과 맞물리도록 에피소드 핵심 사건을 전달
  const keyEvents = [
    ...outline.act1.episodes,
    ...outline.act2.episodes,
    ...outline.act3.episodes,
  ]
    .slice(0, 30)
    .map((e) => `${e.episode_number}화: ${e.key_event}`)
    .join("\n");

  return {
    system: `당신은 한국 웹소설 전문 캐릭터 디자이너입니다. 독자가 감정적으로 몰입할 수 있는 입체적 캐릭터를 설계합니다.

규칙:
- 반드시 JSON 배열 형식으로만 응답하세요
- 8명의 주요 캐릭터를 생성하세요. 구성: ${castGuide(input.genre)}
- 각 캐릭터는 고유한 말투, 성격, 비밀을 가져야 합니다
- 캐릭터 간 관계가 스토리 갈등을 자연스럽게 만들어야 합니다
- 캐릭터의 비밀과 동기는 아래 에피소드 핵심 사건들과 맞물리게 설계하세요
- ${input.genre} 장르의 클리셰를 활용하되 반전 요소를 포함하세요${genreGuide(input.genre) ? `\n- 장르 지침: ${genreGuide(input.genre)}` : ""}
- ${ageGuide(input.target_age)}
- 외모 묘사는 웹소설 독자가 좋아하는 구체적이고 매력적인 스타일로 작성하세요`,
    user: `작품 제목: ${outline.title}
로그라인: ${outline.logline}
장르: ${input.genre}
분위기: ${input.mood}
키워드: ${input.keywords.join(", ")}

1막 요약: ${outline.act1.summary}
2막 요약: ${outline.act2.summary}
3막 요약: ${outline.act3.summary}

에피소드 핵심 사건:
${keyEvents}

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
- 분위기 지침(${input.mood}): ${moodGuide(input.mood) || "선택된 분위기를 일관되게 유지하세요"}
- ${ageGuide(input.target_age)}
- 문단 사이에 빈 줄을 넣어 가독성을 높이세요
- "~했다", "~였다" 등 과거형 서술체를 기본으로 사용하세요
- 절대 JSON이 아닌 순수 소설 텍스트로만 응답하세요`,
    user: `작품 제목: ${outline.title}
장르: ${input.genre}
분위기: ${input.mood}
키워드: ${input.keywords.join(", ")}

1화 제목: ${ep1?.title || "첫 번째 이야기"}
1화 요약: ${ep1?.summary || outline.act1.summary}
핵심 사건: ${ep1?.key_event || "주인공의 등장"}

캐릭터 정보:
${characters || "(캐릭터 시트 없음 — 아웃라인에 맞춰 자연스럽게 등장인물을 설정하세요)"}

위 설정을 바탕으로 1화 완성본을 작성해주세요. 4,000~5,000자 분량, 한국어 웹소설 문체로.`,
  };
}

export function getNextEpisodePrompt(
  input: GenerationInput,
  outline: OutlineData,
  characters: string,
  prevEpisodeEnd: string,
  episodeNumber: number,
  totalEpisodes: number
): { system: string; user: string } {
  // 아웃라인에서 해당 화의 정보 찾기
  const allEpisodes = [
    ...outline.act1.episodes,
    ...outline.act2.episodes,
    ...outline.act3.episodes,
  ];
  const epOutline = allEpisodes.find((e) => e.episode_number === episodeNumber);
  const isLastEpisode = episodeNumber === totalEpisodes;

  // 상세 아웃라인이 없는 후반 화(30화+)는 해당 구간의 아크 요약을 가이드로 사용
  const arc = !epOutline
    ? outline.arcs?.find((a) => {
        const [start, end] = a.range.split("-").map((n) => parseInt(n, 10));
        return (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          episodeNumber >= start &&
          episodeNumber <= end
        );
      })
    : undefined;

  // 지금까지의 전개 요약 (아웃라인 기준) — 장기 연재 시 설정·복선 망각 방지
  const prevRecap = allEpisodes
    .filter((e) => e.episode_number < episodeNumber)
    .sort((a, b) => a.episode_number - b.episode_number)
    .slice(-15)
    .map((e) => `${e.episode_number}화 「${e.title}」: ${e.key_event}`)
    .join("\n");

  return {
    system: `당신은 한국 웹소설 전문 작가입니다. 카카오페이지, 네이버 시리즈에서 연재하는 프로 작가 수준의 연재소설을 작성합니다.

필수 스타일 규칙:
- 한국어 웹소설 문체를 완벽하게 구사하세요
- 짧은 문장과 긴 문장을 리듬감 있게 섞으세요
- 대화와 내면 독백을 적절히 배분하세요 (대화 40%, 묘사 30%, 내면 30%)
- 감각적 묘사를 포함하세요 (시각, 청각, 촉각)
- 3,000~5,000자 분량으로 작성하세요 (공백 포함)
- 분위기 지침(${input.mood}): ${moodGuide(input.mood) || "선택된 분위기를 일관되게 유지하세요"}
- ${ageGuide(input.target_age)}
- 문단 사이에 빈 줄을 넣어 가독성을 높이세요
- "~했다", "~였다" 등 과거형 서술체를 기본으로 사용하세요
- 절대 JSON이 아닌 순수 소설 텍스트로만 응답하세요
- 직전 에피소드의 내용과 자연스럽게 이어지도록 작성하세요
- "지금까지의 전개"에 나온 사건·설정과 모순되지 않게 쓰세요
${isLastEpisode ? "- 이번 화가 마지막 화입니다. 적절한 결말을 작성하세요." : "- 회차 끝에 다음 화가 궁금해지는 클리프행어를 포함하세요."}`,
    user: `작품 제목: ${outline.title}
장르: ${input.genre}
분위기: ${input.mood}
전체 ${totalEpisodes}화 중 ${episodeNumber}화를 작성합니다.

${epOutline ? `${episodeNumber}화 제목: ${epOutline.title}
${episodeNumber}화 요약: ${epOutline.summary}
핵심 사건: ${epOutline.key_event}` : arc ? `이 화는 ${arc.range}화 아크에 속합니다. 아크 전개 방향:
${arc.summary}

위 아크의 흐름에 맞춰 ${episodeNumber}화의 사건을 구성하세요.` : `${episodeNumber}화를 아웃라인의 흐름에 맞춰 작성해주세요.`}

${prevRecap ? `지금까지의 전개 (아웃라인 기준):
${prevRecap}

` : ""}캐릭터 정보:
${characters || "(캐릭터 시트 없음 — 이전 화의 등장인물 설정을 유지하세요)"}

직전 에피소드 마지막 부분:
${prevEpisodeEnd}

위 내용을 이어서 ${episodeNumber}화 완성본을 작성해주세요. 3,000~5,000자 분량, 한국어 웹소설 문체로.`,
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
- 카카오페이지/네이버 시리즈 스타일의 어그로성 높은 제목을 생성하세요 (장르 키워드 포함)
- Midjourney/Flux 스타일의 영문 이미지 프롬프트를 작성하세요
- 해시태그는 한국 웹소설 독자가 실제 사용하는 형태의 태그로 생성하세요`,
    user: `작품 제목: ${outline.title}
로그라인: ${outline.logline}
장르: ${input.genre}
분위기: ${input.mood}
키워드: ${input.keywords.join(", ")}

아래는 형식 예시입니다. 실제 응답에서 titles는 5개, hashtags는 10개 이상, cover_prompts는 서로 다른 아트 스타일로 3개를 채우세요:
{
  "titles": ["제목 후보 1", "제목 후보 2"],
  "hashtags": ["#태그1", "#태그2"],
  "description": "작품 소개글 (100-150자)",
  "cover_prompts": [
    {
      "style": "스타일 설명 (예: 동양풍 수채화)",
      "prompt": "Midjourney/Flux 영문 프롬프트 (상세하게)",
      "negative_prompt": "제외할 요소 영문"
    }
  ]
}`,
  };
}
