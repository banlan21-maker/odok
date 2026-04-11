// src/components/HomeView.jsx
// Step 3: 홈 탭 구현
import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Crown, Trophy, Star, Megaphone, User,
  ArrowRight, Medal, Book, Bell, Sparkles, ChevronLeft, ChevronRight, Calendar,
  Eye, Heart, Bookmark, CheckCircle, Clock
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { formatCount } from '../utils/numberFormat';
import { formatGenreTag } from '../utils/formatGenre';

// Skeleton UI 컴포넌트
const SkeletonCard = () => (
  <div className="w-32 shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 animate-pulse">
    <div className="w-full h-24 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2"></div>
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-1"></div>
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
  </div>
);

const SkeletonListItem = () => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 animate-pulse flex items-center gap-4">
    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg shrink-0"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
    </div>
  </div>
);

// ── 프리미엄 홍보 캐러셀 ────────────────────────────────────────
const PromoCarousel = ({ promotions, books, authorProfiles, handleBookClick, t }) => {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const items = promotions
    .map(promo => {
      const book = books.find(b => b.id === promo.bookId);
      if (!book) return null;
      return { promo, book };
    })
    .filter(Boolean);

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => setCurrent(p => (p + 1) % items.length), 5000);
    return () => clearInterval(timerRef.current);
  }, [items.length]);

  if (items.length === 0) return null;

  const getRemainingHours = (expiresAt) => {
    const exp = expiresAt?.toDate?.() || (expiresAt?.seconds ? new Date(expiresAt.seconds * 1000) : null);
    if (!exp) return '';
    const h = Math.max(0, Math.floor((exp - new Date()) / 3600000));
    return (t?.promo_time_remaining || '{hours}시간 남음').replace('{hours}', h);
  };

  return (
    <div className="space-y-2">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 px-1">
        <Megaphone className="w-5 h-5 text-violet-500" />
        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t?.promo_section_label || '프리미엄 홍보'}</h3>
        <span className="text-[10px] font-bold text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {/* 카드 */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ height: '230px' }}>
        {items.map(({ promo, book }, i) => {
          const cover = getCoverImageFromBook(book);
          const authorName = promo.authorNickname || (book?.isAnonymous ? '익명' : (authorProfiles[promo.authorId]?.nickname || book?.authorName || '익명'));
          const authorBio = promo.authorBio || authorProfiles[promo.authorId]?.bio || '';
          const authorImg = authorProfiles[promo.authorId]?.profileImageUrl || null;
          const remaining = getRemainingHours(promo.expiresAt);

          return (
            <div
              key={promo.id}
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: i === current ? 1 : 0, pointerEvents: i === current ? 'auto' : 'none' }}
            >
              {/* 블러 배경 */}
              {cover && (
                <img
                  src={cover}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: 'blur(14px)', transform: 'scale(1.18)' }}
                />
              )}
              {/* 그라데이션 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/55 to-black/80" />

              {/* 클릭 영역 */}
              <button
                className="absolute inset-0 w-full flex flex-col justify-between p-5 text-left"
                onClick={() => handleBookClick(book)}
              >
                {/* 상단: 작가 정보 */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30 shrink-0 bg-white/20">
                    {authorImg
                      ? <img src={authorImg} alt="" className="w-full h-full object-cover" />
                      : <span className="w-full h-full flex items-center justify-center text-sm">👤</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-xs leading-none">{authorName}</p>
                    {authorBio && <p className="text-white/55 text-[10px] mt-0.5 truncate">{authorBio}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] text-white/40">{remaining}</span>
                    <span className="text-[9px] font-bold text-violet-300 bg-violet-500/25 px-1.5 py-0.5 rounded-full">📢</span>
                  </div>
                </div>

                {/* 중앙: 홍보 문구 */}
                <div className="text-center px-4 py-1">
                  <p className="text-white text-xl font-black leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                    {promo.promoText}
                  </p>
                </div>

                {/* 하단: 책 정보 + 소개글 */}
                <div>
                  {promo.bookSummary && (
                    <p className="text-white/65 text-[11px] leading-relaxed line-clamp-2 mb-1.5">
                      {promo.bookSummary}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    {cover && <img src={cover} alt="" className="w-7 h-9 rounded object-cover shadow" />}
                    <p className="text-white font-black text-sm truncate">{book.title}</p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}

        {/* 슬라이드 인디케이터 */}
        {items.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); clearInterval(timerRef.current); }}
                className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const HomeView = ({
  userProfile,
  t,
  levelInfo,
  notices,
  setView,
  todayBooks,
  weeklyBestBooks,
  allTimeBestBooks = [],
  topWriters,
  isLoadingHomeData,
  handleBookClick,
  authorProfiles = {},
  promotions = [],
  books = [],
  onAuthorClick,
}) => {
  const getAuthorName = (book) => (book?.isAnonymous ? '익명' : (authorProfiles[book?.authorId]?.nickname || book?.authorName || '익명'));
  const getAuthorImage = (book) => (book?.isAnonymous ? null : authorProfiles[book?.authorId]?.profileImageUrl || null);
  // Mock 공지사항 데이터 (슬라이드 배너용)
  const mockBanners = [
    { id: '1', title: '오독오독 오픈!', subtitle: '나만의 책을 만들어보세요.' },
    { id: '2', title: '이번 주 집필왕은 누구일까요?', subtitle: '🏆 집필왕 랭킹에 도전하세요!' }
  ];
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const banners = notices.length > 0
    ? notices.slice(0, 5).map(n => ({ id: n.id, title: n.title, subtitle: n.content }))
    : mockBanners;

  // 배너 자동 슬라이드
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000); // 4초마다 전환
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleBannerClick = () => {
    if (notices.length > 0) {
      setView('notice_list');
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 fade-in pb-20">

      {/* 1. 상단 헤더 & 환영 메시지 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/odok_waving.png" alt="" className="w-8 h-8" />
            <h1 className="text-lg font-jua font-black text-slate-800 dark:text-slate-100 leading-tight whitespace-pre-line">
              {t.home_main_title}
            </h1>
          </div>
          <button
            onClick={() => setView('notice_list')}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Bell className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div>
          <span className="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-1 rounded-md mb-2 inline-block">
            <div className="flex items-center gap-2">
              <span>{(t.home_welcome || "{name}님 환영합니다!").replace('{name}', userProfile?.anonymousActivity ? "익명" : (userProfile?.nickname || t.guest))}</span>
              {levelInfo && (
                <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-0.5">
                  {levelInfo.gradeIcon && <span>{levelInfo.gradeIcon}</span>}
                  Lv.{levelInfo.level}
                </span>
              )}
            </div>
          </span>
        </div>
      </div>

      {/* 2. 메인 배너 (슬라이드) */}
      <div className="space-y-2 relative">
        {banners.length > 0 && (
          <>
            <div
              onClick={handleBannerClick}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white p-5 rounded-2xl shadow-lg flex items-center cursor-pointer hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98] relative overflow-hidden"
            >
              <style>{`
                @keyframes shimmer {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(100%); }
                }
                .animate-shimmer {
                  animation: shimmer 3s infinite;
                }
              `}</style>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
              <Megaphone className="w-6 h-6 mr-3 text-white shrink-0 relative z-10" />
              <div className="flex-1 min-w-0 relative z-10">
                <div key={currentBannerIndex} className="animate-in slide-in-from-right-4 fade-in duration-300">
                  <span className="text-[10px] text-orange-100 font-bold block mb-1">NOTICE</span>
                  <h3 className="text-base font-black mb-1">{banners[currentBannerIndex]?.title}</h3>
                  <p className="text-xs text-orange-100 line-clamp-1">{banners[currentBannerIndex]?.subtitle}</p>
                </div>
              </div>
              {banners.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
                    }}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors mr-1 relative z-10 backdrop-blur-sm"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
                    }}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors relative z-10 backdrop-blur-sm"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                </>
              )}
            </div>
            {/* 배너 인디케이터 */}
            {banners.length > 1 && (
              <div className="flex justify-center gap-1.5">
                {banners.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentBannerIndex(index)}
                    className={`h-1.5 rounded-full transition-all ${index === currentBannerIndex ? 'w-6 bg-orange-500' : 'w-1.5 bg-slate-300'
                      }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 프리미엄 홍보 보드 (캐러셀) ── */}
      {promotions.length > 0 && (
        <PromoCarousel promotions={promotions} books={books} authorProfiles={authorProfiles} handleBookClick={handleBookClick} t={t} />
      )}

      {/* 3. 오늘의 신간 (세로 리스트) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t.home_new_books}</h3>
        </div>

        {isLoadingHomeData ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        ) : todayBooks.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-8 text-center">
            <img src="/icons/odok_reading.png" alt="" className="w-20 h-20 mx-auto mb-2 opacity-80" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              {t.home_empty_new}
            </p>
            <p className="text-slate-300 text-xs">
              {t.home_empty_new_desc}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayBooks.slice(0, 5).map((book) => {
              const dateString = formatDate(book.createdAt, book.dateKey);
              const coverImage = getCoverImageFromBook(book);
              const categoryLabel = book.category === 'webnovel' ? '웹소설' :
                book.category === 'novel' ? '소설' :
                  book.category === 'series' ? '시리즈' :
                    book.category === 'essay' ? '에세이' :
                      book.category === 'self-improvement' ? '자기계발' :
                        book.category === 'self-help' ? '자기계발' :
                          book.category === 'humanities' ? '인문·철학' : book.category;

              return (
                <button
                  key={book.id}
                  onClick={() => handleBookClick(book)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm active:bg-slate-50 dark:active:bg-slate-700 transition-colors text-left hover:border-orange-200"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-11 h-14 rounded-md overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700">
                      <img
                        src={coverImage}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center hidden">
                        <Book className="w-4 h-4 text-orange-600" />
                      </div>
                      {(book.isSeries || book.category === 'series') && book.episodes && (
                        <div
                          className={`absolute top-0.5 right-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-black shadow-md ${book.status === 'ongoing'
                            ? 'bg-amber-400 text-amber-900'
                            : 'bg-red-500 text-white'
                            }`}
                        >
                          {book.status === 'ongoing' ? t.ongoing : t.completed}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm mb-1 line-clamp-1">{book.title}</h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[10px] font-black shadow-sm ${book?.isAnonymous ? 'bg-green-500' : (authorProfiles[book.authorId]?.badgeStyle || 'bg-green-500')}`}>
                          <span className="text-[10px]">{book?.isAnonymous ? '🌱' : (authorProfiles[book.authorId]?.gradeIcon || '🌱')}</span>
                          {getAuthorName(book)}
                        </span>
                        <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full font-bold text-slate-600 dark:text-slate-300">{categoryLabel}</span>
                        {book.subCategory && (
                          <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-600 dark:text-slate-300">{formatGenreTag(book.subCategory)}</span>
                        )}
                        <span className="flex items-center gap-0.5 text-slate-400 ml-auto">
                          <Calendar className="w-2.5 h-2.5" />
                          {dateString}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{formatCount(book.views)}</span>
                        <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{formatCount(book.likes)}</span>
                        <span className="flex items-center gap-0.5"><Bookmark className="w-2.5 h-2.5" />{formatCount(book.favorites)}</span>
                        <span className="flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5" />{formatCount(book.completions)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 주간 베스트셀러 (TOP 3 - 최근 7일 점수) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t.home_weekly_best}</h3>
        </div>

        {isLoadingHomeData ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        ) : weeklyBestBooks.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-8 text-center">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              {t.home_empty_best}
            </p>
            <p className="text-slate-300 text-xs">
              {t.home_empty_best_desc}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {weeklyBestBooks.map((book, index) => {
              const rank = index + 1;
              // 1, 2, 3위 메달 강조 (금/은/동)
              const medalConfig =
                rank === 1 ? {
                  bg: 'bg-gradient-to-br from-yellow-400 to-yellow-500',
                  text: 'text-white',
                  icon: <Medal className="w-7 h-7 fill-yellow-700 stroke-yellow-800" />,
                  rankDisplay: '🥇'
                }
                  : rank === 2 ? {
                    bg: 'bg-gradient-to-br from-slate-300 to-slate-400',
                    text: 'text-white',
                    icon: <Medal className="w-7 h-7 fill-slate-500 stroke-slate-600" />,
                    rankDisplay: '🥈'
                  }
                    : rank === 3 ? {
                      bg: 'bg-gradient-to-br from-orange-300 to-orange-400',
                      text: 'text-white',
                      icon: <Medal className="w-7 h-7 fill-orange-500 stroke-orange-600" />,
                      rankDisplay: '🥉'
                    }
                      : {
                        bg: 'bg-slate-100',
                        text: 'text-slate-500',
                        icon: null,
                        rankDisplay: rank
                      };

              return (
                <button
                  key={book.id}
                  onClick={() => handleBookClick(book)}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:bg-orange-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98] text-left"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shrink-0 shadow-lg ${medalConfig.bg} ${medalConfig.text}`}>
                    {medalConfig.icon || <span className="text-lg">{medalConfig.rankDisplay}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate mb-1">{book.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-black shadow-sm">
                        <Book className="w-3 h-3" />
                        {getAuthorImage(book) ? (
                          <img src={getAuthorImage(book)} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <User className="w-3 h-3" />
                        )}
                        {getAuthorName(book)}
                      </span>
                      {(book.isSeries || book.category === 'series') && book.episodes && (
                        <span className="text-[10px] font-bold text-orange-600">
                          {book.episodes.length}화 {book.status === 'ongoing' ? t.ongoing : t.completed}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-slate-400">
                        <Eye className="w-3 h-3" />
                        {formatCount(book.views)}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Heart className="w-3 h-3" />
                        {formatCount(book.likes)}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Bookmark className="w-3 h-3" />
                        {formatCount(book.favorites)}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <CheckCircle className="w-3 h-3" />
                        {formatCount(book.completions)}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. 금주의 집필왕 (가로 스크롤) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Trophy className="w-5 h-5 text-blue-500" />
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t.home_top_writers}</h3>
        </div>

        {isLoadingHomeData ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-20 shrink-0 animate-pulse">
                <div className="w-20 h-20 bg-slate-200 rounded-full mx-auto mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-full mb-1"></div>
                <div className="h-2 bg-slate-200 rounded w-2/3 mx-auto"></div>
              </div>
            ))}
          </div>
        ) : topWriters.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-8 text-center">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              {t.home_empty_writers}
            </p>
            <p className="text-slate-300 text-xs">
              {t.home_empty_best_desc}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {topWriters.map((writer, index) => {
              const rankColors = [
                'from-yellow-400 to-amber-500 text-amber-900',
                'from-slate-300 to-slate-400 text-slate-700',
                'from-orange-300 to-orange-400 text-orange-800'
              ];
              const rankBg = rankColors[index] || 'from-slate-200 to-slate-300 text-slate-600';

              return (
                <div
                  key={writer.id}
                  onClick={() => onAuthorClick?.(writer.id)}
                  className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-3 cursor-pointer hover:border-orange-200 dark:hover:border-orange-800 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition-colors active:scale-[0.98]"
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${rankBg} flex items-center justify-center text-sm font-black shrink-0`}>
                    {index + 1}
                  </div>
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-600 shrink-0">
                    {writer.profileImageUrl ? (
                      <img src={writer.profileImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{writer.nickname}</span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">Lv.{writer.level}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        {writer.gradeIcon} {writer.gradeName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="font-bold text-orange-500">{t?.weekly || '주간'} {writer.weeklyCount}권</span>
                      <span>{t?.total || '누적'} {writer.totalBookCount}권</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. 누적 베스트셀러 (TOP 3 - 1위 화려한 UI) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Book className="w-5 h-5 text-amber-500" />
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t.home_alltime_best || '누적 베스트셀러 📚'}</h3>
        </div>

        {isLoadingHomeData ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        ) : allTimeBestBooks.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-8 text-center">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              {t.home_empty_alltime_best || '아직 누적 베스트셀러가 없어요'}
            </p>
            <p className="text-slate-300 text-xs">
              {t.home_empty_alltime_best_desc || '독자들의 사랑을 받은 책이 여기에 올라갑니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {allTimeBestBooks.map((book, index) => {
              const rank = index + 1;
              const isFirst = rank === 1;
              const coverImage = getCoverImageFromBook(book);
              const categoryName = {
                'webnovel': '웹소설', 'novel': '소설', 'essay': '에세이',
                'self-improvement': '자기계발', 'self-help': '자기계발',
                'humanities': '인문·철학', 'series': '시리즈'
              }[book.category] || book.category;

              if (isFirst) {
                return (
                  <button
                    key={book.id}
                    onClick={() => handleBookClick(book)}
                    className="w-full text-left group relative overflow-hidden rounded-2xl active:scale-[0.99] transition-all"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 opacity-90 group-hover:opacity-95 transition-opacity" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.4)_0%,transparent_50%)]" />
                    <div className="relative flex flex-col">
                      {/* 배지: 상단 별도 영역 */}
                      <div className="pt-4 px-4 pb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 shadow-lg">
                          <Crown className="w-5 h-5 text-amber-600 fill-amber-500 shrink-0" />
                          <span className="text-xs font-black text-amber-800">#1 베스트셀러</span>
                        </span>
                      </div>
                      {/* 표지 + 제목/작가/통계: 가로 배치 */}
                      <div className="px-4 pb-4 flex items-stretch gap-4">
                        <div className="w-24 h-32 rounded-xl overflow-hidden shrink-0 shadow-xl ring-4 ring-white/50">
                          <img
                            src={coverImage}
                            alt={book.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                          <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center hidden">
                            <Book className="w-10 h-10 text-orange-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                          <h4 className="font-black text-white text-lg drop-shadow-sm mb-2 line-clamp-2">{book.title}</h4>
                          <p className="text-sm text-white/90 font-bold mb-2 flex items-center gap-1.5">
                            {getAuthorImage(book) ? (
                              <img src={getAuthorImage(book)} alt="" className="w-5 h-5 rounded-full object-cover ring-2 ring-white/50 shrink-0" />
                            ) : (
                              <User className="w-4 h-4 text-white/80 shrink-0" />
                            )}
                            {getAuthorName(book)}
                          </p>
                          <span className="inline-block text-[10px] font-bold text-amber-900 bg-white/90 px-2 py-0.5 rounded-full w-fit mb-2">{categoryName}</span>
                          <div className="flex items-center gap-3 text-[11px] text-white/90 flex-wrap">
                            <span className="flex items-center gap-0.5"><Eye className="w-3.5 h-3.5 shrink-0" />{formatCount(book.views)}</span>
                            <span className="flex items-center gap-0.5"><Heart className="w-3.5 h-3.5 shrink-0" />{formatCount(book.likes)}</span>
                            <span className="flex items-center gap-0.5"><Bookmark className="w-3.5 h-3.5 shrink-0" />{formatCount(book.favorites)}</span>
                            <span className="flex items-center gap-0.5"><CheckCircle className="w-3.5 h-3.5 shrink-0" />{formatCount(book.completions)}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-white/90 shrink-0 self-center" />
                      </div>
                    </div>
                  </button>
                );
              }

              const medalConfig = rank === 2
                ? { bg: 'bg-gradient-to-br from-slate-300 to-slate-400', icon: '🥈' }
                : { bg: 'bg-gradient-to-br from-orange-300 to-orange-400', icon: '🥉' };

              return (
                <button
                  key={book.id}
                  onClick={() => handleBookClick(book)}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:bg-orange-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98] text-left"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shrink-0 shadow-lg ${medalConfig.bg} text-white`}>
                    {medalConfig.icon}
                  </div>
                  <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                    <img src={coverImage} alt={book.title} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }} />
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center hidden"><Book className="w-6 h-6 text-slate-400" /></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate mb-1">{book.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="font-bold">{getAuthorName(book)}</span>
                      <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-300">{categoryName}</span>
                      <span className="flex items-center gap-1 text-slate-400"><Eye className="w-3 h-3" />{formatCount(book.views)}</span>
                      <span className="flex items-center gap-1 text-slate-400"><Heart className="w-3 h-3" />{formatCount(book.likes)}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeView;
