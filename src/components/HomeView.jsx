// src/components/HomeView.jsx
// Step 3: 홈 탭 구현
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Crown, Trophy, Star, Megaphone, User, 
  ArrowRight, Medal, Book, Bell, Sparkles, ChevronLeft, ChevronRight, Calendar,
  Eye, Heart, Bookmark, CheckCircle
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { formatCount } from '../utils/numberFormat';

// Skeleton UI 컴포넌트
const SkeletonCard = () => (
  <div className="w-32 shrink-0 bg-white rounded-xl border border-slate-100 p-4 animate-pulse">
    <div className="w-full h-24 bg-slate-200 rounded-lg mb-2"></div>
    <div className="h-4 bg-slate-200 rounded mb-1"></div>
    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
  </div>
);

const SkeletonListItem = () => (
  <div className="bg-white p-4 rounded-xl border border-slate-100 animate-pulse flex items-center gap-4">
    <div className="w-10 h-10 bg-slate-200 rounded-lg shrink-0"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
    </div>
  </div>
);

const HomeView = ({ 
  userProfile, 
  t, 
  levelInfo, 
  notices, 
  setView,
  todayBooks,
  weeklyBestBooks,
  topWriters,
  isLoadingHomeData,
  handleBookClick
}) => {
  // Mock 공지사항 데이터 (슬라이드 배너용)
  const mockBanners = [
    { id: '1', title: '오독오독 오픈!', subtitle: '나만의 책을 만들어보세요.' },
    { id: '2', title: '이번 주 집필왕은 누구일까요?', subtitle: '🏆 집필왕 랭킹에 도전하세요!' }
  ];
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const banners = notices.length > 0 
    ? notices.map(n => ({ id: n.id, title: n.title, subtitle: n.body }))
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
            <Book className="w-8 h-8 text-orange-600" />
            <h1 className="text-xl font-black text-slate-800">오독오독</h1>
          </div>
          <button className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <Bell className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div>
          <span className="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-1 rounded-md mb-2 inline-block">
            <div className="flex items-center gap-2">
              <span>{userProfile?.nickname || '게스트'}님 환영합니다!</span>
              {levelInfo && (
                <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-black">
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
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentBannerIndex ? 'w-6 bg-orange-500' : 'w-1.5 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. 오늘의 신간 (세로 리스트) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h3 className="text-xl font-black text-slate-800">따끈따끈한 신작 🔥</h3>
        </div>

        {isLoadingHomeData ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        ) : todayBooks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              오늘의 첫 작가가 되어보세요!
            </p>
            <p className="text-slate-300 text-xs">
              집필 탭에서 새로운 책을 만들어보세요
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayBooks.slice(0, 5).map((book) => {
              const dateString = formatDate(book.createdAt);
              const coverImage = getCoverImageFromBook(book);
              
              return (
                <button
                  key={book.id}
                  onClick={() => handleBookClick(book)}
                  className="w-full bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:bg-orange-50 transition-colors active:scale-[0.98] text-left"
                >
                  <div className="w-16 h-20 rounded-md overflow-hidden shrink-0 bg-slate-100">
                    <img 
                      src={coverImage} 
                      alt={book.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // 이미지 로드 실패 시 기본 아이콘으로 대체
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center hidden">
                      <Book className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-800 text-base mb-1 line-clamp-1">
                      {book.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold">{book.authorName || '익명'}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                        {book.category === 'webnovel' ? '웹소설' :
                         book.category === 'novel' ? '소설' :
                         book.category === 'essay' ? '에세이' :
                         book.category === 'self-improvement' ? '자기계발' :
                         book.category === 'humanities' ? '인문·철학' : book.category}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {dateString}
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

      {/* 4. 주간 베스트셀러 (TOP 5) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <h3 className="text-xl font-black text-slate-800">주간 베스트셀러 🏆</h3>
        </div>

        {isLoadingHomeData ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        ) : weeklyBestBooks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              아직 집계된 베스트셀러가 없어요
            </p>
            <p className="text-slate-300 text-xs">
              첫 번째 주인공이 되어보세요!
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
                  className="w-full bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:bg-orange-50 transition-colors active:scale-[0.98] text-left"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shrink-0 shadow-lg ${medalConfig.bg} ${medalConfig.text}`}>
                    {medalConfig.icon || <span className="text-lg">{medalConfig.rankDisplay}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate mb-1">{book.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-black shadow-sm">
                        <Book className="w-3 h-3" />
                        작가: {book.authorName || '익명'}
                      </span>
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
          <h3 className="text-xl font-black text-slate-800">금주의 집필왕 👑</h3>
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
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              아직 활동 중인 작가님이 없어요
            </p>
            <p className="text-slate-300 text-xs">
              첫 번째 주인공이 되어보세요!
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5 snap-x snap-mandatory scroll-smooth">
            {topWriters.map((writer, index) => {
              const isTopThree = index < 3;
              
              return (
                <div key={writer.id} className="w-20 shrink-0 text-center snap-start">
                  <div className={`relative w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center ${isTopThree ? 'bg-gradient-to-br from-orange-400 to-orange-600' : 'bg-slate-100'}`}>
                    <User className={`w-10 h-10 ${isTopThree ? 'text-white' : 'text-slate-400'}`} />
                    {isTopThree && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                        <Crown className="w-3 h-3 text-yellow-700" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate mb-0.5">
                    {writer.nickname}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {writer.bookCount}권
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeView;
