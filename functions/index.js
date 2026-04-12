/**
 * Firebase Cloud Functions for AI Book Generation
 * Functions v2 API 사용
 */

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!admin.apps.length) admin.initializeApp();
const adminDb = admin.firestore();

const ADMIN_EMAILS = ["admin@odok.app"];
const ADMIN_EMAIL_PATTERN = /banlan21/;
function isAdminUser(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email) || ADMIN_EMAIL_PATTERN.test(email);
}

// Functions 리전 설정 (서울)
const REGION = "asia-northeast3";

// Gemini API 키
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Gemini API 모델 설정 (운영 비용 절감 - Flash 모델 사용)
// 429 시 순서대로 시도 (모델별 쿼터가 다를 수 있음)
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",       // 메인
  "gemini-2.5-flash-lite",  // 대체 1
  "gemini-2.5-pro",         // 대체 2 (고품질, 비용 높음)
];

// 프롬프트 설정 (Strategy Pattern)
const NOVEL_BASE_GUIDE = [
  "[CRITICAL RULE] 출력된 content 내부에는 '## 제목', '### 발단', '**[전개]**', '### 결말' 등 그 어떤 마크다운 헤더나 섹션 구분자도 포함하지 마라. 오직 독자가 읽을 순수한 본문 텍스트만 출력하라.",
  "[CRITICAL RULE] [제목], [줄거리], [요약], [브릿지], [전개], [결말], [설정], [캐릭터] 등 대괄호로 감싼 메타 정보를 본문에 절대 출력하지 마라. 너의 내부 추론이나 요약도 출력하지 마라. 오직 '소설의 본문 내용'만 작성하라.",
  "[CRITICAL RULE] '물리적 상태', '심리적 상태', '미해결 정보', '물리적상태', '심리적상태', '미해결정보', 'Story Summary', 'Character Sheet', 'Setting Sheet' 등 내부 작업용 라벨을 본문에 절대 표시하지 마라. 이 정보들은 참고용으로만 활용하고, 독자가 보는 본문에는 절대 포함하지 마라.",
  "[CRITICAL RULE] 장면이 바뀔 때 설명이나 태그 대신 자연스러운 문장이나 빈 줄로만 구분하라. 불필요한 태그, 괄호, 라벨을 모두 삭제하라. 독자가 읽는 책이라고 생각하라.",
  "[CRITICAL RULE] 소설은 중간에 리셋하거나 앞 내용을 요약 반복하지 말고, 하나의 타임라인으로 쭉 이어가라.",
  "[CRITICAL RULE] 반드시 한국어만 사용하라. 러시아어, 한자, 일본어, 아랍어 등 그 밖의 언어를 절대 사용하지 마라. 오직 한글, 공백, 기본 문장부호, 숫자만 사용하라.",
  "당신은 독자를 사로잡는 베스트셀러 작가다. 매 문장이 다음 문장을 읽게 만드는 흡인력을 가져야 한다.",
  "요약이 아닌 장면(Scene) 위주로 서술하라. 감각적 묘사(시각·청각·촉각·후각)와 인물의 감정을 생생하게 보여주어라.",
  "[Show, Don't Tell] '그는 슬펐다', '그녀는 화가 났다' 같은 감정 직접 서술을 절대 하지 마라. 대신 행동·표정·신체 반응으로 보여줘라. 예: '주먹을 쥔 손이 하얗게 질렸다', '목소리가 가늘게 떨렸다', '시선을 피하며 입술을 깨물었다'. 독자가 감정을 스스로 느끼게 하라.",
  "[대화문 품질] 대화는 캐릭터의 성격·나이·직업이 묻어나게 써라. 모든 캐릭터가 같은 말투로 말하면 안 된다. 대화 사이에 행동 묘사(비트)를 넣어 장면감을 살려라. 예: '\"괜찮아.\" 그는 고개를 돌리며 말했다. 손끝이 미세하게 떨리고 있었다.'",
  "인위적이거나 너무 뻔한 전개는 피하라. 예상을 빗나가는 반전과 자연스러운 개연성을 동시에 갖춰라.",
  "[금지] '마치 ~처럼', '~인 듯 했다', '~할 수밖에 없었다' 같은 상투적 표현의 남용을 피하라. 신선한 비유와 구체적 묘사를 사용하라."
].join(" ");

