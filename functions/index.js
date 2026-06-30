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

// Gemini API 모델 설정 (Pro 메인, 장애 시 순서대로 폴백)
// 429/500/503/타임아웃 발생 시 다음 순위로 자동 전환
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-pro",         // 메인
  "gemini-2.5-pro",         // 재시도 (동일 모델, 1초 대기)
  "gemini-2.5-flash",       // 폴백 1
  "gemini-2.5-flash-lite",  // 폴백 2 (최종 안전망)
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
  "[CRITICAL RULE - 어미 다양성 강제] 한국어 어미 사용 시 다음 규칙을 절대 준수하라: (1) 한 단락 내에서 같은 어미를 연속 3회 이상 사용 금지. (2) '~했었다'는 대과거(과거의 더 먼 과거) 표현일 때만 허용. 단순 과거엔 '~했다' 사용. (3) 다음 9가지 어미 패턴을 의식적으로 교차 사용: E1 기본 단정(-했다/였다) · E2 상태/지각(-있었다/보였다/느껴졌다) · E3 진행(-하고 있었다) · E4 명사 종결(어두운 방./낯선 침묵.) · E5 도치/생략(걸었다, 천천히.) · E6 의문/감탄(왜였을까.) · E7 현재형 삽입(지금도 생각난다.) · E8 대사/인용 마무리 · E9 부사구/조사 종결(그저 그뿐.). (4) 한 단락(3~6문장)에 최소 3종류 어미 패턴 사용.",
  "[직유법 빈도 제한] '~듯/~듯한/~듯이/~듯해', '~처럼', '~같다/~같은/~같이', '~것 같다', '마치 ~' 같은 직유법 표현을 5,000자 기준 최대 5회 이내로 제한하라. 한 단락에 2회 이상 사용 금지. 대신 단정적 표현을 사용하라('~인 듯하다' → '~이다', '~처럼 보였다' → '~보였다').",
  "[주어 생략 & 대명사 규칙] 한국어는 주어를 자주 생략하는 언어다. 같은 인물이 연속 행동 시 첫 문장만 주어를 명시하고 이후 생략하라. '그는/그녀는'은 한 단락 내 최대 2회로 제한하고, 3회 이상 필요하면 이름/별칭으로 대체하거나 주어를 생략하라. 캐릭터 성별(그/그녀)은 글 전체에서 절대 바꾸지 마라.",
  "[감정 표현 클리셰 반복 금지 - CRITICAL] 같은 감정 반응·신체 표현·붕괴 비유를 글 전체에서 2회 이상 동일하게 반복하지 마라. 한 번 쓴 표현은 반드시 다른 신체 부위·감각·행동으로 변주하라. 특히 다음 4개 계열은 한 편 안에서 각 1회만 허용한다: ① 심장 반응 계열: '심장이 쿵 내려앉다/떨어지다/울리다', '심장이 쿵쾅거리다', '가슴이 쿵 하고' — 반복 금지, 대신 '호흡이 멎었다', '발이 바닥에 붙었다', '손가락이 굳어버렸다' 등 다른 신체 부위로 변주. 특히 '쿵', '쿵 하고', '쿵 하는 소리' 같은 충격음 표현은 글 전체에서 단 1회만 허용. 두 번째부터는 반드시 다른 신체 감각으로 대체하라. 예: '발이 바닥에 붙었다', '숨이 턱 막혔다', '눈앞이 멍해졌다'. ② 전율·열기 계열: '온몸에 전율이 흘렀다', '뜨거운 열기가 온몸을 감쌌다', '온몸의 신경이 집중됐다' — 반복 금지. ③ 붕괴·무너짐 계열: '얼음덩어리가 무너져 내렸다', '뭔가가 와르르 무너졌다', '가슴이 답답해졌다' — 반복 금지. ④ 시야 흐림 계열: '눈앞이 뿌옇게 흐려졌다', '모든 것이 흐릿해졌다' — 반복 금지. 감정의 강도가 올라갈수록 표현을 새롭게 발명하라. 독자는 같은 반응을 두 번 읽으면 감동이 아닌 식상함을 느낀다.",
  "[캐릭터 신체 버릇 시스템] 주인공과 주요 조연 각각에 1~2개의 고유한 '신체 버릇'을 부여하라(예: 입술 깨물기, 손톱 뜯기, 안경 치켜올리기, 머리카락 비틀기, 모자 챙 누름 등). 이 버릇은 글 전체에서 최소 3회 자연스럽게 등장해야 하며, 감정 상태에 따라 강도/빈도가 변한다. 캐릭터마다 다른 버릇을 부여해 구분하고, 결말에서 버릇의 변화로 캐릭터 성장을 표현하라."
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
  "공백 포함 3,000~4,000자 내외로 핵심 메시지를 명확히 전달하라.",
  "[표현 반복 금지] 같은 어구·문장 패턴을 글 전체에서 2회 이상 반복하지 마라. 특히 위로나 공감의 핵심 문구는 1회로 제한하고 이후엔 장면·비유·행동으로 같은 감정을 다른 방식으로 표현하라.",
  "[문장 도입부 반복 금지] '아마', '혹시', '어쩌면' 같은 추측 어구나 '당신도', '당신만', '당신은' 같은 독자 호명 표현을 문장 도입부에 2회 이상 같은 패턴으로 쓰지 마라. 같은 문장 구조로 시작하는 문단이 2개 이상 연속되어서는 안 된다."
].join(" ");

const NONFICTION_CATEGORY_STYLES = {
  "essay": [
    "개인적 경험에서 출발해 보편적 공감으로 확장하라. 나의 이야기가 독자의 이야기가 되는 순간을 만들어라.",
    "감정을 직접 서술하지 마라. 구체적인 장면과 감각(소리, 냄새, 온도, 촉감)으로 독자가 그 순간을 함께 느끼게 하라.",
    "문단과 문단 사이의 논리적 연결을 유지하라. 글의 중심 주제가 흔들리지 않게 잡아두어라.",
    "독자에게 말 거는 듯 친밀한 어조를 유지하되, 가볍지 않게. 사적인 고백처럼 쓰되 보편성을 잃지 마라.",
    "결론은 깔끔한 정리로 끝내지 마라. 새로운 질문을 남기거나 여운이 남는 장면·문장으로 마무리하라."
  ].join(" "),
  "self-help": [
    "추상적 조언을 금지한다. 모든 제안은 반드시 독자가 오늘 당장 실행할 수 있는 구체적 행동으로 제시하라.",
    "독자의 현실적 어려움과 내면의 저항감을 먼저 인정하라. 공감 없이 해결책을 던지면 독자는 마음을 닫는다.",
    "사례와 비유로 개념을 쉽게 풀어라. 낯선 개념은 독자가 이미 아는 일상적 경험에 비유해 착지시켜라.",
    "과도한 긍정과 동기부여 클리셰('당신은 할 수 있습니다', '지금 시작하세요')를 금지한다. 진정성 있는 언어를 써라.",
    "각 파트(단락 묶음)는 하나의 핵심 메시지만 담아라. 하나의 파트에 여러 주제를 욱여넣으면 독자가 실천하지 않는다."
  ].join(" "),
  "humanities": [
    "어려운 철학적·인문학적 개념을 독자의 일상 언어로 풀어라. 전문 용어는 반드시 즉시 쉬운 말로 부연하라.",
    "논리적 전개와 함께 감성적 울림을 유지하라. 머리로 이해하는 동시에 가슴으로 느끼게 하라.",
    "반론과 다른 시각을 인정하고 포용하는 방식으로 서술하라. 하나의 진리를 강요하지 마라.",
    "독단적 결론을 내리지 마라. 독자가 스스로 생각의 실마리를 잡고 한 발 더 나아갈 수 있도록 열린 마무리를 제공하라.",
    "고전 사례와 현대적 맥락을 균형 있게 활용하라. 고전만 나열하면 낡고, 현대만 쓰면 깊이가 없다."
  ].join(" ")
};

const NONFICTION_TONE_OPTIONS = {
  essay: ['담백한/건조한', '감성적인/시적인', '유머러스한/위트있는', '친근한/구어체'],
  'self-help': ['따뜻한 위로/격려', '강한 동기부여/독설', '논리적인/분석적인', '경험담 위주'],
  humanities: ['질문을 던지는/사색적인', '날카로운 비판', '대화 형식/인터뷰', '쉬운 해설/스토리텔링']
};

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

/** v1.0 PART B: 장르/트랙별 temperature 결정 */
function getNovelTemperature(category, subCategory, genre) {
  const track = normalizeNovelTrack(category, subCategory);
  const g = (genre || "").toString().trim();
  if (!track) return 0.75;
  if (g === "힐링") return 0.85;
  const group = resolveNovelMoodGroup(track, g);
  if (track === "webnovel") {
    if (group === "Thriller") return 0.82;
    if (group === "Romance") return 0.78;
    return 0.75;
  }
  if (track === "novel") {
    if (group === "Drama") return 0.90;
    if (group === "Romance") return 0.88;
    if (group === "Genre") return 0.85;
    return 0.87;
  }
  return 0.75;
}

// Guard Rail Matrix 1: Genre × Mood compatibility
const GUARD_RAIL_GENRE_MOOD_BLOCKED = {
  '로맨스':       ['사이다/먼치킨', '오컬트/기담', '하드보일드'],
  '로맨스 판타지': ['오컬트/기담', '하드보일드'],
  '무협':         ['달달/힐링'],
  '미스터리/공포': ['사이다/먼치킨', '달달/힐링'],
  '드라마':        ['사이다/먼치킨'],
  '힐링':         ['사이다/먼치킨', '후회/집착', '오컬트/기담', '하드보일드'],
  '미스터리/추리': ['사이다/먼치킨', '달달/힐링'],
  '스릴러':        ['달달/힐링'],
};
const GUARD_RAIL_GENRE_MOOD_CAUTION = {
  '로맨스 판타지': ['철학/사색'],
  '판타지':        ['달달/힐링', '후회/집착', '하드보일드'],
  '현대 판타지':   ['달달/힐링', '후회/집착', '하드보일드', '철학/사색'],
  '무협':          ['오컬트/기담'],
  '미스터리/공포': ['후회/집착'],
  'SF':            ['사이다/먼치킨', '달달/힐링', '후회/집착'],
  '드라마':        ['오컬트/기담'],
  '힐링':          ['철학/사색'],
};

function getMoodGuardRailStatus(genreName, moodFull) {
  if (!genreName || !moodFull) return 'ok';
  const blocked = GUARD_RAIL_GENRE_MOOD_BLOCKED[genreName] || [];
  const caution = GUARD_RAIL_GENRE_MOOD_CAUTION[genreName] || [];
  if (blocked.some(prefix => moodFull.startsWith(prefix))) return 'blocked';
  if (caution.some(prefix => moodFull.startsWith(prefix))) return 'caution';
  return 'ok';
}

