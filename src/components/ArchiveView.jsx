// src/components/ArchiveView.jsx
// 보관함: 내가 쓴 책 + 즐겨찾기 한 책
import React from 'react';
import { Bookmark, Book, Heart, Clock, Eye, CheckCircle } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { formatCount } from '../utils/numberFormat';

const ArchiveView = ({ books, user, onBookClick, favoriteBookIds = [] }) => {
  // 내가 쓴 책 필터링
  const myBooks = books.filter(book => book.authorId === user?.uid) || [];
  
  const favoriteBooks = books.filter(book => favoriteBookIds.includes(book.id)) || [];
  const formatTag = (value) => {
    if (!value) return value;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'webnovel') return '웹소설';
    if (normalized === 'novel') return '소설';
    if (normalized === 'essay') return '에세이';
    if (normalized === 'self-help' || normalized === 'self-improvement') {
      return '자기계발';
    }
    if (normalized === 'humanities') return '인문.철학';
    if (/^[a-z0-9-]+$/.test(normalized)) {
      return normalized.toUpperCase();
    }
    return value;
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in pb-20">
      {/* 헤더 */}
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-slate-800 leading-tight">
          보관함
        </h2>
        <p className="text-sm text-slate-500">
          내가 작성한 책과 즐겨찾기한 책을 모아보세요.
        </p>
      </div>

      {/* 내가 쓴 책 섹션 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Book className="w-5 h-5 text-orange-600" />
          <h3 className="font-bold text-slate-700 text-sm">내가 쓴 책</h3>
          <span className="text-xs text-slate-400">({myBooks.length})</span>
        </div>

        {myBooks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <Book className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              아직 작성한 책이 없습니다
            </p>
            <p className="text-slate-300 text-xs">
              집필 탭에서 첫 책을 작성해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myBooks.map((book) => {
              const dateString = formatDate(book.createdAt);
              const coverImage = getCoverImageFromBook(book);

              return (
                <button
                  key={book.id}
                  onClick={() => onBookClick?.(book)}
                  className="w-full p-4 bg-white rounded-xl border border-slate-100 shadow-sm text-left hover:border-orange-200 active:bg-slate-50 transition-colors"
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
                          className={`absolute top-1 right-1 w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black shadow-md ${
                            book.status === 'ongoing'
                              ? 'bg-amber-400 text-amber-900'
                              : 'bg-red-500 text-white'
                          }`}
                        >
                          {book.status === 'ongoing' ? '연재중' : '완결'}
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
                          작가: {book.authorName || '익명'}
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                          {book.category === 'webnovel' ? '웹소설' :
                           book.category === 'novel' ? '소설' :
                           book.category === 'series' ? '시리즈' :
                           book.category === 'essay' ? '에세이' :
                           book.category === 'self-improvement' ? '자기계발' :
                           book.category === 'self-help' ? '자기계발' :
                           book.category === 'humanities' ? '인문.철학' : book.category}
                        </span>
                        {book.subCategory && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                            {formatTag(book.subCategory)}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400 ml-auto">
                          <Clock className="w-3 h-3" />
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

      {/* 즐겨찾기 섹션 */}
      <div className="space-y-3 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-5 h-5 text-red-400" />
          <h3 className="font-bold text-slate-700 text-sm">즐겨찾기</h3>
          <span className="text-xs text-slate-400">({favoriteBooks.length})</span>
        </div>
        {favoriteBooks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <Bookmark className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold mb-1">
              즐겨찾기한 책이 없습니다
            </p>
            <p className="text-slate-300 text-xs">
              마음에 드는 책을 즐겨찾기해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {favoriteBooks.map((book) => {
              const dateString = formatDate(book.createdAt);
              const coverImage = getCoverImageFromBook(book);

              return (
                <button
                  key={book.id}
                  onClick={() => onBookClick?.(book)}
                  className="w-full p-4 bg-white rounded-xl border border-slate-100 shadow-sm text-left hover:border-amber-200 active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative w-16 h-20 rounded-md overflow-hidden shrink-0 bg-slate-100">
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
                        <Book className="w-6 h-6 text-orange-600" />
                      </div>
                      {(book.isSeries || book.category === 'series') && book.episodes && (
                        <div
                          className={`absolute top-1 right-1 w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black shadow-md ${
                            book.status === 'ongoing'
                              ? 'bg-amber-400 text-amber-900'
                              : 'bg-red-500 text-white'
                          }`}
                        >
                          {book.status === 'ongoing' ? '연재중' : '완결'}
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
                          작가: {book.authorName || '익명'}
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                          {book.category === 'webnovel' ? '웹소설' :
                           book.category === 'novel' ? '소설' :
                           book.category === 'series' ? '시리즈' :
                           book.category === 'essay' ? '에세이' :
                           book.category === 'self-improvement' ? '자기계발' :
                           book.category === 'self-help' ? '자기계발' :
                           book.category === 'humanities' ? '인문.철학' : book.category}
                        </span>
                        {book.subCategory && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                            {formatTag(book.subCategory)}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400 ml-auto">
                          <Clock className="w-3 h-3" />
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
    </div>
  );
};

export default ArchiveView;
