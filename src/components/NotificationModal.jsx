// src/components/NotificationModal.jsx
// 통합 알림 모달 — [알림] + [우편함] 2탭
import React, { useState } from 'react';
import { X, MessageCircle, Heart, UserPlus, Gift, Bell, BookOpen, Droplets, Loader, CheckCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

// ─── 알림 탭 ───
const ICON_MAP = {
  comment: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  like: { icon: Heart, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
  follow: { icon: UserPlus, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' },
  gift: { icon: Gift, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' },
  new_book: { icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  new_episode: { icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  default: { icon: Bell, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-700' },
};

const timeAgo = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return date.toLocaleDateString();
};

const ITEM_EMOJI = {
  golden_pen: '🖊️', rainbow_ink: '🌈', magic_eraser: '✨', paint_brush: '🎨', sharp: '✏️',
};

const NotificationModal = ({ notifications = [], userId, mailboxItems = [], onClose, t = {} }) => {
  const [tab, setTab] = useState('notifications');
  const [claimingId, setClaimingId] = useState(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimedIds, setClaimedIds] = useState(new Set());
  const [error, setError] = useState(null);

  const claimFn = httpsCallable(functions, 'claimMailbox');
  const visibleMail = mailboxItems.filter(item => !claimedIds.has(item.id));

  // 알림 탭 열 때 읽음 처리
  React.useEffect(() => {
    if (!userId || tab !== 'notifications') return;
    notifications.forEach((n) => {
      if (!n.read) {
        updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'notifications', n.id), { read: true }).catch(() => {});
      }
    });
  }, [notifications, userId, tab]);

  const handleClaim = async (mailboxId) => {
    if (claimingId || claimingAll) return;
    setClaimingId(mailboxId);
    setError(null);
    try {
      await claimFn({ mailboxId, appId });
      setClaimedIds(prev => new Set([...prev, mailboxId]));
    } catch (err) {
      setError(err.message || '수령에 실패했습니다.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimAll = async () => {
    if (claimingId || claimingAll || visibleMail.length === 0) return;
    setClaimingAll(true);
    setError(null);
    try {
      await claimFn({ mailboxId: null, appId });
      setClaimedIds(prev => new Set([...prev, ...visibleMail.map(i => i.id)]));
    } catch (err) {
      setError(err.message || '수령에 실패했습니다.');
    } finally {
      setClaimingAll(false);
    }
  };

  const formatDate = (createdAt) => {
    if (!createdAt) return '';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>

        {/* 헤더 + 탭 */}
        <div className="flex-none">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">📬 {t.inbox_title || '소식함'}</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex border-b border-slate-100 dark:border-slate-700 px-5">
            <button
              onClick={() => setTab('notifications')}
              className={`flex-1 py-2.5 text-xs font-black transition-colors relative ${tab === 'notifications' ? 'text-orange-600' : 'text-slate-400'}`}
            >
              🔔 {t.inbox_tab_notifications || '알림'}
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black">
                  {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                </span>
              )}
              {tab === 'notifications' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
            </button>
            <button
              onClick={() => setTab('mailbox')}
              className={`flex-1 py-2.5 text-xs font-black transition-colors relative ${tab === 'mailbox' ? 'text-orange-600' : 'text-slate-400'}`}
            >
              🎁 {t.inbox_tab_mailbox || '우편함'}
              {visibleMail.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black">
                  {visibleMail.length > 9 ? '9+' : visibleMail.length}
                </span>
              )}
              {tab === 'mailbox' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
            </button>
          </div>
        </div>

        {/* 에러 */}
        {error && <p className="text-xs text-red-500 font-bold text-center px-5 py-2">{error}</p>}

        {/* 알림 탭 내용 */}
        {tab === 'notifications' && (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {notifications.length === 0 ? (
              <div className="py-16 text-center">
                <img src="/icons/odok_waving.png" alt="" className="w-20 h-20 mx-auto mb-2 opacity-80" />
                <p className="text-sm text-slate-400 dark:text-slate-500 font-bold">{t.notification_empty || '아직 알림이 없어요'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {notifications.map((n) => {
                  const config = ICON_MAP[n.type] || ICON_MAP.default;
                  const Icon = config.icon;
                  return (
                    <div key={n.id} className={`flex items-start gap-3 px-5 py-3.5 ${!n.read ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                      <div className={`w-9 h-9 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">
                          <span className="font-bold">{n.senderName || '알 수 없음'}</span>
                          {n.type === 'comment' && (t.notification_comment || '님이 댓글을 남겼어요')}
                          {n.type === 'like' && (t.notification_like || '님이 좋아요를 눌렀어요')}
                          {n.type === 'follow' && (t.notification_follow || '님이 팔로우했어요')}
                          {n.type === 'new_book' && (t.notification_new_book || '님이 새 책을 올렸어요')}
                          {n.type === 'new_episode' && (t.notification_new_episode || '님이 새 에피소드를 올렸어요')}
                          {n.type === 'gift' && (t.notification_gift || '님이 선물을 보냈어요')}
                        </p>
                        {n.bookTitle && <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">📖 {n.bookTitle}</p>}
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-2" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 우편함 탭 내용 */}
        {tab === 'mailbox' && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
              {visibleMail.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <span className="text-5xl">📭</span>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{t.mailbox_empty || '받은 선물이 없습니다'}</p>
                </div>
              ) : (
                visibleMail.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-2xl px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center shrink-0 shadow-sm text-xl">
                      {item.type === 'ink' ? '💧' : (ITEM_EMOJI[item.itemId] || '🎁')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                        {item.type === 'ink' ? `잉크 ${item.quantity}개` : `${item.itemName || item.itemId} ${item.quantity}개`}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {item.senderName || '누군가'}님이 보냄 · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleClaim(item.id)}
                      disabled={!!claimingId || claimingAll}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-black bg-orange-500 text-white active:scale-95 transition-all disabled:opacity-50"
                    >
                      {claimingId === item.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : (t.mailbox_claim || '받기')}
                    </button>
                  </div>
                ))
              )}
            </div>
            {visibleMail.length > 1 && (
              <div className="px-5 pb-8 pt-3 flex-none border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={handleClaimAll}
                  disabled={claimingAll || !!claimingId}
                  className="w-full py-3 rounded-xl text-sm font-black bg-gradient-to-r from-orange-500 to-pink-500 text-white flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-md shadow-orange-200 dark:shadow-orange-900/30"
                >
                  {claimingAll ? <><Loader className="w-4 h-4 animate-spin" /> 수령 중...</> : <><CheckCircle className="w-4 h-4" /> {t.mailbox_claim_all || '모두 받기'} ({visibleMail.length})</>}
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default NotificationModal;
