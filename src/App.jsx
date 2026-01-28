import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  BookOpen, Coffee, Lightbulb, ChevronLeft, 
  RefreshCw, Book, Calendar, List, ArrowRight, User, PenTool, Save,
  Star, MessageCircle, Reply, Send, MoreHorizontal, Bookmark, Heart, Globe, Home, Edit2, Flag, X, Library, Vote, Trophy, CheckCircle, HelpCircle, Smile, Zap, Brain, Sparkles, LogOut, Lock, Droplets
} from 'lucide-react';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { 
  collection, query, onSnapshot, 
  doc, setDoc, getDoc, addDoc, deleteDoc, serverTimestamp, updateDoc, increment, where, getDocs, limit, orderBy, Timestamp
} from 'firebase/firestore';
import { 
  signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, deleteUser
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase';
import { startOfDay, subDays, endOfDay, format, startOfWeek, endOfWeek } from 'date-fns';

// 데이터와 컴포넌트 불러오기
import { T, genres } from './data';
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

// Firebase configuration은 firebase.js에서 가져옴

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const MAX_LEVEL = 99;
const INK_MAX = 999;
const INITIAL_INK = 25;
const REWARD_INK = 25;
const EXTRA_WRITE_INK_COST = 5;
const READ_INK_COST = 1;
const DAILY_WRITE_LIMIT = 2;
const DAILY_FREE_WRITES = 1;

const App = () => {
  const [view, setView] = useState('profile_setup'); 
  const viewRef = useRef(view);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // Step 1: 기본 구조용 상태
  const [books, setBooks] = useState([]); // 생성된 책 목록
  const [currentBook, setCurrentBook] = useState(null); // 현재 읽고 있는 책 (기존 읽기 화면용)
  const [selectedBook, setSelectedBook] = useState(null); // 상세 보기용 책 (BookDetail용)
  const [libraryFilter, setLibraryFilter] = useState('all'); // 서재 필터: 'all', 'webnovel', 'novel', 'essay', 'self-improvement', 'humanities'
  // Step 5: 글로벌 일일 생성 제한용 상태 (7개 슬롯 - 시리즈 분리)
  const [slotStatus, setSlotStatus] = useState({
    'webnovel': null, // 웹소설 (단편 고정)
    'novel': null, // 소설 (단편 고정)
    'series-webnovel': null, // 시리즈 - 웹소설형
    'series-novel': null, // 시리즈 - 소설형
    'essay': null,
    'self-help': null, // 자기계발 (self-improvement -> self-help로 변경)
    'humanities': null
  }); // 각 슬롯의 상태: null(사용 가능) 또는 { book: {...}, authorName: '...' }
  // Step 3: 홈 화면용 상태
  const [todayBooks, setTodayBooks] = useState([]); // 오늘 생성된 책들
  const [weeklyBestBooks, setWeeklyBestBooks] = useState([]); // 주간 베스트셀러
  const [topWriters, setTopWriters] = useState([]); // 주간 집필왕
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(true); // 홈 데이터 로딩 상태
  
  const [stories, setStories] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [bookFavorites, setBookFavorites] = useState([]);
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [isNoticeEditorOpen, setIsNoticeEditorOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [isSavingNotice, setIsSavingNotice] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [comments, setComments] = useState([]);
  const [readHistory, setReadHistory] = useState([]); 
  const [dailyStats, setDailyStats] = useState([]); 
  const [unlockedStories, setUnlockedStories] = useState([]);
  const [seriesVotes, setSeriesVotes] = useState([]);

  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedSubGenre, setSelectedSubGenre] = useState(null); 
  const [currentStory, setCurrentStory] = useState(null);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [tempNickname, setTempNickname] = useState("");
  const [language, setLanguage] = useState('ko'); 
  const [fontSize, setFontSize] = useState('text-base');
  const [readerLang, setReaderLang] = useState('ko');
  const [translatedContent, setTranslatedContent] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);
  
  // ⭐️ 댓글 관련 상태
  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState(null);
  const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
  const [recommendStep, setRecommendStep] = useState('main'); 
  const [recommendedData, setRecommendedData] = useState(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockTargetStory, setUnlockTargetStory] = useState(null);
  const [libraryTab, setLibraryTab] = useState('created'); 
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [canFinishRead, setCanFinishRead] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [showInkConfirmModal, setShowInkConfirmModal] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingBook, setPendingBook] = useState(null); // 잉크 확인 대기 중인 책
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(null);
  const [pendingBookData, setPendingBookData] = useState(null); // 수정 1: 추가 집필 확인 대기 중인 책 데이터
  
  // 인앱 브라우저 감지 상태
  const [showInAppBrowserWarning, setShowInAppBrowserWarning] = useState(false);
  const [detectedInAppBrowser, setDetectedInAppBrowser] = useState(null);
  const [detectedDevice, setDetectedDevice] = useState(null); // 'ios' | 'android' | 'unknown'
  const allowExitRef = useRef(false);
  
  const readingStartTime = useRef(null);
  const t = (T && T[language]) ? T[language] : T['ko']; 
  const isNoticeAdmin = user?.email === 'banlan21@gmail.com';
  
  // 레벨 정보 계산 (새로운 필드 구조 사용)
  const levelInfo = userProfile ? {
    level: userProfile.level || 1,
    currentExp: userProfile.exp || 0,
    maxExp: userProfile.maxExp || 100,
    progress: userProfile.maxExp 
      ? Math.min(100, Math.floor(((userProfile.exp || 0) / userProfile.maxExp) * 100))
      : 0,
    remainingExp: userProfile.maxExp 
      ? Math.max(0, userProfile.maxExp - (userProfile.exp || 0))
      : 100
  } : { level: 1, currentExp: 0, maxExp: 100, progress: 0, remainingExp: 100 };

  const getTodayString = () => new Date().toISOString().split('T')[0];
  
  // 로컬 타임(KST) 기준으로 오늘 날짜를 YYYY-MM-DD 형식으로 반환
  const getTodayDateKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateKey = getTodayDateKey();
  const dailyWriteCount = userProfile?.dailyWriteCount || 0;
  const lastWriteDate = userProfile?.lastBookCreatedDate || null;
  const remainingDailyWrites = Math.max(
    0,
    DAILY_WRITE_LIMIT - (lastWriteDate === todayDateKey ? dailyWriteCount : 0)
  );

  // 인앱 브라우저 감지 함수
  const detectInAppBrowser = () => {
    if (typeof navigator === 'undefined') return null;
    
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const ua = userAgent.toLowerCase();
    
    // 디바이스 감지
    let device = 'unknown';
    if (/iphone|ipad|ipod/.test(ua)) {
      device = 'ios';
    } else if (/android/.test(ua)) {
      device = 'android';
    }
    
    // 인앱 브라우저 감지
    let inAppBrowser = null;
    
    if (ua.includes('kakaotalk') || ua.includes('kakaostory')) {
      inAppBrowser = '카카오톡';
    } else if (ua.includes('instagram')) {
      inAppBrowser = '인스타그램';
    } else if (ua.includes('fban') || ua.includes('fbav')) {
      inAppBrowser = '페이스북';
    } else if (ua.includes('naver')) {
      inAppBrowser = '네이버';
    } else if (ua.includes('line')) {
      inAppBrowser = '라인';
    } else if (ua.includes('snapchat')) {
      inAppBrowser = '스냅챗';
    } else if (ua.includes('tiktok')) {
      inAppBrowser = '틱톡';
    } else if (ua.includes('wv')) {
      // WebView 감지 (일반적인 인앱 브라우저)
      // 정상적인 크롬/엣지가 아닌 경우에만 인앱 브라우저로 간주
      // 크롬: 'chrome'과 'wv'가 함께 있는 경우가 있지만 정상 브라우저
      // 엣지: 'edg' 포함
      if (!ua.includes('chrome') && !ua.includes('edg') && !ua.includes('safari')) {
        inAppBrowser = '인앱 브라우저';
      }
    }
    
    return {
      isInApp: !!inAppBrowser,
      browserName: inAppBrowser,
      device: device
    };
  };

  // 인앱 브라우저 감지 (최초 1회 실행)
  useEffect(() => {
    const detection = detectInAppBrowser();
    if (detection && detection.isInApp) {
      console.warn('⚠️ 인앱 브라우저 감지:', {
        browser: detection.browserName,
        device: detection.device,
        userAgent: navigator.userAgent
      });
      setDetectedInAppBrowser(detection.browserName);
      setDetectedDevice(detection.device);
      setShowInAppBrowserWarning(true);
    }
  }, []); // 최초 1회만 실행

  // 1. 로그인 (Google 로그인 필수)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Google 로그인 또는 커스텀 토큰 로그인만 허용 (익명 로그인 차단)
        if (user.isAnonymous) {
          // 익명 사용자는 로그아웃 처리
          console.log('⚠️ 익명 로그인 감지, 로그아웃 처리');
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
          setView('login');
        } else {
          console.log('✅ 인증 상태 변경 - 로그인됨:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            currentView: view
          });
          setUser(user);
          // 로그인 페이지에 있으면 프로필 체크를 위해 대기 (프로필 useEffect가 처리)
          // view는 프로필 useEffect에서 닉네임 여부에 따라 결정됨
          // 단, login 화면에 있다면 일단 유지하고 프로필 useEffect가 처리하도록 함
        }
      } else {
        // 로그인되지 않은 상태 - 로그인 페이지 표시
        console.log('❌ 인증 상태 변경 - 로그아웃됨');
        setUser(null);
        setUserProfile(null);
        setView('login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const tryNativeSilentSignIn = async () => {
      if (!Capacitor.isNativePlatform()) return;
      if (auth.currentUser) return;
      try {
        const currentUserResult = await FirebaseAuthentication.getCurrentUser();
        if (!currentUserResult?.user) return;
        const tokenResult = await FirebaseAuthentication.getIdToken();
        if (!tokenResult?.token) return;
        const credential = GoogleAuthProvider.credential(tokenResult.token);
        await signInWithCredential(auth, credential);
      } catch (err) {
        console.warn('Native silent sign-in skipped:', err);
      }
    };

    tryNativeSilentSignIn();
  }, []);

  // 2. 프로필 (Part 1: 데이터 지속성 강화)
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (view === 'notice_list') {
      window.history.replaceState(window.history.state, '', '/notice');
    } else if (window.location.pathname === '/notice') {
      window.history.replaceState(window.history.state, '', '/');
    }
  }, [view]);

  useEffect(() => {
    if (window.location.pathname === '/notice' && user && userProfile?.nickname) {
      setView('notice_list');
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    
    // 먼저 문서가 존재하는지 확인 (getDoc으로 확실히 체크)
    const initProfile = async () => {
      try {
        const profileSnap = await getDoc(profileRef);
        
        // 문서가 없으면 신규 유저로 간주하고 초기 데이터 생성
        if (!profileSnap.exists()) {
          console.log('신규 유저 감지, 프로필 문서 생성:', user.uid);
          const initialProfileData = {
            nickname: '',
            language: 'ko',
            fontSize: 'text-base',
            points: 0,
            exp: 0,
            level: 1,
            maxExp: 100,
            ink: INITIAL_INK,
            bookCount: 0,
            dailyGenerationCount: 0,
            dailyFreeReadUsed: false,
            lastGeneratedDate: '',
            lastSeriesGeneratedDate: '',
            lastReadDate: '',
            lastAttendanceDate: '',
            dailyWriteCount: 0,
            lastBookCreatedDate: null,
            lastNicknameChangeDate: null, // Part 2: 닉네임 변경 날짜 추적
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          // setDoc으로 문서 생성 (merge 옵션 없이 새로 생성)
          await setDoc(profileRef, initialProfileData);
          console.log('✅ 프로필 문서 생성 완료');
          
          // 초기 데이터로 상태 설정
          setUserProfile(initialProfileData);
          setTempNickname('');
          setLanguage('ko');
          setFontSize('text-base');
          
          // 로그인 후 프로필 설정 화면으로 이동 (신규 유저)
          console.log('📍 프로필 설정 화면으로 이동 (신규 유저)');
          // view를 명시적으로 설정 (login 화면에서 이동)
          setView('profile_setup');
          return;
        }
        
        // 문서가 이미 존재하는 경우 - 기존 로직 실행
        const data = profileSnap.data();
        
        // 레벨링 시스템 필드 초기화 (필드가 없으면 기본값 설정)
        const needsUpdate = {};
        if (data.ink === undefined || data.ink === null) {
          needsUpdate.ink = INITIAL_INK;
        }
        if (data.level === undefined || data.level === null) {
          needsUpdate.level = 1;
        }
        if (data.exp === undefined || data.exp === null) {
          needsUpdate.exp = 0;
        }
        if (data.maxExp === undefined || data.maxExp === null) {
          needsUpdate.maxExp = 100;
        }
        if (data.dailyWriteCount === undefined || data.dailyWriteCount === null) {
          needsUpdate.dailyWriteCount = 0;
        }
        if (data.lastBookCreatedDate === undefined) {
          needsUpdate.lastBookCreatedDate = null;
        }
        if (data.lastNicknameChangeDate === undefined) {
          needsUpdate.lastNicknameChangeDate = null; // Part 2: 닉네임 변경 날짜 필드 추가
        }
        
        if (Object.keys(needsUpdate).length > 0) {
          try {
            await updateDoc(profileRef, needsUpdate);
            // 업데이트 후 다시 읽기 위해 return (아래 onSnapshot이 처리)
            return;
          } catch (err) {
            console.error('프로필 초기화 오류:', err);
          }
        }
        
        setUserProfile(data);
        setTempNickname(data.nickname || '');
        if (data.language) setLanguage(data.language);
        if (data.fontSize) setFontSize(data.fontSize);

        const today = getTodayString();
        if (data.lastAttendanceDate !== today) checkAttendance(profileRef, today);
        
        // 화면 전환 로직: 닉네임 여부와 현재 view 상태에 따라 결정 (긴급 버그 수정)
        if (!data.nickname || data.nickname.trim() === '') {
          // 닉네임이 없으면 프로필 설정 화면으로 이동
          console.log('📍 프로필 설정 화면으로 이동 (닉네임 없음)');
          setView('profile_setup');
        } else {
          // 닉네임이 있으면 홈 화면으로 이동
          console.log('🏠 홈 화면으로 이동 (닉네임 있음:', data.nickname, ')');
          if (viewRef.current === 'login' || viewRef.current === 'profile_setup' || !viewRef.current) {
            setView('home');
          }
        }
      } catch (err) {
        console.error('프로필 초기화 오류:', err);
        setError('프로필을 불러오는데 실패했습니다.');
      }
    };
    
    // 초기 프로필 체크 실행
    initProfile();
    
    // 실시간 동기화를 위한 onSnapshot 리스너 (긴급 버그 수정)
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('📊 프로필 스냅샷 업데이트:', {
          hasNickname: !!data.nickname,
          nickname: data.nickname || '(없음)',
          currentView: view
        });
        
        setUserProfile(data);
        if (data.nickname) {
          setTempNickname(data.nickname);
        }
        if (data.language) setLanguage(data.language);
        if (data.fontSize) setFontSize(data.fontSize);
        
        const today = getTodayString();
        if (data.lastAttendanceDate !== today) checkAttendance(profileRef, today);
        
        // 닉네임 상태에 따른 화면 전환 (실시간 업데이트)
        if (!data.nickname || data.nickname.trim() === '') {
          // 닉네임이 없으면 프로필 설정 화면으로
          if (viewRef.current === 'home' || viewRef.current === 'profile' || viewRef.current === 'login') {
            console.log('📍 프로필 설정 화면으로 이동 (snapshot: 닉네임 없음)');
            setView('profile_setup');
          }
        } else {
          // 닉네임이 있으면 프로필 설정 화면에서 홈으로
          if (viewRef.current === 'profile_setup' || viewRef.current === 'login') {
            console.log('🏠 홈 화면으로 이동 (snapshot: 닉네임 있음:', data.nickname, ')');
            setView('home');
          }
        }
      } else {
        // 문서가 삭제된 경우 (드문 경우)
        console.warn('⚠️ 프로필 문서가 존재하지 않습니다.');
        if (viewRef.current !== 'profile_setup' && viewRef.current !== 'login') {
          setView('profile_setup');
        }
      }
    }, (err) => {
      console.error("❌ Profile snapshot error:", err);
      setError('프로필을 불러오는데 실패했습니다. 페이지를 새로고침해주세요.');
    });
    
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const ensureHistoryState = () => {
      if (!window.history.state || !window.history.state.__odok) {
        window.history.pushState({ __odok: true }, '');
      }
    };

    ensureHistoryState();

    const handlePopState = () => {
      if (allowExitRef.current) {
        allowExitRef.current = false;
        return;
      }

      const currentView = viewRef.current;
      if (currentView === 'reader' || currentView === 'book_detail') {
        setView('home');
        setSelectedBook(null);
        setCurrentBook(null);
        setCurrentStory(null);
        window.history.pushState({ __odok: true }, '');
        return;
      }

      setShowExitConfirm(true);
      window.history.pushState({ __odok: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const checkAttendance = async (profileRef, today) => {
    try { await updateDoc(profileRef, { lastAttendanceDate: today, points: increment(1) }); setShowAttendanceModal(true); } catch(e) {}
  };

  // Step 1: 생성된 책 목록 가져오기 (서재용: 모든 유저의 책)
  // 실시간 동기화: onSnapshot을 사용하여 DB 변경 시 자동 업데이트
  useEffect(() => {
    if (!user) return;
    
    // Books collection 실시간 리스너 (로그 최소화)
    const booksRef = collection(db, 'artifacts', appId, 'books');
    const unsubBooks = onSnapshot(
      booksRef, 
      (snap) => {
        const booksData = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data() 
        }));
        
        // 로그 최소화: 처음 한 번만 또는 변경 시에만
        // console.log(`📚 Books fetched: ${booksData.length}개 책을 불러왔습니다.`);
        
        // 서재는 모든 책을 표시, 보관함에서는 필터링하여 사용
        setBooks(booksData);
      
      // Step 3: 홈 화면용 데이터 계산
      const todayDateKey = getTodayDateKey(); // 오늘 날짜 키 (한 번만 선언)
      const today = startOfDay(new Date());
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      
      // 오늘 생성된 책들 (dateKey로 필터링 - 단순화)
      const todayBooksList = booksData.filter(book => {
        // dateKey가 있으면 dateKey로 비교, 없으면 createdAt으로 비교 (하위 호환)
        if (book.dateKey) {
          return book.dateKey === todayDateKey;
        }
        // 오래된 데이터를 위한 fallback
        const createdAt = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
        return createdAt && createdAt >= today;
      }).sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0));
        const dateB = b.createdAt?.toDate?.() || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0));
        return dateB - dateA;
      });
      setTodayBooks(todayBooksList);
      
      // 주간 베스트셀러 (월~일, 조회+좋아요+즐겨찾기+완독 합계 기준 TOP 3)
      const weeklyBooks = booksData.filter(book => {
        const createdAt = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
        return createdAt && createdAt >= weekStart && createdAt <= weekEnd;
      }).map(book => ({
        ...book,
        score: (book.views || 0) + (book.likes || 0) + (book.favorites || 0) + (book.completions || 0)
      })).sort((a, b) => b.score - a.score).slice(0, 3);
      setWeeklyBestBooks(weeklyBooks);
      
      // Step 5: 글로벌 일일 생성 제한 - 슬롯 상태 확인 (단순화된 버전: dateKey 사용)
      
      // dateKey로 오늘 생성된 책 필터링 (단순 문자열 비교)
      const todayBooksForSlots = booksData.filter(book => {
        const bookDateKey = book.dateKey; // dateKey 필드 사용
        
        if (!bookDateKey) {
          // dateKey가 없는 오래된 책들은 무시 (마이그레이션 전 데이터)
          return false;
        }
        
        return bookDateKey === todayDateKey;
      });
      
      // 로그 최소화: 슬롯 체크 로그 제거
      
      // 각 슬롯 상태 확인 (7개 슬롯 - 시리즈 분리)
      const newSlotStatus = {
        'webnovel': null, // 웹소설 (단편 고정)
        'novel': null, // 소설 (단편 고정)
        'series-webnovel': null, // 시리즈 - 웹소설형
        'series-novel': null, // 시리즈 - 소설형
        'essay': null,
        'self-help': null, // 자기계발
        'humanities': null
      };
      
      // 슬롯 매핑 (7개 슬롯 체제 - 시리즈 분리)
      todayBooksForSlots.forEach(book => {
        const category = String(book.category || '').trim().toLowerCase(); // 소문자로 정규화
        const isSeries = book.isSeries === true; // 명시적으로 boolean 확인
        const subCategory = String(book.subCategory || '').trim().toLowerCase(); // 서브 카테고리
        
        // 시리즈는 웹소설형/소설형으로 분리하여 관리
        if (category === 'series' || isSeries) {
          // subCategory로 구분: 'webnovel' 또는 'novel'
          const seriesSlotKey = (subCategory === 'webnovel' || subCategory === 'web-novel') 
            ? 'series-webnovel' 
            : 'series-novel';
          
          if (!newSlotStatus[seriesSlotKey]) {
            newSlotStatus[seriesSlotKey] = {
              book: book,
              authorName: book.authorName || '익명'
            };
          }
        }
        // 웹소설 (단편 고정)
        else if (category === 'webnovel') {
          if (!newSlotStatus['webnovel']) {
            newSlotStatus['webnovel'] = {
              book: book,
              authorName: book.authorName || '익명'
            };
            // 로그 최소화
          }
        }
        // 소설 (단편 고정)
        else if (category === 'novel') {
          if (!newSlotStatus['novel']) {
            newSlotStatus['novel'] = {
              book: book,
              authorName: book.authorName || '익명'
            };
            // 로그 최소화
          }
        }
        // 에세이
        else if (category === 'essay') {
          if (!newSlotStatus['essay']) {
            newSlotStatus['essay'] = {
              book: book,
              authorName: book.authorName || '익명'
            };
            console.log('[슬롯 매핑] essay 슬롯 차지됨:', book.authorName);
          }
        }
        // 자기계발 (self-improvement -> self-help 매핑)
        else if (category === 'self-improvement' || category === 'self-help') {
          if (!newSlotStatus['self-help']) {
            newSlotStatus['self-help'] = {
              book: book,
              authorName: book.authorName || '익명'
            };
            console.log('[슬롯 매핑] self-help 슬롯 차지됨:', book.authorName);
          }
        }
        // 인문/철학
        else if (category === 'humanities') {
          if (!newSlotStatus['humanities']) {
            newSlotStatus['humanities'] = {
              book: book,
              authorName: book.authorName || '익명'
            };
            console.log('[슬롯 매핑] humanities 슬롯 차지됨:', book.authorName);
          }
        } else {
          console.warn('[슬롯 매핑] 알 수 없는 카테고리:', category, book);
        }
      });
      
      // 슬롯 상태 로그
      console.log('[슬롯 상태] 최종 슬롯 상태:', Object.keys(newSlotStatus).map(key => ({
        slot: key,
        status: newSlotStatus[key] ? `마감됨 (${newSlotStatus[key].authorName})` : '사용 가능'
      })));
      
      setSlotStatus(newSlotStatus);
      setIsLoadingHomeData(false);
    }, 
    (err) => {
      console.error("❌ Books fetch error:", err);
      setError('책 목록을 불러오는데 실패했습니다.');
    });
    
    return () => {
      console.log("📖 Books collection 리스너 해제");
      unsubBooks();
    };
  }, [user]);
  
  // Step 3: 주간 집필왕 (월~일 기준, 주간 집필 수 TOP 3)
  useEffect(() => {
    if (!user || books.length === 0) return;
    let isActive = true;
    const timer = setTimeout(() => {
      const buildTopWriters = async () => {
        const today = startOfDay(new Date());
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

        const weeklyBooks = books.filter(book => {
          const createdAt = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
          return createdAt && createdAt >= weekStart && createdAt <= weekEnd;
        });

        const counts = weeklyBooks.reduce((acc, book) => {
          const authorId = book.authorId;
          if (!authorId) return acc;
          if (!acc[authorId]) {
            acc[authorId] = {
              id: authorId,
              nickname: book.authorName || '익명',
              bookCount: 0
            };
          }
          acc[authorId].bookCount += 1;
          return acc;
        }, {});

        const topWritersList = Object.values(counts)
          .sort((a, b) => b.bookCount - a.bookCount)
          .slice(0, 3);

        const enriched = await Promise.all(topWritersList.map(async (writer) => {
          try {
            const profileRef = doc(db, 'artifacts', appId, 'users', writer.id, 'profile', 'info');
            const profileSnap = await getDoc(profileRef);
            const profileImageUrl = profileSnap.exists() ? profileSnap.data().profileImageUrl : null;
            return { ...writer, profileImageUrl: profileImageUrl || null };
          } catch (err) {
            console.warn('프로필 이미지 로드 실패:', err);
            return writer;
          }
        }));

        if (isActive) {
          setTopWriters(enriched);
        }
      };
      buildTopWriters();
    }, 200);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [user, books]);

  // Step 5: 슬롯 키 생성 헬퍼 함수 (7개 슬롯 체제 - 시리즈 분리)
  const getSlotKey = (category, isSeries, subCategory) => {
    // category를 소문자로 정규화하여 정확한 매칭 보장
    const normalizedCategory = String(category || '').trim().toLowerCase();
    const normalizedSubCategory = String(subCategory || '').trim().toLowerCase();
    
    // 시리즈는 웹소설형/소설형으로 분리
    if (isSeries || normalizedCategory === 'series') {
      // subCategory로 구분: 'webnovel' 또는 'novel'
      if (normalizedSubCategory === 'webnovel' || normalizedSubCategory === 'web-novel') {
        return 'series-webnovel';
      }
      return 'series-novel';
    }
    
    // 웹소설/소설은 단편 고정이므로 카테고리 그대로 사용
    if (normalizedCategory === 'webnovel' || normalizedCategory === 'novel') {
      return normalizedCategory; // 'webnovel' 또는 'novel'
    }
    
    // 자기계발: self-improvement -> self-help로 변환
    if (normalizedCategory === 'self-improvement') {
      return 'self-help';
    }
    
    // 다른 카테고리는 그대로 반환
    return normalizedCategory; // essay, humanities
  };

  // Step 1: 책 생성 완료 후 Firestore에 저장 (Step 5: 동시성 제어 추가)
  // 수정 1: 집필 제한 확인 및 추가 집필 확인 모달 처리
  const handleBookGenerated = async (bookData, useInk = false, options = {}) => {
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }

    try {
      const { skipDailyCheck = false, skipInkDeduct = false } = options || {};
      // 수정 1: 하루 2회 제한 체크 (1회 무료 + 1회 잉크)
      const profileRefForCheck = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      const profileSnapForCheck = await getDoc(profileRefForCheck);
      const todayDateKey = getTodayDateKey(); // YYYY-MM-DD 형식
      
      let lastBookCreatedDate = null;
      let dailyWriteCount = 0;
      if (profileSnapForCheck.exists()) {
        const profileData = profileSnapForCheck.data();
        lastBookCreatedDate = profileData.lastBookCreatedDate; // 날짜 문자열 (YYYY-MM-DD)
        dailyWriteCount = Number(profileData.dailyWriteCount || 0);
      }
      
      // 날짜가 바뀌면 일일 카운트 초기화
      if (lastBookCreatedDate !== todayDateKey) {
        dailyWriteCount = 0;
      }
      
      // 하루 최대 집필 제한
      if (dailyWriteCount >= DAILY_WRITE_LIMIT) {
        setError('하루에 최대 2회까지만 집필할 수 있어요.');
        setPendingBookData(null);
        return;
      }
      
      // 무료 집필 1회 이후에는 잉크 확인 모달 표시 (사전 확인을 건너뛴 경우에만)
      if (!skipDailyCheck && !useInk && dailyWriteCount >= DAILY_FREE_WRITES) {
        setPendingBookData(bookData);
        setShowInkConfirmModal(true); // 추가 집필 확인 모달 재사용
        return;
      }
      
      // 잉크를 사용하는 경우 잉크 확인
      if (useInk && !skipInkDeduct) {
        const currentInk = userProfile?.ink || 0;
        const requiredInk = EXTRA_WRITE_INK_COST;
        
        if (currentInk < requiredInk) {
          setError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
          setPendingBookData(null);
          return;
        }
        
        // 잉크 차감
        await deductInk(requiredInk);
        console.log(`✅ 추가 집필: 잉크 ${requiredInk} 차감`);
      }
      
      console.log(`${useInk ? '💰 유료' : '🆓 무료'} 집필 시작`);
      
      // Step 5: 동시성 제어 - 생성 직전 최종 확인 (단순화된 버전: dateKey 사용)
      const slotKey = getSlotKey(bookData.category, bookData.isSeries || false, bookData.subCategory);
      
      console.log('[동시성 제어] 슬롯 체크 시작:', {
        category: bookData.category,
        isSeries: bookData.isSeries,
        slotKey: slotKey,
        dateKey: todayDateKey
      });
      
      // dateKey로 오늘 생성된 책 조회 (단순 문자열 비교)
      const booksRef = collection(db, 'artifacts', appId, 'books');
      try {
        const q = query(
          booksRef,
          where('dateKey', '==', todayDateKey)
        );
        
        const snapshot = await getDocs(q);
        const todayBooks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        console.log('[동시성 제어] 오늘 생성된 책 개수:', todayBooks.length);
        
        // 해당 슬롯 확인 (7개 슬롯 체제에 맞게 - 시리즈 분리)
        const existingBook = todayBooks.find(book => {
          const bookCategory = String(book.category || '').trim().toLowerCase();
          const bookIsSeries = book.isSeries === true;
          const bookSubCategory = String(book.subCategory || '').trim().toLowerCase();
          const bookSlotKey = getSlotKey(bookCategory, bookIsSeries, bookSubCategory);
          
          const isMatch = bookSlotKey === slotKey;
          if (isMatch) {
            console.log('[동시성 제어] 중복 슬롯 발견:', {
              bookId: book.id,
              bookCategory: bookCategory,
              bookIsSeries: bookIsSeries,
              bookSubCategory: bookSubCategory,
              bookSlotKey: bookSlotKey,
              targetSlotKey: slotKey
            });
          }
          
          return isMatch;
        });
        
        if (existingBook) {
          // 이미 다른 유저가 생성함
          const existingAuthor = existingBook.authorName || '익명';
          const errorMsg = `아쉽지만 간발의 차로 다른 작가님이 먼저 집필하셨어요! (By. ${existingAuthor}) 서재에서 읽어보세요.`;
          console.error('[동시성 제어] 슬롯이 이미 차있음:', existingBook);
          setError(errorMsg);
          throw new Error('SLOT_ALREADY_TAKEN');
        }
        
        console.log('[동시성 제어] 슬롯 사용 가능, 생성 진행');
      } catch (queryErr) {
        // SLOT_ALREADY_TAKEN은 그대로 전파
        if (queryErr.message === 'SLOT_ALREADY_TAKEN') {
          throw queryErr;
        }
        console.error('[동시성 제어] 쿼리 오류:', queryErr);
        setError('시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        throw queryErr;
      }
      
      const authorName = userProfile?.nickname || '익명';
      
      // 수정 2: 시리즈 데이터 구조화
      const isSeries = bookData.isSeries || false;
      const bookDocumentData = {
        title: bookData.title,
        content: bookData.content,
        summary: bookData.summary || bookData.content.substring(0, 100) + '...',
        category: bookData.category,
        subCategory: bookData.subCategory || null,
        authorId: user.uid,
        authorName: authorName,
        createdAt: serverTimestamp(),
        dateKey: todayDateKey, // 로컬 타임 기준 날짜 문자열 (YYYY-MM-DD)
        views: 0,
        likes: 0,
        isSeries: isSeries
      };
      
      // 수정 2: 시리즈인 경우 추가 필드 설정
      if (isSeries) {
        bookDocumentData.seriesId = crypto.randomUUID(); // UUID 생성
        bookDocumentData.episode = 1; // 현재 회차
        bookDocumentData.maxEpisodes = 7; // 총 7화 완결 예정
        bookDocumentData.summary = bookData.summary || bookData.content.substring(0, 300) + '...'; // 3줄 요약 텍스트
      }
      
      // 새 스키마에 맞게 책 저장
      const bookRef = await addDoc(collection(db, 'artifacts', appId, 'books'), bookDocumentData);
      
      // 저장 성공 로그
      console.log("✅ Document written with ID: ", bookRef.id);
      console.log("📚 책 저장 완료:", {
        id: bookRef.id,
        title: bookData.title,
        category: bookData.category,
        authorName: authorName,
        dateKey: todayDateKey
      });

      // 유저 통계 업데이트: bookCount 증가 + 집필 보상 (수정 3: 잉크 소비 시에만 경험치 획득하므로 집필 시에는 잉크만 보상)
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      try {
        const rewardInk = REWARD_INK;
        
        // 수정 1: 집필 시에는 잉크만 보상하고, 경험치는 주지 않음 (잉크 소비 시에만 경험치 획득)
        // 수정 1: lastBookCreatedDate를 오늘 날짜 문자열로 저장
        const nextInk = Math.min(INK_MAX, (userProfile?.ink || 0) + rewardInk);
        const nextDailyWriteCount = lastBookCreatedDate === todayDateKey ? dailyWriteCount + 1 : 1;
        const updateData = {
          bookCount: increment(1),
          ink: nextInk,
          dailyWriteCount: nextDailyWriteCount,
          lastBookCreatedDate: todayDateKey // 수정 1: 하루 2회 제한용 날짜 문자열 (YYYY-MM-DD)
        };
        
        await updateDoc(profileRef, updateData);
        
        // 집필 완료 알림 (수정 3: 경험치 제거)
        console.log(`✅ 집필 완료! 잉크 +${REWARD_INK} 획득 (경험치는 잉크 소비 시에만 획득)`);
      } catch (profileErr) {
        // 프로필 문서가 없거나 필드가 없을 경우 초기화
        console.warn('프로필 업데이트 오류, 초기화 시도:', profileErr);
        try {
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const rewardInk = REWARD_INK;
            
            // 수정 1: 집필 시에는 잉크만 보상하고 경험치는 주지 않음
            // 수정 1: lastBookCreatedDate를 오늘 날짜 문자열로 저장
            const todayDateKey = getTodayDateKey();
            const existingDate = profileSnap.data().lastBookCreatedDate;
            const existingCount = Number(profileSnap.data().dailyWriteCount || 0);
            const nextDailyWriteCount = existingDate === todayDateKey ? existingCount + 1 : 1;
            const updateData = {
              bookCount: (profileSnap.data().bookCount || 0) + 1,
              ink: Math.min(INK_MAX, (profileSnap.data().ink || 0) + rewardInk),
              dailyWriteCount: nextDailyWriteCount,
              lastBookCreatedDate: todayDateKey // 수정 1: 하루 2회 제한용 날짜 문자열
            };
            
            await updateDoc(profileRef, updateData);
          } else {
            // 프로필이 없으면 생성
            const todayDateKey = getTodayDateKey();
            await setDoc(profileRef, { 
              bookCount: 1, 
              ink: INITIAL_INK,
              level: 1,
              exp: 0,  // 수정 3: 초기 경험치는 0 (잉크 소비 시에만 획득)
              maxExp: 100,
              dailyWriteCount: 1,
              lastBookCreatedDate: todayDateKey // 수정 1: 하루 2회 제한용 날짜 문자열
            }, { merge: true });
          }
        } catch (fallbackErr) {
          console.error('프로필 업데이트 실패:', fallbackErr);
          // 프로필 업데이트 실패해도 책 저장은 성공했으므로 계속 진행
        }
      }

      // 저장 성공 시 보관함으로 이동
      setView('archive');
      setError(null);
      
      // 집필 완료 토스트 메시지 (간단한 알림)
      setTimeout(() => {
        console.log(`📚 집필 완료! 잉크 ${REWARD_INK}과 경험치를 획득했습니다!`);
      }, 100);
    } catch (err) {
      console.error('책 저장 오류:', err);
      if (err.message === 'SLOT_ALREADY_TAKEN') {
        // 에러 메시지는 이미 setError로 설정됨
      } else {
        setError('책 저장에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  // 레벨업 계산 함수
  const calculateLevelUp = (currentLevel, currentExp, expGain, maxExp) => {
    const newExp = currentExp + expGain;
    
    // 레벨업이 필요한지 확인
    if (newExp >= maxExp && currentLevel < MAX_LEVEL) {
      const newLevel = currentLevel + 1;
      const remainingExp = newExp - maxExp;
      // 다음 레벨의 maxExp 계산 (이전 maxExp의 1.2배, 최소 100)
      const nextMaxExp = Math.max(100, Math.floor(maxExp * 1.2));
      
      return {
        leveledUp: true,
        newLevel,
        newExp: remainingExp,
        newMaxExp: nextMaxExp
      };
    }
    
    return {
      leveledUp: false,
      newLevel: currentLevel,
      newExp,
      newMaxExp: maxExp
    };
  };

  // 잉크 차감 함수 (경험치 획득 포함)
  const deductInk = async (amount) => {
    if (!user || !userProfile) return false;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    try {
      const currentLevel = userProfile.level || 1;
      const currentExp = userProfile.exp || 0;
      const maxExp = userProfile.maxExp || 100;
      const expGain = amount; // 잉크 사용량만큼 경험치 획득
      
      const levelUpResult = calculateLevelUp(currentLevel, currentExp, expGain, maxExp);
      
      const updateData = {
        ink: increment(-amount),
        exp: levelUpResult.newExp,
        maxExp: levelUpResult.newMaxExp
      };
      
      if (levelUpResult.leveledUp) {
        updateData.level = levelUpResult.newLevel;
      }
      
      await updateDoc(profileRef, updateData);
      
      // 레벨업 시 모달 표시
      if (levelUpResult.leveledUp) {
        setNewLevel(levelUpResult.newLevel);
        setShowLevelUpModal(true);
      }
      
      return true;
    } catch (err) {
      console.error('잉크 차감 오류:', err);
      return false;
    }
  };

  // 잉크 충전 함수 (수정 3: 잉크 충전 시에는 경험치 획득 안 함 - 잉크 소비 시에만 경험치 획득)
  const addInk = async (amount) => {
    if (!user || !userProfile) return false;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    try {
      // 잉크만 충전, 경험치는 획득하지 않음 (최대치 999)
      const profileSnap = await getDoc(profileRef);
      const currentInk = profileSnap.exists() ? (profileSnap.data().ink || 0) : (userProfile?.ink || 0);
      const nextInk = Math.min(INK_MAX, currentInk + amount);
      await updateDoc(profileRef, {
        ink: nextInk
      });
      
      console.log(`✅ 잉크 +${amount} 충전 완료`);
      return true;
    } catch (err) {
      console.error('잉크 충전 오류:', err);
      return false;
    }
  };

  // 잉크 확인 후 책 열기
  const openBookWithInkCheck = async (book) => {
    // 내 책이면 무료
    if (book.authorId === user?.uid) {
      setSelectedBook(book);
      setView('book_detail');
      return;
    }

    // 잉크 확인
    const currentInk = userProfile?.ink || 0;
    const requiredInk = READ_INK_COST;

    // 확인 모달 표시
    setPendingBook(book);
    setShowInkConfirmModal(true);
    if (currentInk < requiredInk) {
      setError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
    } else {
      setError(null);
    }
  };

  // 잉크 확인 모달에서 확인 버튼 클릭 (수정 3: 잉크 소비 시 경험치 획득)
  const confirmOpenBook = async () => {
    if (!pendingBook) return;

    const currentInk = userProfile?.ink || 0;
    if (currentInk < READ_INK_COST) {
      setError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
      return;
    }

    // 수정 3: 잉크 소비 시에만 경험치 획득 (잉크 -1, 경험치 +1)
    const success = await deductInk(READ_INK_COST);
    if (success) {
      // 다른 사람이 쓴 책을 읽는 경우에만 조회수 증가
      if (pendingBook.authorId !== user?.uid) {
        try {
          await updateDoc(doc(db, 'artifacts', appId, 'books', pendingBook.id), {
            views: increment(1)
          });
        } catch (viewErr) {
          console.error('조회수 증가 실패:', viewErr);
        }
      }
      setSelectedBook(pendingBook);
      setView('book_detail');
      setShowInkConfirmModal(false);
      setPendingBook(null);
      setError(null);
      console.log(`✅ 책 열기 완료: 잉크 -${READ_INK_COST}, 경험치 +${READ_INK_COST}`);
    } else {
      setError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
    }
  };
  
  // 수정 1: 추가 집필 확인 모달에서 확인 버튼 클릭 (handleBookGenerated의 useInk 파라미터로 처리)

  // Step 1: 서재에서 책 클릭 시 읽기 화면으로 이동 (간단 버전)
  const handleBookClick = (book) => {
    openBookWithInkCheck(book);
  };

  // 3. 데이터 Fetch
  useEffect(() => {
    const noticesRef = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc')
    );
    const unsubNotices = onSnapshot(noticesRef, (snap) => {
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubNotices();
  }, []);

  useEffect(() => {
    if (!user) return;
    const favRef = collection(db, 'artifacts', appId, 'public', 'data', 'favorites');
    const unsubFav = onSnapshot(favRef, (snap) => setFavorites(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const bookFavRef = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'book_favorites'),
      where('userId', '==', user.uid)
    );
    const unsubBookFav = onSnapshot(bookFavRef, (snap) => setBookFavorites(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const storiesRef = collection(db, 'artifacts', appId, 'public', 'data', 'stories');
    const unsubStories = onSnapshot(storiesRef, (snap) => setStories(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const ratingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'ratings');
    const unsubRatings = onSnapshot(ratingsRef, (snap) => setRatings(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const votesRef = collection(db, 'artifacts', appId, 'public', 'data', 'series_votes');
    const unsubVotes = onSnapshot(votesRef, (snap) => setSeriesVotes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unlockedRef = collection(db, 'artifacts', appId, 'users', user.uid, 'unlocked_stories');
    const unsubUnlocked = onSnapshot(unlockedRef, (snap) => setUnlockedStories(snap.docs.map(d => d.id)));
    const readHistoryRef = collection(db, 'artifacts', appId, 'users', user.uid, 'read_history');
    const unsubRead = onSnapshot(readHistoryRef, (snap) => setReadHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.readAt.localeCompare(a.readAt))));
    const statsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'daily_stats');
    const unsubStats = onSnapshot(statsRef, (snap) => {
        const stats = snap.docs.map(d => d.data());
        stats.sort((a, b) => b.date.localeCompare(a.date));
        setDailyStats(stats.slice(0, 7).reverse());
    });
    return () => { unsubFav(); unsubBookFav(); unsubStories(); unsubRatings(); unsubVotes(); unsubUnlocked(); unsubRead(); unsubStats(); };
  }, [user]);

  // ⭐️ 댓글 가져오기 + 정렬 로직 강화
  useEffect(() => {
    if (!user || !currentStory || view !== 'reader') return;
    const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'comments');
    const unsubComments = onSnapshot(commentsRef, (snap) => {
      const rawComments = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.storyId === currentStory.id);
      
      // 대댓글이 부모 밑으로 오게 정렬
      const sorted = [];
      const parents = rawComments.filter(c => !c.parentId).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      parents.forEach(p => {
        sorted.push(p);
        const children = rawComments.filter(c => c.parentId === p.id).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        sorted.push(...children);
      });
      
      setComments(sorted);
    });
    return () => unsubComments();
  }, [user, currentStory, view]);

  useEffect(() => {
    if (currentStory && stories.length > 0) {
      const updatedStory = stories.find(s => s.id === currentStory.id);
      if (updatedStory && updatedStory.body !== currentStory.body) { setCurrentStory(updatedStory); setTranslatedContent({}); setReaderLang('ko'); }
    }
  }, [stories, currentStory]);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-content');
    const handleScroll = () => { if (!scrollContainer) return; setScrollProgress(scrollContainer.scrollTop / (scrollContainer.scrollHeight - scrollContainer.clientHeight) * 100); };
    let finishCheckTimer;
    if (view === 'reader' && scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      readingStartTime.current = Date.now();
      setCanFinishRead(false);
      finishCheckTimer = setTimeout(() => setCanFinishRead(true), 180000);
      // 수정 3: 경험치는 잉크 소비 시에만 획득하므로, 읽기 중 자동 경험치 획득 제거
      updateDailyStats(1); // 일일 통계만 업데이트
    }
    return () => { if (scrollContainer) scrollContainer.removeEventListener('scroll', handleScroll); clearTimeout(finishCheckTimer); };
  }, [view]);

  useEffect(() => {
    if (view === 'reader') {
      setReaderLang('ko'); setTranslatedContent({}); setIsTranslating(false); 
      setEditingCommentId(null); setCommentInput(""); setReplyTo(null); // 댓글 상태 초기화
      setError(null); setIsReportModalOpen(false);
    }
  }, [currentStory, view]);

  // 함수 정의
  const handleGenreClick = (genre) => {
    if (genre.hasSubGenre) { setSelectedGenre(genre); setView('genre_select'); } 
    else { setSelectedGenre(genre); setSelectedSubGenre(null); setView('list'); }
    setError(null);
  };

  const handleSubGenreClick = (subGenreId) => {
    const genre = genres.find(g => g.id === selectedGenre.id);
    const subGenre = genre.subGenres.find(s => s.id === subGenreId);
    setSelectedSubGenre(subGenre);
    // 집필 화면에서는 view를 변경하지 않음
    if (view !== 'write') {
      setView('list');
    }
  };

  const getStoryStats = (sid) => { const r=ratings.filter(x=>x.storyId===sid); return {count:r.length, avg:r.length>0?(r.reduce((a,b)=>a+b.stars,0)/r.length).toFixed(1):"0.0"}; };
  const getFavoriteCount = (storyId) => favorites.filter(f => f.storyId === storyId).length;
  const isFavorited = (storyId) => favorites.some(f => f.storyId === storyId && f.userId === user?.uid);

  const displayTitle = readerLang === 'ko' ? currentStory?.title : translatedContent[readerLang]?.title || currentStory?.title;
  const displayBody = readerLang === 'ko' ? currentStory?.body : translatedContent[readerLang]?.body || currentStory?.body;
  const currentStoryStats = currentStory ? getStoryStats(currentStory.id) : { count: 0, avg: "0.0" };
  const myVote = seriesVotes.find(v => v.storyId === currentStory?.id && v.userId === user?.uid)?.vote;
  const voteCounts = currentStory ? {
    continue: seriesVotes.filter(v => v.storyId === currentStory.id && v.vote === 'continue').length,
    end: seriesVotes.filter(v => v.storyId === currentStory.id && v.vote === 'end').length
  } : { continue: 0, end: 0 };

  // Part 1: 닉네임 변경 제한 로직 포함한 saveProfile 함수
  const saveProfile = async () => {
    if (!tempNickname.trim()) return;
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }
    
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      
      // 현재 프로필 가져오기 (닉네임 변경 가능 여부 확인용)
      const profileSnap = await getDoc(profileRef);
      const currentProfile = profileSnap.exists() ? profileSnap.data() : null;
      
      const newNickname = tempNickname.trim();
      const isNicknameChanged = currentProfile?.nickname && currentProfile.nickname !== newNickname;
      
      // Part 2: 닉네임 변경 제한 로직 (최초 1회는 자유, 이후 한 달에 한 번)
      if (isNicknameChanged && currentProfile?.lastNicknameChangeDate) {
        const lastChangeDate = currentProfile.lastNicknameChangeDate?.toDate?.() 
          || (currentProfile.lastNicknameChangeDate?.seconds 
            ? new Date(currentProfile.lastNicknameChangeDate.seconds * 1000) 
            : null);
        
        if (lastChangeDate) {
          const now = new Date();
          const daysSinceLastChange = Math.floor((now - lastChangeDate) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastChange < 30) {
            const remainingDays = 30 - daysSinceLastChange;
            setError(`닉네임은 한 달에 한 번만 변경 가능합니다. (${remainingDays}일 후 변경 가능)`);
            return;
          }
        }
      }
      
      // 닉네임 유효성 검사 (한글/영어/공백 포함 최대 6글자)
      if (newNickname.length > 6) {
        setError('닉네임은 최대 6글자까지 입력 가능합니다.');
        return;
      }
      
      // 유효성 검사: 한글, 영어, 숫자, 공백만 허용
      const nicknamePattern = /^[가-힣a-zA-Z0-9\s]+$/;
      if (!nicknamePattern.test(newNickname)) {
        setError('닉네임은 한글, 영어, 숫자, 공백만 사용할 수 있습니다.');
        return;
      }
      
      // 수정 4: 프로필 저장 메시지 분기 처리 (3가지 케이스)
      // Case A: 최초 설정 (lastNicknameChangeDate가 없고, 기존 닉네임도 없음)
      const isFirstTimeUser = !currentProfile?.lastNicknameChangeDate && !currentProfile?.nickname;
      // Case B: 단순 저장 (닉네임 변경 없이 옵션만 변경)
      const isOnlySettingsChange = !isNicknameChanged && currentProfile?.nickname === newNickname;
      // Case C: 닉네임 변경 (기존 유저가 닉네임 변경)
      
      // 프로필 데이터 준비
      const updateData = {
        language: language,
        fontSize: fontSize,
        updatedAt: serverTimestamp()
      };
      
      // 닉네임이 변경된 경우에만 닉네임과 변경 날짜 업데이트
      if (!currentProfile?.nickname || isNicknameChanged) {
        updateData.nickname = newNickname;
        // 최초 가입자가 아닌 경우에만 lastNicknameChangeDate 업데이트
        if (isNicknameChanged && !isFirstTimeUser) {
          updateData.lastNicknameChangeDate = serverTimestamp();
        }
      }
      
      // Part 1: setDoc with merge 옵션 사용 (문서가 없으면 생성, 있으면 업데이트)
      await setDoc(profileRef, updateData, { merge: true });
      
      console.log('✅ 프로필 저장 완료:', { 
        ...updateData, 
        isFirstTimeUser, 
        isOnlySettingsChange, 
        isNicknameChanged 
      });
      
      // 로컬 상태 즉시 업데이트
      setUserProfile((prev) => ({ 
        ...prev, 
        ...updateData,
        nickname: newNickname
      }));
      
      // 프로필 설정 화면이면 홈으로 이동
      if (view === 'profile_setup') {
        setView('home');
      }
      
      // 수정 4: 프로필 저장 메시지 분기 처리 (3가지 케이스)
      if (isFirstTimeUser) {
        // Case A: 최초 설정 - 환영 모달 표시
        setShowSaveSuccessModal(true);
      } else if (isOnlySettingsChange) {
        // Case B: 단순 저장 (닉네임 변경 없이 옵션만 변경) - Toast 메시지
        alert('설정이 저장되었습니다.');
      } else if (isNicknameChanged) {
        // Case C: 닉네임 변경 - Toast 메시지
        alert(`닉네임이 "${newNickname}"으로 변경되었습니다.`);
      }
    } catch (e) {
      console.error("Save failed", e);
      setError("저장에 실패했습니다. 다시 시도해주세요.");
    }
  };
   
  // Google 로그인 핸들러 (긴급 버그 수정)
  const handleGoogleLogin = async (e) => {
    // 페이지 새로고침 방지 (form 태그 안에 있을 수 있으므로)
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      console.log('🔐 Google 로그인 시도...');
      setError(null); // 에러 메시지 초기화
      
      if (Capacitor.isNativePlatform()) {
        const nativeResult = await FirebaseAuthentication.signInWithGoogle();
        const idToken = nativeResult?.credential?.idToken;
        if (!idToken) {
          throw new Error('Google 로그인 토큰을 가져올 수 없습니다.');
        }
        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, credential);
        console.log('✅ Native Google 로그인 성공:', {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName
        });
        return;
      }

      // Web: Google 로그인 팝업 열기
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      console.log('✅ Google 로그인 성공:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName
      });
      
      // onAuthStateChanged가 자동으로 트리거되므로 여기서 별도 처리 불필요
      // 화면 전환은 프로필 useEffect에서 처리됨
      
    } catch (error) {
      console.error('❌ Google 로그인 실패:', error);
      
      // 사용자에게 알림 (alert)
      let errorMessage = "로그인에 실패했습니다.";
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "로그인 팝업이 닫혔습니다. 다시 시도해주세요.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "로그인이 취소되었습니다. 다시 시도해주세요.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // 상태 업데이트와 alert 동시에 표시
      setError(errorMessage);
      alert(`로그인 오류\n\n${errorMessage}\n\n에러 코드: ${error.code || 'unknown'}`);
    }
  };
  const handleLogout = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut();
      }
      await signOut(auth);
      setView('profile_setup');
    } catch (e) {}
  };

  const formatNoticeDate = (createdAt) => {
    const date = createdAt?.toDate?.()
      || (createdAt?.seconds ? new Date(createdAt.seconds * 1000) : null);
    return date ? format(date, 'yyyy.MM.dd') : '';
  };

  const openNoticeEditor = () => {
    setNoticeTitle('');
    setNoticeContent('');
    setIsNoticeEditorOpen(true);
  };

  const saveNotice = async () => {
    if (!isNoticeAdmin || !user) return;
    const title = noticeTitle.trim();
    const content = noticeContent.trim();
    if (!title || !content) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }
    setIsSavingNotice(true);
    try {
      await addDoc(collection(db, 'notices'), {
        title,
        content,
        author: user.email || 'admin',
        createdAt: serverTimestamp()
      });
      setIsNoticeEditorOpen(false);
      setNoticeTitle('');
      setNoticeContent('');
    } catch (err) {
      console.error('공지사항 저장 실패:', err);
      alert('공지사항 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSavingNotice(false);
    }
  };
  
  // 수정 2: 개발용 원클릭 리셋 함수 (유저 데이터 초기화)
  const handleDevReset = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 확인 메시지
    const confirmMessage = '⚠️ 개발용 리셋 기능입니다.\n\n다음 작업이 수행됩니다:\n1. 내가 작성한 모든 책 삭제\n2. 모든 책의 조회수/좋아요/즐겨찾기 수 0으로 초기화\n3. 모든 책 댓글/좋아요/즐겨찾기 기록 삭제\n4. 유저 정보 초기화 (닉네임, 잉크, 레벨, 경험치 등)\n5. 페이지 새로고침\n\n계속하시겠습니까?';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      console.log('🔄 개발용 리셋 시작...');
      
      // 1. 내가 작성한 모든 책 삭제
      const booksRef = collection(db, 'artifacts', appId, 'books');
      const booksQuery = query(booksRef, where('authorId', '==', user.uid));
      const booksSnapshot = await getDocs(booksQuery);
      
      const deletePromises = booksSnapshot.docs.map(bookDoc => deleteDoc(bookDoc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${booksSnapshot.docs.length}개의 책 삭제 완료`);
      
      // 2. 전체 책 통계 초기화 (조회수/좋아요/즐겨찾기)
      const allBooksSnapshot = await getDocs(collection(db, 'artifacts', appId, 'books'));
      const resetBookStatsPromises = allBooksSnapshot.docs.map((bookDoc) =>
        updateDoc(bookDoc.ref, { views: 0, likes: 0, favorites: 0 })
      );
      await Promise.all(resetBookStatsPromises);
      console.log(`✅ ${allBooksSnapshot.docs.length}개의 책 통계 초기화 완료`);

      // 3. 댓글/좋아요/즐겨찾기 기록 전체 삭제
      const commentsSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'book_comments'));
      const commentDeletePromises = commentsSnapshot.docs.map((c) => deleteDoc(c.ref));
      await Promise.all(commentDeletePromises);
      console.log(`✅ 댓글 ${commentsSnapshot.docs.length}개 삭제 완료`);

      const bookLikesSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'book_likes'));
      const bookLikeDeletePromises = bookLikesSnapshot.docs.map((l) => deleteDoc(l.ref));
      await Promise.all(bookLikeDeletePromises);
      console.log(`✅ 좋아요 기록 ${bookLikesSnapshot.docs.length}개 삭제 완료`);

      const bookFavSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'book_favorites'));
      const bookFavDeletePromises = bookFavSnapshot.docs.map((f) => deleteDoc(f.ref));
      await Promise.all(bookFavDeletePromises);
      console.log(`✅ 즐겨찾기 기록 ${bookFavSnapshot.docs.length}개 삭제 완료`);

      // 4. 유저 정보 초기화
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await updateDoc(profileRef, {
        nickname: null,  // 다시 설정하게
        lastNicknameChangeDate: null,
        ink: INITIAL_INK,
        level: 1,
        exp: 0,  // 수정 3: 초기 경험치는 0 (잉크 소비 시에만 획득)
        maxExp: 100,
        dailyWriteCount: 0,
        lastBookCreatedDate: null,  // 수정 1: 즉시 집필 가능하게 (날짜 문자열)
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ 유저 정보 초기화 완료');
      
      // 5. 페이지 새로고침
      alert('리셋이 완료되었습니다. 페이지를 새로고침합니다.');
      window.location.reload();
      
    } catch (error) {
      console.error('❌ 리셋 실패:', error);
      alert(`리셋에 실패했습니다: ${error.message}`);
    }
  };
  
  // Part 2: 계정 탈퇴 함수 (재확인 후 실행)
  const handleDeleteAccount = async () => {
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }
    
    try {
      // Firestore에서 유저 데이터 삭제
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      
      // 프로필 문서가 존재하는지 확인 후 삭제
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        await deleteDoc(profileRef);
        console.log('✅ 프로필 문서 삭제 완료');
      }
      
      // 관련 컬렉션들도 삭제 (unlocked_stories, read_history, daily_stats 등)
      // 주의: 모든 하위 컬렉션을 삭제하려면 Cloud Function이 필요할 수 있음
      // 여기서는 프로필만 삭제하고, 나머지는 수동 정리 또는 Cloud Function으로 처리
      
      // Firebase Auth에서 계정 삭제 (현재 로그인한 유저)
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === user.uid) {
        await deleteUser(currentUser);
        console.log('✅ Firebase Auth 계정 삭제 완료');
      }
      
      // 로그아웃 처리
      await signOut(auth);
      
      console.log('✅ 계정 탈퇴 완료');
      setView('login');
      setUser(null);
      setUserProfile(null);
      setError(null);
    } catch (err) {
      console.error('계정 탈퇴 오류:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('보안을 위해 다시 로그인한 후 탈퇴해주세요.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      } else {
        setError('계정 탈퇴에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };
  const earnPoints = async (amount) => { try { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { points: increment(amount) }); } catch (e) {} };
  const earnExp = async (amount) => { try { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { exp: increment(amount) }); } catch (e) {} };
  const updateDailyStats = async (minutes) => { const today = getTodayString(); await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'daily_stats', today), { date: today, minutes: increment(minutes) }, { merge: true }); };
  const handleStoryClick = async (story) => { if (story.authorId === user.uid || unlockedStories.includes(story.id)) { setCurrentStory(story); setView('reader'); } else { setUnlockTargetStory(story); setIsUnlockModalOpen(true); } };
  
  const processUnlock = async (method) => {
    if (!user || !unlockTargetStory) return;
    const todayStr = getTodayString();
    const isFreeUsed = (userProfile.lastReadDate === todayStr) && userProfile.dailyFreeReadUsed;
    try {
      if (method === 'free') {
        if (isFreeUsed) return setError("Free ticket used.");
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { lastReadDate: todayStr, dailyFreeReadUsed: true });
      } else {
        if ((userProfile.points || 0) < 2) return setError(t.unlock_fail_point);
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { points: increment(-2) });
      }
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'unlocked_stories', unlockTargetStory.id), { unlockedAt: serverTimestamp() });
      setIsUnlockModalOpen(false); setCurrentStory(unlockTargetStory); setView('reader');
    } catch (e) { setError("Unlock error"); }
  };

  const handleMoodRecommendation = (mood) => { 
      let g, s, r; 
      if(mood==='healing'){g='essay';s='empathy';r=t.rec_reason_healing;}
      else if(mood==='bored'){g='fiction';s='twist';r=t.rec_reason_bored;}
      else if(mood==='growth'){g='improvement';s='mindset';r=t.rec_reason_growth;}
      else {g='humanities';s='philosophy';r=t.rec_reason_thinking;}
      setRecommendedData({genreId:g, subGenreId:s, reason:r}); setRecommendStep('result');
  };
  const handleSeasonRecommendation = () => { setRecommendedData({genreId:'fiction', subGenreId:'daily', reason:t.rec_reason_season}); setRecommendStep('result'); };
  const applyRecommendation = () => { const g=genres.find(x=>x.id===recommendedData.genreId); setSelectedGenre(g); setSelectedSubGenre(g.subGenres.find(x=>x.id===recommendedData.subGenreId)); setView('list'); setIsRecommendModalOpen(false); setRecommendStep('main'); };
  
  const filteredStories = stories.filter(s => {
    if (s.genreId !== selectedGenre?.id) return false;
    if (selectedSubGenre && s.subGenre !== selectedSubGenre.id) return false;
    if (!selectedSubGenre && s.subGenre) return false; 
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));
  const hasTodayStory = filteredStories.some(s => s.date === getTodayString());
  const dailyCount = (userProfile?.lastGeneratedDate === getTodayString()) ? (userProfile?.dailyGenerationCount || 0) : 0;
  const isSeriesLimitReached = (userProfile?.lastSeriesGeneratedDate === getTodayString());
  const myFavoritesList = favorites.filter(f => f.userId === user?.uid).sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  const popularStories = stories.filter(s => { const d=new Date(); d.setDate(d.getDate()-7); return new Date(s.createdAt||new Date()) >= d; }).map(s=>({...s, favCount:favorites.filter(f=>f.storyId===s.id).length})).sort((a,b)=>b.favCount-a.favCount).slice(0,5);
  const topCreators = Object.values(stories.reduce((acc,s)=>{ const d=new Date(); d.setDate(d.getDate()-7); if(new Date(s.createdAt||new Date())>=d){ if(!acc[s.authorId])acc[s.authorId]={nickname:s.authorNickname, count:0, id:s.authorId}; acc[s.authorId].count+=1; } return acc; }, {})).sort((a,b)=>b.count-a.count).slice(0,10);

  const toggleFavorite = async (s) => { const fid=`${user.uid}_${s.id}`; if(favorites.find(f=>f.id===fid)) await deleteDoc(doc(db,'artifacts',appId,'public','data','favorites',fid)); else await setDoc(doc(db,'artifacts',appId,'public','data','favorites',fid),{userId:user.uid, storyId:s.id, storyTitle:s.title, storyDate:s.date, genreId:s.genreId, authorNickname:s.authorNickname, createdAt:serverTimestamp()}); };
  
  // ⭐️ 평점과 댓글 보상 체크 함수 (중복 방지 강화 + 실행 중 플래그 추가)
  const rewardCheckInProgress = new Set(); // 실행 중인 보상 체크 추적
  const checkAndGiveReward = async (storyId) => {
    // 이미 보상 체크가 진행 중이면 중단 (동시 실행 방지)
    if (rewardCheckInProgress.has(storyId)) {
      console.log("보상 체크가 이미 진행 중입니다:", storyId);
      return false;
    }
    
    rewardCheckInProgress.add(storyId);
    
    try {
      // 이미 포인트를 받았는지 확인 (먼저 체크)
      const rewardRef = doc(db, 'artifacts', appId, 'users', user.uid, 'story_rewards', storyId);
      const rewardSnap = await getDoc(rewardRef);
      
      // 이미 보상을 받았다면 중단 (중복 방지)
      if (rewardSnap.exists()) {
        console.log("이미 보상을 받은 소설입니다:", storyId);
        return false;
      }
      
      // Firestore에서 직접 평점 확인
      const ratingRef = doc(db, 'artifacts', appId, 'public', 'data', 'ratings', `${user.uid}_${storyId}`);
      const ratingSnap = await getDoc(ratingRef);
      const hasRating = ratingSnap.exists();
      
      if (!hasRating) {
        console.log("평점이 없어 보상을 지급할 수 없습니다:", storyId);
        return false;
      }
      
      // Firestore에서 직접 댓글(부모 댓글만) 확인 - 최신 상태로 확인
      const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'comments');
      const commentsQuery = query(
        commentsRef,
        where('storyId', '==', storyId),
        where('userId', '==', user.uid)
      );
      const commentsSnap = await getDocs(commentsQuery);
      
      console.log("댓글 검색 결과:", commentsSnap.docs.length, "개");
      
      const hasComment = commentsSnap.docs.some(doc => {
        const data = doc.data();
        const isParent = !data.parentId;
        console.log("댓글 체크:", doc.id, "parentId:", data.parentId, "isParent:", isParent);
        return isParent; // 부모 댓글만 (대댓글 제외)
      });
      
      if (!hasComment) {
        console.log("부모 댓글이 없어 보상을 지급할 수 없습니다:", storyId);
        return false;
      }
      
      // 보상 기록을 먼저 저장하여 중복 방지 (트랜잭션처럼 동작)
      // 이미 저장 여부를 다시 확인 (동시 실행 시 race condition 방지)
      const rewardSnap2 = await getDoc(rewardRef);
      if (rewardSnap2.exists()) {
        console.log("보상이 이미 지급되었습니다 (중복 체크):", storyId);
        return false;
      }
      
      // 보상 기록 저장
      await setDoc(rewardRef, {
        storyId: storyId,
        rewardedAt: serverTimestamp()
      });
      
      // 포인트 지급
      await earnPoints(1);
      console.log("✅ 포인트 지급 완료: 평점 + 댓글 보상 -", storyId);
      return true;
      
    } catch (err) {
      console.error("❌ Reward check error:", err);
      return false;
    } finally {
      // 실행 완료 후 플래그 제거
      rewardCheckInProgress.delete(storyId);
    }
  };
  
  const submitRating = async (stars) => { 
    try {
      await setDoc(doc(db,'artifacts',appId,'public','data','ratings',`${user.uid}_${currentStory.id}`),{
        storyId:currentStory.id, 
        userId:user.uid, 
        stars, 
        updatedAt:serverTimestamp()
      });
      
      console.log("평점 저장 성공:", stars);
      
      // 평점 등록 후, 댓글이 이미 있으면 보상 체크
      // 약간의 지연을 주어 상태가 업데이트될 시간을 확보
      setTimeout(async () => {
        try {
          await checkAndGiveReward(currentStory.id);
        } catch (rewardErr) {
          console.error("평점 저장 후 보상 체크 오류:", rewardErr);
        }
      }, 500);
    } catch (err) {
      console.error("평점 저장 오류:", err);
      setError("평점 등록에 실패했습니다.");
    }
  };
  
  // ⭐️ [중요] 수정된 댓글 로직 (튕김 방지 + 포인트 지급 + 수정 기능 복구)
  const submitComment = async (e) => { 
    // ⭐️ 이벤트 기본 동작 방지 (페이지 새로고침 차단)
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // 중복 제출 방지
    if (isSubmittingComment) {
      console.log("이미 댓글 제출 중입니다.");
      return;
    }
    
    if(!commentInput.trim()) {
      setError("댓글을 입력해주세요.");
      return;
    }
    
    // 평점 확인 (생성된 소설도 평가 가능하도록)
    const userRating = ratings.find(r=>r.userId===user.uid&&r.storyId===currentStory.id);
    if(!userRating) {
      setError(t.rating_required || "별점을 먼저 평가해주세요.");
      return;
    }

    setIsSubmittingComment(true);
    setError(null); // 에러 메시지 초기화

    try {
        if(editingCommentId) {
            // 수정 기능
            await updateDoc(doc(db,'artifacts',appId,'public','data','comments',editingCommentId),{
              text:commentInput.trim(), 
              updatedAt:serverTimestamp()
            }); 
            setEditingCommentId(null);
            setCommentInput(""); 
            setReplyTo(null);
        } else {
            // 댓글 텍스트 저장
            const commentText = commentInput.trim();
            
            // 대댓글(parentId가 있는 경우)은 포인트 지급 안 함
            const isParentComment = !replyTo?.id;
            
            // 1. 댓글 저장 시도
            console.log("댓글 저장 시작:", { storyId: currentStory.id, userId: user.uid, text: commentText.substring(0, 20) + "..." });
            
            let commentRef;
            let commentSaved = false;
            
            try {
              commentRef = await addDoc(collection(db,'artifacts',appId,'public','data','comments'), {
                  storyId: currentStory.id, 
                  userId: user.uid, 
                  nickname: userProfile?.nickname || "익명", 
                  text: commentText, 
                  parentId: replyTo?.id || null, 
                  createdAt: serverTimestamp()
              });

              // 댓글 저장 성공 확인
              if (!commentRef || !commentRef.id) {
                throw new Error("댓글 저장 실패: ID 없음");
              }

              console.log("댓글 ID 생성됨:", commentRef.id);

              // 댓글이 실제로 저장되었는지 확인 (필수 체크) - 최대 3번 시도
              let saved = false;
              for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, 200 * (i + 1))); // 점진적 대기
                
                const savedCommentRef = doc(db, 'artifacts', appId, 'public', 'data', 'comments', commentRef.id);
                const savedCommentSnap = await getDoc(savedCommentRef);
                
                if (savedCommentSnap.exists()) {
                  saved = true;
                  commentSaved = true;
                  console.log("✅ 댓글 저장 확인 완료:", commentRef.id);
                  break;
                }
              }
              
              if (!saved) {
                throw new Error("댓글 저장 실패: DB에 저장되지 않음 (확인 실패)");
              }

              // 3. 입력창 초기화 (댓글 저장이 확실히 확인된 후)
              setCommentInput(""); 
              setReplyTo(null);
              
              // 2. 부모 댓글을 작성했고, 평점도 있으면 보상 체크
              // 댓글 저장이 완전히 완료된 후에만 보상 체크
              if (isParentComment && commentSaved) {
                  console.log("보상 체크 시작 (부모 댓글)");
                  // 약간의 지연을 두고 보상 체크 (댓글이 완전히 저장된 후)
                  setTimeout(async () => {
                      try {
                          const rewardResult = await checkAndGiveReward(currentStory.id);
                          if (rewardResult) {
                            console.log("✅ 보상 지급 성공");
                          } else {
                            console.log("보상 지급 조건 미충족 또는 이미 지급됨");
                          }
                      } catch (rewardErr) {
                          console.error("❌ 보상 지급 오류:", rewardErr);
                          // 보상 오류는 댓글 저장에는 영향을 주지 않음
                      }
                  }, 800);
              } else {
                console.log("보상 체크 스킵:", { isParentComment, commentSaved });
              }
              
            } catch (saveErr) {
              console.error("❌ 댓글 저장 실패:", saveErr);
              commentSaved = false;
              throw saveErr; // 에러를 다시 throw하여 catch 블록에서 처리
            }
        }
    } catch(err) {
        console.error("Comment Error:", err);
        setError("댓글 등록에 실패했습니다. 다시 시도해주세요.");
        // 에러 발생 시에도 제출 상태 해제
    } finally {
        setIsSubmittingComment(false);
    }
  };

  // ⭐️ [복구] 수정 버튼 누르면 입력창에 글 채워넣기
  const startEditComment = (c) => { 
      setEditingCommentId(c.id); 
      setCommentInput(c.text); // <-- 이 부분이 핵심 (입력창 채우기)
      setReplyTo(null); 
  };

  const handleShare = async () => { const d={title:currentStory.title, text:currentStory.title, url:`https://odok.app/story/${currentStory.id}`}; if(navigator.share) await navigator.share(d); else alert("Link copied"); };
  const handleReportSubmit = async () => { if(!reportText.trim())return; setReportStatus('loading'); try{const res=await httpsCallable(functions,'analyzeReportAI')({title:currentStory.title, body:currentStory.body, reportText}); if(res.data.status==='accepted'){await updateDoc(doc(db,'artifacts',appId,'public','data','stories',currentStory.id),{body:res.data.fixedBody}); await earnPoints(2);} await setDoc(doc(db,'artifacts',appId,'public','data','reports',`${user.uid}_${currentStory.id}`),{userId:user.uid, storyId:currentStory.id, text:reportText, status:res.data.status, createdAt:serverTimestamp()}); setReportStatus(res.data.status);}catch(e){setReportStatus('error');} };
  const translateStory = async (targetLang) => { if(targetLang==='ko'){setReaderLang('ko');return;} if(translatedContent[targetLang]){setReaderLang(targetLang);return;} setIsTranslating(true); try{const res=await httpsCallable(functions,'translateStoryAI')({title:currentStory.title, body:currentStory.body, targetLang}); setTranslatedContent(p=>({...p,[targetLang]:res.data})); setReaderLang(targetLang);}catch(e){setError(t.translate_error);}finally{setIsTranslating(false);} };
  const submitSeriesVote = async (voteType) => { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'series_votes', `${user.uid}_${currentStory.id}`), { storyId: currentStory.id, userId: user.uid, vote: voteType, createdAt: serverTimestamp() }); };
  // 수정 3: finishReading 함수 - 경험치는 잉크 소비 시에만 획득하므로 제거
  const finishReading = async () => { 
    if (!canFinishRead) return alert(t.read_more_time); 
    const historyRef = doc(db, 'artifacts', appId, 'users', user.uid, 'read_history', currentStory.id); 
    if ((await getDoc(historyRef)).exists()) return alert(t.read_already); 
    await setDoc(historyRef, { 
      storyId: currentStory.id, 
      storyTitle: currentStory.title, 
      genreId: currentStory.genreId, 
      authorNickname: currentStory.authorNickname, 
      storyDate: currentStory.date, 
      readAt: new Date().toISOString() 
    }); 
    // 수정 3: 경험치는 잉크 소비 시에만 획득하므로 여기서는 경험치 지급 안 함
    alert(t.finish_reading_desc); 
  };
  
  const generateTodayStory = async () => {
    if (!user || !userProfile?.nickname) return;
    const todayStr = getTodayString();
    if (selectedSubGenre?.id === 'series' && userProfile.lastSeriesGeneratedDate === todayStr) return setError(t.series_limit_reached);
    const lastGen = userProfile.lastGeneratedDate || "";
    let cnt = (lastGen === todayStr) ? (userProfile.dailyGenerationCount || 0) : 0;
    if (cnt >= 2) return setError(t.daily_limit_reached);
    if (cnt > 0 && (userProfile.points || 0) < 2) return setError(t.need_points);

    setIsGenerating(true); setError(null);
    let prevCtx = "", ep = 1, sTitle = "", isFinal = false;
    
    // 시리즈 소설인 경우
    if (selectedGenre.id === 'fiction' && selectedSubGenre?.id === 'series') {
        const sList = stories.filter(s => s.genreId === 'fiction' && s.subGenre === 'series').sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        if (sList[0] && !sList[0].isFinal) {
            ep = (sList[0].episode || 1) + 1; sTitle = sList[0].seriesTitle || sList[0].title;
            const vs = seriesVotes.filter(v => v.storyId === sList[0].id);
            if (vs.filter(v => v.vote === 'end').length > vs.filter(v => v.vote === 'continue').length) isFinal = true;
            prevCtx = `이전 요약: ${sList[0].body.substring(0,200)}... 제목:${sTitle} ${ep}화. ${isFinal?"완결내세요":""}`;
        }
    } else {
        // 일반 소설은 생성 시 완성된 것으로 처리 (서재에 바로 표시되도록)
        isFinal = true;
    }
    
    const subName = selectedSubGenre ? selectedSubGenre.name : selectedGenre.nameKey;
    const systemPrompt = `당신은 작가입니다. 제목 10자 이내. ${selectedGenre.nameKey} - ${subName}. ${selectedSubGenre?.prompt}. ${prevCtx}. 형식 JSON { "title": "${ep>1?sTitle:'제목'}", "body": "내용" }`;
    
    try {
        const res = await httpsCallable(functions, 'generateStoryAI')({ systemPrompt, userPrompt: "써줘" });
        const newRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'stories'), {
            genreId: selectedGenre.id, subGenre: selectedSubGenre?.id, subGenreName: subName, date: todayStr, title: res.data.title, seriesTitle: ep>1?sTitle:res.data.title, body: res.data.body, authorNickname: userProfile.nickname, authorId: user.uid, language: 'ko', episode: ep, isFinal, createdAt: new Date().toISOString()
        });
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'unlocked_stories', newRef.id), { unlockedAt: new Date().toISOString() });
        // 수정 3: 경험치는 잉크 소비 시에만 획득하므로, 집필 시 경험치 지급 제거
        const upData = { points: increment(cnt===0?1:-2), lastGeneratedDate: todayStr, dailyGenerationCount: cnt+1 };
        if(selectedSubGenre?.id === 'series') upData.lastSeriesGeneratedDate = todayStr;
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), upData);
        setIsGenerating(false);
    } catch(e) { setError(t.gen_fail); setIsGenerating(false); }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex justify-center items-center">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Jua&display=swap'); .font-jua { font-family: 'Jua', sans-serif; } .scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      <div className="w-full max-w-md bg-slate-50 h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden text-slate-900 font-sans selection:bg-orange-200">
        
        {/* 인앱 브라우저 경고 오버레이 (최상위 z-index) */}
        {showInAppBrowserWarning && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
              {/* 아이콘 */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
                  <Globe className="w-10 h-10 text-orange-500" />
                </div>
              </div>
              
              {/* 제목 */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-slate-800">
                  외부 브라우저가 필요합니다
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  구글 로그인을 위해<br/>
                  <span className="font-bold text-orange-600">{detectedInAppBrowser}</span>에서 나와
                  <br/>외부 브라우저로 접속해주세요.
                </p>
              </div>
              
              {/* 가이드 */}
              <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                {detectedDevice === 'android' ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">
                          1
                        </div>
                        <p className="text-sm font-bold text-slate-800">우측 상단 메뉴(<span className="text-orange-500">⋮</span>) 클릭</p>
                      </div>
                      <div className="flex items-center gap-2 pl-8">
                        <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <p className="text-xs text-slate-600">'다른 브라우저로 열기' 선택</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <p className="text-sm font-bold text-slate-800">크롬 또는 삼성 인터넷으로 열기</p>
                    </div>
                  </>
                ) : detectedDevice === 'ios' ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">
                          1
                        </div>
                        <p className="text-sm font-bold text-slate-800">우측 하단 메뉴(<span className="text-orange-500">Safari 아이콘</span>) 클릭</p>
                      </div>
                      <div className="flex items-center gap-2 pl-8">
                        <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <p className="text-xs text-slate-600">'Safari로 열기' 선택</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <p className="text-sm font-bold text-slate-800">Safari에서 다시 접속</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold text-slate-800">
                      브라우저의 메뉴에서
                    </p>
                    <p className="text-xs text-slate-600">
                      '외부 브라우저로 열기' 또는<br/>
                      'Safari로 열기' 옵션을 선택해주세요.
                    </p>
                  </div>
                )}
              </div>
              
              {/* 안내 문구 */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-700 text-center leading-relaxed">
                  💡 <span className="font-bold">왜 외부 브라우저가 필요할까요?</span><br/>
                  인앱 브라우저는 구글 보안 정책상<br/>
                  로그인을 차단합니다.
                </p>
              </div>
              
              {/* 안내: 오버레이는 외부 브라우저로 이동할 때까지 표시됨 */}
              <div className="text-center">
                <p className="text-xs text-slate-400">
                  외부 브라우저로 이동하면 자동으로 사라집니다
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* 상단바 */}
        <header className="flex-none bg-white/90 backdrop-blur-md border-b border-slate-100 z-40 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 뒤로가기 버튼: 홈, 서재, 집필, 보관함, 프로필 탭에서는 숨김 (하단 탭 사용) */}
            {(view === 'write' || view === 'library' || view === 'archive' || view === 'profile' || view === 'book_detail' || (view === 'reader' && currentBook)) ? (
              <button onClick={() => {
                if (view === 'reader' && currentBook) {
                  setCurrentBook(null);
                  setView('library');
                } else if (view === 'book_detail') {
                  const isMyBook = selectedBook?.authorId === user?.uid;
                  setSelectedBook(null);
                  setView(isMyBook ? 'archive' : 'library');
                } else if (view === 'write' || view === 'library' || view === 'archive' || view === 'profile') {
                  setView('home');
                } else {
                  setView('home');
                }
              }} className="p-2 -ml-2 rounded-full hover:bg-slate-50"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
            ) : view !== 'home' && view !== 'profile_setup' ? (
              <button onClick={() => {
                if (view === 'reader') setView('list');
                else if (view === 'list') { if(selectedGenre?.hasSubGenre) setView('genre_select'); else setView('library_main'); }
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
                  <span className="text-xs font-bold">{userProfile.ink || INITIAL_INK}</span>
                </div>
                <button onClick={() => setIsHelpModalOpen(true)} className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200"><HelpCircle className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </header>

        {/* 메인 컨텐츠 */}
        <main id="main-content" className="flex-1 overflow-y-auto scrollbar-hide pb-20 relative">
          
          {/* 각종 모달들 */}
          {isHelpModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-black text-slate-800">사용 설명서</div>
                  <button
                    onClick={() => setIsHelpModalOpen(false)}
                    className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 text-sm text-slate-600 leading-relaxed overflow-y-auto pr-1 max-h-[60vh]">
                  <div className="font-bold text-slate-800">기본 사용법</div>
                  <div>1. 홈/서재에서 원하는 책을 선택하거나, 집필 탭에서 새 책을 생성합니다.</div>
                  <div>2. 집필은 하루 2회까지 가능합니다. 1회는 무료, 2회째부터는 잉크가 소모됩니다.</div>
                  <div className="pt-2 font-bold text-slate-800">잉크 시스템</div>
                  <div>- 책 집필 완료 시 +25 잉크가 지급됩니다.</div>
                  <div>- 프로필 탭에서 “광고 보고 잉크 얻기”로 +10 잉크를 받을 수 있습니다.</div>
                  <div>- 다른 유저가 잉크쏘기를 보내면 1~10 잉크를 받을 수 있습니다.</div>
                  <div>- 다른 사람의 책을 읽을 때 -1 잉크가 소모됩니다.</div>
                  <div>- 2회째 집필부터는 -5 잉크가 소모됩니다.</div>
                  <div>- 비소설 키워드 새로고침 시 -1 잉크가 소모됩니다.</div>
                  <div>- 잉크쏘기 보내기 시 입력한 만큼(1~10) 잉크가 소모됩니다.</div>
                  <div>- 잉크 최대치는 999입니다.</div>
                  <div className="pt-2 font-bold text-slate-800">레벨 시스템</div>
                  <div>- 잉크를 사용할 때마다 사용한 만큼 경험치를 얻습니다.</div>
                  <div>- 기본 필요 경험치는 100이며, 레벨업 시 1.2배씩 증가합니다.</div>
                  <div>- 경험치가 최대치에 도달하면 레벨이 올라갑니다.</div>
                  <div>- 최고 레벨은 99입니다.</div>
                  <div className="pt-2 font-bold text-slate-800">랭킹 기준</div>
                  <div>- 주간 베스트셀러: 월~일 생성된 책의 조회+좋아요+즐겨찾기+완독 합산 TOP 3</div>
                  <div>- 금주의 집필왕: 월~일 집필 권수 TOP 3</div>
                  <div className="pt-2 font-bold text-slate-800">집필/읽기 팁</div>
                  <div>- 소설은 장르/분위기/결말 스타일을 선택해 더 정교하게 작성할 수 있습니다.</div>
                  <div>- 비소설은 키워드/제목/스타일을 선택해 원하는 톤으로 작성됩니다.</div>
                  <div>- 완독 버튼은 책을 일정 시간(3분) 이상 읽으면 활성화됩니다.</div>
                </div>
                <button
                  onClick={() => setIsHelpModalOpen(false)}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-black"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
          {isUnlockModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><div className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold mb-3">{t.unlock_title}</h3><div className="space-y-2"><button onClick={()=>processUnlock('free')} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold">{t.unlock_btn_free}</button><button onClick={()=>processUnlock('point')} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">{t.unlock_btn_paid}</button><button onClick={()=>setIsUnlockModalOpen(false)} className="w-full bg-slate-100 py-3 rounded-xl font-bold">{t.cancel}</button></div></div></div>}
          {showAttendanceModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><div className="bg-white p-8 rounded-2xl text-center"><h3 className="text-xl font-black mb-1">{t.attendance_check}</h3><p className="text-slate-500 font-bold mb-4">{t.attendance_reward}</p><button onClick={()=>setShowAttendanceModal(false)} className="bg-slate-900 text-white px-8 py-2 rounded-xl font-bold">OK</button></div></div>}
          {selectedNotice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-black text-slate-800">공지사항</div>
                  <button
                    onClick={() => setSelectedNotice(null)}
                    className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">
                    {formatNoticeDate(selectedNotice.createdAt)} · {selectedNotice.author || '관리자'}
                  </div>
                  <div className="text-lg font-black text-slate-800">{selectedNotice.title}</div>
                  <div className="text-sm text-slate-600 whitespace-pre-line">
                    {selectedNotice.content}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-black"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
          {isNoticeEditorOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-black text-slate-800">공지사항 작성</div>
                  <button
                    onClick={() => setIsNoticeEditorOpen(false)}
                    className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    placeholder="제목을 입력하세요"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <textarea
                    value={noticeContent}
                    onChange={(e) => setNoticeContent(e.target.value)}
                    placeholder="내용을 입력하세요"
                    rows={6}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsNoticeEditorOpen(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveNotice}
                    disabled={isSavingNotice}
                    className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-black hover:bg-orange-600 transition-colors disabled:bg-orange-200"
                  >
                    {isSavingNotice ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {showExitConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-black text-slate-800">오독오독을 나가실까요?</h3>
                  <p className="text-sm text-slate-600">
                    종료하려면 나가기를 선택해주세요.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => {
                      setShowExitConfirm(false);
                      allowExitRef.current = true;
                      window.history.back();
                    }}
                    className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-black"
                  >
                    나가기
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 수정 1: 책 읽기용 잉크 확인 모달 */}
          {showInkConfirmModal && pendingBook && !pendingBookData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <Droplets className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">잉크를 사용하시겠습니까?</h3>
                  <p className="text-sm text-slate-600">
                    💧 잉크 <span className="font-black text-blue-600">{READ_INK_COST}방울</span>을 사용하여
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    "{pendingBook.title}"을 읽으시겠습니까?
                  </p>
                  <div className="pt-2">
                    <p className="text-xs text-slate-400">
                      현재 보유: <span className="font-bold text-slate-600">{userProfile?.ink || 0}방울</span>
                    </p>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <button
                    onClick={confirmOpenBook}
                    disabled={(userProfile?.ink || 0) < READ_INK_COST}
                    className="w-full bg-blue-500 text-white py-3 rounded-xl font-black hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <Droplets className="w-4 h-4" />
                    읽기
                  </button>
                  <button
                    onClick={() => {
                      setShowInkConfirmModal(false);
                      setPendingBook(null);
                    }}
                    className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 수정 1: 추가 집필 확인 모달 */}
          {showInkConfirmModal && pendingBookData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="text-center space-y-2">
                  <Droplets className="w-12 h-12 text-orange-500 mx-auto" />
                  <h3 className="text-xl font-black text-slate-800">
                    추가 집필
                  </h3>
                  <p className="text-sm text-slate-600">
                    오늘 무료 집필 1회를 사용했습니다.
                  </p>
                  <p className="text-sm text-slate-600 font-bold">
                    <span className="text-orange-500">{EXTRA_WRITE_INK_COST} 잉크</span>를 사용하여 추가로 집필하시겠습니까?
                  </p>
                  <div className="pt-2">
                    <p className="text-xs text-slate-400">
                      현재 보유: <span className="font-bold text-slate-600">{userProfile?.ink || 0} 잉크</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowInkConfirmModal(false);
                      setPendingBookData(null);
                    }}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={async () => {
                      setShowInkConfirmModal(false);
                      const bookData = pendingBookData;
                      setPendingBookData(null);
                      await handleBookGenerated(bookData, true); // useInk = true로 호출
                    }}
                    className="w-full bg-orange-500 text-white py-3 rounded-xl font-black hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Droplets className="w-4 h-4" />
                    잉크 {EXTRA_WRITE_INK_COST} 사용하고 집필
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 레벨업 모달 */}
          {showLevelUpModal && newLevel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl p-8 w-full max-w-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300 text-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Trophy className="w-12 h-12 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2">
                    <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-slate-800">
                    축하합니다! 🎉
                  </h2>
                  <p className="text-xl font-black text-orange-600">
                    레벨 {newLevel}이 되었습니다!
                  </p>
                  <p className="text-sm text-slate-600 pt-2">
                    새로운 주제가 해금되었어요!
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowLevelUpModal(false);
                    setNewLevel(null);
                  }}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-black hover:bg-slate-800 transition-colors mt-4"
                >
                  확인
                </button>
              </div>
            </div>
          )}
          
          {/* 👇 저장 성공 모달 */}
          {showSaveSuccessModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                  <div className="bg-white rounded-2xl p-8 w-full max-w-xs shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2"><CheckCircle className="w-8 h-8" /></div>
                      <h3 className="text-xl font-black text-slate-800">환영합니다!</h3>
                      <p className="text-slate-500 font-bold whitespace-pre-line">{tempNickname}님,{'\n'}이제 오독오독을 시작해보세요.</p>
                      <button onClick={() => { setShowSaveSuccessModal(false); setView('home'); }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold mt-2 w-full">시작하기</button>
                  </div>
              </div>
          )}

          {/* 화면 라우팅 */}
          <div className="px-5 py-6">
            {/* Step 1: 로그인 페이지 (로그인 X) */}
            {!user && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Book className="w-12 h-12 text-white" />
                  </div>
                  <h1 className="text-3xl font-black text-slate-800 mb-2">오독오독</h1>
                  <p className="text-slate-600 font-bold">
                    나만의 책을 만들고 읽는 공간
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-4">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-black hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 shadow-sm active:scale-95"
                  >
                    <Globe className="w-6 h-6 text-slate-400" />
                    Google로 시작하기
                  </button>
                  <p className="text-xs text-slate-400 text-center">
                    로그인하여 모든 기능을 이용하세요
                  </p>
                  {/* 에러 메시지 표시 */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                      <p className="text-red-600 text-xs font-bold">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Step 2: 프로필 설정 페이지 (로그인 O but 닉네임 X) */}
            {user && (!userProfile || !userProfile.nickname) && (
              <ProfileView 
                user={user} 
                userProfile={userProfile} 
                t={t} 
                levelInfo={levelInfo} 
                tempNickname={tempNickname} 
                setTempNickname={setTempNickname} 
                language={language} 
                setLanguage={setLanguage} 
                fontSize={fontSize} 
                setFontSize={setFontSize} 
                handleGoogleLogin={handleGoogleLogin} 
                saveProfile={saveProfile} 
                handleLogout={handleLogout}
                addInk={addInk}
                handleDeleteAccount={handleDeleteAccount}
                error={error}
                setError={setError}
                appId={appId}
              />
            )}
            
            {/* Step 3: 메인 레이아웃 (로그인 O and 닉네임 O) */}
            {user && userProfile && userProfile.nickname && (
              <>
            {view === 'home' && (
              <HomeView 
                userProfile={userProfile} 
                t={t} 
                levelInfo={levelInfo} 
                notices={notices} 
                setView={setView} 
                todayBooks={todayBooks}
                weeklyBestBooks={weeklyBestBooks}
                topWriters={topWriters}
                isLoadingHomeData={isLoadingHomeData}
                handleBookClick={handleBookClick}
              />
            )}
            {view === 'notice_list' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-800">공지사항</h2>
                  <span className="text-xs text-slate-400">{notices.length}건</span>
                </div>
                {notices.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-slate-100 text-center text-sm text-slate-500">
                    아직 등록된 공지사항이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notices.map((notice) => (
                      <button
                        key={notice.id}
                        onClick={() => setSelectedNotice(notice)}
                        className="w-full text-left p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 hover:bg-orange-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-bold text-slate-800 line-clamp-1">{notice.title}</div>
                          <div className="text-[10px] text-slate-400">
                            {formatNoticeDate(notice.createdAt)}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {notice.content}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {user && (
                  <div className="pt-2">
                    <button
                      onClick={handleDevReset}
                      className="w-full px-3 py-2 bg-red-500 text-white text-xs font-black rounded-lg hover:bg-red-600 transition-colors"
                      title="개발용: 유저 데이터 초기화"
                    >
                      DEV RESET
                    </button>
                  </div>
                )}
                {isNoticeAdmin && (
                  <button
                    onClick={openNoticeEditor}
                    className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center font-black hover:bg-orange-600 active:scale-95"
                    aria-label="공지사항 작성"
                  >
                    글쓰기
                  </button>
                )}
              </div>
            )}
            {view === 'library_main' && <LibraryMainView t={t} setIsRecommendModalOpen={setIsRecommendModalOpen} genres={genres} handleGenreClick={handleGenreClick} />}
            {view === 'genre_select' && selectedGenre && <GenreSelectView t={t} selectedGenre={selectedGenre} handleSubGenreClick={handleSubGenreClick} stories={stories} />}
            {view === 'list' && <StoryListView t={t} user={user} selectedGenre={selectedGenre} selectedSubGenre={selectedSubGenre} filteredStories={filteredStories} hasTodayStory={hasTodayStory} dailyCount={dailyCount} isSeriesLimitReached={isSeriesLimitReached} generateTodayStory={generateTodayStory} isGenerating={isGenerating} error={error} handleStoryClick={handleStoryClick} unlockedStories={unlockedStories} getStoryStats={getStoryStats} getFavoriteCount={getFavoriteCount} />}
            {/* Step 1: 새로 생성한 책 읽기 (간단 버전) */}
            {view === 'reader' && currentBook && !currentStory && (
              <ReaderView 
                book={currentBook}
                onBack={() => {
                  setCurrentBook(null);
                  setView('library');
                }}
                fontSize={fontSize}
              />
            )}
            {/* 기존 책 읽기 (기존 ReaderView) */}
            {view === 'reader' && currentStory && !currentBook && <ReaderView t={t} user={user} currentStory={currentStory} readerLang={readerLang} isTranslating={isTranslating} displayTitle={displayTitle} displayBody={displayBody} fontSize={fontSize} translateStory={translateStory} toggleFavorite={toggleFavorite} isFavorited={isFavorited} handleShare={handleShare} setIsReportModalOpen={setIsReportModalOpen} currentStoryStats={currentStoryStats} getFavoriteCount={getFavoriteCount} canFinishRead={canFinishRead} finishReading={finishReading} submitSeriesVote={submitSeriesVote} myVote={myVote} voteCounts={voteCounts} getTodayString={getTodayString} ratings={ratings} submitRating={submitRating} comments={comments} commentInput={commentInput} setCommentInput={setCommentInput} editingCommentId={editingCommentId} replyTo={replyTo} setReplyTo={setReplyTo} setEditingCommentId={setEditingCommentId} submitComment={submitComment} startEditComment={startEditComment} error={error} isSubmittingComment={isSubmittingComment} />}
            {/* Step 1: 집필 화면 */}
            {view === 'write' && (
              <WriteView 
                user={user}
                userProfile={userProfile}
                onBookGenerated={handleBookGenerated}
                slotStatus={slotStatus}
                setView={setView}
                setSelectedBook={setSelectedBook}
                error={error}
                setError={setError}
                deductInk={deductInk}
              />
            )}
            {/* Step 1: 서재 화면 */}
            {view === 'library' && (
              <LibraryView 
                books={books}
                onBookClick={handleBookClick}
                filter={libraryFilter}
                onFilterChange={setLibraryFilter}
              />
            )}
            {/* 보관함 화면 */}
            {view === 'archive' && (
              <ArchiveView 
                books={books}
                user={user}
                favoriteBookIds={bookFavorites.map(f => f.bookId)}
                onBookClick={handleBookClick}
              />
            )}
            {/* 책 상세 화면 */}
            {view === 'book_detail' && selectedBook && (
              <BookDetail 
                book={selectedBook}
                user={user}
                userProfile={userProfile}
                appId={appId}
                fontSize={fontSize}  // 수정 5: 폰트 크기 연동 버그 픽스
                onClose={() => {
                  // 이전 화면으로 돌아가기 (서재 또는 보관함)
                  const isMyBook = selectedBook.authorId === user?.uid;
                  setSelectedBook(null);
                  setView(isMyBook ? 'archive' : 'library');
                }}
              />
            )}
            {/* 프로필 화면 (설정 완료 후) */}
            {view === 'profile' && (
              <ProfileView 
                user={user} 
                userProfile={userProfile} 
                t={t} 
                levelInfo={levelInfo} 
                tempNickname={tempNickname} 
                setTempNickname={setTempNickname} 
                language={language} 
                setLanguage={setLanguage} 
                fontSize={fontSize} 
                setFontSize={setFontSize} 
                handleGoogleLogin={handleGoogleLogin} 
                saveProfile={saveProfile} 
                handleLogout={handleLogout}
                addInk={addInk}
                handleDeleteAccount={handleDeleteAccount}
                error={error}
                setError={setError}
                appId={appId}
              />
            )}
              </>
            )}
          </div>
        </main>

        {/* 하단 탭 네비게이션 바 - 5개 탭 (로그인 O and 닉네임 O일 때만 표시) */}
        {user && userProfile && userProfile.nickname && view !== 'reader' && view !== 'book_detail' && (
          <nav className="flex-none h-16 bg-white border-t border-slate-100 flex items-center px-1 pb-2 pt-1 z-40">
            {/* 홈 */}
            <button 
              onClick={() => {
                setSelectedGenre(null);
                setSelectedSubGenre(null);
                setView('home');
              }} 
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'home' ? 'text-orange-600' : 'text-slate-400 hover:text-orange-600'}`}
            >
              <Home className={`w-6 h-6 ${view === 'home' ? 'fill-orange-100' : ''}`} />
              <span className="text-[10px] font-bold">홈</span>
            </button>

            {/* 서재 */}
            <button 
              onClick={() => {
                setSelectedGenre(null);
                setSelectedSubGenre(null);
                setView('library');
              }} 
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'library' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Library className={`w-6 h-6 ${view === 'library' ? 'fill-orange-100' : ''}`} />
              <span className="text-[10px] font-bold">서재</span>
            </button>

            {/* 집필 (중앙 강조) */}
            <button 
              onClick={() => {
                setSelectedGenre(null);
                setSelectedSubGenre(null);
                setView('write');
              }} 
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors relative ${view === 'write' ? 'text-orange-600' : 'text-slate-400 hover:text-orange-600'}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${view === 'write' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-400'}`}>
                <PenTool className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold mt-0.5">집필</span>
            </button>

            {/* 보관함 */}
            <button 
              onClick={() => {
                setSelectedGenre(null);
                setSelectedSubGenre(null);
                setView('archive');
              }} 
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'archive' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Bookmark className={`w-6 h-6 ${view === 'archive' ? 'fill-orange-100' : ''}`} />
              <span className="text-[10px] font-bold">보관함</span>
            </button>

            {/* 프로필 */}
            <button 
              onClick={() => {
                setSelectedGenre(null);
                setSelectedSubGenre(null);
                setView('profile');
              }} 
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-0.5 transition-colors ${view === 'profile' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <User className={`w-6 h-6 ${view === 'profile' ? 'fill-orange-100' : ''}`} />
              <span className="text-[10px] font-bold">프로필</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default App;