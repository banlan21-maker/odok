import { useState, useEffect, useRef } from 'react';
import {
    collection, query, onSnapshot, where, getDocs, doc, getDoc, addDoc, serverTimestamp, updateDoc, increment, setDoc, deleteDoc, Timestamp, runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { getTodayDateKey } from '../utils/dateUtils';
import { getExtraWriteInkCost, getLevelFromXp, getGradeInfo, INK_MAX, DAILY_WRITE_LIMIT, DAILY_FREE_WRITES } from '../utils/levelUtils';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

function computeSlotStatus(booksData, todayDateKey, dssData) {
    let todayBooksForSlots = (booksData || []).filter((b) => {
        const bookDateKey = b.dateKey;
        if (!bookDateKey) return false;
        return bookDateKey === todayDateKey;
    }).sort((a, b) => {
        const tA = a.createdAt?.toDate?.() || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0));
        const tB = b.createdAt?.toDate?.() || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0));
        return tA - tB;
    });
    const st = { webnovel: null, novel: null, series: null, essay: null, 'self-help': null, humanities: null };
    todayBooksForSlots.forEach((book) => {
        const category = String(book.category || '').trim().toLowerCase();
        const isSeries = book.isSeries === true;
        const slotData = { book, authorId: book.authorId };
        if (category === 'series' || isSeries) {
            if (!st.series) st.series = slotData;
            return;
        }
        if (category === 'webnovel' && !st.webnovel) st.webnovel = slotData;
        else if (category === 'novel' && !st.novel) st.novel = slotData;
        else if (category === 'essay' && !st.essay) st.essay = slotData;
        else if ((category === 'self-improvement' || category === 'self-help') && !st['self-help']) st['self-help'] = slotData;
        else if (category === 'humanities' && !st.humanities) st.humanities = slotData;
    });
    if (!st.series && dssData) st.series = { book: { id: dssData.bookId, isAnonymous: dssData.isAnonymous }, authorId: dssData.authorId || null, authorName: dssData.authorName || null };
    return st;
}

