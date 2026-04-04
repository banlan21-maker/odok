import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft, Book, Share2, AlertTriangle, Languages, Star,
  MessageCircle, Send, Heart, X, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { formatGenreTag } from '../utils/formatGenre';
import { formatDate } from '../utils/dateUtils';
import ShareImageModal from './ShareImageModal';

// ─── 커스텀 선택 메뉴 ────────────────────────────────────────────
const SelectionMenu = ({ position, onHighlight, onShare, onClose }) => (
  <div
    className="fixed z-40 flex gap-0.5 bg-slate-900 dark:bg-slate-700 rounded-2xl shadow-2xl px-1 py-1"
    style={{
      top: position.y,
      left: Math.min(Math.max(position.x, 100), window.innerWidth - 100),
      transform: 'translate(-50%, -100%)',
      marginTop: '-8px',
    }}
  >
    {/* 말풍선 꼭지 */}
    <div
      style={{
        position: 'absolute', bottom: '-6px',
        left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid #0f172a',
      }}
    />
    <button
      className="px-3 py-2 rounded-xl text-xs font-black text-white hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors whitespace-nowrap"
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onHighlight(); }}
    >
      🎨 하이라이트 저장
    </button>
    <div className="w-px bg-slate-700 dark:bg-slate-500 my-1.5" />
    <button
      className="px-3 py-2 rounded-xl text-xs font-black text-orange-400 hover:bg-orange-500 hover:text-white transition-colors whitespace-nowrap"
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onShare(); }}
    >
      📢 공유하기
    </button>
  </div>
);