// 시리즈 연속 집필 시 캐릭터·설정 일관성 유지 지침 (시리즈 전용)
const NOVEL_SERIES_CONTEXT_GUIDE = [
  "[시리즈 연속성 지침]",
  "제공된 Synopsis는 전체 이야기의 방향이므로 반드시 따르고 절대 변경하지 마라.",
  "Character Sheet의 이름·성격·말투·버릇을 매 화 일관되게 유지하라. 캐릭터가 갑자기 다른 성격으로 바뀌어서는 안 된다.",
  "Setting Sheet의 시대·장소·세계관 규칙을 절대 바꾸지 마라.",
  "Story Summary(누적 요약)로 현재까지 일어난 사건을 파악하고, 직전 장면 브릿지 정보를 반드시 참고하여 이야기를 자연스럽게 이어가라.",
  "앞 화에서 제시된 복선과 미해결 사항을 기억하고 적절히 활용하라."
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
  "로맨스": "두 주인공 사이의 감정 변화를 세밀하게 추적하십시오. 첫 만남의 설렘, 오해로 인한 거리감, 질투나 경쟁이 만드는 긴장감, 마침내 마음이 열리는 순간을 각각 뚜렷한 장면으로 보여주십시오. 대화 속 숨겨진 감정(말하지 못한 고백, 눈빛, 손끝의 떨림)을 살려 독자가 두 사람의 설렘을 함께 느끼게 하십시오. '나 지금 심장이 쿵' 같은 직접 서술보다 상대방의 행동 하나에 멈춰버리는 장면으로 감정을 전달하십시오.",
  "로맨스 판타지": "서양풍 귀족 세계의 화려함과 냉혹한 권력 다툼을 동시에 그리십시오. 남주인공은 차갑고 위압적이지만 여주인공 앞에서만 균열이 생기는 순간을 포착하십시오. 회귀·빙의·환생 요소가 있다면 전생의 기억이 현재 선택에 미치는 긴장감을 극대화하십시오. 무도회 드레스, 촛불이 흔들리는 성관 홀, 마차 안의 침묵 등 시각·촉각적 배경 묘사로 몰입감을 높이십시오. 여주인공은 수동적 피해자가 아닌 자신의 운명을 개척하는 능동적 인물로 그리십시오.",
  "판타지": "세계관의 규칙(마법 체계, 종족 갈등, 지리)을 초반부터 자연스럽게 독자에게 보여주되 설명 덩어리가 되지 않게 하십시오. 전투 장면은 마법의 시각적 이펙트와 인물의 신체 감각(호흡, 땀, 근육의 긴장)을 함께 묘사해 박진감을 살리십시오. 주인공의 성장은 단순한 능력 상승이 아닌 내면의 갈등과 선택을 통해 보여주십시오. 동료와의 관계에 균열과 신뢰 회복의 감동을 담아 이야기에 깊이를 더하십시오.",
  "현대 판타지": "현실의 평범한 일상과 초자연적 요소의 충돌을 생생하게 그리십시오. '각성' 후 주인공이 시스템 창(UI)을 처음 인식하는 장면을 독자가 함께 낯설고 경이롭게 느끼도록 묘사하십시오. '사이다' 전개를 위해 기존 강자들이 주인공을 무시하다 충격을 받는 장면을 명확하고 통쾌하게 연출하십시오. 던전·몬스터의 위협은 구체적인 감각(냄새, 공기 압박, 소리)으로 현실감 있게 묘사하십시오. 답답한 전개를 피하고 주인공이 문제를 능동적으로 해결하게 하십시오.",
  "무협": "중원 강호의 정사(正邪) 대립과 문파 간 세력 다툼을 배경으로 삼으십시오. 무공 대결은 초식의 이름과 기세, 대지를 울리는 내공의 충돌을 고풍스러운 어조와 긴장감 있는 문장으로 묘사하십시오. '협(俠)'의 정신—의리, 약자 보호, 불의에 대한 분노—이 주인공의 행동 동기로 드러나게 하십시오. 복수의 서사라면 원한이 쌓이게 된 과거 장면과 현재의 침묵을 교차하며 비장감을 높이십시오. 대화에는 무림인 특유의 격식체와 자존심을 녹이십시오.",
  "미스터리/공포": "공포는 눈에 보이는 것보다 '보이지 않는 것'에서 시작하십시오. 주인공이 이상함을 처음 느끼는 작은 균열(어긋난 물건, 낯선 냄새, 이유 없는 한기)에서 공포를 쌓아올리십시오. 독자가 도망쳐야 한다고 느낄 때 주인공은 이유를 알 수 없어 머뭇거리는 심리적 딜레마를 반복하십시오. 공포의 실체는 최후까지 아껴두고, 주인공의 심박수와 체온 변화, 호흡 패턴을 통해 절박함을 전달하십시오. 결말에서 모든 것이 설명되지 않아도 됩니다—불확실한 잔상이 가장 무섭습니다.",
  "SF": "미래 세계의 기술은 설명하지 말고 일상처럼 사용하게 하십시오(독자가 맥락으로 파악하도록). 과학적 변화가 인간 관계·감정·도덕에 어떤 균열을 만드는지에 집중하십시오. AI·유전공학·우주 이주 등의 요소가 단순한 배경이 아닌 갈등의 핵심 원인이 되게 하십시오. 디스토피아라면 사회 감시 체계나 계급 분화를 주인공의 일상 속 소소한 장면으로 보여주십시오. 과학적 개념은 이야기 흐름을 방해하지 않는 수준에서만 언급하십시오.",
  "드라마": "갈등의 핵심은 선악이 아닌 각자의 입장이 모두 이해되는 상황에서 벌어지게 하십시오. 주인공이 옳다고 생각하는 선택이 누군가를 다치게 하는 아이러니를 활용하십시오. 가족·직장·꿈이라는 현실적 소재 안에 독자가 자신의 삶을 투영할 수 있는 보편적 정서를 담으십시오. 대화에서 직접 말하지 못하는 감정(원망, 사랑, 죄책감)을 행동이나 침묵으로 표현하십시오. 감동은 과장하지 않고 담담하게 서술할 때 더 깊이 전달됩니다.",
  "미스터리/추리": "독자가 탐정과 함께 추리할 수 있도록 단서를 공정하게 배치하십시오(단서는 있지만 독자가 간과하기 쉽게). 범인은 초반부터 등장하되 의심받지 않아야 하며, 나중에 돌아봤을 때 '아, 그 장면이!' 하는 복선을 심어두십시오. 탐정의 추리 과정은 논리의 비약 없이 관찰→가설→검증의 흐름을 따르십시오. 범인의 심리와 동기는 단순한 악이 아닌 이해 가능한 내면을 갖추게 하십시오. 결말의 반전 이후 독자가 첫 장면을 다시 읽고 싶어지게 만드십시오.",
  "스릴러": "첫 장면부터 독자를 위협감 속에 던져넣으십시오. 주인공이 알고 있는 것보다 독자가 조금 더 알게 하거나(아이러니), 반대로 독자보다 정보가 적어 답답하게 만드는 두 가지 전략을 의도적으로 사용하십시오. 타임리밋(시간 압박)과 물리적 추격을 교차하며 호흡을 끊지 마십시오. 주인공의 판단 실수가 위기를 키우는 구조로 독자가 함께 긴장하게 하십시오. 반전은 개연성 있는 복선 위에서만 작동합니다.",
  "역사": "역사적 사실을 배경으로 삼되 인물의 내면과 선택에 집중하십시오. 당시 언어·복식·생활상을 과도하지 않게 녹여 현장감을 살리십시오. 역사의 거대한 흐름(전쟁, 왕조 교체) 앞에 놓인 평범한 개인의 선택이 갖는 무게를 비장미 있게 그리십시오. 고증 오류가 될 수 있는 현대적 표현이나 개념은 피하십시오. 독자가 이미 아는 역사적 결말을 향해 달려가는 인물의 운명에 비극적 아름다움을 부여하십시오.",
  "힐링": "사건보다 감각과 분위기로 이야기를 이끄십시오. 장소의 냄새, 음식의 온도, 창밖의 빗소리처럼 구체적인 감각 묘사가 독자를 그 공간으로 데려가야 합니다. 갈등은 있되 극단적이지 않게, 상처는 있되 지나치게 무겁지 않게 다루십시오. 주인공이 작은 것에서 위로를 발견하는 순간—낯선 사람의 친절, 오랜 취미의 재발견—을 섬세하게 포착하십시오. 마지막 장면은 모든 것이 해결되지 않아도 독자가 숨을 내쉬며 미소 지을 수 있게 마무리하십시오."
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
  "[CRITICAL RULE] 출력된 content 내부에는 '## 서론', '### 본론', '**[결론]**' 등 그 어떤 마크다운 헤더나 섹션 구분자도 포함하지 마라. 오직 독자가 읽을 순수한 본문 텍스트만 출력하라.",
  "[CRITICAL RULE] [제목], [서론], [본론], [결론], [주제] 등 대괄호로 감싼 메타 정보를 본문에 절대 출력하지 마라. 너의 내부 추론이나 요약도 출력하지 마라. 오직 '글의 본문 내용'만 작성하라.",
  "[CRITICAL RULE] 단락이 바뀔 때 태그나 라벨 없이 자연스러운 문장 흐름으로만 전환하라. '첫째', '둘째', '결론적으로' 같은 형식적 나열 표현 없이 자연스럽게 이어가라.",
  "[CRITICAL RULE] '서론입니다', '결론적으로', '마지막으로' 같은 구조 신호 표현을 피하고, 글의 흐름이 자연스럽게 마무리되게 하라.",
  "[CRITICAL RULE] 반드시 한국어만 사용하라. 러시아어, 한자, 일본어, 아랍어 등 그 밖의 언어를 절대 사용하지 마라. 오직 한글, 공백, 기본 문장부호, 숫자만 사용하라.",
  "당신은 해당 분야의 최고 전문가이자 탁월한 글쓴이다.",
  "입력된 키워드와 제목의 분위기를 정확히 반영하되, 독자가 공감할 수 있는 구체적 사례와 통찰을 담아라.",
  "교과서 같은 딱딱한 설명이 아닌, 독자에게 말을 거는 듯한 살아있는 문체로 써라.",
  "[구체성] 추상적 조언 대신 구체적 장면·사례·비유를 사용하라. '노력하면 된다' 대신 실제 상황에서의 행동과 변화를 묘사하라. 독자가 '아, 나도 그랬는데'라고 공감할 수 있는 디테일을 넣어라.",
  "[흐름] '첫째', '둘째', '결론적으로' 같은 목차식 나열을 피하라. 하나의 이야기가 흐르듯 자연스럽게 전개하라. 문단과 문단 사이에 논리적 다리를 놓아라.",
  "공백 포함 약 4,000자 내외로 핵심 메시지를 명확히 전달하라."
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

function buildDialogueRatioInstruction(selectedDialogueRatio) {
  const ratio = (selectedDialogueRatio || "").toString().trim();
  if (!ratio) return null;
  const instructions = {
    dialogue_heavy: [
      "대화 비중을 높여라. 인물 간 대화창이 전체 분량의 50% 이상을 차지하도록 구성하라.",
      "짧은 문단, 빠른 템포, 대화 중심의 전개. 독자가 술술 읽을 수 있게 하라.",
      "설명이나 배경 묘사는 최소한으로, 인물들의 말과 행동으로 스토리를 이끌어라."
    ].join(" "),
    description_heavy: [
      "설명과 묘사 비중을 높여라. 상황 묘사, 심리 묘사, 배경 묘사가 풍부하게 들어가게 하라.",
      "대화는 중요한 순간에만 사용하고, 전체 분량의 30% 이내로 제한하라.",
      "긴 문단, 깊이 있는 서술, 정통 소설 스타일의 문단 나누기를 적용하라."
    ].join(" ")
  };
  return instructions[ratio] ? `[대화/설명 비중 Guideline] ${instructions[ratio]}` : null;
}

function buildSpeechToneInstruction(selectedSpeechTone) {
  const tone = (selectedSpeechTone || "").toString().trim();
  if (!tone) return null;
  const instructions = {
    friendly: "전체 톤을 친근하고 따뜻한 대화체로 통일하라. 어미는 '-했어', '-였지', '-하네', '-거든' 등 구어체를 일관 사용하라. 서술도 딱딱한 설명이 아닌, 친구에게 이야기하듯 부드럽고 감성적인 표현을 쓰라. 문장 길이는 짧고 리듬감 있게. 절대 '-했다', '-합니다' 같은 다른 말투를 섞지 마라.",
    formal: "전체 톤을 절제되고 단정한 문학체로 통일하라. 어미는 '-했다', '-였다', '-이었다' 등 과거형 서술어를 일관 사용하라. 군더더기 없는 간결한 문장, 감정을 직접 드러내기보다 행간에 숨기는 절제된 문체를 유지하라. 절대 '-했어', '-합니다' 같은 다른 말투를 섞지 마라.",
    polite: "전체 톤을 정중하고 격식 있는 존대체로 통일하라. 어미는 '-했습니다', '-입니다', '-세요' 등 존댓말을 일관 사용하라. 독자를 존중하며 안내하는 듯한 품위 있는 어조를 유지하라. 절대 '-했어', '-했다' 같은 다른 말투를 섞지 마라."
  };
  return instructions[tone] ? `[말투/문체 Guideline - CRITICAL] ${instructions[tone]}` : null;
}

function buildPOVInstruction(selectedPOV) {
  const pov = (selectedPOV || "").toString().trim();
  if (!pov) return null;
  const instructions = {
    first_person: "1인칭 주인공 시점으로 서술하라. 주인공이 '나'로서 자신의 이야기를 생생하게 전달하는 톤을 유지하라. 이 시점에 맞춰서 서술해줘.",
    third_limited: "3인칭 관찰자 시점으로 서술하라. 주인공의 행동과 말을 옆에서 지켜보는 관찰자처럼 객관적으로 묘사하라. 주인공의 내면은 행동과 대사로만 간접적으로 드러내라. 이 시점에 맞춰서 서술해줘.",
    omniscient: "전지적 작가 시점으로 서술하라. 모든 등장인물의 생각과 감정, 속마음까지 자유롭게 드러내며 서술하라. 이 시점에 맞춰서 서술해줘."
  };
  return instructions[pov] ? `[POV Guideline] ${instructions[pov]}` : null;
}

function buildSystemPrompt({ isNovel, category, subCategory, genre, isSeries = false, episodeType = null, endingStyle, selectedTone, selectedMood, selectedPOV, selectedSpeechTone, selectedDialogueRatio }) {
  if (isNovel) {
    const endingGuide = endingStyle
      ? `결말은 반드시 '${endingStyle}' 형태로 끝내며 그 톤을 유지하라.`
      : "결말은 독자의 여운을 남기는 방식으로 완성하라.";
    const moodGuide = buildNovelMoodInstruction(category, subCategory, genre, selectedMood);
    const povGuide = buildPOVInstruction(selectedPOV);
    const speechToneGuide = buildSpeechToneInstruction(selectedSpeechTone);
    const dialogueRatioGuide = buildDialogueRatioInstruction(selectedDialogueRatio);
    // episodeType: null(단편/1화), 'continue'(이어쓰기), 'finalize'(완결)
    let structureGuide;
    if (episodeType === 'finalize') {
      structureGuide = "이번 화는 완결 화다. 지금까지 쌓아온 모든 갈등·복선을 빠짐없이 회수하며, 각 등장인물의 변화와 결말을 충분히 보여주어라. 공백 포함 약 5,000자 이상의 묵직하고 완성도 높은 결말을 작성하라. 단계 구분 없이 하나의 흐름으로 서술하라. 서두르지 말고, 인물들의 감정과 후일담을 충분히 담아라.";
    } else if (episodeType === 'continue') {
      structureGuide = "이번 화는 연재 중인 에피소드다. 직전 화의 마지막 장면에서 자연스럽게 이어 공백 포함 약 5,000자 이상을 작성하라. 단계 구분 없이 하나의 흐름으로 서술하고, 마지막은 반드시 절단신공(Cliffhanger)으로 끝내라. 절단신공 유형: (1)위기 직면—주인공이 최악의 상황에 놓인 순간에서 끊기, (2)충격 반전—예상 못한 인물 등장이나 진실 폭로 직후 끊기, (3)선택의 기로—두 갈래 중 하나를 골라야 하는 순간에서 끊기, (4)시한폭탄—제한 시간이 다가오는 긴박감 속에서 끊기. 이 중 장면에 맞는 유형을 선택하라.";
    } else if (isSeries) {
      structureGuide = "이번 화는 시리즈의 첫 번째 화다. [시작-사건과 훅] 2단계 구조로 공백 포함 약 5,000자 내외로 작성하라. 마지막은 독자가 다음 화를 참을 수 없게 만드는 강렬한 훅(Hook)으로 끝맺어라. 훅 유형: 주인공이 모험/위기에 발을 딛는 순간, 예상 못한 진실이 드러나는 순간, 또는 운명적 선택을 해야 하는 순간에서 끊어라.";
    } else {
      structureGuide = "단편 소설로, [발단-전개-위기-절정-결말] 5단계 구조로 공백 포함 약 6,000자 내외로, 단계별 비율에 맞춰 작성하라. 절정에서는 갈등을 최고조로 끌어올리며, 전체 분량의 약 30%를 할애한다. 분량이 많은 만큼 장면 묘사와 인물 심리를 충분히 깊게 파고들어라.";
    }
    return [
      `당신은 ${genre || "소설"} 분야의 최고 작가입니다.`,
      `[장르 지침] ${pickGenreGuideline(genre)}`,
      moodGuide,
      povGuide,
      speechToneGuide,
      dialogueRatioGuide,
      NOVEL_BASE_GUIDE,
      isSeries ? NOVEL_SERIES_CONTEXT_GUIDE : null,
      structureGuide,
      endingGuide,
      "[출력 형식] 본문에는 책 내용과 무관한 특수문자(예: *, #, -, •, **, 마크다운·불릿 기호 등)를 절대 사용하지 마세요. 독자가 읽는 순수한 글만 출력하세요."
    ].filter(Boolean).join("\n\n");
  }

  const toneInstruction = buildNonfictionToneInstruction(category, selectedTone);
  return [
    "당신은 비소설 분야의 최고 저자입니다.",
    toneInstruction || "독자의 공감을 이끌어내는 흥미롭고 통찰력 있는 글을 쓰세요.",
    NONFICTION_BASE_GUIDE,
    pickNonfictionGuide(category),
    "[출력 형식] 본문에는 책 내용과 무관한 특수문자(예: *, #, -, •, **, 마크다운·불릿 기호 등)를 절대 사용하지 마세요. 독자가 읽는 순수한 글만 출력하세요."
  ].filter(Boolean).join("\n\n");
}

function buildStepPrompt({
  topic,
  currentStep,
  previousStorySummary,
  lastParagraph,
  synopsis,
  characterSheet,
  settingSheet,
  sceneBridge,
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
  const bridgeBlock = sceneBridge
    ? `직전 장면 브릿지 (물리/심리/미해결 정보 - 다음 장면 연결용):\n${sceneBridge}\n`
    : "";
  const staticContext = isNovel
    ? `[정적 메모리 - 불변, 요약하지 않음]\nSynopsis (전체 시나리오):\n${synopsis || "(없음)"}\n\nCharacter Sheet (이름/성격/버릇·특이한 행동 절대 유지):\n${characterSheet || "(없음)"}\n\nSetting Sheet (시대/장소/세계관 절대 유지):\n${settingSheet || "(없음)"}\n\n`
    : "";
  const dynamicContext = isNovel
    ? `[동적 메모리 - 누적 갱신]\n${summaryBlock}\n${lastBlock}\n${bridgeBlock}`
    : summaryBlock + "\n";
  const baseInstruction = [
    `사용자가 준 주제는 "${seed}"입니다. 이 짧은 문장을 씨앗으로 삼아 풍성한 디테일을 상상하여 확장하세요.`,
    titleLine,
    `Task: 이번에는 "${currentStep.name}" 단계를 작성하세요.`,
    `가이드라인: ${currentStep.instruction}`,
    isNovel
      ? "직접 설명하지 말고 장면으로 보여주세요. 대화문과 감각적 묘사(시각·청각·촉각·후각)를 적극 활용하세요."
      : "설득력 있고 통찰력 있는 어조로 논리적 흐름을 유지하고, 독자에게 말을 거는 듯한 친근한 문체로 작성하세요.",
    "순수 텍스트로만 작성하세요 (JSON 형식, 코드 사용 금지).",
    "[절대 금지] 별표(*), 숫자 기호(#), 하이픈(-), 불릿(•), 마크다운 강조(**) 등 책 내용과 무관한 특수문자를 본문에 넣지 마세요. 문단 구분·장식용 기호 없이 본문만 출력하세요.",
    `[절대 금지] "${currentStep.name}", "## ${currentStep.name}", "### ${currentStep.name}", "**[${currentStep.name}]**" 등의 단계명을 본문에 포함하지 마십시오. 오직 내용만 출력하세요.`,
    "이전 내용을 반복하지 마세요.",
    "한국어로 작성하세요."
  ];

  if (isNovel) {
    baseInstruction.push("[단계 연결] 이 단계는 이전 단계의 마지막 문장에서 자연스럽게 이어져야 합니다. 새로운 챕터를 시작하듯 끊기지 마세요. 시간 흐름, 장소 이동, 감정 변화가 자연스럽게 연결되어야 합니다. 독자가 읽을 때 단계가 나뉜 것을 전혀 눈치채지 못하게 하세요.");
  } else {
    baseInstruction.push("[단계 연결] 이전 단계의 흐름을 자연스럽게 이어받아 전개하세요. 갑자기 새로운 주제로 넘어가지 말고, 앞선 논의를 발전시키는 형태로 서술하세요.");
  }

  return `주제(Seed): ${seed}\n단계: ${currentStep.name}\n\n${staticContext}${dynamicContext}${baseInstruction.join("\n")}`;
}

/** 언어 오염 검사: 한글/공백/문장부호/숫자 외 문자(러시아어, 한자 등) 감지 시 false */
function validateOutput(content, language = "ko") {
  const text = (content || "").trim();
  if (!text) return { valid: true };

  const POLLUTION_PATTERNS = {
    ko: [
      /[\u0400-\u04FF]/,           // 러시아어 (키릴 문자)
      /[\u4E00-\u9FFF]/,           // 한자 (CJK)
      /[\u3000-\u303F]/,           // CJK 기호·구두점
      /[\u30A0-\u30FF]/,           // 가타카나
      /[\u3040-\u309F]/,           // 히라가나
      /[\u0600-\u06FF]/,           // 아랍어
      /[\u0E00-\u0E7F]/,           // 태국어
      /[\u0E80-\u0EFF]/,           // 라오스어
      /[\u1F00-\u1FFF]/,           // 그리스어 확장
    ],
    en: [
      /[\u0400-\u04FF]/,           // 러시아어
      /[\u4E00-\u9FFF]/,           // 한자
      /[\u3000-\u303F]/,           // CJK
      /[\u30A0-\u30FF]/,           // 가타카나
      /[\u3040-\u309F]/,           // 히라가나
      /[\uAC00-\uD7A3]/,           // 한글 (영어 모드에서는 불허)
      /[\u0600-\u06FF]/,           // 아랍어
      /[\u0E00-\u0E7F]/,           // 태국어
    ],
  };

  const patterns = POLLUTION_PATTERNS[language] || POLLUTION_PATTERNS.ko;
  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      const sample = match[0].length > 20 ? match[0].slice(0, 20) + "…" : match[0];
      return { valid: false, reason: `언어 오염 감지: ${sample} (${re.source})` };
    }
  }
  return { valid: true };
}

