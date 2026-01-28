// src/components/WriteView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { PenTool, RefreshCw, Book, Edit2, Lock, Droplets } from 'lucide-react';
import { generateBook } from '../utils/aiService';

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

const NONFICTION_KEYWORD_BANKS = {
  essay: ESSAY_KEYWORDS,
  'self-help': SELF_HELP_KEYWORDS,
  humanities: PHILOSOPHY_KEYWORDS
};

const NONFICTION_TONE_OPTIONS = {
  essay: ['담백한/건조한', '감성적인/시적인', '유머러스한/위트있는', '친근한/구어체'],
  'self-help': ['따뜻한 위로/격려', '강한 동기부여/독설', '논리적인/분석적인', '경험담 위주'],
  humanities: ['질문을 던지는/사색적인', '날카로운 비판', '대화 형식/인터뷰', '쉬운 해설/스토리텔링']
};

const DAILY_WRITE_LIMIT = 2;
const DAILY_FREE_WRITES = 1;
const EXTRA_WRITE_INK_COST = 5;

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

const endingStyles = [
  '닫힌 결말 (해피 엔딩)',
  '닫힌 결말 (비극/새드 엔딩)',
  '열린 결말 (여운을 남김)',
  '반전 결말 (충격적인 반전)',
  '수미상관 (처음과 끝이 연결됨)'
];

