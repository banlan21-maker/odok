// src/components/BookDetail.jsx
// 책 상세/뷰어 페이지 컴포넌트
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Book, Calendar, User, Heart, Send, Bookmark, CheckCircle } from 'lucide-react';
import { formatDateDetailed } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

const BookDetail = ({ book, onClose, fontSize = 'text-base', user, userProfile, appId }) => {
  if (!book) return null;
  
  // 수정 5: fontSize 값을 Tailwind 클래스로 매핑
  const fontSizeClass = fontSize === 'small' || fontSize === 'text-sm' ? 'text-sm' :
                        fontSize === 'medium' || fontSize === 'text-base' ? 'text-base' :
                        fontSize === 'large' || fontSize === 'text-lg' ? 'text-lg' :
                        fontSize === 'xlarge' || fontSize === 'text-xl' ? 'text-xl' :
                        'text-base';  // 기본값

  const dateString = formatDateDetailed(book.createdAt);
  const coverImage = getCoverImageFromBook(book);

  const categoryName = {
    'webnovel': '웹소설',
    'novel': '소설',
    'essay': '에세이',
    'self-improvement': '자기계발',
    'self-help': '자기계발',
    'humanities': '인문·철학'
  }[book.category] || book.category;

  const [likesCount, setLikesCount] = useState(book.likes || 0);
  const [favoritesCount, setFavoritesCount] = useState(book.favorites || 0);
  const [completionsCount, setCompletionsCount] = useState(book.completions || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [isBookFavorited, setIsBookFavorited] = useState(false);
  const [canComplete, setCanComplete] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [inkAmount, setInkAmount] = useState(1);
  const [isSendingInk, setIsSendingInk] = useState(false);

  const bookId = book.id;
  const likeDocId = useMemo(() => (user && bookId ? `${user.uid}_${bookId}` : null), [user, bookId]);
  const favoriteDocId = useMemo(() => (user && bookId ? `${user.uid}_${bookId}` : null), [user, bookId]);
  const completionDocId = useMemo(() => (user && bookId ? `${user.uid}_${bookId}` : null), [user, bookId]);

  useEffect(() => {
    if (!appId || !bookId) return;
    const bookRef = doc(db, 'artifacts', appId, 'books', bookId);
    return onSnapshot(bookRef, (snap) => {
      if (snap.exists()) {
        setLikesCount(snap.data().likes || 0);
        setFavoritesCount(snap.data().favorites || 0);
        setCompletionsCount(snap.data().completions || 0);
      }
    });
  }, [appId, bookId]);

  useEffect(() => {
    if (!appId || !likeDocId) {
      setIsLiked(false);
      return;
    }
    const likeRef = doc(db, 'artifacts', appId, 'public', 'data', 'book_likes', likeDocId);
    return onSnapshot(likeRef, (snap) => setIsLiked(snap.exists()));
  }, [appId, likeDocId]);

  useEffect(() => {
    if (!appId || !favoriteDocId) {
      setIsBookFavorited(false);
      return;
    }
    const favoriteRef = doc(db, 'artifacts', appId, 'public', 'data', 'book_favorites', favoriteDocId);
    return onSnapshot(favoriteRef, (snap) => setIsBookFavorited(snap.exists()));
  }, [appId, favoriteDocId]);

  useEffect(() => {
    if (!appId || !completionDocId) {
      setIsCompleted(false);
      return;
    }
    const completionRef = doc(db, 'artifacts', appId, 'public', 'data', 'book_completions', completionDocId);
    return onSnapshot(completionRef, (snap) => setIsCompleted(snap.exists()));
  }, [appId, completionDocId]);

  useEffect(() => {
    setCanComplete(false);
    const timer = setTimeout(() => setCanComplete(true), 10000);
    return () => clearTimeout(timer);
  }, [bookId]);

  useEffect(() => {
    if (!appId || !bookId) return;
    const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'book_comments');
    return onSnapshot(commentsRef, (snap) => {
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.bookId === bookId);
      // 부모 댓글 먼저, 대댓글은 부모 바로 아래로 정렬
      const parents = items.filter(c => !c.parentId).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      const sorted = [];
      parents.forEach(parent => {
        sorted.push(parent);
        const children = items
          .filter(c => c.parentId === parent.id)
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        sorted.push(...children);
      });
      setComments(sorted);
    });
  }, [appId, bookId]);

  const toggleLike = async () => {
    if (!user) {
      alert('좋아요는 로그인 후 사용할 수 있어요.');
      return;
    }
    if (!appId || !bookId || !likeDocId) return;
    const bookRef = doc(db, 'artifacts', appId, 'books', bookId);
    const likeRef = doc(db, 'artifacts', appId, 'public', 'data', 'book_likes', likeDocId);
    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(bookRef, { likes: increment(-1) });
      } else {
        await setDoc(likeRef, { bookId, createdAt: serverTimestamp() });
        await updateDoc(bookRef, { likes: increment(1) });
      }
    } catch (err) {
      console.error('좋아요 처리 실패:', err);
    }
  };

  const submitComment = async () => {
    if (!user) {
      alert('댓글은 로그인 후 작성할 수 있어요.');
      return;
    }
    if (!appId || !bookId) return;
    const text = commentInput.trim();
    if (!text) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'book_comments'), {
        bookId,
        userId: user.uid,
        authorName: userProfile?.nickname || '익명',
        text,
        parentId: replyTo?.id || null,
        parentAuthorName: replyTo?.authorName || null,
        createdAt: serverTimestamp()
      });
      setCommentInput('');
      setReplyTo(null);
    } catch (err) {
      console.error('댓글 등록 실패:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      alert('즐겨찾기는 로그인 후 사용할 수 있어요.');
      return;
    }
    if (!appId || !bookId || !favoriteDocId) return;
    const favoriteRef = doc(db, 'artifacts', appId, 'public', 'data', 'book_favorites', favoriteDocId);
    const bookRef = doc(db, 'artifacts', appId, 'books', bookId);
    try {
      if (isBookFavorited) {
        await deleteDoc(favoriteRef);
        await updateDoc(bookRef, { favorites: increment(-1) });
      } else {
        await setDoc(favoriteRef, { userId: user.uid, bookId, createdAt: serverTimestamp() });
        await updateDoc(bookRef, { favorites: increment(1) });
      }
    } catch (err) {
      console.error('즐겨찾기 처리 실패:', err);
    }
  };

  const submitCompletion = async () => {
    if (!user) {
      alert('완독은 로그인 후 사용할 수 있어요.');
      return;
    }
    if (!canComplete) {
      alert('책 페이지에서 3분 이상 머문 후 완독이 가능합니다.');
      return;
    }
    if (!appId || !bookId || !completionDocId) return;
    if (isCompleted) return;
    const completionRef = doc(db, 'artifacts', appId, 'public', 'data', 'book_completions', completionDocId);
    const bookRef = doc(db, 'artifacts', appId, 'books', bookId);
    try {
      await setDoc(completionRef, { userId: user.uid, bookId, createdAt: serverTimestamp() });
      await updateDoc(bookRef, { completions: increment(1) });
    } catch (err) {
      console.error('완독 처리 실패:', err);
    }
  };

  const sendInkToAuthor = async () => {
    if (!user) {
      alert('로그인 후 사용할 수 있어요.');
      return;
    }
    if (!book?.authorId) {
      alert('작가 정보를 찾을 수 없습니다.');
      return;
    }
    if (book.authorId === user.uid) {
      alert('본인에게는 잉크를 보낼 수 없어요.');
      return;
    }
    const amount = Math.min(10, Math.max(1, Number(inkAmount) || 1));
    if (!appId) return;
    setIsSendingInk(true);
    try {
      const senderRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      const receiverRef = doc(db, 'artifacts', appId, 'users', book.authorId, 'profile', 'info');
      await runTransaction(db, async (tx) => {
        const senderSnap = await tx.get(senderRef);
        const receiverSnap = await tx.get(receiverRef);
        const senderInk = senderSnap.exists() ? (senderSnap.data().ink || 0) : 0;
        const receiverInk = receiverSnap.exists() ? (receiverSnap.data().ink || 0) : 0;
        if (senderInk < amount) {
          throw new Error('잉크가 부족합니다.');
        }
        const nextReceiverInk = Math.min(999, receiverInk + amount);
        tx.update(senderRef, { ink: senderInk - amount });
        tx.set(receiverRef, { ink: nextReceiverInk }, { merge: true });
      });
      alert(`잉크 ${amount}개를 보냈습니다!`);
    } catch (err) {
      console.error('잉크 보내기 실패:', err);
      alert(err?.message || '잉크 보내기에 실패했습니다.');
    } finally {
      setIsSendingInk(false);
    }
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text || '');
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const startReply = (comment) => {
    setReplyTo({
      id: comment.id,
      authorName: comment.authorName || '익명'
    });
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const saveEditComment = async (commentId) => {
    if (!user || !appId) return;
    const text = editingText.trim();
    if (!text) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'book_comments', commentId), {
        text,
        editedAt: serverTimestamp()
      });
      cancelEditComment();
    } catch (err) {
      console.error('댓글 수정 실패:', err);
    }
  };

  const deleteComment = async (commentId) => {
    if (!user || !appId) return;
    const ok = confirm('댓글을 삭제할까요?');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'book_comments', commentId));
    } catch (err) {
      console.error('댓글 삭제 실패:', err);
    }
  };

  return (
    <div className="animate-in slide-in-from-right-4 fade-in pb-20">
      {/* 헤더 */}
      <div className="mb-6 space-y-4">
        <button 
          onClick={onClose} 
          className="p-2 -ml-2 rounded-full hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-slate-600" />
        </button>
        
        {/* 표지 이미지 및 기본 정보 */}
        <div className="flex gap-4">
          <div className="w-24 h-32 rounded-lg overflow-hidden shrink-0 bg-slate-100 shadow-md">
            <img 
              src={coverImage} 
              alt={book.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // 이미지 로드 실패 시 기본 아이콘으로 대체
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center hidden">
              <Book className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0 space-y-3">
            <h1 className="text-2xl font-black text-slate-800 leading-tight">
              {book.title}
            </h1>
            
            {/* 메타 정보 */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <User className="w-3.5 h-3.5" />
                <span className="font-bold">{book.authorName || '익명'}</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{dateString}</span>
              </div>
            </div>

            {/* 카테고리/장르 태그 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
                {categoryName}
              </span>
              {book.subCategory && (
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                  {book.subCategory}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 본문 내용 */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="prose prose-slate max-w-none mb-6">
          {/* 수정 5: fontSize를 동적으로 적용 */}
          <div className={`${fontSizeClass} leading-relaxed text-slate-700 whitespace-pre-line`}>
            {book.content || book.summary || '내용이 없습니다.'}
          </div>
        </div>

        {/* 하단 통계 (옵션) */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex-wrap">
          <div className="flex items-center gap-1">
            <Book className="w-3.5 h-3.5" />
            <span>조회 {book.views || 0}회</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" />
            <span>좋아요 {likesCount}회</span>
          </div>
          <div className="flex items-center gap-1">
            <Bookmark className="w-3.5 h-3.5" />
            <span>즐겨찾기 {favoritesCount}회</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>완독 {completionsCount}회</span>
          </div>
        </div>
      </div>

      {/* 좋아요 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex justify-start">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              isLiked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            좋아요
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <button
            onClick={submitCompletion}
            disabled={!canComplete || isCompleted}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              isCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-600'
            } disabled:bg-slate-100 disabled:text-slate-400`}
            title={!canComplete ? '3분 이상 머문 뒤 완독 가능합니다' : undefined}
          >
            <CheckCircle className={`w-4 h-4 ${isCompleted ? 'fill-emerald-400 text-emerald-600' : ''}`} />
            {isCompleted ? '완독됨' : '완독'}
          </button>
        </div>
        <div className="flex-1 flex justify-end">
          <button
            onClick={toggleFavorite}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              isBookFavorited ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isBookFavorited ? 'fill-amber-400 text-amber-600' : ''}`} />
            즐겨찾기
          </button>
        </div>
      </div>
      {!user && <p className="text-xs text-slate-400">로그인 후 사용 가능</p>}

      {/* 잉크 보내기 */}
      <div className="flex items-center justify-center gap-3 mt-5">
        <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          잉크쏘기
        </span>
        <select
          value={inkAmount}
          onChange={(e) => setInkAmount(e.target.value)}
          className="text-sm border border-blue-200 rounded-full px-3 py-1.5 bg-white text-blue-700 font-bold"
        >
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <option key={n} value={n}>{n}개</option>
          ))}
        </select>
        <button
          onClick={sendInkToAuthor}
          disabled={isSendingInk || !user}
          className="px-4 py-2 rounded-full text-sm font-black bg-blue-500 text-white hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSendingInk ? '보내는 중...' : '보내기'}
        </button>
      </div>
      <p className="text-xs text-slate-500 text-center mt-2">
        작품이 마음에 드셨다면 응원 한마디와 잉크를 쏴주세요
      </p>

      {/* 댓글 */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-700">댓글 {comments.length}개</h3>
        <div className="space-y-3 max-h-80 overflow-auto pr-1">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400">첫 댓글을 남겨보세요.</p>
          ) : (
            comments.map((c) => {
              const isMine = user && c.userId === user.uid;
              const isEditing = editingCommentId === c.id;
              const isReply = Boolean(c.parentId);
              return (
                <div
                  key={c.id}
                  className={`text-sm ${
                    isMine ? 'bg-amber-50/60 border border-amber-100 rounded-xl p-3' : 'text-slate-700'
                  } ${isReply ? 'ml-6 border-l-2 border-slate-100 pl-3' : ''}`}
                >
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span className="font-bold text-slate-600">{c.authorName || '익명'}</span>
                    {isMine && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">내 댓글</span>}
                    {isReply && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        ↳ {c.parentAuthorName || '익명'}에게 답글
                      </span>
                    )}
                    <span>·</span>
                    <span>{c.createdAt?.toDate?.()?.toLocaleString('ko-KR') || '방금 전'}</span>
                    {c.editedAt && <span>· 수정됨</span>}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400"
                        maxLength={200}
                      />
                      <div className="flex items-center gap-2 text-xs">
                        <button onClick={() => saveEditComment(c.id)} className="px-2 py-1 rounded-md bg-orange-500 text-white font-bold">저장</button>
                        <button onClick={cancelEditComment} className="px-2 py-1 rounded-md text-slate-500">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-line">{c.text}</div>
                  )}
                  {!isEditing && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <button onClick={() => startReply(c)} className="hover:text-slate-700">답글</button>
                      {isMine && (
                        <>
                          <span>·</span>
                          <button onClick={() => startEditComment(c)} className="hover:text-slate-700">수정</button>
                          <span>·</span>
                          <button onClick={() => deleteComment(c.id)} className="hover:text-rose-500">삭제</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder={replyTo ? `${replyTo.authorName}님에게 답글 작성` : '댓글을 입력하세요'}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400"
            maxLength={200}
          />
          <button
            onClick={submitComment}
            disabled={isSubmitting || !commentInput.trim()}
            className="px-3 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:bg-slate-200 disabled:text-slate-400"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {replyTo && (
          <div className="text-xs text-slate-500">
            {replyTo.authorName}님에게 답글 작성 중 · <button onClick={cancelReply} className="text-slate-600 hover:text-slate-800">취소</button>
          </div>
        )}
        <p className="text-xs text-slate-400">댓글은 200자 이내로 작성하세요.</p>
      </div>
    </div>
  );
};

export default BookDetail;
