// src/components/WriteView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PenTool, RefreshCw, Book, Edit2, Lock, Droplets, Video, Check, X, ChevronDown } from 'lucide-react';
import { generateBook, generateFairytale } from '../utils/aiService';
import { db } from '../firebase';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { isKeywordRefreshFree, getLevelFromXp } from '../utils/levelUtils';
import { showRewardVideoAd } from '../utils/admobService';
import { BOOK_FONTS } from '../utils/fontOptions';
import OXQuizGame from './OXQuizGame';

// 비문학 키워드 은행
const ESSAY_KEYWORDS = [
  "새벽", "해질녘", "첫눈", "장마", "무더위", "늦가을", "봄바람", "크리스마스", "12월31일", "월요일아침", "주말오후", "한여름밤", "개기일식", "생일", "기념일",
  "편의점", "골목길", "옥상", "지하철", "버스창가", "빈방", "놀이터", "도서관", "목욕탕", "세탁소", "공항", "기차역", "바다", "숲길", "카페구석", "헌책방", "시장", "포장마차", "엘리베이터",
  "어머니", "아버지", "할머니", "첫사랑", "짝사랑", "오랜친구", "직장동료", "반려동물", "길고양이", "이방인", "선생님", "이웃", "나자신", "헤어진연인",
  "오래된사진", "일기장", "라디오", "우산", "자전거", "운동화", "손편지", "향수", "커피", "라면", "소주한잔", "담배", "꽃다발", "선인장", "가로등", "이어폰", "통장", "여권",
  "그리움", "후회", "위로", "권태", "설렘", "불안", "안도감", "고독", "자유", "퇴사", "합격", "이별", "만남", "용기", "거짓말", "비밀", "약속", "기다림", "꿈", "멍때리기",
  "빗소리", "풀내음", "밥냄새", "사이렌소리", "피아노선율", "차가운공기", "따뜻한이불", "매미소리", "낙엽밟는소리"
];

const SELF_HELP_KEYWORDS = [
  "미라클모닝", "새벽기상", "독서", "글쓰기", "운동", "명상", "찬물샤워", "일기쓰기", "확언", "시각화", "정리정돈", "메모", "시간관리", "우선순위", "체크리스트",
  "자존감", "회복탄력성", "그릿(Grit)", "긍정", "감사", "몰입", "끈기", "용기", "성실", "절제", "겸손", "자신감", "책임감", "주도성", "완벽주의버리기",
  "리더십", "팔로워십", "협상", "설득", "스피치", "기획력", "마케팅", "퍼스널브랜딩", "네트워킹", "멘토링", "벤치마킹", "사이드프로젝트", "창업", "승진", "연봉협상",
  "저축", "투자", "주식", "부동산", "소비통제", "가계부", "경제적자유", "파이어족", "부의추월차선", "시드머니", "복리의마법", "자산배분",
  "번아웃", "슬럼프", "실패", "거절", "비판", "스트레스", "불면증", "미루기", "작심삼일", "열등감", "질투", "무기력", "트라우마", "디지털디톡스",
  "미니멀라이프", "워라밸", "노마드", "N잡러", "평생학습", "외국어공부", "자격증", "취미", "다이어트", "건강관리"
];

const PHILOSOPHY_KEYWORDS = [
  "나는누구인가", "자아", "무의식", "욕망", "본능", "이성", "감정", "기억", "망각", "꿈", "육체", "영혼", "죽음", "노화", "탄생", "성장", "천재", "광기",
  "타인", "사랑", "우정", "가족", "공동체", "고독", "소외", "혐오", "차별", "평등", "정의", "법", "권력", "정치", "전쟁", "평화", "자본주의", "노동", "소유",
  "행복", "불행", "자유", "운명", "우연", "필연", "진실", "거짓", "선과악", "도덕", "윤리", "종교", "신", "구원", "믿음", "의심", "희망", "절망",
  "시간", "영원", "순간", "과거", "미래", "현재", "역사", "우주", "자연", "환경", "기술", "AI", "인공지능", "가상현실", "진화", "멸종",
  "아름다움", "추함", "예술", "창조", "파괴", "영감", "모방", "오리지널리티", "취향", "유행", "고전", "낭만", "허무", "부조리", "침묵", "언어"
];

// id 기반 키워드 (영문 번역용)
const toKeywordItems = (arr, prefix) => arr.map((ko, i) => ({ id: `${prefix}_${i}`, ko }));
const NONFICTION_KEYWORD_BANKS = {
  essay: toKeywordItems(ESSAY_KEYWORDS, 'essay'),
  'self-help': toKeywordItems(SELF_HELP_KEYWORDS, 'self'),
  humanities: toKeywordItems(PHILOSOPHY_KEYWORDS, 'hum')
};

const NONFICTION_TONE_OPTIONS = {
  essay: ['담백한/건조한', '감성적인/시적인', '유머러스한/위트있는', '친근한/구어체'],
  'self-help': ['따뜻한 위로/격려', '강한 동기부여/독설', '논리적인/분석적인', '경험담 위주'],
  humanities: ['질문을 던지는/사색적인', '날카로운 비판', '대화 형식/인터뷰', '쉬운 해설/스토리텔링']
};

const ESSAY_NARRATOR_OPTIONS = [
  { value: '고백하는 나', desc: '1인칭, 속마음을 꺼내놓는' },
  { value: '인생 선배', desc: '먼저 살아본 경험 공유' },
  { value: '츤데레 아저씨', desc: '투박하지만 속정 깊은' },
  { value: '또래 친구', desc: '같은 눈높이, 편한 구어체' },
  { value: '관찰자', desc: '거리두기, 판단 절제' },
  { value: '전문가', desc: '지식과 근거, 안내하는 자세' },
];

const ESSAY_ANGLE_OPTIONS = [
  { value: '회고형', desc: '지나간 일을 돌아보며' },
  { value: '분석형', desc: '원인과 구조를 논리적으로' },
  { value: '위로형', desc: '당신만 그런 게 아니다' },
  { value: '질문형', desc: '독자가 스스로 생각하게' },
  { value: '수용형', desc: '있는 그대로 받아들이며' },
  { value: '경고형', desc: '반복하지 말라고 일러주며' },
];

const SELF_HELP_AUDIENCE_OPTIONS = [
  { value: '막 시작하는 사람', desc: '개념부터, 최소한의 첫 발' },
  { value: '이미 시도했지만 실패한 사람', desc: '실패 원인 분석, 재시작 방법' },
  { value: '완전히 지쳐버린 사람', desc: '멈춰도 된다, 회복 중심' },
];

const HUMANITIES_STARTING_POINT_OPTIONS = [
  { value: '일상 장면에서', desc: '공감 가는 장면을 입구로' },
  { value: '개념 정의에서', desc: '용어를 해체하고 재정의' },
  { value: '역사적 사례에서', desc: '과거에서 출발해 현재로' },
  { value: '역설·모순에서', desc: '예상을 뒤집고 다시 생각하게' },
];

const TONE_TO_KEY = {
  '담백한/건조한': 'tone_essay_dry',
  '감성적인/시적인': 'tone_essay_poetic',
  '유머러스한/위트있는': 'tone_essay_witty',
  '친근한/구어체': 'tone_essay_colloquial',
  '따뜻한 위로/격려': 'tone_self_warm',
  '강한 동기부여/독설': 'tone_self_motivation',
  '논리적인/분석적인': 'tone_self_logical',
  '경험담 위주': 'tone_self_experience',
  '질문을 던지는/사색적인': 'tone_humanities_questioning',
  '날카로운 비판': 'tone_humanities_critical',
  '대화 형식/인터뷰': 'tone_humanities_dialogue',
  '쉬운 해설/스토리텔링': 'tone_humanities_storytelling'
};

const DAILY_WRITE_LIMIT = 2;
const DAILY_FREE_WRITES = 1;

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

const MOOD_DESCRIPTIONS = {
  '사이다/먼치킨(압도적 힘)': '주인공이 압도적인 힘으로 적을 제압하는 통쾌한 전개. 읽는 맛이 쏙쏙 느껴집니다.',
  '피폐/느와르(처절함)': '어둡고 처절한 분위기. 하드보일드한 세계관과 절절한 감정선.',
  '코믹/착각계(유쾌함)': '오해와 착각이 만들어내는 유쾌한 상황. 웃음 포인트가 많습니다.',
  '정통/성장형(감동)': '주인공의 성장과 변화를 담은 감동적인 이야기. 여운이 오래 남습니다.',
  '달달/힐링(설렘)': '달달하고 설레는 로맨스. 힐링과 두근거림이 함께합니다.',
  '후회/집착(도파민)': '강렬한 감정과 집착. 중독성 있는 도파민 자극 전개.',
  '혐관/배틀(티키타카)': '라이벌 관계의 티키타카와 반짝이는 대사. 말싸움의 묘미.',
  '사이다/복수(걸크러시)': '주인공이 정의를 실현하는 통쾌한 복수극. 카타르시스 맛.',
  '오컬트/기담(공포)': '초자연적 존재와 기이한 이야기. 오싹한 공포 분위기.',
  '슬래셔/고어(잔혹)': '강렬한 공포와 잔혹한 묘사. 서스펜스가 높습니다.',
  '두뇌전/심리(긴장감)': '심리전과 추리가 주는 긴장감. 다음 장이 궁금해집니다.',
  '서정적/잔잔한': '감성적이고 평화로운 문체. 마음을 정갈하게 다듬어 줍니다.',
  '현실적/사실주의': '일상에 가까운 현실적인 서사. 공감을 이끌어냅니다.',
  '비극적/애절한': '슬픔과 아픔이 담긴 감동적인 스토리. 가슴이 뭉클해집니다.',
  '격정적/파란만장': '극적인 반전과 격렬한 감정선. 손에서 책을 놓기 어렵습니다.',
  '담백한/현실연애': '현실적인 로맨스와 차분한 서술. 우리 옆에서 벌어질 법한 이야기.',
  '클래식/멜로': '전통적인 멜로 드라마. 설렘과 눈물이 어우러집니다.',
  '아련한/첫사랑': '첫사랑의 설레임과 아련함. 향수를 자극합니다.',
  '하드보일드/건조한': '날카롭고 건조한 문체. 숨 막히는 긴장감.',
  '정통 추리/논리적': '논리적 추리와 단서 배치. 추리의 재미를 선사합니다.',
  '철학적/사색적': '깊은 사유와 철학적 질문. 생각이 길어지는 이야기.'
};

