// src/components/ChallengeResultModal.jsx
import React from 'react';

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const ChallengeResultModal = ({ result, monthKey, reads, goal, onClose }) => {
  // monthKey: 'YYYY_MM'
  const [year, month] = (monthKey || '').split('_');
  const monthLabel = month ? `${year}년 ${MONTH_NAMES[parseInt(month, 10) - 1]}` : '';

  const isSuccess = result === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* 상단 배경 */}
        <div className={`px-6 pt-8 pb-6 text-center ${isSuccess ? 'bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-800' : 'bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/30 dark:to-slate-800'}`}>
          <div className="text-6xl mb-3">{isSuccess ? '🎉' : '📚'}</div>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">{monthLabel} 챌린지 결산</p>
          <h2 className={`text-xl font-black ${isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500'}`}>
            {isSuccess ? '챌린지 달성!' : '아쉽지만 다음 달에!'}
          </h2>
        </div>

        {/* 내용 */}
        <div className="px-6 py-5 space-y-4">
          {/* 완독 수 */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 rounded-2xl px-4 py-3">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">완독한 책</span>
            <span className={`text-lg font-black ${isSuccess ? 'text-emerald-500' : 'text-orange-500'}`}>
              {reads} <span className="text-xs text-slate-400 font-bold">/ {goal}권</span>
            </span>
          </div>

          {isSuccess ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl px-4 py-3 border border-emerald-100 dark:border-emerald-900 text-center space-y-1">
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">🖊️ 잉크 10개 지급 완료!</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">이번 달도 열심히 읽어주셔서 감사해요</p>
            </div>
          ) : (
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-2xl px-4 py-3 border border-orange-100 dark:border-orange-900 text-center space-y-1">
              <p className="text-sm font-black text-orange-600 dark:text-orange-400">
                {goal - reads}권만 더 읽었으면 됐는데…
              </p>
              <p className="text-xs text-orange-500 dark:text-orange-500">이번 달 챌린지에 다시 도전해 보세요!</p>
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        <div className="px-6 pb-8">
          <button
            onClick={onClose}
            className={`w-full py-3.5 rounded-2xl font-black text-sm text-white transition-all active:scale-95 ${isSuccess ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-500 hover:bg-orange-600'}`}
          >
            {isSuccess ? '🎊 확인' : '💪 이번 달 도전하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeResultModal;
