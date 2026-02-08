import { useState, useEffect, useRef } from 'react';
import {
    collection, onSnapshot, query, where, doc, setDoc, getDoc, updateDoc, serverTimestamp, increment, deleteDoc, addDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { T, genres } from '../data';
import { getTodayDateKey } from '../utils/dateUtils';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const useStoryReader = ({ user, userProfile, view, setView, setError, earnPoints }) => {
    const [stories, setStories] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [bookFavorites, setBookFavorites] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [readHistory, setReadHistory] = useState([]);
    const [dailyStats, setDailyStats] = useState([]);
    const [unlockedStories, setUnlockedStories] = useState([]);
    const [seriesVotes, setSeriesVotes] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState(null);
    const [selectedSubGenre, setSelectedSubGenre] = useState(null);
    const [currentStory, setCurrentStory] = useState(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [readerLang, setReaderLang] = useState('ko');
    const [translatedContent, setTranslatedContent] = useState({});
    const [isTranslating, setIsTranslating] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportText, setReportText] = useState("");
    const [reportStatus, setReportStatus] = useState(null);
    const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
    const [recommendStep, setRecommendStep] = useState('main');
    const [recommendedData, setRecommendedData] = useState(null);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
    const [unlockTargetStory, setUnlockTargetStory] = useState(null);
    const [canFinishRead, setCanFinishRead] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const readingStartTime = useRef(null);

    // Data Fetching
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
        const unsubRead = onSnapshot(readHistoryRef, (snap) => setReadHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.readAt.localeCompare(a.readAt))));

        const statsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'daily_stats');
        const unsubStats = onSnapshot(statsRef, (snap) => {
            const stats = snap.docs.map(d => d.data());
            stats.sort((a, b) => b.date.localeCompare(a.date));
            setDailyStats(stats.slice(0, 7).reverse());
        });

        return () => { unsubFav(); unsubBookFav(); unsubStories(); unsubRatings(); unsubVotes(); unsubUnlocked(); unsubRead(); unsubStats(); };
    }, [user, appId]);

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

            const today = getTodayDateKey();
            setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'daily_stats', today), { date: today, minutes: increment(1) }, { merge: true });
        }
        return () => { if (scrollContainer) scrollContainer.removeEventListener('scroll', handleScroll); clearTimeout(finishCheckTimer); };
    }, [view, appId, user]);

    useEffect(() => {
        if (view === 'reader') {
            setReaderLang('ko'); setTranslatedContent({}); setIsTranslating(false);
            setError(null); setIsReportModalOpen(false);
        }
    }, [currentStory, view, setError]);

    const handleGenreClick = (genre) => {
        if (genre.hasSubGenre) { setSelectedGenre(genre); setView('genre_select'); }
        else { setSelectedGenre(genre); setSelectedSubGenre(null); setView('list'); }
        setError(null);
    };

    const handleSubGenreClick = (subGenreId) => {
        const genre = genres.find(g => g.id === selectedGenre.id);
        const subGenre = genre.subGenres.find(s => s.id === subGenreId);
        setSelectedSubGenre(subGenre);
        if (view !== 'write') setView('list');
    };

    const getStoryStats = (sid) => { const r = ratings.filter(x => x.storyId === sid); return { count: r.length, avg: r.length > 0 ? (r.reduce((a, b) => a + b.stars, 0) / r.length).toFixed(1) : "0.0" }; };
    const getFavoriteCount = (storyId) => favorites.filter(f => f.storyId === storyId).length;
    const isFavorited = (storyId) => favorites.some(f => f.storyId === storyId && f.userId === user?.uid);

    const toggleFavorite = async (s) => { const fid = `${user.uid}_${s.id}`; if (favorites.find(f => f.id === fid)) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'favorites', fid)); else await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'favorites', fid), { userId: user.uid, storyId: s.id, storyTitle: s.title, storyDate: s.date, genreId: s.genreId, authorNickname: s.authorNickname, createdAt: serverTimestamp() }); };

    const handleShare = async () => { const d = { title: currentStory.title, text: currentStory.title, url: `https://odok.app/story/${currentStory.id}` }; if (navigator.share) await navigator.share(d); else alert("Link copied"); };

    const handleReportSubmit = async () => { if (!reportText.trim()) return; setReportStatus('loading'); try { const res = await httpsCallable(functions, 'analyzeReportAI')({ title: currentStory.title, body: currentStory.body, reportText }); if (res.data.status === 'accepted') { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stories', currentStory.id), { body: res.data.fixedBody }); await earnPoints(2); } await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reports', `${user.uid}_${currentStory.id}`), { userId: user.uid, storyId: currentStory.id, text: reportText, status: res.data.status, createdAt: serverTimestamp() }); setReportStatus(res.data.status); } catch (e) { setReportStatus('error'); } };

    const translateStory = async (targetLang) => { if (targetLang === 'ko') { setReaderLang('ko'); return; } if (translatedContent[targetLang]) { setReaderLang(targetLang); return; } setIsTranslating(true); try { const res = await httpsCallable(functions, 'translateStoryAI')({ title: currentStory.title, body: currentStory.body, targetLang }); setTranslatedContent(p => ({ ...p, [targetLang]: res.data })); setReaderLang(targetLang); } catch (e) { setError('번역에 실패했습니다.'); } finally { setIsTranslating(false); } };

    const submitSeriesVote = async (voteType) => { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'series_votes', `${user.uid}_${currentStory.id}`), { storyId: currentStory.id, userId: user.uid, vote: voteType, createdAt: serverTimestamp() }); };

    const finishReading = async (t) => {
        if (!canFinishRead) return alert(t.read_more_time);
        const historyRef = doc(db, 'artifacts', appId, 'users', user.uid, 'read_history', currentStory.id);
        if ((await getDoc(historyRef)).exists()) return alert(t.read_already);
        await setDoc(historyRef, {
            storyId: currentStory.id, storyTitle: currentStory.title, genreId: currentStory.genreId, authorNickname: currentStory.authorNickname, storyDate: currentStory.date, readAt: new Date().toISOString()
        });
        alert(t.finish_reading_desc);
    };

    const handleStoryClick = async (story, t) => {
        if (story.authorId === user.uid || unlockedStories.includes(story.id)) {
            setCurrentStory(story); setView('reader');
        } else {
            setUnlockTargetStory(story); setIsUnlockModalOpen(true);
        }
    };

    const processUnlock = async (method, t) => {
        if (!user || !unlockTargetStory) return;
        const todayStr = getTodayDateKey();
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

    const generateTodayStory = async (t) => {
        if (!user || !userProfile?.nickname) return;
        const todayStr = getTodayDateKey();
        if (selectedSubGenre?.id === 'series' && userProfile.lastSeriesGeneratedDate === todayStr) return setError(t.series_limit_reached);
        const lastGen = userProfile.lastGeneratedDate || "";
        let cnt = (lastGen === todayStr) ? (userProfile.dailyGenerationCount || 0) : 0;
        if (cnt >= 2) return setError(t.daily_limit_reached);
        if (cnt > 0 && (userProfile.points || 0) < 2) return setError(t.need_points);

        setIsGenerating(true); setError(null);
        let prevCtx = "", ep = 1, sTitle = "", isFinal = false;

        if (selectedGenre.id === 'fiction' && selectedSubGenre?.id === 'series') {
            const sList = stories.filter(s => s.genreId === 'fiction' && s.subGenre === 'series').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            if (sList[0] && !sList[0].isFinal) {
                ep = (sList[0].episode || 1) + 1; sTitle = sList[0].seriesTitle || sList[0].title;
                const vs = seriesVotes.filter(v => v.storyId === sList[0].id);
                if (vs.filter(v => v.vote === 'end').length > vs.filter(v => v.vote === 'continue').length) isFinal = true;
                prevCtx = `이전 요약: ${sList[0].body.substring(0, 200)}... 제목:${sTitle} ${ep}화. ${isFinal ? "완결내세요" : ""}`;
            }
        } else {
            isFinal = true;
        }

        const subName = selectedSubGenre ? selectedSubGenre.name : selectedGenre.nameKey;
        const systemPrompt = `당신은 작가입니다. 제목 10자 이내. ${selectedGenre.nameKey} - ${subName}. ${selectedSubGenre?.prompt}. ${prevCtx}. 형식 JSON { "title": "${ep > 1 ? sTitle : '제목'}", "body": "내용" }`;

        try {
            const res = await httpsCallable(functions, 'generateStoryAI')({ systemPrompt, userPrompt: "써줘" });
            const newRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'stories'), {
                genreId: selectedGenre.id, subGenre: selectedSubGenre?.id, subGenreName: subName, date: todayStr, title: res.data.title, seriesTitle: ep > 1 ? sTitle : res.data.title, body: res.data.body, authorNickname: userProfile.nickname, authorId: user.uid, language: 'ko', episode: ep, isFinal, createdAt: new Date().toISOString()
            });
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'unlocked_stories', newRef.id), { unlockedAt: new Date().toISOString() });
            const upData = { points: increment(cnt === 0 ? 1 : -2), lastGeneratedDate: todayStr, dailyGenerationCount: cnt + 1 };
            if (selectedSubGenre?.id === 'series') upData.lastSeriesGeneratedDate = todayStr;
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), upData);
            setIsGenerating(false);
        } catch (e) { setError(t.gen_fail); setIsGenerating(false); }
    };

    const handleMoodRecommendation = (mood, t) => {
        let g, s, r;
        if (mood === 'healing') { g = 'essay'; s = 'empathy'; r = t.rec_reason_healing; }
        else if (mood === 'bored') { g = 'fiction'; s = 'twist'; r = t.rec_reason_bored; }
        else if (mood === 'growth') { g = 'improvement'; s = 'mindset'; r = t.rec_reason_growth; }
        else { g = 'humanities'; s = 'philosophy'; r = t.rec_reason_thinking; }
        setRecommendedData({ genreId: g, subGenreId: s, reason: r }); setRecommendStep('result');
    };
    const handleSeasonRecommendation = (t) => { setRecommendedData({ genreId: 'fiction', subGenreId: 'daily', reason: t.rec_reason_season }); setRecommendStep('result'); };
    const applyRecommendation = () => { const g = genres.find(x => x.id === recommendedData.genreId); setSelectedGenre(g); setSelectedSubGenre(g.subGenres.find(x => x.id === recommendedData.subGenreId)); setView('list'); setIsRecommendModalOpen(false); setRecommendStep('main'); };

    const submitRating = async (stars) => {
        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ratings', `${user.uid}_${currentStory.id}`), {
                storyId: currentStory.id, userId: user.uid, stars, updatedAt: serverTimestamp()
            });
        } catch (err) { setError("평점 등록에 실패했습니다."); }
    };

    return {
        stories, favorites, bookFavorites, ratings, readHistory, dailyStats, unlockedStories, seriesVotes,
        selectedGenre, setSelectedGenre, selectedSubGenre, setSelectedSubGenre, currentStory, setCurrentStory,
        scrollProgress, readerLang, setReaderLang, translatedContent, isTranslating,
        isReportModalOpen, setIsReportModalOpen, reportText, setReportText, reportStatus, handleReportSubmit,
        isRecommendModalOpen, setIsRecommendModalOpen, recommendStep, recommendedData, handleMoodRecommendation, handleSeasonRecommendation, applyRecommendation,
        isHelpModalOpen, setIsHelpModalOpen, isUnlockModalOpen, setIsUnlockModalOpen, unlockTargetStory,
        canFinishRead, isGenerating,
        handleGenreClick, handleSubGenreClick, getStoryStats, getFavoriteCount, isFavorited, toggleFavorite,
        handleShare, translateStory, submitSeriesVote, finishReading, generateTodayStory, handleStoryClick, processUnlock, submitRating
    };
};
