// src/components/RainbowInkModal.jsx
import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const getStyles = (t) => [
  { id: 'dialect',    emoji: '🌊', name: t.rainbow_style_dialect    || '경상도 사투리', desc: t.rainbow_style_dialect_desc    || '투박하고 정감 넘치는 바이브' },
  { id: 'historical', emoji: '📜', name: t.rainbow_style_historical || '정통 사극',     desc: t.rainbow_style_historical_desc || '고풍스러운 어휘와 문체' },
  { id: 'literary',   emoji: '🖋️', name: t.rainbow_style_literary   || '고전 명작',     desc: t.rainbow_style_literary_desc   || '유려하고 깊이 있는 문학적 묘사' },
  { id: 'trendy',     emoji: '✨', name: t.rainbow_style_trendy     || '트렌디 MZ',     desc: t.rainbow_style_trendy_desc     || '최신 유행어와 힙한 감성' },
  { id: 'cyber',      emoji: '🤖', name: t.rainbow_style_cyber      || '사이버네틱',    desc: t.rainbow_style_cyber_desc      || '냉철하고 기술적인 AI 보고서 스타일' },
];

const RainbowInkModal = ({ user, books, useItem, onClose, t = {} }) => {
  const [phase, setPhase] = useState('books'); // 'books' | 'style' | 'transforming' | 'done'
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);

  const myBooks = (books || []).filter(b => b.authorId === user?.uid);
  const STYLES = getStyles(t);

  const handleTransform = async () => {
    if (!selectedBook || !selectedStyle) return;
    setPhase('transforming');
    setError(null);

    const transformFn = httpsCallable(functions, 'transformBookStyle');

    const steps = selectedBook.steps || [];
    const total = steps.length || 1;
    setProgress({ current: 0, total });

    try {
      let transformedSteps = [];

      if (steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const result = await transformFn({ content: step.content, style: selectedStyle.id });
          transformedSteps.push({ ...step, content: result.data.transformedContent });
          setProgress({ current: i + 1, total });
        }
      } else {
        // steps가 없는 경우 content 전체를 변환
        const result = await transformFn({ content: selectedBook.content || '', style: selectedStyle.id });
        transformedSteps = [{ name: t.book_main_text || '본문', content: result.data.transformedContent }];
        setProgress({ current: 1, total: 1 });
      }

      // 아이템 차감
      const deductResult = await useItem('rainbow_ink', 1);
      if (!deductResult.success) {
        setError(deductResult.error || t.item_deduct_fail || '아이템 차감에 실패했습니다.');
        setPhase('style');
        return;
      }

      // 새 책 저장
      const styleName = STYLES.find(s => s.id === selectedStyle.id)?.name || selectedStyle.id;
      const transformedContent = transformedSteps.map(s => s.content).join('\n\n');
      const bookData = {
        title: `${selectedBook.title} - ${styleName} ${t.edition_suffix || '에디션'}`,
        content: transformedContent,
        steps: transformedSteps,
        synopsis: selectedBook.synopsis || '',
        characterSheet: selectedBook.characterSheet || '',
        settingSheet: selectedBook.settingSheet || '',
        authorId: user.uid,
        authorNickname: selectedBook.authorNickname || '',
        authorLevel: selectedBook.authorLevel || null,
        category: selectedBook.category || '',
        subCategory: selectedBook.subCategory || '',
        genre: selectedBook.genre || '',
        keywords: selectedBook.keywords || '',
        isTransformed: true,
        originalBookId: selectedBook.id,
        transformStyle: selectedStyle.id,
        createdAt: serverTimestamp(),
        hearts: 0,
        views: 0,
        commentsCount: 0,
        isPublic: false,
      };

      await addDoc(collection(db, 'artifacts', appId, 'books'), bookData);
      setPhase('done');
    } catch (err) {
      setError(err.message || t.rainbow_transform_fail || '변환에 실패했습니다. 다시 시도해주세요.');
      setPhase('style');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌈</span>
            <p className="font-black text-slate-800 dark:text-slate-100">{t.rainbow_ink_title || '무지개 잉크'}</p>
            {phase === 'books' && <span className="text-[10px] font-bold text-slate-400">{t.rainbow_select_book || '책 선택'}</span>}
            {phase === 'style' && <span className="text-[10px] font-bold text-slate-400">{t.rainbow_select_style || '스타일 선택'}</span>}
            {phase === 'transforming' && <span className="text-[10px] font-bold text-violet-500">{t.rainbow_transforming || '변환 중...'}</span>}
            {phase === 'done' && <span className="text-[10px] font-bold text-emerald-500">{t.rainbow_done || '완료!'}</span>}
          </div>
          <button
            onClick={onClose}
            disabled={phase === 'transforming'}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">

          {/* 책 선택 */}
          {phase === 'books' && (
            <div className="px-5 py-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">{t.rainbow_select_book_desc || '변환할 내 작품을 선택하세요'}</p>
              {myBooks.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-4xl">📚</p>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{t.rainbow_no_books || '아직 작성한 작품이 없습니다.'}</p>
                  <p className="text-xs text-slate-400">{t.rainbow_no_books_desc || '집필 탭에서 글을 써보세요!'}</p>
                </div>
              ) : (
                myBooks.map(book => (
                  <button
                    key={book.id}
                    onClick={() => { setSelectedBook(book); setSelectedStyle(null); setPhase('style'); }}
                    className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{book.title}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {book.genre} · {book.steps?.length || 1}{t.chapter_unit || '챕터'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* 스타일 선택 */}
          {phase === 'style' && (
            <div className="px-5 py-4 space-y-3">
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t.rainbow_selected_book || '선택된 작품:'}</span>
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">{selectedBook?.title}</span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.rainbow_select_style_desc || '변환 스타일을 선택하세요'}</p>
              {STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-all text-left ${
                    selectedStyle?.id === style.id
                      ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30'
                      : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl">{style.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{style.name}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{style.desc}</p>
                  </div>
                  {selectedStyle?.id === style.id && (
                    <CheckCircle className="w-5 h-5 text-violet-500 shrink-0" />
                  )}
                </button>
              ))}
              {error && <p className="text-xs text-red-500 font-bold text-center pt-1">{error}</p>}
            </div>
          )}

          {/* 변환 중 */}
          {phase === 'transforming' && (
            <div className="px-5 py-12 text-center space-y-6">
              <span className="text-6xl animate-bounce inline-block">🌈</span>
              <div className="space-y-2">
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">{t.rainbow_in_progress || '스타일 변환 중...'}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {progress.total > 0
                    ? (t.rainbow_chapter_progress || '{current} / {total} 챕터 완료').replace('{current}', progress.current).replace('{total}', progress.total)
                    : (t.rainbow_preparing || '준비 중...')}
                </p>
              </div>
              {progress.total > 0 && (
                <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-2 mx-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-violet-500 to-pink-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {t.rainbow_wait || '잠시 기다려 주세요. 화면을 닫지 마세요.'}
              </p>
            </div>
          )}

          {/* 완료 */}
          {phase === 'done' && (
            <div className="px-5 py-10 text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
              <div className="space-y-1.5">
                <p className="text-base font-black text-slate-800 dark:text-slate-100">{t.rainbow_complete || '변환 완료!'}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-bold text-violet-600 dark:text-violet-400">
                    {selectedBook?.title} - {selectedStyle?.name} {t.edition_suffix || '에디션'}
                  </span>{t.saved_subject_suffix || '이'}<br />
                  {t.rainbow_saved || '내 서재에 저장되었습니다.'}
                </p>
              </div>
              <div className="bg-violet-50 dark:bg-violet-950/30 rounded-xl px-4 py-3">
                <p className="text-xs text-violet-600 dark:text-violet-400">
                  {t.rainbow_used || '🌈 무지개 잉크 1개가 사용되었습니다'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-10 pt-3 flex-none border-t border-slate-100 dark:border-slate-700">
          {phase === 'books' && myBooks.length === 0 && (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              {t.close || '닫기'}
            </button>
          )}
          {phase === 'style' && (
            <div className="space-y-2">
              <button
                onClick={handleTransform}
                disabled={!selectedStyle}
                className="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-violet-500 to-pink-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {selectedStyle
                  ? `${selectedStyle.emoji} ${(t.rainbow_transform_btn || '{style}으로 변환하기').replace('{style}', selectedStyle.name)}`
                  : (t.rainbow_select_style_plz || '스타일을 선택해 주세요')}
              </button>
              <button
                onClick={() => { setPhase('books'); setSelectedStyle(null); }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-400 dark:text-slate-500"
              >
                {t.rainbow_back_to_books || '← 책 다시 선택'}
              </button>
            </div>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl text-sm font-black bg-orange-500 text-white"
            >
              {t.confirm || '확인'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RainbowInkModal;
