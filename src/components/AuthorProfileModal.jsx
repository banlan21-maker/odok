// src/components/AuthorProfileModal.jsx
import React, { useState, useEffect } from 'react';
import { X, User, BookOpen } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { getLevelFromXp } from '../utils/levelUtils';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

// 대표작 점수 산출
const calcBookScore = (book) => {
  const views = book.views || 0;
  const likes = book.likes || 0;
  const comments = book.commentCount || 0;
  const bookmarks = book.favorites || 0;
  const completions = book.completions || 0;
  return views + likes * 5 + comments * 10 + bookmarks * 20 + completions * 50;
};

const AuthorProfileModal = ({
  targetUserId,
  books = [],
  currentUser,
  followAuthor,
  unfollowAuthor,
  isFollowing,
  onBookClick,
  onClose,
}) => {
  const [profile, setProfile] = useState(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // 해당 작가 프로필 실시간 구독
  useEffect(() => {
    if (!targetUserId) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', targetUserId, 'profile', 'info');
    const unsub = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
    return () => unsub();
  }, [targetUserId]);

  // 해당 작가의 책들
  const authorBooks = books.filter(b => b.authorId === targetUserId && !b.isAnonymous);

  // 대표작: 가장 높은 점수 1권
  const representativeBook = authorBooks.length > 0
    ? authorBooks.reduce((best, b) => calcBookScore(b) > calcBookScore(best) ? b : best, authorBooks[0])
    : null;

  // 대표작 제외 나머지 목록
  const otherBooks = representativeBook
    ? authorBooks.filter(b => b.id !== representativeBook.id)
    : authorBooks;

  const nickname = profile?.anonymousActivity ? '익명' : (profile?.nickname || '작가');
  const bio = profile?.bio || '';
  const profileImageUrl = profile?.anonymousActivity ? null : (profile?.profileImageUrl || null);
  const level = getLevelFromXp(profile?.xp ?? 0);
  const isMyself = currentUser?.uid === targetUserId;
  const following = isFollowing?.(targetUserId);

  const handleFollowToggle = async () => {
    if (!currentUser || isMyself || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      if (following) {
        await unfollowAuthor(targetUserId);
      } else {
        await followAuthor(targetUserId, nickname, profileImageUrl);
      }
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}>

        {/* 헤더 닫기 */}
        <div className="flex justify-end px-4 pt-4 pb-0 flex-none">
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="overflow-y-auto flex-1 pb-10">

          {/* ── 작가 헤더 ── */}
          <div className="px-5 pb-5 text-center space-y-3">
            {/* 프로필 이미지 */}
            <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 mx-auto border-4 border-white dark:border-slate-700 shadow-md">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt={nickname} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-10 h-10 text-slate-300" />
                </div>
              )}
            </div>

            {/* 닉네임 + 레벨 */}
            <div>
              <p className="text-xl font-black text-slate-800 dark:text-slate-100">{nickname}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Lv.{level} · 작품 {authorBooks.length}편</p>
            </div>

            {/* 소개말 */}
            {bio && (
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                {bio}
              </p>
            )}

            {/* 팔로우 버튼 */}
            {!isMyself && currentUser && (
              <button
                onClick={handleFollowToggle}
                disabled={isFollowLoading}
                className={`px-6 py-2 rounded-full text-sm font-black transition-all active:scale-95 disabled:opacity-60 ${
                  following
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-500'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                {isFollowLoading ? '...' : following ? '✓ 팔로잉' : '+ 팔로우'}
              </button>
            )}
          </div>

          {/* ── 대표작 ── */}
          {representativeBook && (
            <div className="mx-4 mb-5 rounded-2xl overflow-hidden shadow-md">
              {/* 블러 배경 */}
              <div className="relative">
                <img
                  src={getCoverImageFromBook(representativeBook)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: 'blur(16px)', transform: 'scale(1.2)', opacity: 0.7 }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80" />

                {/* 대표작 라벨 */}
                <div className="relative px-4 pt-4 pb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/30 rounded-full px-2.5 py-1">
                    ⭐ 대표작
                  </span>
                </div>

                {/* 책 정보 */}
                <div className="relative flex items-end gap-3 px-4 pb-4 pt-2">
                  <img
                    src={getCoverImageFromBook(representativeBook)}
                    alt={representativeBook.title}
                    className="w-16 h-24 rounded-xl object-cover shadow-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-white font-black text-base leading-tight line-clamp-2">
                      {representativeBook.title}
                    </p>
                    <p className="text-white/60 text-xs">{representativeBook.category}</p>
                    {/* 통계 */}
                    <div className="flex items-center gap-2 text-[11px] text-white/70">
                      <span>👁 {representativeBook.views || 0}</span>
                      <span>❤️ {representativeBook.likes || 0}</span>
                      <span>✅ {representativeBook.completions || 0}</span>
                    </div>
                    <button
                      onClick={() => { onBookClick(representativeBook); onClose(); }}
                      className="mt-1 px-4 py-1.5 bg-white text-slate-800 rounded-full text-xs font-black hover:bg-orange-50 transition-colors active:scale-95"
                    >
                      📖 바로 읽기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 집필 목록 ── */}
          {otherBooks.length > 0 && (
            <div className="px-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">집필 목록</p>
                <span className="text-xs text-slate-400">({otherBooks.length}편)</span>
              </div>
              {otherBooks.map(book => (
                <button
                  key={book.id}
                  onClick={() => { onBookClick(book); onClose(); }}
                  className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-xl p-3 transition-colors text-left"
                >
                  <img
                    src={getCoverImageFromBook(book)}
                    alt={book.title}
                    className="w-10 h-14 rounded-lg object-cover shrink-0 shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{book.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{book.category}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>👁 {book.views || 0}</span>
                      <span>❤️ {book.likes || 0}</span>
                      <span>✅ {book.completions || 0}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 책 없을 때 */}
          {authorBooks.length === 0 && profile && (
            <div className="text-center py-10 px-4 space-y-2">
              <p className="text-3xl">📝</p>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">아직 집필한 작품이 없어요</p>
            </div>
          )}

          {/* 로딩 */}
          {!profile && (
            <div className="text-center py-10">
              <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthorProfileModal;
