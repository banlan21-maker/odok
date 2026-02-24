import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Coffee, Lightbulb, ChevronLeft,
  RefreshCw, Book, Calendar, List, ArrowRight, User, PenTool, Save,
  Star, MessageCircle, Reply, Send, MoreHorizontal, Bookmark, Heart, Globe, Home, Edit2, Flag, X, Library, Vote, Trophy, CheckCircle, Smile, Zap, Brain, Sparkles, LogOut, Lock, Droplets, Video
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

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const APP_VERSION = "1.07";

const App = () => {

  // Shared State
  const [view, setView] = useState('profile_setup');
  const viewRef = useRef(view);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);
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
    tempNickname, setTempNickname, tempAnonymousActivity, setTempAnonymousActivity,
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
    handleWatchAdForRead, handleBookClick
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
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                  <PenTool className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{remainingDailyWrites}</span>
                </div>
                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded-lg">
                  <span className="text-red-600 font-black text-xs">↑</span>
                  <span className="text-xs font-black text-red-600">Lv.{levelInfo.level}</span>
                </div>
                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                  <Droplets className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />
                  <span className="text-xs font-bold">{userProfile.ink || 0}</span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main id="main-content" className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-5 relative">

          {storyReaderHook.isHelpModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg dark:text-slate-100">사용 설명서</h3><button onClick={() => storyReaderHook.setIsHelpModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  <section>
                    <h4 className="font-bold text-slate-800 mb-1">1. 🖊️ 집필 시스템</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                      <li><strong>1일 2회 집필:</strong> 매일 최대 2번 글을 쓸 수 있습니다. (첫 번째 무료, 두 번째는 잉크 소모·레벨에 따라 3~5개)</li>
                      <li><strong>선착순 발행:</strong> 장르별로 <strong>하루에 단 한 권</strong>만 발행됩니다. 서둘러 집필해보세요!</li>
                      <li><strong>광고 찬스:</strong> 광고를 보면 잉크 없이 무료로 한 번 더 집필할 수 있습니다.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 mb-1">2. 💧 잉크 시스템</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                      <li><strong>획득:</strong> 출석(레벨별 2~5개), 레벨업 시 5개, 집필 완료 시 보상 등.</li>
                      <li><strong>사용:</strong> 책 읽기(1~2개), 추가 집필, 키워드 변경, 작가 후원, <strong>작품 홍보(10개)</strong>에 사용됩니다.</li>
                      <li><strong>XP:</strong> 잉크 1개 사용 시 10XP가 쌓여 레벨업에 반영됩니다.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 mb-1">3. 🏆 레벨 &amp; 칭호 (7단계)</h4>
                    <p className="text-xs mb-1">잉크 사용 시 10XP 적립 → 레벨 상승 → 칭호·아이콘이 책 표지 등에 표시됩니다.</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                      <li><strong>🌱 새싹 (Lv.1~10):</strong> 기본 혜택, 출석 2개</li>
                      <li><strong>✏️ 작가 (Lv.11~20):</strong> 출석 3개, 후원 기능 오픈</li>
                      <li><strong>🪶 숙련 작가 (Lv.21~40):</strong> 출석 4개, 키워드 무료 새로고침</li>
                      <li><strong>🖊️ 베스트 작가 (Lv.41~60):</strong> 독서 비용 할인 (2→1)</li>
                      <li><strong>✒️ 스타 작가 (Lv.61~80):</strong> 집필 비용 할인 (5→4)</li>
                      <li><strong>🖋️ 거장 (Lv.81~98):</strong> 출석 5개</li>
                      <li><strong>🌈 마스터 (Lv.99):</strong> 집필 비용 최종 할인 (5→3)</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 mb-1">4. 📢 작품 홍보</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                      <li>본인이 쓴 책 상세에서 <strong>홍보하기</strong> 버튼을 누르면, 잉크 10개로 <strong>48시간 동안</strong> 홈의 「작품 홍보」 구역에 노출됩니다.</li>
                      <li>이미 홍보 중인 작품이 있으면 새로 홍보할 수 없습니다.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 mb-1">5. 📚 릴레이 시리즈</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
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
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
                <div className="flex items-center justify-between"><div className="text-lg font-black text-slate-800 dark:text-slate-100">{t.notice_title}</div><button onClick={() => setSelectedNotice(null)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500"><X className="w-4 h-4" /></button></div>
                <div className="space-y-2"><div className="text-lg font-black text-slate-800 dark:text-slate-100">{selectedNotice.title}</div><div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{selectedNotice.content}</div></div>
                {isNoticeAdmin && (
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
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
                    placeholder={t.title_placeholder}
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
                <p className="text-xs text-slate-500">{language === 'en' ? 'Daily check-in reward' : '매일 접속하면 잉크가 지급돼요!'}</p>
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
              tempAnonymousActivity={tempAnonymousActivity} setTempAnonymousActivity={setTempAnonymousActivity}
              language={language} setLanguage={setLanguage}
              fontSize={fontSize} setFontSize={setFontSize}
              darkMode={darkMode} setDarkMode={setDarkMode}
              handleGoogleLogin={handleGoogleLogin} saveProfile={saveProfile}
              handleLogout={handleLogout} addInk={addInk} handleDeleteAccount={handleDeleteAccount}
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
                  handleBookClick={handleBookClick} authorProfiles={authorProfiles}
                  promotions={promotions} books={books}
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
                <ReaderView book={currentBook} onBack={() => { setCurrentBook(null); setView('library'); }} fontSize={fontSize} />
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

              {view === 'library' && <LibraryView t={t} books={books} onBookClick={handleBookClick} filter={libraryFilter} onFilterChange={setLibraryFilter} authorProfiles={authorProfiles} />}

              {view === 'archive' && <ArchiveView t={t} books={books} user={user} favoriteBookIds={storyReaderHook.bookFavorites.map(f => f.bookId)} onBookClick={handleBookClick} authorProfiles={authorProfiles} />}

              {view === 'book_detail' && selectedBook && (
                <BookDetail
                  book={selectedBook} onBookUpdate={setSelectedBook} user={user} userProfile={userProfile}
                  appId={appId} fontSize={fontSize} slotStatus={slotStatus} deductInk={deductInk} t={t}
                  isAdmin={isNoticeAdmin} authorProfiles={authorProfiles}
                  promotions={promotions} createPromotion={createPromotion}
                  onClose={() => {
                    const isMyBook = selectedBook.authorId === user?.uid;
                    setSelectedBook(null);
                    setView(isMyBook ? 'archive' : 'library');
                  }}
                />
              )}

              {view === 'profile' && (
                <ProfileView
                  user={user} userProfile={userProfile} t={t} levelInfo={levelInfo}
                  tempNickname={tempNickname} setTempNickname={setTempNickname}
                  tempAnonymousActivity={tempAnonymousActivity} setTempAnonymousActivity={setTempAnonymousActivity}
                  language={language} setLanguage={setLanguage} fontSize={fontSize} setFontSize={setFontSize}
                  darkMode={darkMode} setDarkMode={setDarkMode}
                  handleGoogleLogin={handleGoogleLogin} saveProfile={saveProfile} handleLogout={handleLogout}
                  addInk={addInk} handleDeleteAccount={handleDeleteAccount} error={error} setError={setError} appId={appId}
                  onOpenHelp={() => storyReaderHook.setIsHelpModalOpen(true)}
                />
              )}
            </>
          )}
        </main>

        {showWritingCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 text-center">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.writing_complete_title}</p>
              <div className="flex gap-2">
                <button onClick={() => {
                  const book = books.find(b => b.id === showWritingCompleteModal.book.id) || showWritingCompleteModal.book;
                  setSelectedBook(book); setView('book_detail'); setShowWritingCompleteModal(null);
                }} className="flex-1 py-3 rounded-xl text-sm font-black bg-orange-500 text-white">{t.view_book_now}</button>
                <button onClick={() => setShowWritingCompleteModal(null)} className="flex-1 py-3 rounded-xl text-sm font-black bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{t.stay}</button>
              </div>
            </div>
          </div>
        )}

        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 text-center">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">오독오독을 종료하시겠습니까?</h3>
              <div className="flex gap-3">
                <button onClick={() => setShowExitModal(false)} className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-black">머물기</button>
                <button onClick={() => CapApp.exitApp()} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-3 rounded-xl font-bold">나가기</button>
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