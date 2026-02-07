import { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';

export const useNotices = ({ user, isNoticeAdmin }) => {
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [isNoticeEditorOpen, setIsNoticeEditorOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [isSavingNotice, setIsSavingNotice] = useState(false);

  // 공지사항 구독
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

  return {
    notices,
    selectedNotice,
    setSelectedNotice,
    isNoticeEditorOpen,
    setIsNoticeEditorOpen,
    noticeTitle,
    setNoticeTitle,
    noticeContent,
    setNoticeContent,
    isSavingNotice,
    formatNoticeDate,
    openNoticeEditor,
    saveNotice
  };
};
