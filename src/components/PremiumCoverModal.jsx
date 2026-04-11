// src/components/PremiumCoverModal.jsx
// 집필 완료 후 프리미엄 AI 표지 선택 모달
import React, { useState } from 'react';
import { Sparkles, Video, BookOpen, X, RefreshCw } from 'lucide-react';
import { generatePremiumCover } from '../utils/aiCoverService';
import OXQuizGame from './OXQuizGame';
import { showRewardVideoAd } from '../utils/admobService';
import { hasPremiumCover } from '../utils/bookCovers';

const COVER_INK_COST = 50;

const loadingMessages = [
  'AI 화가가 소설을 읽는 중입니다...',
  '이야기의 분위기를 파악하고 있습니다...',
  '팔레트에 색을 올리는 중입니다...',
  '붓으로 섬세하게 그리는 중입니다...',
  '거의 완성되었습니다! 마무리 터치 중...',
];

const PremiumCoverModal = ({
  book,
  userProfile,
  appId,
  deductInk,
  onCoverGenerated,  // (coverUrl) => void — 표지 생성 완료
  onSkip,            // () => void — 무료로 건너뜀
  onViewBook,        // () => void — 책 보러 가기
}) => {
  const [phase, setPhase] = useState('select'); // 'select' | 'loading' | 'done'
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState(null);
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState(null);

  const currentInk = userProfile?.ink ?? 0;
  const hasEnoughInk = currentInk >= COVER_INK_COST;

  // 이미 AI 표지가 있는 경우 (재접속 시)
  if (hasPremiumCover(book) && phase === 'select') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 text-center">
          <p className="text-lg font-black text-slate-800 dark:text-slate-100">✍️ 집필 완료!</p>
          <div className="flex gap-2">
            <button
              onClick={onViewBook}
              className="flex-1 py-3 rounded-xl text-sm font-black bg-orange-500 text-white"
            >
              책 보러 가기
            </button>
            <button
              onClick={onSkip}
              className="flex-1 py-3 rounded-xl text-sm font-black bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    );
  }

  const startGeneration = async (useAd = false) => {
    setError(null);
    setPhase('loading');
    setLoadingMsgIndex(0);

    // 로딩 메시지 순환
    const msgInterval = setInterval(() => {
      setLoadingMsgIndex(prev => (prev + 1) % loadingMessages.length);
    }, 3000);

    const doGenerate = async () => {
      try {
        const coverUrl = await generatePremiumCover(
          book.id,
          book.title,
          book.content || (book.episodes?.[0]?.content ?? ''),
          appId
        );
        clearInterval(msgInterval);
        setGeneratedCoverUrl(coverUrl);
        setPhase('done');
        onCoverGenerated(coverUrl);
      } catch (err) {
        clearInterval(msgInterval);
        console.error('[PremiumCoverModal] 표지 생성 실패:', err);
        setError('표지 생성에 실패했습니다. 잉크는 차감되지 않았습니다.');
        setPhase('select');
        // 잉크는 생성 실패 시 환불 (이미 차감하지 않았으므로 별도 처리 불필요)
      }
    };

    if (useAd) {
      showRewardVideoAd(
        async () => {
          await doGenerate();
        },
        (errMsg) => {
          clearInterval(msgInterval);
          setError(errMsg || '광고 시청에 실패했습니다.');
          setPhase('select');
        }
      );
    } else {
      // 잉크 차감 먼저, 성공 후 생성
      const deducted = await deductInk(COVER_INK_COST);
      if (!deducted) {
        clearInterval(msgInterval);
        setError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        setPhase('select');
        return;
      }
      await doGenerate();
    }
  };

  // ── 로딩 화면 ──────────────────────────────────────────────────
  const [showQuizInLoading, setShowQuizInLoading] = useState(false);
  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 text-center max-h-[85vh] overflow-y-auto scrollbar-hide">
          {showQuizInLoading ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400">{loadingMessages[loadingMsgIndex]}</p>
                <button onClick={() => setShowQuizInLoading(false)} className="text-xs text-orange-500 font-bold">돌아가기</button>
              </div>
              <OXQuizGame />
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3">
                <img src="/icons/odok_thinking.png" alt="" className="w-20 h-20 animate-bounce" />
                <div>
                  <p className="text-base font-black text-slate-800 dark:text-slate-100">AI 표지 생성 중</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 min-h-[2.5rem] transition-all">
                    {loadingMessages[loadingMsgIndex]}
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-purple-500 rounded-full animate-pulse" style={{ width: '75%' }} />
              </div>
              <button
                onClick={() => setShowQuizInLoading(true)}
                className="w-full py-3 rounded-xl text-sm font-black bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all"
              >
                ⭕❌ OX퀴즈 풀면서 기다리기
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 완료 화면 ──────────────────────────────────────────────────
  if (phase === 'done' && generatedCoverUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden w-full max-w-sm shadow-xl">
          <div className="relative">
            <img
              src={generatedCoverUrl}
              alt="AI 생성 표지"
              className="w-full h-56 object-cover"
            />
            {/* 텍스트 오버레이 미리보기 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 flex flex-col justify-between p-4">
              <div />
              <div className="space-y-1">
                <p className="text-white font-black text-lg drop-shadow-lg line-clamp-2 leading-tight">
                  {book.title}
                </p>
                <p className="text-white/80 text-xs font-bold text-right drop-shadow">
                  {book.isAnonymous ? '익명' : book.authorName || '작가'}
                </p>
              </div>
            </div>
            <div className="absolute top-3 right-3 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI 표지
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-center text-sm font-bold text-slate-700 dark:text-slate-200">
              🎉 AI 표지가 완성되었습니다!
            </p>
            <button
              onClick={onViewBook}
              className="w-full py-3 rounded-xl text-sm font-black bg-orange-500 text-white"
            >
              책 보러 가기
            </button>
            <button
              onClick={onSkip}
              className="w-full py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 선택 화면 ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="relative bg-gradient-to-br from-orange-500 to-purple-600 p-5 text-center">
          <button
            onClick={onSkip}
            className="absolute top-3 right-3 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-3xl mb-1">✍️</div>
          <p className="text-white font-black text-base">집필 완료!</p>
          <p className="text-white/80 text-xs mt-1">"{book.title}"이(가) 완성되었습니다</p>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-bold">
            표지 스타일을 선택하세요
          </p>

          {/* 에러 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
              <p className="text-red-600 dark:text-red-400 text-xs font-bold">{error}</p>
            </div>
          )}

          {/* 옵션 1: 일반 표지 (무료) */}
          <button
            onClick={onViewBook}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">일반 표지</p>
              <p className="text-xs text-slate-400">기본 장르 이미지로 자동 설정</p>
            </div>
            <span className="shrink-0 text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-full">
              무료
            </span>
          </button>

          {/* 옵션 2: 프리미엄 AI 표지 (50잉크) */}
          <button
            onClick={() => hasEnoughInk && startGeneration(false)}
            disabled={!hasEnoughInk}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors text-left ${
              hasEnoughInk
                ? 'border-orange-300 dark:border-orange-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 cursor-pointer'
                : 'border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-purple-100 dark:from-orange-900/40 dark:to-purple-900/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">프리미엄 AI 표지</p>
                <span className="text-[10px] font-black text-white bg-gradient-to-r from-orange-400 to-purple-500 px-1.5 py-0.5 rounded-full">NEW</span>
              </div>
              <p className="text-xs text-slate-400">소설 내용 기반 AI 맞춤 표지 생성</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-black text-orange-500">💧 50</p>
              <p className="text-[10px] text-slate-400">보유: {currentInk}</p>
            </div>
          </button>

          {/* 옵션 3: 광고 시청 후 생성 */}
          <button
            onClick={() => startGeneration(true)}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-violet-200 dark:border-violet-800 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
              <Video className="w-5 h-5 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">광고 보고 생성</p>
              <p className="text-xs text-slate-400">광고 시청 후 AI 표지 무료 생성</p>
            </div>
            <span className="shrink-0 text-xs font-black text-violet-600 bg-violet-50 dark:bg-violet-950 px-2 py-1 rounded-full">
              무료
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumCoverModal;
