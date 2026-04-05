import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Coffee, Lightbulb, ChevronLeft,
  RefreshCw, Book, Calendar, List, ArrowRight, User, PenTool, Save,
  Star, MessageCircle, Reply, Send, MoreHorizontal, Bookmark, Heart, Globe, Home, Edit2, Flag, X, Library, Vote, Trophy, CheckCircle, Smile, Zap, Brain, Sparkles, LogOut, Lock, Droplets, Video, ShoppingBag, Settings
} from 'lucide-react';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useUserProfile } from './hooks/useUserProfile';
import { useNotices } from './hooks/useNotices';
import { useInkSystem } from './hooks/useInkSystem';
import { useBooks } from './hooks/useBooks';
import { useComments } from './hooks/useComments';
import { useStoryReader } from './hooks/useStoryReader';
import { useAchievements } from './hooks/useAchievements';
import { useFollows } from './hooks/useFollows';

// Utils & Data
import { T, genres } from './data';
import { getReadInkCost, getExtraWriteInkCost } from './utils/levelUtils';
import { getTodayDateKey } from './utils/dateUtils';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

// Components
import HomeView from './components/HomeView';
import GenreSelectView from './components/GenreSelectView';
import StoryListView from './components/StoryListView';
import ReaderView from './components/ReaderView';
import LibraryView from './components/LibraryView';
import LibraryMainView from './components/LibraryMainView';
import ProfileView from './components/ProfileView';
import WriteView from './components/WriteView';
import ArchiveView from './components/ArchiveView';
import BookDetail from './components/BookDetail';
import PremiumCoverModal from './components/PremiumCoverModal';
import StoreView from './components/StoreView';
import BagModal from './components/BagModal';
import RainbowInkModal from './components/RainbowInkModal';
import MagicEraserModal from './components/MagicEraserModal';
import GoldenPenModal from './components/GoldenPenModal';
import GiftModal from './components/GiftModal';
import PaintbrushModal from './components/PaintbrushModal';
import BookPreviewModal from './components/BookPreviewModal';
import SettingsModal from './components/SettingsModal';
import MegaphoneModal from './components/MegaphoneModal';
import ChallengeResultModal from './components/ChallengeResultModal';
import AuthorProfileModal from './components/AuthorProfileModal';
import { useInventory } from './hooks/useInventory';
import { useHighlights } from './hooks/useHighlights';
import { usePushNotifications } from './hooks/usePushNotifications';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const APP_VERSION = "2.0.1";