// 소설류 장르 (웹소설/소설/시리즈-웹소설형/시리즈-소설형)
const webnovelGenres = [
  { id: 'romance', name: '로맨스' },
  { id: 'romance-fantasy', name: '로맨스 판타지' },
  { id: 'fantasy', name: '판타지' },
  { id: 'modern-fantasy', name: '현대 판타지' },
  { id: 'wuxia', name: '무협' },
  { id: 'mystery-horror', name: '미스터리/공포' },
  { id: 'sf', name: 'SF' }
];

const novelGenres = [
  { id: 'drama', name: '드라마' },
  { id: 'romance', name: '로맨스' },
  { id: 'mystery', name: '미스터리/추리' },
  { id: 'sf', name: 'SF' },
  { id: 'thriller', name: '스릴러' },
  { id: 'history', name: '역사' },
  { id: 'healing', name: '힐링' }
];

const MOOD_TO_NAMEKEY = {
  '사이다/먼치킨(압도적 힘)': 'mood_soda',
  '피폐/느와르(처절함)': 'mood_noir',
  '코믹/착각계(유쾌함)': 'mood_comic',
  '정통/성장형(감동)': 'mood_growth',
  '달달/힐링(설렘)': 'mood_sweet',
  '후회/집착(도파민)': 'mood_regret',
  '혐관/배틀(티키타카)': 'mood_enemies',
  '사이다/복수(걸크러시)': 'mood_revenge',
  '오컬트/기담(공포)': 'mood_occult',
  '슬래셔/고어(잔혹)': 'mood_slasher',
  '두뇌전/심리(긴장감)': 'mood_psychology',
  '서정적/잔잔한': 'mood_lyric',
  '현실적/사실주의': 'mood_realism',
  '비극적/애절한': 'mood_tragic',
  '격정적/파란만장': 'mood_intense',
  '담백한/현실연애': 'mood_down_to_earth',
  '클래식/멜로': 'mood_classic_melo',
  '아련한/첫사랑': 'mood_first_love',
  '하드보일드/건조한': 'mood_hardboiled',
  '정통 추리/논리적': 'mood_mystery',
  '철학적/사색적': 'mood_philosophical'
};

// Guard Rail: map full mood string → short key for matrix lookup
const MOOD_SHORT_KEYS = {
  '사이다/먼치킨(압도적 힘)': '사이다/먼치킨',
  '달달/힐링(설렘)':           '달달/힐링',
  '후회/집착(도파민)':          '후회/집착',
  '오컬트/기담(공포)':          '오컬트/기담',
  '하드보일드/건조한':          '하드보일드',
  '철학적/사색적':              '철학/사색',
  '혐관/배틀(티키타카)':        '혐관/배틀',
  '슬래셔/고어(잔혹)':          '슬래셔/고어',
  '서정적/잔잔한':              '서정적/잔잔한',
  '현실적/사실주의':            '현실적/사실주의',
  '정통 추리/논리적':           '정통 추리/논리적',
};

// Matrix 1: Genre × Mood
const GUARD_RAIL_MOOD_BLOCKED = {
  '로맨스':        ['사이다/먼치킨', '오컬트/기담', '하드보일드'],
  '로맨스 판타지': ['오컬트/기담', '하드보일드'],
  '무협':          ['달달/힐링'],
  '미스터리/공포': ['사이다/먼치킨', '달달/힐링'],
  '드라마':        ['사이다/먼치킨'],
  '힐링':          ['사이다/먼치킨', '후회/집착', '오컬트/기담', '하드보일드'],
  '미스터리/추리': ['사이다/먼치킨', '달달/힐링'],
  '스릴러':        ['달달/힐링'],
};
const GUARD_RAIL_MOOD_CAUTION = {
  '로맨스 판타지': ['철학/사색'],
  '판타지':        ['달달/힐링', '후회/집착', '하드보일드'],
  '현대 판타지':   ['달달/힐링', '후회/집착', '하드보일드', '철학/사색'],
  '무협':          ['오컬트/기담'],
  '미스터리/공포': ['후회/집착'],
  'SF':            ['사이다/먼치킨', '달달/힐링', '후회/집착'],
  '드라마':        ['오컬트/기담'],
  '힐링':          ['철학/사색'],
};

// Matrix 2: Mood × Speech Tone  (friendly=친근체, formal=단정체, polite=정중체)
const GUARD_RAIL_TONE_BLOCKED = {
  '사이다/먼치킨': ['polite'],
  '후회/집착':     ['polite'],
  '혐관/배틀':     ['polite'],
  '슬래셔/고어':   ['friendly', 'polite'],
  '하드보일드':    ['friendly', 'polite'],
};
const GUARD_RAIL_TONE_CAUTION = {
  '달달/힐링':          ['formal', 'polite'],
  '후회/집착':          ['friendly'],
  '혐관/배틀':          ['friendly'],
  '오컬트/기담':        ['friendly', 'polite'],
  '서정적/잔잔한':      ['friendly'],
  '현실적/사실주의':    ['polite'],
  '정통 추리/논리적':   ['friendly'],
  '철학/사색':          ['friendly'],
};

// Matrix 3: Mood × POV  (first_person=1인칭, third_limited=3인칭 관찰자, omniscient=전지적)
const GUARD_RAIL_POV_BLOCKED = {
  '후회/집착':  ['omniscient'],
  '오컬트/기담': ['omniscient'],
  '슬래셔/고어': ['omniscient'],
  '하드보일드':  ['omniscient'],
};
const GUARD_RAIL_POV_CAUTION = {
  '사이다/먼치킨':     ['omniscient'],
  '후회/집착':         ['third_limited'],
  '서정적/잔잔한':     ['third_limited'],
  '철학/사색':         ['third_limited'],
  '정통 추리/논리적':  ['omniscient'],
};

function getMoodGuardRail(genreName, moodFull) {
  const shortKey = MOOD_SHORT_KEYS[moodFull] || moodFull;
  const blocked = GUARD_RAIL_MOOD_BLOCKED[genreName] || [];
  const caution = GUARD_RAIL_MOOD_CAUTION[genreName] || [];
  if (blocked.some(k => shortKey.startsWith(k))) return 'blocked';
  if (caution.some(k => shortKey.startsWith(k))) return 'caution';
  return 'ok';
}

const endingStyleIds = [
  { id: 'closed_happy', value: '닫힌 결말 (해피 엔딩)' },
  { id: 'closed_sad', value: '닫힌 결말 (비극/새드 엔딩)' },
  { id: 'open', value: '열린 결말 (여운을 남김)' },
  { id: 'twist', value: '반전 결말 (충격적인 반전)' },
  { id: 'bookend', value: '수미상관 (처음과 끝이 연결됨)' }
];

// 소설류 추천 키워드
const novelKeywords = [
  "운명적인 만남",
  "이세계 모험",
  "소소한 일상 힐링",
  "오싹한 미스터리",
  "통쾌한 복수극",
  "미래 도시 SF"
];

const GENRE_EXAMPLE_TOPICS = {
  'romance':         ['사랑하는 사람이 기억을 잃고 낯선 사람이 된다', '오해로 헤어진 첫사랑과 10년 만에 재회한다'],
  'romance-fantasy': ['마법 금지령 속 마법사와 기사의 금지된 사랑', '전생의 원수가 이생에서 운명의 상대로 나타난다'],
  'fantasy':         ['신에게 버림받은 세계에서 마지막 영웅의 선택', '마법을 쓸수록 기억을 잃는 소녀가 세계를 구해야 한다'],
  'modern-fantasy':  ['평범한 직장인이 도시 속 숨겨진 이계의 문을 발견', '귀신이 보이는 능력으로 억울한 영혼의 한을 풀어준다'],
  'wuxia':           ['무림 최강 고수가 모든 것을 잃고 다시 일어서는 이야기', '문파를 멸한 원수를 갚기 위해 10년을 와신상담한 제자'],
  'mystery-horror':  ['폐교 의문 실종 사건, 유일한 목격자는 말을 못 한다', '이사한 집에서 매일 밤 같은 시간에 들리는 발소리'],
  'sf':              ['로봇이 모든 일을 대신하는 세상에서 의미를 찾는 인간', '달 기지에서 혼자 깨어난 우주인, 지구와 연락이 끊겼다'],
  'drama':           ['가족 중 한 명의 숨겨진 비밀이 모든 관계를 뒤흔든다', '평생 남을 위해 살아온 사람의 처음으로 자신을 위한 선택'],
  'mystery':         ['매년 같은 날 사라지는 마을 사람들, 숨겨진 패턴이 있다', '죽은 줄 알았던 친구가 5년 후 살인 사건 피의자로 나타난다'],
  'thriller':        ['납치된 딸을 구하기 위해 범죄 세계에 발을 들인 아버지', '자신이 연쇄살인마의 다음 표적임을 알게 된 형사'],
  'history':         ['조선 시대 신분을 넘은 금지된 사랑과 혁명', '전쟁 속 적군의 편지를 전달해야만 하는 전령의 이야기'],
  'healing':         ['번아웃으로 시골에 내려온 작가가 마을과 함께 치유되는 이야기', '유기견 보호소에서 상처 입은 개와 사람이 함께 회복하는 이야기'],
};

// 시리즈 세부 장르 (웹소설형 vs 일반소설형)
const seriesSubTypes = [
  { id: 'webnovel', name: '웹소설형', description: '연재 웹소설 스타일' },
  { id: 'novel', name: '일반소설형', description: '전통 소설 스타일' }
];

