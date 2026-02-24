// src/components/LibraryView.jsx
import React, { useMemo, useState } from 'react';
import { Book, Calendar, Eye, Heart, Bookmark, CheckCircle, Search, ChevronLeft, ChevronDown } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { formatCount } from '../utils/numberFormat';
import { formatGenreTag } from '../utils/formatGenre';

const LibraryView = ({ books, onBookClick, filter = 'all', onFilterChange, t, authorProfiles = {} }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const categories = [
    { id: 'webnovel', name: t?.cat_webnovel || '웹소설', icon: '📱' },
    { id: 'novel', name: t?.cat_novel || '소설', icon: '📖' },
    { id: 'series', name: t?.cat_series || '시리즈', icon: '📚' },
    { id: 'essay', name: t?.cat_essay || '에세이', icon: '✍️' },
    { id: 'self-help', name: t?.cat_self_help || '자기계발', icon: '🌟' },
    { id: 'humanities', name: t?.cat_humanities || '인문·철학', icon: '💭' }
  ];

  // 책별 월 키 (createdAt 우선, 없으면 dateKey로 보정 — 방금 만든 책도 이번 달에 포함)
  const getBookMonthKey = (book) => {
    const date = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
    if (date && !isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (book.dateKey && typeof book.dateKey === 'string' && book.dateKey.length >= 7) {
      return book.dateKey.substring(0, 7);
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // 책 생성월 목록 추출
  const availableMonths = useMemo(() => {
    const months = new Set();
    books.forEach(book => {
      months.add(getBookMonthKey(book));
    });
    return [...months].sort().reverse();
  }, [books]);

  const formatMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    if (t?.year_suffix === '') {
      // 영어: "Jan 2025" 형태
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    return `${year}${t?.year_suffix || '년'} ${parseInt(month)}${t?.month_suffix || '월'}`;
  };

  // 카테고리 + 검색 + 월별 필터링
  const filteredBooks = useMemo(() => {
    const activeFilter = selectedCategory || 'all';
    let filtered = books;

    if (activeFilter === 'all') {
      // 전체
    } else if (activeFilter === 'series') {
      filtered = filtered.filter(book => book.category === 'series' || book.isSeries === true);
    } else {
      filtered = filtered.filter(book => {
        const bookCategory = String(book.category || '').trim().toLowerCase();
        if (bookCategory === 'self-improvement' && activeFilter === 'self-help') return true;
        return bookCategory === activeFilter;
      });
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(book =>
        book.title?.toLowerCase().includes(query) ||
        (book?.isAnonymous ? '익명' : (authorProfiles[book.authorId]?.nickname || book?.authorName || '')).toLowerCase().includes(query)
      );
    }

    // 월별 필터 (createdAt 없으면 dateKey·이번 달로 보정)
    if (selectedMonth) {
      filtered = filtered.filter(book => getBookMonthKey(book) === selectedMonth);
    }

    return filtered;
  }, [books, selectedCategory, searchQuery, selectedMonth, authorProfiles]);

  // 최신순 정렬 (createdAt 없으면 dateKey 또는 현재 시각 사용 — 방금 만든 책이 위로)
  const sortedBooks = useMemo(() => {
    const toSortDate = (book) => {
      const date = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
      if (date && !isNaN(date.getTime())) return date.getTime();
      if (book.dateKey && typeof book.dateKey === 'string') {
        const parsed = new Date(book.dateKey + 'T12:00:00');
        if (!isNaN(parsed.getTime())) return parsed.getTime();
      }
      return Date.now();
    };
    return [...filteredBooks].sort((a, b) => toSortDate(b) - toSortDate(a));
  }, [filteredBooks]);

  // 카테고리별 책 수
  const categoryCounts = useMemo(() => {
    const counts = { all: books.length };
    books.forEach(book => {
      const cat = String(book.category || '').trim().toLowerCase();
      if (cat === 'series' || book.isSeries === true) {
        counts['series'] = (counts['series'] || 0) + 1;
      }
      if (cat === 'self-improvement') {
        counts['self-help'] = (counts['self-help'] || 0) + 1;
      } else {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [books]);

  const currentCategoryName = selectedCategory === 'all'
    ? (t?.view_all || '전체 보기')
    : categories.find(c => c.id === selectedCategory)?.name || '';

  // 카테고리 선택 화면
  if (!selectedCategory) {
    return (
      <div className="space-y-5 animate-in slide-in-from-bottom-2 fade-in pb-20">
        {/* 헤더 */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
            {t?.library_title || "서재"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t?.library_desc || "모든 유저가 생성한 책들을 모아둔 곳입니다."}
          </p>
        </div>

        {/* 검색창 */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t?.search_placeholder || "책 제목 또는 작가로 검색..."}
              className="w-full bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 border-2 border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 border-2 border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-sm font-bold text-slate-700 appearance-none focus:border-orange-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">{t?.all_months || "전체 기간"}</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* 검색 결과가 있으면 바로 책 목록 표시 */}
        {(searchQuery.trim() || selectedMonth) ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {t?.search_results || "검색 결과"} ({sortedBooks.length})
              </h3>
              <button
                onClick={() => { setSearchQuery(''); setSelectedMonth(''); }}
                className="text-xs text-orange-500 font-bold"
              >
                {t?.clear_filter || "필터 초기화"}
              </button>
            </div>
            {sortedBooks.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-8 text-center">
                <Search className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm font-bold">
                  {t?.no_search_results || "검색 결과가 없습니다"}
                </p>
              </div>
            ) : (
              <BookList books={sortedBooks} onBookClick={onBookClick} t={t} authorProfiles={authorProfiles} />
            )}
          </div>
        ) : (
          <>
            {/* 전체 보기 */}
            <button
              onClick={() => setSelectedCategory('all')}
              className="w-full p-4 bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl text-white text-center shadow-sm active:scale-[0.98] transition-transform"
            >
              <h3 className="font-black text-base">{t?.view_all || "전체 보기"}</h3>
              <p className="text-xs text-white/80 mt-0.5">{(t?.total_books || "총 {count}권").replace('{count}', books.length)}</p>
            </button>

            {/* 카테고리 카드 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1">{t?.category_label || "카테고리 선택"}</h3>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="p-4 rounded-2xl border-2 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm hover:border-orange-200 active:scale-95 transition-all text-center"
                  >
                    <div className="text-3xl mb-2">{category.icon}</div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-0.5">{category.name}</h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{categoryCounts[category.id] || 0}{t?.book_count_suffix || '권'}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // 책 목록 화면 (카테고리 선택 후)
  return (
    <div className="space-y-4 animate-in slide-in-from-right fade-in pb-20">
      {/* 헤더 + 뒤로가기 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setSelectedCategory(null); setSearchQuery(''); setSelectedMonth(''); }}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 truncate">{currentCategoryName}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">{sortedBooks.length}{t?.book_count_suffix || '권'}</p>
        </div>
      </div>

      {/* 검색 + 월별 필터 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t?.search_placeholder || "책 제목 또는 작가로 검색..."}
            className="w-full bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 border-2 border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-full bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 border-2 border-slate-200 rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-600 appearance-none focus:border-orange-500 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="">{t?.all_period || "전체"}</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* 책 목록 */}
      {sortedBooks.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-12 text-center">
          <Book className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-bold mb-1">
            {t?.library_empty || "아직 등록된 책이 없습니다"}
          </p>
          <p className="text-slate-300 text-xs">
            {t?.library_empty_desc || "집필 탭에서 첫 책을 만들어보세요"}
          </p>
        </div>
      ) : (
        <BookList books={sortedBooks} onBookClick={onBookClick} t={t} authorProfiles={authorProfiles} />
      )}
    </div>
  );
};

// 책 목록 컴포넌트 (재사용)
const BookList = ({ books, onBookClick, t, authorProfiles }) => (
  <div className="space-y-2">
    {books.map((book) => {
      const dateString = formatDate(book.createdAt, book.dateKey);
      const coverImage = getCoverImageFromBook(book);

      return (
        <button
          key={book.id}
          onClick={() => onBookClick(book)}
          className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm active:bg-slate-50 dark:active:bg-slate-700 transition-colors text-left hover:border-orange-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative w-11 h-14 rounded-md overflow-hidden shrink-0 bg-slate-100">
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
                  {book.status === 'ongoing' ? (t?.ongoing || '연재') : (t?.completed || '완결')}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm mb-1 line-clamp-1">
                {book.title}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[10px] font-black shadow-sm ${book?.isAnonymous ? 'bg-green-500' : (authorProfiles[book.authorId]?.badgeStyle || 'bg-green-500')}`}>
                  <span className="text-[10px]">{book?.isAnonymous ? '🌱' : (authorProfiles[book.authorId]?.gradeIcon || '🌱')}</span>
                  {book?.isAnonymous ? '익명' : (authorProfiles[book.authorId]?.nickname || book?.authorName || (t?.anonymous || '익명'))}
                </span>
                <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full font-bold text-slate-600 dark:text-slate-300">
                  {book.category === 'webnovel' ? (t?.cat_webnovel || '웹소설') :
                    book.category === 'novel' ? (t?.cat_novel || '소설') :
                      book.category === 'series' ? (t?.cat_series || '시리즈') :
                        book.category === 'essay' ? (t?.cat_essay || '에세이') :
                          book.category === 'self-improvement' ? (t?.cat_self_help || '자기계발') :
                            book.category === 'self-help' ? (t?.cat_self_help || '자기계발') :
                              book.category === 'humanities' ? (t?.cat_humanities || '인문.철학') : book.category}
                </span>
                {book.subCategory && (
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600">
                    {formatGenreTag(book.subCategory)}
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-slate-400 ml-auto">
                  <Calendar className="w-2.5 h-2.5" />
                  {dateString}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[10px] text-slate-400 mt-1">
                <span className="flex items-center gap-0.5">
                  <Eye className="w-2.5 h-2.5" />
                  {formatCount(book.views)}
                </span>
                <span className="flex items-center gap-0.5">
                  <Heart className="w-2.5 h-2.5" />
                  {formatCount(book.likes)}
                </span>
                <span className="flex items-center gap-0.5">
                  <Bookmark className="w-2.5 h-2.5" />
                  {formatCount(book.favorites)}
                </span>
                <span className="flex items-center gap-0.5">
                  <CheckCircle className="w-2.5 h-2.5" />
                  {formatCount(book.completions)}
                </span>
              </div>
            </div>
          </div>
        </button>
      );
    })}
  </div>
);

export default LibraryView;
