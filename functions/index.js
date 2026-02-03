/**
 * Firebase Cloud Functions for AI Book Generation
 * Functions v2 API 사용
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Functions 리전 설정 (서울)
const REGION = "asia-northeast3";

// Gemini API 키
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Gemini API 모델 설정 (운영 비용 절감 - Flash 모델 사용)
const MODEL_NAME = "gemini-2.0-flash"; // 메인: 가성비 우수
const FALLBACK_MODEL_NAME = "gemini-1.5-flash"; // 대체: 저렴한 Flash

// 프롬프트 설정 (Strategy Pattern)
const NOVEL_BASE_GUIDE = [
  "[CRITICAL RULE] 출력된 content 내부에는 '## 제목', '### 발단', '**[전개]**', '### 결말' 등 그 어떤 마크다운 헤더나 섹션 구분자도 포함하지 마라. 오직 독자가 읽을 순수한 본문 텍스트만 출력하라.",
  "[CRITICAL RULE] 소설은 중간에 리셋하거나 앞 내용을 요약 반복하지 말고, 하나의 타임라인으로 쭉 이어가라.",
  "당신은 100만 부가 팔린 베스트셀러 작가다.",
  "요약문이 아니라 장면(Scene) 위주로 서술하라.",
  "전체 소설은 공백 포함 약 3,000자 내외로, 단계별 비율에 맞춰 작성하라.",
  "반드시 [발단-전개-위기-절정-결말]의 5단계 구조를 따른다."
].join(" ");

const NOVEL_GENRE_STYLES = [
  {
    matches: ["romance", "로맨스", "멜로"],
    guide: "설렘 포인트, 감정선 중심, 오해와 갈등, 달달한 결말을 강조하라."
  },
  {
    matches: ["sf", "sci-fi", "science fiction", "과학", "미래", "sf/fantasy"],
    guide: "독창적인 세계관을 구축하고 시각적 묘사를 화려하게 하라."
  },
  {
    matches: ["fantasy", "판타지"],
    guide: "마법/전설/모험의 분위기와 장대한 세계관을 생생하게 묘사하라."
  },
  {
    matches: ["무협", "wuxia", "martial", "martial arts"],
    guide: "의리, 수련, 강호 세계관을 중심으로 박진감 있게 전개하라."
  },
  {
    matches: ["horror", "호러", "공포"],
    guide: "숨 막히는 긴장감, 청각/촉각적 공포 묘사를 극대화하라."
  },
  {
    matches: ["thriller", "스릴러"],
    guide: "추적과 반전의 긴장감을 지속적으로 유지하라."
  },
  {
    matches: ["mystery", "미스터리", "추리"],
    guide: "단서를 배치하고 논리적 추론이 가능한 미스터리를 구성하라."
  }
];

const GENRE_SPECIFIC_INSTRUCTIONS = {
  "로맨스": "남녀 주인공 간의 설레는 감정선과 티키타카(대화의 재미)에 집중하십시오. 복잡한 배경 묘사보다는 인물의 심리와 관계 변화를 중심으로 서술하고, 치명적인 매력이나 오해와 질투 요소를 적극 활용하십시오.",
  "로맨스 판타지": "서양풍 귀족 사회를 배경으로, 화려한 드레스와 무도회 등의 시각적 요소를 강조하십시오. 남주인공은 권위적이고 차갑지만 여주인공에게만 다정한 '북부 대공' 스타일, 여주인공은 당차고 능력 있는 캐릭터로 묘사하십시오. 회귀/빙의/환생 요소가 있다면 이를 스토리의 핵심 동력으로 삼으십시오.",
  "판타지": "검과 마법, 몬스터가 존재하는 세계관을 웅장하게 그리십시오. 주인공의 모험과 성장, 동료들과의 유대감을 강조하며, 전투 장면에서는 마법 주문이나 검술의 이펙트를 화려하고 박진감 넘치게 묘사하십시오.",
  "현대 판타지": "현대 한국 사회를 배경으로 하되, '상태창(System)', '던전', '각성' 같은 게임적 요소를 적극 활용하십시오. 주인공이 특별한 능력으로 사회적 성공을 거두거나 적들을 압도하는 '사이다' 전개를 최우선으로 하십시오. 고구마 같은 답답한 전개는 피하십시오.",
  "무협": "중원 무림을 배경으로 '구파일방', '마교' 등의 세력 다툼을 그리십시오. 문체는 약간의 고풍스러운 어조를 사용하고, 내공, 검기, 경공 등 무협 고유의 용어를 반드시 포함하여 무공 대결을 묘사하십시오. '협(의리)'과 '복수'의 정서를 강조하십시오.",
  "미스터리/공포": "독자의 숨통을 조이는 긴장감(Suspense) 조성에 집중하십시오. 미지의 존재에 대한 공포, 좁혀오는 포위망, 끔찍한 묘사를 생생하게 하되, 주인공의 생존 본능과 절박함을 극대화하십시오.",
  "SF": "미래 기술, 우주, AI가 일상화된 세계를 그리되, 기술이 가져온 인간의 변화나 디스토피아적 상황에서의 생존에 초점을 맞추십시오.",
  "드라마": "인물 간의 갈등과 화해, 그리고 인간적인 고뇌를 깊이 있게 다루십시오. 자극적인 사건보다는 현실적인 문제(가족, 직장, 꿈)를 소재로 하여 독자의 공감을 이끌어내고 감동을 주는 서사를 만드십시오.",
  "미스터리/추리": "논리적인 인과관계와 트릭, 복선 회수에 집중하십시오. 범인의 심리전이나 탐정의 추리 과정을 치밀하게 설계하고, 결말의 반전을 위해 정보를 제한적으로 제공하여 독자의 궁금증을 유발하십시오.",
  "스릴러": "범죄, 음모, 추격전 등 긴박한 상황을 속도감 있는 문체로 서술하십시오. 심리적 압박감과 타임리밋 요소를 활용하여 독자가 책을 덮지 못하게 만드십시오.",
  "역사": "철저한 시대적 고증과 당시의 생활상, 언어적 특징을 반영하여 현장감을 살리십시오. 역사의 거대한 흐름 속에 던져진 개인의 운명을 비장미 넘치게 혹은 담담하게 서술하십시오.",
  "힐링": "자극적인 갈등을 최소화하고, 따뜻하고 편안한 분위기를 조성하십시오. 숲속의 오두막, 심야 식당 등 특정 장소의 감각적 묘사(향기, 소리, 날씨)를 통해 독자가 위로받는 느낌을 주십시오."
};

const NOVEL_MOOD_OPTIONS = {
  webnovel: {
    Action: ['사이다/먼치킨(압도적 힘)', '피폐/느와르(처절함)', '코믹/착각계(유쾌함)', '정통/성장형(감동)'],
    Romance: ['달달/힐링(설렘)', '후회/집착(도파민)', '혐관/배틀(티키타카)', '사이다/복수(걸크러시)'],
    Thriller: ['오컬트/기담(공포)', '슬래셔/고어(잔혹)', '두뇌전/심리(긴장감)']
  },
  novel: {
    Drama: ['서정적/잔잔한', '현실적/사실주의', '비극적/애절한', '격정적/파란만장'],
    Romance: ['담백한/현실연애', '클래식/멜로', '아련한/첫사랑'],
    Genre: ['하드보일드/건조한', '정통 추리/논리적', '철학적/사색적']
  }
};

const NONFICTION_BASE_GUIDE = [
  "[CRITICAL RULE] 출력된 content 내부에는 '## 제목', '### 발단', '**[전개]**', '### 결말' 등 그 어떤 마크다운 헤더나 섹션 구분자도 포함하지 마라. 오직 독자가 읽을 순수한 본문 텍스트만 출력하라.",
  "[CRITICAL RULE] 비소설은 '결론' 같은 소제목 없이 문맥으로 자연스럽게 마무리하라.",
  "당신은 해당 분야의 최고 전문가이자 권위자다.",
  "입력된 키워드와 책 제목의 분위기/의도를 정확히 반영해 서술하라.",
  "50자 이내의 주제를 씨앗으로 삼아 깊이 있는 통찰을 제시하라.",
  "공백 포함 약 2,000자 내외로 핵심 메시지를 명확히 전달하라."
].join(" ");

const NONFICTION_CATEGORY_STYLES = {
  "essay": "개인적 경험에서 출발해 보편적 공감으로 확장하라. 문체는 부드럽고 서정적으로.",
  "self-help": "독자의 문제를 진단하고 구체적인 해결책(Action Item)을 제시하라.",
  "humanities": "철학적/인문학적 맥락을 제시하며 개념을 명확히 설명하라."
};

const NONFICTION_TONE_OPTIONS = {
  essay: ['담백한/건조한', '감성적인/시적인', '유머러스한/위트있는', '친근한/구어체'],
  'self-help': ['따뜻한 위로/격려', '강한 동기부여/독설', '논리적인/분석적인', '경험담 위주'],
  humanities: ['질문을 던지는/사색적인', '날카로운 비판', '대화 형식/인터뷰', '쉬운 해설/스토리텔링']
};

function pickGenreGuide(genre) {
  const normalized = (genre || "").toString().trim().toLowerCase();
  const matched = NOVEL_GENRE_STYLES.find((style) =>
    style.matches.some((key) => normalized.includes(key.toLowerCase()))
  );
  return matched
    ? matched.guide
    : "장르 특성에 맞게 분위기와 문체를 확실히 차별화하라.";
}

function pickNonfictionGuide(category) {
  return NONFICTION_CATEGORY_STYLES[category] || "논리적 흐름과 근거를 갖춘 깊이 있는 설명을 제공하라.";
}

function pickGenreGuideline(genre) {
  const key = (genre || "").toString().trim();
  return GENRE_SPECIFIC_INSTRUCTIONS[key] || "장르에 맞는 흥미로운 이야기를 쓰세요.";
}

function normalizeNovelTrack(category, subCategory) {
  if (category === "webnovel") return "webnovel";
  if (category === "novel") return "novel";
  if (category === "series") {
    return (subCategory || "").toString().trim().toLowerCase() === "webnovel"
      ? "webnovel"
      : "novel";
  }
  return null;
}

function resolveNovelMoodGroup(track, genre) {
  const genreName = (genre || "").toString().trim();
  if (track === "webnovel") {
    if (["판타지", "현대 판타지", "무협", "SF"].includes(genreName)) return "Action";
    if (["로맨스", "로맨스 판타지"].includes(genreName)) return "Romance";
    if (["미스터리/공포"].includes(genreName)) return "Thriller";
  }
  if (track === "novel") {
    if (["드라마", "역사", "힐링"].includes(genreName)) return "Drama";
    if (["로맨스"].includes(genreName)) return "Romance";
    if (["미스터리/추리", "스릴러", "SF"].includes(genreName)) return "Genre";
  }
  return null;
}

function buildNovelMoodInstruction(category, subCategory, genre, selectedMood) {
  const mood = (selectedMood || "").toString().trim();
  if (!mood) {
    return null;
  }
  const track = normalizeNovelTrack(category, subCategory);
  if (!track) {
    return null;
  }
  const group = resolveNovelMoodGroup(track, genre);
  if (!group) {
    return null;
  }
  const options = NOVEL_MOOD_OPTIONS[track]?.[group] || [];
  if (options.length > 0 && !options.includes(mood)) {
    return null;
  }
  return `[Style Guideline] 선택된 분위기 '${mood}'를 살려 문체와 전개 속도를 조절하라.`;
}

function buildNonfictionToneInstruction(category, selectedTone) {
  const tone = (selectedTone || "").toString().trim();
  if (!tone) {
    return null;
  }
  const toneOptions = NONFICTION_TONE_OPTIONS[category] || [];
  if (toneOptions.length > 0 && !toneOptions.includes(tone)) {
    return null;
  }

  const categoryName = category === "essay"
    ? "에세이"
    : category === "self-help"
      ? "자기계발"
      : "철학";

  return `당신은 ${categoryName} 작가입니다. 사용자가 선택한 키워드를 주제로 글을 쓰되, 반드시 '${tone}' 스타일을 유지하여 서술하십시오. 문장의 어미, 단어 선택, 분위기를 이 스타일에 맞춰야 합니다.`;
}

function buildSystemPrompt({isNovel, category, subCategory, genre, endingStyle, selectedTone, selectedMood}) {
  if (isNovel) {
    const endingGuide = endingStyle
      ? `결말은 반드시 '${endingStyle}' 형태로 끝내며 그 톤을 유지하라.`
      : "결말은 독자의 여운을 남기는 방식으로 완성하라.";
    const moodGuide = buildNovelMoodInstruction(category, subCategory, genre, selectedMood);
    return [
      `[Genre Guideline]: ${pickGenreGuideline(genre)}`,
      moodGuide,
      "당신은 [장르] 분야의 최고 작가입니다.",
      NOVEL_BASE_GUIDE,
      pickGenreGuide(genre),
      "절정에서는 갈등을 최고조로 끌어올리며, 전체 분량의 약 30%를 할애한다.",
      endingGuide
    ].filter(Boolean).join(" ");
  }

  const toneInstruction = buildNonfictionToneInstruction(category, selectedTone);
  return [
    "당신은 비소설 분야의 최고 저자입니다.",
    toneInstruction ? `[지침] ${toneInstruction}` : "[지침] 장르에 맞는 흥미로운 이야기를 쓰세요.",
    NONFICTION_BASE_GUIDE,
    pickNonfictionGuide(category)
  ].filter(Boolean).join(" ");
}

function buildStepPrompt({
  topic,
  currentStep,
  previousStorySummary,
  lastParagraph,
  synopsis,
  characterSheet,
  settingSheet,
  isNovel,
  title
}) {
  const seed = topic || "";
  const titleLine = title ? `책 제목은 "${title}"입니다. 제목의 분위기와 주제에 어울리게 전개하세요.` : "";
  const summaryBlock = previousStorySummary
    ? `Story Summary (누적 요약):\n${previousStorySummary}\n`
    : "Story Summary (누적 요약): (없음)\n";
  const lastBlock = lastParagraph
    ? `Last Paragraph (직전 내용 3~5문장):\n${lastParagraph}\n`
    : "Last Paragraph (직전 내용 3~5문장): (없음)\n";
  const staticContext = isNovel
    ? `Static Context:\nSynopsis:\n${synopsis || "(없음)"}\n\nCharacter Sheet (이름/성격 절대 유지):\n${characterSheet || "(없음)"}\n\nSetting Sheet (시대/장소/세계관 절대 유지):\n${settingSheet || "(없음)"}\n\n`
    : "";
  const dynamicContext = isNovel
    ? `Dynamic Context:\n${summaryBlock}\n${lastBlock}\n`
    : summaryBlock + "\n";
  const baseInstruction = [
    `사용자가 준 주제는 "${seed}"입니다. 이 짧은 문장을 씨앗으로 삼아 풍성한 디테일을 상상하여 확장하세요.`,
    titleLine,
    `Task: 이번에는 "${currentStep.name}" 단계를 작성하세요.`,
    `가이드라인: ${currentStep.instruction}`,
    isNovel
      ? "Show, Don't Tell 방식으로 보여주기 위주로 서술하세요. 대화문과 묘사를 적극 활용하세요."
      : "Persuasive & Insightful 톤으로 논리적 흐름을 유지하고, 독자에게 말을 거는 듯한 어조로 작성하세요.",
    "순수 텍스트로만 작성하세요 (JSON 형식, 코드, 특수 기호 사용 금지).",
    "이전 내용을 반복하지 마세요.",
    "한국어로 작성하세요."
  ];

  if (isNovel) {
    baseInstruction.push("장면 전환과 감정선의 흐름이 자연스럽게 이어지도록 구성하세요.");
  } else {
    baseInstruction.push("논리적 흐름과 설득력 있는 근거로 전개하세요.");
  }

  return `주제(Seed): ${seed}\n단계: ${currentStep.name}\n\n${staticContext}${dynamicContext}${baseInstruction.join("\n")}`;
}

function extractLastSentences(content, maxSentences = 5) {
  const cleaned = (content || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentences = cleaned.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const take = Math.min(maxSentences, sentences.length);
  return sentences.slice(Math.max(0, sentences.length - take)).join(" ");
}

async function summarizeStepContent(content, systemPrompt, isNovel) {
  const prompt = [
    "다음 글을 한국어로 정확히 3줄로 요약해라.",
    "각 줄은 1~2문장으로 간결하게 작성하라.",
    "불릿/번호/특수기호 없이 줄바꿈만 사용하라.",
    "요약문에 새 정보를 추가하지 마라.",
    "본문:",
    content || ""
  ].join("\n");
  const result = await callGemini(systemPrompt, prompt, 0.2, isNovel);
  return (result.content || "").trim();
}

async function generateStaticContext(systemPrompt, topic, title, genre, isNovel, isSeries = false) {
  if (!isNovel) {
    return {synopsis: "", characterSheet: "", settingSheet: ""};
  }
  const seriesNote = isSeries
    ? " (이 작품은 연재 시리즈이므로, 시놉시스는 전체 서사 골격만 잡고 결말을 드러내지 마라. 1화에서 시작할 이야기의 씨앗과 갈등의 가능성만 제시하라.)"
    : "";
  const prompt = [
    "다음 정보를 바탕으로 소설의 고정 정보를 만들어라.",
    "출력 형식은 반드시 아래 구조를 지켜라:",
    "",
    "Synopsis:",
    `- 5~7문장 분량의 전체 시놉시스${seriesNote}`,
    "",
    "Character Sheet:",
    "- 이름: (고유명사)",
    "  성격: (핵심 성격 2~3가지)",
    "  절대 유지 조건: (이름/성격은 절대 변경 금지)",
    "",
    "Setting Sheet:",
    "- 시대배경: (연대, 시대적 분위기, 역사적 맥락 등)",
    "- 장소배경: (주요 무대가 되는 장소들, 지역 특성, 분위기)",
    "- (판타지/SF 등이면) 세계관 규칙: (마법/기술/사회 체계 등 일관되게 유지할 규칙)",
    "- 배경은 절대 변경 금지. 각 단계에서 이 배경을 정확히 따르라.",
    "",
    `주제: ${topic || ""}`,
    title ? `책 제목: ${title}` : "",
    genre ? `장르: ${genre}` : ""
  ].filter(Boolean).join("\n");
  const result = await callGemini(systemPrompt, prompt, 0.6, true);
  const text = (result.content || "").trim();
  const synopsisMatch = text.match(/Synopsis:\s*([\s\S]*?)(?=\n\s*Character Sheet:|\n\s*Characters:|$)/i);
  const characterMatch = text.match(/Character Sheet:\s*([\s\S]*?)(?=\n\s*Setting Sheet:|\n\s*배경시트:|$)/i) || text.match(/Characters:\s*([\s\S]*?)(?=\n\s*Setting Sheet:|\n\s*배경시트:|$)/i);
  const settingMatch = text.match(/Setting Sheet:\s*([\s\S]*)/i) || text.match(/배경시트:\s*([\s\S]*)/i);
  return {
    synopsis: (synopsisMatch?.[1] || text).trim(),
    characterSheet: (characterMatch?.[1] || "").trim(),
    settingSheet: (settingMatch?.[1] || "").trim()
  };
}

function getErrorStatus(error) {
  return (
    error?.status ||
    error?.code ||
    error?.response?.status ||
    error?.details?.status ||
    null
  );
}

function isRetryableStatus(status) {
  return status === 500 || status === 503;
}

// Gemini API 호출 함수
async function callGemini(systemPrompt, userPrompt, temperature = 0.75, isNovel = false, modelName = MODEL_NAME, allowFallback = true) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  try {
    logger.info(`[Gemini API] 모델 사용: ${modelName}`);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({model: modelName});

    const safetySettings = isNovel ? [
      {category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH"},
      {category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH"},
      {category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH"},
      {category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH"}
    ] : undefined;

    const generationConfig = {
      temperature: temperature,
      maxOutputTokens: isNovel ? 6000 : 8192  // 소설 3000자/비소설 2000자 분량 대응
    };

    if (isNovel) {
      generationConfig.topP = 0.9;
    }

    const result = await model.generateContent({
      contents: [{role: "user", parts: [{text: userPrompt}]}],
      systemInstruction: systemPrompt,
      generationConfig: generationConfig,
      safetySettings: safetySettings
    });

    const response = result.response;
    const text = response.text();

    logger.info(`[Gemini API] ✅ 성공! 사용 모델: ${modelName} (응답 길이: ${text.length}자)`);
    
    // 순수 텍스트만 반환
    return {content: text};
  } catch (error) {
    const status = getErrorStatus(error);
    logger.error(`[Gemini API] 호출 실패 (모델: ${modelName}):`, error.message);

    if (allowFallback && isRetryableStatus(status)) {
      logger.warn(`[Gemini API] 재시도: ${FALLBACK_MODEL_NAME} (status: ${status})`);
      return callGemini(systemPrompt, userPrompt, temperature, isNovel, FALLBACK_MODEL_NAME, false);
    }

    throw error;
  }
}

// 단계별 생성 함수
async function generateStep({
  systemPrompt,
  topic,
  currentStep,
  previousStorySummary,
  lastParagraph,
  synopsis,
  characterSheet,
  settingSheet,
  temperature,
  isNovel,
  title
}) {
  const userPrompt = buildStepPrompt({
    topic,
    currentStep,
    previousStorySummary,
    lastParagraph,
    synopsis,
    characterSheet,
    settingSheet,
    isNovel,
    title
  });
  const result = await callGemini(systemPrompt, userPrompt, temperature, isNovel);
  return result.content || '';
}

// 책 생성 함수
exports.generateBookAI = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 540
  },
  async (request) => {
    try {
      if (!GEMINI_API_KEY) {
        throw new HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");
      }

      const {category, subCategory, genre, keywords, isSeries, previousContext, endingStyle, title, selectedTone, selectedMood} = request.data;

      // 소설류 여부 확인
      const isNovel = category === "webnovel" || category === "novel" || category === "series";
      const temperature = isNovel ? 0.8 : 0.5;

      // 시스템 프롬프트
      const systemPrompt = buildSystemPrompt({
        isNovel,
        category,
        subCategory,
        genre,
        endingStyle,
        selectedTone,
        selectedMood
      });

      // 단계 정의 (시리즈 1화는 훅으로 끝나게, 단편/비시리즈는 5단계)
      const steps = isNovel
        ? (isSeries
            ? [
                {name: "시작", instruction: "주인공과 배경을 매력적으로 묘사하세요. 독자가 이야기 세계에 빠져들 수 있도록 생생하게 그려내세요. [분량: 전체의 약 40%, 공백 포함 약 1,200자]"},
                {name: "사건과 훅", instruction: "평온하던 일상을 깨뜨리는 '사건(Inciting Incident)'을 발생시키세요. 주인공에게 모험이나 문제가 다가오는 장면을 보여주세요. [중요] 사건을 해결하지 말고, 주인공이 모험을 떠나거나 문제에 직면하는 순간에서 멈추세요. 마지막 문장은 다음 화가 궁금해서 미치게 만드는 '절단신공(Cliffhanger)'으로 끝내세요. [분량: 전체의 약 60%, 공백 포함 약 1,800자]"}
              ]
            : [
                {name: "발단", instruction: "스토리의 시작과 등장인물을 소개하세요. [분량: 전체의 약 10%, 공백 포함 약 300자]"},
                {name: "전개", instruction: "사건을 발전시키고 갈등을 구축하세요. [분량: 전체의 약 20%, 공백 포함 약 600자]"},
                {name: "위기", instruction: "갈등을 심화시키고 긴장감을 높이세요. 중요한 전환 구간이므로 충분히 묘사하세요. [분량: 전체의 약 25%, 공백 포함 약 750자]"},
                {name: "절정", instruction: "갈등을 최고조로 끌어올리고 전환점을 만드세요. 가장 핵심적인 장면이므로 분량을 넉넉히 할애하세요. [분량: 전체의 약 30%, 공백 포함 약 900자]"},
                {name: "결말", instruction: "스토리를 해결하고 마무리하세요. [분량: 전체의 약 15%, 공백 포함 약 450자]"}
              ])
        : [
            {name: "서론", instruction: "주제 제기, 독자의 흥미 유발, 문제 의식 공유. [분량: 전체의 약 25%, 공백 포함 약 500자]"},
            {name: "본론 1", instruction: "주제에 대한 깊이 있는 통찰, 작가의 경험이나 예시. [분량: 전체의 약 25%, 공백 포함 약 500자]"},
            {name: "본론 2", instruction: "구체적인 해결책, 철학적 사색, 혹은 반전된 시각 제시. 핵심 논점이므로 충분히 전개하세요. [분량: 전체의 약 30%, 공백 포함 약 600자]"},
            {name: "결론", instruction: "핵심 메시지 요약, 독자에게 주는 제언, 여운이 남는 마무리. [분량: 전체의 약 20%, 공백 포함 약 400자]"}
          ];

      let fullContent = "";
      const topic = `${keywords || ""} ${genre || ""}`.trim();

      const requestedTitle = (title || "").toString().trim().slice(0, 15);
      const staticContext = await generateStaticContext(
        systemPrompt,
        topic,
        requestedTitle,
        genre,
        isNovel,
        isSeries
      );
      let storySummary = (previousContext || "").toString().trim();
      let lastParagraph = "";
      const stepResults = [];

      // 단계별 생성
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const previousStorySummary = storySummary || "";
        
        try {
          const stepContent = await generateStep({
            systemPrompt,
            topic,
            currentStep: step,
            previousStorySummary,
            lastParagraph,
            synopsis: staticContext.synopsis,
            characterSheet: staticContext.characterSheet,
            settingSheet: staticContext.settingSheet,
            temperature,
            isNovel,
            title: requestedTitle
          });

          if (!stepContent || !stepContent.trim()) {
            throw new Error("빈 응답이 반환되었습니다.");
          }

          const stepSummary = await summarizeStepContent(stepContent, systemPrompt, isNovel);
          if (stepSummary) {
            storySummary = storySummary ? `${storySummary}\n${stepSummary}` : stepSummary;
          }
          lastParagraph = extractLastSentences(stepContent, 5);

          stepResults.push({
            name: step.name,
            content: stepContent.trim(),
            summary: stepSummary
          });

          fullContent += stepContent + "\n\n";
        } catch (error) {
          logger.error(`[generateBookAI] 단계 실패: ${step.name}`, {
            message: error?.message,
            stack: error?.stack
          });
          throw error;
        }
      }

      // 제목 생성
      const titleMatch = fullContent.match(/^#\s*(.+)$/m);
      const generatedTitle = titleMatch
        ? titleMatch[1].trim()
        : `${keywords || "작품"} - ${genre || category}`;
      const finalTitle = requestedTitle || generatedTitle;

      // 요약 생성
      const summary = fullContent.substring(0, 200) + "...";

      return {
        title: finalTitle,
        content: fullContent.trim(),
        summary: summary,
        steps: stepResults,
        storySummary: storySummary,
        synopsis: staticContext.synopsis,
        characterSheet: staticContext.characterSheet,
        settingSheet: staticContext.settingSheet
      };
    } catch (error) {
      logger.error("[generateBookAI] 에러:", {
        message: error?.message,
        stack: error?.stack
      });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `책 생성 중 오류가 발생했습니다: ${error.message}`);
    }
  }
);

// 시리즈 이어쓰기 함수
exports.generateSeriesEpisode = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 540
  },
  async (request) => {
    try {
      if (!GEMINI_API_KEY) {
        throw new HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");
      }

      const {
        seriesId,
        category,
        subCategory,
        genre,
        keywords,
        title,
        cumulativeSummary,
        lastEpisodeContent,
        synopsis,
        characterSheet,
        settingSheet,
        continuationType,
        selectedMood
      } = request.data;

      if (!seriesId || !continuationType) {
        throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
      }

      const isNovel = true;
      const temperature = 0.8;
      const isFinalize = continuationType === 'finalize';

      // 시스템 프롬프트
      const systemPrompt = buildSystemPrompt({
        isNovel: true,
        category,
        subCategory,
        genre,
        endingStyle: isFinalize ? '닫힌 결말 (해피 엔딩)' : null,
        selectedTone: null,
        selectedMood
      });

      const topic = `${keywords || ""} ${genre || ""}`.trim();
      const requestedTitle = (title || "").toString().trim();
      
      const lastParagraph = extractLastSentences(lastEpisodeContent || "", 10);
      const previousStorySummary = cumulativeSummary || "";

      // 시리즈 집필 단계별 지침 (Narrative Arc)
      const step = isFinalize
        ? {
            name: "완결",
            instruction: [
              "지금까지 쌓아온 갈등이 터지는 '절정(Climax)'을 묘사하라.",
              "악당을 물리치거나, 목표를 달성(또는 실패)하는 결과를 보여라.",
              "등장인물들의 후일담이나 깨달음을 보여주며 이야기를 완전히 종결(Close)지어라.",
              "떡밥(Clues)을 모두 회수하고 독자에게 여운을 남겨라."
            ].join(" ")
          }
        : {
            name: "다음 화",
            instruction: [
              "[금지] 절대 다시 '자기소개'나 '배경설명'을 하지 마라. 바로 직전 상황에서 이어가라.",
              "주인공에게 시련, 딜레마, 새로운 적대자를 던져라.",
              "문제를 쉽게 해결해주지 마라. 상황을 더 꼬이게 만들어라(Complication).",
              "마지막 문장은 다음 화가 궁금해서 미치게 만드는 '절단신공(Cliffhanger)'으로 끝내라.",
              "절대 결말을 짓지 마라."
            ].join(" ")
          };

      const stepContent = await generateStep({
        systemPrompt,
        topic,
        currentStep: step,
        previousStorySummary,
        lastParagraph,
        synopsis: synopsis || "",
        characterSheet: characterSheet || "",
        settingSheet: settingSheet || "",
        temperature,
        isNovel: true,
        title: requestedTitle
      });

      if (!stepContent || !stepContent.trim()) {
        throw new Error("빈 응답이 반환되었습니다.");
      }

      const stepSummary = await summarizeStepContent(stepContent, systemPrompt, true);
      const updatedSummary = previousStorySummary
        ? `${previousStorySummary}\n${stepSummary}`
        : stepSummary;

      return {
        content: stepContent.trim(),
        summary: stepSummary,
        cumulativeSummary: updatedSummary,
        isFinale: isFinalize
      };
    } catch (error) {
      logger.error("[generateSeriesEpisode] 에러:", {
        message: error?.message,
        stack: error?.stack
      });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `시리즈 집필 중 오류가 발생했습니다: ${error.message}`);
    }
  }
);

// 호환성 유지용 함수
exports.generateStoryAI = onCall(
  {
    region: REGION
  },
  async (request) => {
    return exports.generateBookAI(request);
  }
);
