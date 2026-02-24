// src/components/BookDetail.jsx
// 책 상세/뷰어 페이지 컴포넌트
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { ChevronLeft, ChevronRight, Book, Calendar, User, Heart, Send, Bookmark, CheckCircle, PenTool, RefreshCw, Trash2, Eye, Megaphone } from 'lucide-react';
import { formatDateDetailed } from '../utils/dateUtils';
import { getCoverImageFromBook } from '../utils/bookCovers';
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, increment, runTransaction, getDoc } from 'firebase/firestore';
import { deleteBookAdmin } from '../utils/aiService';
import { db } from '../firebase';
import { generateSeriesEpisode } from '../utils/aiService';
import { getTodayDateKey } from '../utils/dateUtils';
import { getExtraWriteInkCost, getFreeWriteRewardInk, canDonate, getLevelFromXp, getXpPerInk } from '../utils/levelUtils';
import { formatGenreTag } from '../utils/formatGenre';

const DAILY_WRITE_LIMIT = 2;
const DAILY_FREE_WRITES = 1;
const INK_MAX = 999;

const BookDetail = ({ book, onClose, onBookUpdate, fontSize = 'text-base', user, userProfile, appId, slotStatus, deductInk, t, isAdmin, authorProfiles = {}, promotions = [], createPromotion }) => {
  if (!book) return null;

  // 관리자: 모든 책 수정/삭제 가능. 일반 사용자: 본인 책만 수정/삭제 가능
  const canEditOrDelete = isAdmin || book.authorId === user?.uid;

  // 수정 5: fontSize 값을 Tailwind 클래스로 매핑
  const fontSizeClass = fontSize === 'small' || fontSize === 'text-sm' ? 'text-sm' :
    fontSize === 'medium' || fontSize === 'text-base' ? 'text-base' :
      fontSize === 'large' || fontSize === 'text-lg' ? 'text-lg' :
        fontSize === 'xlarge' || fontSize === 'text-xl' ? 'text-xl' :
          'text-base';  // 기본값

  const dateString = formatDateDetailed(book.createdAt, book.dateKey);
  const coverImage = getCoverImageFromBook(book);

  const categoryName = {
    'webnovel': '웹소설',
    'novel': '소설',
    'essay': '에세이',
    'self-improvement': '자기계발',
    'self-help': '자기계발',
    'humanities': '인문·철학',
    'series': '시리즈'
  }[book.category] || book.category;

  const isSeries = book.isSeries === true || book.category === 'series';
  const episodes = (isSeries && book.episodes) ? book.episodes : [];
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(episodes.length > 0 ? episodes.length - 1 : 0);
  const [showContinuationModal, setShowContinuationModal] = useState(false);
  const [showEndingStyleModal, setShowEndingStyleModal] = useState(false);
  const endingStyleItems = [
    { id: 'closed_happy', value: '닫힌 결말 (해피 엔딩)' },
    { id: 'closed_sad', value: '닫힌 결말 (비극/새드 엔딩)' },
    { id: 'open', value: '열린 결말 (여운을 남김)' },
    { id: 'twist', value: '반전 결말 (충격적인 반전)' },
    { id: 'bookend', value: '수미상관 (처음과 끝이 연결됨)' }
  ];
  const [isGeneratingEpisode, setIsGeneratingEpisode] = useState(false);
  const [isGeneratingEpisodeModalHidden, setIsGeneratingEpisodeModalHidden] = useState(false);
  const [episodeLoadingMessageIndex, setEpisodeLoadingMessageIndex] = useState(0);
  const [showSeriesCompleteModal, setShowSeriesCompleteModal] = useState(null); // { isFinale } | null
  const contentAreaRef = useRef(null);
  const episodeLoadingMessages = [
    '다음 화를 구상하고 있습니다...',
    '이전 내용과 연결 중...',
    '문장을 다듬고 있습니다...',
    '거의 다 됐어요! 잉크를 말리는 중...'
  ];

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promoText, setPromoText] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSavingContent, setIsSavingContent] = useState(false);

  // 시리즈 집필 중 화면 꺼짐 방지
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const toggleWakeLock = async () => {
      try {
        if (isGeneratingEpisode) {
          await KeepAwake.keepAwake();
        } else {
          await KeepAwake.allowSleep();
        }
      } catch (err) {
        console.warn('KeepAwake error:', err);
      }
    };
    toggleWakeLock();
    return () => {
      KeepAwake.allowSleep().catch(() => { });
    };
  }, [isGeneratingEpisode]);

  const handleAdminStartEditContent = () => {
    const content = isSeries && currentEpisode ? currentEpisode.content : (book.content || '');
    setEditedContent(content);
    setIsEditingContent(true);
  };

  const handleAdminCancelEditContent = () => {
    setIsEditingContent(false);
    setEditedContent('');
  };

  const handleAdminSaveContent = async () => {
    if (!canEditOrDelete || !appId || !bookId || isSavingContent) return;
    setIsSavingContent(true);
    try {
      const bookRef = doc(db, 'artifacts', appId, 'books', bookId);
      if (isSeries && episodes.length > 0) {
        const newEpisodes = [...episodes];
        newEpisodes[currentEpisodeIndex] = { ...newEpisodes[currentEpisodeIndex], content: editedContent.trim() };
        await updateDoc(bookRef, { episodes: newEpisodes, updatedAt: serverTimestamp() });
      } else {
        await updateDoc(bookRef, { content: editedContent.trim(), updatedAt: serverTimestamp() });
      }
      const updatedBook = isSeries
        ? { ...book, episodes: [...episodes], updatedAt: { toDate: () => new Date() } }
        : { ...book, content: editedContent.trim(), updatedAt: { toDate: () => new Date() } };
      if (isSeries && episodes.length > 0) {
        const newEps = [...episodes];
        newEps[currentEpisodeIndex] = { ...newEps[currentEpisodeIndex], content: editedContent.trim() };
        updatedBook.episodes = newEps;
      }
      if (typeof onBookUpdate === 'function') onBookUpdate(updatedBook);
      setIsEditingContent(false);
      setEditedContent('');
      alert(t?.admin_edit_success || '내용이 저장되었습니다.');
    } catch (err) {
      console.error('책 내용 수정 실패:', err);
      alert(t?.admin_edit_fail || '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleAdminDeleteBook = async () => {
    if (!canEditOrDelete || !appId || !bookId) return;
    setIsDeleting(true);
    try {
      await deleteBookAdmin({ appId, bookId });
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('책 삭제 실패:', err);
      alert(t?.admin_delete_fail || err?.message || '삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  const currentEpisode = isSeries && episodes.length > 0 ? episodes[currentEpisodeIndex] : null;
  const displayContent = isSeries ? (currentEpisode?.content || '') : (book.content || '');
  const isLastEpisode = isSeries && currentEpisodeIndex === episodes.length - 1;
  const seriesSlotTaken = !!(slotStatus?.series);

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

  const [timeLeft, setTimeLeft] = useState(180);

  useEffect(() => {
    setCanComplete(false);
    setTimeLeft(180); // 3분에서 시작

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bookId]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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

  // 시리즈 다음 화 집필 중 로딩 메시지 순환
  useEffect(() => {
    if (!isGeneratingEpisode || episodeLoadingMessages.length === 0) return;
    const timer = setInterval(() => {
      setEpisodeLoadingMessageIndex((i) => (i + 1) % episodeLoadingMessages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isGeneratingEpisode, episodeLoadingMessages.length]);

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
        authorName: userProfile?.anonymousActivity ? '익명' : (userProfile?.nickname || '익명'),
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
    const senderLevel = getLevelFromXp(userProfile?.xp ?? 0);
    if (!canDonate(senderLevel)) {
      alert('작가 등급(Lv.11)부터 선물하기가 가능합니다.');
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
        const senderXp = senderSnap.exists() ? (senderSnap.data().xp ?? 0) : 0;
        const xpGain = amount * getXpPerInk();
        const newXp = senderXp + xpGain;
        const newLevel = getLevelFromXp(newXp);
        const nextReceiverInk = Math.min(INK_MAX, receiverInk + amount);
        tx.update(senderRef, {
          ink: senderInk - amount,
          xp: newXp,
          total_ink_spent: increment(amount),
          level: newLevel
        });
        tx.set(receiverRef, { ink: nextReceiverInk }, { merge: true });
        tx.set(doc(db, 'artifacts', appId, 'users', user.uid, 'ink_history', `donation_${Date.now()}_${book.id}`), {
          reason: 'donation_sent',
          amount: -amount,
          toUserId: book.authorId,
          bookId: book.id,
          createdAt: serverTimestamp()
        });
        tx.set(doc(db, 'artifacts', appId, 'users', book.authorId, 'ink_history', `donation_${Date.now()}_${user.uid}`), {
          reason: 'donation_received',
          amount,
          fromUserId: user.uid,
          bookId: book.id,
          createdAt: serverTimestamp()
        });
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

  const handleWriteNextEpisode = async (continuationType, endingStyle = null) => {
    if (!user || !appId || !isSeries) return;
    if (seriesSlotTaken) {
      alert('오늘 시리즈 집필은 마감되었어요.');
      return;
    }
    // 하루 집필 횟수 제한 (시리즈 다음 화도 1회로 카운트)
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    const profileSnap = await getDoc(profileRef);
    const todayKey = getTodayDateKey();
    let dailyWriteCount = 0;
    let lastBookCreatedDate = null;
    if (profileSnap.exists()) {
      const d = profileSnap.data();
      lastBookCreatedDate = d.lastBookCreatedDate;
      dailyWriteCount = Number(d.dailyWriteCount || 0);
    }
    if (lastBookCreatedDate !== todayKey) dailyWriteCount = 0;
    if (dailyWriteCount >= DAILY_WRITE_LIMIT) {
      alert('하루에 최대 2회까지만 집필할 수 있어요.');
      return;
    }

    // 2회째 집필 시 잉크 소모 (레벨에 따라 할인)
    if (dailyWriteCount >= DAILY_FREE_WRITES) {
      const level = getLevelFromXp(profileSnap.exists() ? (profileSnap.data().xp ?? 0) : 0);
      const extraCost = getExtraWriteInkCost(level);
      const currentInk = profileSnap.exists() ? Number(profileSnap.data().ink || 0) : 0;
      if (currentInk < extraCost) {
        alert('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
        return;
      }
      if (typeof deductInk !== 'function') {
        alert('잉크 차감 기능을 사용할 수 없습니다.');
        return;
      }
      const success = await deductInk(extraCost);
      if (!success) {
        alert('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        return;
      }
    }

    setShowContinuationModal(false);
    setShowEndingStyleModal(false);
    setIsGeneratingEpisode(true);
    setIsGeneratingEpisodeModalHidden(false);
    const dssRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_series_slot', todayKey);
    let claimCreated = false;

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(dssRef);
        if (snap.exists()) throw new Error('SLOT_TAKEN');
        tx.set(dssRef, {
          bookId: book.id,
          authorId: user.uid,
          authorName: userProfile?.anonymousActivity ? '익명' : (userProfile?.nickname || '익명'),
          isAnonymous: !!userProfile?.anonymousActivity,
          type: 'episode',
          createdAt: serverTimestamp()
        });
      });
      claimCreated = true;

      const lastEpisode = episodes[episodes.length - 1];
      const result = await generateSeriesEpisode({
        seriesId: book.seriesId || book.id,
        category: book.category,
        subCategory: book.subCategory,
        genre: book.subCategory,
        keywords: book.keywords || '',
        title: book.title,
        cumulativeSummary: book.summary || '',
        lastEpisodeContent: lastEpisode?.content || '',
        synopsis: book.synopsis || '',
        characterSheet: book.characterSheet || '',
        settingSheet: book.settingSheet || '',
        continuationType,
        selectedMood: book.selectedMood || '',
        selectedPOV: book.selectedPOV || null,
        selectedSpeechTone: book.selectedSpeechTone || null,
        selectedDialogueRatio: book.selectedDialogueRatio || null,
        endingStyle
      });

      const newEpisode = {
        ep_number: episodes.length + 1,
        title: result.isFinale ? `${book.title} [완결]` : `${book.title} ${episodes.length + 1}화`,
        content: result.content,
        writer: user.uid,
        writerName: userProfile?.anonymousActivity ? '익명' : (userProfile?.nickname || '익명'),
        isAnonymous: !!userProfile?.anonymousActivity,
        createdAt: new Date().toISOString(),
        summary: result.summary
      };

      const bookRef = doc(db, 'artifacts', appId, 'books', book.id);
      const updateData = {
        episodes: [...episodes, newEpisode],
        summary: result.cumulativeSummary,
        updatedAt: serverTimestamp()
      };
      if (result.isFinale) updateData.status = 'completed';

      await updateDoc(bookRef, updateData);
      setCurrentEpisodeIndex(episodes.length);

      const updatedBook = { ...book, episodes: [...episodes, newEpisode], summary: result.cumulativeSummary, ...(result.isFinale ? { status: 'completed' } : {}) };
      if (typeof onBookUpdate === 'function') onBookUpdate(updatedBook);

      // 시리즈 다음 화 집필도 하루 집필 1회로 카운트 + 잉크 보상 (1회 무료 시 레벨별 보상)
      const nextDailyWriteCount = lastBookCreatedDate === todayKey ? dailyWriteCount + 1 : 1;
      const level = profileSnap.exists() ? (profileSnap.data().level || 1) : 1;
      const rewardInk = dailyWriteCount === 0 ? getFreeWriteRewardInk(level) : 0;
      const currentInk = profileSnap.exists() ? Number(profileSnap.data().ink || 0) : 0;
      await updateDoc(profileRef, {
        dailyWriteCount: nextDailyWriteCount,
        lastBookCreatedDate: todayKey,
        ink: Math.min(INK_MAX, currentInk + rewardInk)
      });

      setShowSeriesCompleteModal({ isFinale: result.isFinale });
    } catch (err) {
      if (claimCreated) {
        try { await deleteDoc(dssRef); } catch (e) { console.warn('클레임 해제 실패', e); }
      }
      if (err?.message === 'SLOT_TAKEN') {
        alert('오늘 시리즈 집필은 마감되었어요.');
        return;
      }
      console.error('시리즈 이어쓰기 실패:', err);
      alert(err?.message || '시리즈 집필에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGeneratingEpisode(false);
    }
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

  const EpisodeGeneratingNotice = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200 font-bold">
          집필 중입니다…
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          다음 화 생성에는 약 2~3분이 소요될 수 있어요.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          숨기면 다른 화면을 보면서 기다릴 수 있어요.
        </p>
        {episodeLoadingMessages[episodeLoadingMessageIndex] && (
          <p className="text-xs text-slate-500 font-bold">
            {episodeLoadingMessages[episodeLoadingMessageIndex]}
          </p>
        )}
        <button
          onClick={() => setIsGeneratingEpisodeModalHidden(true)}
          className="w-full py-3 rounded-xl text-sm font-black bg-slate-900 text-white hover:bg-slate-800"
        >
          숨기기
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="animate-in slide-in-from-right-4 fade-in pb-20">
        {/* 헤더 */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </button>
            {canEditOrDelete && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleAdminStartEditContent}
                  disabled={isEditingContent}
                  className="p-2 rounded-full hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                  title={t?.admin_edit_content || '내용 수정'}
                >
                  <PenTool className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                  title={t?.admin_delete_book || '책 삭제'}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* 표지 이미지 및 기본 정보 */}
          <div className="flex gap-4">
            <div className="w-24 h-32 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 shadow-md">
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
              <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                {book.title}
              </h1>

              {/* 메타 정보 */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>{book?.isAnonymous ? '🌱' : (authorProfiles[book.authorId]?.gradeIcon || '🌱')}</span>
                  <span className="font-bold">{book?.isAnonymous ? '익명' : (authorProfiles[book.authorId]?.nickname || book?.authorName || '익명')}</span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{dateString}</span>
                </div>
              </div>

              {/* 카테고리/장르 태그 + 홍보하기 버튼 (한 줄: 왼쪽 카테고리, 오른쪽 홍보) */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
                    {categoryName}
                  </span>
                  {book.subCategory && (
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold">
                      {formatGenreTag(book.subCategory)}
                    </span>
                  )}
                </div>
                {book.authorId === user?.uid && (
                  (() => {
                    const isAlreadyPromoted = promotions.some(p => p.bookId === book.id);
                    return isAlreadyPromoted ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold shrink-0">
                        <Megaphone className="w-3.5 h-3.5" />
                        {t.promo_active}
                      </span>
                    ) : (
                      <button
                        onClick={() => setShowPromotionModal(true)}
                        className="inline-flex items-center gap-1.5 bg-violet-100 text-violet-600 hover:bg-violet-200 px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0"
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        {t.promo_button}
                      </button>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 시리즈 네비게이션 */}
        {isSeries && episodes.length > 0 && (
          <div className="mb-4 flex items-center justify-between bg-orange-50 px-4 py-2 rounded-xl">
            <button
              onClick={() => setCurrentEpisodeIndex(Math.max(0, currentEpisodeIndex - 1))}
              disabled={currentEpisodeIndex === 0 || isEditingContent}
              className="p-2 rounded-lg hover:bg-orange-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-orange-600" />
            </button>
            <div className="text-sm font-black text-orange-600">
              제 {currentEpisodeIndex + 1} 화 {book.status === 'completed' && currentEpisodeIndex === episodes.length - 1 ? '[완결]' : ''}
            </div>
            <button
              onClick={() => setCurrentEpisodeIndex(Math.min(episodes.length - 1, currentEpisodeIndex + 1))}
              disabled={currentEpisodeIndex === episodes.length - 1 || isEditingContent}
              className="p-2 rounded-lg hover:bg-orange-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5 text-orange-600" />
            </button>
          </div>
        )}

        {/* 본문 내용 - 관리자 수정 모드 */}
        <div ref={contentAreaRef} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          {isEditingContent ? (
            <div className="space-y-3">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className={`w-full min-h-[300px] p-4 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 ${fontSizeClass} text-slate-700 leading-relaxed resize-y focus:ring-2 focus:ring-amber-500 focus:border-amber-500`}
                placeholder={t?.no_content || '내용이 없습니다.'}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdminSaveContent}
                  disabled={isSavingContent}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {isSavingContent ? (t?.saving || '저장 중...') : (t?.admin_save_content || '저장')}
                </button>
                <button
                  onClick={handleAdminCancelEditContent}
                  disabled={isSavingContent}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  {t?.admin_cancel_edit || '취소'}
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-slate max-w-none mb-6">
              {/* 수정 5: fontSize를 동적으로 적용 */}
              <div className={`${fontSizeClass} leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line`}>
                {displayContent || book.summary || (t?.no_content || '내용이 없습니다.')}
              </div>
            </div>
          )}

          {/* 시리즈 회차 이동 (본문 직하단) - 소설 끝나자마자 바로 다음 화로 이동 가능 */}
          {isSeries && episodes.length > 0 && (
            <div className="mb-4 flex items-center justify-between bg-orange-50 px-4 py-2 rounded-xl">
              <button
                onClick={() => setCurrentEpisodeIndex(Math.max(0, currentEpisodeIndex - 1))}
                disabled={currentEpisodeIndex === 0 || isEditingContent}
                className="p-2 rounded-lg hover:bg-orange-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5 text-orange-600" />
              </button>
              <div className="text-sm font-black text-orange-600">
                제 {currentEpisodeIndex + 1} 화 {book.status === 'completed' && currentEpisodeIndex === episodes.length - 1 ? '[완결]' : ''}
              </div>
              <button
                onClick={() => setCurrentEpisodeIndex(Math.min(episodes.length - 1, currentEpisodeIndex + 1))}
                disabled={currentEpisodeIndex === episodes.length - 1 || isEditingContent}
                className="p-2 rounded-lg hover:bg-orange-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5 text-orange-600" />
              </button>
            </div>
          )}

          {/* 하단 통계 (옵션) */}
          <div className="flex items-center justify-around pt-4 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{book.views || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" />
              <span>{likesCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Bookmark className="w-3.5 h-3.5" />
              <span>{favoritesCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{completionsCount}</span>
            </div>
          </div>
        </div>

        {/* 좋아요 / 완독 / 즐겨찾기 */}
        <div className="flex items-stretch justify-around">
          <button
            onClick={toggleLike}
            className={`flex flex-col items-center gap-1 px-5 py-2.5 rounded-2xl text-xs font-bold border transition-colors ${isLiked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            {t?.like_btn || "좋아요"}
          </button>
          <button
            onClick={submitCompletion}
            disabled={!canComplete || isCompleted}
            className={`flex flex-col items-center gap-1 px-5 py-2.5 rounded-2xl text-xs font-bold border transition-colors ${isCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              } disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:text-slate-400`}
            title={!canComplete ? (t?.read_more_time || '3분 이상 머문 뒤 완독 가능합니다') : undefined}
          >
            <CheckCircle className={`w-5 h-5 ${isCompleted ? 'fill-emerald-400 text-emerald-600' : ''}`} />
            {isCompleted ? (t?.reading_completed || '완독됨') :
              canComplete ? (t?.complete_btn || '완독') :
                `${t?.reading || '읽는 중'} (${formatTime(timeLeft)})`}
          </button>
          <button
            onClick={toggleFavorite}
            className={`flex flex-col items-center gap-1 px-5 py-2.5 rounded-2xl text-xs font-bold border transition-colors ${isBookFavorited ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
          >
            <Bookmark className={`w-5 h-5 ${isBookFavorited ? 'fill-amber-400 text-amber-600' : ''}`} />
            {t?.favorite_btn || "즐겨찾기"}
          </button>
        </div>
        {!user && <p className="text-xs text-slate-400">{t?.login_required || "로그인 후 사용 가능"}</p>}

        {/* 시리즈 다음 화 집필 */}
        {isSeries && book.status === 'ongoing' && isLastEpisode && user && (
          <div className="mt-4">
            {seriesSlotTaken ? (
              <div className="w-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 py-3 rounded-xl text-sm font-bold text-center">
                {t?.series_limit_reached || "오늘 시리즈 집필 마감"}
                {slotStatus?.series?.authorId && (
                  <span className="block text-xs text-slate-400 mt-0.5">By. {slotStatus.series.authorName || (slotStatus.series.book?.isAnonymous ? '익명' : (authorProfiles[slotStatus.series.authorId]?.nickname || '익명'))}</span>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowContinuationModal(true)}
                disabled={isGeneratingEpisode}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl text-sm font-black hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PenTool className="w-4 h-4" />
                {isGeneratingEpisode ? (t?.writing_now || '집필 중...') : (t?.write_next_episode || '다음 화 집필하기')}
              </button>
            )}
          </div>
        )}

        {/* 잉크 보내기 (선물하기) - Lv 6 이상 해제 */}
        {book.authorId !== user?.uid && (
          <div className="flex flex-col items-center gap-2 mt-5">
            {!canDonate(getLevelFromXp(userProfile?.xp ?? 0)) ? (
              <div className="text-center py-3 px-4 bg-slate-100 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">🔒 선물하기는 작가 등급(Lv.11)부터 가능해요</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  {t?.send_ink || "잉크쏘기"}
                </span>
                <select
                  value={inkAmount}
                  onChange={(e) => setInkAmount(e.target.value)}
                  className="text-sm border border-blue-200 rounded-full px-3 py-1.5 bg-white text-blue-700 font-bold"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n}개</option>
                  ))}
                </select>
                <button
                  onClick={sendInkToAuthor}
                  disabled={isSendingInk || !user}
                  className="px-4 py-2 rounded-full text-sm font-black bg-blue-500 text-white hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isSendingInk ? (t?.sending || '보내는 중...') : (t?.send || '보내기')}
                </button>
              </div>
            )}
            <p className="text-xs text-slate-500 text-center">
              {t?.support_msg || "작품이 마음에 드셨다면 응원 한마디와 잉크를 쏴주세요"}
            </p>
          </div>
        )}

        {/* 댓글 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{(t?.comment_count || "댓글 {count}개").replace('{count}', comments.length)}</h3>
          <div className="space-y-3 max-h-80 overflow-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">{t?.first_comment || "첫 댓글을 남겨보세요."}</p>
            ) : (
              comments.map((c) => {
                const isMine = user && c.userId === user.uid;
                const isEditing = editingCommentId === c.id;
                const isReply = Boolean(c.parentId);
                return (
                  <div
                    key={c.id}
                    className={`text-sm ${isMine ? 'bg-amber-50/60 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3' : 'text-slate-700 dark:text-slate-300'
                      } ${isReply ? 'ml-6 border-l-2 border-slate-100 dark:border-slate-600 pl-3' : ''}`}
                  >
                    <div className="text-xs text-slate-400 dark:text-slate-500 mb-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{c.authorName || (t?.anonymous || '익명')}</span>
                        <span>·</span>
                        <span>{c.createdAt?.toDate?.()?.toLocaleString('ko-KR') || (t?.just_now || '방금 전')}</span>
                        {c.editedAt && <span>· {t?.edited || "수정됨"}</span>}
                      </div>
                      {(isMine || isReply) && (
                        <div className="flex items-center gap-2">
                          {isMine && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{t?.my_comment || "내 댓글"}</span>}
                          {isReply && (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                              ↳ {(t?.reply_to || "{name}에게 답글").replace('{name}', c.parentAuthorName || (t?.anonymous || '익명'))}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-orange-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                          maxLength={200}
                        />
                        <div className="flex items-center gap-2 text-xs">
                          <button onClick={() => saveEditComment(c.id)} className="px-2 py-1 rounded-md bg-orange-500 text-white font-bold">{t?.save_btn || "저장"}</button>
                          <button onClick={cancelEditComment} className="px-2 py-1 rounded-md text-slate-500">{t?.cancel || "취소"}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-line">{c.text}</div>
                    )}
                    {!isEditing && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <button onClick={() => startReply(c)} className="hover:text-slate-700 dark:hover:text-slate-200">{t?.reply || "답글"}</button>
                        {isMine && (
                          <>
                            <span>·</span>
                            <button onClick={() => startEditComment(c)} className="hover:text-slate-700">{t?.edit || "수정"}</button>
                            <span>·</span>
                            <button onClick={() => deleteComment(c.id)} className="hover:text-rose-500">{t?.delete || "삭제"}</button>
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
              placeholder={replyTo ? (t?.reply_to || "{name}에게 답글 작성").replace('{name}', replyTo.authorName) : (t?.reader_comment_ph || '댓글을 입력하세요')}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-orange-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {(t?.reply_to || "{name}에게 답글 작성 중").replace('{name}', replyTo.authorName)} · <button onClick={cancelReply} className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100">{t?.cancel || "취소"}</button>
            </div>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500">{t?.comment_limit || "댓글은 200자 이내로 작성하세요."}</p>
        </div>

        {/* 시리즈 이어쓰기 모달 */}
        {showContinuationModal && !showEndingStyleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t?.series_continue_title || "다음 화 전개 방식"}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t?.series_continue_desc || "이야기를 어떻게 이어갈까요?"}
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleWriteNextEpisode('ongoing')}
                  disabled={isGeneratingEpisode}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl text-sm font-black hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {t?.continue_series || "계속 연재 (이야기 확장)"}
                </button>
                <button
                  onClick={() => setShowEndingStyleModal(true)}
                  disabled={isGeneratingEpisode}
                  className="w-full bg-slate-900 dark:bg-slate-700 text-white py-3 rounded-xl text-sm font-black hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  {t?.finalize_series || "완결 짓기 (결말)"}
                </button>
                <button
                  onClick={() => setShowContinuationModal(false)}
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {t?.cancel || "취소"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 결말 스타일 선택 모달 */}
        {showEndingStyleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t?.ending_style || "결말 스타일"}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t?.ending_style_desc || "어떤 결말로 마무리할까요?"}
                </p>
              </div>
              <div className="space-y-2">
                {endingStyleItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setShowEndingStyleModal(false);
                      handleWriteNextEpisode('finalize', item.value);
                    }}
                    disabled={isGeneratingEpisode}
                    className="w-full bg-slate-900 dark:bg-slate-700 text-white py-3 rounded-xl text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    {t?.['ending_' + item.id] || item.value}
                  </button>
                ))}
                <button
                  onClick={() => setShowEndingStyleModal(false)}
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {t?.back || "뒤로"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 시리즈 다음 화 집필 중 모달 */}
        {isGeneratingEpisode && !isGeneratingEpisodeModalHidden && <EpisodeGeneratingNotice />}

        {/* 시리즈 집필 완료 모달 */}
        {showSeriesCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {showSeriesCompleteModal.isFinale ? (t?.series_finalized || '시리즈가 완결되었습니다!') : (t?.episode_added || '다음 화가 추가되었습니다!')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    contentAreaRef.current?.scrollIntoView({ behavior: 'smooth' });
                    setShowSeriesCompleteModal(null);
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-black bg-orange-500 text-white hover:bg-orange-600"
                >
                  {t?.view_book_now || "생성소설 바로보기"}
                </button>
                <button
                  onClick={() => setShowSeriesCompleteModal(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-black bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  {t?.stay || "머물기"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 운영자: 책 삭제 확인 모달 */}
        {/* 홍보 모달 */}
        {showPromotionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
              <div className="text-center space-y-1">
                <Megaphone className="w-8 h-8 text-violet-500 mx-auto" />
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t.promo_modal_title}</h3>
              </div>
              <input
                type="text"
                value={promoText}
                onChange={(e) => setPromoText(e.target.value.slice(0, 50))}
                placeholder={t.promo_input_placeholder}
                maxLength={50}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">{promoText.length}/50</p>
              <div className="bg-violet-50 dark:bg-violet-900/30 rounded-xl p-3 text-center">
                <p className="text-xs font-bold text-violet-600 dark:text-violet-400">{t.promo_cost}</p>
                {(userProfile?.ink || 0) < 10 && (
                  <p className="text-xs text-rose-500 mt-1">{t.promo_ink_short}</p>
                )}
              </div>
              <div className="space-y-2">
                <button
                  onClick={async () => {
                    if (!promoText.trim()) return;
                    setIsPromoting(true);
                    try {
                      await createPromotion(book.id, promoText.trim());
                      setShowPromotionModal(false);
                      setPromoText('');
                    } catch (err) {
                      if (err.message === 'PROMO_FULL') alert(t.promo_full);
                      else if (err.message === 'PROMO_ALREADY') alert(t.promo_already);
                      else if (err.message === 'PROMO_INK_SHORT') alert(t.promo_ink_short);
                      else alert(err.message || t.promo_confirm + ' 실패. 다시 시도해주세요.');
                    } finally {
                      setIsPromoting(false);
                    }
                  }}
                  disabled={isPromoting || !promoText.trim() || (userProfile?.ink || 0) < 10}
                  className="w-full bg-violet-500 text-white py-3 rounded-xl text-sm font-black hover:bg-violet-600 transition-colors disabled:opacity-50"
                >
                  {isPromoting ? '...' : t.promo_confirm}
                </button>
                <button
                  onClick={() => { setShowPromotionModal(false); setPromoText(''); }}
                  disabled={isPromoting}
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && canEditOrDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t?.admin_delete_confirm_title || "책 삭제"}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t?.admin_delete_confirm_desc || "이 책을 삭제하면 복구할 수 없습니다. 신고된 불순 콘텐츠나 문제가 있는 책일 때만 삭제해주세요."}
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={handleAdminDeleteBook}
                  disabled={isDeleting}
                  className="w-full bg-rose-500 text-white py-3 rounded-xl text-sm font-black hover:bg-rose-600 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (t?.deleting || "삭제 중...") : (t?.admin_delete_confirm || "삭제하기")}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  {t?.cancel || "취소"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default BookDetail;