export const useBooks = ({ user, userProfile, setError, deductInk, setShowInkConfirmModal, setPendingBookData: setGlobalPendingBookData }) => {
    const [books, setBooks] = useState([]);
    const [currentBook, setCurrentBook] = useState(null);
    const [selectedBook, setSelectedBook] = useState(null);
    const [libraryFilter, setLibraryFilter] = useState('all');
    const [slotStatus, setSlotStatus] = useState({
        'webnovel': null, 'novel': null, 'series': null, 'essay': null, 'self-help': null, 'humanities': null
    });
    const [todayBooks, setTodayBooks] = useState([]);
    const [weeklyBestBooks, setWeeklyBestBooks] = useState([]);
    const [allTimeBestBooks, setAllTimeBestBooks] = useState([]);
    const [topWriters, setTopWriters] = useState([]);
    const [isLoadingHomeData, setIsLoadingHomeData] = useState(true);
    const [isWritingInProgress, setIsWritingInProgress] = useState(false);
    const [showWritingCompleteModal, setShowWritingCompleteModal] = useState(null);
    const [authorProfiles, setAuthorProfiles] = useState({});
    const [promotions, setPromotions] = useState([]);

    const latestBooksRef = useRef([]);
    const authorProfilesCacheRef = useRef({});

    // Step 1: 생성된 책 목록 가져오기 & 실시간 동기화
    useEffect(() => {
        if (!user) return;

        const booksRef = collection(db, 'artifacts', appId, 'books');
        const unsubBooks = onSnapshot(booksRef, (snap) => {
            const booksData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setBooks(booksData);
            latestBooksRef.current = booksData;

            const todayDateKey = getTodayDateKey();
            const today = startOfDay(new Date());

            const getBookActivityTime = (book) => {
                const isSeries = book.isSeries === true || book.category === 'series';
                if (isSeries && book.episodes && book.episodes.length > 0) {
                    const lastEp = book.episodes[book.episodes.length - 1];
                    const epCreated = lastEp.createdAt;
                    if (epCreated) {
                        const t = typeof epCreated === 'string' ? new Date(epCreated) : (epCreated?.toDate?.() || (epCreated?.seconds ? new Date(epCreated.seconds * 1000) : null));
                        if (t && !isNaN(t.getTime())) return t.getTime();
                    }
                }
                if (book.updatedAt?.toDate) return book.updatedAt.toDate().getTime();
                if (book.updatedAt?.seconds) return book.updatedAt.seconds * 1000;
                const created = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
                return created && !isNaN(created.getTime()) ? created.getTime() : 0;
            };

            const todayBooksList = booksData.filter(book => {
                if (book.dateKey && book.dateKey === todayDateKey) return true;
                const created = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
                if (created && created >= today) return true;
                const isSeries = book.isSeries === true || book.category === 'series';
                if (isSeries && book.episodes && book.episodes.length > 0) {
                    const lastEp = book.episodes[book.episodes.length - 1];
                    const epCreated = lastEp.createdAt;
                    if (epCreated) {
                        const t = typeof epCreated === 'string' ? new Date(epCreated) : (epCreated?.toDate?.() || (epCreated?.seconds ? new Date(epCreated.seconds * 1000) : null));
                        if (t && !isNaN(t.getTime()) && t >= today) return true;
                    }
                }
                const updated = book.updatedAt?.toDate?.() || (book.updatedAt?.seconds ? new Date(book.updatedAt.seconds * 1000) : null);
                if (updated && updated >= today) return true;
                return false;
            }).sort((a, b) => getBookActivityTime(b) - getBookActivityTime(a));
            setTodayBooks(todayBooksList);

            // 누적 베스트셀러: views + likes*2 + favorites*2 + completions*3 점수 기준 (상위 3권)
            const allTimeScore = (b) => (b.views || 0) + (b.likes || 0) * 2 + (b.favorites || 0) * 2 + (b.completions || 0) * 3;
            const allTimeBest = booksData
                .map((book) => ({ ...book, allTimeScore: allTimeScore(book) }))
                .sort((a, b) => b.allTimeScore - a.allTimeScore)
                .slice(0, 3);
            setAllTimeBestBooks(allTimeBest);

            // 주간 베스트셀러: 최근 7일간 좋아요/즐겨찾기/완독 점수 기준 (3권)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoTs = Timestamp.fromDate(weekAgo);
            const likesRef = collection(db, 'artifacts', appId, 'public', 'data', 'book_likes');
            const favRef = collection(db, 'artifacts', appId, 'public', 'data', 'book_favorites');
            const compRef = collection(db, 'artifacts', appId, 'public', 'data', 'book_completions');
            Promise.all([
                getDocs(query(likesRef, where('createdAt', '>=', weekAgoTs))),
                getDocs(query(favRef, where('createdAt', '>=', weekAgoTs))),
                getDocs(query(compRef, where('createdAt', '>=', weekAgoTs)))
            ]).then(([likesSnap, favSnap, compSnap]) => {
                const weeklyByBook = {};
                const add = (snap) => {
                    snap.docs.forEach((d) => {
                        const bid = d.data().bookId;
                        if (bid) weeklyByBook[bid] = (weeklyByBook[bid] || 0) + 1;
                    });
                };
                add(likesSnap);
                add(favSnap);
                add(compSnap);
                const bestBooks = booksData
                    .map((book) => ({ ...book, weeklyScore: weeklyByBook[book.id] || 0 }))
                    .filter((b) => (b.weeklyScore || 0) > 0)
                    .sort((a, b) => (b.weeklyScore || 0) - (a.weeklyScore || 0))
                    .slice(0, 3);
                setWeeklyBestBooks(bestBooks);
            }).catch((err) => {
                console.warn('[주간 베스트] 최근 7일 조회 실패, 누적 점수로 대체', err);
                const fallback = booksData.map((book) => ({
                    ...book,
                    score: (book.views || 0) + (book.likes || 0) + (book.favorites || 0) + (book.completions || 0)
                })).sort((a, b) => b.score - a.score).slice(0, 3);
                setWeeklyBestBooks(fallback);
            });

            const dssRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_series_slot', todayDateKey);
            getDoc(dssRef).then((dssSnap) => {
                const dssData = dssSnap.exists() ? dssSnap.data() : null;
                setSlotStatus(computeSlotStatus(booksData, todayDateKey, dssData));
            }).catch((e) => {
                setSlotStatus(computeSlotStatus(booksData, todayDateKey, null));
            });
            setIsLoadingHomeData(false);
        }, (err) => {
            console.error("❌ Books fetch error:", err);
            setError('책 목록을 불러오는데 실패했습니다.');
        });

        return () => unsubBooks();
    }, [user, appId, setError]);

    // daily_series_slot 구독
    useEffect(() => {
        if (!user || !appId) return;
        const todayKey = getTodayDateKey();
        const dssRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_series_slot', todayKey);
        const unsub = onSnapshot(dssRef, (snap) => {
            const dssData = snap.exists() ? snap.data() : null;
            setSlotStatus(computeSlotStatus(latestBooksRef.current, todayKey, dssData));
        }, (e) => console.warn('[슬롯] daily_series_slot 구독 오류', e));
        return () => unsub();
    }, [user, appId]);

    // promotions 구독 (홍보 기능)
    useEffect(() => {
        if (!user || !appId) return;
        const promosRef = collection(db, 'artifacts', appId, 'public', 'data', 'promotions');
        const unsub = onSnapshot(promosRef, (snap) => {
            const now = new Date();
            const promosData = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(p => {
                    const expiresAt = p.expiresAt?.toDate?.() || (p.expiresAt?.seconds ? new Date(p.expiresAt.seconds * 1000) : null);
                    return expiresAt && expiresAt > now;
                });
            setPromotions(promosData);
        }, (e) => console.warn('[홍보] promotions 구독 오류', e));
        return () => unsub();
    }, [user, appId]);

    // 작가 프로필 캐시: authorId → { nickname, profileImageUrl }
    useEffect(() => {
        if (!books.length) return;
        const authorIds = [...new Set(books.map(b => b.authorId).filter(Boolean))];
        const toFetch = authorIds.filter(id => !authorProfilesCacheRef.current[id]);
        if (toFetch.length === 0) return;

        let isActive = true;
        Promise.all(toFetch.map(async (id) => {
            try {
                const profileRef = doc(db, 'artifacts', appId, 'users', id, 'profile', 'info');
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) {
                    const data = profileSnap.data();
                    const level = getLevelFromXp(data.xp ?? 0);
                    const grade = getGradeInfo(level);
                    return [id, { nickname: data.nickname || '익명', profileImageUrl: data.profileImageUrl || null, level, gradeIcon: grade.icon, badgeStyle: grade.badgeStyle }];
                }
                return [id, { nickname: '익명', profileImageUrl: null, level: 1, gradeIcon: '🌱', badgeStyle: 'bg-green-500' }];
            } catch {
                return [id, { nickname: '익명', profileImageUrl: null }];
            }
        })).then(results => {
            if (!isActive) return;
            const newProfiles = Object.fromEntries(results);
            authorProfilesCacheRef.current = { ...authorProfilesCacheRef.current, ...newProfiles };
            setAuthorProfiles({ ...authorProfilesCacheRef.current });
        });

        return () => { isActive = false; };
    }, [books, appId]);

    // 현재 유저 프로필(닉네임/사진/레벨·칭호) 변경 시 즉시 반영 — 칭호 업그레이드 시 기존 책 표지에도 새 아이콘 적용
    useEffect(() => {
        if (!user) return;
        const level = getLevelFromXp(userProfile?.xp ?? 0);
        const grade = getGradeInfo(level);
        const updated = {
            nickname: userProfile?.nickname || '익명',
            profileImageUrl: userProfile?.profileImageUrl || null,
            level,
            gradeIcon: grade.icon,
            badgeStyle: grade.badgeStyle
        };
        authorProfilesCacheRef.current[user.uid] = updated;
        setAuthorProfiles(prev => ({ ...prev, [user.uid]: updated }));
    }, [user, userProfile?.nickname, userProfile?.profileImageUrl, userProfile?.xp]);

    // 주간 집필왕 계산
    useEffect(() => {
        if (!user || books.length === 0) return;
        let isActive = true;
        const timer = setTimeout(() => {
            const buildTopWriters = async () => {
                const now = new Date();
                const weekStartDate = startOfWeek(now, { weekStartsOn: 1 });
                const weekEndDate = endOfWeek(now, { weekStartsOn: 1 });
                const toDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const weekStartKey = toDateKey(weekStartDate);
                const weekEndKey = toDateKey(weekEndDate);

                const weeklyBooks = books.filter(book => {
                    if (book.dateKey) return book.dateKey >= weekStartKey && book.dateKey <= weekEndKey;
                    const createdAt = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
                    return createdAt && createdAt >= weekStartDate && createdAt <= weekEndDate;
                });

                const counts = weeklyBooks.reduce((acc, book) => {
                    const authorId = book.authorId;
                    if (!authorId) return acc;
                    if (!acc[authorId]) {
                        acc[authorId] = { id: authorId, weeklyCount: 0 };
                    }
                    acc[authorId].weeklyCount += 1;
                    return acc;
                }, {});

                // 누적 집필수 계산 (전체 books에서)
                const totalCounts = books.reduce((acc, book) => {
                    const authorId = book.authorId;
                    if (!authorId) return acc;
                    acc[authorId] = (acc[authorId] || 0) + 1;
                    return acc;
                }, {});

                const topWritersList = Object.values(counts)
                    .sort((a, b) => b.weeklyCount - a.weeklyCount)
                    .slice(0, 3);

                // 프로필에서 닉네임/프로필사진/xp 가져오기
                const enriched = await Promise.all(topWritersList.map(async (writer) => {
                    const totalBookCount = totalCounts[writer.id] || 0;
                    try {
                        const profileRef = doc(db, 'artifacts', appId, 'users', writer.id, 'profile', 'info');
                        const profileSnap = await getDoc(profileRef);
                        if (profileSnap.exists()) {
                            const data = profileSnap.data();
                            const xp = data.xp ?? 0;
                            const level = getLevelFromXp(xp);
                            const gradeInfo = getGradeInfo(level);
                            return {
                                ...writer, totalBookCount,
                                nickname: data.nickname || '익명',
                                profileImageUrl: data.profileImageUrl || null,
                                level, gradeName: gradeInfo.gradeName, gradeIcon: gradeInfo.icon
                            };
                        }
                        return { ...writer, totalBookCount, nickname: '익명', profileImageUrl: null, level: 1, gradeName: '새싹', gradeIcon: '🌱' };
                    } catch (err) {
                        return { ...writer, totalBookCount, nickname: '익명', profileImageUrl: null, level: 1, gradeName: '새싹', gradeIcon: '🌱' };
                    }
                }));

                if (isActive) setTopWriters(enriched);
            };
            buildTopWriters();
        }, 200);

        return () => { isActive = false; clearTimeout(timer); };
    }, [user, books, appId]);

    const getSlotKey = (category, isSeries, subCategory) => {
        const normalizedCategory = String(category || '').trim().toLowerCase();
        if (isSeries || normalizedCategory === 'series') return 'series';
        if (normalizedCategory === 'webnovel' || normalizedCategory === 'novel') return normalizedCategory;
        if (normalizedCategory === 'self-improvement') return 'self-help';
        return normalizedCategory;
    };

    const handleBookGenerated = async (bookData, useInk = false, options = {}) => {
        if (!user) {
            setError('로그인이 필요합니다.');
            return;
        }

        try {
            const { skipDailyCheck = false, skipInkDeduct = false } = options || {};
            const profileRefForCheck = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
            const profileSnapForCheck = await getDoc(profileRefForCheck);
            const todayDateKey = getTodayDateKey();

            let lastBookCreatedDate = null;
            let dailyWriteCount = 0;
            if (profileSnapForCheck.exists()) {
                const profileData = profileSnapForCheck.data();
                lastBookCreatedDate = profileData.lastBookCreatedDate;
                dailyWriteCount = Number(profileData.dailyWriteCount || 0);
            }

            if (lastBookCreatedDate !== todayDateKey) {
                dailyWriteCount = 0;
            }

            if (dailyWriteCount >= DAILY_WRITE_LIMIT) {
                setError('하루에 최대 2회까지만 집필할 수 있어요.');
                if (setGlobalPendingBookData) setGlobalPendingBookData(null);
                return;
            }

            if (!skipDailyCheck && !useInk && dailyWriteCount >= DAILY_FREE_WRITES) {
                if (setGlobalPendingBookData) setGlobalPendingBookData(bookData);
                if (setShowInkConfirmModal) setShowInkConfirmModal(true);
                return;
            }

            // 잉크 사용 로직
            if (useInk && !skipInkDeduct) {
                const currentInk = userProfile?.ink || 0;
                const requiredInk = getExtraWriteInkCost(getLevelFromXp(userProfile?.xp ?? 0));

                if (currentInk < requiredInk) {
                    setError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
                    if (setGlobalPendingBookData) setGlobalPendingBookData(null);
                    return;
                }

                await deductInk(requiredInk);
            }

            // 동시성 제어
            const slotKey = getSlotKey(bookData.category, bookData.isSeries || false, bookData.subCategory);

            const booksRef = collection(db, 'artifacts', appId, 'books');
            try {
                const q = query(booksRef, where('dateKey', '==', todayDateKey));
                const snapshot = await getDocs(q);
                const currentTodayBooks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                const existingBook = currentTodayBooks.find(book => {
                    const bookCategory = String(book.category || '').trim().toLowerCase();
                    const bookIsSeries = book.isSeries === true;
                    const bookSubCategory = String(book.subCategory || '').trim().toLowerCase();
                    const bookSlotKey = getSlotKey(bookCategory, bookIsSeries, bookSubCategory);
                    return bookSlotKey === slotKey;
                });

                if (existingBook) {
                    const existingAuthor = existingBook.authorName || '익명';
                    setError(`아쉽지만 간발의 차로 다른 작가님이 먼저 집필하셨어요! (By. ${existingAuthor}) 서재에서 읽어보세요.`);
                    throw new Error('SLOT_ALREADY_TAKEN');
                }

                if (slotKey === 'series') {
                    const dssRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_series_slot', todayDateKey);
                    const dssSnap = await getDoc(dssRef);
                    if (dssSnap.exists()) {
                        setError(`오늘 시리즈 집필은 마감되었어요. (By. ${dssSnap.data().authorName || '익명'})`);
                        throw new Error('SLOT_ALREADY_TAKEN');
                    }
                }
            } catch (queryErr) {
                if (queryErr.message === 'SLOT_ALREADY_TAKEN') throw queryErr;
                setError('시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                throw queryErr;
            }

            const isAnonymousMode = !!bookData.isAnonymous;
            const authorName = isAnonymousMode ? '익명' : (userProfile?.nickname || '익명');
            const isSeries = bookData.isSeries || false;

            const bookDocumentData = {
                title: bookData.title,
                content: bookData.content,
                summary: bookData.summary || bookData.content.substring(0, 100) + '...',
                category: bookData.category,
                subCategory: bookData.subCategory || null,
                genre: bookData.genre || bookData.subCategory || null,
                keywords: bookData.keywords || null,
                selectedMood: bookData.selectedMood || null,
                selectedPOV: bookData.selectedPOV || null,
                selectedSpeechTone: bookData.selectedSpeechTone || null,
                selectedDialogueRatio: bookData.selectedDialogueRatio || null,
                endingStyle: bookData.endingStyle || null,
                authorId: user.uid,
                authorName: authorName,
                isAnonymous: isAnonymousMode,
                createdAt: serverTimestamp(),
                dateKey: todayDateKey,
                views: 0,
                likes: 0,
                favorites: 0,
                completions: 0,
                isSeries: isSeries,
                fontFamily: bookData.fontFamily || 'default'
            };

            if (bookData.steps) bookDocumentData.steps = bookData.steps;
            if (bookData.storySummary) bookDocumentData.storySummary = bookData.storySummary;
            if (bookData.synopsis) bookDocumentData.synopsis = bookData.synopsis;
            if (bookData.characterSheet) bookDocumentData.characterSheet = bookData.characterSheet;
            if (bookData.settingSheet) bookDocumentData.settingSheet = bookData.settingSheet;

            if (isSeries) {
                bookDocumentData.seriesId = crypto.randomUUID();
                bookDocumentData.status = 'ongoing';
                if (bookData.seriesSubType) bookDocumentData.seriesSubType = bookData.seriesSubType;
                bookDocumentData.episodes = [{
                    ep_number: 1,
                    title: bookData.title,
                    content: bookData.content,
                    writer: user.uid,
                    writerName: authorName,
                    createdAt: new Date().toISOString(),
                    summary: bookData.storySummary || bookData.summary || bookData.content.substring(0, 300) + '...'
                }];
                bookDocumentData.summary = bookData.storySummary || bookData.summary || bookData.content.substring(0, 300) + '...';
                bookDocumentData.content = '';
            }

            const sanitizeData = (data) => JSON.parse(JSON.stringify(data, (k, v) => (k === 'createdAt' || v === undefined) ? (k === 'createdAt' ? undefined : null) : v));
            const cleanBookData = sanitizeData(bookDocumentData);
            cleanBookData.createdAt = serverTimestamp();

            const bookRef = await addDoc(collection(db, 'artifacts', appId, 'books'), cleanBookData);
            const savedBook = { id: bookRef.id, ...bookDocumentData };

            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
            try {
                const nextDailyWriteCount = lastBookCreatedDate === todayDateKey ? dailyWriteCount + 1 : 1;
                const _now = new Date();
                const challengeMonthKey = `${_now.getFullYear()}_${String(_now.getMonth() + 1).padStart(2, '0')}`;
                const CHALLENGE_START = '2026_04';
                const isChallengeActive = challengeMonthKey >= CHALLENGE_START;
                const storedMonth = userProfile?.challenge_month;

                const updateData = {
                    bookCount: increment(1),
                    dailyWriteCount: nextDailyWriteCount,
                    lastBookCreatedDate: todayDateKey
                };

                if (isChallengeActive) {
                    if (storedMonth === challengeMonthKey) {
                        updateData.challenge_writes = increment(1);
                    } else {
                        // 월이 바뀌면 모든 챌린지 리셋
                        updateData.challenge_month = challengeMonthKey;
                        updateData.challenge_reads = 0;
                        updateData.challenge_writes = 1;
                        updateData.challenge_likes = 0;
                        updateData.challenge_attendance = 0;
                        updateData.challenge_claimed_map = {};
                        updateData.challenge_claimed = false;
                    }
                }

                await updateDoc(profileRef, updateData);
            } catch (profileErr) {
                console.warn('프로필 업데이트 오류', profileErr);
                // Fallback logic omitted for brevity, similar to original App.jsx
            }

            setError(null);
            setShowWritingCompleteModal({ book: savedBook });
            return savedBook;

        } catch (err) {
            if (err.message !== 'SLOT_ALREADY_TAKEN') {
                console.error('책 저장 오류:', err);
                setError('책 저장에 실패했습니다. 다시 시도해주세요.');
            }
        }
    };

    const createPromotion = async (bookId, promoText, { authorNickname = '', authorBio = '', bookSummary = '' } = {}) => {
        if (!user) throw new Error('LOGIN_REQUIRED');

        const now = new Date();
        const promosRef = collection(db, 'artifacts', appId, 'public', 'data', 'promotions');
        const promosSnap = await getDocs(promosRef);
        const activePromos = promosSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => {
                const expiresAt = p.expiresAt?.toDate?.() || (p.expiresAt?.seconds ? new Date(p.expiresAt.seconds * 1000) : null);
                return expiresAt && expiresAt > now;
            });

        if (activePromos.length >= 5) throw new Error('PROMO_FULL');
        if (activePromos.some(p => p.authorId === user.uid)) throw new Error('PROMO_ALREADY');

        // 확성기 아이템 차감 (트랜잭션)
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(profileRef);
            if (!snap.exists()) throw new Error('프로필을 찾을 수 없습니다.');
            const qty = snap.data()?.inventory?.megaphone ?? 0;
            if (qty < 1) throw new Error('PROMO_NO_ITEM');
            transaction.update(profileRef, { 'inventory.megaphone': qty - 1 });
        });

        const createdAt = Timestamp.now();
        const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + 24 * 60 * 60 * 1000); // 24시간

        await addDoc(promosRef, {
            bookId,
            authorId: user.uid,
            promoText: promoText.slice(0, 50),
            authorNickname,
            authorBio,
            bookSummary,
            createdAt,
            expiresAt
        });
    };

    return {
        books, setBooks,
        currentBook, setCurrentBook,
        selectedBook, setSelectedBook,
        libraryFilter, setLibraryFilter,
        slotStatus, setSlotStatus,
        todayBooks, setTodayBooks,
        weeklyBestBooks, setWeeklyBestBooks,
        allTimeBestBooks, setAllTimeBestBooks,
        topWriters, setTopWriters,
        isLoadingHomeData, setIsLoadingHomeData,
        isWritingInProgress, setIsWritingInProgress,
        showWritingCompleteModal, setShowWritingCompleteModal,
        authorProfiles,
        promotions,
        createPromotion,
        handleBookGenerated
    };
};