/** 후처리: 본문에 혼입된 메타 태그/마크다운 헤더 제거 */
function stripMetaTags(content) {
  if (!content) return content;
  let cleaned = content;

  // 마크다운 헤더 제거 (우선 처리): ## 제목, ### 발단 등
  cleaned = cleaned.replace(/^#{1,6}\s+.+$/gm, "");

  // 대괄호 메타 태그 제거 (확장 목록)
  cleaned = cleaned.replace(/\[(?:제목|줄거리|요약|브릿지|전개|결말|설정|캐릭터|서론|본론|결론|주제|발단|위기|절정|시작|사건과 훅|다음 화|완결|장르 지침|Style Guideline|POV Guideline|Genre Guideline|시리즈 연속성 지침|출력 형식|CRITICAL RULE)[^\]]*\]/g, "");

  // 볼드 메타 태그 제거: **[전개]**, **발단** 등
  cleaned = cleaned.replace(/\*\*\[?(?:제목|줄거리|요약|브릿지|전개|결말|설정|캐릭터|서론|본론|결론|주제|발단|위기|절정|시작|사건과 훅|다음 화|완결)[^\]]*\]?\*\*/g, "");

  // 내부 작업용 라벨 라인 제거 (줄 시작 위치 포함)
  cleaned = cleaned.replace(/(?:^|\n)\s*물리적\s*상태\s*:.*$/gim, "");
  cleaned = cleaned.replace(/(?:^|\n)\s*심리적\s*상태\s*:.*$/gim, "");
  cleaned = cleaned.replace(/(?:^|\n)\s*미해결\s*정보\s*:.*$/gim, "");

  // 구조 정보 헤더 제거 (본문 혼입 시)
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:Story Summary|Character Sheet|Setting Sheet|Synopsis|Title)\s*[:：].*$/gim, "");

  // 장르 지침 / 스타일 지침 라인 제거
  cleaned = cleaned.replace(/(?:^|\n)\s*\[(?:장르|Style|POV|말투|대화)[^\]]*\][^\n]*/gim, "");

  // 연속 빈 줄 정리 (3줄 이상 → 2줄)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

function extractLastSentences(content, maxSentences = 5) {
  const cleaned = (content || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentences = cleaned.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const take = Math.min(maxSentences, sentences.length);
  return sentences.slice(Math.max(0, sentences.length - take)).join(" ");
}

// 누적 요약이 너무 길어지면 전체를 재압축 (장기 연재 대응)
const MAX_SUMMARY_LENGTH = 2000; // 약 10화분
async function compressCumulativeSummary(summary, systemPrompt, isNovel) {
  if (!summary || summary.length <= MAX_SUMMARY_LENGTH) return summary;
  logger.info(`[compressSummary] 누적 요약 압축: ${summary.length}자 → 목표 ${MAX_SUMMARY_LENGTH}자 이내`);
  const prompt = [
    "다음은 시리즈 소설의 누적 줄거리 요약이다. 이것을 핵심 사건, 인물 관계 변화, 미해결 복선 중심으로 10줄 이내로 압축하라.",
    "초반 에피소드의 세부 사항은 생략해도 되지만, 핵심 갈등과 인물 변화는 반드시 유지하라.",
    "한글, 공백, 기본 문장부호만 사용하라.",
    "",
    summary
  ].join("\n");
  const result = await callGemini(systemPrompt, prompt, 0.2, isNovel);
  const compressed = (result.content || "").trim();
  return compressed || summary;
}

async function summarizeStepContent(content, systemPrompt, isNovel) {
  const prompt = [
    "다음 글을 한국어로 정확히 5줄로 요약해라. 한글, 공백, 기본 문장부호만 사용하라.",
    "각 줄은 1~2문장으로 간결하게 작성하라.",
    "불릿/번호/특수기호 없이 줄바꿈만 사용하라.",
    "요약문에 새 정보를 추가하지 마라.",
    "본문:",
    content || ""
  ].join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callGemini(systemPrompt, prompt, 0.2 - attempt * 0.1, isNovel);
    const text = (result.content || "").trim();
    if (validateOutput(text, "ko").valid) return text;
  }
  const result = await callGemini(systemPrompt, prompt, 0.1, isNovel);
  return (result.content || "").trim();
}

/** 장면 브릿지: 직전 장면의 물리/심리/미해결 정보 추출 (다음 장면 연결용) */
async function extractSceneBridge(content, systemPrompt, isNovel) {
  if (!content || !content.trim()) return "";
  const prompt = [
    "다음 장면(본문)을 읽고, 다음 장면을 이어 쓸 때 필요한 '브릿지' 정보를 추출하라. 한글만 사용하라.",
    "반드시 아래 3가지를 각각 한 줄 이내로 작성하라. 해당 정보가 없으면 '해당 없음'으로 표기.",
    "",
    "1. 물리적 상태: 캐릭터의 현재 위치, 부상 여부, 획득한 아이템 등.",
    "2. 심리적 상태: 직전 사건으로 인한 감정 변화(예: 분노, 의심, 안도, 불안).",
    "3. 미해결 정보: 캐릭터가 아직 모르는 사실, 오해하고 있는 것, 떡밥.",
    "",
    "출력 형식 (한국어):",
    "물리적 상태: ...",
    "심리적 상태: ...",
    "미해결 정보: ...",
    "",
    "본문:",
    content || ""
  ].join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callGemini(systemPrompt, prompt, 0.2 - attempt * 0.1, isNovel);
    const text = (result.content || "").trim();
    if (validateOutput(text, "ko").valid) return text;
  }
  const result = await callGemini(systemPrompt, prompt, 0.1, isNovel);
  const text = (result.content || "").trim();
  // fallback: 파싱 실패 시 직전 내용의 마지막 문장들을 브릿지로 사용
  if (!text || text.length < 10) {
    logger.warn("[extractSceneBridge] 브릿지 추출 실패 — 마지막 문장 fallback");
    return extractLastSentences(content, 5);
  }
  return text;
}

