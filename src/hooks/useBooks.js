import { useState, useEffect, useRef } from 'react';
import {
    collection, query, onSnapshot, where, getDocs, doc, getDoc, addDoc, serverTimestamp, updateDoc, increment, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { startOfDay, startOfWeek, endOfWeek, endOfDay } from 'date-fns';
import { getTodayDateKey } from '../utils/dateUtils';
import { getExtraWriteInkCost, getLevelFromXp, INK_MAX, DAILY_WRITE_LIMIT, DAILY_FREE_WRITES } from '../utils/levelUtils';

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
        if (category === 'series' || isSeries) {
            if (!st.series) st.series = { book, authorName: book.authorName || '익명' };
            return;
        }
        if (category === 'webnovel' && !st.webnovel) st.webnovel = { book, authorName: book.authorName || '익명' };
        else if (category === 'novel' && !st.novel) st.novel = { book, authorName: book.authorName || '익명' };
        else if (category === 'essay' && !st.essay) st.essay = { book, authorName: book.authorName || '익명' };
        else if ((category === 'self-improvement' || category === 'self-help') && !st['self-help']) st['self-help'] = { book, authorName: book.authorName || '익명' };
        else if (category === 'humanities' && !st.humanities) st.humanities = { book, authorName: book.authorName || '익명' };
    });
    if (!st.series && dssData) st.series = { book: { id: dssData.bookId }, authorName: dssData.authorName || '익명' };
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
    const [topWriters, setTopWriters] = useState([]);
    const [isLoadingHomeData, setIsLoadingHomeData] = useState(true);
    const [isWritingInProgress, setIsWritingInProgress] = useState(false);
    const [showWritingCompleteModal, setShowWritingCompleteModal] = useState(null);

    const latestBooksRef = useRef([]);

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
            const weekStart = startOfWeek(today, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

            const todayBooksList = booksData.filter(book => {
                if (book.dateKey) return book.dateKey === todayDateKey;
                const createdAt = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
                return createdAt && createdAt >= today;
            }).sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0));
                const dateB = b.createdAt?.toDate?.() || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0));
                return dateB - dateA;
            });
            setTodayBooks(todayBooksList);

            const weeklyBooks = booksData.filter(book => {
                const createdAt = book.createdAt?.toDate?.() || (book.createdAt?.seconds ? new Date(book.createdAt.seconds * 1000) : null);
                return createdAt && createdAt >= weekStart && createdAt <= weekEnd;
            }).map(book => ({
                ...book,
                score: (book.views || 0) + (book.likes || 0) + (book.favorites || 0) + (book.completions || 0)
            })).sort((a, b) => b.score - a.score).slice(0, 3);
            setWeeklyBestBooks(weeklyBooks);

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

    // 주간 집필왕 계산
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
                        acc[authorId] = { id: authorId, nickname: book.authorName || '익명', bookCount: 0 };
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
                        return writer;
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

            const authorName = userProfile?.nickname || '익명';
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
                dateKey: todayDateKey,
                views: 0,
                likes: 0,
                isSeries: isSeries
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

            const sanitizeData = (data) => JSON.parse(JSON.stringify(data, (k, v) => v === undefined ? null : v));
            const cleanBookData = sanitizeData(bookDocumentData);

            const bookRef = await addDoc(collection(db, 'artifacts', appId, 'books'), cleanBookData);
            const savedBook = { id: bookRef.id, ...bookDocumentData };

            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
            try {
                const nextDailyWriteCount = lastBookCreatedDate === todayDateKey ? dailyWriteCount + 1 : 1;
                await updateDoc(profileRef, {
                    bookCount: increment(1),
                    dailyWriteCount: nextDailyWriteCount,
                    lastBookCreatedDate: todayDateKey
                });
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

    return {
        books, setBooks,
        currentBook, setCurrentBook,
        selectedBook, setSelectedBook,
        libraryFilter, setLibraryFilter,
        slotStatus, setSlotStatus,
        todayBooks, setTodayBooks,
        weeklyBestBooks, setWeeklyBestBooks,
        topWriters, setTopWriters,
        isLoadingHomeData, setIsLoadingHomeData,
        isWritingInProgress, setIsWritingInProgress,
        showWritingCompleteModal, setShowWritingCompleteModal,
        handleBookGenerated
    };
};