// Cliffhanger type selection system
const CLIFFHANGER_TYPES = ['crisis', 'twist', 'choice', 'timer'];
const CLIFFHANGER_TYPE_LABELS = {
  crisis: '위기 직면—주인공이 최악의 상황에 놓인 순간에서 끊기',
  twist:  '충격 반전—예상 못한 인물 등장이나 진실 폭로 직후 끊기',
  choice: '선택의 기로—두 갈래 중 하나를 골라야 하는 순간에서 끊기',
  timer:  '시한폭탄—제한 시간이 다가오는 긴박감 속에서 끊기',
};
const CLIFFHANGER_GENRE_WEIGHTS = {
  '판타지':        { crisis: 3, twist: 2, choice: 2, timer: 1 },
  '현대 판타지':   { crisis: 3, twist: 2, choice: 2, timer: 1 },
  '무협':          { crisis: 3, twist: 2, choice: 2, timer: 1 },
  '로맨스':        { crisis: 1, twist: 2, choice: 3, timer: 1 },
  '로맨스 판타지': { crisis: 1, twist: 2, choice: 3, timer: 1 },
  '미스터리/공포': { crisis: 2, twist: 4, choice: 1, timer: 1 },
  '미스터리/추리': { crisis: 1, twist: 4, choice: 2, timer: 1 },
  '드라마':        { crisis: 2, twist: 2, choice: 4, timer: 1 },
  'SF':            { crisis: 2, twist: 2, choice: 2, timer: 4 },
  '스릴러':        { crisis: 2, twist: 2, choice: 2, timer: 4 },
  '힐링':          { crisis: 1, twist: 2, choice: 4, timer: 1 },
};

function selectCliffhangerType(recentTypes = [], genre = '') {
  const recent2 = (recentTypes || []).slice(-2);
  const candidates = CLIFFHANGER_TYPES.filter(t => !recent2.includes(t));
  const pool = candidates.length > 0 ? candidates : CLIFFHANGER_TYPES;
  const weights = CLIFFHANGER_GENRE_WEIGHTS[genre] || { crisis: 1, twist: 1, choice: 1, timer: 1 };
  const weighted = pool.flatMap(t => Array(weights[t] || 1).fill(t));
  return weighted[Math.floor(Math.random() * weighted.length)];
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

function buildEssayNarratorInstruction(narrator) {
  const n = (narrator || "").toString().trim();
  const instructions = {
    "고백하는 나": "1인칭 '나'로 서술하되, 독자 앞에서 속마음을 꺼내놓는 고백적 어조를 유지하라. 감춰왔던 감정이나 인정하기 어려운 사실을 솔직하게 풀어내는 톤.",
    "인생 선배": "1인칭 서술이되 독자보다 인생을 더 살아본 화자의 관점을 유지하라. 단정하지 말고 '내가 겪어보니 그렇더라' 식의 경험 공유 톤.",
    "츤데레 아저씨": "투박한 말투를 쓰라. '임마', '거 참', '뭐 그렇다는 거지' 같은 추임새를 자연스럽게 섞어라. 겉은 무뚝뚝하지만 속에는 따뜻한 마음이 있는 톤.",
    "또래 친구": "독자와 같은 눈높이의 1인칭 화자로 서술하라. 격식을 버리고 편한 구어체를 쓰되, 친한 친구에게 털어놓듯 자연스러운 흐름.",
    "관찰자": "3인칭 관찰자 시점으로 서술하라. 특정 인물이나 장면을 거리를 두고 묘사하되, 판단은 절제하고 독자가 스스로 느끼도록.",
    "전문가": "지식과 근거를 가진 전문가의 톤으로 서술하라. 개념을 정의하고, 구분하고, 설명하라. 단 권위적이지 않게, 안내하는 자세로."
  };
  return instructions[n] ? `[화자 Guideline] ${instructions[n]}` : null;
}

function buildEssayAngleInstruction(angle) {
  const a = (angle || "").toString().trim();
  const instructions = {
    "회고형": "과거 시제를 기본으로 삼아 지나간 경험이나 사건을 되돌아보는 구조로 써라. 그때는 몰랐지만 지금은 보이는 것들을 풀어내라.",
    "분석형": "현상의 원인과 구조를 논리적으로 풀어가라. '왜'라는 질문으로 시작해서 '그래서'로 끝나는 인과 사슬을 만들라.",
    "위로형": "'당신만 그런 게 아니다'라는 메시지를 중심에 두라. 독자의 상처나 불안을 가볍게 다루지 말고 인정한 뒤, 동행자로서 곁에 머무르라. 단, 이 메시지를 동일한 문구로 반복하지 마라. 한 번 직접 말했다면 이후엔 장면·비유·행동으로 같은 감정을 표현하라.",
    "질문형": "명확한 답을 제시하지 말고 질문으로 밀고 가라. 독자가 스스로 생각하게 만드는 여백이 핵심이다. 단, 질문을 남발하지 말고 핵심 질문에 집중하라.",
    "수용형": "바꾸려 하거나 해석하려 하지 말고 현상을 그대로 수용하는 태도를 유지하라. 판단을 유보하고 '그럴 수도 있다'는 자세로.",
    "경고형": "특정 행동이나 태도가 왜 위험한지 구체적으로 보여주라. 과장하지 말고, 실제 결과를 통해 보여주는 방식을 택하라."
  };
  return instructions[a] ? `[접근 각도 Guideline] ${instructions[a]}` : null;
}

function buildSelfHelpAudienceInstruction(audience) {
  const a = (audience || "").toString().trim();
  const instructions = {
    "막 시작하는 사람": "개념부터 차근차근 설명하라. 쉬운 시작 지점을 제시하고, 첫 발을 내딛는 데 필요한 최소한의 것만 다뤄라.",
    "이미 시도했지만 실패한 사람": "실패를 탓하지 말고 원인을 분석하라. 왜 안 됐는지 짚어주고, 다시 시작할 수 있는 구체적인 방법을 제시하라.",
    "완전히 지쳐버린 사람": "멈춰도 된다는 허락부터 줘라. 회복을 중심에 두고, 지금 당장 실천보다 마음을 추스르는 것을 우선하라."
  };
  return instructions[a] ? `[독자 상황 Guideline] ${instructions[a]}` : null;
}

function buildHumanitiesStartingPointInstruction(startingPoint) {
  const s = (startingPoint || "").toString().trim();
  const instructions = {
    "일상 장면에서": "평범한 일상의 한 장면이나 경험에서 시작해 개념으로 확장하라. 독자가 공감하는 구체적 순간을 입구로 삼아라.",
    "개념 정의에서": "핵심 용어를 먼저 해체하고 재정의하라. 우리가 당연하게 쓰는 말의 의미를 다시 묻는 것으로 논리를 전개하라.",
    "역사적 사례에서": "과거의 사건이나 인물에서 출발해 현재와 연결하라. 역사를 거울로 삼아 지금을 비추는 구조로.",
    "역설·모순에서": "직관에 반하는 명제나 모순처럼 보이는 주장으로 시작하라. 독자의 예상을 뒤집고 다시 생각하게 만드는 것이 목표."
  };
  return instructions[s] ? `[사유의 출발점 Guideline] ${instructions[s]}` : null;
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
    friendly: "[적용 범위] 서술자의 내레이션에만 적용. [대사 처리] 캐릭터별 자연스러운 말투를 우선(노인 캐릭터는 노년체, 어린아이는 반말 등). [내레이션 어미] '-했어', '-였지', '-하네', '-거든', '-잖아', '-더라' 등 구어체를 일관 사용. 친구에게 이야기하듯 부드럽고 감성적인 표현. 문장 길이는 짧고 리듬감 있게. [금지] '-했다', '-합니다' 같은 다른 문체를 내레이션에 절대 섞지 마라. [친근체 어미 다양성 - CRITICAL] '-했어' 종결을 한 단락 내 3회 이상 연속 사용 금지. 다음 어미를 의식적으로 교차 사용: ~어/~었어(기본), ~지/~었지(회상), ~네/~더라/~더라고(깨달음), ~거든/~잖아(강조), ~을걸/~을지도(추측), 명사 종결(어두운 방.), 도치/생략(걸었어, 천천히.), 부사구 종결(그저 그뿐.). 한 단락(3~6문장)에 최소 3종류 어미 패턴 사용.",
    formal: "[적용 범위] 서술자의 내레이션에만 적용. [대사 처리] 캐릭터별 자연스러운 말투를 우선. [내레이션 어미] '-했다', '-였다', '-이었다' 등 과거형 서술어 일관 사용. 군더더기 없는 간결한 문장. 감정을 직접 드러내기보다 행간에 숨기는 절제된 문체. [금지] '-했어', '-합니다' 같은 다른 문체를 내레이션에 절대 섞지 마라. '-했었다'는 진짜 대과거(과거의 더 먼 과거) 표현일 때만 허용. [어미 다양성] '-했다'에 갇히지 말고 명사 종결(어두운 방.), 도치(걸었다, 천천히.), 부사구 종결(그저 그뿐.), '-있었다/보였다/느껴졌다' 등 상태 동사를 적극 교차 활용. 단정 어미 연속 3회 절대 금지.",
    polite: "[적용 범위] 서술자의 내레이션에만 적용. [대사 처리] 캐릭터별 자연스러운 말투를 우선. [내레이션 어미] '-했습니다', '-입니다', '-세요' 등 존댓말 일관 사용. 독자를 존중하며 안내하는 듯한 품위 있는 어조. [금지] '-했어', '-했다' 같은 다른 문체를 내레이션에 절대 섞지 마라."
  };
  return instructions[tone] ? `[말투/문체 Guideline - CRITICAL] ${instructions[tone]}` : null;
}

function buildTrackGuide(track) {
  if (track === "webnovel") {
    return [
      "[웹소설 스타일 지침]",
      "문장은 짧고 리드미컬하게 끊어라. 한 문단은 3~5줄 이내로 유지하라.",
      "빠른 전개를 우선하라. 긴 설명보다 사건과 반응을 먼저 보여줘라.",
      "대화 비중을 전체의 60% 이상으로 유지하라. 감정은 대사와 행동으로 직접 표현 허용.",
      "장르 클리셰(먼치킨, 설렘 폭발, 사이다 반전 등)는 독자가 원하는 쾌감 요소다. 적극 활용하라.",
    ].join(" ");
  }
  if (track === "novel") {
    return [
      "[문학소설 스타일 지침]",
      "묘사 중심으로 서술하라. 긴 호흡의 문장과 풍부한 감각 묘사로 장면을 구축하라.",
      "감정을 직접 서술하지 마라. 인물의 행동·표정·침묵·환경 묘사로 간접적으로 전달하라.",
      "대화는 꼭 필요한 순간에만 사용하고 서사적 밀도를 높여라.",
      "진부한 클리셰(운명적 만남, 예측 가능한 반전, 상투적 비유)는 금지. 독창적이고 구체적인 표현을 써라.",
    ].join(" ");
  }
  return null;
}

function buildPOVInstruction(selectedPOV) {
  const pov = (selectedPOV || "").toString().trim();
  if (!pov) return null;
  const instructions = {
    first_person: "1인칭 주인공 시점으로 서술하라. 주인공이 '나'로서 자신의 이야기를 생생하게 전달하는 톤을 유지하라. [1인칭 시점 엄수 - CRITICAL] 허용: 화자 본인의 행동/감정/감각, 화자가 외부에서 관찰한 다른 인물의 행동/외모/표정, 화자가 추측한 다른 인물의 감정('슬퍼 보였어', '~인 것 같았어'). 금지: 다른 인물의 내면 직접 서술('그의 마음은 슬픔으로 가득했다'), 화자가 볼 수 없는 장면의 객관적 묘사('그는 등 뒤로 칼을 쥐었다' — 화자가 안 봤음), 작가 시점의 객관적 사실 서술. 액션 장면에서도 반드시 화자의 시야 안에서만 묘사하라.",
    third_limited: "3인칭 관찰자 시점으로 서술하라. 주인공의 행동과 말을 옆에서 지켜보는 관찰자처럼 묘사하라. 주인공의 내면은 행동과 대사로만 간접적으로 드러내고, 주인공 외 인물의 내면은 직접 서술하지 마라.",
    omniscient: "전지적 작가 시점으로 서술하라. 모든 등장인물의 생각과 감정, 속마음까지 자유롭게 드러내며 서술하라. 전지적 시점은 특정 인물 한 명에 고정되지 않는다. 서사적으로 필요한 순간에는 다른 인물의 내면, 감정, 생각도 자연스럽게 서술하라. 단, 한 장면 안에서 여러 인물의 내면을 동시에 서술하면 혼란스러우니 — 장면이 전환될 때 시점 인물을 바꾸는 방식으로 활용하라."
  };
  return instructions[pov] ? `[POV Guideline] ${instructions[pov]}` : null;
}

