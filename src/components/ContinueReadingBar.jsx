// src/components/ContinueReadingBar.jsx
// 홈화면 하단 고정 "이어읽기" 바 (간소화)
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const ContinueReadingBar = ({ book, ratio, onContinue, onDismiss, t = {} }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(id);
  }, []);

  const percent = Math.round((ratio || 0) * 100);

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
              <div className="h-full bg-gradient-to-r from-orange-400 to-pink-500 transition-all" style={{ width: `${percent}%` }} />
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2" onClick={onContinue}>
              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-orange-500">
                  {t.continue_reading_label || '이어읽기'} · {percent}%
                </p>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate leading-tight">
                  {book.title}
                </p>
              </div>

              {/* 계속 읽기 버튼 */}
              <button
                onClick={(e) => { e.stopPropagation(); onContinue(); }}
                className="shrink-0 bg-orange-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
              >
                {t.continue_reading_btn || '계속 읽기'}
              </button>

              {/* 닫기 */}
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="shrink-0 p-0.5 rounded-full text-slate-300 hover:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContinueReadingBar;
