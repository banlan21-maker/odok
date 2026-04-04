// src/components/ArchiveView.jsx
// 보관함: 내가 쓴 책 + 즐겨찾기 한 책
import React from 'react';
import { Bookmark, Book, Heart, Clock, Eye, CheckCircle } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { formatCount } from '../utils/numberFormat';
import { formatGenreTag } from '../utils/formatGenre';

const ArchiveView = ({ books, user, onBookClick, favoriteBookIds = [], t, authorProfiles = {} }) => {
  // 내가 쓴 책 필터링
  const myBooks = books.filter(book => book.authorId === user?.uid) || [];

  const favoriteBooks = books.filter(book => favoriteBookIds.includes(book.id)) || [];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in pb-20">
      {/* 헤더 */}
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
          {t?.archive_title || "보관함"}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t?.archive_desc || "내가 작성한 책과 즐겨찾기한 책을 모아보세요."}
        </p>
      </div>

      {/* 내가 쓴 책 섹션 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Book className="w-5 h-5 text-orange-600" />
          <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">{t?.my_books_tab || "내가 쓴 책"}</h3>
          <span className="text-xs text-slate-400">({myBooks.length})</span>
        </div>

        {myBooks.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-12 text-center">
            <Book className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              {t?.my_books_empty || "아직 작성한 책이 없습니다"}
            </p>
            <p className="text-slate-300 text-xs">
              {t?.create_first_book || "집필 탭에서 첫 책을 작성해보세요"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {myBooks.map((book) => {
              const dateString = formatDate(book.createdAt, book.dateKey);
              const coverImage = getCoverImageFromBook(book);

              return (
                <button
                  key={book.id}
                  onClick={() => onBookClick?.(book)}
                  className={`w-full px-3 py-2.5 bg-white dark:bg-slate-800 rounded-xl border shadow-sm text-left active:bg-slate-50 dark:active:bg-slate-700 transition-colors ${
                    book.isGoldenEdition
                      ? 'border-amber-300 dark:border-amber-600 hover:border-amber-400 shadow-amber-100 dark:shadow-amber-900/20'
                      : 'border-slate-100 dark:border-slate-700 hover:border-orange-200'
                  }`}
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
                      <div className="flex items-center gap-1.5 mb-1">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm line-clamp-1 flex-1">
                          {book.title}
                        </h3>
                        {book.isGoldenEdition && (
                          <span className="shrink-0 text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded-full">
                            ✨ Golden
                          </span>
                        )}
                      </div>
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
                          <Clock className="w-2.5 h-2.5" />
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
        )}
      </div>

      {/* 즐겨찾기 섹션 */}
      <div className="space-y-3 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-5 h-5 text-red-400" />
          <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">{t?.favorites_tab || "즐겨찾기"}</h3>
          <span className="text-xs text-slate-400">({favoriteBooks.length})</span>
        </div>
        {favoriteBooks.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-12 text-center">
            <Bookmark className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              {t?.favorites_empty || "즐겨찾기한 책이 없습니다"}
            </p>
            <p className="text-slate-300 text-xs">
              {t?.find_favorites || "마음에 드는 책을 즐겨찾기해보세요"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {favoriteBooks.map((book) => {
              const dateString = formatDate(book.createdAt, book.dateKey);
              const coverImage = getCoverImageFromBook(book);

              return (
                <button
                  key={book.id}
                  onClick={() => onBookClick?.(book)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-left hover:border-amber-200 active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
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
                      <div className="flex items-center gap-1.5 mb-1">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm line-clamp-1 flex-1">
                          {book.title}
                        </h3>
                        {book.isGoldenEdition && (
                          <span className="shrink-0 text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded-full">
                            ✨ Golden
                          </span>
                        )}
                      </div>
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
                          <Clock className="w-2.5 h-2.5" />
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
        )}
      </div>
    </div>
  );
};

export default ArchiveView;