function buildSystemPrompt({ isNovel, category, subCategory, genre, isSeries = false, episodeType = null, endingStyle, selectedTone, selectedMood, selectedPOV, selectedSpeechTone, selectedDialogueRatio, selectedCliffhangerType = null, essayNarrator = null, essayAngle = null, selfHelpAudience = null, humanitiesStartingPoint = null }) {
  if (isNovel) {
    const endingGuide = endingStyle
      ? `결말은 반드시 '${endingStyle}' 형태로 끝내며 그 톤을 유지하라.`
      : "결말은 독자의 여운을 남기는 방식으로 완성하라.";
    const moodGuide = buildNovelMoodInstruction(category, subCategory, genre, selectedMood);

    // Guard Rail: warn AI about conflicting genre×mood combination
    const guardRailStatus = getMoodGuardRailStatus(genre, selectedMood);
    const guardRailWarning = guardRailStatus === 'blocked'
      ? `[Guard Rail 주의] 현재 분위기(${selectedMood})는 ${genre} 장르와 충돌합니다. 장르 정체성을 최대한 유지하면서 사용자 선택 분위기를 부분적으로만 반영하세요.`
      : guardRailStatus === 'caution'
      ? `[Guard Rail 참고] 현재 분위기(${selectedMood})는 ${genre} 장르에서 조건부 사용 가능합니다. 장르 특성과 분위기의 균형을 신중히 조율하세요.`
      : null;

    const track = normalizeNovelTrack(category, subCategory);
    const trackGuide = buildTrackGuide(track);

    const resolvedSpeechTone = selectedSpeechTone || null;
    const resolvedDialogueRatio = track === "webnovel" ? "dialogue_heavy"
      : track === "novel" ? "description_heavy"
      : selectedDialogueRatio;

    const povGuide = buildPOVInstruction(selectedPOV);
    const speechToneGuide = buildSpeechToneInstruction(resolvedSpeechTone);
    const dialogueRatioGuide = buildDialogueRatioInstruction(resolvedDialogueRatio);
    // episodeType: null(단편/1화), 'continue'(이어쓰기), 'finalize'(완결)
    let structureGuide;
    if (episodeType === 'finalize') {
      structureGuide = "이번 화는 완결 화다. 지금까지 쌓아온 모든 갈등·복선을 빠짐없이 회수하며, 각 등장인물의 변화와 결말을 충분히 보여주어라. 공백 포함 약 5,000자 이상의 묵직하고 완성도 높은 결말을 작성하라. 단계 구분 없이 하나의 흐름으로 서술하라. 서두르지 말고, 인물들의 감정과 후일담을 충분히 담아라.";
    } else if (episodeType === 'continue') {
      const cliffLabel = selectedCliffhangerType && CLIFFHANGER_TYPE_LABELS[selectedCliffhangerType]
        ? CLIFFHANGER_TYPE_LABELS[selectedCliffhangerType]
        : null;
      const cliffInstruction = cliffLabel
        ? `이번 화의 절단신공은 반드시 '${cliffLabel}' 유형으로 끝내라.`
        : "마지막은 반드시 절단신공(Cliffhanger)으로 끝내라. 절단신공 유형: (1)위기 직면—주인공이 최악의 상황에 놓인 순간에서 끊기, (2)충격 반전—예상 못한 인물 등장이나 진실 폭로 직후 끊기, (3)선택의 기로—두 갈래 중 하나를 골라야 하는 순간에서 끊기, (4)시한폭탄—제한 시간이 다가오는 긴박감 속에서 끊기. 이 중 장면에 맞는 유형을 선택하라.";
      structureGuide = `이번 화는 연재 중인 에피소드다. 직전 화의 마지막 장면에서 자연스럽게 이어 공백 포함 약 5,000자 이상을 작성하라. 단계 구분 없이 하나의 흐름으로 서술하고, ${cliffInstruction}`;
    } else if (isSeries) {
      structureGuide = "이번 화는 시리즈의 첫 번째 화다. [시작-사건과 훅] 2단계 구조로 공백 포함 약 5,000자 내외로 작성하라. 마지막은 독자가 다음 화를 참을 수 없게 만드는 강렬한 훅(Hook)으로 끝맺어라. 훅 유형: 주인공이 모험/위기에 발을 딛는 순간, 예상 못한 진실이 드러나는 순간, 또는 운명적 선택을 해야 하는 순간에서 끊어라.";
    } else {
      structureGuide = "단편 소설로, [발단-전개-위기-절정-결말] 5단계 구조로 공백 포함 약 6,000자 내외로, 단계별 비율에 맞춰 작성하라. 절정에서는 갈등을 최고조로 끌어올리며, 전체 분량의 약 30%를 할애한다. 분량이 많은 만큼 장면 묘사와 인물 심리를 충분히 깊게 파고들어라.";
    }
    return [
      `당신은 ${genre || "소설"} 분야의 최고 작가입니다.`,
      `[장르 지침] ${pickGenreGuideline(genre)}`,
      moodGuide,
      guardRailWarning,
      trackGuide,
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
  const narratorInstruction = buildEssayNarratorInstruction(essayNarrator);
  const angleInstruction = buildEssayAngleInstruction(essayAngle);
  const audienceInstruction = buildSelfHelpAudienceInstruction(selfHelpAudience);
  const startingPointInstruction = buildHumanitiesStartingPointInstruction(humanitiesStartingPoint);
  const nonfictionCategoryName = category === "essay" ? "에세이"
    : category === "self-help" ? "자기계발"
    : "인문/철학";
  return [
    `당신은 ${nonfictionCategoryName} 분야의 최고 저자입니다.`,
    toneInstruction || "독자의 공감을 이끌어내는 흥미롭고 통찰력 있는 글을 쓰세요.",
    narratorInstruction,
    angleInstruction,
    audienceInstruction,
    startingPointInstruction,
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
  isNovel,
  title,
  stepMeta = null,
  speechTone = null
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
    ? `[정적 메모리 - 불변, 요약하지 않음]\nSynopsis (전체 시나리오):\n${synopsis || "(없음)"}\n\nCharacter Sheet (이름/성격/버릇·특이한 행동 절대 유지):\n${characterSheet || "(없음)"}\n\nSetting Sheet (시대/장소/세계관 절대 유지):\n${settingSheet || "(없음)"}\n\n`
    : "";
  const dynamicContext = isNovel
    ? `[동적 메모리 - 누적 갱신]\n${summaryBlock}\n${lastBlock}`
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
    baseInstruction.push("[절대 금지] 이 단계의 마지막을 문장 중간에서 끊지 마세요. 반드시 마침표(.), 느낌표(!), 물음표(?), 말줄임표(…) 중 하나로 완성된 문장을 끝으로 마무리하세요.");
    if (speechTone) {
      const toneHint = speechTone === 'polite'
        ? "정중체(-했습니다/-입니다/-세요)로 서술하세요. '-했다/-했어' 등 다른 문체를 내레이션에 절대 섞지 마세요."
        : speechTone === 'formal'
        ? "단정체(-했다/-였다)로 서술하세요. '-했습니다/-했어' 등 다른 문체를 내레이션에 절대 섞지 마세요."
        : speechTone === 'friendly'
        ? "친근체(-했어/-였지/-더라)로 서술하세요. '-했다/-했습니다' 등 다른 문체를 내레이션에 절대 섞지 마세요."
        : null;
      if (toneHint) baseInstruction.push(`[말투 유지 - CRITICAL] 이번 단계도 반드시 ${toneHint}`);
    }
  } else {
    baseInstruction.push("[단계 연결] 이전 단계의 흐름을 자연스럽게 이어받아 전개하세요. 갑자기 새로운 주제로 넘어가지 말고, 앞선 논의를 발전시키는 형태로 서술하세요.");
  }

  let stepRuleBlock = "";
  if (stepMeta) {
    const { targetChars, accumulatedChars, totalChars, nextStepName, role } = stepMeta;
    const pctDone = totalChars > 0 ? Math.round((accumulatedChars / totalChars) * 100) : 0;
    const lines = [
      `==========================================`,
      `[이번 단계 작성 규칙]`,
      `==========================================`,
      `- 단계명: ${currentStep.name}`,
      `- 목표 분량: ${targetChars}자 (±10% 허용, ${Math.round(targetChars * 0.9)}~${Math.round(targetChars * 1.1)}자)`,
      `- 누적 진행률: ${accumulatedChars}자 / ${totalChars}자 (${pctDone}% 진행 중)`,
      nextStepName ? `- 다음 단계 예고: ${nextStepName}` : null,
      role ? `- 이번 단계의 역할: ${role}` : null,
      `==========================================`,
    ].filter(Boolean).join("\n");
    stepRuleBlock = `\n${lines}\n`;
  }

  return `주제(Seed): ${seed}\n단계: ${currentStep.name}\n\n${staticContext}${dynamicContext}${stepRuleBlock}${baseInstruction.join("\n")}`;
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

/** 문자열 간 2-gram Jaccard 유사도 (한국어 음절 기준) */
function ngramSimilarity(a, b, n = 2) {
  if (!a || !b) return 0;
  const sa = a.replace(/\s+/g, "");
  const sb = b.replace(/\s+/g, "");
  if (sa === sb) return 1;
  if (sa.length < n || sb.length < n) return 0;
  const getNgrams = (s) => {
    const set = new Set();
    for (let i = 0; i <= s.length - n; i++) set.add(s.slice(i, i + n));
    return set;
  };
  const setA = getNgrams(sa);
  const setB = getNgrams(sb);
  let intersection = 0;
  for (const ng of setA) if (setB.has(ng)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** 반복 검출 및 제거 (v1.1.1 강화 2 패턴 A·B) */
function detectAndFixRepetition(content) {
  if (!content) return content;

  // Pattern A: 1~5글자 단독 라인 + 다음 줄이 같은 글자로 시작하면 제거
  let text = content.replace(/^(.{1,5})\n(.+)$/gm, (match, line, nextLine) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > 5) return match;
    if (/[.!?。…]$/.test(trimmed)) return match;
    if (nextLine.trim().startsWith(trimmed)) {
      logger.info(`[repetition] Pattern A removed lone line: "${trimmed}"`);
      return nextLine;
    }
    return match;
  });

  // Pattern B: 인접 단락 유사도 검사
  const paragraphs = text.split(/\n\n+/);
  const result = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;
    if (i === 0) { result.push(para); continue; }

    const prevPara = result[result.length - 1] || "";

    // B-2: 이전 단락 끝 500자 vs 현재 단락 전체 ≥ 70% → 현재 단락 통째 제거
    const prevTail = prevPara.slice(-500);
    const sim2 = ngramSimilarity(prevTail, para);
    if (sim2 >= 0.70) {
      logger.warn(`[repetition] Pattern B-2 removed paragraph (sim: ${sim2.toFixed(2)})`);
      continue;
    }

    // B-1: 이전 단락 마지막 문장 vs 현재 단락 첫 문장 ≥ 80% → 현재 단락 첫 문장만 제거
    const prevSentences = prevPara.split(/(?<=[.!?…])\s+/).filter(Boolean);
    const currSentences = para.split(/(?<=[.!?…])\s+/).filter(Boolean);
    const lastSentPrev = prevSentences[prevSentences.length - 1] || "";
    const firstSentCurr = currSentences[0] || "";
    const sim1 = ngramSimilarity(lastSentPrev, firstSentCurr);
    if (sim1 >= 0.80 && currSentences.length > 1) {
      logger.warn(`[repetition] Pattern B-1 removed duplicate first sentence (sim: ${sim1.toFixed(2)})`);
      result.push(currSentences.slice(1).join(" "));
      continue;
    }
    // B-1b: 이전 단락 마지막 문장이 현재 단락 첫 문장을 suffix로 포함하는 경우
    // (긴 문장의 끝부분 = 다음 단락 시작 문장인 반복 패턴)
    const normLast  = lastSentPrev.replace(/[\s.!?…]+/g, "");
    const normFirst = firstSentCurr.replace(/[\s.!?…]+/g, "");
    if (normFirst.length >= 8 && normLast.endsWith(normFirst) && currSentences.length > 1) {
      logger.warn(`[repetition] Pattern B-1b removed suffix-duplicated first sentence: "${firstSentCurr.slice(0, 30)}..."`);
      result.push(currSentences.slice(1).join(" "));
      continue;
    }

    // B-3: 꼬리 문장 단위 직접 비교 (tail-to-tail 반복 제거)
    // - window 기반 pre-check 없이 바로 탐색 (unique 도입부에 의한 희석 방지)
    // - overlapCount == currSentences.length 이고 단락이 minSentencesForFullDelete 이상이면 전체 삭제
    //   (미만이면 의도적 강조·수미상관 가능성 → 꼬리 trim만 적용)
    if (currSentences.length > 1) {
      const { tailSimilarity, maxTailSentences, minSentencesForFullDelete } = QC_THRESHOLDS.repetition;
      let overlapCount = 0;
      const maxK = Math.min(currSentences.length, prevSentences.length, maxTailSentences);
      for (let k = 1; k <= maxK; k++) {
        const simK = ngramSimilarity(currSentences.slice(-k).join(" "), prevSentences.slice(-k).join(" "));
        if (simK >= tailSimilarity) {
          overlapCount = k;
        } else {
          break;
        }
      }
      if (overlapCount === currSentences.length && currSentences.length >= minSentencesForFullDelete) {
        logger.warn(`[repetition] Pattern B-3 removed entire duplicate paragraph (${currSentences.length}문장)`);
        continue;
      } else if (overlapCount > 0) {
        logger.warn(`[repetition] Pattern B-3 trimmed tail ${overlapCount}개 문장`);
        result.push(currSentences.slice(0, currSentences.length - overlapCount).join(" "));
        continue;
      }
    }

    // B-4: 현재 단락 머리 vs 이전 단락 꼬리 (head-of-curr = tail-of-prev 패턴)
    // 이전 단락 끝 k문장이 현재 단락 첫 k문장과 동일하고, 현재 단락에 새 문장이 추가된 경우
    // k를 maxK→minSentencesForFullDelete 순으로 탐색해 가장 긴 overlap을 찾음
    if (currSentences.length > 1) {
      const { tailSimilarity, maxTailSentences, minSentencesForFullDelete } = QC_THRESHOLDS.repetition;
      let headOverlapCount = 0;
      const maxK = Math.min(currSentences.length, prevSentences.length, maxTailSentences);
      for (let k = maxK; k >= minSentencesForFullDelete; k--) {
        const simK = ngramSimilarity(
          currSentences.slice(0, k).join(" "),
          prevSentences.slice(-k).join(" ")
        );
        if (simK >= tailSimilarity) {
          headOverlapCount = k;
          break;
        }
      }
      if (headOverlapCount === currSentences.length && currSentences.length >= minSentencesForFullDelete) {
        logger.warn(`[repetition] Pattern B-4 removed entire duplicate paragraph (head=tail, ${currSentences.length}문장)`);
        continue;
      } else if (headOverlapCount > 0) {
        logger.warn(`[repetition] Pattern B-4 trimmed head ${headOverlapCount}개 문장 (head-overlap-extension)`);
        result.push(currSentences.slice(headOverlapCount).join(" "));
        continue;
      }
    }

    // B-5: 비인접 단락 전체 중복 검사 (직전 단락 이외 최근 단락과의 exact duplicate)
    // B-2가 커버하지 못하는 cross-step 중복 단락 제거
    {
      const { nonAdjacentSimilarity, nonAdjacentLookback, minSentencesForFullDelete } = QC_THRESHOLDS.repetition;
      if (currSentences.length >= minSentencesForFullDelete && result.length >= 2) {
        const lookback = Math.min(result.length - 1, nonAdjacentLookback);
        let removedByB5 = false;
        for (let back = 2; back <= lookback + 1; back++) {
          const olderPara = result[result.length - back];
          if (!olderPara) break;
          const simOlder = ngramSimilarity(para, olderPara);
          if (simOlder >= nonAdjacentSimilarity) {
            logger.warn(`[repetition] Pattern B-5 removed non-adjacent duplicate (sim: ${simOlder.toFixed(2)}, ${back}단락 전)`);
            removedByB5 = true;
            break;
          }
        }
        if (removedByB5) continue;
      }
    }

    result.push(para);
  }

  return result.join("\n\n");
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

  // 반복 검출 및 제거 (단락 통째 반복, 첫 문장 중복, 단어 단독 라인)
  cleaned = detectAndFixRepetition(cleaned);

  // 감정 '쿵' 표현 직접 치환 (QC 재시도 대신 결정적 후처리)
  cleaned = replaceKungExpressions(cleaned);

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

/** 스텝 경계 미완성 문장 트림
 * 가드 1: 마지막 구두점이 전체의 앞 절반에 있으면 트림 생략 (내용 대부분이 날아가는 케이스)
 * 가드 2: 잘릴 조각이 전체의 20% 이상이면 트림 생략, 경고 로그만 (재생성이 맞는 케이스)
 */
function trimToLastSentence(content) {
  if (!content) return content;
  const trimmed = content.trimEnd();
  if (/[.!?…]["'」』]?\s*$/.test(trimmed)) return content; // 이미 완성된 문장으로 끝남

  const lastPunct = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('?'),
    trimmed.lastIndexOf('…'),
  );

  // 가드 1: 구두점이 전체의 앞 절반 이하에 있으면 트림 생략
  if (lastPunct <= trimmed.length * 0.5) return content;

  // 닫는 따옴표가 구두점 바로 뒤에 오는 경우 포함
  const charAfter = trimmed[lastPunct + 1];
  const endPos = /["'」』]/.test(charAfter) ? lastPunct + 2 : lastPunct + 1;

  const fragment = trimmed.slice(endPos).trim();
  const fragmentRatio = fragment.length / trimmed.length;

  // 가드 2: 잘릴 조각이 전체의 20% 이상이면 트림하지 않고 경고만
  if (fragmentRatio > 0.20) {
    logger.warn(`[step-boundary] 미완성 조각 ${Math.round(fragmentRatio * 100)}% — 트림 생략 원본 유지: "${fragment.slice(0, 50)}"`);
    return content;
  }

  logger.warn(`[step-boundary] 미완성 문장 트림 (${Math.round(fragmentRatio * 100)}%): "${fragment.slice(0, 50)}"`);
  return trimmed.slice(0, endPos);
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
  // 요약은 단순 추출 작업 — flash 모델로 충분
  const FLASH_MODEL_INDEX = 2;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callGemini(systemPrompt, prompt, 0.2 - attempt * 0.1, isNovel, FLASH_MODEL_INDEX);
    const text = (result.content || "").trim();
    if (validateOutput(text, "ko").valid) return text;
  }
  const result = await callGemini(systemPrompt, prompt, 0.1, isNovel, FLASH_MODEL_INDEX);
  return (result.content || "").trim();
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
async function callGemini(systemPrompt, userPrompt, temperature = 0.75, isNovel = false, modelIndex = 0, maxTokens = null) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  const modelName = MODEL_FALLBACK_CHAIN[modelIndex];
  const hasNext = modelIndex + 1 < MODEL_FALLBACK_CHAIN.length;

  // 동일 모델 재시도(index 1)는 일시적 장애 회복을 위해 1초 대기
  if (modelIndex > 0 && MODEL_FALLBACK_CHAIN[modelIndex] === MODEL_FALLBACK_CHAIN[modelIndex - 1]) {
    await new Promise(r => setTimeout(r, 1000));
  }

  try {
    logger.info(`[Gemini API] 모델 사용: ${modelName} (${modelIndex + 1}/${MODEL_FALLBACK_CHAIN.length})`);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
    ];

    const generationConfig = {
      temperature: temperature,
      maxOutputTokens: maxTokens || (isNovel ? 12288 : 10240)
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

    if (!text || !text.trim()) {
      const finishReason = response.candidates?.[0]?.finishReason;
      logger.warn(`[Gemini API] 빈 응답 수신 (모델: ${modelName}, finishReason: ${finishReason})`);

      if (finishReason === 'SAFETY') {
        throw new Error('입력하신 주제나 키워드가 안전 정책에 의해 제한되었습니다. 표현을 조금 바꿔서 다시 시도해주세요.');
      }

      if (hasNext) {
        logger.warn(`[Gemini API] 빈 응답 → 대체 모델로 재시도: ${MODEL_FALLBACK_CHAIN[modelIndex + 1]}`);
        return callGemini(systemPrompt, userPrompt, temperature, isNovel, modelIndex + 1, maxTokens);
      }

      throw new Error('생성된 내용이 없습니다. 주제나 키워드를 바꿔서 다시 시도해주세요.');
    }

    logger.info(`[Gemini API] ✅ 성공! 사용 모델: ${modelName} (응답 길이: ${text.length}자)`);

    return { content: text };
  } catch (error) {
    const status = getErrorStatus(error);
    logger.error(`[Gemini API] 호출 실패 (모델: ${modelName}):`, error.message);

    if (hasNext && isRetryableWithFallback(error)) {
      const nextModel = MODEL_FALLBACK_CHAIN[modelIndex + 1];
      logger.warn(`[Gemini API] 대체 모델로 재시도: ${nextModel} (status: ${status})`);
      return callGemini(systemPrompt, userPrompt, temperature, isNovel, modelIndex + 1, maxTokens);
    }

    throw error;
  }
}

const MAX_LANGUAGE_RETRIES = 3;
const TEMPERATURE_DECREMENT = 0.1;
const MIN_TEMPERATURE = 0.2;

// ─────────────────────────────────────────────────────────────
// QC 임계값 상수 (추후 Firebase Remote Config로 외부화 예정)
// ─────────────────────────────────────────────────────────────
const QC_THRESHOLDS = {
  endingDiversity: {
    hadEottaLimit:            1,  // '~었었다/았었다' 이 횟수 이상 → violation 1개
    formalConsecutiveLimit:   3,  // 단정체(기본): 연속 같은 어미 한도
    friendlyConsecutiveLimit: 4,  // 친근체(friendly): 연속 같은 어미 한도
    violationRetryThreshold:  3,  // violation 누적 이 수 이상 → 재시도
  },
  simile: {
    windowSize:    5000,  // 기준 글자 수 (이 글자 수당 maxPerWindow회)
    maxPerWindow:     5,  // windowSize자당 허용 최대 직유 횟수
    logOverMin:       4,  // 초과 이 수 이상: warn 로그
    retryOverMin:     8,  // 초과 이 수 이상: 재시도
  },
  expressionRepeat: {
    minPhraseLen:    4,  // 검출 대상 최소 글자 수
    maxPhraseLen:   10,  // 검출 대상 최대 글자 수
    minKorChars:     3,  // 구간 내 한글 최소 포함 글자 수
    repeatThreshold: 3,  // 이 횟수 이상 반복 시 위반
    minTextLen:    200,  // 텍스트가 이 길이 미만이면 검사 생략
    // kungRepeatThreshold 제거 — '쿵' 표현은 QC 재시도 대신 replaceKungExpressions 후처리로 전환
  },
  repetition: {
    tailSimilarity:           0.75,  // B-3/B-4: 문장 단위 유사도 임계값
    maxTailSentences:            8,  // B-3/B-4: 탐색 최대 문장 수 (성능 상한)
    minSentencesForFullDelete:   3,  // B-3/B-4: 전체 단락 삭제 허용 최소 문장 수
    nonAdjacentSimilarity:    0.90,  // B-5: 비인접 단락 중복 판정 임계값 (높게 설정)
    nonAdjacentLookback:         8,  // B-5: 뒤로 탐색할 최대 단락 수
  },
};

// 감정 '쿵' 표현 후처리 대체 표현 풀
// friendly(어/어요) / formal(다) 두 세트 — 원문 어미 감지 후 선택
const KUNG_ALTERNATIVES = {
  friendly: [
    "숨이 턱 막혔어.",
    "발이 바닥에 붙은 것 같았어.",
    "눈앞이 하얘지는 것 같았어.",
    "손끝이 싸늘해지는 걸 느꼈어.",
    "등줄기가 서늘해졌어.",
    "입술이 굳어버렸어.",
    "온몸이 얼어붙는 것 같았어.",
    "귓가에 아무 소리도 들리지 않았어.",
    "목구멍이 바짝 마르는 것 같았어.",
    "두 발이 바닥에 뿌리를 내린 것 같았어.",
  ],
  formal: [
    "숨이 턱 막혔다.",
    "발이 바닥에 붙은 것 같았다.",
    "눈앞이 하얘지는 것 같았다.",
    "손끝이 싸늘해지는 걸 느꼈다.",
    "등줄기가 서늘해졌다.",
    "입술이 굳어버렸다.",
    "온몸이 얼어붙는 것 같았다.",
    "귓가에 아무 소리도 들리지 않았다.",
    "목구멍이 바짝 마르는 것 같았다.",
    "두 발이 바닥에 뿌리를 내린 것 같았다.",
  ],
};

// 감정 '쿵' 표현 후처리 직접 치환
// - QC 재시도 대신 항상 동작하는 결정적 치환 (MAX_LANGUAGE_RETRIES 소진 후 통과 문제 해결)
// - 원문 어미("다." vs 그 외) 감지 → 말투 맞는 대체 표현 풀 선택
// - 쿵쿵/쿵쾅/쿵탕(의태어) 제외
// - 단락 구조(이중 개행) 보존
function replaceKungExpressions(text) {
  if (!text) return text;

  const kungRegex = /심장[이가]?\s*쿵|가슴[이가]?\s*쿵|쿵[,\s]*하고|쿵[,\s]*내려|쿵[,\s]*울리|쿵[,\s]*떨어/;
  let replacedCount = 0;

  // 대체 표현 순서를 전역적으로 순환 (같은 텍스트 내 반복 방지)
  const counters = { friendly: 0, formal: 0 };

  const processedParas = text.split(/\n\n+/).map(para => {
    const sentences = para.split(/(?<=[.!?…])\s+/);
    const resultSents = sentences.map(sentence => {
      const m = sentence.match(kungRegex);
      // 문장 전체에 의태어(쿵쿵/쿵쾅/쿵탕)가 있으면 치환 제외 — m[0]만 보면 "심장이 쿵" 매치가 "쿵쿵" 포함 여부를 못 잡음
      if (!m || /쿵쿵|쿵쾅|쿵탕/.test(sentence)) return sentence;

      // 원문 어미 감지: "다."로 끝나면 formal, 그 외 friendly
      const tone = /다[.!]?\s*$/.test(sentence.trim()) ? "formal" : "friendly";
      const pool = KUNG_ALTERNATIVES[tone];
      const alt = pool[counters[tone] % pool.length];
      counters[tone]++;
      replacedCount++;

      logger.info(`[kung-replace] [${tone}] "${sentence.slice(0, 50).trim()}" → "${alt}"`);
      return alt;
    });
    return resultSents.join(" ");
  });

  if (replacedCount > 0) {
    logger.warn(`[kung-replace] 감정 '쿵' 표현 ${replacedCount}개 직접 치환 완료`);
  }

  return processedParas.join("\n\n");
}

// Step 7: 어미 다양성 검증
// - 대화문(따옴표·낫표) 제거 후 서술 텍스트만 검사
// - '~었었다/았었다' 1회 이상, 연속 어미(말투별 한도) 각각 violation 누적
// - violation이 violationRetryThreshold 이상 → 재시도, 미만 → warn 로그
function checkEndingDiversity(text, speechTone = null) {
  if (!text) return { valid: true };

  const {
    hadEottaLimit,
    formalConsecutiveLimit,
    friendlyConsecutiveLimit,
    violationRetryThreshold,
  } = QC_THRESHOLDS.endingDiversity;

  // 대화문 제거 (큰따옴표, 작은따옴표, 낫표)
  const narrative = text.replace(/"[^"]*"|'[^']*'|「[^」]*」|『[^』]*』/g, '');

  const violations = [];

  // 위반 ①: '~었었다/았었다' 오남용
  const hadEottaCount = (narrative.match(/[았었]었/g) || []).length;
  if (hadEottaCount >= hadEottaLimit) {
    violations.push(`'~었었다' 오남용 ${hadEottaCount}회`);
  }

  // 위반 ②: 연속 같은 어미 (말투별 한도)
  const limit = speechTone === 'friendly' ? friendlyConsecutiveLimit : formalConsecutiveLimit;
  const sentences = narrative
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 4);

  for (let i = 0; i <= sentences.length - limit; i++) {
    const endings = Array.from({ length: limit }, (_, k) => {
      const s = sentences[i + k].replace(/[.!?…"'\s]+$/, '');
      return s.slice(-3);
    });
    if (endings[0].length > 1 && endings.every(e => e === endings[0])) {
      violations.push(`어미 ${limit}회 연속: '${endings[0]}'`);
      i += limit - 1; // 겹침 방지
    }
  }

  if (violations.length >= violationRetryThreshold) {
    return { valid: false, reason: violations.join(' / ') };
  }
  if (violations.length > 0) {
    logger.warn(`[QC-ending] 어미 경고 (${violations.join(' / ')}) → 로그만`);
  }
  return { valid: true };
}

// Step 8: 한국어 자연스러움 검증 (경고 로그만, 재시도 없음)
function warnKoreanNaturalness(text, tag = '') {
  if (!text) return;
  // '~의' 연속 과용: 짧은 범위 내 3회 이상
  if (/의[^.!?…\n]{0,18}의[^.!?…\n]{0,18}의/.test(text)) {
    logger.warn(`[KO-QC${tag}] '~의' 연속 과용 감지`);
  }
  // 이중 피동: 되어지/아지다 계열
  if (/되어지|되어졌|아지다|어지다/.test(text)) {
    logger.warn(`[KO-QC${tag}] 이중 피동 패턴 감지`);
  }
}

// Step 9: 직유법 빈도 검증
// - windowSize자당 maxPerWindow회 초과 시 로그/재시도
// - 초과 logOverMin 이상 → warn 로그, retryOverMin 이상 → { valid: false }
function checkSimileFrequency(text) {
  if (!text || text.length < QC_THRESHOLDS.simile.windowSize / 10) return { valid: true };

  const { windowSize, maxPerWindow, logOverMin, retryOverMin } = QC_THRESHOLDS.simile;

  const simileCount = (text.match(/듯[이나도]?(?=\s|[.,!?…]|$)|듯했|듯한|듯하|처럼|같[은이아](?=\s|[.,!?…]|$)|같았|같더|것\s*같|마치\s/g) || []).length;
  const normalizedCount = Math.round((simileCount / text.length) * windowSize);
  const overCount = Math.max(0, normalizedCount - maxPerWindow);

  if (overCount >= retryOverMin) {
    return { valid: false, reason: `직유법 과다 (약 ${normalizedCount}회/${windowSize}자, ${overCount}회 초과)` };
  }
  if (overCount >= logOverMin) {
    logger.warn(`[QC-simile] 직유법 다소 과다 약 ${normalizedCount}회/${windowSize}자 (${overCount}회 초과) → 로그만`);
  }
  return { valid: true };
}

// Step 10: 표현 레벨 반복 검출
// - minPhraseLen~maxPhraseLen 글자 구간 중 한글 minKorChars자 이상 포함된 구간이
//   repeatThreshold회 이상 반복되면 위반 (하위 문자열 포함 관계는 긴 것으로 대표)
function checkExpressionRepeat(text, overrideThreshold = null) {
  if (!text || text.length < QC_THRESHOLDS.expressionRepeat.minTextLen) return { valid: true };

  const { minPhraseLen, maxPhraseLen, minKorChars } = QC_THRESHOLDS.expressionRepeat;
  const repeatThreshold = overrideThreshold !== null ? overrideThreshold : QC_THRESHOLDS.expressionRepeat.repeatThreshold;
  const puncEdge = /^[\s\n.,!?…"'『』「」()[\]]+|[\s\n.,!?…"'『』「」()[\]]+$/;

  const phraseCounts = new Map();
  for (let len = minPhraseLen; len <= maxPhraseLen; len++) {
    for (let i = 0; i <= text.length - len; i++) {
      const phrase = text.slice(i, i + len);
      if ((phrase.match(/[가-힣]/g) || []).length < minKorChars) continue;
      if (puncEdge.test(phrase)) continue;
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }
  }

  // 반복 횟수 초과 구간 추출, 긴 것 우선 — 하위 포함 관계 제거
  const candidates = [...phraseCounts.entries()]
    .filter(([, c]) => c >= repeatThreshold)
    .sort((a, b) => b[0].length - a[0].length || b[1] - a[1]);

  const result = [];
  for (const [phrase, count] of candidates) {
    if (!result.some(([p]) => p.includes(phrase))) {
      result.push([phrase, count]);
    }
  }

  if (result.length > 0) {
    const examples = result.slice(0, 3).map(([p, c]) => `'${p}'(${c}회)`).join(', ');
    return { valid: false, reason: `표현 반복: ${examples}` };
  }

  // '쿵' 표현은 replaceKungExpressions 후처리로 전환 — 여기서는 검사하지 않음

  return { valid: true };
}

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
  temperature,
  isNovel,
  title,
  stepMeta = null,
  maxTokens = null,
  language = "ko",
  speechTone = null
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
    title,
    stepMeta,
    speechTone
  });

  let currentTemp = temperature;
  let lastContent = "";

  for (let attempt = 0; attempt < MAX_LANGUAGE_RETRIES; attempt++) {
    const result = await callGemini(systemPrompt, userPrompt, currentTemp, isNovel, 0, maxTokens);
    lastContent = (result.content || "").trim();

    // 빈 응답 재시도 (1회)
    if (!lastContent && attempt < MAX_LANGUAGE_RETRIES - 1) {
      logger.warn(`[generateStep] 빈 응답, 재시도 ${attempt + 1}/${MAX_LANGUAGE_RETRIES}`);
      currentTemp = Math.max(MIN_TEMPERATURE, currentTemp - TEMPERATURE_DECREMENT);
      continue;
    }

    const validation = validateOutput(lastContent, language);
    if (validation.valid) {
      const cleaned = stripMetaTags(lastContent);
      if (isNovel) {
        // 소설 전용 QC (어미·직유·표현반복) → 로그만, 재시도 없음 (후처리에서 처리)
        const endingCheck = checkEndingDiversity(cleaned, speechTone);
        const simileCheck = checkSimileFrequency(cleaned);
        const exprCheck   = checkExpressionRepeat(cleaned);
        const qcWarnings = [endingCheck.reason, simileCheck.reason, exprCheck.reason].filter(Boolean);
        if (qcWarnings.length > 0) {
          logger.warn(`[generateStep] QC 경고 (재시도 없음): ${qcWarnings.join(' | ')}`);
        }
      }
      warnKoreanNaturalness(cleaned, `[${currentStep?.name || ''}]`);
      return trimToLastSentence(cleaned);
    }

    logger.warn(`[generateStep] 언어 오염 감지 (${validation.reason}), 재시도 ${attempt + 1}/${MAX_LANGUAGE_RETRIES} (temp: ${currentTemp} → ${Math.max(MIN_TEMPERATURE, currentTemp - TEMPERATURE_DECREMENT)})`);
    currentTemp = Math.max(MIN_TEMPERATURE, currentTemp - TEMPERATURE_DECREMENT);
  }

  logger.warn(`[generateStep] ${MAX_LANGUAGE_RETRIES}회 재시도 후에도 언어 오염. 마지막 출력 반환`);
  return trimToLastSentence(stripMetaTags(lastContent));
}

// 책 생성 함수
exports.generateBookAI = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 900
  },
  async (request) => {
    let progressRef = null;
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
      }

      if (!GEMINI_API_KEY) {
        throw new HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");
      }

      const { category, subCategory, genre, keywords, isSeries, previousContext, endingStyle, title, selectedTone, selectedMood, selectedPOV, selectedSpeechTone, selectedDialogueRatio, appId, essayNarrator, essayAngle, selfHelpAudience, humanitiesStartingPoint } = request.data;

      const uid = request.auth.uid;
      progressRef = (appId && uid)
        ? adminDb.doc(`artifacts/${appId}/users/${uid}/generationProgress/current`)
        : null;

      // 소설류 여부 확인
      const isNovel = category === "webnovel" || category === "novel" || category === "series";
      const temperature = isNovel ? getNovelTemperature(category, subCategory, genre) : 0.5;

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
        selectedDialogueRatio,
        essayNarrator: essayNarrator || null,
        essayAngle: essayAngle || null,
        selfHelpAudience: selfHelpAudience || null,
        humanitiesStartingPoint: humanitiesStartingPoint || null
      });

      // 단계 정의 (시리즈 1화는 훅으로 끝나게, 단편/비시리즈는 5단계)
      const steps = isNovel
        ? (isSeries
          ? [
            { name: "시작",     instruction: "주인공과 배경을 매력적으로 묘사하세요. 독자가 이야기 세계에 빠져들 수 있도록 오감을 동원해 생생하게 그려내세요. 주인공의 일상, 성격, 주변 인물을 자연스럽게 보여주세요.", maxTokens: 6000, targetChars: 2000, accumulatedAfter: 2000, totalChars: 5000, role: "세계와 주인공 소개. 사건은 아직 발생하지 않음. 독자가 세계에 발을 딛는 단계.", nextStepName: "사건과 훅" },
            { name: "사건과 훅", instruction: "평온하던 일상을 깨뜨리는 '사건(Inciting Incident)'을 발생시키세요. 주인공에게 모험이나 문제가 다가오는 장면을 보여주세요. [중요] 사건을 해결하지 말고, 주인공이 모험을 떠나거나 문제에 직면하는 순간에서 멈추세요. 마지막 문장은 다음 화가 궁금해서 미치게 만드는 절단신공으로 끝내세요.", maxTokens: 8192, targetChars: 3000, accumulatedAfter: 5000, totalChars: 5000, role: "갈등 발화. 절단신공으로 마무리. 해결하지 말 것.", nextStepName: null }
          ]
          : [
            { name: "발단", instruction: "스토리의 시작. 배경과 분위기를 감각적으로 묘사하고, 주인공을 자연스럽게 등장시키세요. 독자가 이 세계에 발을 딛는 느낌을 주세요.", maxTokens: 2000, targetChars: 600,  accumulatedAfter: 600,  totalChars: 6000, role: "배경·분위기 설정, 주인공 등장. 사건은 아직 시작 안 함.", nextStepName: "전개" },
            { name: "전개", instruction: "사건을 본격적으로 전개하고 갈등의 씨앗을 심으세요. 인물 간 관계와 긴장감을 구축하세요. 독자가 '이 다음엔 어떻게 되지?'라고 궁금해하게 만드세요.", maxTokens: 3000, targetChars: 1200, accumulatedAfter: 1800, totalChars: 6000, role: "갈등 씨앗만 심을 것. 폭발은 다음 단계에 양보.", nextStepName: "위기" },
            { name: "위기", instruction: "갈등을 심화시키고 긴장감을 최대로 높이세요. 주인공의 내면 갈등과 외부 압박을 동시에 보여주세요. 독자가 손에 땀을 쥐게 하세요.", maxTokens: 3500, targetChars: 1500, accumulatedAfter: 3300, totalChars: 6000, role: "갈등 심화. 절정 직전까지 끌어올리되 결정적 폭발은 절정에 양보.", nextStepName: "절정" },
            { name: "절정", instruction: "갈등을 최고조로 끌어올리고 결정적 전환점을 만드세요. 가장 핵심적이고 감동적인 장면입니다. 행동, 대화, 감정을 모두 쏟아부으세요.", maxTokens: 4000, targetChars: 1800, accumulatedAfter: 5100, totalChars: 6000, role: "결정적 전환점. 가장 길고 가장 중요한 단계. 모든 걸 쏟아부을 것.", nextStepName: "결말" },
            { name: "결말", instruction: "갈등을 해소하고 여운을 남기세요. 서두르지 말고, 인물의 변화와 감정의 착지를 충분히 보여주세요. 독자가 책을 덮은 뒤에도 생각나는 마지막을 만드세요.", maxTokens: 6000, targetChars: 1500, accumulatedAfter: 6600, totalChars: 6600, role: "갈등 해소 착지. 새 사건 도입 금지. 여운 남는 마지막 문장.", nextStepName: null }
          ])
        : [
          { name: "서론",  instruction: "독자의 호기심을 자극하는 질문이나 장면으로 시작하세요. 주제를 자연스럽게 끌어내되, '이 글은 ~에 대한 것입니다' 같은 직접 선언은 피하세요.", maxTokens: 2400, targetChars: 800,  accumulatedAfter: 800,  totalChars: 3500, role: "독자 호기심 유발. 주제 자연스럽게 도입.", nextStepName: "본론 1" },
          { name: "본론 1", instruction: "주제에 대한 깊이 있는 통찰을 구체적 사례·경험·비유와 함께 전개하세요. 추상적 설명 대신 독자가 눈앞에 그릴 수 있는 장면을 제시하세요.", maxTokens: 2700, targetChars: 900,  accumulatedAfter: 1700, totalChars: 3500, role: "핵심 통찰 + 구체적 사례. 추상 설명 금지.", nextStepName: "본론 2" },
          { name: "본론 2", instruction: "새로운 관점, 반전된 시각, 또는 구체적 해결책을 제시하세요. 본론 1과 다른 각도에서 주제를 조명하되, 논리적으로 연결되게 하세요.", maxTokens: 3200, targetChars: 1050, accumulatedAfter: 2750, totalChars: 3500, role: "새 관점 또는 해결책. 본론 1과 다른 각도.", nextStepName: "결론" },
          { name: "결론",  instruction: "핵심 메시지를 독자의 가슴에 남기세요. '결론적으로' 같은 형식적 표현 없이, 여운이 남는 문장으로 자연스럽게 마무리하세요.", maxTokens: 2100, targetChars: 700,  accumulatedAfter: 3450, totalChars: 3500, role: "핵심 메시지 착지. 형식적 결론 표현 금지.", nextStepName: null }
        ];

      if (progressRef) {
        progressRef.set({ status: "preparing", stepName: null, stepIndex: 0, totalSteps: 0, updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      }

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
            title: requestedTitle,
            stepMeta: step.targetChars ? {
              targetChars: step.targetChars,
              accumulatedChars: (step.accumulatedAfter || 0) - (step.targetChars || 0),
              totalChars: step.totalChars || 6600,
              nextStepName: step.nextStepName || null,
              role: step.role || null
            } : null,
            maxTokens: step.maxTokens || null,
            speechTone: selectedSpeechTone || null
          });

          if (!stepContent || !stepContent.trim()) {
            throw new Error("빈 응답이 반환되었습니다.");
          }

          if (progressRef) {
            progressRef.set({ status: "writing", stepName: step.name, stepIndex: i + 1, totalSteps: steps.length, updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
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

      if (isNovel) {
        // 소설 전용 전체 후처리
        fullContent = detectAndFixRepetition(fullContent.trim());
        fullContent = replaceKungExpressions(fullContent);

        const fullSimileCheck = checkSimileFrequency(fullContent);
        if (!fullSimileCheck.valid) {
          logger.warn(`[generateBookAI] 전체 직유법 과다 — 재생성 불가, 로그만 기록 (${fullSimileCheck.reason})`);
        }

        const fullExprCheck = checkExpressionRepeat(fullContent);
        if (!fullExprCheck.valid) {
          logger.warn(`[generateBookAI] 전체 표현 반복 과다 — 재생성 불가, 로그만 기록 (${fullExprCheck.reason})`);
        }
      } else {
        fullContent = fullContent.trim();
        // 에세이 전용 표현 반복 경고 (threshold=2 — 소설보다 엄격)
        const essayExprCheck = checkExpressionRepeat(fullContent, 2);
        if (!essayExprCheck.valid) {
          logger.warn(`[generateBookAI] 에세이 표현 반복 감지 — 로그만 기록 (${essayExprCheck.reason})`);
        }
      }

      // 제목 결정: 사용자 입력 > AI 생성 > 키워드 기반 fallback
      const finalTitle = requestedTitle || staticContext.title || `${keywords || "작품"} - ${genre || category}`;

      // 요약 생성
      const summary = fullContent.substring(0, 200) + "...";

      return {
        title: finalTitle,
        content: fullContent,
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
    } finally {
      if (progressRef) progressRef.delete().catch(() => {});
    }
  }
);

// 시리즈 이어쓰기 함수
exports.generateSeriesEpisode = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 900
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
        endingStyle,
        recentCliffhangerTypes,
        episodeNum
      } = request.data;

      if (!seriesId || !continuationType) {
        throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
      }

      const isNovel = true;
      const temperature = getNovelTemperature(category, subCategory, genre);
      const isFinalize = continuationType === 'finalize';

      // Cliffhanger 유형 자동 선택 (이어쓰기 화에만 적용)
      const chosenCliffhangerType = (!isFinalize)
        ? selectCliffhangerType(recentCliffhangerTypes || [], genre || '')
        : null;

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
        selectedDialogueRatio: selectedDialogueRatio || null,
        selectedCliffhangerType: chosenCliffhangerType
      });

      const topic = `${keywords || ""} ${genre || ""}`.trim();
      const requestedTitle = (title || "").toString().trim();

      const lastParagraph = extractLastSentences(lastEpisodeContent || "", 10);
      // 장기 연재 시 누적 요약이 너무 길면 압축
      const previousStorySummary = await compressCumulativeSummary(cumulativeSummary || "", systemPrompt, true);
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
        temperature,
        isNovel: true,
        title: requestedTitle,
        speechTone: selectedSpeechTone || null
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
        isFinale: isFinalize,
        cliffhangerType: chosenCliffhangerType
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
  drawing_paper:{ price: 50, name: '도화지' },
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
    timeoutSeconds: 900
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

