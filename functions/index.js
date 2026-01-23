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

// Gemini API 모델 설정 (고정)
const MODEL_NAME = "gemini-2.5-flash"; // 안정적인 고성능 모델 (gemini-2.5-pro가 불안정하여 flash 사용)

// 프롬프트 설정 (Strategy Pattern)
const NOVEL_BASE_GUIDE = [
  "당신은 100만 부가 팔린 베스트셀러 작가다.",
  "요약문이 아니라 장면(Scene) 위주로 서술하라.",
  "대사, 행동, 배경 묘사를 통해 분량을 6,000자 이상으로 늘려라.",
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

const NONFICTION_BASE_GUIDE = [
  "당신은 해당 분야의 최고 전문가이자 권위자다.",
  "50자 이내의 주제를 씨앗으로 삼아 깊이 있는 통찰을 제시하라.",
  "분량은 3,000자 수준을 목표로 한다."
].join(" ");

const NONFICTION_CATEGORY_STYLES = {
  "essay": "개인적 경험에서 출발해 보편적 공감으로 확장하라. 문체는 부드럽고 서정적으로.",
  "self-help": "독자의 문제를 진단하고 구체적인 해결책(Action Item)을 제시하라.",
  "humanities": "철학적/인문학적 맥락을 제시하며 개념을 명확히 설명하라."
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

function buildSystemPrompt({isNovel, category, genre, endingStyle}) {
  if (isNovel) {
    const endingGuide = endingStyle
      ? `결말은 반드시 '${endingStyle}' 형태로 끝내며 그 톤을 유지하라.`
      : "결말은 독자의 여운을 남기는 방식으로 완성하라.";
    return [
      "당신은 [장르] 분야의 최고 작가입니다.",
      NOVEL_BASE_GUIDE,
      pickGenreGuide(genre),
      "절정에서는 갈등을 최고조로 끌어올리며, 전체 분량의 약 30%를 할애한다.",
      endingGuide
    ].join(" ");
  }

  return [
    "당신은 비소설 분야의 최고 저자입니다.",
    NONFICTION_BASE_GUIDE,
    pickNonfictionGuide(category)
  ].join(" ");
}

function buildStepPrompt({topic, currentStep, previousStorySummary, isNovel}) {
  const seed = topic || "";
  const summaryBlock = previousStorySummary
    ? `이전 내용 요약:\n${previousStorySummary}\n\n`
    : "";
  const baseInstruction = [
    `사용자가 준 주제는 "${seed}"입니다. 이 짧은 문장을 씨앗으로 삼아 풍성한 디테일을 상상하여 확장하세요.`,
    `이번 단계는 "${currentStep.name}" 입니다.`,
    `목표: ${currentStep.instruction}`,
    "단순한 줄거리가 아니라 대사와 묘사가 살아있는 생생한 본문을 작성하세요.",
    "순수 텍스트로만 작성하세요 (JSON 형식, 코드, 특수 기호 사용 금지).",
    "이전 내용을 반복하지 마세요.",
    "한국어로 작성하세요."
  ];

  if (isNovel) {
    baseInstruction.push("장면 전환과 감정선의 흐름이 자연스럽게 이어지도록 구성하세요.");
  } else {
    baseInstruction.push("논리적 흐름과 사례를 통해 설득력 있게 전개하세요.");
  }

  return `주제(Seed): ${seed}\n단계: ${currentStep.name}\n\n${summaryBlock}${baseInstruction.join("\n")}`;
}

// Gemini API 호출 함수
async function callGemini(systemPrompt, userPrompt, temperature = 0.75, isNovel = false) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  try {
    logger.info(`[Gemini API] 모델 사용: ${MODEL_NAME}`);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({model: MODEL_NAME});

    const safetySettings = isNovel ? [
      {category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH"},
      {category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH"},
      {category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH"},
      {category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH"}
    ] : undefined;

    const generationConfig = {
      temperature: temperature,
      maxOutputTokens: isNovel ? 4000 : 8192
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

    logger.info(`[Gemini API] ✅ 성공! 사용 모델: ${MODEL_NAME} (응답 길이: ${text.length}자)`);
    
    // 순수 텍스트만 반환
    return {content: text};
  } catch (error) {
    logger.error(`[Gemini API] 호출 실패 (모델: ${MODEL_NAME}):`, error.message);
    throw error;
  }
}

// 단계별 생성 함수
async function generateStep(systemPrompt, topic, currentStep, previousStorySummary, temperature, isNovel) {
  const userPrompt = buildStepPrompt({
    topic,
    currentStep,
    previousStorySummary,
    isNovel
  });
  const result = await callGemini(systemPrompt, userPrompt, temperature, isNovel);
  return result.content || '';
}

// 책 생성 함수
exports.generateBookAI = onCall(
  {
    region: REGION,
    maxInstances: 10
  },
  async (request) => {
    try {
      if (!GEMINI_API_KEY) {
        throw new HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");
      }

      const {category, subCategory, genre, keywords, isSeries, previousContext, endingStyle} = request.data;

      // 소설류 여부 확인
      const isNovel = category === "webnovel" || category === "novel" || category === "series";
      const temperature = isNovel ? 0.8 : 0.5;

      // 시스템 프롬프트
      const systemPrompt = buildSystemPrompt({
        isNovel,
        category,
        genre,
        endingStyle
      });

      // 단계 정의
      const steps = isNovel
        ? [
            {name: "발단", instruction: "스토리의 시작과 등장인물을 소개하세요."},
            {name: "전개", instruction: "사건을 발전시키고 갈등을 구축하세요."},
            {name: "위기", instruction: "갈등을 심화시키고 긴장감을 높이세요."},
            {name: "절정", instruction: "갈등을 최고조로 끌어올리고 전환점을 만드세요."},
            {name: "결말", instruction: "스토리를 해결하고 마무리하세요."}
          ]
        : [
            {name: "서론", instruction: "주제를 소개하고 독자의 관심을 끄세요."},
            {name: "본론", instruction: "주요 논점을 발전시키고 예시를 제시하세요."},
            {name: "결론", instruction: "핵심 메시지를 요약하고 마무리하세요."}
          ];

      let fullContent = "";
      const topic = `${keywords || ""} ${genre || ""}`.trim();

      // 단계별 생성
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const previousStorySummary = fullContent 
          ? fullContent.substring(Math.max(0, fullContent.length - 500)) 
          : (previousContext || "");
        
        try {
          const stepContent = await generateStep(
            systemPrompt,
            topic,
            step,
            previousStorySummary,
            temperature,
            isNovel
          );

          if (!stepContent || !stepContent.trim()) {
            throw new Error("빈 응답이 반환되었습니다.");
          }

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
      const title = titleMatch
        ? titleMatch[1].trim()
        : `${keywords || "작품"} - ${genre || category}`;

      // 요약 생성
      const summary = fullContent.substring(0, 200) + "...";

      return {
        title: title,
        content: fullContent.trim(),
        summary: summary
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

// 호환성 유지용 함수
exports.generateStoryAI = onCall(
  {
    region: REGION
  },
  async (request) => {
    return exports.generateBookAI(request);
  }
);
