// src/components/BookDetail.jsx
// 책 상세/뷰어 페이지 컴포넌트
import React from 'react';
import { ChevronLeft, Book, Calendar, User } from 'lucide-react';
import { formatDateDetailed } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';

const BookDetail = ({ book, onClose, fontSize = 'text-base' }) => {
  if (!book) return null;
  
  // 수정 5: fontSize 값을 Tailwind 클래스로 매핑
  const fontSizeClass = fontSize === 'small' || fontSize === 'text-sm' ? 'text-sm' :
                        fontSize === 'medium' || fontSize === 'text-base' ? 'text-base' :
                        fontSize === 'large' || fontSize === 'text-lg' ? 'text-lg' :
                        fontSize === 'xlarge' || fontSize === 'text-xl' ? 'text-xl' :
                        'text-base';  // 기본값

  const dateString = formatDateDetailed(book.createdAt);
  const coverImage = getCoverImageFromBook(book);

  const categoryName = {
    'webnovel': '웹소설',
    'novel': '소설',
    'essay': '에세이',
    'self-improvement': '자기계발',
    'humanities': '인문·철학'
  }[book.category] || book.category;

  return (
    <div className="animate-in slide-in-from-right-4 fade-in pb-20">
      {/* 헤더 */}
      <div className="mb-6 space-y-4">
        <button 
          onClick={onClose} 
          className="p-2 -ml-2 rounded-full hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-slate-600" />
        </button>
        
        {/* 표지 이미지 및 기본 정보 */}
        <div className="flex gap-4">
          <div className="w-24 h-32 rounded-lg overflow-hidden shrink-0 bg-slate-100 shadow-md">
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
              <Book className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0 space-y-3">
            <h1 className="text-2xl font-black text-slate-800 leading-tight">
              {book.title}
            </h1>
            
            {/* 메타 정보 */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <User className="w-3.5 h-3.5" />
                <span className="font-bold">{book.authorName || '익명'}</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{dateString}</span>
              </div>
            </div>

            {/* 카테고리/장르 태그 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
                {categoryName}
              </span>
              {book.subCategory && (
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                  {book.subCategory}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 본문 내용 */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="prose prose-slate max-w-none mb-6">
          {/* 수정 5: fontSize를 동적으로 적용 */}
          <div className={`${fontSizeClass} leading-relaxed text-slate-700 whitespace-pre-line`}>
            {book.content || book.summary || '내용이 없습니다.'}
          </div>
        </div>

        {/* 하단 통계 (옵션) */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Book className="w-3.5 h-3.5" />
            <span>조회 {book.views || 0}회</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetail;