async function generateStaticContext(systemPrompt, topic, title, genre, isNovel, isSeries = false) {
  if (!isNovel) {
    return { title: "", synopsis: "", characterSheet: "", settingSheet: "" };
  }
  const seriesNote = isSeries
    ? " (이 작품은 연재 시리즈이므로, 시놉시스는 전체 서사 골격만 잡고 결말을 드러내지 마라. 1화에서 시작할 이야기의 씨앗과 갈등의 가능성만 제시하라.)"
    : "";
  const prompt = [
    "다음 정보를 바탕으로 소설의 고정 정보를 만들어라.",
    "출력 형식은 반드시 아래 구조를 지켜라 (각 항목 이름은 영어로, 내용은 한국어로):",
    "",
    "Title:",
    `- ${title ? `"${title}" (사용자 제공 제목이므로 그대로 사용)` : "독자의 호기심을 자극하는 매력적인 소설 제목 (15자 이내, 장르·주제를 반영)"}`,
    "",
    "Synopsis:",
    `- 5~7문장 분량의 전체 시놉시스${seriesNote}`,
    "",
    "Character Sheet:",
    "- 이름: (고유명사)",
    "  성격: (핵심 성격 2~3가지)",
    "  버릇/특이한 행동: (캐릭터별 고유한 습관, 말투, 몸짓, 반복되는 행동 등. 있다면 반드시 기재하고 각 단계에서 일관되게 반영하라)",
    "  절대 유지 조건: (이름/성격/버릇·특이한 행동은 절대 변경 금지)",
    "",
    "Setting Sheet:",
    "- 시대배경: (연대, 시대적 분위기, 역사적 맥락 등)",
    "- 장소배경: (주요 무대가 되는 장소들, 지역 특성, 분위기)",
    "- (판타지/SF 등이면) 세계관 규칙: (마법/기술/사회 체계 등 일관되게 유지할 규칙)",
    "- 배경은 절대 변경 금지. 각 단계에서 이 배경을 정확히 따르라.",
    "",
    "한글, 공백, 기본 문장부호, 숫자만 사용하라. 러시아어·한자·일본어 등 다른 언어를 절대 사용하지 마라.",
    `주제: ${topic || ""}`,
    genre ? `장르: ${genre}` : ""
  ].filter(Boolean).join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callGemini(systemPrompt, prompt, 0.6 - attempt * 0.1, true);
    const text = (result.content || "").trim();
    if (validateOutput(text, "ko").valid) {
      const parsed = parseStaticContext(text);
      return parsed;
    }
  }
  const result = await callGemini(systemPrompt, prompt, 0.5, true);
  const text = (result.content || "").trim();
  return parseStaticContext(text);
}