// 동화공방 교훈·테마 (선택 입력 — 직접 타이핑하거나 카테고리에서 탭). 자유 입력이라 무엇이든 가능.
const FAIRY_THEME_GROUPS = [
  { cat: '🌱 인성·도덕', items: ['용기', '정직', '나눔', '배려', '감사', '인내', '책임감', '약속 지키기', '양보', '친절', '겸손', '예의', '존중'] },
  { cat: '🪥 생활 습관', items: ['양치질', '정리정돈', '손 씻기', '일찍 자기', '편식 안 하기', '스스로 옷 입기', '장난감 정리', '시간 지키기', '책 읽는 습관'] },
  { cat: '💛 감정·마음', items: ['화 다스리기', '두려움 이겨내기', '슬픔 위로', '질투 다루기', '자신감', '실패해도 괜찮아', '부끄러움 극복'] },
  { cat: '👨‍👩‍👧 관계', items: ['우정', '형제·자매 사랑', '가족 사랑', '친구 사귀기', '함께 놀기', '다름 인정하기', '화해하기', '협동'] },
  { cat: '🚸 안전·건강', items: ['교통안전', '낯선 사람 조심', '위험한 것 조심', '운동·건강', '불조심', '길 잃었을 때'] },
  { cat: '🚀 도전·성장', items: ['도전', '끈기', '새로운 것 시도', '실수에서 배우기', '꿈', '호기심', '노력의 가치', '포기하지 않기'] },
  { cat: '🌍 환경·자연', items: ['환경 보호', '동물 사랑', '자연 아끼기', '분리수거', '물·전기 아끼기', '식물 키우기'] },
  { cat: '✨ 모험·상상', items: ['모험', '상상력', '우주 탐험', '바다 여행', '마법', '시간 여행'] },
];

// 동화공방 배경·무대 (선택 입력 — 자유 입력 + 카테고리). 미선택 시 AI가 이야기에 맞게 자동.
const FAIRY_SETTING_GROUPS = [
  { cat: '🕰️ 시대', items: ['옛날(전래동화풍)', '현대(우리 동네)', '미래(우주 시대)', '공룡 시대'] },
  { cat: '🦊 상상의 나라', items: ['동물의 나라', '로봇의 나라', '요정·마법의 숲', '사탕·과자 나라', '장난감 나라', '인형의 나라', '구름 위 나라', '거인의 나라', '소인국'] },
  { cat: '🌊 자연·탐험', items: ['깊은 바다 속', '우주·별나라', '정글·밀림', '눈 덮인 북극', '사막', '신비한 섬', '무지개 너머'] },
  { cat: '🏡 포근한 일상', items: ['우리 집·방 안', '할머니 댁·시골', '놀이공원', '동물원', '바닷가', '숲속 오두막', '농장'] },
  { cat: '🏰 판타지·마법', items: ['마법 왕국·성', '구름성', '마법 학교', '책 속 세상', '꿈속 나라', '거울 속 나라'] },
  { cat: '🎨 색다른 상상', items: ['계절 나라', '무지개·색깔 나라', '음악 나라', '그림 속 세상', '시간 여행'] },
];

