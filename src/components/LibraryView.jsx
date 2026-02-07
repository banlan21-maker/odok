// src/components/LibraryView.jsx
import React, { useMemo } from 'react';
import { Book, Calendar, Filter, ChevronDown, Eye, Heart, Bookmark, CheckCircle } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { formatCount } from '../utils/numberFormat';
import { formatGenreTag } from '../utils/formatGenre';

const LibraryView = ({ books, onBookClick, filter = 'all', onFilterChange, t }) => {
  // 필터별 책 목록 필터링
  const filteredBooks = useMemo(() => {
    let filtered = books;

    if (filter === 'all') {
      // 전체 보기
      return filtered;
    } else if (filter === 'series') {
      // 시리즈 전체 (seriesSubType 없는 기존 데이터 포함)
      filtered = books.filter(book => book.category === 'series' || book.isSeries === true);
    } else if (filter === 'series-webnovel') {
      // 시리즈 - 웹소설형 (seriesSubType 또는 subCategory로 판별, 기존 데이터 호환)
      filtered = books.filter(book => {
        const isSeriesBook = book.category === 'series' || book.isSeries === true;
        if (!isSeriesBook) return false;
        const seriesType = String(book.seriesSubType || '').trim().toLowerCase();
        const subCategory = String(book.subCategory || '').trim().toLowerCase();
        return seriesType === 'webnovel' || subCategory === 'webnovel' || subCategory === 'web-novel';
      });
    } else if (filter === 'series-novel') {
      // 시리즈 - 소설형 (seriesSubType 또는 subCategory로 판별, 기존 데이터 호환)
      filtered = books.filter(book => {
        const isSeriesBook = book.category === 'series' || book.isSeries === true;
        if (!isSeriesBook) return false;
        const seriesType = String(book.seriesSubType || '').trim().toLowerCase();
        const subCategory = String(book.subCategory || '').trim().toLowerCase();
        return seriesType === 'novel' || subCategory === 'novel' || subCategory === 'fiction';
      });
    } else {
      // 일반 카테고리
      filtered = books.filter(book => {
        const bookCategory = String(book.category || '').trim().toLowerCase();
        // self-improvement -> self-help 매핑
        if (bookCategory === 'self-improvement' && filter === 'self-help') {
          return true;
        }
        return bookCategory === filter;
      });
    }

    return filtered;
  }, [books, filter]);

  // 생성일 기준 최신순 정렬
  const sortedBooks = useMemo(() => {
    return [...filteredBooks].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0));
      const dateB = b.createdAt?.toDate?.() || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0));
      return dateB - dateA;
    });
  }, [filteredBooks]);

  const filterOptions = [
    { id: 'all', name: t?.view_all || '전체 보기' },
    { id: 'webnovel', name: `${t?.cat_webnovel || '웹소설'} (${t?.short_story || '단편'})` },
    { id: 'novel', name: `${t?.cat_novel || '소설'} (${t?.short_story || '단편'})` },
    { id: 'series', name: `${t?.cat_series || '시리즈'} (${t?.view_all || '전체'})` },
    { id: 'series-webnovel', name: `${t?.cat_series} - ${t?.cat_webnovel}` },
    { id: 'series-novel', name: `${t?.cat_series} - ${t?.cat_novel}` },
    { id: 'essay', name: t?.cat_essay || '에세이' },
    { id: 'self-help', name: t?.cat_self_help || '자기계발' },
    { id: 'humanities', name: t?.cat_humanities || '인문/철학' }
  ];

  const selectedFilterName = filterOptions.find(opt => opt.id === filter)?.name || t?.view_all || '전체 보기';

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in pb-20">
      {/* 헤더 */}
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-slate-800 leading-tight">
          {t?.library_title || "서재"}
        </h2>
        <p className="text-sm text-slate-500">
          {t?.library_desc || "모든 유저가 생성한 책들을 모아둔 곳입니다."}
        </p>
      </div>

      {/* 카테고리 필터 드롭다운 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500">{t?.category_label || "카테고리"}</span>
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => onFilterChange?.(e.target.value)}
            className="w-full bg-white border-2 border-slate-200 rounded-xl py-3 px-4 pr-10 text-sm font-bold text-slate-700 appearance-none focus:border-orange-500 focus:outline-none transition-colors cursor-pointer"
          >
            {filterOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* 책 목록 */}
      {sortedBooks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <Book className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-bold mb-1">
            {t?.library_empty || "아직 등록된 책이 없습니다"}
          </p>
          <p className="text-slate-300 text-xs">
            {t?.library_empty_desc || "집필 탭에서 첫 책을 만들어보세요"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBooks.map((book) => {
            const dateString = formatDate(book.createdAt);
            const coverImage = getCoverImageFromBook(book);

            return (
              <button
                key={book.id}
                onClick={() => onBookClick(book)}
                className="w-full p-4 bg-white rounded-xl border border-slate-100 shadow-sm active:bg-slate-50 transition-colors text-left hover:border-orange-200"
              >
                <div className="flex items-start gap-3">
                  <div className="relative w-16 h-20 rounded-md overflow-hidden shrink-0 bg-slate-100">
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
                    {(book.isSeries || book.category === 'series') && book.episodes && (
                      <div
                        className={`absolute top-1 right-1 w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black shadow-md ${book.status === 'ongoing'
                            ? 'bg-amber-400 text-amber-900'
                            : 'bg-red-500 text-white'
                          }`}
                      >
                        {book.status === 'ongoing' ? (t?.ongoing || '연재중') : (t?.completed || '완결')}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 text-lg mb-2 line-clamp-1">
                      {book.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-black shadow-sm">
                        <Book className="w-3 h-3" />
                        {(t?.author_by || "작가: {name}").replace('{name}', book.authorName || (t?.anonymous || '익명'))}
                      </span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                        {book.category === 'webnovel' ? (t?.cat_webnovel || '웹소설') :
                          book.category === 'novel' ? (t?.cat_novel || '소설') :
                            book.category === 'series' ? (t?.cat_series || '시리즈') :
                              book.category === 'essay' ? (t?.cat_essay || '에세이') :
                                book.category === 'self-improvement' ? (t?.cat_self_help || '자기계발') :
                                  book.category === 'self-help' ? (t?.cat_self_help || '자기계발') :
                                    book.category === 'humanities' ? (t?.cat_humanities || '인문.철학') : book.category}
                      </span>
                      {book.subCategory && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                          {formatGenreTag(book.subCategory)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-slate-400 ml-auto">
                        <Calendar className="w-3 h-3" />
                        {dateString}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatCount(book.views)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {formatCount(book.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bookmark className="w-3 h-3" />
                        {formatCount(book.favorites)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {formatCount(book.completions)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LibraryView;
