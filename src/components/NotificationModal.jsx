// src/components/NotificationModal.jsx
// 인앱 알림 내역 모달
import React from 'react';
import { X, MessageCircle, Heart, UserPlus, Gift, Bell } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const ICON_MAP = {
  comment: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  like: { icon: Heart, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
  follow: { icon: UserPlus, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' },
  gift: { icon: Gift, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' },
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

const NotificationModal = ({ notifications, userId, onClose, t = {} }) => {
  // 모달 열 때 모든 알림을 읽음 처리
  React.useEffect(() => {
    if (!userId) return;
    notifications.forEach((n) => {
      if (!n.read) {
        updateDoc(
          doc(db, 'artifacts', appId, 'users', userId, 'notifications', n.id),
          { read: true }
        ).catch(() => {});
      }
    });
  }, [notifications, userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              {t.notification_title || '알림'}
            </h2>
            <span className="text-xs text-slate-400">({notifications.length})</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* 알림 목록 */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-slate-500 font-bold">
                {t.notification_empty || '아직 알림이 없어요'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {notifications.map((n) => {
                const config = ICON_MAP[n.type] || ICON_MAP.default;
                const Icon = config.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${
                      !n.read ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">
                        <span className="font-bold">{n.senderName || '알 수 없음'}</span>
                        {n.type === 'comment' && <>{t.notification_comment || '님이 댓글을 남겼어요'}</>}
                        {n.type === 'like' && <>{t.notification_like || '님이 좋아요를 눌렀어요'}</>}
                        {n.type === 'follow' && <>{t.notification_follow || '님이 팔로우했어요'}</>}
                        {n.type === 'gift' && <>{t.notification_gift || '님이 선물을 보냈어요'}</>}
                        {!['comment', 'like', 'follow', 'gift'].includes(n.type) && (n.message || '')}
                      </p>
                      {n.bookTitle && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          📖 {n.bookTitle}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
