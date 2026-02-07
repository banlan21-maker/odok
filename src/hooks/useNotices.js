import { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, deleteDoc
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

  const [editingNoticeId, setEditingNoticeId] = useState(null);

  const openNoticeEditor = (notice = null) => {
    if (notice) {
      setEditingNoticeId(notice.id);
      setNoticeTitle(notice.title);
      setNoticeContent(notice.content);
    } else {
      setEditingNoticeId(null);
      setNoticeTitle('');
      setNoticeContent('');
    }
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
      if (editingNoticeId) {
        await updateDoc(doc(db, 'notices', editingNoticeId), {
          title,
          content,
          updatedAt: serverTimestamp()
        });
        alert('공지사항이 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'notices'), {
          title,
          content,
          author: user.email || 'admin',
          createdAt: serverTimestamp()
        });
        alert('공지사항이 등록되었습니다.');
      }
      setIsNoticeEditorOpen(false);
      setNoticeTitle('');
      setNoticeContent('');
      setEditingNoticeId(null);
    } catch (err) {
      console.error('공지사항 저장 실패:', err);
      alert('공지사항 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSavingNotice(false);
    }
  };

  const deleteNotice = async (noticeId) => {
    if (!isNoticeAdmin || !user) return;
    if (!window.confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'notices', noticeId));
      alert('공지사항이 삭제되었습니다.');
      // 만약 삭제된 공지가 선택되어 있었다면 닫기
      if (selectedNotice?.id === noticeId) {
        setSelectedNotice(null);
      }
    } catch (err) {
      console.error('공지사항 삭제 실패:', err);
      alert('삭제에 실패했습니다.');
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
    saveNotice,
    deleteNotice
  };
};
