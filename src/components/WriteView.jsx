// src/components/WriteView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PenTool, RefreshCw, Book, Edit2, Lock, Droplets, Video, Check, X } from 'lucide-react';
import { generateBook } from '../utils/aiService';
import { getExtraWriteInkCost, isKeywordRefreshFree, getLevelFromXp } from '../utils/levelUtils';
import { showRewardVideoAd } from '../utils/admobService';
import { BOOK_FONTS } from '../utils/fontOptions';

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

// 시리즈 세부 장르 (웹소설형 vs 일반소설형)
const seriesSubTypes = [
  { id: 'webnovel', name: '웹소설형', description: '연재 웹소설 스타일' },
  { id: 'novel', name: '일반소설형', description: '전통 소설 스타일' }
];

const WriteView = ({ user, userProfile, t, onBookGenerated, slotStatus, setView, setSelectedBook, error, setError, deductInk, onGeneratingChange, onGenerationComplete, authorProfiles = {} }) => {
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
  const [selectedMood, setSelectedMood] = useState(''); // 소설 분위기
  const [selectedPOV, setSelectedPOV] = useState(''); // 소설 시점 (누가 이야기하나요)
  const [selectedSpeechTone, setSelectedSpeechTone] = useState(''); // 소설 말투/문체
  const [selectedDialogueRatio, setSelectedDialogueRatio] = useState(''); // 대화 비중
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
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('');
  const [currentLoadingMessages, setCurrentLoadingMessages] = useState([]);
  const [isAdWatched, setIsAdWatched] = useState(false); // 광고 시청 완료 상태 추가
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

  const todayKey = getTodayKey();
  const lastWriteDate = userProfile?.lastBookCreatedDate || null;
  const dailyWriteCount = userProfile?.dailyWriteCount || 0;
  const effectiveWriteCount = lastWriteDate === todayKey ? dailyWriteCount : 0;
  const remainingDailyWrites = Math.max(0, DAILY_WRITE_LIMIT - effectiveWriteCount);
  const requiresPaidWrite = effectiveWriteCount >= DAILY_FREE_WRITES;

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
    return getSlotStatus(categoryId, subCategoryId) === null;
  };

  const isSeriesCategoryAvailable = () => isSlotAvailable('series');

  // 카테고리 선택 핸들러
  const handleCategorySelect = (category) => {
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
      // 일반 카테고리는 슬롯이 차있으면 차단
      if (!isSlotAvailable(category.id)) {
        const slotInfo = getSlotStatus(category.id);
        if (slotInfo?.book && setSelectedBook && setView) {
          setSelectedBook(slotInfo.book);
          setView('book_detail');
        }
        return;
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

  const confirmPaidWrite = async () => {
    const type = pendingPaidWriteType;
    closePaidWriteConfirm();
    if (type === 'nonfiction') {
      await startNonfictionGenerate(true); // forcePaid = true
    } else if (type === 'novel') {
      await startNovelGenerate(true); // forcePaid = true
    }
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
        // setPendingPaidWriteType(null); // 타입 초기화는 로직 실행 후나 모달 닫을 때 (여기선 닫힘)
      };

      proceed();
    }
  }, [isAdWatched, pendingPaidWriteType]);

  const handleWatchAdForWrite = async () => {
    showRewardVideoAd(
      async () => {
        // 광고 시청 보상: 무료 집필 (잉크 차감 없이 진행)
        console.log('🎉 광고 시청 완료! 무료 집필 플래그 설정');
        closePaidWriteConfirm();
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

    if (remainingDailyWrites <= 0) {
      const errorMsg = '하루에 최대 2회까지만 집필할 수 있어요.';
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    if (requiresPaidWrite && !forcePaid && !isAdReward) {
      openPaidWriteConfirm('nonfiction');
      return;
    }

    if (requiresPaidWrite && forcePaid && !isAdReward) {
      const extraCost = getExtraWriteInkCost(getLevelFromXp(userProfile?.xp ?? 0));
      const currentInk = userProfile?.ink || 0;
      if (currentInk < extraCost) {
        const errorMsg = '잉크가 부족합니다! 💧 잉크를 충전해주세요.';
        setLocalError(errorMsg);
        if (setError) setError(errorMsg);
        return;
      }
      if (typeof deductInk !== 'function') {
        setLocalError('잉크 차감 기능을 사용할 수 없습니다.');
        if (setError) setError('잉크 차감 기능을 사용할 수 없습니다.');
        return;
      }
      const success = await deductInk(extraCost);
      if (!success) {
        setLocalError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        if (setError) setError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        return;
      }
    }

    // 슬롯 확인
    if (!isSlotAvailable(selectedCategory.id)) {
      const slotInfo = getSlotStatus(selectedCategory.id);
      const slotAuthor = slotInfo?.authorId ? (authorProfiles[slotInfo.authorId]?.nickname || '익명') : '익명';
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
        selectedTone: selectedTone
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
          fontFamily: selectedFont
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
        // 에러 메시지 추출 (Firebase Functions 에러 구조 고려)
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
    if (!selectedCategory || !selectedGenre || !keywords.trim() || !bookTitle.trim() || !selectedMood || !selectedPOV || !selectedSpeechTone || !selectedDialogueRatio || isGenerating) {
      return;
    }

    if (remainingDailyWrites <= 0) {
      const errorMsg = '하루에 최대 2회까지만 집필할 수 있어요.';
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    if (requiresPaidWrite && !forcePaid && !isAdReward) {
      openPaidWriteConfirm('novel');
      return;
    }

    if (requiresPaidWrite && forcePaid && !isAdReward) {
      const extraCost = getExtraWriteInkCost(getLevelFromXp(userProfile?.xp ?? 0));
      const currentInk = userProfile?.ink || 0;
      if (currentInk < extraCost) {
        const errorMsg = '잉크가 부족합니다! 💧 잉크를 충전해주세요.';
        setLocalError(errorMsg);
        if (setError) setError(errorMsg);
        return;
      }
      if (typeof deductInk !== 'function') {
        setLocalError('잉크 차감 기능을 사용할 수 없습니다.');
        if (setError) setError('잉크 차감 기능을 사용할 수 없습니다.');
        return;
      }
      const success = await deductInk(extraCost);
      if (!success) {
        setLocalError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        if (setError) setError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        return;
      }
    }

    // 슬롯 확인 (시리즈는 subCategory로 구분)
    let slotCheckCategoryId = selectedCategory.id;
    let slotCheckSubCategoryId = null;

    if (selectedCategory.id === 'series' && seriesSubType) {
      slotCheckSubCategoryId = seriesSubType.id; // 'webnovel' 또는 'novel'
    }

    if (!isSlotAvailable(slotCheckCategoryId, slotCheckSubCategoryId)) {
      const slotInfo = getSlotStatus(slotCheckCategoryId, slotCheckSubCategoryId);
      const slotAuthor = slotInfo?.authorId ? (authorProfiles[slotInfo.authorId]?.nickname || '익명') : '익명';
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
        subCategory: selectedGenre.id,
        genre: selectedGenre.name,
        keywords: keywords.trim(),
        isSeries: selectedCategory.id === 'series',
        endingStyle: endingStyleToSend,
        title: bookTitle.trim(),
        selectedMood: selectedMood,
        selectedPOV: selectedPOV,
        selectedSpeechTone: selectedSpeechTone,
        selectedDialogueRatio: selectedDialogueRatio
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
          fontFamily: selectedFont
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
        // 에러 메시지 추출 (Firebase Functions 에러 구조 고려)
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

  const GeneratingNotice = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200 font-bold">
          {t?.generating_title || "집필 중입니다..."}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t?.generating_desc || "책 생성에는 약 2~3분이 소요될 수 있어요."}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t?.generating_cancel_desc || "취소 후에 다른 작업을 진행할 수 있습니다."}
        </p>
        {currentLoadingMessage && (
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            {currentLoadingMessage}
          </p>
        )}
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
      </div>
    </div>
  );

  // 생성 가능 여부 확인
  const canGenerateNovel = selectedCategory &&
    selectedGenre &&
    (selectedCategory.id !== 'series' || seriesSubType) && // 시리즈는 세부 타입도 선택 필요
    bookTitle.trim().length > 0 &&
    keywords.trim().length > 0 &&
    remainingDailyWrites > 0 &&
    isSlotAvailable(selectedCategory.id);

  const canGenerateNonfiction = selectedCategory &&
    !selectedCategory.isNovel &&
    selectedTopic &&
    bookTitle.trim().length > 0 &&
    selectedTone &&
    remainingDailyWrites > 0 &&
    isSlotAvailable(selectedCategory.id);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in pb-20">
      {/* 헤더 */}
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
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
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-6">
          {/* 애니메이션 아이콘 */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <div className="absolute inset-0 bg-purple-100 dark:bg-purple-900/30 rounded-full animate-pulse" />
            <span className="text-6xl relative z-10">📖</span>
            <span className="absolute top-0 right-0 text-2xl animate-bounce" style={{ animationDuration: '1.5s' }}>✨</span>
            <span className="absolute bottom-0 left-1 text-xl animate-bounce" style={{ animationDuration: '2s', animationDelay: '0.3s' }}>🧚</span>
            <span className="absolute top-2 left-0 text-lg animate-bounce" style={{ animationDuration: '1.8s', animationDelay: '0.6s' }}>⭐</span>
          </div>

          {/* COMING SOON 뱃지 */}
          <div className="space-y-3">
            <span className="inline-block bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-black px-4 py-1.5 rounded-full tracking-widest">
              COMING SOON
            </span>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100 leading-snug">
              우리 아이가 주인공이 되는<br />마법 같은 시간
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              오독오독 동화공방이 곧 찾아옵니다! 🧚✨
            </p>
          </div>

          {/* 예정 기능 미리보기 */}
          <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-dashed border-purple-200 dark:border-purple-800 rounded-2xl p-5 space-y-3 text-left">
            <p className="text-xs font-black text-purple-400 dark:text-purple-500 text-center">✦ 준비 중인 기능 ✦</p>
            {[
              { icon: '🎨', text: '아이 이름으로 만드는 나만의 동화' },
              { icon: '🌈', text: '삽화와 함께하는 동화책 뷰어' },
              { icon: '📚', text: '소중한 동화 모아두는 보관함' },
              { icon: '🎁', text: 'PDF로 저장해 선물하기' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <span className="text-sm text-slate-600 dark:text-slate-300 font-bold">{text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
      {/* 1. 메인 카테고리 선택 (6개) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1">{t?.category_label || "카테고리 선택"}</h3>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => {
            const isSoldOut = category.id === 'series'
              ? !isSeriesCategoryAvailable()
              : getSlotStatus(category.id) !== null;
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
          {/* 비문학 카테고리 (에세이/자기계발/인문철학) - 주제 선택만 */}
          {!selectedCategory.isNovel && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                    {t?.what_story || "어떤 이야기를 쓰고 싶으신가요?"}
                  </h3>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onTouchStart={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRefreshKeywords();
                    }}
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
                        onClick={() => {
                          handleTopicSelect(item.ko);
                        }}
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
                      <span>{requiresPaidWrite ? (t?.use_ink_create || '잉크 {cost} 사용하고 집필').replace('{cost}', getExtraWriteInkCost(getLevelFromXp(userProfile?.xp ?? 0))) : (t?.create_book || '책 생성하기')}</span>
                    </>
                  )}
                </button>
              )}
              {isGenerating && !isGeneratingHidden && <GeneratingNotice />}
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
                    maxLength={50}
                  />
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold text-right">{keywords.length}/50</div>
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
                </div>
              )}

              {/* 3. 스타일 프리셋 (빠른 설정) */}
              {selectedGenre && selectedCategory?.isNovel && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t?.style_preset || "스타일"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setSelectedMood('tension'); setSelectedPOV('first_person'); setSelectedSpeechTone('friendly'); setSelectedDialogueRatio('dialogue_heavy'); }}
                      className={`py-2.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all text-center ${
                        selectedPOV === 'first_person' && selectedSpeechTone === 'friendly' && selectedDialogueRatio === 'dialogue_heavy'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      📱 {t?.preset_webnovel || '웹소설풍'}
                      <p className="text-[9px] font-normal text-slate-400 mt-0.5">1인칭·친근·대화중심</p>
                    </button>
                    <button
                      onClick={() => { setSelectedMood('lyrical'); setSelectedPOV('third_limited'); setSelectedSpeechTone('formal'); setSelectedDialogueRatio('description_heavy'); }}
                      className={`py-2.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all text-center ${
                        selectedPOV === 'third_limited' && selectedSpeechTone === 'formal' && selectedDialogueRatio === 'description_heavy'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      📖 {t?.preset_literary || '문학 소설'}
                      <p className="text-[9px] font-normal text-slate-400 mt-0.5">3인칭·단정·묘사중심</p>
                    </button>
                    <button
                      onClick={() => { setSelectedMood(''); setSelectedPOV(''); setSelectedSpeechTone(''); setSelectedDialogueRatio(''); }}
                      className={`py-2.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all text-center ${
                        !selectedPOV && !selectedSpeechTone && !selectedDialogueRatio
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      ⚙️ {t?.preset_custom || '직접 설정'}
                      <p className="text-[9px] font-normal text-slate-400 mt-0.5">하나씩 선택</p>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. 직접 설정 모드 — 칩 버튼 */}
              {selectedGenre && selectedCategory?.isNovel && !selectedPOV && !selectedSpeechTone && !selectedDialogueRatio && (
                <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                  {/* 분위기 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.mood_label || "분위기"} *</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getMoodOptions().map((mood) => (
                        <button key={mood} onClick={() => setSelectedMood(mood)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedMood === mood ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                          {t?.[MOOD_TO_NAMEKEY[mood]] || mood}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 시점 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.pov_label || "시점"} *</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ v: 'first_person', l: t?.pov_first_person || '내가 직접 말하기' }, { v: 'third_limited', l: t?.pov_third_limited || '옆에서 지켜보기' }, { v: 'omniscient', l: t?.pov_omniscient || '전지적 시점' }].map(p => (
                        <button key={p.v} onClick={() => setSelectedPOV(p.v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedPOV === p.v ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                          {p.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 말투 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.speech_tone_label || "말투"} *</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ v: 'friendly', l: t?.speech_tone_friendly || '친근한' }, { v: 'formal', l: t?.speech_tone_formal || '단정한' }, { v: 'polite', l: t?.speech_tone_polite || '정중한' }].map(s => (
                        <button key={s.v} onClick={() => setSelectedSpeechTone(s.v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedSpeechTone === s.v ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 대화 비중 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.dialogue_ratio_label || "대화 비중"} *</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ v: 'dialogue_heavy', l: t?.dialogue_ratio_heavy || '대화 중심' }, { v: 'description_heavy', l: t?.dialogue_ratio_desc || '묘사 중심' }].map(d => (
                        <button key={d.v} onClick={() => setSelectedDialogueRatio(d.v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedDialogueRatio === d.v ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                          {d.l}
                        </button>
                      ))}
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
                      <span>{requiresPaidWrite ? (t?.use_ink_create || '잉크 {cost} 사용하고 집필').replace('{cost}', getExtraWriteInkCost(getLevelFromXp(userProfile?.xp ?? 0))) : (t?.create_book || '책 생성하기')}</span>
                    </>
                  )}
                </button>
              )}
              {isGenerating && !isGeneratingHidden && <GeneratingNotice />}
            </>
          )}
        </div>
      )}

      {showPaidWriteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <Droplets className="w-12 h-12 text-orange-500 mx-auto" />
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                {t?.extra_write_title || "추가 집필"}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t?.extra_write_desc_2 || "하루 무료 횟수를 사용했습니다."}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-bold">
                <span className="text-orange-500">{(t?.extra_write_confirm || "{cost} 잉크를 사용하여 집필하시겠습니까?").replace('{cost}', getExtraWriteInkCost(getLevelFromXp(userProfile?.xp ?? 0)) + ' 잉크')}</span>
              </p>
              <div className="pt-2">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {(t?.current_hold || "현재 보유: {ink} 잉크").replace('{ink}', userProfile?.ink || 0)}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleWatchAdForWrite}
                className="w-full bg-blue-500 text-white py-3 rounded-xl font-black hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Video className="w-5 h-5" />
                {t?.ad_write_free || "광고 보고 무료로 0.3초 집필"}
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-600"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-slate-400 dark:text-slate-500 font-bold">{t?.or || "또는"}</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-600"></div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={closePaidWriteConfirm}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {t?.cancel || "취소(안함)"}
                </button>
                <button
                  onClick={confirmPaidWrite}
                  className="flex-[2] bg-orange-100 text-orange-600 border border-orange-200 py-3 rounded-xl font-bold hover:bg-orange-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Droplets className="w-4 h-4" />
                  {(t?.use_ink_btn || "잉크 {cost}개 쓰기").replace('{cost}', getExtraWriteInkCost(getLevelFromXp(userProfile?.xp ?? 0)))}
                </button>
              </div>
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
            <Book className="w-12 h-12 text-orange-400 mx-auto mb-3" />
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