const WriteView = ({ user, userProfile, t, onBookGenerated, slotStatus, setView, setSelectedBook, error, setError, deductInk, addInk, onGeneratingChange, onGenerationComplete, authorProfiles = {}, appId, onSaveFairytale }) => {
  // 메인 카테고리 목록 (6개)
  const categories = [
    { id: 'webnovel', name: t?.cat_webnovel || '웹소설', icon: '📱', isNovel: true, isSingle: true },
    { id: 'novel', name: t?.cat_novel || '소설', icon: '📖', isNovel: true, isSingle: true },
    { id: 'series', name: t?.cat_series || '시리즈', icon: '📚', isNovel: true, isSingle: false },
    { id: 'essay', name: t?.cat_essay || '에세이', icon: '✍️', isNovel: false },
    { id: 'self-help', name: t?.cat_self_help || '자기계발', icon: '🌟', isNovel: false },
    { id: 'humanities', name: t?.cat_humanities || '인문·철학', icon: '💭', isNovel: false }
  ];

  const [activeWriteTab, setActiveWriteTab] = useState('free');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null); // 소설류 장르
  const [seriesSubType, setSeriesSubType] = useState(null); // 시리즈의 웹소설형/일반소설형
  const [selectedTopic, setSelectedTopic] = useState(null); // 비문학 주제
  const [keywords, setKeywords] = useState(''); // 소설류 키워드
  const [bookTitle, setBookTitle] = useState(''); // 사용자 입력 제목
  const [selectedFont, setSelectedFont] = useState('default'); // 본문 폰트

  const [endingStyle, setEndingStyle] = useState(''); // 소설 결말 스타일
  const [selectedTone, setSelectedTone] = useState(''); // 비문학 문체
  const [essayNarrator, setEssayNarrator] = useState(''); // 에세이 화자 정체성
  const [essayAngle, setEssayAngle] = useState(''); // 에세이 접근 각도
  const [selfHelpAudience, setSelfHelpAudience] = useState(''); // 자기개발 독자 상황
  const [humanitiesStartingPoint, setHumanitiesStartingPoint] = useState(''); // 철학/인문 사유 출발점
  const [selectedMood, setSelectedMood] = useState(''); // 소설 분위기
  const [selectedPOV, setSelectedPOV] = useState(''); // 소설 시점 (누가 이야기하나요)
  const [selectedSpeechTone, setSelectedSpeechTone] = useState(''); // 소설 말투/문체
  const [selectedDialogueRatio, setSelectedDialogueRatio] = useState(''); // 대화 비중
  const [isAnonymousBook, setIsAnonymousBook] = useState(false); // 이 책만 익명 작성
  const [isCustomInput, setIsCustomInput] = useState(false); // 직접 입력 모드
  const [isGenerating, setIsGenerating] = useState(false);
  const [nonfictionTopics, setNonfictionTopics] = useState([]);
  const [isRefreshingKeywords, setIsRefreshingKeywords] = useState(false);
  const [showPaidWriteConfirm, setShowPaidWriteConfirm] = useState(false);
  const [pendingPaidWriteType, setPendingPaidWriteType] = useState(null);
  const [showNoWritesNotice, setShowNoWritesNotice] = useState(false);
  const cancelRequestedRef = useRef(false);
  const [localError, setLocalError] = useState(null);
  const [isGeneratingHidden, setIsGeneratingHidden] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // 동화공방 (입력 5개)
  const [childName, setChildName] = useState('');
  const [fairyAge, setFairyAge] = useState(null);             // 'toddler' | 'lower'
  const [fairyGender, setFairyGender] = useState(null);       // 'boy' | 'girl' | 'neutral'
  const [fairyTheme, setFairyTheme] = useState('');           // 교훈·테마 (선택)
  const [fairyInteraction, setFairyInteraction] = useState(null); // 'questions' | 'none'
  const [fairySetting, setFairySetting] = useState('');           // 배경·무대 (선택)
  const [openThemeCat, setOpenThemeCat] = useState(null);   // 교훈·테마 펼친 카테고리
  const [openSettingCat, setOpenSettingCat] = useState(null); // 배경 펼친 카테고리
  const [isFairyGenerating, setIsFairyGenerating] = useState(false);

  const handleGenerateFairytale = async () => {
    if (isFairyGenerating) return;
    if (!childName.trim()) { setLocalError('아이 이름을 입력해주세요.'); return; }
    if (!fairyAge) { setLocalError('연령을 선택해주세요.'); return; }
    if (!fairyGender) { setLocalError('성별을 선택해주세요.'); return; }
    if (!fairyInteraction) { setLocalError('읽기 상호작용을 선택해주세요.'); return; }
    if ((userProfile?.ink || 0) < 50) { setLocalError('잉크가 부족해요! 동화책은 잉크 50개가 필요해요.'); return; }
    if (typeof onSaveFairytale !== 'function') { setLocalError('동화 저장 기능을 사용할 수 없어요.'); return; }
    if (!confirm(`잉크 50개를 사용해 '${childName.trim()}' 동화책을 만들까요?`)) return;
    setLocalError(null); if (setError) setError(null);
    setIsFairyGenerating(true);
    let deducted = false;
    try {
      const ok = await deductInk(50);
      if (!ok) { setLocalError('잉크 차감에 실패했어요. 다시 시도해주세요.'); setIsFairyGenerating(false); return; }
      deducted = true;
      const result = await generateFairytale({
        childName: childName.trim(), age: fairyAge, gender: fairyGender,
        theme: fairyTheme.trim(), setting: fairySetting.trim(), interaction: fairyInteraction, appId,
      });
      const saved = await onSaveFairytale({
        title: result.title, content: result.content, childName: childName.trim(),
        age: fairyAge, gender: fairyGender, theme: fairyTheme.trim(), setting: fairySetting.trim(), interaction: fairyInteraction,
      });
      if (setSelectedBook) setSelectedBook(saved);
      if (setView) setView('book_detail');
    } catch (e) {
      if (deducted && typeof addInk === 'function') { try { await addInk(50); } catch { /* 환불 실패 무시 */ } }
      setLocalError('동화 생성에 실패했어요. 다시 시도해주세요.');
      console.error('[동화공방] 생성 오류:', e);
    } finally {
      setIsFairyGenerating(false);
    }
  };
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('');
  const [currentLoadingMessages, setCurrentLoadingMessages] = useState([]);
  const [isAdWatched, setIsAdWatched] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(null); // { stepName, stepIndex, totalSteps }
  const [showKeywordRefreshModal, setShowKeywordRefreshModal] = useState(false);
  const [pendingRefreshAd, setPendingRefreshAd] = useState(false); // 광고 시청 후 리프레시 대기 상태

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const toggleWakeLock = async () => {
      try {
        if (isGenerating) {
          await KeepAwake.keepAwake();
        } else {
          await KeepAwake.allowSleep();
        }
      } catch (err) {
        console.warn('KeepAwake error:', err);
      }
    };

    toggleWakeLock();
    return () => {
      KeepAwake.allowSleep().catch(() => { });
    };
  }, [isGenerating]);

  const displayError = error || localError;
  const novelLoadingMessages = [
    "흥미진진한 시놉시스를 구상 중입니다...",
    "주인공의 성격을 입체적으로 만드는 중...",
    "예상치 못한 반전을 준비하고 있습니다...",
    "문장을 윤문하고 오탈자를 확인 중입니다...",
    "거의 다 됐어요! 잉크를 말리는 중..."
  ];
  const nonfictionLoadingMessages = [
    "주제를 선명하게 정리하고 있습니다...",
    "설득력 있는 관점을 구성 중입니다...",
    "핵심 메시지를 다듬고 있습니다...",
    "독자에게 더 잘 전달되도록 윤문 중...",
    "마무리 문장을 정돈하고 있어요..."
  ];

  const getTodayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const hashSeed = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const seededRandom = (seed) => {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  };

  const pickKeywords = (bank, count, seedKey) => {
    const list = Array.isArray(bank) ? [...bank] : [];
    const rand = seedKey ? seededRandom(hashSeed(seedKey)) : Math.random;
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, count);
  };

  const getDailyKeywords = (categoryId) => {
    const bank = NONFICTION_KEYWORD_BANKS[categoryId] || [];
    return pickKeywords(bank, 5, `${categoryId}-${getTodayKey()}`);
  };

  const getToneOptions = (categoryId) => {
    return NONFICTION_TONE_OPTIONS[categoryId] || [];
  };

  // 개발/테스트 계정: 모든 제한 무시
  const DEV_BYPASS_EMAILS_LIMIT = ['banlan21@gmail.com'];
  const isDevUser = DEV_BYPASS_EMAILS_LIMIT.includes(user?.email);

  const todayKey = getTodayKey();
  const lastWriteDate = userProfile?.lastBookCreatedDate || null;
  const dailyWriteCount = userProfile?.dailyWriteCount || 0;
  const effectiveWriteCount = lastWriteDate === todayKey ? dailyWriteCount : 0;
  const remainingDailyWrites = Math.max(0, DAILY_WRITE_LIMIT - effectiveWriteCount);
  const requiresPaidWrite = !isDevUser && effectiveWriteCount >= DAILY_FREE_WRITES;

  useEffect(() => {
    if (remainingDailyWrites === 0) {
      setShowNoWritesNotice(true);
    }
  }, [remainingDailyWrites]);

  useEffect(() => {
    if (typeof onGeneratingChange === 'function') {
      onGeneratingChange(isGenerating);
    }
  }, [isGenerating, onGeneratingChange]);

  useEffect(() => {
    if ((!isGenerating && !isFairyGenerating) || !appId || !user?.uid) {
      setGenerationProgress(null);
      return;
    }
    const progressDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'generationProgress', 'current');
    const unsubscribe = onSnapshot(progressDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGenerationProgress({ stepName: data.stepName, stepIndex: data.stepIndex || 0, totalSteps: data.totalSteps || 0 });
      } else {
        setGenerationProgress(null);
      }
    });
    return () => unsubscribe();
  }, [isGenerating, isFairyGenerating, appId, user?.uid]);

  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const result = await LocalNotifications.requestPermissions();
        if (result.display !== 'granted') {
          console.warn('알림 권한이 거부되었습니다.');
        }
      } catch (err) {
        console.warn('알림 권한 요청 실패:', err);
      }
    };
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!isGenerating || currentLoadingMessages.length === 0) return;
    const timer = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % currentLoadingMessages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isGenerating, currentLoadingMessages.length]);

  useEffect(() => {
    if (currentLoadingMessages.length === 0) {
      setCurrentLoadingMessage('');
      return;
    }
    setCurrentLoadingMessage(currentLoadingMessages[loadingMessageIndex] || '');
  }, [currentLoadingMessages, loadingMessageIndex]);

  const getMoodOptions = () => {
    if (!selectedCategory || !selectedGenre) return [];
    const isWebNovel = selectedCategory.id === 'webnovel'
      || (selectedCategory.id === 'series' && seriesSubType?.id === 'webnovel');
    const isGeneralNovel = selectedCategory.id === 'novel'
      || (selectedCategory.id === 'series' && seriesSubType?.id === 'novel');

    if (isWebNovel) {
      if (['fantasy', 'modern-fantasy', 'wuxia', 'sf'].includes(selectedGenre.id)) {
        return NOVEL_MOOD_OPTIONS.webnovel.Action;
      }
      if (['romance', 'romance-fantasy'].includes(selectedGenre.id)) {
        return NOVEL_MOOD_OPTIONS.webnovel.Romance;
      }
      if (['mystery-horror'].includes(selectedGenre.id)) {
        return NOVEL_MOOD_OPTIONS.webnovel.Thriller;
      }
    }

    if (isGeneralNovel) {
      if (['drama', 'history', 'healing'].includes(selectedGenre.id)) {
        return NOVEL_MOOD_OPTIONS.novel.Drama;
      }
      if (['romance'].includes(selectedGenre.id)) {
        return NOVEL_MOOD_OPTIONS.novel.Romance;
      }
      if (['mystery', 'thriller', 'sf'].includes(selectedGenre.id)) {
        return NOVEL_MOOD_OPTIONS.novel.Genre;
      }
    }

    return [];
  };

  const getAvailableNovelGenres = () => {
    if (!selectedCategory) return [];
    if (selectedCategory.id === 'webnovel') return webnovelGenres;
    if (selectedCategory.id === 'novel') return novelGenres;
    if (selectedCategory.id === 'series') {
      if (seriesSubType?.id === 'webnovel') return webnovelGenres;
      if (seriesSubType?.id === 'novel') return novelGenres;
      return [];
    }
    return [];
  };

  // 슬롯 상태 확인 (시리즈는 통합 1슬롯, 하위 구분 없음)
  const getSlotStatus = (categoryId, _subCategoryId = null) => {
    if (categoryId === 'series') return slotStatus?.['series'] || null;
    return slotStatus?.[categoryId] || null;
  };

  const isSlotAvailable = (categoryId, subCategoryId = null) => {
    if (isDevUser) return true;
    return getSlotStatus(categoryId, subCategoryId) === null;
  };

  const isSeriesCategoryAvailable = () => isSlotAvailable('series');

  // 카테고리 선택 핸들러
  const handleCategorySelect = (category) => {
    if (!isDevUser) {
      if (category.id === 'series') {
        if (!isSeriesCategoryAvailable()) {
          const seriesSlot = getSlotStatus('series');
          if (seriesSlot?.book && setSelectedBook && setView) {
            setSelectedBook(seriesSlot.book);
            setView('book_detail');
          }
          return;
        }
      } else {
        if (!isSlotAvailable(category.id)) {
          const slotInfo = getSlotStatus(category.id);
          if (slotInfo?.book && setSelectedBook && setView) {
            setSelectedBook(slotInfo.book);
            setView('book_detail');
          }
          return;
        }
      }
    }

    setSelectedCategory(category);
    setSelectedGenre(null);
    setSeriesSubType(null);
    setSelectedTopic(null);
    setKeywords('');
    setBookTitle('');
    setSelectedFont('default');

    setEndingStyle('');
    setSelectedTone('');
    setEssayNarrator('');
    setEssayAngle('');
    setSelfHelpAudience('');
    setHumanitiesStartingPoint('');
    setSelectedMood('');
    setIsCustomInput(false);
    setNonfictionTopics([]);
    setShowPaidWriteConfirm(false);
    setPendingPaidWriteType(null);
    setLocalError(null);
    if (setError) setError(null);
  };

  useEffect(() => {
    if (selectedCategory && !selectedCategory.isNovel) {
      setNonfictionTopics(getDailyKeywords(selectedCategory.id));
    } else {
      setNonfictionTopics([]);
    }
  }, [selectedCategory]);

  // 비문학 주제 선택
  const handleTopicSelect = (topicText) => {
    // 안전성 체크
    if (!selectedCategory) {
      console.error('selectedCategory가 없습니다.');
      return;
    }

    if (!topicText || typeof topicText !== 'string') {
      console.error('topicText가 비어있습니다.');
      setLocalError('주제를 선택해주세요.');
      if (setError) setError('주제를 선택해주세요.');
      return;
    }

    setSelectedTopic(topicText);
    setLocalError(null);
    if (setError) setError(null);
  };

  const performRefreshKeywords = async (skipInkDeduct = false) => {
    if (!selectedCategory || selectedCategory.isNovel) return;

    // 무료 리프레시(광고 시청 등)가 아닐 경우 잉크 차감
    if (!skipInkDeduct) {
      if (typeof deductInk !== 'function') {
        setLocalError('잉크 차감 기능을 사용할 수 없습니다.');
        return;
      }
      const success = await deductInk(1);
      if (!success) {
        setLocalError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        return;
      }
    }

    setIsRefreshingKeywords(true);
    try {
      const bank = NONFICTION_KEYWORD_BANKS[selectedCategory.id] || [];
      // 10개 -> 5개로 변경
      setNonfictionTopics(pickKeywords(bank, 5));
      setSelectedTopic(null);
      setBookTitle('');
    } finally {
      setIsRefreshingKeywords(false);
    }
  };

  const handleRefreshKeywords = async () => {
    if (!selectedCategory || selectedCategory.isNovel) return;
    if (!user) {
      setLocalError('로그인 후 사용할 수 있어요.');
      if (setError) setError('로그인 후 사용할 수 있어요.');
      return;
    }

    const level = userProfile?.level || 1;
    const isFree = isKeywordRefreshFree(level);

    if (isFree) {
      // 레벨 혜택으로 무료인 경우 바로 실행
      await performRefreshKeywords(true);
    } else {
      // 유료인 경우 선택 모달 띄우기
      setShowKeywordRefreshModal(true);
    }
  };

  const handleAdRefresh = () => {
    showRewardVideoAd(
      async () => {
        // 광고 시청 성공
        setShowKeywordRefreshModal(false);
        await performRefreshKeywords(true); // 무료로 실행
      },
      (errorMsg) => {
        setLocalError(errorMsg);
        if (setError) setError(errorMsg);
      }
    );
  };

  const handleInkRefresh = async () => {
    const currentInk = userProfile?.ink || 0;
    if (currentInk < 1) {
      setLocalError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
      if (setError) setError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
      setShowKeywordRefreshModal(false);
      return;
    }
    setShowKeywordRefreshModal(false);
    await performRefreshKeywords(false); // 잉크 차감 실행
  };

  const openPaidWriteConfirm = (type) => {
    setPendingPaidWriteType(type);
    setShowPaidWriteConfirm(true);
  };

  const closePaidWriteConfirm = () => {
    setShowPaidWriteConfirm(false);
    setPendingPaidWriteType(null);
  };


  // 광고 시청 후 상태 변화 감지하여 로직 실행 (Closure 문제 해결)
  useEffect(() => {
    if (isAdWatched && pendingPaidWriteType) {
      console.log('useEffect 감지: 광고 시청 완료, 집필 시작');
      const type = pendingPaidWriteType;

      const proceed = async () => {
        if (type === 'nonfiction') {
          await startNonfictionGenerate(true, true);
        } else if (type === 'novel') {
          await startNovelGenerate(true, true);
        }
        setIsAdWatched(false); // 리셋
        setPendingPaidWriteType(null); // 타입도 집필 시작 후 초기화
      };

      proceed();
    }
  }, [isAdWatched, pendingPaidWriteType]);

  const handleWatchAdForWrite = async () => {
    showRewardVideoAd(
      async () => {
        // 광고 시청 보상: 무료 집필 (잉크 차감 없이 진행)
        console.log('🎉 광고 시청 완료! 무료 집필 플래그 설정');
        // 모달만 닫고 pendingPaidWriteType은 유지 — useEffect가 타입을 읽어 집필을 시작함
        setShowPaidWriteConfirm(false);
        setIsAdWatched(true); // 상태 업데이트로 트리거
      },
      (errorMsg) => {
        setLocalError(errorMsg);
        if (setError) setError(errorMsg);
      }
    );
  };

  const startNonfictionGenerate = async (forcePaid = false, isAdReward = false) => {
    if (!selectedCategory || selectedCategory.isNovel || !selectedTopic || !bookTitle.trim() || !selectedTone || isGenerating) {
      return;
    }

    if (!isDevUser && remainingDailyWrites <= 0) {
      const errorMsg = '하루에 최대 2회까지만 집필할 수 있어요.';
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    // 2회차 집필은 광고 시청 필수 (잉크 결제 불가)
    if (requiresPaidWrite && !isAdReward) {
      openPaidWriteConfirm('nonfiction');
      return;
    }

    // 슬롯 확인
    if (!isSlotAvailable(selectedCategory.id)) {
      const slotInfo = getSlotStatus(selectedCategory.id);
      const slotAuthor = slotInfo?.book?.isAnonymous ? '익명' : (slotInfo?.authorId ? (authorProfiles[slotInfo.authorId]?.nickname || '익명') : '익명');
      const errorMsg = `이미 오늘의 책이 발행되었습니다! (By. ${slotAuthor}) 서재에서 읽어보세요.`;
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    cancelRequestedRef.current = false;
    setIsGenerating(true);
    setIsGeneratingHidden(false);
    const messages = selectedCategory?.isNovel ? novelLoadingMessages : nonfictionLoadingMessages;
    setCurrentLoadingMessages(messages);
    setLoadingMessageIndex(0);
    setLocalError(null);
    if (setError) setError(null);

    try {
      const result = await generateBook({
        category: selectedCategory.id,
        subCategory: null,
        genre: null,
        keywords: selectedTopic,
        isSeries: false,
        title: bookTitle.trim(),
        selectedTone: selectedTone,
        essayNarrator: selectedCategory.id === 'essay' ? essayNarrator : null,
        essayAngle: selectedCategory.id === 'essay' ? essayAngle : null,
        selfHelpAudience: selectedCategory.id === 'self-help' ? selfHelpAudience : null,
        humanitiesStartingPoint: selectedCategory.id === 'humanities' ? humanitiesStartingPoint : null,
        appId: appId || null
      });

      if (cancelRequestedRef.current) return;

      if (!result || !result.title || !result.content) {
        throw new Error('책 생성 결과가 올바르지 않습니다.');
      }

      if (onBookGenerated) {
        const savedBook = await onBookGenerated({
          ...result,
          category: selectedCategory.id,
          subCategory: null,
          isSeries: false,
          keywords: selectedTopic,
          fontFamily: selectedFont,
          isAnonymous: isAnonymousBook
        }, false, { skipDailyCheck: true, skipNavigate: isGeneratingHidden, skipInkDeduct: isAdReward });
        if (isGeneratingHidden) {
          await sendGenerationCompleteNotification(result.title || bookTitle);
          if (typeof onGenerationComplete === 'function') {
            onGenerationComplete(savedBook);
          }
        }
      }

      // 폼 초기화
      setSelectedCategory(null);
      setSelectedTopic(null);
      setBookTitle('');
      setIsCustomInput(false);
    } catch (err) {
      console.error('❌ [WriteView] 비문학 생성 오류 - 전체 에러:', err);
      console.error('❌ [WriteView] 에러 메시지:', err?.message);
      console.error('❌ [WriteView] 에러 코드:', err?.code);
      console.error('❌ [WriteView] 원본 에러:', err?.originalError);

      if (err.message !== 'SLOT_ALREADY_TAKEN') {
        const errorMsg = err?.message || err?.originalError?.message || '책 생성에 실패했습니다. 다시 시도해주세요.';
        setLocalError(errorMsg);
        if (setError) setError(errorMsg);
      }
    } finally {
      setIsGenerating(false);
      cancelRequestedRef.current = false;
    }
  };

  // 비문학 생성 핸들러
  const handleNonfictionGenerate = async () => {
    await startNonfictionGenerate(false);
  };

  // 소설류 생성 핸들러
  const handleNovelGenerate = async () => {
    await startNovelGenerate(false);
  };

  const startNovelGenerate = async (forcePaid = false, isAdReward = false) => {
    if (!selectedCategory || !selectedGenre || !keywords.trim() || !bookTitle.trim() || !selectedMood || !selectedPOV || !selectedSpeechTone || isGenerating) {
      return;
    }

    if (!isDevUser && remainingDailyWrites <= 0) {
      const errorMsg = '하루에 최대 2회까지만 집필할 수 있어요.';
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    // 2회차 집필은 광고 시청 필수 (잉크 결제 불가)
    if (requiresPaidWrite && !isAdReward) {
      openPaidWriteConfirm('novel');
      return;
    }

    // 슬롯 확인 (시리즈는 subCategory로 구분)
    let slotCheckCategoryId = selectedCategory.id;
    let slotCheckSubCategoryId = null;

    if (selectedCategory.id === 'series' && seriesSubType) {
      slotCheckSubCategoryId = seriesSubType.id; // 'webnovel' 또는 'novel'
    }

    if (!isSlotAvailable(slotCheckCategoryId, slotCheckSubCategoryId)) {
      const slotInfo = getSlotStatus(slotCheckCategoryId, slotCheckSubCategoryId);
      const slotAuthor = slotInfo?.book?.isAnonymous ? '익명' : (slotInfo?.authorId ? (authorProfiles[slotInfo.authorId]?.nickname || '익명') : '익명');
      const errorMsg = `이미 오늘의 책이 발행되었습니다! (By. ${slotAuthor}) 서재에서 읽어보세요.`;
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    cancelRequestedRef.current = false;
    setIsGenerating(true);
    setIsGeneratingHidden(false);
    const messages = selectedCategory?.isNovel ? novelLoadingMessages : nonfictionLoadingMessages;
    setCurrentLoadingMessages(messages);
    setLoadingMessageIndex(0);
    setLocalError(null);
    if (setError) setError(null);

    try {
      const endingStyleToSend = selectedCategory.isNovel ? endingStyle : null;
      const result = await generateBook({
        category: selectedCategory.id === 'series' ? 'series' : selectedCategory.id,
        subCategory: selectedCategory.id === 'series' ? seriesSubType?.id : selectedGenre.id,
        genre: selectedGenre.name,
        keywords: keywords.trim(),
        isSeries: selectedCategory.id === 'series',
        endingStyle: endingStyleToSend,
        title: bookTitle.trim(),
        selectedMood: selectedMood,
        selectedPOV: selectedPOV,
        selectedSpeechTone: selectedSpeechTone,
        selectedDialogueRatio: selectedDialogueRatio,
        appId: appId || null
      });

      if (cancelRequestedRef.current) return;

      if (onBookGenerated) {
        const savedBook = await onBookGenerated({
          ...result,
          category: selectedCategory.id === 'series' ? 'series' : selectedCategory.id,
          subCategory: selectedGenre.id,
          seriesSubType: selectedCategory.id === 'series' ? seriesSubType?.id : null,
          isSeries: selectedCategory.id === 'series',
          keywords: keywords.trim(),
          selectedMood: selectedMood,
          selectedPOV: selectedPOV,
          selectedSpeechTone: selectedSpeechTone,
          selectedDialogueRatio: selectedDialogueRatio,
          fontFamily: selectedFont,
          isAnonymous: isAnonymousBook
        }, false, { skipDailyCheck: true, skipNavigate: isGeneratingHidden, skipInkDeduct: isAdReward });
        if (isGeneratingHidden) {
          await sendGenerationCompleteNotification(result.title || bookTitle);
          if (typeof onGenerationComplete === 'function') {
            onGenerationComplete(savedBook);
          }
        }
      }

      // 폼 초기화
      setSelectedCategory(null);
      setSelectedGenre(null);
      setSeriesSubType(null);
      setKeywords('');
      setBookTitle('');
      setIsAnonymousBook(false);
      setSelectedMood('');
      setSelectedPOV('');
      setSelectedSpeechTone('');
      setSelectedDialogueRatio('');
      setEndingStyle('');
      setIsCustomInput(false);
    } catch (err) {
      console.error('❌ [WriteView] 소설 생성 오류 - 전체 에러:', err);
      console.error('❌ [WriteView] 에러 메시지:', err?.message);
      console.error('❌ [WriteView] 에러 코드:', err?.code);
      console.error('❌ [WriteView] 원본 에러:', err?.originalError);

      if (err.message !== 'SLOT_ALREADY_TAKEN') {
        const errorMsg = err?.message || err?.originalError?.message || '책 생성에 실패했습니다. 다시 시도해주세요.';
        setLocalError(errorMsg);
        if (setError) setError(errorMsg);
      }
    } finally {
      setIsGenerating(false);
      cancelRequestedRef.current = false;
    }
  };
  const sendGenerationCompleteNotification = async (bookTitle) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: '집필이 완료되었습니다!',
            body: `"${bookTitle}" 작품을 확인해보세요.`,
            schedule: { at: new Date(Date.now() + 1000) }
          }
        ]
      });
    } catch (err) {
      console.warn('알림 전송 실패:', err);
    }
  };

  const handleCancelGenerate = () => {
    cancelRequestedRef.current = true;
    setIsGenerating(false);
    setIsGeneratingHidden(false);
    setLocalError('집필이 취소되었습니다.');
    if (setError) setError('집필이 취소되었습니다.');
  };

  const [showQuizInGenerating, setShowQuizInGenerating] = useState(false);

  // GeneratingNotice를 JSX 변수로 (함수 컴포넌트가 아닌)
  // → 매 렌더마다 새 컴포넌트 reference 생성 방지 → OXQuizGame 재마운트 방지
  const generatingNoticeJSX = (isGenerating && !isGeneratingHidden) ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center max-h-[85vh] overflow-y-auto scrollbar-hide">
        {showQuizInGenerating ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-400">{currentLoadingMessage || (t?.generating_title || "집필 중...")}</p>
              <button onClick={() => setShowQuizInGenerating(false)} className="text-xs text-orange-500 font-bold">돌아가기</button>
            </div>
            <OXQuizGame t={t} />
          </>
        ) : (
          <>
            <div className="flex items-center justify-center">
              <img src="/icons/odok_thinking.png" alt="" className="w-20 h-20 animate-bounce" />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 font-bold">
              {t?.generating_title || "집필 중입니다..."}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t?.generating_desc || "책 생성에는 약 2~3분이 소요될 수 있어요."}
            </p>
            {generationProgress && generationProgress.stepName && generationProgress.totalSteps > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-black text-orange-500">
                  {generationProgress.stepName} 작성 중... ({generationProgress.stepIndex}/{generationProgress.totalSteps})
                </p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(generationProgress.stepIndex / generationProgress.totalSteps) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {currentLoadingMessage && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                {currentLoadingMessage}
              </p>
            )}
            <button
              onClick={() => setShowQuizInGenerating(true)}
              className="w-full py-3 rounded-xl text-sm font-black bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all"
            >
              ⭕❌ OX퀴즈 풀면서 기다리기
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setIsGeneratingHidden(true)}
                className="flex-1 py-3 rounded-xl text-sm font-black bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600"
              >
                {t?.hide_btn || "숨기기"}
              </button>
              <button
                onClick={handleCancelGenerate}
                className="flex-1 py-3 rounded-xl text-sm font-black bg-white dark:bg-slate-800 border border-orange-300 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/20"
              >
                {t?.cancel_write_btn || "집필 취소"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  // 생성 가능 여부 확인
  const canGenerateNovel = selectedCategory &&
    selectedGenre &&
    (selectedCategory.id !== 'series' || seriesSubType) && // 시리즈는 세부 타입도 선택 필요
    bookTitle.trim().length > 0 &&
    keywords.trim().length > 0 &&
    remainingDailyWrites > 0 &&
    isSlotAvailable(selectedCategory.id);

  const essayOptionsReady = selectedCategory?.id !== 'essay' || (essayNarrator && essayAngle);
  const selfHelpOptionsReady = selectedCategory?.id !== 'self-help' || selfHelpAudience;
  const humanitiesOptionsReady = selectedCategory?.id !== 'humanities' || humanitiesStartingPoint;
  const canGenerateNonfiction = selectedCategory &&
    !selectedCategory.isNovel &&
    selectedTopic &&
    bookTitle.trim().length > 0 &&
    selectedTone &&
    essayOptionsReady &&
    selfHelpOptionsReady &&
    humanitiesOptionsReady &&
    remainingDailyWrites > 0 &&
    isSlotAvailable(selectedCategory.id);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in pb-20 pt-3">
      {/* 헤더 */}
      <div className="space-y-2">
        <h2 className="text-2xl font-jua text-slate-800 dark:text-slate-100 leading-tight">
          {t?.write_title || "집필"}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line">
          {t?.write_desc || "원하는 장르를 선택하고 주제를 입력하면\nAI가 당신만의 책을 만들어줍니다."}
        </p>
      </div>

      {/* 탭: 자유집필 / 동화공방 */}
      <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveWriteTab('free')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
            activeWriteTab === 'free'
              ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          ✍️ 자유집필
        </button>
        <button
          onClick={() => setActiveWriteTab('fairy')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
            activeWriteTab === 'fairy'
              ? 'bg-white dark:bg-slate-700 text-purple-500 shadow-sm'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          🧚 동화공방
        </button>
      </div>

      {activeWriteTab === 'fairy' ? (
        <div className="space-y-5 py-2">
          {/* 헤더 */}
          <div className="text-center space-y-1">
            <div className="text-4xl">🧚</div>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100">동화공방</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">우리 아이가 주인공인 나만의 동화 (잉크 50개)</p>
          </div>

          {/* 1. 아이 이름 */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 px-1">아이 이름 <span className="text-purple-500">*</span></label>
            <input
              type="text" value={childName} onChange={(e) => setChildName(e.target.value)}
              maxLength={12} placeholder="이름만 입력 (예: 서연, 도윤)" disabled={isFairyGenerating}
              className="w-full bg-white dark:bg-slate-700 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-purple-500 focus:outline-none transition-colors disabled:opacity-60"
            />
          </div>

          {/* 2. 연령 */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 px-1">연령 <span className="text-purple-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'toddler', label: '유아', sub: '3~5세' }, { id: 'lower', label: '저학년', sub: '6~8세' }].map((a) => (
                <button key={a.id} onClick={() => setFairyAge(a.id)} disabled={isFairyGenerating}
                  className={`py-3 rounded-xl border-2 text-sm font-bold transition-all disabled:opacity-60 ${fairyAge === a.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {a.label} <span className="text-[11px] opacity-70">{a.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. 성별 */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 px-1">성별 <span className="text-purple-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {[{ id: 'boy', label: '남아' }, { id: 'girl', label: '여아' }, { id: 'neutral', label: '선택 안 함' }].map((g) => (
                <button key={g.id} onClick={() => setFairyGender(g.id)} disabled={isFairyGenerating}
                  className={`py-3 rounded-xl border-2 text-xs font-bold transition-all disabled:opacity-60 ${fairyGender === g.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 교훈·테마 (선택) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 px-1">교훈·테마 <span className="text-[11px] text-slate-400 font-normal">(선택, 없어도 됨)</span></label>
            <input
              type="text" value={fairyTheme} onChange={(e) => setFairyTheme(e.target.value)}
              maxLength={20} placeholder="예: 용기, 양치질, 정리정돈" disabled={isFairyGenerating}
              className="w-full bg-white dark:bg-slate-700 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-purple-500 focus:outline-none transition-colors disabled:opacity-60"
            />
            {/* 카테고리별 예시 (접기식) */}
            <div className="space-y-1.5">
              {FAIRY_THEME_GROUPS.map((grp, gi) => (
                <div key={grp.cat} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenThemeCat(openThemeCat === gi ? null : gi)}
                    disabled={isFairyGenerating}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 disabled:opacity-60"
                  >
                    <span>{grp.cat}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${openThemeCat === gi ? 'rotate-180' : ''}`} />
                  </button>
                  {openThemeCat === gi && (
                    <div className="flex flex-wrap gap-1.5 p-2.5 bg-white dark:bg-slate-800">
                      {grp.items.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setFairyTheme(ex)}
                          disabled={isFairyGenerating}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors disabled:opacity-60 ${fairyTheme === ex ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 배경·무대 (선택) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 px-1">배경·무대 <span className="text-[11px] text-slate-400 font-normal">(선택, 없으면 AI가 정함)</span></label>
            <input
              type="text" value={fairySetting} onChange={(e) => setFairySetting(e.target.value)}
              maxLength={30} placeholder="예: 동물의 나라, 깊은 바다 속, 옛날" disabled={isFairyGenerating}
              className="w-full bg-white dark:bg-slate-700 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-purple-500 focus:outline-none transition-colors disabled:opacity-60"
            />
            <div className="space-y-1.5">
              {FAIRY_SETTING_GROUPS.map((grp, gi) => (
                <div key={grp.cat} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenSettingCat(openSettingCat === gi ? null : gi)}
                    disabled={isFairyGenerating}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 disabled:opacity-60"
                  >
                    <span>{grp.cat}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${openSettingCat === gi ? 'rotate-180' : ''}`} />
                  </button>
                  {openSettingCat === gi && (
                    <div className="flex flex-wrap gap-1.5 p-2.5 bg-white dark:bg-slate-800">
                      {grp.items.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setFairySetting(ex)}
                          disabled={isFairyGenerating}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors disabled:opacity-60 ${fairySetting === ex ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 5. 읽기 상호작용 */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 px-1">읽기 상호작용 <span className="text-purple-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'questions', label: '질문 넣기', sub: '읽으며 묻기' }, { id: 'none', label: '안 넣기', sub: '쭉 읽어주기' }].map((q) => (
                <button key={q.id} onClick={() => setFairyInteraction(q.id)} disabled={isFairyGenerating}
                  className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all disabled:opacity-60 ${fairyInteraction === q.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {q.label}<span className="block text-[10px] opacity-70 font-medium">{q.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {localError && <p className="text-xs text-red-500 font-bold text-center">{localError}</p>}

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerateFairytale}
            disabled={isFairyGenerating}
            className="w-full py-4 rounded-2xl font-black text-white text-base bg-gradient-to-r from-purple-500 to-pink-500 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-purple-200 dark:shadow-purple-900/30"
          >
            {isFairyGenerating
              ? <><RefreshCw className="w-5 h-5 animate-spin" /> {generationProgress?.stepName ? `${generationProgress.stepName} 쓰는 중… (${generationProgress.stepIndex}/${generationProgress.totalSteps})` : '동화를 만드는 중…'}</>
              : <>🪄 동화책 만들기 (잉크 50)</>}
          </button>
          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
            보유 잉크 {userProfile?.ink ?? 0}개 · {fairyAge === 'lower' ? '약 1,500~2,500자' : '약 800~1,200자'} · 만든 동화는 보관함에서 볼 수 있어요
          </p>
        </div>
      ) : (
        <>
      {/* 1. 메인 카테고리 선택 (6개) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1">{t?.category_label || "카테고리 선택"}</h3>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => {
            const isSoldOut = !isDevUser && (category.id === 'series'
              ? !isSeriesCategoryAvailable()
              : getSlotStatus(category.id) !== null);
            const slotInfo = getSlotStatus(category.id);

            return (
              <button
                key={category.id}
                disabled={isSoldOut}
                onClick={() => handleCategorySelect(category)}
                className={`p-4 rounded-2xl border-2 shadow-sm transition-all text-center relative ${isSoldOut
                  ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 opacity-60 cursor-not-allowed'
                  : selectedCategory?.id === category.id
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 active:scale-95'
                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-orange-200 active:scale-95'
                  }`}
              >
                {isSoldOut && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <div className="text-3xl mb-2">{category.icon}</div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">{category.name}</h3>
                {isSoldOut ? (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold line-clamp-1">
                      {(t?.today_sold_out || "오늘의 {name} 마감").replace('{name}', category.name)}
                    </p>
                    {slotInfo?.authorId && (
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                        {(t?.by_author || "By. {name}").replace('{name}', slotInfo?.authorName || (slotInfo?.book?.isAnonymous ? '익명' : (authorProfiles[slotInfo.authorId]?.nickname || '익명')))}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-orange-500 font-bold mt-1">{t?.start_writing || "집필하기"}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 선택된 카테고리에 따른 폼 */}
      {selectedCategory && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          {/* 비문학 카테고리 (에세이/자기계발/인문철학) */}
          {!selectedCategory.isNovel && (
            <>
              {/* 모드 선택: 키워드 추천 / 직접 입력 */}
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => { setIsCustomInput(false); setSelectedTopic(null); setKeywords(''); }}
                  className={`flex-1 py-2 text-xs font-black transition-colors ${!isCustomInput ? 'text-orange-600 border-b-2 border-orange-500' : 'text-slate-400'}`}
                >
                  🎲 키워드 추천
                </button>
                <button
                  onClick={() => { setIsCustomInput(true); setSelectedTopic(null); }}
                  className={`flex-1 py-2 text-xs font-black transition-colors ${isCustomInput ? 'text-orange-600 border-b-2 border-orange-500' : 'text-slate-400'}`}
                >
                  ✏️ 직접 입력
                </button>
              </div>

              {isCustomInput ? (
                <div className="space-y-3">
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                    {t?.custom_topic_title || "주제와 키워드를 직접 입력하세요"}
                  </h3>
                  <textarea
                    value={keywords}
                    onChange={(e) => { setKeywords(e.target.value); setSelectedTopic(e.target.value.trim() || null); }}
                    placeholder="예: 직장인의 번아웃과 회복, 작은 정원 가꾸기의 행복, 아이와 함께 성장하는 부모..."
                    className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100 resize-none leading-relaxed"
                    maxLength={100}
                    rows={3}
                  />
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold text-right">{keywords.length}/100</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                      {t?.what_story || "어떤 이야기를 쓰고 싶으신가요?"}
                    </h3>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRefreshKeywords(); }}
                      disabled={isRefreshingKeywords || isGenerating || !isSlotAvailable(selectedCategory.id)}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${isRefreshingKeywords || isGenerating || !isSlotAvailable(selectedCategory.id)
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                        }`}
                      title={isKeywordRefreshFree(getLevelFromXp(userProfile?.xp ?? 0)) ? (t?.refresh_keywords_free || "키워드 새로고침 (무료)") : (t?.refresh_keywords_paid || "키워드 새로고침 (잉크 1)")}
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshingKeywords ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nonfictionTopics.map((item, index) => {
                      const isSelected = selectedTopic === item.ko;
                      return (
                        <button
                          key={item.id || index}
                          onClick={() => handleTopicSelect(item.ko)}
                          disabled={isGenerating || !isSlotAvailable(selectedCategory.id)}
                          className={`px-4 py-3 rounded-full text-sm font-bold transition-all relative ${isGenerating || !isSlotAvailable(selectedCategory.id)
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                            : isSelected
                              ? 'bg-orange-500 text-white shadow-md'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95'
                            }`}
                        >
                          <span>{t?.['kw_' + item.id] || item.ko}</span>
                          {isGenerating && isSelected && (
                            <RefreshCw className="w-4 h-4 inline-block ml-2 animate-spin" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {selectedTopic && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t?.book_title || "책 제목"} <span className="text-orange-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      placeholder={t?.book_title_ph || "15자 이내로 제목을 입력하세요"}
                      className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100"
                      maxLength={15}
                    />
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-bold text-right">
                      {bookTitle.length}/15
                    </div>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymousBook}
                        onChange={(e) => setIsAnonymousBook(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">🌱 익명으로 작성</span>
                    </label>
                  </div>
                </div>
              )}
              {selectedTopic && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t?.select_font || "본문 폰트"}
                  </label>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {BOOK_FONTS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFont(f.id)}
                        className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          selectedFont === f.id
                            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800'
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                        style={{ fontFamily: f.family }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedTopic && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t?.select_style || "스타일 선택"} <span className="text-orange-500">*</span>
                  </label>
                  <select
                    value={selectedTone}
                    onChange={(e) => setSelectedTone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100"
                  >
                    <option value="">{t?.select_style_plz || "스타일을 선택하세요"}</option>
                    {getToneOptions(selectedCategory.id).map((tone) => (
                      <option key={tone} value={tone}>
                        {t?.[TONE_TO_KEY[tone]] || tone}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedTopic && selectedCategory.id === 'essay' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      화자의 정체성 <span className="text-orange-500">*</span>
                    </label>
                    <select
                      value={essayNarrator}
                      onChange={(e) => setEssayNarrator(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100"
                    >
                      <option value="">화자를 선택하세요</option>
                      {ESSAY_NARRATOR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} — {opt.desc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      접근 각도 <span className="text-orange-500">*</span>
                    </label>
                    <select
                      value={essayAngle}
                      onChange={(e) => setEssayAngle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100"
                    >
                      <option value="">접근 방식을 선택하세요</option>
                      {ESSAY_ANGLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} — {opt.desc}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {selectedTopic && selectedCategory.id === 'self-help' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    독자 상황 <span className="text-orange-500">*</span>
                  </label>
                  <select
                    value={selfHelpAudience}
                    onChange={(e) => setSelfHelpAudience(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100"
                  >
                    <option value="">독자 상황을 선택하세요</option>
                    {SELF_HELP_AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} — {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedTopic && selectedCategory.id === 'humanities' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    사유의 출발점 <span className="text-orange-500">*</span>
                  </label>
                  <select
                    value={humanitiesStartingPoint}
                    onChange={(e) => setHumanitiesStartingPoint(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100"
                  >
                    <option value="">출발점을 선택하세요</option>
                    {HUMANITIES_STARTING_POINT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} — {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {canGenerateNonfiction && (
                <button
                  onClick={handleNonfictionGenerate}
                  disabled={isGenerating}
                  className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 ${!isGenerating
                    ? 'bg-orange-500 hover:bg-orange-600 active:scale-95'
                    : 'bg-slate-300 cursor-not-allowed'
                    }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{t?.writing_now || '책을 쓰고 있어요...'}</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-5 h-5" />
                      <span>{requiresPaidWrite ? (t?.ad_write_create || '광고 보고 추가 집필') : (t?.create_book || '책 생성하기')}</span>
                    </>
                  )}
                </button>
              )}
              {generatingNoticeJSX}
            </>
          )}

          {/* 소설류 카테고리 (웹소설/소설/시리즈) */}
          {selectedCategory.isNovel && (
            <>
              {/* 시리즈만: 웹소설형/일반소설형 선택 (잠금 없음, 시리즈 버튼에서만 통합 잠금) */}
              {selectedCategory.id === 'series' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t?.sub_genre || "세부 장르"} <span className="text-orange-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {seriesSubTypes.map((subType) => (
                      <button
                        key={subType.id}
                        onClick={() => {
                          setSeriesSubType(subType);
                          setSelectedGenre(null);
                          setSelectedMood('');
                        }}
                        className={`py-3 rounded-xl font-bold text-sm transition-all ${seriesSubType?.id === subType.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                      >
                        {t?.['sub_type_' + subType.id] || subType.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 장르 선택 */}
              {selectedCategory.id !== 'series' || seriesSubType ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t?.genre_label || "장르"} <span className="text-orange-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {getAvailableNovelGenres().map((genre) => {
                      const genreKey = 'genre_' + genre.id.replace(/-/g, '_');
                      return (
                        <button
                          key={genre.id}
                          onClick={() => {
                            setSelectedGenre(genre);
                            setSelectedMood('');
                          }}
                          className={`py-2 px-3 rounded-xl font-bold text-sm transition-all ${selectedGenre?.id === genre.id
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                          {t?.[genreKey] || genre.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* ─── 순서 조정: 키워드 → 제목 → 스타일 프리셋/직접설정 → 폰트 → 결말 ─── */}

              {/* 1. 키워드 (뭘 쓸 건지 먼저) */}
              {selectedGenre && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t?.topic_keyword || "주제 또는 키워드"} <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder={t?.keyword_placeholder || "예: 가을 낙엽, 첫 사랑, 성장, 일상의 소중함..."}
                    className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100"
                    maxLength={100}
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500">갈등이 담긴 주제일수록 깊이 있는 이야기가 만들어져요 ✨</p>
                  {GENRE_EXAMPLE_TOPICS[selectedGenre?.id] && (
                    <div className="flex flex-wrap gap-1.5">
                      {GENRE_EXAMPLE_TOPICS[selectedGenre.id].map((ex, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setKeywords(ex)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40 active:scale-95 transition-all text-left"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold text-right">{keywords.length}/100</div>
                </div>
              )}

              {/* 2. 제목 */}
              {selectedGenre && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t?.book_title || "책 제목"} <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder={t?.book_title_ph || "15자 이내로 제목을 입력하세요"}
                    className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors text-slate-800 dark:text-slate-100"
                    maxLength={15}
                  />
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold text-right">{bookTitle.length}/15</div>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAnonymousBook}
                      onChange={(e) => setIsAnonymousBook(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">🌱 익명으로 작성</span>
                  </label>
                </div>
              )}

              {/* 3. 세부 설정 — 칩 버튼 */}
              {selectedGenre && selectedCategory?.isNovel && (
                <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                  {/* 분위기 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.mood_label || "분위기"} *</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getMoodOptions().map((mood) => {
                        const grMood = getMoodGuardRail(selectedGenre?.name || '', mood);
                        const moodBlocked = grMood === 'blocked';
                        const moodCaution = grMood === 'caution';
                        return (
                          <button key={mood}
                            onClick={() => !moodBlocked && setSelectedMood(mood)}
                            disabled={moodBlocked}
                            title={moodBlocked ? '이 장르에는 어울리지 않습니다' : moodCaution ? '실험적 조합입니다' : undefined}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${moodBlocked ? 'opacity-40 cursor-not-allowed bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600' : selectedMood === mood ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                            {t?.[MOOD_TO_NAMEKEY[mood]] || mood}{moodCaution && !moodBlocked && <span className="ml-1 text-[9px] text-amber-500 font-bold">실험적</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 시점 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.pov_label || "시점"} *</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ v: 'first_person', l: t?.pov_first_person || '내가 직접 말하기' }, { v: 'third_limited', l: t?.pov_third_limited || '옆에서 지켜보기' }, { v: 'omniscient', l: t?.pov_omniscient || '전지적 시점' }].map(p => {
                        const moodShort = MOOD_SHORT_KEYS[selectedMood] || selectedMood || '';
                        const povBlocked = (GUARD_RAIL_POV_BLOCKED[moodShort] || []).includes(p.v);
                        const povCaution = !povBlocked && (GUARD_RAIL_POV_CAUTION[moodShort] || []).includes(p.v);
                        return (
                          <button key={p.v}
                            onClick={() => !povBlocked && setSelectedPOV(p.v)}
                            disabled={povBlocked}
                            title={povBlocked ? '이 분위기에는 어울리지 않습니다' : povCaution ? '실험적 조합입니다' : undefined}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${povBlocked ? 'opacity-40 cursor-not-allowed bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600' : selectedPOV === p.v ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                            {p.l}{povCaution && <span className="ml-1 text-[9px] text-amber-500 font-bold">실험적</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 말투 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.speech_tone_label || "말투"} *</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ v: 'friendly', l: t?.speech_tone_friendly || '친근한' }, { v: 'formal', l: t?.speech_tone_formal || '단정한' }, { v: 'polite', l: t?.speech_tone_polite || '정중한' }].map(s => {
                        const moodShort = MOOD_SHORT_KEYS[selectedMood] || selectedMood || '';
                        const toneBlocked = (GUARD_RAIL_TONE_BLOCKED[moodShort] || []).includes(s.v);
                        const toneCaution = !toneBlocked && (GUARD_RAIL_TONE_CAUTION[moodShort] || []).includes(s.v);
                        return (
                          <button key={s.v}
                            onClick={() => !toneBlocked && setSelectedSpeechTone(s.v)}
                            disabled={toneBlocked}
                            title={toneBlocked ? '이 분위기에는 어울리지 않습니다' : toneCaution ? '실험적 조합입니다' : undefined}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${toneBlocked ? 'opacity-40 cursor-not-allowed bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600' : selectedSpeechTone === s.v ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                            {s.l}{toneCaution && <span className="ml-1 text-[9px] text-amber-500 font-bold">실험적</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. 폰트 */}
              {selectedGenre && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t?.select_font || "본문 폰트"}</label>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {BOOK_FONTS.map(f => (
                      <button key={f.id} onClick={() => setSelectedFont(f.id)}
                        className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${selectedFont === f.id ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
                        style={{ fontFamily: f.family }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. 결말 스타일 (시리즈 제외, 칩 버튼) */}
              {selectedCategory.isNovel && selectedCategory.id !== 'series' && selectedGenre && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t?.ending_style || "결말 스타일"}</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setEndingStyle('')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${!endingStyle ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'}`}>
                      {t?.no_select || "선택 안 함"}
                    </button>
                    {endingStyleIds.map((item) => (
                      <button key={item.id} onClick={() => setEndingStyle(item.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${endingStyle === item.value ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                        {t?.['ending_' + item.id] || item.value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. 생성 전 요약 카드 */}
              {canGenerateNovel && (
                <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl p-4 border border-orange-200 dark:border-orange-800/30">
                  <p className="text-[10px] font-bold text-orange-500 mb-2">{t?.summary_before_create || '생성 요약'}</p>
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p>📂 {t?.[`cat_${selectedCategory.id}`] || selectedCategory.name} {'>'} {t?.['genre_' + selectedGenre?.id?.replace(/-/g, '_')] || selectedGenre?.name}</p>
                    <p>📝 "{bookTitle}" · {keywords || '-'}</p>
                    <p>🎭 {t?.[MOOD_TO_NAMEKEY[selectedMood]] || selectedMood || '-'} · {selectedPOV === 'first_person' ? '1인칭' : selectedPOV === 'third_limited' ? '3인칭' : selectedPOV === 'omniscient' ? '전지적' : '-'} · {selectedSpeechTone === 'friendly' ? '친근' : selectedSpeechTone === 'formal' ? '단정' : selectedSpeechTone === 'polite' ? '정중' : '-'}</p>
                    {endingStyle && <p>🔚 {endingStyle}</p>}
                    <p>✏️ {BOOK_FONTS.find(f => f.id === selectedFont)?.label || '기본'}</p>
                  </div>
                </div>
              )}

              {/* 생성 버튼 */}
              {canGenerateNovel && (
                <button
                  onClick={handleNovelGenerate}
                  disabled={isGenerating}
                  className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 ${!isGenerating
                    ? 'bg-orange-500 hover:bg-orange-600 active:scale-95'
                    : 'bg-slate-300 cursor-not-allowed'
                    }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{t?.writing_now || '책을 쓰고 있어요...'}</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-5 h-5" />
                      <span>{requiresPaidWrite ? (t?.ad_write_create || '광고 보고 추가 집필') : (t?.create_book || '책 생성하기')}</span>
                    </>
                  )}
                </button>
              )}
              {generatingNoticeJSX}
            </>
          )}
        </div>
      )}

      {showPaidWriteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <Video className="w-12 h-12 text-blue-500 mx-auto" />
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                {t?.extra_write_title || "추가 집필"}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t?.extra_write_desc_2 || "하루 무료 횟수를 사용했습니다."}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-bold">
                <span className="text-blue-500">{t?.ad_write_required || "추가 집필은 광고를 시청해야 가능합니다."}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleWatchAdForWrite}
                className="w-full bg-blue-500 text-white py-3 rounded-xl font-black hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Video className="w-5 h-5" />
                {t?.ad_write_free || "광고 보고 집필하기"}
              </button>
              <button
                onClick={closePaidWriteConfirm}
                className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {t?.cancel || "취소(안함)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoWritesNotice && remainingDailyWrites === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <PenTool className="w-12 h-12 text-orange-500 mx-auto" />
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                {t?.write_limit_title || "오늘은 집필이 끝났어요"}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t?.write_limit_desc || "하루 집필 가능 횟수(2회)를 모두 사용했습니다."}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t?.write_limit_reset_time || "내일 다시 집필할 수 있어요."}
              </p>
            </div>
            <button
              onClick={() => setShowNoWritesNotice(false)}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-black"
            >
              {t?.confirm || "확인"}
            </button>
          </div>
        </div>
      )}

      {/* 키워드 새로고침 선택 모달 */}
      {
        showKeywordRefreshModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin-slow" />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t?.keyword_refresh_title || "키워드 새로고침"}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t?.keyword_refresh_desc || "새로운 키워드 5개를 받아보세요."}
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleAdRefresh}
                  className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Video className="w-5 h-5" />
                  {t?.refresh_ad_btn || "광고 보고 무료로 받기"}
                </button>
                <button
                  onClick={handleInkRefresh}
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Droplets className="w-4 h-4 text-blue-500" />
                  {t?.refresh_ink_btn || "잉크 1개 사용하기"}
                </button>
                <button
                  onClick={() => setShowKeywordRefreshModal(false)}
                  className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  {t?.refresh_cancel || "취소"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 에러 메시지 */}
      {
        displayError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center animate-in fade-in">
            <p className="text-red-600 dark:text-red-400 text-sm font-bold">{displayError}</p>
            <button
              onClick={() => {
                setLocalError(null);
                if (setError) setError(null);
              }}
              className="mt-2 text-xs text-red-400 hover:text-red-600 underline"
            >
              닫기
            </button>
          </div>
        )
      }

      {/* 안내 메시지 */}
      {
        !selectedCategory && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 text-center">
            <img src="/icons/odok_waving.png" alt="" className="w-20 h-20 mx-auto mb-2" />
            <p className="text-slate-600 dark:text-slate-300 text-sm font-bold">
              {t?.select_category_plz || "위에서 카테고리를 선택해주세요"}
            </p>
          </div>
        )
      }
        </>
      )}
    </div >
  );
};

export default WriteView;