const WriteView = ({ user, userProfile, onBookGenerated, slotStatus, setView, setSelectedBook, error, setError, deductInk }) => {
  // 메인 카테고리 목록 (6개)
  const categories = [
    { id: 'webnovel', name: '웹소설', icon: '📱', isNovel: true, isSingle: true },
    { id: 'novel', name: '소설', icon: '📖', isNovel: true, isSingle: true },
    { id: 'series', name: '시리즈', icon: '📚', isNovel: true, isSingle: false },
    { id: 'essay', name: '에세이', icon: '✍️', isNovel: false },
    { id: 'self-help', name: '자기계발', icon: '🌟', isNovel: false },
    { id: 'humanities', name: '인문·철학', icon: '💭', isNovel: false }
  ];

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null); // 소설류 장르
  const [seriesSubType, setSeriesSubType] = useState(null); // 시리즈의 웹소설형/일반소설형
  const [selectedTopic, setSelectedTopic] = useState(null); // 비문학 주제
  const [keywords, setKeywords] = useState(''); // 소설류 키워드
  const [bookTitle, setBookTitle] = useState(''); // 사용자 입력 제목
  const [endingStyle, setEndingStyle] = useState(''); // 소설 결말 스타일
  const [selectedTone, setSelectedTone] = useState(''); // 비문학 문체
  const [selectedMood, setSelectedMood] = useState(''); // 소설 분위기
  const [isCustomInput, setIsCustomInput] = useState(false); // 직접 입력 모드
  const [isGenerating, setIsGenerating] = useState(false);
  const [nonfictionTopics, setNonfictionTopics] = useState([]);
  const [isRefreshingKeywords, setIsRefreshingKeywords] = useState(false);
  const [showPaidWriteConfirm, setShowPaidWriteConfirm] = useState(false);
  const [pendingPaidWriteType, setPendingPaidWriteType] = useState(null);
  const [showNoWritesNotice, setShowNoWritesNotice] = useState(false);
  const cancelRequestedRef = useRef(false);
  const [localError, setLocalError] = useState(null);

  const displayError = error || localError;
  
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
    return pickKeywords(bank, 10, `${categoryId}-${getTodayKey()}`);
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

  const getMoodOptions = () => {
    if (!selectedCategory || !selectedGenre) return [];
    const isWebNovel = selectedCategory.id === 'webnovel'
      || (selectedCategory.id === 'series' && seriesSubType?.id === 'webnovel');
    const isGeneralNovel = selectedCategory.id === 'novel'
      || (selectedCategory.id === 'series' && seriesSubType?.id === 'novel');

    if (isWebNovel) {
      if (['판타지', '현대 판타지', '무협', 'SF'].includes(selectedGenre.name)) {
        return NOVEL_MOOD_OPTIONS.webnovel.Action;
      }
      if (['로맨스', '로맨스 판타지'].includes(selectedGenre.name)) {
        return NOVEL_MOOD_OPTIONS.webnovel.Romance;
      }
      if (['미스터리/공포'].includes(selectedGenre.name)) {
        return NOVEL_MOOD_OPTIONS.webnovel.Thriller;
      }
    }

    if (isGeneralNovel) {
      if (['드라마', '역사', '힐링'].includes(selectedGenre.name)) {
        return NOVEL_MOOD_OPTIONS.novel.Drama;
      }
      if (['로맨스'].includes(selectedGenre.name)) {
        return NOVEL_MOOD_OPTIONS.novel.Romance;
      }
      if (['미스터리/추리', '스릴러', 'SF'].includes(selectedGenre.name)) {
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

  // 슬롯 상태 확인 (시리즈는 웹소설형/소설형 분리)
  const getSlotStatus = (categoryId, subCategoryId = null) => {
    // 시리즈의 경우 subCategory로 구분
    if (categoryId === 'series' && subCategoryId) {
      const normalizedSubCategory = String(subCategoryId || '').trim().toLowerCase();
      const seriesSlotKey = (normalizedSubCategory === 'webnovel' || normalizedSubCategory === 'web-novel')
        ? 'series-webnovel'
        : 'series-novel';
      return slotStatus?.[seriesSlotKey] || null;
    }
    return slotStatus?.[categoryId] || null;
  };

  const isSlotAvailable = (categoryId, subCategoryId = null) => {
    return getSlotStatus(categoryId, subCategoryId) === null;
  };
  
  // 시리즈 카테고리의 경우 두 슬롯 중 하나라도 사용 가능하면 활성화
  const isSeriesCategoryAvailable = () => {
    return isSlotAvailable('series', 'webnovel') || isSlotAvailable('series', 'novel');
  };

  // 카테고리 선택 핸들러
  const handleCategorySelect = (category) => {
    // 시리즈의 경우 두 슬롯 중 하나라도 사용 가능하면 진입 가능
    if (category.id === 'series') {
      if (!isSeriesCategoryAvailable()) {
        // 두 슬롯 모두 마감
        const webnovelSlot = getSlotStatus('series', 'webnovel');
        const novelSlot = getSlotStatus('series', 'novel');
        const soldOutBook = webnovelSlot?.book || novelSlot?.book;
        if (soldOutBook && setSelectedBook && setView) {
          setSelectedBook(soldOutBook);
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

  const handleRefreshKeywords = async () => {
    if (!selectedCategory || selectedCategory.isNovel) return;
    if (!user) {
      setLocalError('로그인 후 사용할 수 있어요.');
      if (setError) setError('로그인 후 사용할 수 있어요.');
      return;
    }

    const currentInk = userProfile?.ink || 0;
    if (currentInk < 1) {
      setLocalError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
      if (setError) setError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
      return;
    }

    if (typeof deductInk !== 'function') {
      setLocalError('잉크 차감 기능을 사용할 수 없습니다.');
      if (setError) setError('잉크 차감 기능을 사용할 수 없습니다.');
      return;
    }

    setIsRefreshingKeywords(true);
    try {
      const success = await deductInk(1);
      if (!success) {
        setLocalError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        if (setError) setError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      const bank = NONFICTION_KEYWORD_BANKS[selectedCategory.id] || [];
      setNonfictionTopics(pickKeywords(bank, 10));
      setSelectedTopic(null);
      setBookTitle('');
    } finally {
      setIsRefreshingKeywords(false);
    }
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
      await startNonfictionGenerate(true);
    } else if (type === 'novel') {
      await startNovelGenerate(true);
    }
  };

  const startNonfictionGenerate = async (forcePaid = false) => {
    if (!selectedCategory || selectedCategory.isNovel || !selectedTopic || !bookTitle.trim() || !selectedTone || isGenerating) {
      return;
    }

    if (remainingDailyWrites <= 0) {
      const errorMsg = '하루에 최대 2회까지만 집필할 수 있어요.';
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    if (requiresPaidWrite && !forcePaid) {
      openPaidWriteConfirm('nonfiction');
      return;
    }

    if (requiresPaidWrite && forcePaid) {
      const currentInk = userProfile?.ink || 0;
      if (currentInk < EXTRA_WRITE_INK_COST) {
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
      const success = await deductInk(EXTRA_WRITE_INK_COST);
      if (!success) {
        setLocalError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        if (setError) setError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        return;
      }
    }

    // 슬롯 확인
    if (!isSlotAvailable(selectedCategory.id)) {
      const slotInfo = getSlotStatus(selectedCategory.id);
      const errorMsg = `이미 오늘의 책이 발행되었습니다! (By. ${slotInfo?.authorName || '익명'}) 서재에서 읽어보세요.`;
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    cancelRequestedRef.current = false;
    setIsGenerating(true);
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
        onBookGenerated({
          ...result,
          category: selectedCategory.id,
          subCategory: null,
          isSeries: false,
          keywords: selectedTopic
        }, false, { skipDailyCheck: true });
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

  const startNovelGenerate = async (forcePaid = false) => {
    if (!selectedCategory || !selectedGenre || !keywords.trim() || !bookTitle.trim() || !selectedMood || isGenerating) {
      return;
    }

    if (remainingDailyWrites <= 0) {
      const errorMsg = '하루에 최대 2회까지만 집필할 수 있어요.';
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    if (requiresPaidWrite && !forcePaid) {
      openPaidWriteConfirm('novel');
      return;
    }

    if (requiresPaidWrite && forcePaid) {
      const currentInk = userProfile?.ink || 0;
      if (currentInk < EXTRA_WRITE_INK_COST) {
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
      const success = await deductInk(EXTRA_WRITE_INK_COST);
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
      const errorMsg = `이미 오늘의 책이 발행되었습니다! (By. ${slotInfo?.authorName || '익명'}) 서재에서 읽어보세요.`;
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return;
    }

    cancelRequestedRef.current = false;
    setIsGenerating(true);
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
        selectedMood: selectedMood
      });

      if (cancelRequestedRef.current) return;

      if (onBookGenerated) {
        onBookGenerated({
          ...result,
          category: selectedCategory.id === 'series' ? 'series' : selectedCategory.id,
          subCategory: selectedGenre.id,
          isSeries: selectedCategory.id === 'series',
          keywords: keywords.trim()
        }, false, { skipDailyCheck: true });
      }

      // 폼 초기화
      setSelectedCategory(null);
      setSelectedGenre(null);
      setSeriesSubType(null);
      setKeywords('');
      setBookTitle('');
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
  const handleCancelGenerate = () => {
    cancelRequestedRef.current = true;
    setIsGenerating(false);
    setLocalError('집필이 취소되었습니다.');
    if (setError) setError('집필이 취소되었습니다.');
  };

  const GeneratingNotice = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-700 font-bold">
          집필 중입니다…
        </p>
        <p className="text-xs text-slate-500">
          책 생성에는 약 2~3분이 소요될 수 있어요.
        </p>
        <p className="text-xs text-slate-400">
          취소 후에 다른 작업을 진행할 수 있습니다.
        </p>
        <button
          onClick={handleCancelGenerate}
          className="w-full py-3 rounded-xl text-sm font-black bg-white border border-orange-300 text-orange-600 hover:bg-orange-100"
        >
          집필 취소
        </button>
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
        <h2 className="text-2xl font-black text-slate-800 leading-tight">
          집필
        </h2>
        <p className="text-sm text-slate-500">
          원하는 장르를 선택하고 주제를 입력하면<br/>
          AI가 당신만의 책을 만들어줍니다.
        </p>
      </div>

      {/* 1. 메인 카테고리 선택 (6개) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 px-1">카테고리 선택</h3>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => {
            // 시리즈는 두 슬롯 모두 마감되었는지 확인
            const isSoldOut = category.id === 'series' 
              ? !isSeriesCategoryAvailable()
              : getSlotStatus(category.id) !== null;
            const slotInfo = category.id === 'series'
              ? (getSlotStatus('series', 'webnovel') || getSlotStatus('series', 'novel'))
              : getSlotStatus(category.id);

            return (
              <button
                key={category.id}
                disabled={isSoldOut}
                onClick={() => handleCategorySelect(category)}
                className={`p-4 rounded-2xl border-2 shadow-sm transition-all text-center relative ${
                  isSoldOut
                    ? 'bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed'
                    : selectedCategory?.id === category.id
                    ? 'border-orange-500 bg-orange-50 active:scale-95'
                    : 'bg-white border-slate-100 hover:border-orange-200 active:scale-95'
                }`}
              >
                {isSoldOut && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <div className="text-3xl mb-2">{category.icon}</div>
                <h3 className="font-bold text-sm text-slate-800 mb-1">{category.name}</h3>
                {isSoldOut ? (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[10px] text-slate-500 font-bold line-clamp-1">
                      오늘의 {category.name} 마감
                    </p>
                    {slotInfo?.authorName && (
                      <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">
                        By. {slotInfo.authorName}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-orange-500 font-bold mt-1">집필하기</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 선택된 카테고리에 따른 폼 */}
      {selectedCategory && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          {/* 비문학 카테고리 (에세이/자기계발/인문철학) - 주제 선택만 */}
          {!selectedCategory.isNovel && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-black text-slate-800">
                    어떤 이야기를 쓰고 싶으신가요?
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
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                      isRefreshingKeywords || isGenerating || !isSlotAvailable(selectedCategory.id)
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                    }`}
                    title="키워드 새로고침 (잉크 1)"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshingKeywords ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {nonfictionTopics.map((topicText, index) => {
                    const isSelected = selectedTopic === topicText;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          handleTopicSelect(topicText);
                        }}
                        disabled={isGenerating || !isSlotAvailable(selectedCategory.id)}
                        className={`px-4 py-3 rounded-full text-sm font-bold transition-all relative ${
                          isGenerating || !isSlotAvailable(selectedCategory.id)
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : isSelected
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                        }`}
                      >
                        <span>{topicText}</span>
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
                  <label className="text-sm font-bold text-slate-700">
                    책 제목 <span className="text-orange-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      placeholder="15자 이내로 제목을 입력하세요"
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white outline-none transition-colors"
                      maxLength={15}
                    />
                    <div className="text-xs text-slate-400 font-bold text-right">
                      {bookTitle.length}/15
                    </div>
                  </div>
                </div>
              )}
              {selectedTopic && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    스타일 선택 <span className="text-orange-500">*</span>
                  </label>
                  <select
                    value={selectedTone}
                    onChange={(e) => setSelectedTone(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white outline-none transition-colors"
                  >
                    <option value="">스타일을 선택하세요</option>
                    {getToneOptions(selectedCategory.id).map((tone) => (
                      <option key={tone} value={tone}>
                        {tone}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {canGenerateNonfiction && (
                <button
                  onClick={handleNonfictionGenerate}
                  disabled={isGenerating}
                  className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                    !isGenerating
                      ? 'bg-orange-500 hover:bg-orange-600 active:scale-95'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>책을 쓰고 있어요...</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-5 h-5" />
                      <span>{requiresPaidWrite ? `잉크 ${EXTRA_WRITE_INK_COST} 사용하고 집필` : '책 생성하기'}</span>
                    </>
                  )}
                </button>
              )}
              {isGenerating && <GeneratingNotice />}
            </>
          )}

          {/* 소설류 카테고리 (웹소설/소설/시리즈) */}
          {selectedCategory.isNovel && (
            <>
              {/* 시리즈만: 웹소설형/일반소설형 선택 */}
              {selectedCategory.id === 'series' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    세부 장르 <span className="text-orange-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {seriesSubTypes.map((subType) => {
                      const isSlotAvailableForSubType = isSlotAvailable('series', subType.id);
                      const slotInfo = getSlotStatus('series', subType.id);
                      
                      return (
                        <button
                          key={subType.id}
                          onClick={() => {
                            if (!isSlotAvailableForSubType) {
                              if (slotInfo?.book && setSelectedBook && setView) {
                                setSelectedBook(slotInfo.book);
                                setView('book_detail');
                              }
                              return;
                            }
                            setSeriesSubType(subType);
                            setSelectedGenre(null);
                            setSelectedMood('');
                          }}
                          disabled={!isSlotAvailableForSubType}
                          className={`py-3 rounded-xl font-bold text-sm transition-all relative ${
                            !isSlotAvailableForSubType
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                              : seriesSubType?.id === subType.id
                              ? 'bg-orange-500 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {!isSlotAvailableForSubType && (
                            <div className="absolute top-1 right-1">
                              <Lock className="w-3 h-3 text-slate-400" />
                            </div>
                          )}
                          {subType.name}
                          {!isSlotAvailableForSubType && slotInfo?.authorName && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              By. {slotInfo.authorName}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 장르 선택 */}
              {selectedCategory.id !== 'series' || seriesSubType ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    장르 <span className="text-orange-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {getAvailableNovelGenres().map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => {
                          setSelectedGenre(genre);
                          setSelectedMood('');
                        }}
                        className={`py-2 px-3 rounded-xl font-bold text-sm transition-all ${
                          selectedGenre?.id === genre.id
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {genre.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 분위기 선택 */}
              {selectedGenre && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    분위기 <span className="text-orange-500">*</span>
                  </label>
                  <select
                    value={selectedMood}
                    onChange={(e) => setSelectedMood(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white outline-none transition-colors"
                  >
                    <option value="">분위기를 선택하세요</option>
                    {getMoodOptions().map((mood) => (
                      <option key={mood} value={mood}>
                        {mood}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 책 제목 */}
              {selectedGenre && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    책 제목 <span className="text-orange-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      placeholder="15자 이내로 제목을 입력하세요"
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white outline-none transition-colors"
                      maxLength={15}
                    />
                    <div className="text-xs text-slate-400 font-bold text-right">
                      {bookTitle.length}/15
                    </div>
                  </div>
                </div>
              )}

              {/* 키워드 선택 (장르 선택 후) */}
              {selectedGenre && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    주제 또는 키워드 <span className="text-orange-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="예: 가을 낙엽, 첫 사랑, 성장, 일상의 소중함..."
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white outline-none transition-colors"
                      maxLength={50}
                    />
                    <div className="text-xs text-slate-400 font-bold text-right">
                      {keywords.length}/50
                    </div>
                  </div>
                </div>
              )}

              {/* 결말 스타일 (소설류 전용) */}
              {selectedCategory.isNovel && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    결말 스타일
                  </label>
                  <select
                    value={endingStyle}
                    onChange={(e) => setEndingStyle(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm focus:border-orange-500 focus:bg-white outline-none transition-colors"
                  >
                    <option value="">선택 안 함</option>
                    {endingStyles.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 생성 버튼 */}
              {canGenerateNovel && (
                <button
                  onClick={handleNovelGenerate}
                  disabled={isGenerating}
                  className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                    !isGenerating
                      ? 'bg-orange-500 hover:bg-orange-600 active:scale-95'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>책을 쓰고 있어요...</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-5 h-5" />
                      <span>{requiresPaidWrite ? `잉크 ${EXTRA_WRITE_INK_COST} 사용하고 집필` : '책 생성하기'}</span>
                    </>
                  )}
                </button>
              )}
              {isGenerating && <GeneratingNotice />}
            </>
          )}
        </div>
      )}

      {showPaidWriteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <Droplets className="w-12 h-12 text-orange-500 mx-auto" />
              <h3 className="text-xl font-black text-slate-800">
                추가 집필
              </h3>
              <p className="text-sm text-slate-600">
                하루 무료 횟수를 사용했습니다.
              </p>
              <p className="text-sm text-slate-600 font-bold">
                <span className="text-orange-500">{EXTRA_WRITE_INK_COST} 잉크</span>를 사용하여 집필하시겠습니까?
              </p>
              <div className="pt-2">
                <p className="text-xs text-slate-400">
                  현재 보유: <span className="font-bold text-slate-600">{userProfile?.ink || 0} 잉크</span>
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={closePaidWriteConfirm}
                className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmPaidWrite}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-xs font-black hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <Droplets className="w-4 h-4" />
                잉크 {EXTRA_WRITE_INK_COST} 사용하고 집필
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoWritesNotice && remainingDailyWrites === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <PenTool className="w-12 h-12 text-orange-500 mx-auto" />
              <h3 className="text-xl font-black text-slate-800">
                오늘은 집필이 끝났어요
              </h3>
              <p className="text-sm text-slate-600">
                하루 집필 가능 횟수(2회)를 모두 사용했습니다.
              </p>
              <p className="text-xs text-slate-400">
                내일 다시 집필할 수 있어요.
              </p>
            </div>
            <button
              onClick={() => setShowNoWritesNotice(false)}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-black"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {displayError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center animate-in fade-in">
          <p className="text-red-600 text-sm font-bold">{displayError}</p>
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
      )}

      {/* 안내 메시지 */}
      {!selectedCategory && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center">
          <Book className="w-12 h-12 text-orange-400 mx-auto mb-3" />
          <p className="text-slate-600 text-sm font-bold">
            위에서 카테고리를 선택해주세요
          </p>
        </div>
      )}
    </div>
  );
};

export default WriteView;
