// src/components/ArchiveView.jsx
// 보관함: 내가 쓴 책 + 즐겨찾기 한 책
import React, { useState, useMemo } from 'react';
import { Bookmark, Book, Heart, Eye, CheckCircle, MessageCircle, Search, X, LayoutGrid, List, Calendar } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { formatCount } from '../utils/numberFormat';

// ─── 사용자 보기 설정 저장 (localStorage) ─────────────────────────
const PREF_KEY_VIEW = 'archive_view_mode';
const PREF_KEY_SORT = 'archive_sort_by';
const loadPref = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const savePref = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage 사용 불가 환경 무시 */
  }
};

// ─── 정렬 ────────────────────────────────────────────────────────
// 책의 정렬용 생성 시각(ms). createdAt 없으면 dateKey, 둘 다 없으면 '방금 만든 책'으로 간주해 맨 위로.
const toSortDate = (book) => {
  const date = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
  if (date && !isNaN(date.getTime())) return date.getTime();
  if (book.dateKey) {
    const d = new Date(book.dateKey);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return Date.now();
};

// 인기 점수 = 조회수 + 좋아요×2 + 즐겨찾기×2 + 완독 + 댓글
// (가중치 조정이 필요하면 이 한 줄만 수정하면 됩니다)
const getPopularityScore = (book) =>
  (book.views || 0) +
  (book.likes || 0) * 2 +
  (book.favorites || 0) * 2 +
  (book.completions || 0) +
  (book.commentCount || 0);

const sortBooks = (list, sortBy) => {
  const arr = [...list];
  if (sortBy === 'name') {
    return arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  }
  if (sortBy === 'popular') {
    return arr.sort((a, b) => getPopularityScore(b) - getPopularityScore(a));
  }
  // 'latest' (기본): 생성일자 최신순
  return arr.sort((a, b) => toSortDate(b) - toSortDate(a));
};

// ─── 통계 행 (조회/좋아요/즐겨찾기/완독/댓글) ─────────────────────
const StatRow = ({ book, size = 'sm' }) => {
  const iconCls = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-400 dark:text-slate-500">
      <span className="flex items-center gap-0.5"><Eye className={iconCls} />{formatCount(book.views)}</span>
      <span className="flex items-center gap-0.5"><Heart className={iconCls} />{formatCount(book.likes)}</span>
      <span className="flex items-center gap-0.5"><Bookmark className={iconCls} />{formatCount(book.favorites)}</span>
      <span className="flex items-center gap-0.5"><CheckCircle className={iconCls} />{formatCount(book.completions)}</span>
      <span className="flex items-center gap-0.5"><MessageCircle className={iconCls} />{formatCount(book.commentCount)}</span>
    </div>
  );
};