// ─── AI 평론가: 책 짧은 평론 생성 (잉크 2개 소비) ────────────────────────────
const REVIEWER_CHARACTERS = [
  { id: 'critic',    name: '까칠한 평론가',  emoji: '😤', personality: '냉정하고 직설적이며, 작품의 단점을 날카롭게 짚어낸다. 칭찬할 때도 인색하다.' },
  { id: 'emotional', name: '감성 평론가',    emoji: '🥺', personality: '감정에 충실하고 여운을 중시한다. 작품의 분위기와 감정선을 풍부하게 표현한다.' },
  { id: 'mz',        name: 'MZ 평론가',      emoji: '🤓', personality: '트렌디하고 유머러스하며, 신조어와 밈을 자유롭게 사용한다. 솔직하고 가볍다.' },
  { id: 'literary',  name: '문학 평론가',    emoji: '📖', personality: '정통 문학 평론의 시각으로 서사 구조와 문체를 분석한다. 격조 있는 어휘를 쓴다.' },
  { id: 'reader',    name: '평범한 독자',    emoji: '👤', personality: '꾸밈없이 솔직한 일반 독자의 시각이다. 일상적인 언어로 감상을 표현한다.' },
];

const REVIEW_TONES = [
  { id: 'positive',  label: '긍정',   guide: '작품의 매력과 장점을 강조하며 호평한다.', minRating: 4, maxRating: 5 },
  { id: 'negative',  label: '부정',   guide: '작품의 약점과 아쉬운 점을 지적하며 혹평한다.', minRating: 1, maxRating: 2 },
  { id: 'neutral',   label: '중립',   guide: '장단점을 균형 있게 짚으며 객관적으로 평가한다.', minRating: 3, maxRating: 3 },
  { id: 'humor',     label: '유머',   guide: '재치 있고 위트 넘치는 톤으로 가볍게 평한다.', minRating: 2, maxRating: 4 },
  { id: 'emotional', label: '감성',   guide: '감정과 여운을 중심으로 서정적으로 평한다.', minRating: 3, maxRating: 5 },
];