const App = () => {

  // Shared State
  const [view, setView] = useState('profile_setup');
  const viewRef = useRef(view);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // 앱 시작 시 버전 체크 & Firestore 초기화
  useEffect(() => {
    const STORE_URL = 'https://play.google.com/store/apps/details?id=com.banlan21.odok';
    const DEFAULT_SETTINGS = {
      min_version: '2.0.0',
      store_url: STORE_URL,
      update_msg: '오독오독 2.0 대규모 업데이트! 확성기, 문방구, 작가 프로필 기능이 추가되었습니다. 원활한 사용을 위해 업데이트를 진행해주세요.',
    };

    const compareVersions = (v1, v2) => {
      const p1 = v1.split('.').map(Number);
      const p2 = v2.split('.').map(Number);
      for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const a = p1[i] || 0;
        const b = p2[i] || 0;
        if (a < b) return -1;
        if (a > b) return 1;
      }
      return 0;
    };

    const checkVersion = async () => {
      try {
        const versionRef = doc(db, 'app_settings', 'version_info');
        const snap = await getDoc(versionRef);
        let settings;
        if (!snap.exists()) {
          await setDoc(versionRef, DEFAULT_SETTINGS);
          settings = DEFAULT_SETTINGS;
        } else {
          settings = snap.data();
        }
        const minVer = settings.min_version || '1.0.0';
        if (compareVersions(APP_VERSION, minVer) < 0) {
          setForceUpdate({
            storeUrl: settings.store_url || STORE_URL,
            updateMsg: settings.update_msg || DEFAULT_SETTINGS.update_msg,
          });
        }
      } catch (err) {
        console.warn('[버전 체크] 오류:', err);
      }
    };

    checkVersion();
  }, []);

  const [error, setError] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [currentBook, setCurrentBook] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);

  // 1. Auth Hook
  const {
    user,
    handleGoogleLogin,
    handleLogout,
    showInAppBrowserWarning
  } = useAuth({ setView, viewRef });

  // 2. User Profile Hook
  const {
    userProfile, setUserProfile,
    tempNickname, setTempNickname, tempBio, setTempBio, tempAnonymousActivity, setTempAnonymousActivity,
    language, setLanguage,
    fontSize, setFontSize,
    darkMode, setDarkMode,
    isNoticeAdmin, saveProfile,
    showSaveSuccessModal, setShowSaveSuccessModal,
    showAttendanceModal, setShowAttendanceModal,
    lastAttendanceInk,
    handleDevReset, handleDeleteAccount,
    earnPoints,
    levelInfo, remainingDailyWrites
  } = useUserProfile({ user, setView, setError, viewRef });

  // 3. Ink System Hook
  const {
    showInkConfirmModal, setShowInkConfirmModal,
    pendingBook, setPendingBook,
    pendingBookData, setPendingBookData,
    showLevelUpModal, setShowLevelUpModal,
    newLevel, setNewLevel,
    deductInk, addInk,
    confirmOpenBook,
    handleWatchAdForRead, handleBookClick,
    challengeResult, setChallengeResult,
  } = useInkSystem({
    user,
    userProfile,
    setView,
    setError,
    setSelectedBook
  });

  // 4. Books Hook
  const {
    books,
    libraryFilter, setLibraryFilter,
    slotStatus,
    todayBooks, weeklyBestBooks, allTimeBestBooks, topWriters,
    isLoadingHomeData,
    isWritingInProgress, setIsWritingInProgress,
    showWritingCompleteModal, setShowWritingCompleteModal,
    authorProfiles,
    promotions,
    createPromotion,
    handleBookGenerated
  } = useBooks({
    user,
    userProfile,
    setError,
    deductInk,
    setShowInkConfirmModal,
    setPendingBookData
  });

  // 5. Notices Hook
  const {
    notices,
    selectedNotice, setSelectedNotice,
    isNoticeEditorOpen, setIsNoticeEditorOpen,
    noticeTitle, setNoticeTitle,
    noticeContent, setNoticeContent,
    isSavingNotice,
    openNoticeEditor,
    saveNotice,
    deleteNotice
  } = useNotices({ user, isNoticeAdmin });

  // 6. Story Reader Hook
  const storyReaderHook = useStoryReader({
    user,
    userProfile,
    view,
    setView,
    setError,
    earnPoints
  });

  // 7. Comments Hook
  const commentsHook = useComments({
    user,
    userProfile,
    currentStory: storyReaderHook.currentStory,
    view,
    setError,
    earnPoints
  });

  const submitRatingWrapper = async (stars) => {
    await storyReaderHook.submitRating(stars);
    await commentsHook.checkAndGiveReward(storyReaderHook.currentStory.id);
  };

  // 8. Achievements Hook
  const {
    achievementToShow,
    showAchievementModal,
    setShowAchievementModal
  } = useAchievements({ userProfile });

  // 9. Follows Hook
  const {
    follows,
    followAuthor,
    unfollowAuthor,
    isFollowing
  } = useFollows({ user, books });

  // 10. Inventory Hook
  const {
    purchaseItem,
    isPurchasing,
    useItem,
    getInventory,
    getItemQuantity,
    getTotalItems,
  } = useInventory({ user, userProfile });

  const [showBagModal, setShowBagModal] = useState(false);
  const [showRainbowInkModal, setShowRainbowInkModal] = useState(false);
  const [showMagicEraserModal, setShowMagicEraserModal] = useState(false);
  const [showGoldenPenModal, setShowGoldenPenModal] = useState(false);
  const [giftTargetItem, setGiftTargetItem] = useState(null);
  const [showPaintbrushModal, setShowPaintbrushModal] = useState(false);
  const [previewBook, setPreviewBook] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMegaphoneModal, setShowMegaphoneModal] = useState(false);
  const [authorProfileUserId, setAuthorProfileUserId] = useState(null);
  const [profileSubTab, setProfileSubTab] = useState('profile'); // 'profile' | 'store'
  const [forceUpdate, setForceUpdate] = useState(null); // null | { storeUrl, updateMsg }

  const { highlights, addHighlight, deleteHighlight } = useHighlights({ user });
  usePushNotifications({ user });

  // 책 클릭 시 미리보기 모달 먼저 열기
  const handleBookClickWithPreview = (book) => {
    setPreviewBook(book);
  };

  // profile 탭 이탈 시 서브탭 초기화
  useEffect(() => {
    if (view !== 'profile') setProfileSubTab('profile');
  }, [view]);

  const t = T[language] || T.ko;

  // Android 뒤로가기 버튼 처리
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapApp.addListener('backButton', () => {
      const v = viewRef.current;
      if (v === 'reader' || v === 'book_detail') {
        setView('home');
      } else if (v === 'genre_select' || v === 'story_list') {
        setView('home');
      } else if (v !== 'home' && v !== 'login' && v !== 'profile_setup') {
        setView('home');
      } else if (v === 'home') {
        setShowExitModal(true);
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  const filteredStories = storyReaderHook.stories.filter(s => {
    if (s.genreId !== storyReaderHook.selectedGenre?.id) return false;
    if (storyReaderHook.selectedSubGenre && s.subGenre !== storyReaderHook.selectedSubGenre.id) return false;
    if (!storyReaderHook.selectedSubGenre && s.subGenre) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const hasTodayStory = filteredStories.some(s => s.date === getTodayDateKey());
  const isSeriesLimitReached = (userProfile?.lastSeriesGeneratedDate === getTodayDateKey());

  return (
    <div className={`${darkMode ? 'dark' : ''} bg-gray-100 dark:bg-slate-950 min-h-screen flex justify-center items-center`}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Jua&display=swap'); .font-jua { font-family: 'Jua', sans-serif; } .scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      <div className="w-full max-w-md bg-slate-50 dark:bg-slate-900 h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden text-slate-900 dark:text-slate-50 font-sans selection:bg-orange-200" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* In-App Browser Warning */}
        {showInAppBrowserWarning && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-slate-800">{t.in_app_browser_title}</h2>
                <p className="text-sm text-slate-600">{t.in_app_browser_desc}</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="flex-none bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-700 z-40 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(view === 'write' || view === 'library' || view === 'archive' || view === 'profile' || view === 'book_detail' || (view === 'reader' && currentBook)) ? (
              <button onClick={() => {
                if (view === 'reader' && currentBook) {
                  setCurrentBook(null);
                  setView('library');
                } else if (view === 'book_detail') {
                  const isMyBook = selectedBook?.authorId === user?.uid;
                  setSelectedBook(null);
                  setView(isMyBook ? 'archive' : 'library');
                } else {
                  setView('home');
                }
              }} className="p-2 -ml-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" /></button>
            ) : view !== 'home' && view !== 'profile_setup' ? (
              <button onClick={() => {
                if (view === 'reader') setView('list');
                else if (view === 'list') {
                  if (storyReaderHook.selectedGenre?.hasSubGenre) setView('genre_select');
                  else setView('library_main');
                }
                else if (view === 'genre_select') setView('library_main');
                else if (view === 'notice_list') setView('home');
                else setView('home');
              }} className="p-2 -ml-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" /></button>
            ) : <Book className="w-6 h-6 text-orange-600" />}
            <h1 className="text-sm font-jua text-slate-800 dark:text-slate-100 leading-3 whitespace-pre-line text-center pt-1">{t.app_name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {userProfile && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                  <PenTool className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{remainingDailyWrites}</span>
                </div>
                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                  <Droplets className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />
                  <span className="text-xs font-bold">{userProfile.ink || 0}</span>
                </div>
                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                  <span className="text-xs font-black">Lv.{levelInfo.level}</span>
                </div>
                <button
                  onClick={() => setShowBagModal(true)}
                  className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                >
                  <ShoppingBag className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                  {getTotalItems() > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
                      {getTotalItems() > 9 ? '9+' : getTotalItems()}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                >
                  <Settings className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main id="main-content" className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-5 relative">

          {storyReaderHook.isHelpModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg dark:text-slate-100">{t.help_title}</h3><button onClick={() => storyReaderHook.setIsHelpModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_write}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li><strong>1일 2회 집필:</strong> 매일 최대 2번 글을 쓸 수 있습니다. (첫 번째 무료, 두 번째는 잉크 소모·레벨에 따라 3~5개)</li>
                      <li><strong>선착순 발행:</strong> 장르별로 <strong>하루에 단 한 권</strong>만 발행됩니다. 서둘러 집필해보세요!</li>
                      <li><strong>광고 찬스:</strong> 광고를 보면 잉크 없이 무료로 한 번 더 집필할 수 있습니다.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_ink}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li><strong>획득:</strong> 출석(레벨별 2~5개), 레벨업 보너스, 집필 완료 보상, 월간 챌린지 달성(10개).</li>
                      <li><strong>사용:</strong> 책 읽기(1~2개), 추가 집필, 키워드 변경, 작가 후원, 문방구 아이템 구매.</li>
                      <li><strong>XP:</strong> 잉크 1개 사용 시 10XP 적립 → 레벨업.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_level}</h4>
                    <p className="text-xs mb-1 text-slate-500 dark:text-slate-400">잉크 사용 시 XP 적립 → 레벨 상승 → 칭호·아이콘이 책 표지 등에 표시됩니다.</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li>🌱 새싹 → ✏️ 작가 → 🪶 숙련 작가 → 🖊️ 베스트 작가 → ✒️ 스타 작가 → 🖋️ 거장 → 🌈 마스터</li>
                      <li>레벨이 오를수록 출석 잉크 증가, 읽기/집필 비용 할인, 후원 기능 개방.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_store}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li><strong>🌈 무지개 잉크 (5개):</strong> 글쓰기 에디터에서 글자 색상 변경.</li>
                      <li><strong>✨ 마법 지우개 (3개):</strong> 에디터 내 전체 텍스트 초기화.</li>
                      <li><strong>🖊️ 황금 만년필 (7개):</strong> 글쓰기 글자 수 제한 확장.</li>
                      <li><strong>🎨 페인트브러시 (8개):</strong> 책 표지 배경색 변경.</li>
                      <li><strong>✏️ 샤프 (5개):</strong> 책 미리보기에서 AI 소개글 생성·업그레이드.</li>
                      <li><strong>📢 확성기 (10개):</strong> 내 작품을 홈 화면에 24시간 노출.</li>
                      <li>구매한 아이템은 <strong>내 가방(🎒)</strong>에서 확인·사용 가능.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_megaphone}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li>가방(🎒)에서 확성기 아이템 사용 → 홍보할 책 선택 → 홍보 문구 입력.</li>
                      <li>등록 후 <strong>24시간 동안</strong> 홈 화면 상단 캐러셀에 노출됩니다.</li>
                      <li>샤프(✏️) 1개로 AI 책 소개글을 자동 생성할 수 있습니다.</li>
                      <li>동시에 1개 작품만 홍보 가능 (자리가 꽉 찬 경우 대기).</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_highlight}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li>책 뷰어에서 원하는 문장을 <strong>길게 누르고 드래그</strong>하면 팝업이 나타납니다.</li>
                      <li><strong>🎨 하이라이트 저장:</strong> 마음에 드는 문장을 내 프로필에 저장.</li>
                      <li><strong>📢 공유하기:</strong> 5가지 배경 이미지 중 선택해 감성 이미지 카드 생성 → 카카오/인스타/다운로드.</li>
                      <li>저장된 하이라이트는 프로필 탭에서 확인·삭제 가능.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_challenge}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li>매달 1일 리셋 · <strong>이번 달 5권 완독</strong>이 목표입니다.</li>
                      <li>완독 버튼(책 뷰어에서 3분 이상 읽은 후 활성화)을 눌러야 카운트됩니다.</li>
                      <li>달성 시 다음 달 1일 앱 실행 시 <strong>잉크 10개</strong> 자동 지급 + 축하 알림.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_author_profile}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li>홈 집필왕 목록, 책 상세 작가 이름, 댓글 닉네임을 탭하면 작가 프로필 모달이 열립니다.</li>
                      <li>대표작(점수 최고 작품), 집필 목록, 팔로우/언팔로우 기능 제공.</li>
                      <li>팔로우한 작가가 신작을 등록하면 <strong>푸시 알림</strong>을 받을 수 있습니다.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t.help_section_series}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li><strong>이어쓰기:</strong> 시리즈는 <strong>누구나</strong> 다음 화를 이어 쓸 수 있는 릴레이 소설입니다.</li>
                      <li><strong>연재/완결:</strong> 2화부터 독자 투표로 「연재」 또는 「완결」을 선택할 수 있습니다.</li>
                      <li><strong>통합 슬롯:</strong> 시리즈 신작·이어쓰기 포함 <strong>하루에 단 한 번</strong> 발행 가능합니다.</li>
                    </ul>
                  </section>
                </div>
                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-700 text-right text-xs text-slate-400">Ver {APP_VERSION}</div>
              </div>
            </div>
          )}

          {storyReaderHook.isUnlockModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold mb-3 dark:text-slate-100">{t.unlock_title}</h3><div className="space-y-2"><button onClick={() => storyReaderHook.processUnlock('free', t)} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold">{t.unlock_btn_free}</button><button onClick={() => storyReaderHook.processUnlock('point', t)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">{t.unlock_btn_paid}</button><button onClick={() => storyReaderHook.setIsUnlockModalOpen(false)} className="w-full bg-slate-100 py-3 rounded-xl font-bold">{t.cancel}</button></div></div></div>
          )}

          {selectedNotice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-xl flex flex-col" style={{ maxHeight: '80vh' }}>
                {/* 헤더 - 고정 */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-none border-b border-slate-100 dark:border-slate-700">
                  <div className="text-lg font-black text-slate-800 dark:text-slate-100">{t.notice_title}</div>
                  <button onClick={() => setSelectedNotice(null)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500"><X className="w-4 h-4" /></button>
                </div>
                {/* 내용 - 스크롤 */}
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
                  <div className="text-base font-black text-slate-800 dark:text-slate-100">{selectedNotice.title}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">{selectedNotice.content}</div>
                </div>
                {/* 하단 버튼 - 고정 */}
                {isNoticeAdmin && (
                  <div className="flex gap-2 px-6 py-4 flex-none border-t border-slate-100 dark:border-slate-700">
                    <button onClick={() => { openNoticeEditor(selectedNotice); setSelectedNotice(null); }} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs">{t.edit}</button>
                    <button onClick={() => deleteNotice(selectedNotice.id)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-xs">{t.delete || "삭제"}</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {isNoticeEditorOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
                <div className="flex items-center justify-between"><div className="text-lg font-black text-slate-800 dark:text-slate-100">{t.notice_write_title}</div><button onClick={() => setIsNoticeEditorOpen(false)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500"><X className="w-4 h-4" /></button></div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    placeholder={t.notice_title_ph}
                    className="w-full p-3 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl font-bold outline-none focus:border-orange-500"
                  />
                  <textarea
                    value={noticeContent}
                    onChange={(e) => setNoticeContent(e.target.value)}
                    placeholder={t.content_placeholder}
                    className="w-full p-3 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl text-sm h-40 resize-none outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={saveNotice}
                    disabled={isSavingNotice}
                    className="w-full py-3 bg-orange-500 text-white rounded-xl font-black hover:bg-orange-600 disabled:opacity-50"
                  >
                    {isSavingNotice ? t.saving : t.write_complete}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showInkConfirmModal && pendingBook && !pendingBookData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
                <div className="text-center space-y-2"><h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t.ink_confirm_title}</h3><p className="text-sm text-slate-600 dark:text-slate-300">{(t.ink_confirm_desc || "").replace('{amount}', getReadInkCost(levelInfo.level))}</p></div>
                <div className="space-y-3"><button onClick={handleWatchAdForRead} className="w-full bg-blue-500 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2"><Video className="w-5 h-5" />{t.watch_ad_read}</button><button onClick={() => confirmOpenBook(false)} className="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold">{t.use_my_ink}</button><button onClick={() => { setShowInkConfirmModal(false); setPendingBook(null); }} className="w-full text-slate-400 py-2 text-xs font-bold underline">{t.close}</button></div>
              </div>
            </div>
          )}

          {showInkConfirmModal && pendingBookData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
                <div className="text-center space-y-2"><h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t.extra_write_title}</h3><p className="text-sm text-slate-600 dark:text-slate-300">{(t.extra_write_desc || "").replace('{amount}', getExtraWriteInkCost(levelInfo.level))}</p></div>
                <div className="flex gap-3"><button onClick={() => { setShowInkConfirmModal(false); setPendingBookData(null); }} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-3 rounded-xl font-bold">{t.cancel}</button><button onClick={async () => { setShowInkConfirmModal(false); const bookData = pendingBookData; setPendingBookData(null); await handleBookGenerated(bookData, true); }} className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-black">{t.write_btn}</button></div>
              </div>
            </div>
          )}

          {showAttendanceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-2xl p-8 w-full max-w-sm shadow-xl space-y-4 text-center">
                <div className="text-5xl mb-2">💧</div>
                <h2 className="text-2xl font-black text-slate-800">{t.attendance_check}</h2>
                <p className="text-lg font-bold text-sky-600">+{lastAttendanceInk} {t.ink || '잉크'}</p>
                <p className="text-xs text-slate-500">{t.attendance_daily_desc}</p>
                <button onClick={() => setShowAttendanceModal(false)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black mt-4">{t.confirm}</button>
              </div>
            </div>
          )}

          {showLevelUpModal && newLevel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl p-8 w-full max-w-sm shadow-xl space-y-4 text-center">
                <h2 className="text-3xl font-black text-slate-800">{t.level_up_title}</h2><p className="text-xl font-black text-orange-600">{(t.level_up_desc || "").replace('{level}', newLevel)}</p><button onClick={() => { setShowLevelUpModal(false); setNewLevel(null); }} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black mt-4">{t.confirm}</button>
              </div>
            </div>
          )}

          {showAchievementModal && achievementToShow && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-8 w-full max-w-sm shadow-xl space-y-4 text-center">
                <div className="text-6xl mb-2">{achievementToShow.emoji}</div>
                <h2 className="text-xl font-black text-amber-700">{t.achievement_unlocked || '업적 해제!'}</h2>
                <p className="text-2xl font-black text-slate-800">
                  {t[`ach_${achievementToShow.id}_title`] || achievementToShow.title_ko}
                </p>
                <p className="text-sm text-slate-600">
                  {t[`ach_${achievementToShow.id}_desc`] || achievementToShow.desc_ko}
                </p>
                <button
                  onClick={() => setShowAchievementModal(false)}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-black mt-4"
                >{t.confirm || '확인'}</button>
              </div>
            </div>
          )}

          {!user && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in">
              <div className="text-center space-y-4"><img src="/logo.png" alt="오독오독" className="w-32 h-32 mx-auto mb-2" /><h1 className="text-3xl font-black text-slate-800 mb-2">오독오독</h1><p className="text-slate-600 font-bold">{t.app_slogan}</p></div>
              <div className="w-full max-w-sm space-y-4"><button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-black flex items-center justify-center gap-3"><Globe className="w-6 h-6 text-slate-400" />{t.google_start}</button>{error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-red-600 text-xs font-bold">{error}</p></div>}</div>
            </div>
          )}

          {user && (!userProfile || !userProfile.nickname) && (
            <ProfileView
              user={user} userProfile={userProfile} t={t} levelInfo={levelInfo}
              tempNickname={tempNickname} setTempNickname={setTempNickname}
              tempBio={tempBio} setTempBio={setTempBio}
              tempAnonymousActivity={tempAnonymousActivity} setTempAnonymousActivity={setTempAnonymousActivity}
              handleGoogleLogin={handleGoogleLogin} saveProfile={saveProfile}
              addInk={addInk}
              error={error} setError={setError} appId={appId}
              onOpenHelp={() => storyReaderHook.setIsHelpModalOpen(true)}
            />
          )}

          {user && userProfile && userProfile.nickname && (
            <>
              {view === 'home' && (
                <HomeView
                  userProfile={userProfile} t={t} levelInfo={levelInfo} notices={notices}
                  setView={setView} todayBooks={todayBooks} weeklyBestBooks={weeklyBestBooks} allTimeBestBooks={allTimeBestBooks}
                  topWriters={topWriters} isLoadingHomeData={isLoadingHomeData}
                  handleBookClick={handleBookClickWithPreview} authorProfiles={authorProfiles}
                  promotions={promotions} books={books}
                  onAuthorClick={(uid) => setAuthorProfileUserId(uid)}
                />
              )}

              {view === 'notice_list' && (
                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{t.notice_title}</h2><span className="text-xs text-slate-400">{(t.items_count || "").replace('{count}', notices.length)}</span></div>
                  {notices.map(notice => (
                    <button key={notice.id} onClick={() => setSelectedNotice(notice)} className="w-full text-left p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm mb-2">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{notice.title}</div>
                    </button>
                  ))}
                  {isNoticeAdmin && (
                    <div className="fixed bottom-24 right-5 flex flex-col gap-2">
                      <button onClick={handleDevReset} className="w-14 h-14 rounded-full bg-slate-800 text-white shadow-lg flex items-center justify-center font-black text-xs">{t.reset_btn}</button>
                      <button onClick={openNoticeEditor} className="w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center font-black">{t.notice_write_title}</button>
                    </div>
                  )}
                </div>
              )}

              {view === 'library_main' && <LibraryMainView t={t} setIsRecommendModalOpen={storyReaderHook.setIsRecommendModalOpen} genres={genres} handleGenreClick={storyReaderHook.handleGenreClick} />}

              {view === 'genre_select' && storyReaderHook.selectedGenre && <GenreSelectView t={t} selectedGenre={storyReaderHook.selectedGenre} handleSubGenreClick={storyReaderHook.handleSubGenreClick} stories={storyReaderHook.stories} />}

              {view === 'list' && (
                <StoryListView
                  t={t} user={user}
                  selectedGenre={storyReaderHook.selectedGenre} selectedSubGenre={storyReaderHook.selectedSubGenre}
                  filteredStories={filteredStories}
                  hasTodayStory={hasTodayStory} dailyCount={userProfile.dailyGenerationCount || 0} isSeriesLimitReached={isSeriesLimitReached}
                  generateTodayStory={() => storyReaderHook.generateTodayStory(t)} isGenerating={storyReaderHook.isGenerating}
                  error={error} handleStoryClick={(s) => storyReaderHook.handleStoryClick(s, t)}
                  unlockedStories={storyReaderHook.unlockedStories} getStoryStats={storyReaderHook.getStoryStats} getFavoriteCount={storyReaderHook.getFavoriteCount}
                />
              )}

              {view === 'reader' && currentBook && !storyReaderHook.currentStory && (
                <ReaderView book={currentBook} onBack={() => { setCurrentBook(null); setView('library'); }} fontSize={fontSize} addHighlight={addHighlight} />
              )}

              {view === 'reader' && storyReaderHook.currentStory && !currentBook && (
                <ReaderView
                  t={t} user={user} currentStory={storyReaderHook.currentStory}
                  readerLang={storyReaderHook.readerLang} isTranslating={storyReaderHook.isTranslating}
                  displayTitle={storyReaderHook.currentStory.title} displayBody={storyReaderHook.currentStory.body}
                  fontSize={fontSize} translateStory={storyReaderHook.translateStory}
                  toggleFavorite={storyReaderHook.toggleFavorite} isFavorited={storyReaderHook.isFavorited(storyReaderHook.currentStory.id)}
                  handleShare={storyReaderHook.handleShare} setIsReportModalOpen={storyReaderHook.setIsReportModalOpen}
                  currentStoryStats={storyReaderHook.getStoryStats(storyReaderHook.currentStory.id)}
                  getFavoriteCount={storyReaderHook.getFavoriteCount} canFinishRead={storyReaderHook.canFinishRead}
                  finishReading={() => storyReaderHook.finishReading(t)} submitSeriesVote={storyReaderHook.submitSeriesVote}
                  myVote={null} voteCounts={{ continue: 0, end: 0 }} getTodayString={getTodayDateKey}
                  ratings={storyReaderHook.ratings} submitRating={submitRatingWrapper}
                  comments={commentsHook.comments} commentInput={commentsHook.commentInput} setCommentInput={commentsHook.setCommentInput}
                  editingCommentId={commentsHook.editingCommentId} replyTo={commentsHook.replyTo} setReplyTo={commentsHook.setReplyTo}
                  setEditingCommentId={commentsHook.setEditingCommentId} submitComment={commentsHook.submitComment}
                  startEditComment={commentsHook.startEditComment} error={error} isSubmittingComment={commentsHook.isSubmittingComment}
                />
              )}

              {(view === 'write' || isWritingInProgress) && (
                <div className={view === 'write' ? '' : 'hidden'}>
                  <WriteView
                    user={user} userProfile={userProfile} t={t} onBookGenerated={handleBookGenerated}
                    slotStatus={slotStatus} setView={setView} setSelectedBook={setSelectedBook}
                    error={error} setError={setError} deductInk={deductInk}
                    onGeneratingChange={setIsWritingInProgress} onGenerationComplete={() => { }}
                    authorProfiles={authorProfiles}
                  />
                </div>
              )}

              {view === 'library' && <LibraryView t={t} books={books} onBookClick={handleBookClickWithPreview} filter={libraryFilter} onFilterChange={setLibraryFilter} authorProfiles={authorProfiles} />}

              {view === 'archive' && <ArchiveView t={t} books={books} user={user} favoriteBookIds={storyReaderHook.bookFavorites.map(f => f.bookId)} onBookClick={handleBookClickWithPreview} authorProfiles={authorProfiles} />}

              {view === 'store' && (
                <StoreView
                  userProfile={userProfile}
                  purchaseItem={purchaseItem}
                  isPurchasing={isPurchasing}
                  getItemQuantity={getItemQuantity}
                  onGiftItem={(item) => setGiftTargetItem(item)}
                  addInk={addInk}
                  t={t}
                />
              )}

              {view === 'book_detail' && selectedBook && (
                <BookDetail
                  book={selectedBook} onBookUpdate={setSelectedBook} user={user} userProfile={userProfile}
                  appId={appId} fontSize={fontSize} slotStatus={slotStatus} deductInk={deductInk} t={t}
                  isAdmin={isNoticeAdmin} authorProfiles={authorProfiles}
                  promotions={promotions} createPromotion={createPromotion}
                  followAuthor={followAuthor} unfollowAuthor={unfollowAuthor} isFollowing={isFollowing}
                  onAuthorClick={(uid) => setAuthorProfileUserId(uid)}
                  onClose={() => {
                    const isMyBook = selectedBook.authorId === user?.uid;
                    setSelectedBook(null);
                    setView(isMyBook ? 'archive' : 'library');
                  }}
                />
              )}

              {view === 'profile' && (
                <div className="-mx-5">
                  {/* 프로필 / 문방구 서브탭 */}
                  <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
                    <button
                      onClick={() => setProfileSubTab('profile')}
                      className={`flex-1 py-3 text-sm font-bold transition-colors ${profileSubTab === 'profile' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-slate-400'}`}
                    >
                      {t.profile_subtab_profile}
                    </button>
                    <button
                      onClick={() => setProfileSubTab('store')}
                      className={`flex-1 py-3 text-sm font-bold transition-colors ${profileSubTab === 'store' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-slate-400'}`}
                    >
                      {t.profile_subtab_store}
                    </button>
                  </div>

                  {profileSubTab === 'profile' && (
                    <div className="px-5">
                      <ProfileView
                        user={user} userProfile={userProfile} t={t} levelInfo={levelInfo}
                        tempNickname={tempNickname} setTempNickname={setTempNickname}
                        tempBio={tempBio} setTempBio={setTempBio}
                        tempAnonymousActivity={tempAnonymousActivity} setTempAnonymousActivity={setTempAnonymousActivity}
                        handleGoogleLogin={handleGoogleLogin} saveProfile={saveProfile}
                        addInk={addInk} error={error} setError={setError} appId={appId}
                        onOpenHelp={() => storyReaderHook.setIsHelpModalOpen(true)}
                        follows={follows} unfollowAuthor={unfollowAuthor}
                        highlights={highlights} deleteHighlight={deleteHighlight}
                      />
                    </div>
                  )}

                  {profileSubTab === 'store' && (
                    <StoreView
                      userProfile={userProfile}
                      purchaseItem={purchaseItem}
                      isPurchasing={isPurchasing}
                      getItemQuantity={getItemQuantity}
                      onGiftItem={(item) => setGiftTargetItem(item)}
                      addInk={addInk}
                      t={t}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {showWritingCompleteModal && (
          <PremiumCoverModal
            book={books.find(b => b.id === showWritingCompleteModal.book.id) || showWritingCompleteModal.book}
            userProfile={userProfile}
            appId={appId}
            deductInk={deductInk}
            onCoverGenerated={(coverUrl) => {
              // Firestore에서 최신 book을 가져와 selectedBook 업데이트
              const updatedBook = books.find(b => b.id === showWritingCompleteModal.book.id);
              if (updatedBook) setSelectedBook({ ...updatedBook, cover_url: coverUrl });
            }}
            onViewBook={() => {
              const book = books.find(b => b.id === showWritingCompleteModal.book.id) || showWritingCompleteModal.book;
              setSelectedBook(book);
              setView('book_detail');
              setShowWritingCompleteModal(null);
            }}
            onSkip={() => setShowWritingCompleteModal(null)}
          />
        )}

        {showBagModal && (
          <BagModal
            inventory={getInventory()}
            t={t}
            onClose={() => setShowBagModal(false)}
            onUseItem={(itemId) => {
              if (itemId === 'rainbow_ink') setShowRainbowInkModal(true);
              if (itemId === 'magic_eraser') setShowMagicEraserModal(true);
              if (itemId === 'golden_pen') setShowGoldenPenModal(true);
              if (itemId === 'paint_brush') setShowPaintbrushModal(true);
              if (itemId === 'megaphone') setShowMegaphoneModal(true);
            }}
          />
        )}

        {showRainbowInkModal && (
          <RainbowInkModal
            user={user}
            books={books}
            useItem={useItem}
            t={t}
            onClose={() => setShowRainbowInkModal(false)}
          />
        )}

        {showMagicEraserModal && (
          <MagicEraserModal
            user={user}
            books={books}
            useItem={useItem}
            t={t}
            onClose={() => setShowMagicEraserModal(false)}
          />
        )}

        {showGoldenPenModal && (
          <GoldenPenModal
            user={user}
            books={books}
            useItem={useItem}
            t={t}
            onClose={() => setShowGoldenPenModal(false)}
          />
        )}

        {showPaintbrushModal && (
          <PaintbrushModal
            user={user}
            userProfile={userProfile}
            books={books}
            useItem={useItem}
            t={t}
            onClose={() => setShowPaintbrushModal(false)}
          />
        )}

        {giftTargetItem && (
          <GiftModal
            item={giftTargetItem}
            follows={follows}
            userProfile={userProfile}
            t={t}
            onClose={() => setGiftTargetItem(null)}
          />
        )}

        {showSettingsModal && (
          <SettingsModal
            language={language} setLanguage={setLanguage}
            fontSize={fontSize} setFontSize={setFontSize}
            darkMode={darkMode} setDarkMode={setDarkMode}
            t={t}
            user={user}
            handleLogout={handleLogout}
            handleDeleteAccount={handleDeleteAccount}
            saveProfile={saveProfile}
            onClose={() => setShowSettingsModal(false)}
            onOpenHelp={() => storyReaderHook.setIsHelpModalOpen(true)}
          />
        )}

        {showMegaphoneModal && (
          <MegaphoneModal
            user={user}
            userProfile={userProfile}
            books={books}
            createPromotion={createPromotion}
            onClose={() => setShowMegaphoneModal(false)}
          />
        )}

        {challengeResult && (
          <ChallengeResultModal
            result={challengeResult.result}
            monthKey={challengeResult.monthKey}
            reads={challengeResult.reads}
            goal={challengeResult.goal}
            t={t}
            onClose={() => setChallengeResult(null)}
          />
        )}

        {authorProfileUserId && (
          <AuthorProfileModal
            targetUserId={authorProfileUserId}
            books={books}
            currentUser={user}
            followAuthor={followAuthor}
            unfollowAuthor={unfollowAuthor}
            isFollowing={isFollowing}
            onBookClick={handleBookClick}
            t={t}
            onClose={() => setAuthorProfileUserId(null)}
          />
        )}

        {previewBook && (
          <BookPreviewModal
            book={previewBook}
            user={user}
            userProfile={userProfile}
            useItem={useItem}
            authorProfiles={authorProfiles}
            t={t}
            onRead={(book) => { setPreviewBook(null); handleBookClick(book); }}
            onClose={() => setPreviewBook(null)}
            onGoToStore={() => { setProfileSubTab('store'); setView('profile'); }}
          />
        )}

        {/* 강제 업데이트 모달 - 가장 높은 우선순위, 닫기 불가 */}
        {forceUpdate && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* 상단 그래픽 */}
              <div className="bg-gradient-to-br from-orange-400 to-orange-600 px-6 pt-8 pb-6 text-center">
                <div className="text-5xl mb-3">🚀</div>
                <h2 className="text-xl font-black text-white">{t.force_update_title}</h2>
                <p className="text-orange-100 text-xs mt-1">{t.force_update_subtitle}</p>
              </div>
              {/* 내용 */}
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed text-center">
                  {forceUpdate.updateMsg}
                </p>
                <div className="bg-orange-50 rounded-2xl px-4 py-3 text-center">
                  <p className="text-xs text-orange-500 font-bold">{(t.force_update_version || '').replace('{version}', APP_VERSION)}</p>
                </div>
                <button
                  onClick={() => window.open(forceUpdate.storeUrl, '_system')}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-base rounded-2xl transition-all shadow-lg shadow-orange-200"
                >
                  {t.force_update_btn}
                </button>
              </div>
            </div>
          </div>
        )}

        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 text-center">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t.exit_modal_title}</h3>
              <div className="flex gap-3">
                <button onClick={() => setShowExitModal(false)} className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-black">{t.exit_modal_stay}</button>
                <button onClick={() => CapApp.exitApp()} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-3 rounded-xl font-bold">{t.exit_modal_leave}</button>
              </div>
            </div>
          </div>
        )}

        {user && userProfile && userProfile.nickname && view !== 'reader' && view !== 'book_detail' && (
          <nav className="flex-none bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex items-center px-1 pt-1 z-40" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}>
            <button onClick={() => setView('home')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'home' ? 'text-orange-600' : 'text-slate-400'}`}>
              <Home className={`w-6 h-6 ${view === 'home' ? 'fill-orange-100' : ''}`} /><span className="text-[10px] font-bold">{t.tab_home}</span>
            </button>
            <button onClick={() => setView('library')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'library' ? 'text-orange-600' : 'text-slate-400'}`}>
              <Library className={`w-6 h-6 ${view === 'library' ? 'fill-orange-100' : ''}`} /><span className="text-[10px] font-bold">{t.tab_library}</span>
            </button>
            <button onClick={() => setView('write')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors relative ${view === 'write' ? 'text-orange-600' : 'text-slate-400'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${view === 'write' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-400'}`}><PenTool className="w-6 h-6" /></div><span className="text-[10px] font-bold mt-0.5">{t.tab_write}</span>
            </button>
            <button onClick={() => setView('archive')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'archive' ? 'text-orange-600' : 'text-slate-400'}`}>
              <Bookmark className={`w-6 h-6 ${view === 'archive' ? 'fill-orange-100' : ''}`} /><span className="text-[10px] font-bold">{t.tab_bookmarks}</span>
            </button>
            <button onClick={() => setView('profile')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'profile' ? 'text-orange-600' : 'text-slate-400'}`}>
              <User className={`w-6 h-6 ${view === 'profile' ? 'fill-orange-100' : ''}`} /><span className="text-[10px] font-bold">{t.tab_profile}</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default App;