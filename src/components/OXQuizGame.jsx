// src/components/OXQuizGame.jsx
// AI 로딩 대기 중 OX 상식퀴즈 미니게임
import { useState, useEffect, useCallback, useRef } from 'react';
import oxQuizData from '../data/oxQuizData';

const CATEGORY_LABELS = {
  general: '일반 상식',
  science: '과학/자연',
  history: '역사',
  literature: '문학/국어',
  geography: '지리/세계',
  fun: '재미있는 사실',
  food: '음식/생활',
};

const CATEGORY_EMOJI = {
  general: '💡',
  science: '🔬',
  history: '🏛️',
  literature: '📖',
  geography: '🌍',
  fun: '🎉',
  food: '🍳',
};

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const OXQuizGame = ({ t = {} }) => {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState(null); // { correct: bool }
  const feedbackTimer = useRef(null);

  // 초기 셔플
  useEffect(() => {
    setQuestions(shuffleArray(oxQuizData));
  }, []);

  const current = questions[currentIndex];

  const handleAnswer = useCallback((userAnswer) => {
    if (feedback || !current) return;
    const correct = userAnswer === current.a;
    if (correct) setScore(s => s + 1);
    setTotal(t => t + 1);
    setFeedback({ correct });

    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      setCurrentIndex(i => (i + 1) % questions.length);
    }, 1200);
  }, [feedback, current, questions.length]);

  useEffect(() => {
    return () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); };
  }, []);

  if (!current) return null;

  const cat = current.c;

  return (
    <div className="w-full space-y-3">
      {/* 점수 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-slate-400">
          {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
        </span>
        <span className="text-[10px] font-bold text-orange-500">
          {score}/{total} 맞춤
        </span>
      </div>

      {/* 문제 */}
      <div className={`relative rounded-2xl p-4 text-center transition-all duration-300 ${
        feedback
          ? feedback.correct
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          : 'bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600'
      }`}>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed min-h-[2.5rem]">
          {current.q}
        </p>

        {/* 피드백 오버레이 */}
        {feedback && (
          <div className="mt-2">
            <div className="flex items-center justify-center gap-2">
              <img
                src={feedback.correct ? "/icons/odok_thumbsup.png" : "/icons/odok_crying.png"}
                alt=""
                className="w-10 h-10"
              />
              <span className={`text-sm font-black ${feedback.correct ? 'text-emerald-500' : 'text-red-500'}`}>
                {feedback.correct ? '정답!' : `오답! 답은 ${current.a ? 'O' : 'X'}`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* O / X 버튼 */}
      {!feedback && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAnswer(true)}
            className="py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all text-white font-black text-lg shadow-sm"
          >
            ⭕ O
          </button>
          <button
            onClick={() => handleAnswer(false)}
            className="py-3 rounded-2xl bg-red-500 hover:bg-red-600 active:scale-95 transition-all text-white font-black text-lg shadow-sm"
          >
            ❌ X
          </button>
        </div>
      )}
    </div>
  );
};

export default OXQuizGame;