exports.generateBookReview = onCall(
  {
    region: REGION,
    maxInstances: 10,
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { bookId, appId } = request.data;
    if (!bookId || !appId) {
      throw new HttpsError("invalid-argument", "bookId와 appId가 필요합니다.");
    }

    const userId = request.auth.uid;
    const INK_COST = 2;

    // 1. 잉크 차감 (트랜잭션)
    const profileRef = adminDb.collection("artifacts").doc(appId)
      .collection("users").doc(userId)
      .collection("profile").doc("info");

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(profileRef);
      if (!snap.exists) throw new HttpsError("not-found", "프로필을 찾을 수 없습니다.");
      const currentInk = snap.data().ink || 0;
      if (currentInk < INK_COST) {
        throw new HttpsError("failed-precondition", `잉크가 부족합니다. (${INK_COST}개 필요)`);
      }
      tx.update(profileRef, { ink: currentInk - INK_COST });
    });

    // 2. 책 정보 조회
    const bookRef = adminDb.collection("artifacts").doc(appId).collection("books").doc(bookId);
    const bookSnap = await bookRef.get();
    if (!bookSnap.exists) {
      // 잉크 환불
      await profileRef.update({ ink: admin.firestore.FieldValue.increment(INK_COST) });
      throw new HttpsError("not-found", "책을 찾을 수 없습니다.");
    }
    const book = bookSnap.data();
    const bookContent = (book.content || (book.episodes?.map(e => e.content).join("\n\n")) || "").slice(0, 4000);
    const bookTitle = book.title || "제목 없음";
    const bookGenre = book.genre || book.subCategory || "";

    // 3. 캐릭터 + 톤 랜덤 선택
    const character = REVIEWER_CHARACTERS[Math.floor(Math.random() * REVIEWER_CHARACTERS.length)];
    const tone = REVIEW_TONES[Math.floor(Math.random() * REVIEW_TONES.length)];
    const rating = tone.minRating === tone.maxRating
      ? tone.minRating
      : Math.floor(Math.random() * (tone.maxRating - tone.minRating + 1)) + tone.minRating;

    // 4. Gemini 프롬프트
    const systemInstruction = [
      `당신은 "${character.name}"라는 캐릭터다.`,
      `성격: ${character.personality}`,
      "지금 한 권의 책을 읽고 짧은 평론을 남기려 한다.",
      `[톤 지침] ${tone.guide}`,
      "[분량] 공백 포함 100~200자로, 댓글처럼 짧고 임팩트 있게 작성하라.",
      "[형식] 마크다운, 별표, 헤더 없이 평론 본문만 출력하라.",
      "[언어] 반드시 한국어만 사용하라.",
      "[금지] '★', '⭐' 별점 표시를 본문에 넣지 마라. (별점은 별도로 표시됨)",
      "[금지] '저는', '제가' 같은 인사말 없이 바로 평론으로 시작하라.",
    ].join(" ");

    const prompt = [
      `[책 제목] ${bookTitle}`,
      bookGenre ? `[장르] ${bookGenre}` : "",
      "",
      "[책 내용 일부]",
      bookContent,
      "",
      `위 책에 대한 ${character.name}의 짧은 평론을 작성하라.`,
    ].filter(Boolean).join("\n");

    // 5. Gemini 호출
    let reviewText = null;
    try {
      const result = await callGemini(systemInstruction, prompt, 0.85, true);
      reviewText = stripMetaTags((result.content || "").trim());
    } catch (err) {
      logger.error("[generateBookReview] Gemini 오류:", err.message);
      // 실패 시 잉크 환불
      await profileRef.update({ ink: admin.firestore.FieldValue.increment(INK_COST) });
      throw new HttpsError("internal", "AI 평론 생성에 실패했습니다. 잉크가 환불되었습니다.");
    }

    if (!reviewText || reviewText.length < 20) {
      await profileRef.update({ ink: admin.firestore.FieldValue.increment(INK_COST) });
      throw new HttpsError("internal", "AI 평론이 정상적으로 생성되지 않았습니다.");
    }

    // 6. Firestore 저장
    const reviewData = {
      bookId,
      reviewerCharacterId: character.id,
      reviewerName: character.name,
      reviewerEmoji: character.emoji,
      tone: tone.id,
      toneLabel: tone.label,
      rating,
      content: reviewText,
      triggeredBy: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const reviewRef = await adminDb.collection("artifacts").doc(appId)
      .collection("public").doc("data")
      .collection("book_reviews").add(reviewData);

    logger.info(`[generateBookReview] 생성 완료: ${character.name} (${tone.id}/${rating}★)`);

    return {
      id: reviewRef.id,
      ...reviewData,
      createdAt: new Date().toISOString(),
    };
  }
);

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

    // 익명 책은 팔로워에게 알림 보내지 않음 (익명성 보호)
    if (isAnonymous) {
      logger.info(`[NewBook] 익명 책 "${title}" — 팔로워 알림 생략`);
      return;
    }

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