// ─── Mode 1: User Generated Book Reader ─────────────────────────
const BookReader = ({ book, onBack, fontSize, addHighlight }) => {
  const [menuInfo, setMenuInfo] = useState(null);   // { x, y, text }
  const [shareText, setShareText] = useState(null);
  const [savedToast, setSavedToast] = useState(false);
  const contentRef = useRef(null);
  const selectionTimerRef = useRef(null);

  const showMenuForSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || text.length < 2) return;
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return; // 유효하지 않은 rect 무시
      setMenuInfo({
        x: rect.left + rect.width / 2,
        y: rect.top,
        text,
      });
    } catch (e) { /* ignore */ }
  }, []);

  // selectionchange 디바운스 (Android 네이티브 선택 감지)
  useEffect(() => {
    const handleSelectionChange = () => {
      clearTimeout(selectionTimerRef.current);
      const selection = window.getSelection();
      if (!selection?.toString().trim()) {
        setMenuInfo(null);
        return;
      }
      selectionTimerRef.current = setTimeout(showMenuForSelection, 300);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      clearTimeout(selectionTimerRef.current);
    };
  }, [showMenuForSelection]);

  const closeMenu = useCallback(() => {
    setMenuInfo(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // 컨텍스트 메뉴 차단 (복사 방지)
  const handleContextMenu = (e) => e.preventDefault();

  // 바깥 터치 시 메뉴 닫기
  useEffect(() => {
    if (!menuInfo) return;
    const handleOutside = (e) => {
      if (!e.target.closest('.selection-menu-container')) {
        closeMenu();
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [menuInfo, closeMenu]);

  const handleSaveHighlight = async () => {
    if (!menuInfo?.text) return;
    const success = await addHighlight?.({
      text: menuInfo.text,
      bookId: book.id,
      bookTitle: book.title,
      authorNickname: book?.isAnonymous ? '익명' : (book.authorNickname || '익명'),
    });
    if (success !== false) {
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    }
    closeMenu();
  };

  const handleShareMenu = () => {
    setShareText(menuInfo.text);
    closeMenu();
  };

  return (
    <>
      <div
        className="space-y-6 animate-in slide-in-from-right-4 fade-in pb-20"
        onContextMenu={handleContextMenu}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700">
            <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex items-center gap-2">
            <Book className="w-5 h-5 text-orange-600" />
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">책 읽기</h1>
          </div>
        </div>

        {/* 책 정보 */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <span className="text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-full">
              {formatGenreTag(book.category)}
            </span>
            {(book.genre || book.subCategory) && (
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                {formatGenreTag(book.genre || book.subCategory)}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">{book.title}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {book?.isAnonymous ? '익명' : (book.authorNickname || '익명')} · {formatDate(book.createdAt, book.dateKey)}
          </p>
        </div>

        {/* 본문 — 텍스트 선택 허용, 시스템 메뉴만 차단 */}
        <div
          ref={contentRef}
          className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm ${fontSize || 'text-base'} leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line font-medium`}
          style={{ WebkitTouchCallout: 'none' }}
        >
          {book.content}
        </div>

        {/* 안내 배너 */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-2.5 border border-dashed border-slate-200 dark:border-slate-600 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            💡 텍스트를 길게 눌러 드래그하면 하이라이트 저장·공유가 가능해요
          </p>
        </div>
      </div>

      {/* 커스텀 선택 메뉴 */}
      {menuInfo && (
        <div className="selection-menu-container">
          <SelectionMenu
            position={{ x: menuInfo.x, y: menuInfo.y }}
            onHighlight={handleSaveHighlight}
            onShare={handleShareMenu}
            onClose={closeMenu}
          />
        </div>
      )}

      {/* 하이라이트 저장 완료 토스트 */}
      {savedToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2">
          🎨 하이라이트가 저장됐어요!
        </div>
      )}

      {/* 공유 이미지 모달 */}
      {shareText && (
        <ShareImageModal
          selectedText={shareText}
          bookTitle={book.title}
          authorName={book?.isAnonymous ? '익명' : (book.authorNickname || '익명')}
          onClose={() => setShareText(null)}
        />
      )}
    </>
  );
};

// ─── Main ReaderView ─────────────────────────────────────────────
const ReaderView = (props) => {
  // Mode 1: Simple Book Reader (User Generated)
  if (props.book && !props.currentStory) {
    const { book, onBack, fontSize = 'text-base', addHighlight } = props;
    return <BookReader book={book} onBack={onBack} fontSize={fontSize} addHighlight={addHighlight} />;
  }

  // Mode 2: AI Story Reader
  const {
    t, user, currentStory, readerLang, isTranslating, displayTitle, displayBody, fontSize, translateStory,
    toggleFavorite, isFavorited, handleShare, setIsReportModalOpen, currentStoryStats, getFavoriteCount,
    canFinishRead, finishReading, submitSeriesVote, myVote, getTodayString,
    ratings, submitRating, comments, commentInput, setCommentInput, replyTo, setReplyTo,
    submitComment, startEditComment, error, isSubmittingComment
  } = props;

  const [showTranslateMenu, setShowTranslateMenu] = useState(false);

  if (!currentStory) return <div className="p-10 text-center text-slate-400 dark:text-slate-500">Loading...</div>;

  const isSeries = currentStory.subGenre === 'series';
  const isVotingEnabled = isSeries && !currentStory.isFinal && getTodayString && currentStory.date === getTodayString();
  const myRating = ratings?.find(r => r.userId === user?.uid)?.stars;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-lg text-xs font-black">
            {currentStory.subGenreName || '단편'}
          </span>
          {currentStory.episode > 1 && (
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">#{currentStory.episode}화</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowTranslateMenu(!showTranslateMenu)} className={`p-2 rounded-full ${readerLang !== 'ko' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Languages className="w-5 h-5" />
          </button>
          <button onClick={() => toggleFavorite(currentStory)} className="p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700">
            <Heart className={`w-5 h-5 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
          </button>
          <button onClick={handleShare} className="p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700">
            <Share2 className="w-5 h-5 text-slate-400" />
          </button>
          <button onClick={() => setIsReportModalOpen(true)} className="p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700">
            <AlertTriangle className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Translate Menu */}
      {showTranslateMenu && (
        <div className="flex justify-end gap-2 mb-4 animate-in fade-in slide-in-from-top-2">
          <button onClick={() => translateStory('ko')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${readerLang === 'ko' ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>한국어</button>
          <button onClick={() => translateStory('en')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${readerLang === 'en' ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>English</button>
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm space-y-4 min-h-[50vh]" onContextMenu={(e) => e.preventDefault()}>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">{displayTitle}</h1>
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 border-b border-slate-50 dark:border-slate-700 pb-4">
          <span>{currentStory?.isAnonymous ? '익명' : (currentStory?.authorNickname || currentStory?.writerName || '익명')}</span>
          <span>·</span>
          <span>{currentStory.createdAt ? new Date(currentStory.createdAt).toLocaleDateString() : ''}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /><span>{currentStoryStats?.avg || "0.0"} ({currentStoryStats?.count || 0})</span></div>
          <div className="flex items-center gap-1"><Heart className="w-3 h-3 fill-red-400 text-red-400" /><span>{getFavoriteCount(currentStory.id)}</span></div>
        </div>

        {isTranslating ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm font-bold">{t.translating}</p>
          </div>
        ) : (
          <div className={`prose prose-slate max-w-none ${fontSize} leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line font-medium`}>
            {displayBody}
          </div>
        )}
      </div>

      {/* Finish Reading Button */}
      {!isTranslating && (
        <div className="flex justify-center py-4">
          <button
            onClick={finishReading}
            disabled={!canFinishRead}
            className={`px-8 py-3 rounded-full font-black text-sm transition-all shadow-lg shadow-orange-100 ${canFinishRead ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {canFinishRead ? t.finish_reading : t.read_more_time}
          </button>
        </div>
      )}

      {/* Series Voting */}
      {isVotingEnabled && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 space-y-4">
          <div className="text-center space-y-1">
            <h3 className="font-black text-slate-800 dark:text-slate-100">{t.vote_title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.vote_desc}</p>
          </div>
          {myVote ? (
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 text-center">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{t.voted}: {myVote === 'continue' ? t.vote_continue : t.vote_end}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => submitSeriesVote('continue')} className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-4 rounded-xl flex flex-col items-center gap-2 transition-colors">
                <ThumbsUp className="w-6 h-6" /><span className="font-bold text-sm">{t.vote_continue}</span>
              </button>
              <button onClick={() => submitSeriesVote('end')} className="bg-red-50 hover:bg-red-100 text-red-600 p-4 rounded-xl flex flex-col items-center gap-2 transition-colors">
                <ThumbsDown className="w-6 h-6" /><span className="font-bold text-sm">{t.vote_end}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ratings */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 space-y-4">
        <h3 className="font-black text-slate-800 dark:text-slate-100 text-center">{t.rating_title}</h3>
        {!myRating ? (
          <div className="flex justify-center gap-4">
            {[1, 2, 3].map((score) => (
              <button key={score} onClick={() => submitRating(score)} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center group-hover:bg-yellow-50 dark:group-hover:bg-yellow-900/20 transition-colors">
                  <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{score === 1 ? '😢' : score === 2 ? '😐' : '😍'}</span>
                </div>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-yellow-600">{score === 1 ? t.rating_1 : score === 2 ? t.rating_2 : t.rating_3}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 py-3 rounded-xl">
            <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">평가 완료: {myRating === 1 ? '😢' : myRating === 2 ? '😐' : '😍'}</span>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <h3 className="font-black text-slate-800 dark:text-slate-100 ml-1">{t.comments_title} ({comments.length})</h3>

        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-600 flex gap-2 shadow-sm min-h-[52px]">
          <textarea
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder={replyTo ? `${replyTo.nickname}${t.replying_to}...` : t.ach_comment_ph}
            className="flex-1 bg-transparent resize-none outline-none text-sm font-medium py-1 placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-100"
            rows={1}
          />
          {replyTo && (
            <button onClick={() => { setReplyTo(null); setCommentInput(""); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          )}
          <button
            onClick={submitComment}
            disabled={!commentInput.trim() || isSubmittingComment}
            className={`p-2 rounded-xl transition-all ${commentInput.trim() ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border ${comment.userId === user.uid ? 'border-orange-100 dark:border-orange-900/50' : 'border-slate-100 dark:border-slate-700'} space-y-2`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center">
                    {comment.userImage
                      ? <img src={comment.userImage} alt="" className="w-full h-full object-cover" />
                      : <span className="text-sm">👤</span>}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{comment.userNickname}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">{comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleDateString() : 'Now'}</span>
                  </div>
                </div>
                {comment.userId === user.uid && (
                  <button onClick={() => startEditComment(comment)} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">{t.edit}</button>
                )}
              </div>
              {comment.replyTo && (
                <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded inline-block">@{comment.replyToNickname}</div>
              )}
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed pb-1">{comment.text}</p>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400 dark:text-slate-500">
                <button onClick={() => { setReplyTo({ id: comment.id, nickname: comment.userNickname }); setCommentInput(""); }} className="hover:text-orange-500 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> {t.reply}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReaderView;
