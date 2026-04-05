// src/components/ContinueReadingBar.jsx
// 홈화면 하단 고정 "이전에 읽던 책" 이어읽기 바
import React, { useEffect, useState } from 'react';
import { X, BookOpen, ChevronRight } from 'lucide-react';
import { getCoverImageFromBook } from '../utils/bookCovers';

const ContinueReadingBar = ({ book, ratio, onContinue, onDismiss, t = {} }) => {
  const [visible, setVisible] = useState(false);

  // 마운트 시 슬라이드업 애니메이션
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(id);
  }, []);

  const percent = Math.round((ratio || 0) * 100);
  const coverImg = getCoverImageFromBook(book);

  return (
    <>
      <style>{`
        @keyframes cr-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        .cr-bar { animation: cr-slide-up 0.4s cubic-bezier(0.32,0.72,0,1) both; }
      `}</style>

      {visible && (
        <div className="cr-bar fixed bottom-[72px] left-1/2 -translate-x-1/2 w-full max-w-md px-3 z-30 pointer-events-none">
          <div className="pointer-events-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            {/* 진행률 바 */}
            <div className="h-1 bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-pink-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5">
              {/* 표지 */}
              <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 shadow-sm">
                <img
                  src={coverImg}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>

              {/* 텍스트 */}
              <div className="flex-1 min-w-0" onClick={onContinue}>
                <p className="text-[10px] font-bold text-orange-500 mb-0.5">
                  {t.continue_reading_label || '이전에 읽던 책'} · {percent}%
                </p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate leading-tight">
                  {book.title}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  {book.authorName || book.author}
                </p>
              </div>

              {/* 계속 읽기 버튼 */}
              <button
                onClick={onContinue}
                className="shrink-0 flex items-center gap-1 bg-orange-500 text-white text-xs font-black px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {t.continue_reading_btn || '계속 읽기'}
              </button>

              {/* 닫기 */}
              <button
                onClick={onDismiss}
                className="shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContinueReadingBar;
