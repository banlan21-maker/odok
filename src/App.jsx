import React, { useState } from 'react';
import {
  BookOpen, Coffee, Lightbulb, ChevronLeft,
  RefreshCw, Book, Calendar, List, ArrowRight, User, PenTool, Save,
  Star, MessageCircle, Reply, Send, MoreHorizontal, Bookmark, Heart, Globe, Home, Edit2, Flag, X, Library, Vote, Trophy, CheckCircle, HelpCircle, Smile, Zap, Brain, Sparkles, LogOut, Lock, Droplets, Video
} from 'lucide-react';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useUserProfile } from './hooks/useUserProfile';
import { useNotices } from './hooks/useNotices';
import { useInkSystem } from './hooks/useInkSystem';
import { useBooks } from './hooks/useBooks';
import { useComments } from './hooks/useComments';
import { useStoryReader } from './hooks/useStoryReader';

// Utils & Data
import { T, genres } from './data';
import { getReadInkCost, getExtraWriteInkCost } from './utils/levelUtils';
import { getTodayDateKey } from './utils/dateUtils';

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

const App = () => {
  // Shared State
  const [view, setView] = useState('profile_setup');
  const [error, setError] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [currentBook, setCurrentBook] = useState(null);

  // 1. Auth Hook
  const {
    user,
    handleGoogleLogin,
    handleLogout,
    showInAppBrowserWarning
  } = useAuth({ setView, setError });

  // 2. User Profile Hook
  const {
    userProfile, setUserProfile,
    tempNickname, setTempNickname,
    language, setLanguage,
    fontSize, setFontSize,
    isNoticeAdmin, saveProfile,
    showSaveSuccessModal, setShowSaveSuccessModal,
    handleDevReset, handleDeleteAccount,
    earnPoints,
    levelInfo, remainingDailyWrites
  } = useUserProfile({ user, setView, setError, viewRef: { current: view } });

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
    todayBooks, weeklyBestBooks, topWriters,
    isLoadingHomeData,
    isWritingInProgress, setIsWritingInProgress,
    showWritingCompleteModal, setShowWritingCompleteModal,
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
    openNoticeEditor
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

  const t = T[language] || T.ko;

  const filteredStories = storyReaderHook.stories.filter(s => {
    if (s.genreId !== storyReaderHook.selectedGenre?.id) return false;
    if (storyReaderHook.selectedSubGenre && s.subGenre !== storyReaderHook.selectedSubGenre.id) return false;
    if (!storyReaderHook.selectedSubGenre && s.subGenre) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const hasTodayStory = filteredStories.some(s => s.date === getTodayDateKey());
  const isSeriesLimitReached = (userProfile?.lastSeriesGeneratedDate === getTodayDateKey());

  return (
    <div className="bg-gray-100 min-h-screen flex justify-center items-center">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Jua&display=swap'); .font-jua { font-family: 'Jua', sans-serif; } .scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      <div className="w-full max-w-md bg-slate-50 h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden text-slate-900 font-sans selection:bg-orange-200">

        {/* In-App Browser Warning */}
        {showInAppBrowserWarning && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-slate-800">외부 브라우저가 필요합니다</h2>
                <p className="text-sm text-slate-600">구글 로그인을 위해 외부 브라우저로 접속해주세요.</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="flex-none bg-white/90 backdrop-blur-md border-b border-slate-100 z-40 px-4 h-14 flex items-center justify-between">
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
              }} className="p-2 -ml-2 rounded-full hover:bg-slate-50"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
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
              }} className="p-2 -ml-2 rounded-full hover:bg-slate-50"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
            ) : <Book className="w-6 h-6 text-orange-600" />}
            <h1 className="text-sm font-jua text-slate-800 leading-3 whitespace-pre-line text-center pt-1">{t.app_name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {userProfile && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                  <PenTool className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{remainingDailyWrites}</span>
                </div>
                <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                  <span className="text-red-600 font-black text-xs">↑</span>
                  <span className="text-xs font-black text-red-600">Lv.{levelInfo.level}</span>
                </div>
                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                  <Droplets className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />
                  <span className="text-xs font-bold">{userProfile.ink || 0}</span>
                </div>
                <button onClick={() => storyReaderHook.setIsHelpModalOpen(true)} className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200"><HelpCircle className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main id="main-content" className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-5 relative">

          {storyReaderHook.isHelpModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold">사용 설명서</h3><button onClick={() => storyReaderHook.setIsHelpModalOpen(false)}><X className="w-4 h-4" /></button></div>
                <div className="text-sm text-slate-600 space-y-2"><p>1. 잉크를 사용하여 책을 읽거나 집필할 수 있습니다.</p><p>2. 매일 출석하면 잉크를 받습니다.</p><p>3. 하루 2회 집필 가능 (1회 무료).</p></div>
              </div>
            </div>
          )}

          {storyReaderHook.isUnlockModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold mb-3">{t.unlock_title}</h3><div className="space-y-2"><button onClick={() => storyReaderHook.processUnlock('free', t)} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold">{t.unlock_btn_free}</button><button onClick={() => storyReaderHook.processUnlock('point', t)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">{t.unlock_btn_paid}</button><button onClick={() => storyReaderHook.setIsUnlockModalOpen(false)} className="w-full bg-slate-100 py-3 rounded-xl font-bold">{t.cancel}</button></div></div></div>
          )}

          {selectedNotice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
                <div className="flex items-center justify-between"><div className="text-lg font-black text-slate-800">공지사항</div><button onClick={() => setSelectedNotice(null)} className="p-1.5 rounded-full bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button></div>
                <div className="space-y-2"><div className="text-lg font-black text-slate-800">{selectedNotice.title}</div><div className="text-sm text-slate-600 whitespace-pre-line">{selectedNotice.content}</div></div>
              </div>
            </div>
          )}

          {showInkConfirmModal && pendingBook && !pendingBookData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
                <div className="text-center space-y-2"><h3 className="text-lg font-black text-slate-800">잉크를 사용하시겠습니까?</h3><p className="text-sm text-slate-600">잉크 {getReadInkCost(levelInfo.level)}방울을 사용합니다.</p></div>
                <div className="space-y-3"><button onClick={handleWatchAdForRead} className="w-full bg-blue-500 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2"><Video className="w-5 h-5" />광고 보고 무료로 읽기</button><button onClick={() => confirmOpenBook(false)} className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">내 잉크 사용하기</button><button onClick={() => { setShowInkConfirmModal(false); setPendingBook(null); }} className="w-full text-slate-400 py-2 text-xs font-bold underline">닫기</button></div>
              </div>
            </div>
          )}

          {showInkConfirmModal && pendingBookData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
                <div className="text-center space-y-2"><h3 className="text-xl font-black text-slate-800">추가 집필</h3><p className="text-sm text-slate-600"><span className="text-orange-500">{getExtraWriteInkCost(levelInfo.level)} 잉크</span>를 사용하여 추가로 집필하시겠습니까?</p></div>
                <div className="flex gap-3"><button onClick={() => { setShowInkConfirmModal(false); setPendingBookData(null); }} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold">취소</button><button onClick={async () => { setShowInkConfirmModal(false); const bookData = pendingBookData; setPendingBookData(null); await handleBookGenerated(bookData, true); }} className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-black">집필</button></div>
              </div>
            </div>
          )}

          {showLevelUpModal && newLevel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl p-8 w-full max-w-sm shadow-xl space-y-4 text-center">
                <h2 className="text-3xl font-black text-slate-800">축하합니다! 🎉</h2><p className="text-xl font-black text-orange-600">레벨 {newLevel}이 되었습니다!</p><button onClick={() => { setShowLevelUpModal(false); setNewLevel(null); }} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black mt-4">확인</button>
              </div>
            </div>
          )}

          {!user && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in">
              <div className="text-center space-y-4"><h1 className="text-3xl font-black text-slate-800 mb-2">오독오독</h1><p className="text-slate-600 font-bold">나만의 책을 만들고 읽는 공간</p></div>
              <div className="w-full max-w-sm space-y-4"><button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-black flex items-center justify-center gap-3"><Globe className="w-6 h-6 text-slate-400" />Google로 시작하기</button>{error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-red-600 text-xs font-bold">{error}</p></div>}</div>
            </div>
          )}

          {user && (!userProfile || !userProfile.nickname) && (
            <ProfileView
              user={user} userProfile={userProfile} t={t} levelInfo={levelInfo}
              tempNickname={tempNickname} setTempNickname={setTempNickname}
              language={language} setLanguage={setLanguage}
              fontSize={fontSize} setFontSize={setFontSize}
              handleGoogleLogin={handleGoogleLogin} saveProfile={saveProfile}
              handleLogout={handleLogout} addInk={addInk} handleDeleteAccount={handleDeleteAccount}
              error={error} setError={setError} appId={appId}
            />
          )}

          {user && userProfile && userProfile.nickname && (
            <>
              {view === 'home' && (
                <HomeView
                  userProfile={userProfile} t={t} levelInfo={levelInfo} notices={notices}
                  setView={setView} todayBooks={todayBooks} weeklyBestBooks={weeklyBestBooks}
                  topWriters={topWriters} isLoadingHomeData={isLoadingHomeData}
                  handleBookClick={handleBookClick}
                />
              )}

              {view === 'notice_list' && (
                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-800">공지사항</h2><span className="text-xs text-slate-400">{notices.length}건</span></div>
                  {notices.map(notice => (
                    <button key={notice.id} onClick={() => setSelectedNotice(notice)} className="w-full text-left p-4 bg-white rounded-2xl border border-slate-100 shadow-sm mb-2">
                      <div className="font-bold text-slate-800">{notice.title}</div>
                    </button>
                  ))}
                  {isNoticeAdmin && <button onClick={openNoticeEditor} className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center font-black">글쓰기</button>}
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
                    user={user} userProfile={userProfile} onBookGenerated={handleBookGenerated}
                    slotStatus={slotStatus} setView={setView} setSelectedBook={setSelectedBook}
                    error={error} setError={setError} deductInk={deductInk}
                    onGeneratingChange={setIsWritingInProgress} onGenerationComplete={() => { }}
                  />
                </div>
              )}

              {view === 'library' && <LibraryView books={books} onBookClick={handleBookClick} filter={libraryFilter} onFilterChange={setLibraryFilter} />}

              {view === 'archive' && <ArchiveView books={books} user={user} favoriteBookIds={storyReaderHook.bookFavorites.map(f => f.bookId)} onBookClick={handleBookClick} />}

              {view === 'book_detail' && selectedBook && (
                <BookDetail
                  book={selectedBook} onBookUpdate={setSelectedBook} user={user} userProfile={userProfile}
                  appId={appId} fontSize={fontSize} slotStatus={slotStatus} deductInk={deductInk}
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
                  language={language} setLanguage={setLanguage} fontSize={fontSize} setFontSize={setFontSize}
                  handleGoogleLogin={handleGoogleLogin} saveProfile={saveProfile} handleLogout={handleLogout}
                  addInk={addInk} handleDeleteAccount={handleDeleteAccount} error={error} setError={setError} appId={appId}
                />
              )}
            </>
          )}
        </main>

        {showWritingCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 text-center">
              <p className="text-sm font-bold text-slate-700">집필이 완료되었습니다!</p>
              <div className="flex gap-2">
                <button onClick={() => {
                  const book = books.find(b => b.id === showWritingCompleteModal.book.id) || showWritingCompleteModal.book;
                  setSelectedBook(book); setView('book_detail'); setShowWritingCompleteModal(null);
                }} className="flex-1 py-3 rounded-xl text-sm font-black bg-orange-500 text-white">생성소설 바로보기</button>
                <button onClick={() => setShowWritingCompleteModal(null)} className="flex-1 py-3 rounded-xl text-sm font-black bg-slate-100 text-slate-600">머물기</button>
              </div>
            </div>
          </div>
        )}

        {user && userProfile && userProfile.nickname && view !== 'reader' && view !== 'book_detail' && (
          <nav className="flex-none h-16 bg-white border-t border-slate-100 flex items-center px-1 pb-2 pt-1 z-40">
            <button onClick={() => setView('home')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'home' ? 'text-orange-600' : 'text-slate-400'}`}>
              <Home className={`w-6 h-6 ${view === 'home' ? 'fill-orange-100' : ''}`} /><span className="text-[10px] font-bold">홈</span>
            </button>
            <button onClick={() => setView('library')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'library' ? 'text-orange-600' : 'text-slate-400'}`}>
              <Library className={`w-6 h-6 ${view === 'library' ? 'fill-orange-100' : ''}`} /><span className="text-[10px] font-bold">서재</span>
            </button>
            <button onClick={() => setView('write')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors relative ${view === 'write' ? 'text-orange-600' : 'text-slate-400'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${view === 'write' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-400'}`}><PenTool className="w-6 h-6" /></div><span className="text-[10px] font-bold mt-0.5">집필</span>
            </button>
            <button onClick={() => setView('archive')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'archive' ? 'text-orange-600' : 'text-slate-400'}`}>
              <Bookmark className={`w-6 h-6 ${view === 'archive' ? 'fill-orange-100' : ''}`} /><span className="text-[10px] font-bold">보관함</span>
            </button>
            <button onClick={() => setView('profile')} className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'profile' ? 'text-orange-600' : 'text-slate-400'}`}>
              <User className={`w-6 h-6 ${view === 'profile' ? 'fill-orange-100' : ''}`} /><span className="text-[10px] font-bold">프로필</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default App;