function parseStaticContext(text) {
  const titleMatch = text.match(/Title:\s*[-·]?\s*["「]?([^"「\n」"]+)["」"]?/i);
  const synopsisMatch = text.match(/Synopsis:\s*([\s\S]*?)(?=\n\s*Character Sheet:|\n\s*Characters:|$)/i);
  const characterMatch = text.match(/Character Sheet:\s*([\s\S]*?)(?=\n\s*Setting Sheet:|\n\s*배경시트:|$)/i) || text.match(/Characters:\s*([\s\S]*?)(?=\n\s*Setting Sheet:|\n\s*배경시트:|$)/i);
  const settingMatch = text.match(/Setting Sheet:\s*([\s\S]*)/i) || text.match(/배경시트:\s*([\s\S]*)/i);

  const parsed = {
    title: (titleMatch?.[1] || "").replace(/^[-·\s]+/, "").trim(),
    synopsis: (synopsisMatch?.[1] || "").trim(),
    characterSheet: (characterMatch?.[1] || "").trim(),
    settingSheet: (settingMatch?.[1] || "").trim()
  };

  // fallback: 파싱 실패 시 전체 텍스트를 synopsis로 사용
  if (!parsed.synopsis && !parsed.characterSheet) {
    logger.warn("[parseStaticContext] 파싱 실패 — 전체 텍스트를 synopsis로 fallback");
    parsed.synopsis = text.trim();
  }

  return parsed;
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

function isRetryableWithFallback(error) {
  const status = getErrorStatus(error);
  // 500/503: 서버 오류, 429: Rate Limit(리소스 소진) → 대체 모델로 재시도
  if (status === 500 || status === 503 || status === 429) {
    return true;
  }
  // status 추출 실패 시 에러 메시지에서 확인
  const msg = (error?.message || "").toString();
  return (
    msg.includes("429") ||
    msg.includes("Resource exhausted") ||
    msg.includes("Too Many Requests") ||
    msg.includes("fetch failed") ||  // 네트워크/타임아웃 등 일시적 오류
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  );
}

// Gemini API 호출 함수 (폴백 체인 지원)
async function callGemini(systemPrompt, userPrompt, temperature = 0.75, isNovel = false, modelIndex = 0) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  const modelName = MODEL_FALLBACK_CHAIN[modelIndex];
  const hasNext = modelIndex + 1 < MODEL_FALLBACK_CHAIN.length;

  try {
    logger.info(`[Gemini API] 모델 사용: ${modelName} (${modelIndex + 1}/${MODEL_FALLBACK_CHAIN.length})`);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const safetySettings = isNovel ? [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
    ] : undefined;

    const generationConfig = {
      temperature: temperature,
      maxOutputTokens: isNovel ? 12288 : 10240  // 소설 6000자/비소설 4000자 분량 대응
    };

    if (isNovel) {
      generationConfig.topP = 0.85;
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: systemPrompt,
      generationConfig: generationConfig,
      safetySettings: safetySettings
    });

    const response = result.response;
    const text = response.text();

    logger.info(`[Gemini API] ✅ 성공! 사용 모델: ${modelName} (응답 길이: ${text.length}자)`);

    return { content: text };
  } catch (error) {
    const status = getErrorStatus(error);
    logger.error(`[Gemini API] 호출 실패 (모델: ${modelName}):`, error.message);

    if (hasNext && isRetryableWithFallback(error)) {
      const nextModel = MODEL_FALLBACK_CHAIN[modelIndex + 1];
      logger.warn(`[Gemini API] 대체 모델로 재시도: ${nextModel} (status: ${status})`);
      return callGemini(systemPrompt, userPrompt, temperature, isNovel, modelIndex + 1);
    }

    throw error;
  }
}

const MAX_LANGUAGE_RETRIES = 3;
const TEMPERATURE_DECREMENT = 0.1;
const MIN_TEMPERATURE = 0.2;

// 단계별 생성 함수 (언어 오염 시 temperature 낮춰 재시도)
async function generateStep({
  systemPrompt,
  topic,
  currentStep,
  previousStorySummary,
  lastParagraph,
  synopsis,
  characterSheet,
  settingSheet,
  sceneBridge,
  temperature,
  isNovel,
  title,
  language = "ko"
}) {
  const userPrompt = buildStepPrompt({
    topic,
    currentStep,
    previousStorySummary,
    lastParagraph,
    synopsis,
    characterSheet,
    settingSheet,
    sceneBridge,
    isNovel,
    title
  });

  let currentTemp = temperature;
  let lastContent = "";

  for (let attempt = 0; attempt < MAX_LANGUAGE_RETRIES; attempt++) {
    const result = await callGemini(systemPrompt, userPrompt, currentTemp, isNovel);
    lastContent = (result.content || "").trim();

    // 빈 응답 재시도 (1회)
    if (!lastContent && attempt < MAX_LANGUAGE_RETRIES - 1) {
      logger.warn(`[generateStep] 빈 응답, 재시도 ${attempt + 1}/${MAX_LANGUAGE_RETRIES}`);
      currentTemp = Math.max(MIN_TEMPERATURE, currentTemp - TEMPERATURE_DECREMENT);
      continue;
    }

    const validation = validateOutput(lastContent, language);
    if (validation.valid) {
      return stripMetaTags(lastContent);
    }

    logger.warn(`[generateStep] 언어 오염 감지 (${validation.reason}), 재시도 ${attempt + 1}/${MAX_LANGUAGE_RETRIES} (temp: ${currentTemp} → ${Math.max(MIN_TEMPERATURE, currentTemp - TEMPERATURE_DECREMENT)})`);
    currentTemp = Math.max(MIN_TEMPERATURE, currentTemp - TEMPERATURE_DECREMENT);
  }

  logger.warn(`[generateStep] ${MAX_LANGUAGE_RETRIES}회 재시도 후에도 언어 오염. 마지막 출력 반환`);
  return stripMetaTags(lastContent);
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
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
      }

      if (!GEMINI_API_KEY) {
        throw new HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");
      }

      const { category, subCategory, genre, keywords, isSeries, previousContext, endingStyle, title, selectedTone, selectedMood, selectedPOV, selectedSpeechTone, selectedDialogueRatio } = request.data;

      // 소설류 여부 확인
      const isNovel = category === "webnovel" || category === "novel" || category === "series";
      const temperature = isNovel ? 0.72 : 0.5;

      // 시스템 프롬프트
      const systemPrompt = buildSystemPrompt({
        isNovel,
        category,
        subCategory,
        genre,
        isSeries: isSeries || false,
        endingStyle,
        selectedTone,
        selectedMood,
        selectedPOV,
        selectedSpeechTone,
        selectedDialogueRatio
      });

      // 단계 정의 (시리즈 1화는 훅으로 끝나게, 단편/비시리즈는 5단계)
      const steps = isNovel
        ? (isSeries
          ? [
            { name: "시작", instruction: "주인공과 배경을 매력적으로 묘사하세요. 독자가 이야기 세계에 빠져들 수 있도록 오감을 동원해 생생하게 그려내세요. 주인공의 일상, 성격, 주변 인물을 자연스럽게 보여주세요. [분량: 전체의 약 40%, 공백 포함 약 2,000자]" },
            { name: "사건과 훅", instruction: "평온하던 일상을 깨뜨리는 '사건(Inciting Incident)'을 발생시키세요. 주인공에게 모험이나 문제가 다가오는 장면을 보여주세요. [중요] 사건을 해결하지 말고, 주인공이 모험을 떠나거나 문제에 직면하는 순간에서 멈추세요. 마지막 문장은 다음 화가 궁금해서 미치게 만드는 절단신공으로 끝내세요. [분량: 전체의 약 60%, 공백 포함 약 3,000자]" }
          ]
          : [
            { name: "발단", instruction: "스토리의 시작. 배경과 분위기를 감각적으로 묘사하고, 주인공을 자연스럽게 등장시키세요. 독자가 이 세계에 발을 딛는 느낌을 주세요. [분량: 전체의 약 10%, 공백 포함 약 600자]" },
            { name: "전개", instruction: "사건을 본격적으로 전개하고 갈등의 씨앗을 심으세요. 인물 간 관계와 긴장감을 구축하세요. 독자가 '이 다음엔 어떻게 되지?'라고 궁금해하게 만드세요. [분량: 전체의 약 20%, 공백 포함 약 1,200자]" },
            { name: "위기", instruction: "갈등을 심화시키고 긴장감을 최대로 높이세요. 주인공의 내면 갈등과 외부 압박을 동시에 보여주세요. 독자가 손에 땀을 쥐게 하세요. [분량: 전체의 약 25%, 공백 포함 약 1,500자]" },
            { name: "절정", instruction: "갈등을 최고조로 끌어올리고 결정적 전환점을 만드세요. 가장 핵심적이고 감동적인 장면입니다. 행동, 대화, 감정을 모두 쏟아부으세요. [분량: 전체의 약 30%, 공백 포함 약 1,800자]" },
            { name: "결말", instruction: "갈등을 해소하고 여운을 남기세요. 서두르지 말고, 인물의 변화와 감정의 착지를 충분히 보여주세요. 독자가 책을 덮은 뒤에도 생각나는 마지막을 만드세요. [분량: 전체의 약 15%, 공백 포함 약 900자]" }
          ])
        : [
          { name: "서론", instruction: "독자의 호기심을 자극하는 질문이나 장면으로 시작하세요. 주제를 자연스럽게 끌어내되, '이 글은 ~에 대한 것입니다' 같은 직접 선언은 피하세요. [분량: 전체의 약 25%, 공백 포함 약 1,000자]" },
          { name: "본론 1", instruction: "주제에 대한 깊이 있는 통찰을 구체적 사례·경험·비유와 함께 전개하세요. 추상적 설명 대신 독자가 눈앞에 그릴 수 있는 장면을 제시하세요. [분량: 전체의 약 25%, 공백 포함 약 1,000자]" },
          { name: "본론 2", instruction: "새로운 관점, 반전된 시각, 또는 구체적 해결책을 제시하세요. 본론 1과 다른 각도에서 주제를 조명하되, 논리적으로 연결되게 하세요. [분량: 전체의 약 30%, 공백 포함 약 1,200자]" },
          { name: "결론", instruction: "핵심 메시지를 독자의 가슴에 남기세요. '결론적으로' 같은 형식적 표현 없이, 여운이 남는 문장으로 자연스럽게 마무리하세요. [분량: 전체의 약 20%, 공백 포함 약 800자]" }
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
      let sceneBridge = "";
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
            sceneBridge: isNovel ? sceneBridge : "",
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
          // 마지막 단계는 다음 장면이 없으므로 씬 브릿지 추출 생략
          if (isNovel && i < steps.length - 1) {
            sceneBridge = await extractSceneBridge(stepContent, systemPrompt, isNovel);
          }

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

      // 제목 결정: 사용자 입력 > AI 생성 > 키워드 기반 fallback
      const finalTitle = requestedTitle || staticContext.title || `${keywords || "작품"} - ${genre || category}`;

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
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
      }

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
        selectedMood,
        selectedPOV,
        selectedSpeechTone,
        selectedDialogueRatio,
        endingStyle
      } = request.data;

      if (!seriesId || !continuationType) {
        throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
      }

      const isNovel = true;
      const temperature = 0.72;
      const isFinalize = continuationType === 'finalize';

      // 시스템 프롬프트
      const systemPrompt = buildSystemPrompt({
        isNovel: true,
        category,
        subCategory,
        genre,
        isSeries: true,
        episodeType: isFinalize ? 'finalize' : 'continue',
        endingStyle: isFinalize ? (endingStyle || null) : null,
        selectedTone: null,
        selectedMood,
        selectedPOV: selectedPOV || null,
        selectedSpeechTone: selectedSpeechTone || null,
        selectedDialogueRatio: selectedDialogueRatio || null
      });

      const topic = `${keywords || ""} ${genre || ""}`.trim();
      const requestedTitle = (title || "").toString().trim();

      const lastParagraph = extractLastSentences(lastEpisodeContent || "", 10);
      // 장기 연재 시 누적 요약이 너무 길면 압축
      const previousStorySummary = await compressCumulativeSummary(cumulativeSummary || "", systemPrompt, true);
      // 완결은 다음 장면이 없으므로 scene bridge 추출 불필요
      const sceneBridge = (!isFinalize && lastEpisodeContent)
        ? await extractSceneBridge(lastEpisodeContent, systemPrompt, true)
        : "";

      // 시리즈 집필 단계별 지침 (Narrative Arc)
      const step = isFinalize
        ? {
          name: "완결",
          instruction: [
            "지금까지 쌓아온 모든 갈등과 복선이 터지는 '절정(Climax)'을 묘사하라.",
            "주인공이 최대 위기를 극복하거나 목표를 달성(또는 비극적으로 실패)하는 순간을 생생하게 그려라.",
            "복선으로 깔아두었던 모든 떡밥을 자연스럽게 회수하라. 설명하지 말고 사건으로 보여라.",
            "등장인물들의 변화와 후일담을 짧지만 임팩트 있게 보여주고, 독자에게 깊은 여운을 남기며 완결하라.",
            "[분량: 공백 포함 약 5,000자 이상]"
          ].join(" ")
        }
        : {
          name: "다음 화",
          instruction: [
            "[절대 금지] 다시 자기소개하거나 배경을 처음부터 설명하지 마라. 직전 화의 마지막 장면에서 바로 이어가라.",
            "이번 화에서 주인공이 맞닥뜨리는 새로운 시련, 딜레마, 예상 밖의 사건을 던져라.",
            "문제를 너무 쉽게 해결하지 마라. 해결하면 더 큰 문제가 생기도록 상황을 꼬아라.",
            "이번 화의 사건은 전체 서사에서 의미 있는 진전이어야 한다. 의미 없는 에피소드를 나열하지 마라.",
            "마지막 문장은 독자가 다음 화를 참을 수 없게 만드는 '절단신공(Cliffhanger)'으로 끝내라.",
            "[분량: 공백 포함 약 5,000자 이상]"
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
        sceneBridge,
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

/** 책 삭제 (본문 + 댓글·좋아요·즐겨찾기·완독 데이터 함께 삭제)
 * - 운영자: 모든 책 삭제 가능
 * - 일반 사용자: 본인이 생성한 책만 삭제 가능 */
const BATCH_LIMIT = 500;

exports.deleteBookAdmin = onCall(
  { region: REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const { appId, bookId } = request.data || {};
    if (!appId || !bookId) {
      throw new HttpsError("invalid-argument", "appId와 bookId가 필요합니다.");
    }

    const rawAppId = (appId || "").toString().replace(/\//g, "_");
    const bookRef = adminDb.collection("artifacts").doc(rawAppId).collection("books").doc(bookId);
    const bookSnap = await bookRef.get();
    if (!bookSnap.exists) {
      throw new HttpsError("not-found", "해당 책을 찾을 수 없습니다.");
    }
    const bookData = bookSnap.data();
    const bookAuthorId = bookData?.authorId || null;
    const uid = request.auth.uid;
    const email = request.auth.token?.email;
    const isAdmin = isAdminUser(email);
    if (!isAdmin && bookAuthorId !== uid) {
      throw new HttpsError("permission-denied", "본인이 작성한 책만 삭제할 수 있습니다.");
    }

    const baseRef = adminDb.collection("artifacts").doc(rawAppId);
    const publicDataRef = baseRef.collection("public").doc("data");

    const runBatch = async (ops) => {
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = adminDb.batch();
        const chunk = ops.slice(i, i + BATCH_LIMIT);
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
    };

    try {
      const toDelete = [];

      const collectFromSubcollection = async (collName) => {
        const snap = await publicDataRef.collection(collName).where("bookId", "==", bookId).get();
        snap.docs.forEach((d) => toDelete.push(d.ref));
      };

      await collectFromSubcollection("book_comments");
      await collectFromSubcollection("book_likes");
      await collectFromSubcollection("book_favorites");
      await collectFromSubcollection("book_completions");

      toDelete.push(baseRef.collection("books").doc(bookId));

      await runBatch(toDelete);
      logger.info(`[deleteBookAdmin] 책 삭제 완료: ${bookId} (${toDelete.length}개 문서)`);
      return { success: true };
    } catch (err) {
      logger.error("[deleteBookAdmin] 에러:", err);
      throw new HttpsError("internal", `삭제 실패: ${err.message}`);
    }
  }
);

// 이야기 번역 함수
exports.translateStoryAI = onCall(
  {
    region: REGION,
    maxInstances: 5,
    timeoutSeconds: 120
  },
  async (request) => {
    try {
      if (!GEMINI_API_KEY) {
        throw new HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");
      }
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
      }

      const { content, targetLanguage } = request.data || {};
      if (!content || !targetLanguage) {
        throw new HttpsError("invalid-argument", "content와 targetLanguage가 필요합니다.");
      }

      const langNames = {
        ko: "한국어", en: "English", ja: "日本語", zh: "中文",
        es: "Español", fr: "Français", de: "Deutsch"
      };
      const langName = langNames[targetLanguage] || targetLanguage;

      const systemPrompt = "당신은 전문 문학 번역가입니다. 원문의 분위기와 문체를 최대한 살려서 자연스럽게 번역하세요. 순수 번역 텍스트만 출력하세요.";
      const userPrompt = `다음 글을 ${langName}(으)로 번역하세요. 원문의 감성과 뉘앙스를 유지하세요.\n\n${content}`;

      const result = await callGemini(systemPrompt, userPrompt, 0.3, false);

      return {
        translatedContent: (result.content || "").trim(),
        targetLanguage
      };
    } catch (error) {
      logger.error("[translateStoryAI] 에러:", error.message);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", `번역 중 오류가 발생했습니다: ${error.message}`);
    }
  }
);

// 오류 신고 분석 함수
exports.analyzeReportAI = onCall(
  {
    region: REGION,
    maxInstances: 5,
    timeoutSeconds: 60
  },
  async (request) => {
    try {
      if (!GEMINI_API_KEY) {
        throw new HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");
      }
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
      }

      const { reportText, originalContent, reportType } = request.data || {};
      if (!reportText) {
        throw new HttpsError("invalid-argument", "reportText가 필요합니다.");
      }

      const systemPrompt = "당신은 콘텐츠 품질 분석 전문가입니다. 사용자의 신고 내용을 분석하고 타당성을 판단하세요.";
      const userPrompt = [
        `신고 유형: ${reportType || "기타"}`,
        `신고 내용: ${reportText}`,
        originalContent ? `원문 일부: ${originalContent.substring(0, 500)}` : "",
        "",
        "다음 형식으로 응답하세요:",
        "판정: 승인 또는 거절",
        "이유: (한 줄 설명)",
        "심각도: 높음/보통/낮음"
      ].filter(Boolean).join("\n");

      const result = await callGemini(systemPrompt, userPrompt, 0.2, false);
      const text = (result.content || "").trim();

      const isApproved = text.includes("승인");
      const severityMatch = text.match(/심각도:\s*(높음|보통|낮음)/);

      return {
        approved: isApproved,
        analysis: text,
        severity: severityMatch ? severityMatch[1] : "보통"
      };
    } catch (error) {
      logger.error("[analyzeReportAI] 에러:", error.message);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", `신고 분석 중 오류가 발생했습니다: ${error.message}`);
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// generateBookCover: 프리미엄 AI 표지 생성
// 1) Gemini 텍스트 → 영문 이미지 프롬프트 생성
// 2) Gemini 이미지 모델 → base64 이미지 생성
// 3) Firebase Storage 업로드 → cover_url Firestore 업데이트
// ─────────────────────────────────────────────────────────────────
exports.generateBookCover = onCall(
  {
    region: REGION,
    maxInstances: 5,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { bookId, bookTitle, bookContent, appId: clientAppId } = request.data || {};
    const userId = request.auth.uid;

    if (!bookId || !bookTitle) {
      throw new HttpsError("invalid-argument", "bookId와 bookTitle이 필요합니다.");
    }

    const safeAppId = (clientAppId || "odok-app-default").replace(/\//g, "_");
    const contentSnippet = (bookContent || "").substring(0, 1500);

    if (!GEMINI_API_KEY) {
      throw new HttpsError("internal", "Gemini API 키가 설정되지 않았습니다.");
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // ── Step 1: 영문 이미지 프롬프트 생성 ──────────────────────────
    logger.info("[generateBookCover] Step1: 이미지 프롬프트 생성 시작");
    let imagePrompt;
    try {
      const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const promptGenRequest = `You are a professional book cover artist. Based on the Korean novel below, create a vivid English image generation prompt for a book cover background.

Novel Title: ${bookTitle}
Novel Content: ${contentSnippet}

Requirements:
- Write a detailed English image description (2-3 sentences)
- Focus on mood, atmosphere, colors, and visual elements that represent the story
- Style: cinematic, artistic, painterly illustration
- CRITICAL: Ensure the image contains NO TEXT, NO LETTERS, NO WORDS, NO TITLES, NO SUBTITLES, NO CAPTIONS, NO SIGNATURES, and NO SYMBOLS of any kind. Generate a pure artistic background image only.
- Output ONLY the image prompt, nothing else.`;

      const textResult = await textModel.generateContent(promptGenRequest);
      imagePrompt = textResult.response.text().trim();
      logger.info("[generateBookCover] 생성된 프롬프트:", imagePrompt);
    } catch (err) {
      logger.error("[generateBookCover] 프롬프트 생성 실패:", err.message);
      throw new HttpsError("internal", `이미지 프롬프트 생성 실패: ${err.message}`);
    }

    // 텍스트 방지 강화
    imagePrompt += " No text, no letters, no words, no writing of any kind. Pure background art only.";

    // ── Step 2: Gemini 이미지 생성 ────────────────────────────────
    logger.info("[generateBookCover] Step2: AI 이미지 생성 시작");
    let imageBase64;
    let imageMimeType = "image/png";

    const imageModelNames = [
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
    ];

    let imageGenerated = false;
    for (const modelName of imageModelNames) {
      try {
        const imageModel = genAI.getGenerativeModel({ model: modelName });
        const imageResult = await imageModel.generateContent({
          contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        });

        const parts = imageResult.response.candidates?.[0]?.content?.parts || [];
        const inlinePart = parts.find((p) => p.inlineData?.data);
        if (inlinePart) {
          imageBase64 = inlinePart.inlineData.data;
          imageMimeType = inlinePart.inlineData.mimeType || "image/png";
          imageGenerated = true;
          logger.info(`[generateBookCover] 이미지 생성 성공 (model: ${modelName})`);
          break;
        }
      } catch (err) {
        logger.warn(`[generateBookCover] ${modelName} 실패:`, err.message);
      }
    }

    if (!imageGenerated || !imageBase64) {
      throw new HttpsError("internal", "AI 이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }

    // ── Step 3: Firebase Storage 업로드 ───────────────────────────
    logger.info("[generateBookCover] Step3: Storage 업로드 시작");
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
    const storagePath = `covers/${userId}/${bookId}.${ext}`;

    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(imageBuffer, {
      metadata: { contentType: imageMimeType },
    });
    await file.makePublic();
    const coverUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // ── Step 4: Firestore cover_url 업데이트 ──────────────────────
    logger.info("[generateBookCover] Step4: Firestore 업데이트");
    await adminDb
      .collection("artifacts")
      .doc(safeAppId)
      .collection("books")
      .doc(bookId)
      .update({ cover_url: coverUrl, cover_generated_at: admin.firestore.FieldValue.serverTimestamp() });

    logger.info("[generateBookCover] 완료:", coverUrl);
    return { coverUrl };
  }
);

// 서버 측 아이템 가격 (클라이언트 조작 방지)
const STORE_ITEMS_SERVER = {
  golden_pen:   { price: 15, name: '황금만년필' },
  rainbow_ink:  { price: 10, name: '무지개 잉크' },
  magic_eraser: { price: 10, name: '마법 지우개' },
  paint_brush:  { price: 50, name: '페인트붓' },
  sharp:        { price: 10, name: '샤프' },
};

// ── 페인트붓: AI 표지 재생성 (미리보기용 — Firestore 업데이트 없음) ──
exports.regenerateCover = onCall(
  {
    region: REGION,
    maxInstances: 5,
    timeoutSeconds: 180,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { bookId, appId: clientAppId } = request.data || {};
    const userId = request.auth.uid;

    if (!bookId) throw new HttpsError("invalid-argument", "bookId가 필요합니다.");

    const safeAppId = (clientAppId || "odok-app-default").replace(/\//g, "_");

    // 책 데이터 조회
    const bookSnap = await adminDb
      .collection("artifacts").doc(safeAppId)
      .collection("books").doc(bookId).get();

    if (!bookSnap.exists) throw new HttpsError("not-found", "책을 찾을 수 없습니다.");

    const book = bookSnap.data();
    if (book.authorId !== userId) {
      throw new HttpsError("permission-denied", "본인의 책만 수정할 수 있습니다.");
    }

    const bookTitle = book.title || "Untitled";
    const contentSnippet = (book.content || "").substring(0, 1500);

    if (!GEMINI_API_KEY) throw new HttpsError("internal", "Gemini API 키가 설정되지 않았습니다.");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // ── Step 1: 이미지 프롬프트 생성 ──────────────────────────────────
    logger.info("[regenerateCover] Step1: 프롬프트 생성");
    let imagePrompt;
    try {
      const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const promptGenRequest = `You are a professional book cover artist. Based on the Korean novel below, create a vivid English image generation prompt for a book cover background.

Novel Title: ${bookTitle}
Novel Content: ${contentSnippet}

Requirements:
- Write a detailed English image description (2-3 sentences)
- Focus on mood, atmosphere, colors, and visual elements that represent the story
- Style: cinematic, artistic, painterly illustration
- CRITICAL: Ensure the image contains NO TEXT, NO LETTERS, NO WORDS, NO TITLES, NO SUBTITLES, NO CAPTIONS, NO SIGNATURES, and NO SYMBOLS of any kind. Generate a pure artistic background image only.
- Output ONLY the image prompt, nothing else.`;

      const textResult = await textModel.generateContent(promptGenRequest);
      imagePrompt = textResult.response.text().trim();
      logger.info("[regenerateCover] 프롬프트:", imagePrompt);
    } catch (err) {
      throw new HttpsError("internal", `이미지 프롬프트 생성 실패: ${err.message}`);
    }

    imagePrompt += " No text, no letters, no words, no writing of any kind. Pure background art only.";

    // ── Step 2: Gemini 이미지 생성 ────────────────────────────────────
    logger.info("[regenerateCover] Step2: 이미지 생성");
    const imageModelNames = [
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
    ];

    let imageBase64 = null;
    let imageMimeType = "image/png";

    for (const modelName of imageModelNames) {
      try {
        const imageModel = genAI.getGenerativeModel({ model: modelName });
        const imageResult = await imageModel.generateContent({
          contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        });
        const parts = imageResult.response.candidates?.[0]?.content?.parts || [];
        const inlinePart = parts.find((p) => p.inlineData?.data);
        if (inlinePart) {
          imageBase64 = inlinePart.inlineData.data;
          imageMimeType = inlinePart.inlineData.mimeType || "image/png";
          logger.info(`[regenerateCover] 이미지 생성 성공 (model: ${modelName})`);
          break;
        }
      } catch (err) {
        logger.warn(`[regenerateCover] ${modelName} 실패:`, err.message);
      }
    }

    if (!imageBase64) {
      throw new HttpsError("internal", "AI 이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }

    // ── Step 3: 미리보기 경로에 업로드 (원본 표지 보존) ─────────────
    logger.info("[regenerateCover] Step3: Storage 업로드");
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
    const storagePath = `covers/${userId}/${bookId}_brush.${ext}`;

    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(imageBuffer, { metadata: { contentType: imageMimeType } });
    await file.makePublic();
    const previewUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    logger.info("[regenerateCover] 미리보기 생성 완료:", previewUrl);
    // Firestore는 클라이언트가 확정 시 직접 업데이트
    return { previewUrl };
  }
);

// ── 아이템 선물하기 (우편함으로 전달) ─────────────────────────────────
exports.giftItem = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { recipientUid, itemId, quantity, appId: rawAppId } = request.data;
    const senderUid = request.auth.uid;

    if (!recipientUid || !itemId) {
      throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
    }
    if (senderUid === recipientUid) {
      throw new HttpsError("invalid-argument", "자신에게는 선물할 수 없습니다.");
    }

    const item = STORE_ITEMS_SERVER[itemId];
    if (!item) throw new HttpsError("invalid-argument", "유효하지 않은 아이템입니다.");

    const qty = Math.min(Math.max(1, parseInt(quantity) || 1), 10);
    const totalCost = item.price * qty;
    const safeAppId = (rawAppId || "odok-app-default").replace(/\//g, "_");

    const senderRef = adminDb
      .collection("artifacts").doc(safeAppId)
      .collection("users").doc(senderUid)
      .collection("profile").doc("info");

    try {
      let senderName = "누군가";
      await adminDb.runTransaction(async (transaction) => {
        const senderSnap = await transaction.get(senderRef);
        if (!senderSnap.exists) throw new Error("보내는 사람 프로필을 찾을 수 없습니다.");

        const senderData = senderSnap.data();
        senderName = senderData.nickname || "누군가";
        const currentInk = senderData.ink ?? 0;
        if (currentInk < totalCost) {
          throw new Error(`잉크가 부족해요! (보유: ${currentInk}개, 필요: ${totalCost}개)`);
        }

        // 잉크 차감
        transaction.update(senderRef, { ink: currentInk - totalCost });

        // 우편함에 선물 추가
        const mailboxRef = adminDb
          .collection("artifacts").doc(safeAppId)
          .collection("users").doc(recipientUid)
          .collection("mailbox").doc();
        transaction.set(mailboxRef, {
          type: "item",
          itemId,
          itemName: item.name,
          quantity: qty,
          senderUid,
          senderName,
          claimed: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // 푸시 알림
      await sendPushToUser(recipientUid, {
        title: "🎁 선물이 도착했어요!",
        body: `${senderName}님이 ${item.name} ${qty}개를 선물했습니다. 우편함을 확인하세요!`,
        data: { type: "gift", giftType: "item", itemId, senderName },
      });

      logger.info(`[giftItem] ${senderUid} → ${recipientUid}: ${itemId} x${qty}`);
      return { success: true };
    } catch (err) {
      throw new HttpsError("internal", err.message || "선물 전송에 실패했습니다.");
    }
  }
);

// ── 잉크 선물하기 (우편함으로 전달) ──────────────────────────────────
exports.giftInk = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { recipientUid, amount, appId: rawAppId } = request.data;
    const senderUid = request.auth.uid;

    if (!recipientUid || !amount) {
      throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
    }
    if (senderUid === recipientUid) {
      throw new HttpsError("invalid-argument", "자신에게는 선물할 수 없습니다.");
    }

    const qty = Math.min(Math.max(1, parseInt(amount) || 1), 100);
    const safeAppId = (rawAppId || "odok-app-default").replace(/\//g, "_");

    const senderRef = adminDb
      .collection("artifacts").doc(safeAppId)
      .collection("users").doc(senderUid)
      .collection("profile").doc("info");

    try {
      let senderName = "누군가";
      await adminDb.runTransaction(async (transaction) => {
        const senderSnap = await transaction.get(senderRef);
        if (!senderSnap.exists) throw new Error("보내는 사람 프로필을 찾을 수 없습니다.");

        const senderData = senderSnap.data();
        senderName = senderData.nickname || "누군가";
        const currentInk = senderData.ink ?? 0;
        if (currentInk < qty) {
          throw new Error(`잉크가 부족해요! (보유: ${currentInk}개, 필요: ${qty}개)`);
        }

        // 잉크 차감 + XP 부여
        const currentXp = senderData.xp ?? 0;
        const xpGain = qty * 10;
        transaction.update(senderRef, {
          ink: currentInk - qty,
          xp: currentXp + xpGain,
          total_ink_spent: admin.firestore.FieldValue.increment(qty),
        });

        // 우편함에 잉크 추가
        const mailboxRef = adminDb
          .collection("artifacts").doc(safeAppId)
          .collection("users").doc(recipientUid)
          .collection("mailbox").doc();
        transaction.set(mailboxRef, {
          type: "ink",
          quantity: qty,
          senderUid,
          senderName,
          claimed: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // 푸시 알림
      await sendPushToUser(recipientUid, {
        title: "💧 잉크가 도착했어요!",
        body: `${senderName}님이 잉크 ${qty}개를 선물했습니다. 우편함을 확인하세요!`,
        data: { type: "gift", giftType: "ink", senderName },
      });

      logger.info(`[giftInk] ${senderUid} → ${recipientUid}: ink x${qty}`);
      return { success: true };
    } catch (err) {
      throw new HttpsError("internal", err.message || "잉크 선물 전송에 실패했습니다.");
    }
  }
);

// ── 우편함 수령 (단건 or 전체) ────────────────────────────────────────
exports.claimMailbox = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { mailboxId, appId: rawAppId } = request.data; // mailboxId = null이면 전체 수령
    const uid = request.auth.uid;
    const safeAppId = (rawAppId || "odok-app-default").replace(/\//g, "_");

    const mailboxCol = adminDb
      .collection("artifacts").doc(safeAppId)
      .collection("users").doc(uid)
      .collection("mailbox");

    const profileRef = adminDb
      .collection("artifacts").doc(safeAppId)
      .collection("users").doc(uid)
      .collection("profile").doc("info");

    try {
      // 수령할 아이템 조회
      let docsToProcess;
      if (mailboxId) {
        const single = await mailboxCol.doc(mailboxId).get();
        if (!single.exists || single.data().claimed) {
          throw new Error("이미 수령했거나 존재하지 않는 선물입니다.");
        }
        docsToProcess = [single];
      } else {
        const snap = await mailboxCol.where("claimed", "==", false).get();
        docsToProcess = snap.docs;
      }

      if (docsToProcess.length === 0) {
        return { success: true, claimed: 0 };
      }

      // 트랜잭션으로 수령 처리
      await adminDb.runTransaction(async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        const profileData = profileSnap.exists ? profileSnap.data() : {};

        let inkDelta = 0;
        const itemDeltas = {};

        for (const mailDoc of docsToProcess) {
          const gift = mailDoc.data();
          if (gift.type === "ink") {
            inkDelta += gift.quantity;
          } else if (gift.type === "item" && gift.itemId) {
            itemDeltas[gift.itemId] = (itemDeltas[gift.itemId] || 0) + gift.quantity;
          }
          transaction.update(mailboxCol.doc(mailDoc.id), { claimed: true });
        }

        const updates = {};
        if (inkDelta > 0) {
          const INK_MAX = 9999;
          const currentInk = profileData.ink ?? 0;
          updates.ink = Math.min(INK_MAX, currentInk + inkDelta);
        }
        for (const [itemId, qty] of Object.entries(itemDeltas)) {
          const current = profileData.inventory?.[itemId] ?? 0;
          updates[`inventory.${itemId}`] = current + qty;
        }

        if (Object.keys(updates).length > 0) {
          if (profileSnap.exists) {
            transaction.update(profileRef, updates);
          } else {
            transaction.set(profileRef, updates, { merge: true });
          }
        }
      });

      return { success: true, claimed: docsToProcess.length };
    } catch (err) {
      throw new HttpsError("internal", err.message || "수령에 실패했습니다.");
    }
  }
);

// ── 황금만년필: 문장 품격 강화 ───────────────────────────────────────
exports.enhanceBook = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { content, feature } = request.data;
    if (!content || typeof content !== "string") {
      throw new HttpsError("invalid-argument", "content가 필요합니다.");
    }

    const featureGuides = {
      describe: {
        system: "너는 문학적 묘사의 대가다. 줄거리는 절대 바꾸지 말고, 건조한 문장에 오감(시각·청각·촉각·후각·미각)을 자극하는 생생하고 풍부한 묘사를 덧입혀라. 감정·공간·분위기의 질감이 독자에게 생생하게 전달되어야 한다. 기존 문장을 확장하되 과도하게 늘리지 않도록 균형을 맞춰라. 마크다운 없이 본문만 출력하라. 반드시 한국어만 사용하라.",
        prompt: "위 텍스트의 묘사를 대폭 강화하되 줄거리는 절대 바꾸지 말고 본문만 출력하라:"
      },
      quotes: {
        system: "너는 기억에 남는 명문장을 창조하는 작가다. 줄거리와 흐름은 절대 바꾸지 말고, 소설의 주제를 관통하는 철학적이고 멋진 명대사·명문장을 적재적소에 2~4개 자연스럽게 삽입하라. 독자가 밑줄을 긋고 싶은 깊이 있는 문장이어야 한다. 마크다운 없이 본문만 출력하라. 반드시 한국어만 사용하라.",
        prompt: "위 텍스트에 명문장을 삽입하되 줄거리는 절대 바꾸지 말고 본문만 출력하라:"
      },
      polish: {
        system: "너는 10년 경력의 전문 문학 편집자다. 줄거리는 절대 바꾸지 말고, 전체를 꼼꼼히 윤문·퇴고하라. 비문 수정, 문장 호흡 조절, 반복 표현 제거, 세련된 문체로 완성하라. 가독성을 최우선으로 고려하라. 마크다운 없이 본문만 출력하라. 반드시 한국어만 사용하라.",
        prompt: "위 텍스트를 프로 수준으로 윤문·퇴고하되 줄거리는 절대 바꾸지 말고 본문만 출력하라:"
      },
    };

    const feat = featureGuides[feature];
    if (!feat) {
      throw new HttpsError("invalid-argument", "유효하지 않은 기능입니다.");
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const prompt = `[원본 텍스트]\n${content}\n\n${feat.prompt}`;

    let enhancedContent = null;
    for (const modelName of MODEL_FALLBACK_CHAIN) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: feat.system,
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text) { enhancedContent = text; break; }
      } catch (err) {
        logger.warn(`[enhanceBook] ${modelName} 실패:`, err.message);
      }
    }

    if (!enhancedContent) {
      throw new HttpsError("internal", "텍스트 개선에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }

    return { enhancedContent: stripMetaTags(enhancedContent) };
  }
);

// ── 무지개 잉크 스타일 변환 ──────────────────────────────────────────
exports.transformBookStyle = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { content, style } = request.data;
    if (!content || typeof content !== "string") {
      throw new HttpsError("invalid-argument", "content가 필요합니다.");
    }

    const styleGuides = {
      dialect: "주어진 텍스트를 경상도 사투리로 변환하라. '~카이', '~데이', '~라카이', '~가', '~아이가', '마', '와', '니', '우야꼬', '아이고' 등 경상도 특유의 방언과 어투를 자연스럽게 섞어라. 투박하지만 정감 넘치는 분위기를 살려라.",
      historical: "주어진 텍스트를 조선시대 사극 문체로 변환하라. '~하오', '~이옵니다', '~하셨나이까', '~하리이다', '소인', '전하', '마마' 등 고풍스러운 어휘와 존댓말을 사용하라. 운율감 있고 격조 높은 문체로 다듬어라.",
      literary: "주어진 텍스트를 순수문학 고전 명작 스타일로 변환하라. 유려하고 깊이 있는 문학적 문체로 다듬어라. 감각적인 묘사, 섬세한 심리 표현, 은유와 상징을 풍부하게 사용하라.",
      trendy: "주어진 텍스트를 MZ세대 감성으로 변환하라. 유행어를 적절히 섞되 전체의 20% 이내로 제한하라. 기본은 깔끔하고 위트 있는 현대 구어체를 유지하면서 가끔 트렌디한 표현을 자연스럽게 녹여라. 이모지는 문단당 1~2개 이내로 절제하라. 읽기 불편할 정도로 과하면 안 된다.",
      cyber: "주어진 텍스트를 근미래 SF 보고서 느낌으로 변환하라. 냉철하고 건조한 관찰자 문체를 기본으로 하되, 감정이나 상황을 데이터처럼 표현하라. 예: '심박수 상승 감지', '위협도 78%'. 'SYSTEM:'이나 '[LOG]' 같은 태그는 최소한으로만 사용하고, 소설로서 읽히는 것을 최우선으로 하라.",
    };

    const guide = styleGuides[style];
    if (!guide) {
      throw new HttpsError("invalid-argument", "유효하지 않은 스타일입니다.");
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const systemInstruction = "너는 텍스트 스타일 변환 전문가다. 원본의 내용과 의미는 유지하면서 문체·어투만 변환하라. 마크다운 헤더, 라벨, 메타 정보 없이 오직 변환된 본문만 출력하라. 반드시 한국어로만 출력하라.";
    const prompt = `[변환 지시]\n${guide}\n\n[원본 텍스트]\n${content}\n\n[변환된 텍스트]`;

    let transformedContent = null;
    for (const modelName of MODEL_FALLBACK_CHAIN) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text) {
          transformedContent = text;
          break;
        }
      } catch (err) {
        logger.warn(`[transformBookStyle] ${modelName} 실패:`, err.message);
      }
    }

    if (!transformedContent) {
      throw new HttpsError("internal", "텍스트 변환에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }

    return { transformedContent: stripMetaTags(transformedContent) };
  }
);

// ── 마법 지우개: 결말 재창조 ─────────────────────────────────────────
exports.regenerateEnding = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { title, genre, synopsis, characterSheet, settingSheet, previousContent, lastChapterName, style } = request.data;

    const styleGuides = {
      happy:    "갈등이 완전히 해소되고 주요 인물들이 따뜻하고 희망찬 미래를 맞이하는 행복한 결말을 써라. 독자가 미소 짓고 마음이 따뜻해지는 마무리여야 한다.",
      sad:      "독자의 눈물을 자극하는 비극적인 결말을 써라. 가슴 절절한 상실감이나 회한이 느껴지는 여운이 남아야 한다. 억지스럽지 않고 자연스럽게 슬픔이 스며들어야 한다.",
      twist:    "누구도 예상하지 못한 충격적인 반전이 드러나는 결말을 써라. 복선을 활용하거나 완전히 새로운 사실을 밝혀내어 독자를 전율하게 만들어야 한다.",
      open:     "명확한 결론을 내리지 않고 독자가 스스로 상상할 수 있는 여지를 남기는 열린 결말을 써라. 암시적이고 여운이 깊게 남아야 한다.",
      circular: "소설의 첫 장면이나 도입부의 핵심 설정·분위기를 다시 불러와 구조적 완결성을 높이는 수미상관 결말을 써라. 이야기가 원점으로 돌아오면서도 성장이나 변화가 느껴져야 한다.",
    };

    const guide = styleGuides[style];
    if (!guide) {
      throw new HttpsError("invalid-argument", "유효하지 않은 스타일입니다.");
    }

    const systemInstruction = [
      "너는 베스트셀러 소설가다. 기존 소설의 마지막 챕터만 새롭게 다시 쓰는 것이 임무다.",
      "[절대 규칙] 소설의 앞부분(Synopsis·CharacterSheet·SettingSheet·이전 내용)은 절대 바꾸지 마라.",
      "[절대 규칙] 마지막 챕터만 완전히 새롭게 써라. 이전 내용과 자연스럽게 이어져야 한다.",
      "[절대 규칙] 마크다운 헤더, 라벨, 메타 정보 없이 오직 본문만 출력하라.",
      "[절대 규칙] 반드시 한국어만 사용하라.",
      "공백 포함 약 1,500~2,000자 분량으로 충분히 써라. 서두르지 말고 감정과 장면을 깊이 있게 묘사하라.",
    ].join(" ");

    const prompt = `[작품 정보]
제목: ${title || ""}
장르: ${genre || ""}

[Synopsis]
${synopsis || "없음"}

[Character Sheet]
${characterSheet || "없음"}

[Setting Sheet]
${settingSheet || "없음"}

[이전 챕터 요약]
${previousContent || "없음"}

[새로 쓸 챕터명]
${lastChapterName || "결말"}

[결말 스타일 지침]
${guide}

위 소설의 마지막 챕터를 위 스타일에 맞게 새로 써라. 본문만 출력:`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    let newEnding = null;

    for (const modelName of MODEL_FALLBACK_CHAIN) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: { temperature: 0.75, maxOutputTokens: 8192 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text) { newEnding = text; break; }
      } catch (err) {
        logger.warn(`[regenerateEnding] ${modelName} 실패:`, err.message);
      }
    }

    if (!newEnding) {
      throw new HttpsError("internal", "결말 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }

    return { newEnding: stripMetaTags(newEnding) };
  }
);

// 호환성 유지용 함수
exports.generateStoryAI = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 540
  },
  async (request) => {
    return exports.generateBookAI(request);
  }
);

// ─── generateBookSummary ─────────────────────────────────────────────────────
// 책 소개글 생성 (basic: 2줄 무료 요약 / premium: 3~5줄 유료 홍보 문구)
exports.generateBookSummary = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { bookId, appId: rawAppId, type } = request.data; // type: 'basic' | 'premium'
  if (!bookId || !rawAppId) throw new HttpsError("invalid-argument", "bookId와 appId가 필요합니다.");
  if (type !== 'basic' && type !== 'premium') throw new HttpsError("invalid-argument", "type은 'basic' 또는 'premium'이어야 합니다.");

  const safeAppId = rawAppId.replace(/\//g, '_');
  const uid = request.auth.uid;

  // 책 정보 조회
  const bookRef = adminDb.collection('artifacts').doc(safeAppId).collection('books').doc(bookId);
  const bookSnap = await bookRef.get();
  if (!bookSnap.exists) throw new HttpsError("not-found", "책을 찾을 수 없습니다.");

  const book = bookSnap.data();
  if (book.authorId !== uid) throw new HttpsError("permission-denied", "내 작품만 소개글을 생성할 수 있습니다.");

  const title = book.title || '제목 없음';
  const genre = book.genre || '';
  const synopsis = book.synopsis || '';
  const content = (book.steps || []).map(s => s.content || '').join('\n').slice(0, 800);

  const context = [
    `제목: ${title}`,
    genre ? `장르: ${genre}` : '',
    synopsis ? `시놉시스: ${synopsis}` : '',
    content ? `본문 일부:\n${content}` : '',
  ].filter(Boolean).join('\n');

  let systemPrompt, userPrompt;

  if (type === 'basic') {
    systemPrompt = '너는 소설 편집자야. 주어진 소설 정보를 바탕으로 간결하고 정확한 줄거리 요약을 작성해.';
    userPrompt = `다음 소설을 2줄 이내(60자 이하)로 담백하게 요약해줘. 반드시 완성된 문장으로 끝내.\n\n${context}`;
  } else {
    systemPrompt = '너는 출판사 마케터야. 독자의 호기심을 강렬하게 자극하는 매력적인 소설 홍보 문구를 작성해. 문학적 수식어와 감성적 언어를 활용해.';
    userPrompt = `다음 소설의 홍보 소개글을 3~5줄로 작성해줘. 독자가 당장 읽고 싶어지도록 강렬하고 매혹적으로 써줘. 문학적인 수식어를 활용해.\n\n${context}`;
  }

  const summaryResult = await callGemini(systemPrompt, userPrompt, 0.8, false);
  const summary = (summaryResult.content || '').trim();

  // Firestore 업데이트
  await bookRef.update({
    book_summary: summary,
    summary_type: type === 'basic' ? 'BASIC' : 'PREMIUM',
  });

  return { summary: summary, summary_type: type === 'basic' ? 'BASIC' : 'PREMIUM' };
});

// ─── 푸시 알림 헬퍼 ────────────────────────────────────────────────────────
const APP_ID = "odok-app-default";

/**
 * 특정 유저에게 FCM 푸시 알림 전송
 */
async function sendPushToUser(targetUid, { title, body, data = {} }) {
  // 0) 사용자 알림 설정 확인 — 해당 타입이 꺼져있으면 인앱 저장만 하고 푸시 안 보냄
  let pushDisabled = false;
  try {
    const profileDoc = await adminDb
      .collection("artifacts").doc(APP_ID)
      .collection("users").doc(targetUid)
      .collection("profile").doc("info")
      .get();
    if (profileDoc.exists) {
      const ns = profileDoc.data()?.notifSettings;
      if (ns && data.type && ns[data.type] === false) {
        pushDisabled = true;
      }
    }
  } catch (e) { /* 설정 조회 실패 시 기본값(켜짐) */ }

  // 1) 인앱 알림 내역 저장 (설정 꺼져있어도 내역은 저장)
  try {
    await adminDb
      .collection("artifacts").doc(APP_ID)
      .collection("users").doc(targetUid)
      .collection("notifications").add({
        type: data.type || "general",
        senderName: data.senderName || null,
        bookTitle: data.bookTitle || null,
        message: body,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data,
      });
  } catch (err) {
    logger.warn(`[Notification] 저장 실패 uid:${targetUid}`, err.message);
  }

  // 2) FCM 푸시 전송 (사용자가 해당 알림을 끈 경우 건너뜀)
  if (pushDisabled) {
    logger.info(`[Push] 알림 설정 OFF → uid:${targetUid}, type:${data.type}`);
    return;
  }

  try {
    const tokenDoc = await adminDb
      .collection("artifacts").doc(APP_ID)
      .collection("users").doc(targetUid)
      .collection("fcm_tokens").doc("device")
      .get();

    if (!tokenDoc.exists) return;
    const { token } = tokenDoc.data();
    if (!token) return;

    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { ...data },
      android: {
        notification: {
          sound: "default",
          channelId: "odok_default",
        },
      },
    });

    logger.info(`[Push] 전송 완료 → uid:${targetUid}`);
  } catch (err) {
    logger.warn(`[Push] 전송 실패 uid:${targetUid}`, err.message);
  }
}

// ─── 트리거 1: 댓글 작성 → 책 작가에게 알림 ────────────────────────────────
exports.onCommentCreated = onDocumentCreated(
  {
    document: "artifacts/{appId}/public/data/book_comments/{commentId}",
    region: REGION,
  },
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;

    const { bookId, authorName, text, userId: commenterId } = comment;
    if (!bookId) return;

    // 책 정보 조회 (작가 uid 필요)
    const bookDoc = await adminDb
      .collection("artifacts").doc(event.params.appId)
      .collection("public").doc("data")
      .collection("books").doc(bookId)
      .get();

    if (!bookDoc.exists) return;
    const book = bookDoc.data();
    const authorUid = book.authorId;

    // 자기 책에 자기가 댓글 달면 알림 안 보냄
    if (!authorUid || authorUid === commenterId) return;
    // 익명 댓글이면 작성자명 마스킹
    const displayName = comment.isAnonymous ? "익명" : (authorName || "누군가");
    const shortText = text?.length > 30 ? text.slice(0, 30) + "…" : text;

    await sendPushToUser(authorUid, {
      title: `📖 "${book.title}"에 새 댓글`,
      body: `${displayName}: ${shortText}`,
      data: { type: "comment", bookId, senderName: displayName, bookTitle: book.title },
    });
  }
);

// ─── 트리거 2: 팔로우 → 팔로우 대상에게 알림 ───────────────────────────────
exports.onFollowCreated = onDocumentCreated(
  {
    document: "artifacts/{appId}/users/{targetUid}/followers/{followerUid}",
    region: REGION,
  },
  async (event) => {
    const { targetUid, followerUid } = event.params;
    if (targetUid === followerUid) return;

    // 팔로워 프로필 조회
    const followerDoc = await adminDb
      .collection("artifacts").doc(event.params.appId)
      .collection("users").doc(followerUid)
      .get();

    const followerName = followerDoc.exists
      ? (followerDoc.data()?.nickname || "누군가")
      : "누군가";

    await sendPushToUser(targetUid, {
      title: "✨ 새 팔로워",
      body: `${followerName}님이 팔로우했습니다`,
      data: { type: "follow", followerUid, senderName: followerName },
    });
  }
);

// ─── 트리거 3: 새 책 발행 → 팔로워들에게 알림 ─────────────────────────────
exports.onBookCreated = onDocumentCreated(
  {
    document: "artifacts/{appId}/books/{bookId}",
    region: REGION,
  },
  async (event) => {
    const book = event.data?.data();
    if (!book) return;

    const { authorId, title, isAnonymous, authorNickname } = book;
    if (!authorId) return;

    // 작가의 팔로워 목록 조회
    const followersSnap = await adminDb
      .collection("artifacts").doc(event.params.appId)
      .collection("users").doc(authorId)
      .collection("followers")
      .get();

    if (followersSnap.empty) return;

    const authorName = isAnonymous ? "익명" : (authorNickname || "누군가");
    const shortTitle = title?.length > 20 ? title.slice(0, 20) + "…" : (title || "새 책");

    // 팔로워 각각에게 알림 (최대 50명)
    const followers = followersSnap.docs.slice(0, 50);
    const promises = followers.map((doc) =>
      sendPushToUser(doc.id, {
        title: `📚 ${authorName}님의 새 책`,
        body: `"${shortTitle}" — 지금 읽어보세요!`,
        data: { type: "new_book", bookId: event.params.bookId, senderName: authorName, bookTitle: shortTitle },
      })
    );
    await Promise.allSettled(promises);

    logger.info(`[NewBook] ${authorName}의 "${shortTitle}" → ${followers.length}명에게 알림`);
  }
);

// ─── 시리즈 새 에피소드 → 즐겨찾기 유저들에게 알림 ──────────────────────────
exports.notifySeriesEpisode = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

    const { bookId, bookTitle, episodeNumber, isFinale } = request.data;
    if (!bookId || !bookTitle) throw new HttpsError("invalid-argument", "필수 파라미터 누락");

    const callerUid = request.auth.uid;

    // 이 책을 즐겨찾기한 유저 목록 조회
    const favSnap = await adminDb
      .collection("artifacts").doc(APP_ID)
      .collection("public").doc("data")
      .collection("book_favorites")
      .where("bookId", "==", bookId)
      .get();

    if (favSnap.empty) return { notified: 0 };

    // 작가 닉네임
    const profileDoc = await adminDb
      .collection("artifacts").doc(APP_ID)
      .collection("users").doc(callerUid)
      .collection("profile").doc("info")
      .get();
    const authorName = profileDoc.exists ? (profileDoc.data()?.nickname || "작가") : "작가";

    const shortTitle = bookTitle.length > 20 ? bookTitle.slice(0, 20) + "…" : bookTitle;
    const epLabel = isFinale ? "[완결]" : `${episodeNumber}화`;

    // 즐겨찾기한 유저에게 알림 (본인 제외, 최대 100명)
    const targets = favSnap.docs
      .map(d => d.data().userId)
      .filter(uid => uid && uid !== callerUid);

    const unique = [...new Set(targets)].slice(0, 100);
    const promises = unique.map(uid =>
      sendPushToUser(uid, {
        title: `📖 "${shortTitle}" ${epLabel} 업데이트`,
        body: `${authorName}님이 새 에피소드를 올렸어요!`,
        data: { type: "new_episode", bookId, senderName: authorName, bookTitle: shortTitle },
      })
    );
    await Promise.allSettled(promises);

    logger.info(`[SeriesEpisode] "${shortTitle}" ${epLabel} → ${unique.length}명 알림`);
    return { notified: unique.length };
  }
);
