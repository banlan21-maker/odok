// src/components/WriteView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { PenTool, RefreshCw, Book, Edit2, Lock } from 'lucide-react';
import { generateBook } from '../utils/aiService';

// 비문학 카테고리별 추천 주제 (Topic) - 레벨 요구사항 포함
const recommendedTopics = {
  essay: [
    { text: "지친 하루의 위로", requiredLevel: 1 },
    { text: "나를 찾아 떠나는 여행", requiredLevel: 1 },
    { text: "새벽 감성", requiredLevel: 1 },
    { text: "복잡한 인간관계", requiredLevel: 5 },
    { text: "소확행", requiredLevel: 1 },
    { text: "추억 회상", requiredLevel: 10 }
  ],
  'self-help': [
    { text: "갓생 살기 루틴", requiredLevel: 1 },
    { text: "부자 되는 마인드셋", requiredLevel: 1 },
    { text: "말하기의 기술", requiredLevel: 1 },
    { text: "강철 멘탈 만들기", requiredLevel: 5 },
    { text: "효율적인 시간관리", requiredLevel: 1 },
    { text: "습관 형성하기", requiredLevel: 10 }
  ],
  humanities: [
    { text: "삶의 의미란 무엇인가", requiredLevel: 1 },
    { text: "역사 속 그날의 진실", requiredLevel: 1 },
    { text: "내 마음 심리학", requiredLevel: 1 },
    { text: "예술과 낭만", requiredLevel: 5 },
    { text: "고전의 지혜", requiredLevel: 10 },
    { text: "인간 이해하기", requiredLevel: 1 }
  ]
};

// 소설류 장르 (웹소설/소설/시리즈 공통)
const novelGenres = [
  { id: 'romance', name: '로맨스' },
  { id: 'fantasy', name: '판타지' },
  { id: 'mystery', name: '미스터리' },
  { id: 'drama', name: '드라마' },
  { id: 'sf', name: 'SF' },
  { id: 'thriller', name: '스릴러' }
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

const WriteView = ({ user, userProfile, onBookGenerated, slotStatus, setView, setSelectedBook, error, setError }) => {
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
  const [isCustomInput, setIsCustomInput] = useState(false); // 직접 입력 모드
  const [isGenerating, setIsGenerating] = useState(false);
  const cancelRequestedRef = useRef(false);
  const [localError, setLocalError] = useState(null);

  const displayError = error || localError;
  
  // 유저 레벨 변수 정의 (레벨 잠금 로직용)
  const userLevel = userProfile?.level || 1;

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
    setIsCustomInput(false);
    setLocalError(null);
    if (setError) setError(null);
  };

  // 비문학 주제 선택
  const handleTopicSelect = (topicObj) => {
    // 안전성 체크
    if (!selectedCategory) {
      console.error('selectedCategory가 없습니다.');
      return;
    }
    
    // topicObj 안전 처리
    let topicText = '';
    let requiredLevel = 1;
    
    if (typeof topicObj === 'string') {
      topicText = topicObj;
    } else if (topicObj && typeof topicObj === 'object') {
      topicText = topicObj.text || '';
      requiredLevel = topicObj.requiredLevel || 1;
    } else {
      console.error('유효하지 않은 topicObj:', topicObj);
      setLocalError('주제 선택에 오류가 발생했습니다.');
      if (setError) setError('주제 선택에 오류가 발생했습니다.');
      return;
    }
    
    if (!topicText) {
      console.error('topicText가 비어있습니다.');
      setLocalError('주제를 선택해주세요.');
      if (setError) setError('주제를 선택해주세요.');
      return;
    }

    // 레벨 체크
    if (userLevel < requiredLevel) {
      setLocalError(`레벨 ${requiredLevel} 달성 시 열립니다!`);
      if (setError) setError(`레벨 ${requiredLevel} 달성 시 열립니다!`);
      return;
    }

    setSelectedTopic(topicText);
    setLocalError(null);
    if (setError) setError(null);
  };

  // 비문학 생성 핸들러
  const handleNonfictionGenerate = async () => {
    if (!selectedCategory || selectedCategory.isNovel || !selectedTopic || !bookTitle.trim() || isGenerating) {
      return;
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
        title: bookTitle.trim()
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
        });
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

  // 소설류 생성 핸들러
  const handleNovelGenerate = async () => {
    if (!selectedCategory || !selectedGenre || !keywords.trim() || !bookTitle.trim() || isGenerating) {
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
        title: bookTitle.trim()
      });

      if (cancelRequestedRef.current) return;

      if (onBookGenerated) {
        onBookGenerated({
          ...result,
          category: selectedCategory.id === 'series' ? 'series' : selectedCategory.id,
          subCategory: selectedGenre.id,
          isSeries: selectedCategory.id === 'series',
          keywords: keywords.trim()
        });
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
    <div className="mt-4 border-2 border-orange-200 bg-orange-50 rounded-2xl p-4 text-center space-y-3">
      <p className="text-xs text-slate-600">
        뒤로가기 또는 다른 작업을 하면 집필이 취소될 수 있어요.
      </p>
      <button
        onClick={handleCancelGenerate}
        className="px-4 py-2 rounded-xl text-xs font-black bg-white border border-orange-300 text-orange-600 hover:bg-orange-100"
      >
        집필 취소
      </button>
    </div>
  );

  // 생성 가능 여부 확인
  const canGenerateNovel = selectedCategory && 
    selectedGenre && 
    (selectedCategory.id !== 'series' || seriesSubType) && // 시리즈는 세부 타입도 선택 필요
    bookTitle.trim().length > 0 &&
    keywords.trim().length > 0 &&
    isSlotAvailable(selectedCategory.id);

  const canGenerateNonfiction = selectedCategory &&
    !selectedCategory.isNovel &&
    selectedTopic &&
    bookTitle.trim().length > 0 &&
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
                <h3 className="text-base font-black text-slate-800">
                  어떤 이야기를 쓰고 싶으신가요?
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recommendedTopics[selectedCategory.id]?.map((topicObj, index) => {
                    const topicText = typeof topicObj === 'string' ? topicObj : topicObj.text;
                    const requiredLevel = typeof topicObj === 'object' ? topicObj.requiredLevel : 1;
                    const isLocked = userLevel < requiredLevel;
                    const isSelected = selectedTopic === topicText;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (isLocked) {
                            setLocalError(`레벨 ${requiredLevel} 달성 시 열립니다!`);
                            if (setError) setError(`레벨 ${requiredLevel} 달성 시 열립니다!`);
                            return;
                          }
                          handleTopicSelect(topicObj);
                        }}
                        disabled={isGenerating || !isSlotAvailable(selectedCategory.id) || isLocked}
                        className={`px-4 py-3 rounded-full text-sm font-bold transition-all relative ${
                          isGenerating || !isSlotAvailable(selectedCategory.id) || isLocked
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed grayscale'
                            : isSelected
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                        }`}
                      >
                        {isLocked && (
                          <div className="absolute -top-1 -right-1">
                            <Lock className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <span className={isLocked ? 'opacity-60' : ''}>{topicText}</span>
                        {isLocked && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Lv.{requiredLevel} 필요
                          </span>
                        )}
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
                      <span>책 생성하기</span>
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
                    {novelGenres.map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => setSelectedGenre(genre)}
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
                      <span>책 생성하기</span>
                    </>
                  )}
                </button>
              )}
              {isGenerating && <GeneratingNotice />}
            </>
          )}
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