// ─── 그리드 카드 ─────────────────────────────────────────────────
const BookGridCard = ({ book, onBookClick, t, authorProfiles }) => {
  const coverImage = getCoverImageFromBook(book);
  const dateString = formatDate(book.createdAt, book.dateKey);

  return (
    <button
      onClick={() => onBookClick?.(book)}
      className={`w-full text-left rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border shadow-sm active:scale-[0.97] transition-transform ${
        book.isGoldenEdition
          ? 'border-amber-300 dark:border-amber-600 shadow-amber-100 dark:shadow-amber-900/20'
          : 'border-slate-100 dark:border-slate-700'
      }`}
    >
      {/* 표지 */}
      <div className="relative w-full aspect-[3/4] bg-slate-100 dark:bg-slate-700">
        <img
          src={coverImage}
          alt={book.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextElementSibling.style.display = 'flex';
          }}
        />
        <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/40 items-center justify-center hidden absolute inset-0">
          <Book className="w-8 h-8 text-orange-400" />
        </div>

        {/* Golden 뱃지 */}
        {book.isGoldenEdition && (
          <div className="absolute top-1.5 left-1.5 text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/80 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded-full">
            ✨ Golden
          </div>
        )}

        {/* 연재/완결 뱃지 */}
        {(book.isSeries || book.category === 'series') && book.episodes && (
          <div className={`absolute top-1.5 right-1.5 text-[7px] font-black px-1.5 py-0.5 rounded-full shadow ${
            book.status === 'ongoing' ? 'bg-amber-400 text-amber-900' : 'bg-red-500 text-white'
          }`}>
            {book.status === 'ongoing' ? (t?.ongoing || '연재') : (t?.completed || '완결')}
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="p-2.5 space-y-1">
        <h3 className="font-black text-slate-800 dark:text-slate-100 text-xs leading-snug line-clamp-2">
          {book.title}
        </h3>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
          {book?.isAnonymous ? (t?.anonymous || '익명') : (authorProfiles[book.authorId]?.nickname || book?.authorName || (t?.anonymous || '익명'))}
          {' · '}{dateString}
        </p>
        <StatRow book={book} size="sm" />
      </div>
    </button>
  );
};

// ─── 리스트 행 ───────────────────────────────────────────────────
const BookListRow = ({ book, onBookClick, t, authorProfiles }) => {
  const coverImage = getCoverImageFromBook(book);
  const dateString = formatDate(book.createdAt, book.dateKey);

  return (
    <button
      onClick={() => onBookClick?.(book)}
      className={`w-full px-3 py-2.5 bg-white dark:bg-slate-800 rounded-xl border shadow-sm active:bg-slate-50 dark:active:bg-slate-700 transition-colors text-left ${
        book.isGoldenEdition
          ? 'border-amber-300 dark:border-amber-600'
          : 'border-slate-100 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {/* 표지 */}
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
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/40 flex items-center justify-center hidden">
            <Book className="w-4 h-4 text-orange-400" />
          </div>
          {(book.isSeries || book.category === 'series') && book.episodes && (
            <div className={`absolute top-0.5 right-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-black shadow-md ${
              book.status === 'ongoing' ? 'bg-amber-400 text-amber-900' : 'bg-red-500 text-white'
            }`}>
              {book.status === 'ongoing' ? (t?.ongoing || '연재') : (t?.completed || '완결')}
            </div>
          )}
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            {book.isGoldenEdition && (
              <span className="shrink-0 text-[8px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/80 border border-amber-200 dark:border-amber-700 px-1 py-0.5 rounded-full">
                ✨
              </span>
            )}
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm line-clamp-1">
              {book.title}
            </h3>
          </div>
          <p className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 truncate">
            <span className="truncate">
              {book?.isAnonymous ? (t?.anonymous || '익명') : (authorProfiles[book.authorId]?.nickname || book?.authorName || (t?.anonymous || '익명'))}
            </span>
            <span className="flex items-center gap-0.5 shrink-0">
              <Calendar className="w-2.5 h-2.5" />{dateString}
            </span>
          </p>
          <StatRow book={book} size="md" />
        </div>
      </div>
    </button>
  );
};

// ─── 메인 ────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'latest', labelKey: 'sort_latest', fallback: '최신순' },
  { key: 'name', labelKey: 'sort_name', fallback: '이름순' },
  { key: 'popular', labelKey: 'sort_popular', fallback: '인기순' },
];

const ArchiveView = ({ books, user, onBookClick, favoriteBookIds = [], t, authorProfiles = {} }) => {
  const [activeTab, setActiveTab] = useState('mine');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => loadPref(PREF_KEY_VIEW, 'grid')); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState(() => loadPref(PREF_KEY_SORT, 'latest'));    // 'latest' | 'name' | 'popular'

  const myBooks = useMemo(
    () => books.filter(book => book.authorId === user?.uid),
    [books, user]
  );
  const favoriteBooks = useMemo(
    () => books.filter(book => favoriteBookIds.includes(book.id)),
    [books, favoriteBookIds]
  );

  const currentList = activeTab === 'mine' ? myBooks : favoriteBooks;

  // 검색 → 정렬 순서로 적용
  const visibleBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = !q
      ? currentList
      : currentList.filter(book =>
          book.title?.toLowerCase().includes(q) ||
          (book?.isAnonymous ? '익명' : (authorProfiles[book.authorId]?.nickname || book?.authorName || '')).toLowerCase().includes(q)
        );
    return sortBooks(filtered, sortBy);
  }, [currentList, searchQuery, sortBy, authorProfiles]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
  };

  const handleViewChange = (mode) => {
    setViewMode(mode);
    savePref(PREF_KEY_VIEW, mode);
  };

  const handleSortChange = (key) => {
    setSortBy(key);
    savePref(PREF_KEY_SORT, key);
  };

  const emptyIcon = activeTab === 'mine'
    ? <img src="/icons/odok_writing.png" alt="" className="w-24 h-24 mx-auto mb-2 opacity-80" />
    : <img src="/icons/odok_reading.png" alt="" className="w-24 h-24 mx-auto mb-2 opacity-80" />;

  const emptyText = activeTab === 'mine'
    ? (t?.my_books_empty || '아직 작성한 책이 없습니다')
    : (t?.favorites_empty || '즐겨찾기한 책이 없습니다');

  const emptyDesc = activeTab === 'mine'
    ? (t?.create_first_book || '집필 탭에서 첫 책을 작성해보세요')
    : (t?.find_favorites || '마음에 드는 책을 즐겨찾기해보세요');

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in pb-20 pt-3">
      {/* 헤더 */}
      <div className="space-y-1">
        <h2 className="text-2xl font-jua text-slate-800 dark:text-slate-100 leading-tight">
          {t?.archive_title || '보관함'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t?.archive_desc || '내가 작성한 책과 즐겨찾기한 책을 모아보세요.'}
        </p>
      </div>

      {/* 탭 */}
      <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 gap-1">
        <button
          onClick={() => handleTabChange('mine')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-black transition-all ${
            activeTab === 'mine'
              ? 'bg-white dark:bg-slate-800 text-orange-600 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Book className="w-4 h-4" />
          {t?.my_books_tab || '내가 쓴 책'}
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
            activeTab === 'mine'
              ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600'
              : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
          }`}>
            {myBooks.length}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('favorites')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-black transition-all ${
            activeTab === 'favorites'
              ? 'bg-white dark:bg-slate-800 text-red-500 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Heart className="w-4 h-4" />
          {t?.favorites_tab || '즐겨찾기'}
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
            activeTab === 'favorites'
              ? 'bg-red-100 dark:bg-red-900/40 text-red-500'
              : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
          }`}>
            {favoriteBooks.length}
          </span>
        </button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t?.search_placeholder || '책 제목 또는 작가로 검색...'}
          className="w-full bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 border-2 border-slate-200 rounded-xl py-2.5 pl-10 pr-9 text-sm focus:border-orange-500 focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 정렬 + 보기 전환 컨트롤 */}
      {currentList.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          {/* 정렬 칩 */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleSortChange(opt.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-black transition-colors ${
                  sortBy === opt.key
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {t?.[opt.labelKey] || opt.fallback}
              </button>
            ))}
          </div>

          {/* 보기 전환 (카드 / 리스트) */}
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => handleViewChange('grid')}
              aria-label={t?.view_grid || '카드 보기'}
              title={t?.view_grid || '카드 보기'}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 shadow-sm'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewChange('list')}
              aria-label={t?.view_list || '리스트 보기'}
              title={t?.view_list || '리스트 보기'}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 shadow-sm'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 책 개수 표시 */}
      {searchQuery.trim() && (
        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold px-1">
          {(t?.search_results || '검색 결과')} {visibleBooks.length}{t?.book_count_suffix || '권'}
        </p>
      )}

      {/* 결과 or 빈 상태 */}
      {visibleBooks.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-12 text-center">
          {searchQuery.trim() ? (
            <>
              <img src="/icons/odok_crying.png" alt="" className="w-20 h-20 mx-auto mb-2 opacity-80" />
              <p className="text-slate-400 text-sm font-bold">{t?.no_search_results || '검색 결과가 없습니다'}</p>
            </>
          ) : (
            <>
              {emptyIcon}
              <p className="text-slate-400 text-sm font-bold mb-1">{emptyText}</p>
              <p className="text-slate-300 text-xs">{emptyDesc}</p>
            </>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {visibleBooks.map(book => (
            <BookListRow
              key={book.id}
              book={book}
              onBookClick={onBookClick}
              t={t}
              authorProfiles={authorProfiles}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleBooks.map(book => (
            <BookGridCard
              key={book.id}
              book={book}
              onBookClick={onBookClick}
              t={t}
              authorProfiles={authorProfiles}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ArchiveView;
