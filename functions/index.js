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
  // 순수 텍스트 프롬프트 (JSON 구조 없음)
  const userPrompt = `다음 주제와 단계에 맞춰 책의 내용을 작성해주세요.

주제: ${topic}
단계: ${currentStep.name}
목표: ${currentStep.instruction}

${previousStorySummary ? `이전 내용 요약:\n${previousStorySummary}\n\n` : ''}위 내용을 이어서 ${currentStep.name} 부분을 작성해주세요. 

중요 사항:
- 순수 텍스트로만 작성하세요 (JSON 형식, 코드, 특수 기호 사용 금지)
- 문단으로 자연스럽게 작성하세요 (3-4문장 구성)
- 이전 내용을 반복하지 마세요
- 한국어로 작성하세요
- ${isNovel ? '몰입감 있고 창의적인 소설 스타일로 작성하세요' : '논리적이고 공감대를 형성하는 에세이 스타일로 작성하세요'}`;

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

      const {category, subCategory, genre, keywords, isSeries, previousContext} = request.data;

      // 소설류 여부 확인
      const isNovel = category === "webnovel" || category === "novel" || category === "series";
      const temperature = isNovel ? 0.8 : 0.5;

      // 시스템 프롬프트
      const systemPrompt = isNovel
        ? `당신은 베스트셀러 작가입니다. 창의적이고 몰입감 있는 소설을 작성하세요. 절대로 이전 문장을 그대로 반복하지 마십시오. 이야기를 반드시 새로운 국면으로 전개시키십시오. 등장인물의 대사나 행동을 통해 사건을 구체화하십시오.`
        : `당신은 유명한 에세이 작가입니다. 논리적이고 공감대를 형성하는 에세이를 작성하세요. 절대로 이전 문장을 그대로 반복하지 마십시오. 새로운 관점이나 통찰을 제공하십시오.`;

      // 단계 정의
      const steps = isNovel
        ? [
            {name: "발단", instruction: "스토리의 시작과 등장인물을 소개하세요."},
            {name: "전개", instruction: "사건을 발전시키고 갈등을 구축하세요."},
            {name: "위기", instruction: "갈등을 최고조로 올리고 반전을 주세요."},
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
        
        const stepContent = await generateStep(
          systemPrompt,
          topic,
          step,
          previousStorySummary,
          temperature,
          isNovel
        );

        fullContent += stepContent + "\n\n";
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
      logger.error("[generateBookAI] 에러:", error.message);
      
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
