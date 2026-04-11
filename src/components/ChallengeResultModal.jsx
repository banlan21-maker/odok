// src/components/ChallengeResultModal.jsx
import React from 'react';

const MONTH_NAMES_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const ChallengeResultModal = ({ result, monthKey, reads, goal, onClose, t = {} }) => {
  // monthKey: 'YYYY_MM'
  const [year, month] = (monthKey || '').split('_');
  const monthIdx = month ? parseInt(month, 10) - 1 : -1;
  const MONTH_NAMES = t.month_names ? t.month_names : MONTH_NAMES_KO;
  const monthLabel = monthIdx >= 0
    ? (t.challenge_month_format || '{year}년 {month}')
        .replace('{year}', year)
        .replace('{month}', MONTH_NAMES[monthIdx] || month)
    : '';

  const isSuccess = result === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* 상단 배경 */}
        <div className={`px-6 pt-8 pb-6 text-center ${isSuccess ? 'bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-800' : 'bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/30 dark:to-slate-800'}`}>
          <img src={isSuccess ? "/icons/odok_thumbsup.png" : "/icons/odok_reading.png"} alt="" className="w-24 h-24 mx-auto mb-1" />
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">{(t.challenge_month_label || '{month} 챌린지 결산').replace('{month}', monthLabel)}</p>
          <h2 className={`text-xl font-black ${isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500'}`}>
            {isSuccess ? (t.challenge_success || '챌린지 달성!') : (t.challenge_fail || '아쉽지만 다음 달에!')}
          </h2>
        </div>

        {/* 내용 */}
        <div className="px-6 py-5 space-y-4">
          {/* 완독 수 */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 rounded-2xl px-4 py-3">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{t.challenge_reads_label || '완독한 책'}</span>
            <span className={`text-lg font-black ${isSuccess ? 'text-emerald-500' : 'text-orange-500'}`}>
              {reads} <span className="text-xs text-slate-400 font-bold">/ {goal}{t.challenge_books_unit || '권'}</span>
            </span>
          </div>

          {isSuccess ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl px-4 py-3 border border-emerald-100 dark:border-emerald-900 text-center space-y-1">
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{t.challenge_reward || '🖊️ 잉크 10개 지급 완료!'}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">{t.challenge_reward_desc || '이번 달도 열심히 읽어주셔서 감사해요'}</p>
            </div>
          ) : (
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-2xl px-4 py-3 border border-orange-100 dark:border-orange-900 text-center space-y-1">
              <p className="text-sm font-black text-orange-600 dark:text-orange-400">
                {(t.challenge_miss || '{count}권만 더 읽었으면 됐는데…').replace('{count}', goal - reads)}
              </p>
              <p className="text-xs text-orange-500 dark:text-orange-500">{t.challenge_retry || '이번 달 챌린지에 다시 도전해 보세요!'}</p>
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        <div className="px-6 pb-8">
          <button
            onClick={onClose}
            className={`w-full py-3.5 rounded-2xl font-black text-sm text-white transition-all active:scale-95 ${isSuccess ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-500 hover:bg-orange-600'}`}
          >
            {isSuccess ? (t.challenge_confirm || '🎊 확인') : (t.challenge_try_btn || '💪 이번 달 도전하기')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeResultModal;
