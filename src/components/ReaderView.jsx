// src/components/ReaderView.jsx
// Step 1: 간단한 책 읽기 화면
import React from 'react';
import { ChevronLeft, Book } from 'lucide-react';

const ReaderView = ({ book, onBack, fontSize = 'text-base' }) => {
  if (!book) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-400">책을 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in pb-20">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={onBack}
          className="p-2 rounded-full hover:bg-slate-50"
        >
          <ChevronLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <Book className="w-5 h-5 text-orange-600" />
          <h1 className="text-lg font-black text-slate-800">책 읽기</h1>
        </div>
      </div>

      {/* 제목 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
            {book.category === 'webs novel' ? '웹소설' :
             book.category === 'novel' ? '소설' :
             book.category === 'essay' ? '에세이' :
             book.category === 'self-help' ? '자기계발' :
             book.category === 'philosophy' ? '인문·철학' : book.category}
          </span>
          {book.genre && (
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {book.genre === 'romance' ? '로맨스' :
               book.genre === 'fantasy' ? '판타지' :
               book.genre === 'mystery' ? '미스터리' :
               book.genre === 'drama' ? '드라마' : book.genre}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-black text-slate-800 leading-tight">
          {book.title}
        </h2>
        <p className="text-xs text-slate-400">
          {book.authorNickname || '익명'} · {book.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '날짜 없음'}
        </p>
      </div>

      {/* 본문 */}
      <div className={`prose prose-slate max-w-none ${fontSize} leading-relaxed text-slate-700 whitespace-pre-line bg-white rounded-2xl p-6 border border-slate-100 shadow-sm`}>
        {book.content}
      </div>
    </div>
  );
};

export default ReaderView;