// ─── 트리거 4: 책 좋아요 → 작가 challenge_likes 증가 ─────────────────────────
exports.onBookLiked = onDocumentCreated(
  {
    document: "artifacts/{appId}/public/data/book_likes/{likeId}",
    region: REGION,
  },
  async (event) => {
    const like = event.data?.data();
    if (!like?.bookId) return;

    const appId = event.params.appId;
    const CHALLENGE_START = "2026_04";
    const now = new Date();
    const challengeMonthKey = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (challengeMonthKey < CHALLENGE_START) return;

    try {
      // 책 정보 조회
      const bookRef = adminDb.collection("artifacts").doc(appId).collection("books").doc(like.bookId);
      const bookSnap = await bookRef.get();
      if (!bookSnap.exists) return;
      const book = bookSnap.data();
      const authorId = book.authorId;
      if (!authorId) return;

      // 본인 책 좋아요는 카운트 안 함
      const likeDocId = event.params.likeId;
      const likerUid = likeDocId.split("_")[1]; // 보통 bookId_userId 형식
      if (likerUid === authorId) return;

      // 작가 프로필 업데이트
      const profileRef = adminDb.collection("artifacts").doc(appId)
        .collection("users").doc(authorId)
        .collection("profile").doc("info");
      const profileSnap = await profileRef.get();
      if (!profileSnap.exists) return;
      const profile = profileSnap.data();

      if (profile.challenge_month === challengeMonthKey) {
        await profileRef.update({
          challenge_likes: (profile.challenge_likes || 0) + 1,
        });
      } else {
        // 월이 바뀌면 모든 챌린지 리셋
        await profileRef.update({
          challenge_month: challengeMonthKey,
          challenge_reads: 0,
          challenge_writes: 0,
          challenge_likes: 1,
          challenge_attendance: 0,
          challenge_claimed_map: {},
          challenge_claimed: false,
        });
      }
      logger.info(`[onBookLiked] ${authorId} challenge_likes +1`);
    } catch (err) {
      logger.error("[onBookLiked] 오류:", err);
    }
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

    // 익명 시리즈는 작가명을 노출하지 않는다 (익명이면 프로필 조회 자체를 생략)
    const bookDoc = await adminDb
      .collection("artifacts").doc(APP_ID)
      .collection("books").doc(bookId)
      .get();
    const isAnon = bookDoc.exists && bookDoc.data()?.isAnonymous === true;

    let authorName = "익명";
    if (!isAnon) {
      const profileDoc = await adminDb
        .collection("artifacts").doc(APP_ID)
        .collection("users").doc(callerUid)
        .collection("profile").doc("info")
        .get();
      authorName = profileDoc.exists ? (profileDoc.data()?.nickname || "작가") : "작가";
    }

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

// ── 기존 익명책 마이그레이션 (관리자 1회 실행) ──────────────────────
// 공개(world-readable) books 문서에서 실제 uid(authorId, episodes[].writer)를 제거하고,
// 소유권은 본인만 읽는 비공개 경로 users/{uid}/my_anonymous_books/{bookId} 로 옮긴다.
// 멱등(idempotent): authorId가 이미 null인 책은 건너뛴다.
exports.migrateAnonymousBooks = onCall(
  { region: REGION, maxInstances: 1, timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const email = request.auth.token?.email || "";
    const isAdmin = email === "admin@odok.app" || email.includes("banlan21");
    if (!isAdmin) throw new HttpsError("permission-denied", "관리자만 실행할 수 있습니다.");

    const booksRef = adminDb
      .collection("artifacts").doc(APP_ID)
      .collection("books");
    const snap = await booksRef.where("isAnonymous", "==", true).get();

    let scrubbed = 0, mapped = 0, skipped = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const realUid = data.authorId;
      if (!realUid) { skipped++; continue; } // 이미 정리됨

      // 1) 소유권을 비공개 경로에 기록 (보관함 유지)
      await adminDb
        .collection("artifacts").doc(APP_ID)
        .collection("users").doc(realUid)
        .collection("my_anonymous_books").doc(docSnap.id)
        .set({
          bookId: docSnap.id,
          createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          migrated: true,
        }, { merge: true });
      mapped++;

      // 2) 공개 문서에서 실제 uid 제거 (authorId + episodes[].writer)
      const update = { authorId: null };
      if (Array.isArray(data.episodes)) {
        update.episodes = data.episodes.map((ep) => ({ ...ep, writer: null }));
      }
      await docSnap.ref.update(update);
      scrubbed++;
    }

    logger.info(`[migrateAnonymousBooks] total=${snap.size} scrubbed=${scrubbed} mapped=${mapped} skipped=${skipped}`);
    return { total: snap.size, scrubbed, mapped, skipped };
  }
);

// ── 동화공방: 아이가 주인공인 동화 생성 (연령별 다단계 + 진행표시) ──────
// 안전: callGemini 기본 BLOCK_ONLY_HIGH 사용. 소설 QC 미적용(isNovel=false).
//       언어오염 검증(validateOutput) + 메타태그 제거(stripMetaTags)만 적용.
const FAIRY_STEPS = {
  // 유아(3~5세): 800~1,200자, 도입→사건→해결 (3단계)
  toddler: [
    { name: "도입", instruction: "주인공 ${name}을(를) 따뜻하고 사랑스럽게 소개하세요. 어디서 무엇을 하며 지내는지 짧은 문장으로 그려주세요. 의성어·의태어를 넣어 소리내어 읽기 즐겁게.", targetChars: 280, maxTokens: 900 },
    { name: "사건", instruction: "${name}에게 작고 귀여운 사건이 생깁니다(예: 무언가를 잃어버리거나, 새 친구를 만나거나). 아주 약한 갈등이면 충분합니다. 반복되는 리듬으로 아이가 다음을 예측하게 하세요.", targetChars: 400, maxTokens: 1100 },
    { name: "따뜻한 해결", instruction: "${name}이(가) 사건을 따뜻하게 해결하고 포근하게 마무리합니다. 마지막에 아주 단순하고 명확한 교훈 한 줄을 남기세요. 잠들기 전에 읽어도 안심되는 결말로.", targetChars: 400, maxTokens: 1100 },
  ],
  // 저학년(6~8세): 1,500~2,500자, 도입→문제→시도→해결 (4단계)
  lower: [
    { name: "도입", instruction: "주인공 ${name}과(와) 배경을 생생하게 소개하세요. ${name}이(가) 어떤 아이이고 무엇을 좋아하는지 보여주세요.", targetChars: 420, maxTokens: 1200 },
    { name: "문제 발생", instruction: "${name}에게 해결하고 싶은 문제나 도전이 생깁니다. 인과관계가 분명한 문장('~해서 ~했어요')으로 상황을 전개하세요.", targetChars: 560, maxTokens: 1500 },
    { name: "시도", instruction: "${name}이(가) 문제를 해결하려 여러 번 노력합니다. 친구의 도움이나 작은 모험, 약간의 놀라움을 넣어도 좋아요.", targetChars: 560, maxTokens: 1500 },
    { name: "해결", instruction: "${name}이(가) 마침내 문제를 해결하고 한 뼘 성장합니다. 따뜻하고 포근하게 마무리하고 자연스러운 교훈을 남기세요.", targetChars: 520, maxTokens: 1400 },
  ],
};

function buildFairySystemPrompt({ age, gender, theme, setting, wantQuestions, name }) {
  const ageGuide = age === "lower"
    ? "대상은 초등 저학년(6~8세)입니다. 인과관계가 분명한 문장('~해서 ~했어요')을 쓰고, 단순한 갈등과 해결 구조, 모험·우정 같은 테마, 약간의 놀라움이나 반전을 넣어도 좋습니다."
    : "대상은 유아(3~5세)입니다. 한 문장은 아주 짧게, 한 장면에 한두 문장만 씁니다. 의성어·의태어(폴짝폴짝, 데굴데굴, 살금살금)를 풍부하게 써서 소리내어 읽을 때 재미있게. 갈등은 아주 약하게(잃어버린 인형 찾기 수준), 반복되는 리듬으로 아이가 다음을 예측하며 참여하게. 교훈은 단순하고 명확하게.";
  const genderGuide = gender === "boy"
    ? `${name}은(는) 남자아이입니다.`
    : gender === "girl"
      ? `${name}은(는) 여자아이입니다.`
      : `${name}의 성별은 드러내지 말고, '소년/소녀' 같은 표현 대신 이름 위주로 중립적으로 서술하세요.`;
  const themeGuide = theme
    ? `이 동화의 교훈·테마는 "${theme}"입니다. 설교하듯 말하지 말고 이야기 속에 자연스럽게 녹여내세요.`
    : "특정 교훈을 강요하지 말고, 따뜻하고 포근한 일상 이야기로 만드세요.";
  const settingGuide = setting
    ? `이야기의 배경(무대)은 "${setting}"입니다. 그 배경의 분위기와 특징을 살려 생생하게 그려주세요.`
    : "배경(무대)은 이야기에 가장 잘 어울리도록 자유롭게 정하세요.";
  const questionGuide = wantQuestions
    ? `이야기의 장면 전환 지점에 아이에게 묻는 질문을 전체에서 2~3회만 자연스럽게 넣으세요(예: "${name}는 어떻게 했을까요?", "다음엔 무슨 일이 일어날까요?"). 너무 자주 넣어 몰입을 깨지 마세요.`
    : "독자에게 묻는 질문은 넣지 말고, 매끄럽게 흐르는 이야기로 만드세요.";
  return [
    "당신은 부모가 아이에게 읽어주는 한국어 동화를 쓰는 따뜻한 동화 작가입니다.",
    ageGuide,
    genderGuide,
    themeGuide,
    settingGuide,
    questionGuide,
    "공통 규칙: 소리내어 읽기 좋은 리듬과 운율을 살립니다. 너무 긴 문장은 금지(읽어주다 숨차지 않게). 무섭거나 자극적인 내용은 금지(잠들기 전에도 안전하게). 안심되는 따뜻하고 포근한 결말로 끝냅니다.",
    `주인공의 이름은 "${name}"이며, 이야기 내내 이 이름을 자연스럽게 사용합니다.`,
    "한글, 공백, 기본 문장부호만 사용하고 다른 언어(한자·영어·일본어 등)는 쓰지 마세요.",
    "장면 제목·단계 이름·별표·머리표는 출력하지 말고 동화 본문만 쓰세요.",
  ].join("\n");
}

function buildFairyStepPrompt({ name, step, storySoFar, isLast }) {
  const inst = step.instruction.replace(/\$\{name\}/g, name);
  return [
    storySoFar ? `[지금까지의 이야기]\n${storySoFar}\n` : "",
    `이번 장면을 이어서 쓰세요.`,
    inst,
    `분량: 한국어 약 ${step.targetChars}자.`,
    isLast ? "이 장면에서 이야기를 따뜻하게 완결하세요." : "다음 장면으로 자연스럽게 이어지도록 쓰세요.",
    "장면 제목 없이 본문만 출력하세요.",
  ].filter(Boolean).join("\n");
}

exports.generateFairytale = onCall(
  { region: REGION, maxInstances: 10, timeoutSeconds: 540 },
  async (request) => {
    let progressRef = null;
    try {
      if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
      if (!GEMINI_API_KEY) throw new HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");

      const { childName, age, gender, theme, setting, interaction, appId } = request.data || {};
      const name = String(childName || "").trim().replace(/[<>]/g, "").slice(0, 12);
      if (!name) throw new HttpsError("invalid-argument", "자녀 이름이 필요합니다.");
      const ageKey = age === "lower" ? "lower" : "toddler";
      const genderKey = gender === "boy" ? "boy" : gender === "girl" ? "girl" : "neutral";
      const cleanTheme = String(theme || "").trim().slice(0, 30);
      const cleanSetting = String(setting || "").trim().slice(0, 40);
      const wantQuestions = interaction === "questions";
      const uid = request.auth.uid;

      progressRef = (appId && uid)
        ? adminDb.doc(`artifacts/${appId}/users/${uid}/generationProgress/current`)
        : null;

      const systemPrompt = buildFairySystemPrompt({ age: ageKey, gender: genderKey, theme: cleanTheme, setting: cleanSetting, wantQuestions, name });
      const steps = FAIRY_STEPS[ageKey];

      if (progressRef) progressRef.set({ status: "preparing", stepName: null, stepIndex: 0, totalSteps: steps.length, updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});

      let storySoFar = "";
      const parts = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (progressRef) progressRef.set({ status: "writing", stepName: step.name, stepIndex: i + 1, totalSteps: steps.length, updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});

        const userPrompt = buildFairyStepPrompt({ name, step, storySoFar, isLast: i === steps.length - 1 });

        // 언어 오염 시 temperature 낮춰 재시도 (메타태그 제거 + 검증). 소설 QC는 적용하지 않음.
        let content = "";
        for (let attempt = 0; attempt < 3; attempt++) {
          const temp = 0.8 - attempt * 0.15;
          const result = await callGemini(systemPrompt, userPrompt, temp, false, 0, step.maxTokens);
          content = stripMetaTags((result.content || "").trim());
          if (content && validateOutput(content, "ko").valid) break;
        }
        content = trimToLastSentence(content);
        if (content) {
          parts.push(content);
          storySoFar = storySoFar ? `${storySoFar}\n\n${content}` : content;
        }
      }

      const fullContent = parts.join("\n\n").trim();
      if (!fullContent) throw new HttpsError("internal", "동화 생성 결과가 비어 있습니다.");

      // 제목 생성 (가벼운 1회, flash). 실패 시 폴백.
      let title = cleanTheme ? `${name}와 ${cleanTheme}` : `${name}의 동화`;
      try {
        const titlePrompt = `다음 동화에 어울리는 한국어 제목을 15자 이내로 하나만 지어줘. 설명·따옴표 없이 제목만.\n\n${fullContent.slice(0, 800)}`;
        const tr = await callGemini("너는 동화 제목을 짓는 작가다. 한글만 사용한다.", titlePrompt, 0.7, false, 2, 100);
        const tt = stripMetaTags((tr.content || "").trim()).split("\n")[0].replace(/^["'“”]|["'“”]$/g, "").trim().slice(0, 20);
        if (tt) title = tt;
      } catch (e) { logger.warn("[Fairytale] 제목 생성 실패, 폴백 사용"); }

      if (progressRef) progressRef.set({ status: "done", updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});

      logger.info(`[Fairytale] "${title}" (${fullContent.length}자, age=${ageKey}, ${steps.length}단계, q=${wantQuestions})`);
      return { title, content: fullContent };
    } catch (err) {
      if (progressRef) progressRef.set({ status: "error", updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      logger.error("[Fairytale] 오류:", err?.message || err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", "동화 생성에 실패했습니다.");
    }
  }
);
