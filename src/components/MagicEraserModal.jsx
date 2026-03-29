// src/components/MagicEraserModal.jsx
import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle, RotateCcw } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const ENDING_STYLES = [
  { id: 'happy',    emoji: '😊', name: '행복한 결말',  desc: '따뜻하고 희망찬 해피엔딩' },
  { id: 'sad',      emoji: '😭', name: '슬픈 결말',    desc: '눈물 자극하는 비극적 여운' },
  { id: 'twist',    emoji: '😱', name: '충격적 반전',  desc: '아무도 예상 못한 전율의 반전' },
  { id: 'open',     emoji: '🎞️', name: '열린 결말',    desc: '독자가 상상하는 여백의 미' },
  { id: 'circular', emoji: '🔄', name: '수미상관',     desc: '첫 장면과 호응하는 구조적 마무리' },
];

const MagicEraserModal = ({ user, books, useItem, onClose }) => {
  const [phase, setPhase] = useState('books'); // 'books' | 'style' | 'generating' | 'preview' | 'done'
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [generatedEnding, setGeneratedEnding] = useState(null);
  const [error, setError] = useState(null);

  const myBooks = (books || []).filter(b => b.authorId === user?.uid);

  const handleGenerate = async (style = selectedStyle) => {
    if (!selectedBook || !style) return;
    setPhase('generating');
    setError(null);
    setGeneratedEnding(null);

    const regenerateFn = httpsCallable(functions, 'regenerateEnding');

    const steps = selectedBook.steps || [];
    const lastStep = steps[steps.length - 1];
    const nonLastSteps = steps.slice(0, -1);
    const previousContent = nonLastSteps
      .map(s => s.summary || s.content?.slice(0, 300) || '')
      .filter(Boolean)
      .join('\n');

    try {
      const result = await regenerateFn({
        title: selectedBook.title,
        genre: selectedBook.genre || '',
        synopsis: selectedBook.synopsis || '',
        characterSheet: selectedBook.characterSheet || '',
        settingSheet: selectedBook.settingSheet || '',
        previousContent,
        lastChapterName: lastStep?.name || '결말',
        style: style.id,
      });

      setGeneratedEnding(result.data.newEnding);
      setPhase('preview');
    } catch (err) {
      setError(err.message || '결말 생성에 실패했습니다. 다시 시도해주세요.');
      setPhase('style');
    }
  };

  const handleConfirm = async () => {
    if (!selectedBook || !selectedStyle || !generatedEnding) return;
    setError(null);

    const deductResult = await useItem('magic_eraser', 1);
    if (!deductResult.success) {
      setError(deductResult.error || '아이템 차감에 실패했습니다.');
      return;
    }

    const steps = selectedBook.steps || [];
    const lastStep = steps[steps.length - 1] || { name: '결말' };
    const newSteps = [
      ...steps.slice(0, -1),
      { ...lastStep, content: generatedEnding },
    ];
    const newContent = newSteps.map(s => s.content).join('\n\n');

    const bookData = {
      title: `${selectedBook.title} - ${selectedStyle.name} 에디션`,
      content: newContent,
      steps: newSteps,
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
      isEndingVariant: true,
      originalBookId: selectedBook.id,
      endingStyle: selectedStyle.id,
      createdAt: serverTimestamp(),
      hearts: 0,
      views: 0,
      commentsCount: 0,
      isPublic: false,
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'books'), bookData);
      setPhase('done');
    } catch (err) {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">🪄</span>
            <p className="font-black text-slate-800 dark:text-slate-100">마법 지우개</p>
            {phase === 'books' && <span className="text-[10px] font-bold text-slate-400">책 선택</span>}
            {phase === 'style' && <span className="text-[10px] font-bold text-slate-400">결말 스타일 선택</span>}
            {phase === 'generating' && <span className="text-[10px] font-bold text-emerald-500">생성 중...</span>}
            {phase === 'preview' && <span className="text-[10px] font-bold text-slate-400">미리보기</span>}
            {phase === 'done' && <span className="text-[10px] font-bold text-emerald-500">완료!</span>}
          </div>
          <button
            onClick={onClose}
            disabled={phase === 'generating'}
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
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">결말을 바꿀 내 작품을 선택하세요</p>
              {myBooks.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-4xl">📚</p>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">아직 작성한 작품이 없습니다.</p>
                  <p className="text-xs text-slate-400">집필 탭에서 글을 써보세요!</p>
                </div>
              ) : (
                myBooks.map(book => (
                  <button
                    key={book.id}
                    onClick={() => {
                      setSelectedBook(book);
                      setSelectedStyle(null);
                      setGeneratedEnding(null);
                      setError(null);
                      setPhase('style');
                    }}
                    className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{book.title}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {book.genre} · {book.steps?.length || 1}챕터
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
                <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">선택된 작품:</span>
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">{selectedBook?.title}</span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">새 결말 스타일을 선택하세요</p>
              {ENDING_STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-all text-left ${
                    selectedStyle?.id === style.id
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl">{style.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{style.name}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{style.desc}</p>
                  </div>
                  {selectedStyle?.id === style.id && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
                </button>
              ))}
              {error && <p className="text-xs text-red-500 font-bold text-center pt-1">{error}</p>}
            </div>
          )}

          {/* 생성 중 */}
          {phase === 'generating' && (
            <div className="px-5 py-16 text-center space-y-6">
              <span className="text-6xl animate-bounce inline-block">🪄</span>
              <div className="space-y-2">
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">새로운 결말을 작성 중...</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {selectedStyle?.emoji} {selectedStyle?.name} 스타일로 집필 중입니다
                </p>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">화면을 닫지 마세요.</p>
            </div>
          )}

          {/* 미리보기 */}
          {phase === 'preview' && (
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{selectedStyle?.emoji}</span>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">{selectedStyle?.name} 결말 미리보기</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-4 max-h-72 overflow-y-auto">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {generatedEnding}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                마음에 드시면 저장하세요. 마법 지우개 1개가 차감됩니다.
              </p>
              {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}
            </div>
          )}

          {/* 완료 */}
          {phase === 'done' && (
            <div className="px-5 py-10 text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
              <div className="space-y-1.5">
                <p className="text-base font-black text-slate-800 dark:text-slate-100">새 결말 저장 완료!</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedBook?.title} - {selectedStyle?.name} 에디션
                  </span>이<br />
                  내 서재에 저장되었습니다.
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-4 py-3">
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  🪄 마법 지우개 1개가 사용되었습니다
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
              닫기
            </button>
          )}
          {phase === 'style' && (
            <div className="space-y-2">
              <button
                onClick={() => handleGenerate()}
                disabled={!selectedStyle}
                className="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {selectedStyle ? `${selectedStyle.emoji} ${selectedStyle.name}으로 생성하기` : '스타일을 선택해 주세요'}
              </button>
              <button
                onClick={() => { setPhase('books'); setSelectedStyle(null); }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-400 dark:text-slate-500"
              >
                ← 책 다시 선택
              </button>
            </div>
          )}
          {phase === 'preview' && (
            <div className="space-y-2">
              <button
                onClick={handleConfirm}
                className="w-full py-3.5 rounded-xl text-sm font-black bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white transition-all"
              >
                🪄 이 결말로 저장하기
              </button>
              <button
                onClick={() => handleGenerate()}
                className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                다시 생성하기
              </button>
            </div>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl text-sm font-black bg-orange-500 text-white"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MagicEraserModal;
