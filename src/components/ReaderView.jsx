import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, Book, Share2, AlertTriangle, Languages, Star, MessageCircle, Send, Heart, MoreHorizontal, X, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { formatGenreTag } from '../utils/formatGenre';

const ReaderView = (props) => {
  // Mode 1: Simple Book Reader (User Generated)
  if (props.book && !props.currentStory) {
    const { book, onBack, fontSize = 'text-base' } = props;
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 fade-in pb-20">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-50">
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <Book className="w-5 h-5 text-orange-600" />
            <h1 className="text-lg font-black text-slate-800">책 읽기</h1>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">{formatGenreTag(book.category)}</span>
            {(book.genre || book.subCategory) && <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{formatGenreTag(book.genre || book.subCategory)}</span>}
          </div>
          <h2 className="text-2xl font-black text-slate-800 leading-tight">{book.title}</h2>
          <p className="text-xs text-slate-400">{book.authorNickname || '익명'} · {book.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '날짜 없음'}</p>
        </div>
        <div className={`prose prose-slate max-w-none ${fontSize} leading-relaxed text-slate-700 whitespace-pre-line bg-white rounded-2xl p-6 border border-slate-100 shadow-sm`}>
          {book.content}
        </div>
      </div>
    );
  }

  // Mode 2: AI Story Reader
  const {
    t, user, currentStory, readerLang, isTranslating, displayTitle, displayBody, fontSize, translateStory,
    toggleFavorite, isFavorited, handleShare, setIsReportModalOpen, currentStoryStats, getFavoriteCount,
    canFinishRead, finishReading, submitSeriesVote, myVote, voteCounts, getTodayString,
    ratings, submitRating, comments, commentInput, setCommentInput, editingCommentId, replyTo, setReplyTo,
    setEditingCommentId, submitComment, startEditComment, error, isSubmittingComment
  } = props;

  // Local state for UI
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);

  if (!currentStory) return <div className="p-10 text-center text-slate-400">Loading...</div>;

  const isSeries = currentStory.subGenre === 'series';
  const isVotingEnabled = isSeries && !currentStory.isFinal && getTodayString && currentStory.date === getTodayString();
  const myRating = ratings?.find(r => r.userId === user?.uid)?.stars;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-xs font-black">
            {currentStory.subGenreName || '단편'}
          </span>
          {currentStory.episode > 1 && <span className="text-xs font-bold text-slate-400">#{currentStory.episode}화</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowTranslateMenu(!showTranslateMenu)} className={`p-2 rounded-full ${readerLang !== 'ko' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Languages className="w-5 h-5" />
          </button>
          <button onClick={() => toggleFavorite(currentStory)} className="p-2 rounded-full hover:bg-slate-50">
            <Heart className={`w-5 h-5 ${isFavorited(currentStory.id) ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
          </button>
          <button onClick={handleShare} className="p-2 rounded-full hover:bg-slate-50"><Share2 className="w-5 h-5 text-slate-400" /></button>
          <button onClick={() => setIsReportModalOpen(true)} className="p-2 rounded-full hover:bg-slate-50"><AlertTriangle className="w-5 h-5 text-slate-400" /></button>
        </div>
      </div>

      {/* Translate Menu */}
      {showTranslateMenu && (
        <div className="flex justify-end gap-2 mb-4 animate-in fade-in slide-in-from-top-2">
          <button onClick={() => translateStory('ko')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${readerLang === 'ko' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>한국어</button>
          <button onClick={() => translateStory('en')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${readerLang === 'en' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>English</button>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-3xl p-6 shadow-sm space-y-4 min-h-[50vh]">
        <h1 className="text-2xl font-black text-slate-800 leading-tight">{displayTitle}</h1>
        <div className="flex items-center gap-3 text-xs text-slate-400 border-b border-slate-50 pb-4">
          <span>{currentStory.authorNickname}</span>
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
          <div className={`prose prose-slate max-w-none ${fontSize} leading-relaxed text-slate-700 whitespace-pre-line font-medium`}>
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
        <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-4">
          <div className="text-center space-y-1">
            <h3 className="font-black text-slate-800">{t.vote_title}</h3>
            <p className="text-xs text-slate-500">{t.vote_desc}</p>
          </div>
          {myVote ? (
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <span className="text-sm font-bold text-slate-600">{t.voted}: {myVote === 'continue' ? t.vote_continue : t.vote_end}</span>
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
      <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-4">
        <h3 className="font-black text-slate-800 text-center">{t.rating_title}</h3>
        {!myRating ? (
          <div className="flex justify-center gap-4">
            {[1, 2, 3].map((score) => (
              <button key={score} onClick={() => submitRating(score)} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-yellow-50 transition-colors">
                  <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{score === 1 ? '😢' : score === 2 ? '😐' : '😍'}</span>
                </div>
                <span className="text-xs font-bold text-slate-400 group-hover:text-yellow-600">{score === 1 ? t.rating_1 : score === 2 ? t.rating_2 : t.rating_3}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center bg-yellow-50 py-3 rounded-xl">
            <span className="text-sm font-bold text-yellow-700">평가 완료: {myRating === 1 ? '😢' : myRating === 2 ? '😐' : '😍'}</span>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <h3 className="font-black text-slate-800 ml-1">{t.comments_title} ({comments.length})</h3>

        {/* Comment Input */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 flex gap-2 shadow-sm min-h-[52px]">
          <textarea
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder={replyTo ? `${replyTo.nickname}${t.replying_to}...` : t.comment_placeholder}
            className="flex-1 bg-transparent resize-none outline-none text-sm font-medium py-1 placeholder:text-slate-300"
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

        {/* Comment List */}
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className={`bg-white p-4 rounded-xl border ${comment.userId === user.uid ? 'border-orange-100 bg-orange-50/10' : 'border-slate-100'} space-y-2`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden">
                    {comment.userImage ? <img src={comment.userImage} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-slate-400 m-2" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-slate-800">{comment.userNickname}</span>
                      <span className="text-[10px] text-slate-400">{comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleDateString() : 'Now'}</span>
                    </div>
                  </div>
                </div>
                {comment.userId === user.uid && (
                  <button onClick={() => startEditComment(comment)} className="text-xs font-bold text-slate-400 hover:text-slate-600">{t.edit}</button>
                )}
              </div>

              {comment.replyTo && (
                <div className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded inline-block">@{comment.replyToNickname}</div>
              )}

              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed pb-1">{comment.text}</p>

              <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
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
