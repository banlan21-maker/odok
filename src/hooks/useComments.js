import { useState, useEffect } from 'react';
import {
    collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc, getDocs, setDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const useComments = ({ user, userProfile, currentStory, view, setError, earnPoints }) => {
    const [comments, setComments] = useState([]);
    const [commentInput, setCommentInput] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [ratings, setRatings] = useState([]);

    // 댓글 가져오기
    useEffect(() => {
        if (!user || !currentStory || view !== 'reader') return;
        const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'comments');
        const unsubComments = onSnapshot(commentsRef, (snap) => {
            const rawComments = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.storyId === currentStory.id);

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
    }, [user, currentStory, view, appId]);

    // 평점 가져오기 (댓글 작성 시 체크용)
    useEffect(() => {
        if (!user) return;
        const ratingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'ratings');
        const unsubRatings = onSnapshot(ratingsRef, (snap) => setRatings(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsubRatings();
    }, [user, appId]);

    const rewardCheckInProgress = new Set();

    const checkAndGiveReward = async (storyId) => {
        if (rewardCheckInProgress.has(storyId)) return false;
        rewardCheckInProgress.add(storyId);

        try {
            const rewardRef = doc(db, 'artifacts', appId, 'users', user.uid, 'story_rewards', storyId);
            const rewardSnap = await getDoc(rewardRef);
            if (rewardSnap.exists()) return false;

            const ratingRef = doc(db, 'artifacts', appId, 'public', 'data', 'ratings', `${user.uid}_${storyId}`);
            const ratingSnap = await getDoc(ratingRef);
            if (!ratingSnap.exists()) return false;

            const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'comments');
            const commentsQuery = query(commentsRef, where('storyId', '==', storyId), where('userId', '==', user.uid));
            const commentsSnap = await getDocs(commentsQuery);

            const hasComment = commentsSnap.docs.some(doc => !doc.data().parentId);
            if (!hasComment) return false;

            const rewardSnap2 = await getDoc(rewardRef);
            if (rewardSnap2.exists()) return false;

            await setDoc(rewardRef, { storyId, rewardedAt: serverTimestamp() });
            await earnPoints(1);
            return true;
        } catch (err) {
            console.error("Reward check error:", err);
            return false;
        } finally {
            rewardCheckInProgress.delete(storyId);
        }
    };

    const submitComment = async (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (isSubmittingComment) return;
        if (!commentInput.trim()) { setError("댓글을 입력해주세요."); return; }

        const userRating = ratings.find(r => r.userId === user.uid && r.storyId === currentStory.id);
        if (!userRating) { setError("별점을 먼저 평가해주세요."); return; }

        setIsSubmittingComment(true);
        setError(null);

        try {
            if (editingCommentId) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'comments', editingCommentId), {
                    text: commentInput.trim(), updatedAt: serverTimestamp()
                });
                setEditingCommentId(null);
                setCommentInput("");
                setReplyTo(null);
            } else {
                const commentText = commentInput.trim();
                const isParentComment = !replyTo?.id;

                const isAnonymous = !!userProfile?.anonymousActivity;
                const commentRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'comments'), {
                    storyId: currentStory.id,
                    userId: user.uid,
                    nickname: isAnonymous ? "익명" : (userProfile?.nickname || "익명"),
                    text: commentText,
                    parentId: replyTo?.id || null,
                    createdAt: serverTimestamp()
                });

                if (!commentRef || !commentRef.id) throw new Error("댓글 저장 실패");

                let saved = false;
                for (let i = 0; i < 3; i++) {
                    await new Promise(r => setTimeout(r, 200 * (i + 1)));
                    const s = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'comments', commentRef.id));
                    if (s.exists()) { saved = true; break; }
                }
                if (!saved) throw new Error("댓글 저장 확인 실패");

                setCommentInput("");
                setReplyTo(null);

                if (isParentComment && saved) {
                    setTimeout(() => checkAndGiveReward(currentStory.id), 800);
                }
            }
        } catch (err) {
            console.error("Comment Error:", err);
            setError("댓글 등록에 실패했습니다. 다시 시도해주세요.");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const startEditComment = (c) => {
        setEditingCommentId(c.id);
        setCommentInput(c.text);
        setReplyTo(null);
    };

    return {
        comments, setComments,
        commentInput, setCommentInput,
        replyTo, setReplyTo,
        editingCommentId, setEditingCommentId,
        isSubmittingComment, setIsSubmittingComment,
        submitComment, startEditComment,
        checkAndGiveReward
    };
};
